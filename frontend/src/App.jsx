import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME DEFINITIONS ──────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#07090F",
    bgSecondary: "#0E1219",
    bgTertiary: "#151B26",
    bgCard: "rgba(255,255,255,0.03)",
    bgCardHover: "rgba(255,255,255,0.06)",
    bgInput: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.07)",
    borderActive: "rgba(255,255,255,0.15)",
    text: "#F0F2F5",
    textSecondary: "rgba(255,255,255,0.55)",
    textMuted: "rgba(255,255,255,0.3)",
    shadow: "0 8px 40px rgba(0,0,0,0.4)",
    chatBubbleUser: "linear-gradient(135deg,#3ECFB2,#2BA89A)",
    chatBubbleUserText: "#062B24",
    chatBubbleBot: "rgba(255,255,255,0.06)",
    chatBubbleBotText: "rgba(255,255,255,0.82)",
    heroGradient: "radial-gradient(ellipse 120% 80% at 50% 0%, #14312C 0%, #07090F 60%)",
    accent: "#3ECFB2",
    accentSoft: "rgba(62,207,178,0.12)",
    accentGlow: "rgba(62,207,178,0.25)",
    pink: "#F472B6",
    pinkSoft: "rgba(244,114,182,0.12)",
    orange: "#FB923C",
    orangeSoft: "rgba(251,146,60,0.12)",
    violet: "#A78BFA",
    violetSoft: "rgba(167,139,250,0.12)",
    danger: "#F87171",
    dangerSoft: "rgba(248,113,113,0.12)",
    success: "#4ADE80",
    successSoft: "rgba(74,222,128,0.12)",
    navBg: "rgba(7,9,15,0.82)",
    overlayBg: "rgba(0,0,0,0.6)",
  },
  light: {
    bg: "#F8F6F3",
    bgSecondary: "#FFFFFF",
    bgTertiary: "#F0EDEA",
    bgCard: "rgba(0,0,0,0.025)",
    bgCardHover: "rgba(0,0,0,0.05)",
    bgInput: "rgba(0,0,0,0.04)",
    border: "rgba(0,0,0,0.08)",
    borderActive: "rgba(0,0,0,0.18)",
    text: "#1A1A1A",
    textSecondary: "rgba(0,0,0,0.55)",
    textMuted: "rgba(0,0,0,0.3)",
    shadow: "0 8px 40px rgba(0,0,0,0.08)",
    chatBubbleUser: "linear-gradient(135deg,#1A8A74,#15705E)",
    chatBubbleUserText: "#FFFFFF",
    chatBubbleBot: "rgba(0,0,0,0.045)",
    chatBubbleBotText: "rgba(0,0,0,0.78)",
    heroGradient: "radial-gradient(ellipse 120% 80% at 50% 0%, #D5F0EA 0%, #F8F6F3 60%)",
    accent: "#1A8A74",
    accentSoft: "rgba(26,138,116,0.1)",
    accentGlow: "rgba(26,138,116,0.18)",
    pink: "#DB2777",
    pinkSoft: "rgba(219,39,119,0.08)",
    orange: "#EA580C",
    orangeSoft: "rgba(234,88,12,0.08)",
    violet: "#7C3AED",
    violetSoft: "rgba(124,58,237,0.08)",
    danger: "#DC2626",
    dangerSoft: "rgba(220,38,38,0.08)",
    success: "#16A34A",
    successSoft: "rgba(22,163,74,0.08)",
    navBg: "rgba(248,246,243,0.88)",
    overlayBg: "rgba(255,255,255,0.6)",
  },
};

// ─── AGENT DEFINITIONS ──────────────────────────────────────────────────────────
const AGENTS = {
  coordinator: { id: "coordinator", name: "PawCommand", icon: "🧠", desc: "Central AI Coordinator" },
  adoption: { id: "adoption", name: "MatchPaw", icon: "💕", desc: "Adoption Matchmaker" },
  health: { id: "health", name: "HealthPaw", icon: "💊", desc: "Pet Health Advisor" },
  community: { id: "community", name: "PawNetwork", icon: "🌐", desc: "Community Alerts" },
  vet: { id: "vet", name: "VetLocator", icon: "🏥", desc: "Find Vets" },
  geo: { id: "geo", name: "GeoTracker", icon: "📍", desc: "Location Services" },
};

