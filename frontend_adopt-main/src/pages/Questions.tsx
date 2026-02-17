import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stethoscope, ClipboardCheck, GraduationCap, MessageCircle,
  Send, Loader2, Trash2, Sparkles, ChevronRight, Bot,
  User, AlertCircle, PawPrint, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const API_BASE = 'http://localhost:8000';
import vetData from '../../../vet_locations.json'; // Import your JSON
import { VetMap } from '../components/VetMap/VetMap';

// Add a helper to detect emergency keywords
const EMERGENCY_KEYWORDS = ['emergency', 'urgent', 'toxic', 'poison', 'seizure', 'bleeding', 'clinic', 'hospital'];
// ── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  type: string;
  name: string;
  icon: string;
  description: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: { type: string; name: string; icon: string };
  timestamp: Date;
}

// ── Icon Map ─────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, React.ReactNode> = {
  stethoscope: <Stethoscope className="w-5 h-5" />,
  'clipboard-check': <ClipboardCheck className="w-5 h-5" />,
  'graduation-cap': <GraduationCap className="w-5 h-5" />,
  'message-circle': <MessageCircle className="w-5 h-5" />,
};

const AGENT_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  vet: { bg: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-700', light: 'bg-rose-50' },
  adoption: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-700', light: 'bg-amber-50' },
  training: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
  general: { bg: 'bg-sage-500', border: 'border-sage-500', text: 'text-sage-700', light: 'bg-sage-50' },
};

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  vet: [
    "My dog has been scratching a lot lately, what could it be?",
    "What vaccinations does a new puppy need?",
    "How often should I take my cat for a checkup?",
    "My pet isn't eating — when should I be worried?",
  ],
  adoption: [
    "What supplies do I need before bringing a dog home?",
    "How do I introduce a new cat to my resident cat?",
    "What should I ask the shelter before adopting?",
    "How much does it really cost to own a dog per year?",
  ],
  training: [
    "How do I crate train a puppy?",
    "My dog pulls on the leash — how can I fix this?",
    "What's the best way to stop a cat from scratching furniture?",
    "How do I teach my dog to come when called?",
  ],
  general: [
    "What are the best dog breeds for apartment living?",
    "How do I travel with my cat on a plane?",
    "What human foods are toxic to dogs?",
    "How do I keep my pet cool in the summer?",
  ],
};

// ── Component ────────────────────────────────────────────────────────────────

