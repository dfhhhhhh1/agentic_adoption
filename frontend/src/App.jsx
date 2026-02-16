import { useState, useEffect, useRef, useCallback } from "react";

// === API CONFIGURATION ===
const API_BASE = "http://localhost:8000";

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


const AGENTS = {
  coordinator: { id: "coordinator", name: "PawCommand", icon: "🧠", desc: "Central AI Coordinator" },
  adoption: { id: "adoption", name: "MatchPaw", icon: "💕", desc: "Adoption Matchmaker" },
  health: { id: "health", name: "HealthPaw", icon: "💊", desc: "Pet Health Advisor" },
  community: { id: "community", name: "PawNetwork", icon: "🌐", desc: "Community Alerts" },
  vet: { id: "vet", name: "VetLocator", icon: "🏥", desc: "Find Vets" },
  geo: { id: "geo", name: "GeoTracker", icon: "📍", desc: "Location Services" },
};

// === IMAGE URL RESOLUTION ===
// DB stores image_path like "/images/A755074.jpeg" -> API_BASE + path
// Some entries have "/images/" (no filename) -> show emoji fallback
function resolveImageUrl(imagePath, imageUrls) {
  const tryP = (p) => {
    if (!p || typeof p !== "string") return null;
    const s = p.trim();
    if (!s || s === "/images/" || s === "/images") return null;
    const fn = s.split("/").pop();
    if (!fn || !fn.includes(".")) return null;
    return s.startsWith("http") ? s : `${API_BASE}${s}`;
  };
  const r = tryP(imagePath);
  if (r) return r;
  if (Array.isArray(imageUrls)) { for (const u of imageUrls) { const v = tryP(u); if (v) return v; } }
  return null;
}

// === NORMALIZE PET DATA ===
// Handles: GET /pets (flat with shelter_name), GET /pets/{id} (full with shelter obj),
//          POST /match results (pet: PetSchema with shelter_name)
function normalizePet(p) {
  const species = (p.species || "other").toLowerCase();
  const typeLabel = species === "dog" ? "Dog" : species === "cat" ? "Cat" : species === "rabbit" ? "Rabbit"
    : species === "small_animal" ? "Small Animal" : species === "reptile" ? "Reptile"
    : species === "bird" ? "Bird" : "Other";
  const goodWith = [];
  if (p.good_with_dogs === true) goodWith.push("dogs");
  if (p.good_with_cats === true) goodWith.push("cats");
  if (p.good_with_children === true) goodWith.push("kids");
  const photo = resolveImageUrl(p.image_path, p.image_urls);
  const shelterName = p.shelter_name || (p.shelter && p.shelter.name) || "Unknown Shelter";
  return {
    id: p.id || null, external_id: p.external_id || null, name: p.name || "Unknown",
    type: typeLabel, species, breed: p.breed || "Unknown", age: p.age_text || "Unknown",
    age_months: p.age_months || null, sex: p.sex || "unknown",
    size: capitalize(p.size || "unknown"), energy: capitalize(p.energy_level || "unknown"),
    goodWith, personality: p.personality_description || "", shelter: shelterName,
    shelter_obj: p.shelter || null, neutered: !!p.is_neutered, photo,
    adoption_fee: p.adoption_fee ?? null, weight_lbs: p.weight_lbs || null,
    color: p.color || null, special_needs: p.special_needs || null,
    house_trained: p.house_trained ?? null, listing_url: p.listing_url || null,
    good_with_dogs: p.good_with_dogs ?? null, good_with_cats: p.good_with_cats ?? null,
    good_with_children: p.good_with_children ?? null,
    image_path: p.image_path || null, image_urls: p.image_urls || [],
    intake_date: p.intake_date || null, source: p.source || null,
  };
}
function capitalize(s) { return (!s || s === "unknown") ? s : s.charAt(0).toUpperCase() + s.slice(1); }