// ─── PET DATA WITH REAL PHOTOS ──────────────────────────────────────────────────
const ADOPTABLE_PETS = [
  { id: 1, name: "Charlie", type: "Dog", breed: "Labrador Retriever", age: "2 years", size: "Large", energy: "High", temperament: "Playful", goodWith: ["kids", "dogs"], personality: "Loves water, fetches endlessly, loyal companion", shelter: "Happy Tails Rescue", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop" },
  { id: 2, name: "Mittens", type: "Cat", breed: "Persian", age: "3 years", size: "Medium", energy: "Low", temperament: "Calm", goodWith: ["seniors", "cats"], personality: "Gentle lap cat, loves quiet afternoons, very affectionate", shelter: "Whisker Haven", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop" },
  { id: 3, name: "Rocky", type: "Dog", breed: "Pit Bull Terrier", age: "4 years", size: "Large", energy: "Medium", temperament: "Gentle", goodWith: ["adults", "dogs"], personality: "Gentle giant, couch potato, loves belly rubs", shelter: "Second Chance Shelter", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&h=400&fit=crop" },
  { id: 4, name: "Cleo", type: "Cat", breed: "Bengal", age: "1 year", size: "Medium", energy: "High", temperament: "Adventurous", goodWith: ["kids", "cats", "dogs"], personality: "Curious explorer, very vocal, loves climbing", shelter: "Feline Friends", vaccinated: true, neutered: false, photo: "https://images.unsplash.com/photo-1615497001839-b0a0eac3274c?w=400&h=400&fit=crop" },
  { id: 5, name: "Daisy", type: "Dog", breed: "Beagle", age: "5 years", size: "Medium", energy: "Medium", temperament: "Sweet", goodWith: ["kids", "dogs", "seniors"], personality: "Sweet-natured, follows scent trails, great family dog", shelter: "Forever Home", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=400&h=400&fit=crop" },
  { id: 6, name: "Oliver", type: "Rabbit", breed: "Holland Lop", age: "1 year", size: "Small", energy: "Low", temperament: "Curious", goodWith: ["kids", "seniors"], personality: "Curious, friendly, loves to be held and cuddled", shelter: "Bunny Rescue", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=400&fit=crop" },
  { id: 7, name: "Luna", type: "Cat", breed: "Siamese", age: "2 years", size: "Medium", energy: "Medium", temperament: "Playful", goodWith: ["kids", "cats"], personality: "Talkative, social, bonds deeply with her person", shelter: "Purrfect Match", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=400&h=400&fit=crop" },
  { id: 8, name: "Bear", type: "Dog", breed: "Bernese Mountain Dog", age: "3 years", size: "Large", energy: "Medium", temperament: "Calm", goodWith: ["kids", "dogs", "seniors"], personality: "Majestic, patient, the ultimate cuddle buddy", shelter: "Mountain Dog Rescue", vaccinated: true, neutered: true, photo: "https://images.unsplash.com/photo-1587559070757-f72a388edbba?w=400&h=400&fit=crop" },
];

// ─── EXPANDED QUIZ ──────────────────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  { id: "type", q: "What kind of companion are you looking for?", icon: "🐾", opts: [
    { label: "Dog", icon: "🐕", value: "Dog" }, { label: "Cat", icon: "🐈", value: "Cat" },
    { label: "Rabbit", icon: "🐰", value: "Rabbit" }, { label: "Open to Any", icon: "✨", value: "Any" },
  ]},
  { id: "activity", q: "How would you describe your daily activity level?", icon: "🏃", opts: [
    { label: "Very Active — I run, hike, or exercise daily", icon: "⚡", value: "High" },
    { label: "Moderate — I enjoy regular walks and activities", icon: "🚶", value: "Medium" },
    { label: "Relaxed — I prefer quiet evenings at home", icon: "🛋️", value: "Low" },
  ]},
  { id: "space", q: "What best describes your living space?", icon: "🏡", opts: [
    { label: "Apartment or condo", icon: "🏢", value: "small" },
    { label: "House with small yard", icon: "🏠", value: "medium" },
    { label: "Large property or farm", icon: "🌳", value: "large" },
  ]},
  { id: "household", q: "Who shares your home?", icon: "👨‍👩‍👧‍👦", opts: [
    { label: "Just me", icon: "🧑", value: "solo" },
    { label: "Partner / roommates", icon: "👫", value: "adults" },
    { label: "Family with young children", icon: "👶", value: "kids" },
    { label: "Seniors", icon: "👴", value: "seniors" },
  ]},
  { id: "experience", q: "What's your experience with pets?", icon: "📖", opts: [
    { label: "First-time pet owner", icon: "🌱", value: "beginner" },
    { label: "Had pets growing up", icon: "🌿", value: "some" },
    { label: "Experienced pet parent", icon: "🌳", value: "experienced" },
  ]},
  { id: "time", q: "How much time can you dedicate to your pet daily?", icon: "⏰", opts: [
    { label: "1–2 hours", icon: "🕐", value: "low" },
    { label: "3–4 hours", icon: "🕒", value: "medium" },
    { label: "5+ hours — I work from home", icon: "🕔", value: "high" },
  ]},
  { id: "temperament", q: "What personality do you connect with most?", icon: "💛", opts: [
    { label: "Playful & energetic", icon: "🎾", value: "Playful" },
    { label: "Calm & cuddly", icon: "🧸", value: "Calm" },
    { label: "Adventurous & curious", icon: "🗺️", value: "Adventurous" },
    { label: "Gentle & sweet", icon: "🌸", value: "Gentle" },
  ]},
  { id: "size", q: "What size pet works best for your lifestyle?", icon: "📏", opts: [
    { label: "Small (under 15 lbs)", icon: "🐹", value: "Small" },
    { label: "Medium (15–50 lbs)", icon: "🐕‍🦺", value: "Medium" },
    { label: "Large (50+ lbs)", icon: "🦮", value: "Large" },
    { label: "Size doesn't matter", icon: "💫", value: "Any" },
  ]},
];

// ─── CHATBOT AI RESPONSES ───────────────────────────────────────────────────────
function getAgentResponse(message, agent) {
  const l = message.toLowerCase();
  if (agent === "adoption" || l.includes("adopt") || l.includes("match") || l.includes("pet") || l.includes("rescue")) {
    if (l.includes("dog") || l.includes("puppy")) return "🐶 Great choice! I have several wonderful dogs waiting for homes. Charlie is a joyful Labrador who loves water — perfect for active families. Rocky is a gentle Pit Bull who's really a couch potato at heart. And Bear, our Bernese Mountain Dog, is the ultimate cuddle buddy. Want to take the matching quiz for a personalized recommendation?";
    if (l.includes("cat") || l.includes("kitten")) return "🐱 Cats are wonderful companions! Mittens is a gorgeous Persian who loves quiet afternoons on your lap. Cleo is a Bengal with boundless curiosity — great for active households. And Luna, our Siamese, will literally talk to you all day! Shall I start the compatibility quiz?";
    if (l.includes("rabbit") || l.includes("bunny")) return "🐰 Oliver, our Holland Lop, is an absolute sweetheart! He's curious, friendly, and loves being held. Rabbits make fantastic apartment pets and bond deeply with their humans. Want to learn more about rabbit care?";
    if (l.includes("quiz") || l.includes("match") || l.includes("find")) return "✨ Absolutely! Head to the Adoption tab and click 'Start Matching Quiz' — it's 8 questions that help me understand your lifestyle, living space, experience level, and personality preferences. I'll use our AI compatibility engine to find your perfect match!";
    return "💕 I'm MatchPaw, your adoption matchmaker! I use AI-powered personality matching to pair you with your ideal pet. I consider your lifestyle, living space, activity level, experience, and family composition. Try the quiz on the Adoption page, or ask me about specific pets!";
  }
  if (agent === "health" || l.includes("health") || l.includes("sick") || l.includes("food") || l.includes("symptom")) {
    if (l.includes("food") || l.includes("diet") || l.includes("eat")) return "🍗 Nutrition is key! For dogs: high-quality protein should be the first ingredient. For cats: they're obligate carnivores — grain-free, high-protein is ideal. Puppies/kittens need more frequent, smaller meals. Want me to create a personalized diet plan? Tell me the species, breed, age, and weight.";
    if (l.includes("vaccine") || l.includes("shot")) return "💉 Core vaccines for dogs: DHPP, Rabies. For cats: FVRCP, Rabies. Puppies/kittens need boosters at 8, 12, and 16 weeks, then annually. I can generate a full vaccination schedule — what's your pet's species and age?";
    return "💊 I'm HealthPaw! I can help with nutrition planning, symptom checking, vaccination schedules, and wellness tips. For emergencies, I'll connect you with VetLocator. What's on your mind?";
  }
  if (agent === "vet" || l.includes("vet") || l.includes("emergency") || l.includes("hospital")) {
    if (l.includes("emergency") || l.includes("urgent") || l.includes("hurt")) return "🚨 EMERGENCY — Stay calm. The nearest 24/7 emergency vet would be listed on the Vet tab. While en route: keep your pet warm and still, don't give medications without vet guidance, and apply gentle pressure to any wounds with a clean cloth. What's happening with your pet?";
    return "🏥 I'm VetLocator! I find the nearest and best-rated veterinary hospitals. I can filter by emergency services, specialties, ratings, and hours. Describe what your pet needs and I'll find the right place!";
  }
  if (agent === "community" || l.includes("community") || l.includes("alert") || l.includes("event")) {
    return "🌐 I'm PawNetwork! I connect you with local pet communities for adoption events, playdate coordination, and neighborhood updates. There's a 'Bark in the Park' this Saturday and a 'Cat Café Adoption Day' on Sunday. Want details?";
  }
  if (agent === "geo" || l.includes("where") || l.includes("near") || l.includes("location") || l.includes("park")) {
    return "📍 GeoTracker here! I can locate nearby pet shelters, dog parks, pet-friendly restaurants, grooming salons, and pet stores. What are you looking for in your area?";
  }
  // Default coordinator
  if (l.includes("hello") || l.includes("hi") || l.includes("hey") || l.includes("help")) {
    return "🧠 Welcome to PawCommand! I coordinate 6 AI agents:\n\n💕 MatchPaw — Adoption matching & quiz\n💊 HealthPaw — Health & nutrition advice\n🏥 VetLocator — Find veterinary care\n📍 GeoTracker — Location-based pet services\n🌐 PawNetwork — Community events & alerts\n\nTry: \"Help me adopt a pet\" or \"Find a vet near me\"!";
  }
  return "🧠 I'm PawCommand, your central AI coordinator. I can route you to the right specialist agent. Try asking about adoption, pet health, finding a vet, or community events!";
}

// ─── MAIN APPLICATION ───────────────────────────────────────────────────────────
export default function PawCommandApp() {
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("home");
  const [messages, setMessages] = useState([
    { from: "coordinator", text: "🧠 Hey there! Welcome to PawCommand — your AI-powered pet companion platform. I have 6 specialized agents ready to help. What can I do for you today?", time: "Now" },
  ]);
  const [input, setInput] = useState("");
  const [activeAgent, setActiveAgent] = useState("coordinator");
  const [quizStep, setQuizStep] = useState(-1); // -1 = not started
  const [quizAnswers, setQuizAnswers] = useState({});
  const [matches, setMatches] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petFilter, setPetFilter] = useState("All");
  const chatEndRef = useRef(null);
  const t = THEMES[theme];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { from: "user", text: input, time: "Now" };
    setMessages(prev => [...prev, userMsg]);
    const lower = input.toLowerCase();
    let target = activeAgent;
    if (lower.includes("adopt") || lower.includes("match") || lower.includes("rescue") || lower.includes("pet") || lower.includes("dog") || lower.includes("cat") || lower.includes("rabbit")) target = "adoption";
    else if (lower.includes("health") || lower.includes("sick") || lower.includes("food") || lower.includes("vaccine")) target = "health";
    else if (lower.includes("vet") || lower.includes("emergency") || lower.includes("hospital")) target = "vet";
    else if (lower.includes("community") || lower.includes("event") || lower.includes("alert")) target = "community";
    else if (lower.includes("where") || lower.includes("near") || lower.includes("location") || lower.includes("park")) target = "geo";
    setTimeout(() => {
      setMessages(prev => [...prev, { from: target, text: getAgentResponse(input, target), time: "Now" }]);
      setActiveAgent(target);
    }, 500 + Math.random() * 700);
    setInput("");
  }

  function startQuiz() { setQuizStep(0); setQuizAnswers({}); setMatches(null); }
  function answerQuiz(value) {
    const newA = { ...quizAnswers, [QUIZ_QUESTIONS[quizStep].id]: value };
    setQuizAnswers(newA);
    if (quizStep < QUIZ_QUESTIONS.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      // Score pets
      const scored = ADOPTABLE_PETS.map(p => {
        let score = 0;
        if (newA.type === "Any" || p.type === newA.type) score += 18;
        if ((newA.activity === "High" && p.energy === "High") || (newA.activity === "Medium" && p.energy === "Medium") || (newA.activity === "Low" && p.energy === "Low")) score += 16;
        if (newA.household === "kids" && p.goodWith.includes("kids")) score += 14;
        if (newA.household === "seniors" && p.goodWith.includes("seniors")) score += 14;
        if (newA.household === "solo" || newA.household === "adults") score += 8;
        if (newA.temperament === p.temperament) score += 18;
        if (newA.size === "Any" || newA.size === p.size) score += 10;
        if (newA.space === "small" && p.size === "Small") score += 8;
        if (newA.space === "large" && p.size === "Large") score += 8;
        if (newA.experience === "beginner" && (p.temperament === "Calm" || p.temperament === "Gentle")) score += 6;
        if (newA.experience === "experienced" && (p.temperament === "Adventurous" || p.energy === "High")) score += 6;
        if (newA.time === "high") score += 4;
        if (newA.time === "low" && p.energy === "Low") score += 6;
        score += Math.random() * 6;
        return { ...p, score: Math.min(99, Math.round(score)) };
      }).sort((a, b) => b.score - a.score);
      setMatches(scored);
      setQuizStep(-1);
    }
  }

  const filteredPets = petFilter === "All" ? ADOPTABLE_PETS : ADOPTABLE_PETS.filter(p => p.type === petFilter);

  // ─── CHAT COMPONENT (shared between home and chat views) ────────────────────
  const ChatBox = ({ height = 480, showHeader = true }) => (
    <div style={{ display: "flex", flexDirection: "column", height, borderRadius: 24, overflow: "hidden", background: t.bgSecondary, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      {showHeader && (
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.success, boxShadow: `0 0 8px ${t.successSoft}` }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>PawCommand AI Chat</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.values(AGENTS).map(a => (
              <button key={a.id} onClick={() => setActiveAgent(a.id)} title={a.name} style={{
                width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                background: activeAgent === a.id ? t.accentSoft : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{a.icon}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => {
          const isUser = msg.from === "user";
          const agent = AGENTS[msg.from];
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "82%", flexDirection: isUser ? "row-reverse" : "row", animation: "fadeIn 0.3s ease" }}>
              {!isUser && (
                <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: t.accentSoft, fontSize: 15, flexShrink: 0 }}>
                  {agent?.icon || "🧠"}
                </div>
              )}
              <div>
                {!isUser && <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, marginBottom: 4, marginLeft: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{agent?.name || "Agent"}</div>}
                <div style={{
                  padding: "11px 16px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isUser ? t.chatBubbleUser : t.chatBubbleBot,
                  color: isUser ? t.chatBubbleUserText : t.chatBubbleBotText,
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line",
                }}>{msg.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      {/* Quick prompts */}
      <div style={{ padding: "8px 16px 4px", display: "flex", gap: 6, overflowX: "auto" }}>
        {["Help me adopt a pet", "Take matching quiz", "Cat or dog?", "Pet health tips", "Find a vet"].map(s => (
          <button key={s} onClick={() => setInput(s)} style={{
            flex: "0 0 auto", padding: "5px 12px", borderRadius: 14, fontSize: 11, cursor: "pointer",
            border: `1px solid ${t.border}`, background: t.bgCard, color: t.textSecondary, whiteSpace: "nowrap",
          }}>{s}</button>
        ))}
      </div>
      {/* Input */}
      <div style={{ padding: "10px 16px 14px", display: "flex", gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Ask about adoption, health, vets, events..."
          style={{ flex: 1, padding: "11px 18px", borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 13, outline: "none" }}
        />
        <button onClick={sendMessage} style={{ padding: "11px 22px", borderRadius: 16, border: "none", background: t.chatBubbleUser, color: t.chatBubbleUserText, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Send ✦</button>
      </div>
    </div>
  );

  // ─── PET CARD ───────────────────────────────────────────────────────────────
  const PetCard = ({ pet, score = null, rank = null, onSelect }) => (
    <div onClick={() => onSelect?.(pet)} style={{
      borderRadius: 20, overflow: "hidden", background: t.bgSecondary, border: `1.5px solid ${rank === 0 ? t.accent + "50" : t.border}`,
      cursor: "pointer", transition: "all 0.3s", position: "relative", boxShadow: rank === 0 ? `0 4px 24px ${t.accentGlow}` : "none",
    }}>
      {rank === 0 && <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2, padding: "4px 12px", borderRadius: 12, background: t.chatBubbleUser, color: t.chatBubbleUserText, fontSize: 10, fontWeight: 800, letterSpacing: "0.05em" }}>✦ BEST MATCH</div>}
      {score !== null && <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, padding: "4px 10px", borderRadius: 10, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 12, fontWeight: 800 }}>{score}%</div>}
      <div style={{ width: "100%", height: 200, overflow: "hidden", position: "relative" }}>
        <img src={pet.photo} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s" }}
          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
        />
        <div style={{ display: "none", width: "100%", height: "100%", position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center", background: t.bgTertiary, fontSize: 56 }}>
          {pet.type === "Dog" ? "🐶" : pet.type === "Cat" ? "🐱" : "🐰"}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{pet.name}</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, background: t.accentSoft, color: t.accent, fontWeight: 700 }}>{pet.type}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>{pet.breed} · {pet.age} · {pet.size}</div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5, marginBottom: 10 }}>{pet.personality}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {pet.vaccinated && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: t.successSoft, color: t.success, fontWeight: 600 }}>✓ Vaccinated</span>}
          {pet.neutered && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: t.violetSoft, color: t.violet, fontWeight: 600 }}>✓ Neutered</span>}
          {pet.goodWith.map(g => (
            <span key={g} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: t.bgCard, color: t.textMuted, textTransform: "capitalize" }}>{g}</span>
          ))}
        </div>
        {score !== null && (
          <div style={{ marginTop: 10 }}>
            <div style={{ width: "100%", height: 5, borderRadius: 3, background: t.bgCard }}>
              <div style={{ width: `${score}%`, height: "100%", borderRadius: 3, background: t.chatBubbleUser, transition: "width 1s ease" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── PET DETAIL MODAL ─────────────────────────────────────────────────────────
  const PetModal = ({ pet, onClose }) => (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: t.overlayBg, backdropFilter: "blur(12px)", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 28, background: t.bgSecondary, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ position: "relative" }}>
          <img src={pet.photo} alt={pet.name} style={{ width: "100%", height: 280, objectFit: "cover", borderRadius: "28px 28px 0 0" }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>{pet.name}</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>{pet.breed} · {pet.age} · {pet.size}</div>
            </div>
            <span style={{ padding: "5px 14px", borderRadius: 14, background: t.accentSoft, color: t.accent, fontWeight: 700, fontSize: 12 }}>{pet.type}</span>
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, marginBottom: 16 }}>{pet.personality}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Energy", value: pet.energy, icon: "⚡" },
              { label: "Temperament", value: pet.temperament, icon: "💛" },
              { label: "Shelter", value: pet.shelter, icon: "🏠" },
              { label: "Size", value: pet.size, icon: "📏" },
            ].map(item => (
              <div key={item.label} style={{ padding: 12, borderRadius: 14, background: t.bgCard, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.icon} {item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {pet.vaccinated && <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 10, background: t.successSoft, color: t.success, fontWeight: 600 }}>✓ Vaccinated</span>}
            {pet.neutered && <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 10, background: t.violetSoft, color: t.violet, fontWeight: 600 }}>✓ Neutered</span>}
            {pet.goodWith.map(g => (
              <span key={g} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 10, background: t.pinkSoft, color: t.pink, fontWeight: 600, textTransform: "capitalize" }}>Good with {g}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ flex: 1, padding: 14, borderRadius: 16, border: "none", background: t.chatBubbleUser, color: t.chatBubbleUserText, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Apply to Adopt {pet.name} 💕</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── RENDER ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Outfit', 'Nunito', sans-serif", transition: "background 0.4s, color 0.4s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 4px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
        button { font-family: inherit; }
        button:hover { filter: brightness(1.05); }
        input:focus { border-color: ${t.accent} !important; }
        img { display: block; }
      `}</style>

      {/* ═══ HEADER / NAV ═══ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: t.navBg, backdropFilter: "blur(24px)", borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { setView("home"); setMatches(null); setQuizStep(-1); }}>
          <span style={{ fontSize: 22, animation: "float 3s ease-in-out infinite" }}>🐾</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: t.accent, letterSpacing: "-0.02em" }}>PawCommand</div>
            <div style={{ fontSize: 8, color: t.textMuted, letterSpacing: "0.18em", textTransform: "uppercase" }}>Multi-Agent AI</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { id: "home", icon: "💬", label: "Home" },
            { id: "adopt", icon: "💕", label: "Adopt" },
            { id: "chat", icon: "🤖", label: "Chat" },
          ].map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              padding: "7px 14px", borderRadius: 14, border: "none", cursor: "pointer",
              background: view === n.id ? t.accentSoft : "transparent",
              color: view === n.id ? t.accent : t.textSecondary,
              fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, transition: "all 0.25s",
            }}>
              <span style={{ fontSize: 13 }}>{n.icon}</span>{n.label}
            </button>
          ))}
          {/* Theme toggle */}
          <button onClick={toggleTheme} style={{
            width: 38, height: 38, borderRadius: 12, border: `1.5px solid ${t.border}`,
            background: t.bgCard, cursor: "pointer", fontSize: 16, marginLeft: 6,
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s",
          }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </nav>

      {selectedPet && <PetModal pet={selectedPet} onClose={() => setSelectedPet(null)} />}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 80px" }}>

        {/* ═══════════ HOME — CHATBOX HERO ═══════════ */}
        {view === "home" && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            {/* Hero section */}
            <div style={{ padding: "48px 0 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12, animation: "float 4s ease-in-out infinite" }}>🐾</div>
              <h1 style={{ fontSize: 36, fontWeight: 900, color: t.text, lineHeight: 1.15, marginBottom: 8, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>
                Your AI Pet<br />
                <span style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Companion Platform</span>
              </h1>
              <p style={{ fontSize: 15, color: t.textSecondary, maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.6 }}>
                6 intelligent agents working together to help you adopt, care for, and connect with pets.
              </p>
            </div>

            {/* MAIN CHATBOX — FULL WIDTH HERO */}
            <div style={{ marginBottom: 32 }}>
              <ChatBox height={520} showHeader={true} />
            </div>

            {/* Agent badges */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 36 }}>
              {Object.values(AGENTS).map((a, i) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20,
                  background: t.bgCard, border: `1px solid ${t.border}`, animation: `fadeIn 0.4s ${i * 0.06}s both`,
                }}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>{a.name}</span>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.success }} />
                </div>
              ))}
            </div>

            {/* Quick action cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
              {[
                { icon: "💕", title: "Find Your Match", desc: "AI-powered adoption quiz", color: t.pink, view: "adopt" },
                { icon: "🤖", title: "Talk to Agents", desc: "6 specialized AI helpers", color: t.accent, view: "chat" },
                { icon: "🐾", title: "Browse Pets", desc: "View all available animals", color: t.violet, view: "adopt" },
              ].map((card, i) => (
                <button key={i} onClick={() => setView(card.view)} style={{
                  padding: 20, borderRadius: 20, border: `1.5px solid ${card.color}20`,
                  background: t.bgSecondary, cursor: "pointer", textAlign: "left",
                  animation: `slideUp 0.5s ${i * 0.1}s both`, transition: "all 0.3s",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{card.desc}</div>
                </button>
              ))}
            </div>

            {/* Featured pets preview */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>Featured Pets ✦</div>
                <button onClick={() => setView("adopt")} style={{ fontSize: 12, fontWeight: 700, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>View all →</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220, 1fr))", gap: 14 }}>
                {ADOPTABLE_PETS.slice(0, 4).map((pet, i) => (
                  <div key={pet.id} style={{ animation: `slideUp 0.5s ${i * 0.08}s both` }}>
                    <PetCard pet={pet} onSelect={setSelectedPet} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ADOPTION VIEW ═══════════ */}
        {view === "adopt" && (
          <div style={{ animation: "fadeIn 0.5s ease", paddingTop: 24 }}>

            {/* Quiz Section */}
            {quizStep === -1 && !matches && (
              <div style={{
                textAlign: "center", padding: "40px 24px", borderRadius: 28, marginBottom: 32,
                background: `linear-gradient(135deg, ${t.pinkSoft}, ${t.violetSoft})`,
                border: `1.5px solid ${t.pink}20`, position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: `${t.pink}08` }} />
                <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: `${t.violet}08` }} />
                <div style={{ fontSize: 52, marginBottom: 12, position: "relative" }}>💕🐾✨</div>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Find Your Perfect Match</h2>
                <p style={{ fontSize: 14, color: t.textSecondary, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Answer 8 lifestyle questions and our AI will match you with your ideal companion from {ADOPTABLE_PETS.length} available pets.
                </p>
                <button onClick={startQuiz} style={{
                  padding: "14px 40px", borderRadius: 22, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${t.pink}, ${t.violet})`, color: "#fff",
                  fontWeight: 800, fontSize: 15, boxShadow: `0 6px 28px ${t.pink}30`,
                  transition: "all 0.3s",
                }}>Start Matching Quiz ✦</button>
              </div>
            )}

            {/* Active Quiz */}
            {quizStep >= 0 && (
              <div style={{ maxWidth: 560, margin: "0 auto 32px", animation: "scaleIn 0.3s ease" }}>
                <div style={{ padding: "32px 28px", borderRadius: 28, background: t.bgSecondary, border: `1.5px solid ${t.border}`, boxShadow: t.shadow }}>
                  {/* Progress */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
                    {QUIZ_QUESTIONS.map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= quizStep ? t.accent : t.bgCard, transition: "background 0.3s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Question {quizStep + 1} of {QUIZ_QUESTIONS.length}</div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{QUIZ_QUESTIONS[quizStep].icon}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: t.text, marginBottom: 20, lineHeight: 1.35, fontFamily: "'Playfair Display', serif" }}>{QUIZ_QUESTIONS[quizStep].q}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {QUIZ_QUESTIONS[quizStep].opts.map(opt => (
                      <button key={opt.value} onClick={() => answerQuiz(opt.value)} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                        borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.bgCard,
                        color: t.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                        textAlign: "left", transition: "all 0.2s",
                      }}>
                        <span style={{ fontSize: 20, width: 32, textAlign: "center" }}>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {quizStep > 0 && (
                    <button onClick={() => setQuizStep(quizStep - 1)} style={{ marginTop: 14, padding: "8px 16px", borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ← Back
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quiz Results */}
            {matches && (
              <div style={{ marginBottom: 36, animation: "fadeIn 0.5s ease" }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 42, marginBottom: 8 }}>🎉</div>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: t.text, marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>Your Top Matches!</h2>
                  <p style={{ fontSize: 13, color: t.textSecondary }}>Based on your {QUIZ_QUESTIONS.length}-question compatibility assessment</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
                  {matches.slice(0, 4).map((pet, i) => (
                    <div key={pet.id} style={{ animation: `slideUp 0.5s ${i * 0.1}s both` }}>
                      <PetCard pet={pet} score={pet.score} rank={i} onSelect={setSelectedPet} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button onClick={startQuiz} style={{ padding: "10px 24px", borderRadius: 16, border: `1.5px solid ${t.border}`, background: "transparent", color: t.textSecondary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Retake Quiz 🔄</button>
                  <button onClick={() => setMatches(null)} style={{ padding: "10px 24px", borderRadius: 16, border: "none", background: t.accentSoft, color: t.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Browse All Pets</button>
                </div>
              </div>
            )}

            {/* All Pets Browser */}
            {!matches && quizStep === -1 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: t.text, fontFamily: "'Playfair Display', serif" }}>All Pets Available ✦</h2>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["All", "Dog", "Cat", "Rabbit"].map(f => (
                      <button key={f} onClick={() => setPetFilter(f)} style={{
                        padding: "6px 16px", borderRadius: 18, border: "none", cursor: "pointer",
                        background: petFilter === f ? t.accent : t.bgCard,
                        color: petFilter === f ? (theme === "dark" ? "#000" : "#fff") : t.textSecondary,
                        fontSize: 12, fontWeight: 700, transition: "all 0.25s",
                      }}>{f === "All" ? "All Pets" : f + "s"}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                  {filteredPets.map((pet, i) => (
                    <div key={pet.id} style={{ animation: `slideUp 0.4s ${i * 0.06}s both` }}>
                      <PetCard pet={pet} onSelect={setSelectedPet} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════ FULL CHAT VIEW ═══════════ */}
        {view === "chat" && (
          <div style={{ paddingTop: 24, animation: "fadeIn 0.5s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: t.text, fontFamily: "'Playfair Display', serif" }}>AI Agent Chat ✦</h2>
              <p style={{ fontSize: 12, color: t.textSecondary }}>Messages auto-route to the right specialist agent</p>
            </div>
            <ChatBox height={600} showHeader={true} />
          </div>
        )}
      </div>
    </div>
  );
}
