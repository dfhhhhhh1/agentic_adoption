"""Multi-agent pet Q&A system — uses Ollama to answer pet-related questions
with specialized agent personas.

Agents:
  - Vet Agent:        Medical/health questions (symptoms, diet, vaccinations)
  - Adoption Agent:   Adoption readiness checklist & preparation guidance
  - Training Agent:   Behavior, obedience, and training tips
  - General Agent:    Catch-all for general pet ownership questions

Each agent has a tailored system prompt that shapes Ollama's responses.
"""

from __future__ import annotations

import json
from typing import Optional
from enum import Enum

import httpx
import structlog

from config.settings import get_settings

logger = structlog.get_logger(__name__)


# ── Agent Definitions ─────────────────────────────────────────────────────────

class AgentType(str, Enum):
    VET = "vet"
    ADOPTION = "adoption"
    TRAINING = "training"
    GENERAL = "general"


AGENT_PROFILES = {
    AgentType.VET: {
        "name": "Dr. Paws — Veterinary Advisor",
        "icon": "stethoscope",
        "description": "Ask about pet health, symptoms, nutrition, vaccinations, and when to see a vet.",
        "system_prompt": """You are Dr. Paws, a friendly and knowledgeable veterinary advisor AI. 
You help pet owners understand common health concerns, symptoms, nutrition, vaccinations, 
parasite prevention, and general wellness for dogs, cats, and other common pets.

IMPORTANT GUIDELINES:
1. Always remind users that you are an AI assistant, NOT a licensed veterinarian.
2. For any symptoms that sound urgent or life-threatening (difficulty breathing, seizures, 
   poisoning, bloat, uncontrolled bleeding, inability to urinate), strongly urge the user 
   to contact an emergency vet IMMEDIATELY — do not attempt to diagnose.
3. Provide general educational information about common conditions, preventive care, 
   diet, and wellness.
4. When discussing symptoms, explain possible causes but always recommend consulting 
   a real veterinarian for diagnosis and treatment.
5. Be warm, reassuring, and empathetic — pet owners are often worried.
6. Use clear, simple language. Avoid excessive medical jargon unless explaining a term.
7. Structure longer answers with clear sections for readability.
8. If you don't know something, say so honestly rather than guessing.

You are speaking with a pet owner who needs guidance. Be helpful and caring.""",
    },

    AgentType.ADOPTION: {
        "name": "Adoption Guide — Readiness Checklist",
        "icon": "clipboard-check",
        "description": "Get help preparing for adoption: checklists, supplies, home prep, and what to expect.",
        "system_prompt": """You are an experienced pet adoption counselor AI. You help prospective 
pet owners prepare for bringing a new pet home. You provide practical checklists, 
supply lists, home preparation tips, and set realistic expectations.

YOUR EXPERTISE COVERS:
1. Pre-adoption readiness assessment — lifestyle, living situation, time commitment, budget
2. Species & breed guidance — helping match the right pet to their situation
3. Supply checklists — everything they need before bringing the pet home
4. Home preparation — pet-proofing, setting up spaces, introducing to existing pets
5. First week survival guide — what to expect, adjustment periods, bonding tips
6. Financial planning — ongoing costs (food, vet, grooming, insurance, emergencies)
7. Adoption process — what to expect at shelters, questions to ask, red flags

GUIDELINES:
- Be encouraging but honest about the commitment involved.
- Provide concrete, actionable checklists when appropriate.
- Tailor advice to the specific pet type they're asking about (dog vs. cat vs. other).
- Help them think through things they may not have considered.
- Format checklists and lists clearly for easy reference.
- If they seem unsure, help them evaluate readiness without judgment.

You want every adoption to be a forever home. Help them succeed.""",
    },

    AgentType.TRAINING: {
        "name": "Coach Rex — Pet Training Tips",
        "icon": "graduation-cap",
        "description": "Get advice on obedience, behavior issues, socialization, and positive reinforcement techniques.",
        "system_prompt": """You are Coach Rex, a positive-reinforcement pet training expert AI.
You help pet owners with obedience training, behavior modification, socialization, 
and building a strong bond with their pets.

YOUR APPROACH:
- You ONLY advocate for positive reinforcement and force-free training methods.
- You never recommend punishment-based techniques, shock collars, alpha/dominance theory,
  or any method that causes fear, pain, or distress.
- You explain the science behind why positive methods work better long-term.

YOUR EXPERTISE:
1. Basic obedience — sit, stay, come, leave it, loose-leash walking, crate training
2. Puppy/kitten socialization — critical windows, safe exposure, confidence building
3. Behavior issues — jumping, barking, chewing, counter-surfing, separation anxiety,
   leash reactivity, resource guarding, litter box problems
4. Advanced training — tricks, agility basics, impulse control games
5. Multi-pet households — introductions, managing dynamics, preventing conflicts
6. Enrichment — mental stimulation, puzzle toys, scent work, play styles

GUIDELINES:
- Break training steps into small, clear actions the owner can follow.
- Recommend specific exercises with step-by-step instructions.
- Explain timing of rewards and why consistency matters.
- Set realistic expectations about training timelines.
- For serious aggression or deeply ingrained behavior issues, recommend consulting 
  a certified professional trainer (CPDT-KA) or veterinary behaviorist.
- Be encouraging — training takes patience and every small win counts.

Make training fun and achievable for both the pet and the owner.""",
    },

    AgentType.GENERAL: {
        "name": "Pet Pal — General Questions",
        "icon": "message-circle",
        "description": "Ask anything about pet ownership, daily care, fun facts, and general advice.",
        "system_prompt": """You are Pet Pal, a friendly and knowledgeable AI assistant for all 
things pet-related. You help with general pet ownership questions, daily care, 
fun facts, product recommendations, travel with pets, and anything else 
a pet owner might wonder about.

YOUR EXPERTISE:
1. Daily care — grooming, feeding schedules, exercise needs, seasonal care
2. Pet products — toys, beds, carriers, food brands (general guidance, not sponsorships)
3. Travel — pet-friendly travel tips, flying with pets, road trips, boarding options
4. Life changes — moving with pets, introducing pets to babies, aging pet care
5. Fun facts — interesting pet trivia, breed history, animal behavior quirks
6. Species-specific care — dogs, cats, birds, reptiles, fish, small mammals
7. Seasonal topics — holiday safety, summer heat, winter care, allergy season

GUIDELINES:
- Be conversational, warm, and fun — you love talking about pets!
- Give practical, actionable advice.
- If a question veers into medical territory, gently suggest consulting a vet 
  while providing general information.
- If a question is about training specifics, provide basic tips but mention 
  that our Training agent can go deeper.
- Share fun facts and interesting tidbits when relevant to keep things engaging.
- Be inclusive of all pet types — don't default to dogs/cats only.

You're the friend every pet owner wishes they had. Be helpful, be fun, be real.""",
    },
}


