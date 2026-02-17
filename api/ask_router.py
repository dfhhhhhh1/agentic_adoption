"""FastAPI router for the pet Q&A multi-agent system.

Endpoints:
  GET  /ask/agents          — List available agent personas
  POST /ask                 — Ask a question to a specific agent
  POST /ask/clear           — Clear conversation history for a session
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.pet_qa import AgentType, ask_agent, get_agent_profiles, clear_history

router = APIRouter(tags=["Q&A Agents"])


# ── Request / Response Schemas ────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="The user's question")
    agent: str = Field(
        default="general",
        description="Agent type: 'vet', 'adoption', 'training', or 'general'",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for conversation continuity. Pass the same ID to maintain context.",
    )
    pet_context: Optional[str] = Field(
        default=None,
        description="Optional context about the user's pet (e.g. 'I have a 2-year-old Golden Retriever')",
    )


class AskResponse(BaseModel):
    agent: dict
    answer: str
    session_id: Optional[str] = None
    error: Optional[str] = None


class ClearRequest(BaseModel):
    session_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ask/agents")
async def list_agents():
    """Return metadata for all available Q&A agent personas."""
    return {"agents": get_agent_profiles()}


@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """Ask a question to a specialized pet agent.
    
    The agent uses your local Ollama LLM to generate responses.
    Optionally pass a session_id to maintain conversation history.
    """
    # Validate agent type
    try:
        agent_type = AgentType(request.agent)
    except ValueError:
        valid = [a.value for a in AgentType]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid agent type '{request.agent}'. Valid types: {valid}",
        )

    result = ask_agent(
        question=request.question,
        agent_type=agent_type,
        session_id=request.session_id,
        pet_context=request.pet_context,
    )

    return AskResponse(**result)


@router.post("/ask/clear")
async def clear_session(request: ClearRequest):
    """Clear conversation history for a given session."""
    clear_history(request.session_id)
    return {"status": "cleared", "session_id": request.session_id}