// === API HELPERS ===
async function fetchPets(species, limit = 50) {
  try {
    const p = new URLSearchParams();
    if (species && species !== "All") p.set("species", species.toLowerCase());
    p.set("limit", String(limit));
    const r = await fetch(`${API_BASE}/pets?${p}`);
    if (!r.ok) throw new Error(`${r.status}`);
    return ((await r.json()).pets || []).map(normalizePet);
  } catch (e) { console.error("fetchPets:", e); return []; }
}
async function fetchPetDetail(id) {
  try { const r = await fetch(`${API_BASE}/pets/${id}`); if (!r.ok) throw 0; return normalizePet(await r.json()); }
  catch { return null; }
}
async function fetchStats() {
  try { const r = await fetch(`${API_BASE}/stats`); if (!r.ok) throw 0; return await r.json(); }
  catch { return null; }
}
async function fetchMatch(query, speciesFilter, max = 10) {
  try {
    const body = { query, max_results: max };
    if (speciesFilter) body.species_filter = speciesFilter;
    const r = await fetch(`${API_BASE}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw 0;
    return await r.json(); // { query, results: [{ pet, similarity_score, explanation }], reasoning_summary }
  } catch { return null; }
}

// === QUIZ QUESTIONS ===
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


function buildMatchQuery(a) {
  const p = [];
  if (a.type && a.type !== "Any") p.push(`I'm looking for a ${a.type.toLowerCase()}.`); else p.push("I'm open to any type of pet.");
  const am = { High: "very active, I run and hike daily", Medium: "moderately active", Low: "relaxed, quiet evenings at home" };
  if (a.activity) p.push(`I'm ${am[a.activity]}.`);
  const sm = { small: "I live in an apartment", medium: "house with small yard", large: "large property" };
  if (a.space) p.push(`${sm[a.space]}.`);
  const hm = { solo: "I live alone", adults: "with partner/roommates", kids: "family with young children", seniors: "senior household" };
  if (a.household) p.push(`${hm[a.household]}.`);
  const em = { beginner: "First-time pet owner", some: "Had pets growing up", experienced: "Experienced pet parent" };
  if (a.experience) p.push(`${em[a.experience]}.`);
  const tm = { low: "1-2 hours daily", medium: "3-4 hours daily", high: "Work from home, 5+ hours daily" };
  if (a.time) p.push(`${tm[a.time]}.`);
  const pm = { Playful: "playful and energetic", Calm: "calm and cuddly", Adventurous: "adventurous", Gentle: "gentle and sweet" };
  if (a.temperament) p.push(`I prefer ${pm[a.temperament]}.`);
  if (a.size && a.size !== "Any") p.push(`I'd like a ${a.size.toLowerCase()} pet.`);
  return p.join(" ");
}

function getAgentResponse(msg, agent, n) {
  const l = msg.toLowerCase();
  if (agent === "adoption" || l.includes("adopt") || l.includes("match") || l.includes("pet") || l.includes("rescue")) {
    if (l.includes("quiz") || l.includes("match") || l.includes("find")) return `✨ Head to the Adoption tab — our RAG engine will match you from ${n} pets!`;
    if (l.includes("dog")) return `🐶 Browse dogs on the Adopt tab or take the AI matching quiz from ${n} pets!`;
    if (l.includes("cat")) return `🐱 Browse cats on the Adopt tab or try the matching quiz!`;
    if (l.includes("rabbit")) return "🐰 Browse rabbits on the Adopt tab or try the quiz!";
    return `💕 I'm MatchPaw! RAG-powered matching from ${n} pets. Try the quiz!`;
  }
  if (agent === "health" || l.includes("health") || l.includes("sick") || l.includes("food") || l.includes("symptom")) return "💊 I'm HealthPaw! I help with nutrition, symptoms, vaccines, and wellness.";
  if (agent === "vet" || l.includes("vet") || l.includes("emergency")) return "🏥 I'm VetLocator! I find nearby vets for your pet.";
  if (agent === "community" || l.includes("event")) return "🌐 I'm PawNetwork! Local pet community events and alerts.";
  if (agent === "geo" || l.includes("near") || l.includes("park")) return "📍 GeoTracker here! Shelters, parks, pet-friendly spots nearby.";
  if (l.includes("hello") || l.includes("hi") || l.includes("hey") || l.includes("help"))
    return "🧠 Welcome to PawCommand! I coordinate 6 AI agents:\n\n💕 MatchPaw — Adoption matching\n💊 HealthPaw — Health & nutrition\n🏥 VetLocator — Find vets\n📍 GeoTracker — Location services\n🌐 PawNetwork — Community events\n\nTry: \"Help me adopt a pet\"!";
  return "🧠 I'm PawCommand. Ask about adoption, health, vets, or events!";
}

const SE = { Dog: "🐶", Cat: "🐱", Rabbit: "🐰", Reptile: "🐢", "Small Animal": "🐹", Bird: "🐦" };
const seEmoji = (t) => SE[t] || "🐾";


// === MAIN APPLICATION ===
export default function PawCommandApp() {
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("home");
  const [messages, setMessages] = useState([{ from: "coordinator", text: "🧠 Hey there! Welcome to PawCommand — your AI-powered pet companion platform. What can I do for you?", time: "Now" }]);
  const [input, setInput] = useState("");
  const [activeAgent, setActiveAgent] = useState("coordinator");
  const [quizStep, setQuizStep] = useState(-1);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [matches, setMatches] = useState(null);
  const [matchReasoning, setMatchReasoning] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petFilter, setPetFilter] = useState("All");
  const [allPets, setAllPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [apiOnline, setApiOnline] = useState(null);
  const chatEndRef = useRef(null);
  const t = THEMES[theme];

  // Load pets from GET /pets when filter changes
  useEffect(() => { let a=true; setLoading(true); fetchPets(petFilter==="All"?null:petFilter).then(pets=>{if(a){setAllPets(pets);setLoading(false)}}); return()=>{a=false}; }, [petFilter]);
  // Health + stats on mount
  useEffect(() => { fetch(`${API_BASE}/health`).then(r=>r.ok?setApiOnline(true):setApiOnline(false)).catch(()=>setApiOnline(false)); fetchStats().then(s=>{if(s)setStats(s)}); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const toggleTheme = () => setTheme(p => p === "dark" ? "light" : "dark");
  const totalPets = stats ? stats.total_pets : allPets.length;

  function sendMessage() {
    if (!input.trim()) return;
    setMessages(p => [...p, { from: "user", text: input, time: "Now" }]);
    const lo = input.toLowerCase();
    let target = activeAgent;
    if (lo.includes("adopt")||lo.includes("match")||lo.includes("rescue")||lo.includes("pet")||lo.includes("dog")||lo.includes("cat")||lo.includes("rabbit")) target="adoption";
    else if (lo.includes("health")||lo.includes("sick")||lo.includes("food")||lo.includes("vaccine")) target="health";
    else if (lo.includes("vet")||lo.includes("emergency")||lo.includes("hospital")) target="vet";
    else if (lo.includes("community")||lo.includes("event")||lo.includes("alert")) target="community";
    else if (lo.includes("where")||lo.includes("near")||lo.includes("location")||lo.includes("park")) target="geo";
    setTimeout(() => { setMessages(p => [...p, { from: target, text: getAgentResponse(input, target, totalPets), time: "Now" }]); setActiveAgent(target); }, 500+Math.random()*700);
    setInput("");
  }

  function startQuiz() { setQuizStep(0); setQuizAnswers({}); setMatches(null); setMatchReasoning(null); }

  async function answerQuiz(value) {
    const newA = { ...quizAnswers, [QUIZ_QUESTIONS[quizStep].id]: value };
    setQuizAnswers(newA);
    if (quizStep < QUIZ_QUESTIONS.length - 1) { setQuizStep(quizStep + 1); }
    else {
      setQuizStep(-1); setMatchLoading(true);
      const queryText = buildMatchQuery(newA);
      const sf = newA.type !== "Any" ? newA.type.toLowerCase() : null;
      const result = await fetchMatch(queryText, sf, 10);
      if (result && result.results && result.results.length > 0) {
        // similarity_score is 0.0-1.0 (blended), display as %
        const scored = result.results.map(r => ({ ...normalizePet(r.pet), score: Math.round((r.similarity_score||0)*100), explanation: r.explanation||null }));
        setMatches(scored); setMatchReasoning(result.reasoning_summary||null);
      } else { setMatches([]); setMatchReasoning(result?.reasoning_summary||"No matches found."); }
      setMatchLoading(false);
    }
  }

  async function handleSelectPet(pet) {
    if (pet.id && !pet.shelter_obj) { const d = await fetchPetDetail(pet.id); if (d) { setSelectedPet(d); return; } }
    setSelectedPet(pet);
  }

  const filteredPets = allPets;
  const speciesFilters = ["All", "Dog", "Cat", "Rabbit"];
  if (stats) { if (stats.small_animals>0) speciesFilters.push("Small Animal"); if (stats.reptiles>0) speciesFilters.push("Reptile"); if (stats.other>0) speciesFilters.push("Other"); }

  // === ChatBox Component ===
  const ChatBox = ({ height = 480, showHeader = true }) => (
    <div style={{ display:"flex", flexDirection:"column", height, borderRadius:24, overflow:"hidden", background:t.bgSecondary, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      {showHeader && (
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:apiOnline?t.success:t.danger, boxShadow:`0 0 8px ${apiOnline?t.successSoft:t.dangerSoft}` }} />
            <span style={{ fontSize:13, fontWeight:700, color:t.text }}>PawCommand AI Chat</span>
            {apiOnline===false && <span style={{ fontSize:10, color:t.danger, fontWeight:600 }}>API Offline</span>}
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {Object.values(AGENTS).map(a => (<button key={a.id} onClick={()=>setActiveAgent(a.id)} title={a.name} style={{ width:28, height:28, borderRadius:8, border:"none", cursor:"pointer", fontSize:13, background:activeAgent===a.id?t.accentSoft:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>{a.icon}</button>))}
          </div>
        </div>
      )}
      <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        {messages.map((msg,i) => { const isU=msg.from==="user"; const ag=AGENTS[msg.from]; return (
          <div key={i} style={{ display:"flex", gap:8, alignSelf:isU?"flex-end":"flex-start", maxWidth:"82%", flexDirection:isU?"row-reverse":"row", animation:"fadeIn 0.3s ease" }}>
            {!isU && <div style={{ width:32, height:32, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:t.accentSoft, fontSize:15, flexShrink:0 }}>{ag?.icon||"🧠"}</div>}
            <div>
              {!isU && <div style={{ fontSize:10, fontWeight:700, color:t.accent, marginBottom:4, marginLeft:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>{ag?.name||"Agent"}</div>}
              <div style={{ padding:"11px 16px", borderRadius:isU?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isU?t.chatBubbleUser:t.chatBubbleBot, color:isU?t.chatBubbleUserText:t.chatBubbleBotText, fontSize:13, lineHeight:1.6, whiteSpace:"pre-line" }}>{msg.text}</div>
            </div>
          </div>); })}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding:"8px 16px 4px", display:"flex", gap:6, overflowX:"auto" }}>
        {["Help me adopt a pet","Take matching quiz","Cat or dog?","Pet health tips","Find a vet"].map(s=>(<button key={s} onClick={()=>setInput(s)} style={{ flex:"0 0 auto", padding:"5px 12px", borderRadius:14, fontSize:11, cursor:"pointer", border:`1px solid ${t.border}`, background:t.bgCard, color:t.textSecondary, whiteSpace:"nowrap" }}>{s}</button>))}
      </div>
      <div style={{ padding:"10px 16px 14px", display:"flex", gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Ask about adoption, health, vets, events..." style={{ flex:1, padding:"11px 18px", borderRadius:16, border:`1.5px solid ${t.border}`, background:t.bgInput, color:t.text, fontSize:13, outline:"none" }} />
        <button onClick={sendMessage} style={{ padding:"11px 22px", borderRadius:16, border:"none", background:t.chatBubbleUser, color:t.chatBubbleUserText, fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>Send ✦</button>
      </div>
    </div>
  );

  // === PetCard (uses photo from DB via resolveImageUrl) ===
  const PetCard = ({ pet, score=null, rank=null, explanation=null, onSelect }) => (
    <div onClick={()=>onSelect?.(pet)} style={{ borderRadius:20, overflow:"hidden", background:t.bgSecondary, border:`1.5px solid ${rank===0?t.accent+"50":t.border}`, cursor:"pointer", transition:"all 0.3s", position:"relative", boxShadow:rank===0?`0 4px 24px ${t.accentGlow}`:"none" }}>
      {rank===0 && <div style={{ position:"absolute", top:12, left:12, zIndex:2, padding:"4px 12px", borderRadius:12, background:t.chatBubbleUser, color:t.chatBubbleUserText, fontSize:10, fontWeight:800 }}>✦ BEST MATCH</div>}
      {score!==null && <div style={{ position:"absolute", top:12, right:12, zIndex:2, padding:"4px 10px", borderRadius:10, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)", color:"#fff", fontSize:12, fontWeight:800 }}>{score}%</div>}
      <div style={{ width:"100%", height:200, overflow:"hidden", position:"relative", background:t.bgTertiary }}>
        {pet.photo ? (<><img src={pet.photo} alt={pet.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none";if(e.target.nextSibling)e.target.nextSibling.style.display="flex"}} />
          <div style={{ display:"none", width:"100%", height:"100%", position:"absolute", top:0, left:0, alignItems:"center", justifyContent:"center", background:t.bgTertiary, fontSize:56 }}>{seEmoji(pet.type)}</div></>
        ) : (<div style={{ display:"flex", width:"100%", height:"100%", alignItems:"center", justifyContent:"center", background:t.bgTertiary, fontSize:56 }}>{seEmoji(pet.type)}</div>)}
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:16, fontWeight:800, color:t.text }}>{pet.name}</span>
          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:10, background:t.accentSoft, color:t.accent, fontWeight:700 }}>{pet.type}</span>
        </div>
        <div style={{ fontSize:12, color:t.textSecondary, marginBottom:4 }}>{pet.breed} · {pet.age} · {pet.size}</div>
        {pet.weight_lbs && <div style={{ fontSize:11, color:t.textMuted, marginBottom:4 }}>{pet.weight_lbs} lbs · {pet.sex}</div>}
        <div style={{ fontSize:11, color:t.textMuted, lineHeight:1.5, marginBottom:10, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{pet.personality||"No description available"}</div>
        {explanation && <div style={{ fontSize:11, color:t.accent, lineHeight:1.5, marginBottom:10, fontStyle:"italic", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>"{explanation}"</div>}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {pet.neutered && <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, background:t.violetSoft, color:t.violet, fontWeight:600 }}>✓ Neutered</span>}
          {pet.house_trained===true && <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, background:t.successSoft, color:t.success, fontWeight:600 }}>✓ House Trained</span>}
          {pet.goodWith.map(g=>(<span key={g} style={{ fontSize:9, padding:"2px 8px", borderRadius:8, background:t.bgCard, color:t.textMuted, textTransform:"capitalize" }}>{g}</span>))}
          {pet.adoption_fee!=null && <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, background:t.orangeSoft, color:t.orange, fontWeight:600 }}>${pet.adoption_fee}</span>}
        </div>
        {score!==null && <div style={{ marginTop:10 }}><div style={{ width:"100%", height:5, borderRadius:3, background:t.bgCard }}><div style={{ width:`${Math.min(score,100)}%`, height:"100%", borderRadius:3, background:t.chatBubbleUser, transition:"width 1s ease" }}/></div></div>}
      </div>
    </div>
  );

  // === PetModal (full detail from GET /pets/{id}) ===
  const PetModal = ({ pet, onClose }) => (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", background:t.overlayBg, backdropFilter:"blur(12px)", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", borderRadius:28, background:t.bgSecondary, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div style={{ position:"relative" }}>
          {pet.photo ? (<img src={pet.photo} alt={pet.name} style={{ width:"100%", height:280, objectFit:"cover", borderRadius:"28px 28px 0 0" }} onError={e=>{e.target.style.display="none"}} />
          ) : (<div style={{ width:"100%", height:280, display:"flex", alignItems:"center", justifyContent:"center", background:t.bgTertiary, borderRadius:"28px 28px 0 0", fontSize:72 }}>{seEmoji(pet.type)}</div>)}
          <button onClick={onClose} style={{ position:"absolute", top:16, right:16, width:36, height:36, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:t.text }}>{pet.name}</div>
              <div style={{ fontSize:13, color:t.textSecondary }}>{pet.breed} · {pet.age} · {pet.size} · {pet.sex}</div>
            </div>
            <span style={{ padding:"5px 14px", borderRadius:14, background:t.accentSoft, color:t.accent, fontWeight:700, fontSize:12 }}>{pet.type}</span>
          </div>
          {pet.personality && <div style={{ fontSize:13, color:t.textSecondary, lineHeight:1.7, marginBottom:16 }}>{pet.personality}</div>}
          {pet.special_needs && <div style={{ padding:12, borderRadius:14, background:t.dangerSoft, border:`1px solid ${t.danger}30`, marginBottom:16 }}><div style={{ fontSize:11, fontWeight:700, color:t.danger, marginBottom:4 }}>⚕️ Special Needs</div><div style={{ fontSize:12, color:t.textSecondary, lineHeight:1.6 }}>{pet.special_needs}</div></div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[{label:"Energy",value:pet.energy,icon:"⚡"},{label:"Size",value:pet.size,icon:"📏"},
              pet.weight_lbs?{label:"Weight",value:`${pet.weight_lbs} lbs`,icon:"⚖️"}:null,
              pet.color&&pet.color!=="Unknown"?{label:"Color",value:pet.color,icon:"🎨"}:null,
              {label:"Shelter",value:pet.shelter,icon:"🏠"},
              pet.adoption_fee!=null?{label:"Fee",value:`$${pet.adoption_fee}`,icon:"💰"}:null,
            ].filter(Boolean).map(item=>(<div key={item.label} style={{ padding:12, borderRadius:14, background:t.bgCard, border:`1px solid ${t.border}` }}><div style={{ fontSize:10, color:t.textMuted, marginBottom:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>{item.icon} {item.label}</div><div style={{ fontSize:13, fontWeight:700, color:t.text }}>{item.value}</div></div>))}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
            {pet.neutered && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.violetSoft, color:t.violet, fontWeight:600 }}>✓ Neutered/Spayed</span>}
            {pet.house_trained===true && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.successSoft, color:t.success, fontWeight:600 }}>✓ House Trained</span>}
            {pet.good_with_dogs===true && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.pinkSoft, color:t.pink, fontWeight:600 }}>Good with dogs</span>}
            {pet.good_with_dogs===false && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.dangerSoft, color:t.danger, fontWeight:600 }}>Not good with dogs</span>}
            {pet.good_with_cats===true && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.pinkSoft, color:t.pink, fontWeight:600 }}>Good with cats</span>}
            {pet.good_with_cats===false && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.dangerSoft, color:t.danger, fontWeight:600 }}>Not good with cats</span>}
            {pet.good_with_children===true && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.pinkSoft, color:t.pink, fontWeight:600 }}>Good with children</span>}
            {pet.good_with_children===false && <span style={{ fontSize:11, padding:"4px 12px", borderRadius:10, background:t.dangerSoft, color:t.danger, fontWeight:600 }}>Not good with children</span>}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {pet.listing_url && pet.listing_url.startsWith("http") ? (
              <a href={pet.listing_url} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:14, borderRadius:16, border:"none", background:t.chatBubbleUser, color:t.chatBubbleUserText, fontWeight:800, fontSize:14, cursor:"pointer", textAlign:"center", textDecoration:"none", display:"block" }}>View Listing for {pet.name} 💕</a>
            ) : (<button style={{ flex:1, padding:14, borderRadius:16, border:"none", background:t.chatBubbleUser, color:t.chatBubbleUserText, fontWeight:800, fontSize:14, cursor:"pointer" }}>Inquire About {pet.name} 💕</button>)}
          </div>
        </div>
      </div>
    </div>
  );

  // === RENDER ===
  return (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, color:t.text, fontFamily:"'Outfit','Nunito',sans-serif", transition:"background 0.4s,color 0.4s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:${t.border}; border-radius:4px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        button { font-family:inherit; } button:hover { filter:brightness(1.05); }
        input:focus { border-color:${t.accent} !important; } img { display:block; }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"sticky", top:0, zIndex:100, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:t.navBg, backdropFilter:"blur(24px)", borderBottom:`1px solid ${t.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={()=>{setView("home");setMatches(null);setQuizStep(-1)}}>
          <span style={{ fontSize:22, animation:"float 3s ease-in-out infinite" }}>🐾</span>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:t.accent, letterSpacing:"-0.02em" }}>PawCommand</div>
            <div style={{ fontSize:8, color:t.textMuted, letterSpacing:"0.18em", textTransform:"uppercase" }}>{stats?`${stats.total_pets} pets · ${stats.total_shelters} shelters`:"Multi-Agent AI"}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div title={apiOnline?"Backend connected":apiOnline===false?"Backend offline":"Checking..."} style={{ width:8, height:8, borderRadius:"50%", background:apiOnline?t.success:apiOnline===false?t.danger:t.textMuted, marginRight:8 }} />
          {[{id:"home",icon:"💬",label:"Home"},{id:"adopt",icon:"💕",label:"Adopt"},{id:"chat",icon:"🤖",label:"Chat"}].map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{ padding:"7px 14px", borderRadius:14, border:"none", cursor:"pointer", background:view===n.id?t.accentSoft:"transparent", color:view===n.id?t.accent:t.textSecondary, fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5, transition:"all 0.25s" }}>
              <span style={{ fontSize:13 }}>{n.icon}</span>{n.label}
            </button>))}
          <button onClick={toggleTheme} style={{ width:38, height:38, borderRadius:12, border:`1.5px solid ${t.border}`, background:t.bgCard, cursor:"pointer", fontSize:16, marginLeft:6, display:"flex", alignItems:"center", justifyContent:"center" }}>{theme==="dark"?"☀️":"🌙"}</button>
        </div>
      </nav>

      {selectedPet && <PetModal pet={selectedPet} onClose={()=>setSelectedPet(null)} />}

      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 16px 80px" }}>

        {/* HOME */}
        {view==="home" && (
          <div style={{ animation:"fadeIn 0.5s ease" }}>
            <div style={{ padding:"48px 0 24px", textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:12, animation:"float 4s ease-in-out infinite" }}>🐾</div>
              <h1 style={{ fontSize:36, fontWeight:900, color:t.text, lineHeight:1.15, marginBottom:8, fontFamily:"'Playfair Display',serif", letterSpacing:"-0.02em" }}>Your AI Pet<br /><span style={{ background:`linear-gradient(135deg,${t.accent},${t.pink})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Companion Platform</span></h1>
              <p style={{ fontSize:15, color:t.textSecondary, maxWidth:440, margin:"0 auto 32px", lineHeight:1.6 }}>{stats?`${stats.total_pets} pets from ${stats.total_shelters} shelters — `:""}RAG-powered AI matching.</p>
            </div>
            <div style={{ marginBottom:32 }}><ChatBox height={520} showHeader={true} /></div>
            <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:36 }}>
              {Object.values(AGENTS).map((a,i)=>(<div key={a.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:20, background:t.bgCard, border:`1px solid ${t.border}`, animation:`fadeIn 0.4s ${i*0.06}s both` }}><span style={{fontSize:14}}>{a.icon}</span><span style={{fontSize:11,fontWeight:700,color:t.textSecondary}}>{a.name}</span><div style={{width:5,height:5,borderRadius:"50%",background:t.success}}/></div>))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:36 }}>
              {[{icon:"💕",title:"Find Your Match",desc:"AI-powered quiz",color:t.pink,tv:"adopt"},{icon:"🤖",title:"Talk to Agents",desc:"6 AI helpers",color:t.accent,tv:"chat"},{icon:"🐾",title:"Browse Pets",desc:`${totalPets} animals`,color:t.violet,tv:"adopt"}].map((c,i)=>(
                <button key={i} onClick={()=>setView(c.tv)} style={{ padding:20, borderRadius:20, border:`1.5px solid ${c.color}20`, background:t.bgSecondary, cursor:"pointer", textAlign:"left", animation:`slideUp 0.5s ${i*0.1}s both` }}>
                  <div style={{fontSize:28,marginBottom:10}}>{c.icon}</div><div style={{fontSize:14,fontWeight:800,color:t.text,marginBottom:4}}>{c.title}</div><div style={{fontSize:11,color:t.textMuted}}>{c.desc}</div>
                </button>))}
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:18, fontWeight:800, color:t.text }}>Featured Pets ✦</div>
                <button onClick={()=>setView("adopt")} style={{ fontSize:12, fontWeight:700, color:t.accent, background:"none", border:"none", cursor:"pointer" }}>View all →</button>
              </div>
              {loading ? (<div style={{textAlign:"center",padding:40}}><div style={{width:32,height:32,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/><div style={{fontSize:13,color:t.textMuted}}>Loading from database...</div></div>
              ) : allPets.length===0 ? (<div style={{textAlign:"center",padding:40,color:t.textMuted,fontSize:13}}>{apiOnline===false?"⚠️ Backend offline. Start the server.":"No pets in database yet."}</div>
              ) : (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>{allPets.slice(0,4).map((pet,i)=>(<div key={pet.id} style={{animation:`slideUp 0.5s ${i*0.08}s both`}}><PetCard pet={pet} onSelect={handleSelectPet}/></div>))}</div>)}
            </div>
          </div>
        )}

        {/* ADOPT */}
        {view==="adopt" && (
          <div style={{ animation:"fadeIn 0.5s ease", paddingTop:24 }}>
            {quizStep===-1 && !matches && !matchLoading && (
              <div style={{ textAlign:"center", padding:"40px 24px", borderRadius:28, marginBottom:32, background:`linear-gradient(135deg,${t.pinkSoft},${t.violetSoft})`, border:`1.5px solid ${t.pink}20`, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:-40, right:-40, width:120, height:120, borderRadius:"50%", background:`${t.pink}08` }}/>
                <div style={{ position:"absolute", bottom:-30, left:-30, width:100, height:100, borderRadius:"50%", background:`${t.violet}08` }}/>
                <div style={{ fontSize:52, marginBottom:12, position:"relative" }}>💕🐾✨</div>
                <h2 style={{ fontSize:26, fontWeight:900, color:t.text, marginBottom:8, fontFamily:"'Playfair Display',serif" }}>Find Your Perfect Match</h2>
                <p style={{ fontSize:14, color:t.textSecondary, maxWidth:400, margin:"0 auto 8px", lineHeight:1.6 }}>Answer {QUIZ_QUESTIONS.length} lifestyle questions and our AI will match you{totalPets>0?` from ${totalPets} pets.`:"."}</p>
                {apiOnline===false && <p style={{fontSize:12,color:t.danger,marginBottom:8}}>⚠️ Backend offline — matching requires the server.</p>}
                <button onClick={startQuiz} disabled={apiOnline===false} style={{ padding:"14px 40px", borderRadius:22, border:"none", cursor:apiOnline===false?"not-allowed":"pointer", background:apiOnline===false?t.bgCard:`linear-gradient(135deg,${t.pink},${t.violet})`, color:apiOnline===false?t.textMuted:"#fff", fontWeight:800, fontSize:15, boxShadow:apiOnline===false?"none":`0 6px 28px ${t.pink}30` }}>Start Matching Quiz ✦</button>
              </div>
            )}
            {quizStep>=0 && (
              <div style={{ maxWidth:560, margin:"0 auto 32px", animation:"scaleIn 0.3s ease" }}>
                <div style={{ padding:"32px 28px", borderRadius:28, background:t.bgSecondary, border:`1.5px solid ${t.border}`, boxShadow:t.shadow }}>
                  <div style={{ display:"flex", gap:4, marginBottom:24 }}>{QUIZ_QUESTIONS.map((_,i)=><div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=quizStep?t.accent:t.bgCard, transition:"background 0.3s" }}/>)}</div>
                  <div style={{ fontSize:11, color:t.textMuted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.1em" }}>Question {quizStep+1} of {QUIZ_QUESTIONS.length}</div>
                  <div style={{ fontSize:36, marginBottom:8 }}>{QUIZ_QUESTIONS[quizStep].icon}</div>
                  <div style={{ fontSize:19, fontWeight:800, color:t.text, marginBottom:20, lineHeight:1.35, fontFamily:"'Playfair Display',serif" }}>{QUIZ_QUESTIONS[quizStep].q}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {QUIZ_QUESTIONS[quizStep].opts.map(opt=>(<button key={opt.value} onClick={()=>answerQuiz(opt.value)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderRadius:16, border:`1.5px solid ${t.border}`, background:t.bgCard, color:t.text, fontSize:13.5, fontWeight:600, cursor:"pointer", textAlign:"left" }}><span style={{fontSize:20,width:32,textAlign:"center"}}>{opt.icon}</span><span>{opt.label}</span></button>))}
                  </div>
                  {quizStep>0 && <button onClick={()=>setQuizStep(quizStep-1)} style={{ marginTop:14, padding:"8px 16px", borderRadius:12, border:`1px solid ${t.border}`, background:"transparent", color:t.textSecondary, fontSize:12, fontWeight:600, cursor:"pointer" }}>← Back</button>}
                </div>
              </div>
            )}
            {matchLoading && (<div style={{ textAlign:"center", padding:60 }}><div style={{width:48,height:48,border:`4px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 20px"}}/><h3 style={{fontSize:20,fontWeight:800,color:t.text,marginBottom:8,fontFamily:"'Playfair Display',serif"}}>Finding Your Perfect Match...</h3><p style={{fontSize:13,color:t.textSecondary}}>AI analyzing {totalPets} pets with vector similarity + LLM reasoning.</p></div>)}
            {matches && !matchLoading && (
              <div style={{ marginBottom:36, animation:"fadeIn 0.5s ease" }}>
                <div style={{ textAlign:"center", marginBottom:24 }}>
                  <div style={{ fontSize:42, marginBottom:8 }}>🎉</div>
                  <h2 style={{ fontSize:24, fontWeight:900, color:t.text, marginBottom:4, fontFamily:"'Playfair Display',serif" }}>{matches.length>0?"Your Top Matches!":"No Matches Found"}</h2>
                  <p style={{ fontSize:13, color:t.textSecondary }}>{matches.length>0?`RAG-powered analysis of your ${QUIZ_QUESTIONS.length}-question assessment`:"Try broadening your preferences."}</p>
                  {matchReasoning && (<div style={{ marginTop:12, padding:"12px 20px", borderRadius:16, background:t.accentSoft, border:`1px solid ${t.accent}30`, maxWidth:560, margin:"12px auto 0", textAlign:"left" }}><div style={{fontSize:11,fontWeight:700,color:t.accent,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>🧠 AI Reasoning</div><div style={{fontSize:12,color:t.textSecondary,lineHeight:1.6}}>{matchReasoning}</div></div>)}
                </div>
                {matches.length>0 && (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16, marginBottom:16 }}>{matches.slice(0,6).map((pet,i)=>(<div key={pet.id||i} style={{animation:`slideUp 0.5s ${i*0.1}s both`}}><PetCard pet={pet} score={pet.score} rank={i} explanation={pet.explanation} onSelect={handleSelectPet}/></div>))}</div>)}
                <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                  <button onClick={startQuiz} style={{ padding:"10px 24px", borderRadius:16, border:`1.5px solid ${t.border}`, background:"transparent", color:t.textSecondary, fontSize:12, fontWeight:700, cursor:"pointer" }}>Retake Quiz 🔄</button>
                  <button onClick={()=>{setMatches(null);setMatchReasoning(null)}} style={{ padding:"10px 24px", borderRadius:16, border:"none", background:t.accentSoft, color:t.accent, fontSize:12, fontWeight:700, cursor:"pointer" }}>Browse All Pets</button>
                </div>
              </div>
            )}
            {!matches && quizStep===-1 && !matchLoading && (<>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <h2 style={{ fontSize:22, fontWeight:900, color:t.text, fontFamily:"'Playfair Display',serif" }}>All Pets Available ✦</h2>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{speciesFilters.map(f=>(<button key={f} onClick={()=>setPetFilter(f)} style={{ padding:"6px 16px", borderRadius:18, border:"none", cursor:"pointer", background:petFilter===f?t.accent:t.bgCard, color:petFilter===f?(theme==="dark"?"#000":"#fff"):t.textSecondary, fontSize:12, fontWeight:700 }}>{f==="All"?"All Pets":f==="Small Animal"?"Small Animals":f+"s"}</button>))}</div>
              </div>
              {loading ? (<div style={{textAlign:"center",padding:40}}><div style={{width:32,height:32,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/><div style={{fontSize:13,color:t.textMuted}}>Loading pets...</div></div>
              ) : filteredPets.length===0 ? (<div style={{textAlign:"center",padding:60,color:t.textMuted}}><div style={{fontSize:48,marginBottom:12}}>🐾</div><div style={{fontSize:15,fontWeight:600}}>{apiOnline===false?"Backend offline":"No pets found"}</div><div style={{fontSize:12,marginTop:8}}>{apiOnline===false?"Start the FastAPI server.":"Run: python scripts/load_json.py data/CMHS_animals.json --embed"}</div></div>
              ) : (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>{filteredPets.map((pet,i)=>(<div key={pet.id} style={{animation:`slideUp 0.4s ${i*0.06}s both`}}><PetCard pet={pet} onSelect={handleSelectPet}/></div>))}</div>)}
            </>)}
          </div>
        )}

        {/* CHAT */}
        {view==="chat" && (
          <div style={{ paddingTop:24, animation:"fadeIn 0.5s ease" }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:22, fontWeight:900, color:t.text, fontFamily:"'Playfair Display',serif" }}>AI Agent Chat ✦</h2>
              <p style={{ fontSize:12, color:t.textSecondary }}>Messages auto-route to the right specialist agent</p>
            </div>
            <ChatBox height={600} showHeader={true} />
          </div>
        )}
      </div>
    </div>
  );
}