export function Questions() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const [petContext, setPetContext] = useState('');
  const [showContextInput, setShowContextInput] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords([pos.coords.latitude, pos.coords.longitude]),
      () => setUserCoords([38.9517, -92.3341]) // Fallback to Columbia, MO
    );
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch available agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const resp = await fetch(`${API_BASE}/ask/agents`);
        if (!resp.ok) throw new Error('Failed to fetch agents');
        const data = await resp.json();
        setAgents(data.agents);
        setAgentsLoaded(true);
      } catch (err) {
        console.error('Could not load agents:', err);
        // Fallback to hardcoded list
        setAgents([
          { type: 'vet', name: 'Dr. Paws — Veterinary Advisor', icon: 'stethoscope', description: 'Ask about pet health, symptoms, nutrition, vaccinations, and when to see a vet.' },
          { type: 'adoption', name: 'Adoption Guide — Readiness Checklist', icon: 'clipboard-check', description: 'Get help preparing for adoption: checklists, supplies, home prep, and what to expect.' },
          { type: 'training', name: 'Coach Rex — Pet Training Tips', icon: 'graduation-cap', description: 'Get advice on obedience, behavior issues, socialization, and positive reinforcement techniques.' },
          { type: 'general', name: 'Pet Pal — General Questions', icon: 'message-circle', description: 'Ask anything about pet ownership, daily care, fun facts, and general advice.' },
        ]);
        setAgentsLoaded(true);
      }
    };
    fetchAgents();
  }, []);

  // Send message
  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          agent: selectedAgent,
          session_id: sessionId,
          pet_context: petContext || null,
        }),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const data = await resp.json();

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: data.answer,
        agent: data.agent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.error) {
        setError(data.error === 'ollama_connection_failed'
          ? 'Ollama is not running. Start it with: ollama serve'
          : data.error === 'timeout'
            ? 'Response timed out. Try a simpler question.'
            : null
        );
      }
    } catch (err) {
      console.error('Ask error:', err);
      setError('Could not reach the backend. Is the API server running?');
      const errorMessage: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: 'Sorry, I could not connect to the backend. Please make sure the API server is running on port 8000.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Clear chat
  const handleClear = async () => {
    setMessages([]);
    setError(null);
    try {
      await fetch(`${API_BASE}/ask/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      // Silently fail — just clearing local state is fine
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentAgent = agents.find(a => a.type === selectedAgent);
  const colors = AGENT_COLORS[selectedAgent] || AGENT_COLORS.general;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-sage-500 border-2 border-black rounded-lg flex items-center justify-center">
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Pet Questions</h1>
        </div>
        <p className="text-gray-600 ml-13">
          Choose a specialist and ask anything about your pets — powered by your local AI.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Agent Selector Sidebar ──────────────────────────────── */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Choose a Specialist
          </h2>

          {agents.map((agent) => {
            const agentColors = AGENT_COLORS[agent.type] || AGENT_COLORS.general;
            const isActive = selectedAgent === agent.type;
            return (
              <motion.button
                key={agent.type}
                onClick={() => setSelectedAgent(agent.type)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full text-left p-4 rounded-xl border-3 transition-all
                  ${isActive
                    ? `${agentColors.light} ${agentColors.border} border-black shadow-neo-sm`
                    : 'bg-white border-gray-200 hover:border-gray-400'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive ? `${agentColors.bg} text-white` : 'bg-gray-100 text-gray-500'}
                  `}>
                    {AGENT_ICONS[agent.icon] || <Bot className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm leading-tight ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                      {agent.name.split(' — ')[0]}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {/* Pet Context */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            <button
              onClick={() => setShowContextInput(!showContextInput)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Info className="w-4 h-4" />
              <span>Add pet context</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showContextInput ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {showContextInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={petContext}
                    onChange={(e) => setPetContext(e.target.value)}
                    placeholder="e.g. I have a 3-year-old Golden Retriever named Buddy who weighs 70 lbs..."
                    className="mt-2 w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-sage-500 focus:ring-0 resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    This helps the AI give more personalized answers.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Chat Area ──────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col bg-white border-3 border-black rounded-xl shadow-neo overflow-hidden" style={{ minHeight: '600px' }}>
          {/* Chat Header */}
          <div className={`px-5 py-4 border-b-3 border-black flex items-center justify-between ${colors.light}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${colors.bg} text-white rounded-lg border-2 border-black flex items-center justify-center`}>
                {currentAgent && AGENT_ICONS[currentAgent.icon]}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{currentAgent?.name || 'Loading...'}</h3>
                <p className="text-xs text-gray-500">Powered by Ollama • Local AI</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border-2 border-gray-300 rounded-lg hover:border-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className={`w-16 h-16 ${colors.bg} text-white rounded-2xl border-3 border-black flex items-center justify-center mb-4 shadow-neo-sm`}>
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 mb-2">
                  Ask {currentAgent?.name.split(' — ')[0] || 'an Agent'}
                </h3>
                <p className="text-gray-500 max-w-md mb-6">
                  {currentAgent?.description || 'Select an agent to get started.'}
                </p>

                {/* Suggested Questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {(SUGGESTED_QUESTIONS[selectedAgent] || []).map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleSend(q)}
                      className="text-left px-4 py-3 text-sm text-gray-700 bg-gray-50 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-100 transition-all group"
                    >
                      <span className="line-clamp-2">{q}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 inline ml-1 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className={`
                      w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border-2 border-black
                      ${msg.agent ? AGENT_COLORS[msg.agent.type]?.bg || 'bg-gray-500' : 'bg-gray-500'} text-white
                    `}>
                      {msg.agent ? (AGENT_ICONS[msg.agent.icon] || <Bot className="w-4 h-4" />) : <Bot className="w-4 h-4" />}
                    </div>
                  )}
                  <div className={`
                    max-w-[75%] px-4 py-3 rounded-xl border-2
                    ${msg.role === 'user'
                      ? 'bg-sage-500 text-white border-black rounded-br-sm'
                      : 'bg-gray-50 text-gray-800 border-gray-200 rounded-bl-sm'
                    }
                  `}>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown 
                        components={{
                          // This ensures your bold text and lists look correct in Tailwind
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({children}) => <strong className="font-bold text-gray-900">{children}</strong>,
                          ul: ({children}) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                          li: ({children}) => <li className="mb-1">{children}</li>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {/* ... existing ReactMarkdown code ... */}

                    {msg.role === 'assistant' && 
                    selectedAgent === 'vet' && 
                    EMERGENCY_KEYWORDS.some(k => msg.content.toLowerCase().includes(k)) && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2 text-rose-600 font-bold text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span>Found nearby emergency clinics:</span>
                        </div>
                        <VetMap 
                          clinics={vetData.filter(v => v.is_24hr)} // Only show 24hr clinics for emergencies
                          userLocation={userCoords || [38.9517, -92.3341]} 
                        />
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {vetData.slice(0, 2).map((vet, i) => (
                            <a 
                              key={i}
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name + ' ' + vet.address)}`}
                              target="_blank"
                              className="text-xs p-2 bg-white border-2 border-gray-200 rounded-lg hover:border-black transition-all flex justify-between items-center"
                            >
                              <span>{vet.name}</span>
                              <ChevronRight className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-sage-200' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gray-800 text-white border-2 border-black">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))
            )}

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border-2 border-black ${colors.bg} text-white`}>
                  {currentAgent && AGENT_ICONS[currentAgent.icon]}
                </div>
                <div className="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl rounded-bl-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{currentAgent?.name.split(' — ')[0]} is thinking…</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-5 py-2 bg-red-50 border-t-2 border-red-200 flex items-center gap-2 text-sm text-red-700"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="px-5 py-4 border-t-3 border-black bg-gray-50">
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${currentAgent?.name.split(' — ')[0] || 'your question'}...`}
                rows={1}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-sage-500 focus:ring-0 resize-none text-sm placeholder:text-gray-400"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '44px';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`
                  px-4 py-3 rounded-xl border-2 border-black font-medium text-white
                  transition-all flex items-center gap-2
                  ${!input.trim() || isLoading
                    ? 'bg-gray-300 cursor-not-allowed border-gray-400'
                    : `${colors.bg} hover:opacity-90 shadow-neo-sm hover:shadow-none active:translate-y-0.5`
                  }
                `}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Responses are AI-generated using your local Ollama. Not a substitute for professional advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