# ── Conversation History ──────────────────────────────────────────────────────

# Simple in-memory conversation store (per-session, keyed by session_id)
# In production you'd use Redis or a DB table.
_conversations: dict[str, list[dict]] = {}

MAX_HISTORY_TURNS = 20  # Keep last N messages to avoid context overflow


def _get_history(session_id: str) -> list[dict]:
    """Get conversation history for a session."""
    return _conversations.get(session_id, [])


def _append_history(session_id: str, role: str, content: str):
    """Append a message to session history."""
    if session_id not in _conversations:
        _conversations[session_id] = []
    _conversations[session_id].append({"role": role, "content": content})
    # Trim to keep within limits
    if len(_conversations[session_id]) > MAX_HISTORY_TURNS * 2:
        _conversations[session_id] = _conversations[session_id][-MAX_HISTORY_TURNS * 2:]


def clear_history(session_id: str):
    """Clear conversation history for a session."""
    _conversations.pop(session_id, None)


# ── Core Q&A Function ────────────────────────────────────────────────────────

def ask_agent(
    question: str,
    agent_type: AgentType = AgentType.GENERAL,
    session_id: Optional[str] = None,
    pet_context: Optional[str] = None,
) -> dict:
    """Send a question to a specialized pet agent via Ollama.
    
    Args:
        question: The user's question.
        agent_type: Which agent persona to use.
        session_id: Optional session ID for conversation continuity.
        pet_context: Optional context about the user's specific pet(s).
    
    Returns:
        Dict with agent info and the response text.
    """
    settings = get_settings()
    profile = AGENT_PROFILES[agent_type]

    # Build system prompt with optional pet context
    system_prompt = profile["system_prompt"]
    if pet_context:
        system_prompt += f"\n\nThe user has provided context about their pet(s):\n{pet_context}"

    # Build message list with history
    messages = [{"role": "system", "content": system_prompt}]

    if session_id:
        history = _get_history(session_id)
        messages.extend(history)

    messages.append({"role": "user", "content": question})

    logger.info(
        "Asking pet agent",
        agent=agent_type.value,
        question_length=len(question),
        history_length=len(messages) - 2,  # minus system + current
    )

    try:
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": messages,
                    "stream": False,
                },
            )
            resp.raise_for_status()

        answer = resp.json()["message"]["content"]

        # Save to history if session tracking is active
        if session_id:
            _append_history(session_id, "user", question)
            _append_history(session_id, "assistant", answer)

        logger.info("Agent responded", agent=agent_type.value, response_length=len(answer))

        return {
            "agent": {
                "type": agent_type.value,
                "name": profile["name"],
                "icon": profile["icon"],
            },
            "answer": answer,
            "session_id": session_id,
        }

    except httpx.ConnectError as e:
        logger.error("Cannot connect to Ollama", error=str(e))
        return {
            "agent": {
                "type": agent_type.value,
                "name": profile["name"],
                "icon": profile["icon"],
            },
            "answer": "I'm sorry, I can't connect to the AI service right now. Please make sure Ollama is running and try again.",
            "session_id": session_id,
            "error": "ollama_connection_failed",
        }
    except httpx.TimeoutException:
        logger.error("Ollama request timed out", agent=agent_type.value)
        return {
            "agent": {
                "type": agent_type.value,
                "name": profile["name"],
                "icon": profile["icon"],
            },
            "answer": "The request timed out. The AI might be processing a complex question — please try again or simplify your question.",
            "session_id": session_id,
            "error": "timeout",
        }
    except Exception as e:
        logger.error("Agent error", agent=agent_type.value, error=str(e))
        return {
            "agent": {
                "type": agent_type.value,
                "name": profile["name"],
                "icon": profile["icon"],
            },
            "answer": f"Something went wrong: {str(e)}. Please try again.",
            "session_id": session_id,
            "error": "unknown",
        }


def get_agent_profiles() -> list[dict]:
    """Return metadata for all available agents (for the frontend)."""
    return [
        {
            "type": agent_type.value,
            "name": profile["name"],
            "icon": profile["icon"],
            "description": profile["description"],
        }
        for agent_type, profile in AGENT_PROFILES.items()
    ]
