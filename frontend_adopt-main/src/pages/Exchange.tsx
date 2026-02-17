import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gift, Package, Heart, MessageCircle, Users, Send, Sparkles, Loader2,
  MapPin, X, ChevronDown, ChevronUp, Search, Filter, Clock, Eye, EyeOff,
  AlertCircle, Navigation, Camera, Phone, Globe, Dog, Cat, Plus, Minus,
  Tag, Calendar, ShoppingBag, HelpCircle, CheckCircle, ArrowRight,
  Zap, MessageSquare, RefreshCw, Layers, CornerDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedExchangePost {
  title: string;
  brand: string | null;
  category: 'Pet Food' | 'Supplies & Gear' | 'Medical Items' | 'Toys & Accessories' | 'Other';
  quantity: string | null;
  condition: string | null;
  expiration: string | null;
  description: string;
  petType: string | null;
  estimatedValue: string | null;
}

interface AIQuestion {
  field: string;
  question: string;
  options?: string[];
}

interface ExchangePost {
  id: string;
  type: 'offer' | 'request';
  parsed: ParsedExchangePost;
  rawInput: string;
  user: string;
  badge: string;
  location: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: 'active' | 'claimed' | 'fulfilled';
  photoDataUrl: string | null;
}

interface LostPetReport {
  id: string;
  petName: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  color: string;
  description: string;
  lastSeenAddress: string;
  latitude: number;
  longitude: number;
  contactInfo: string;
  photoDataUrl: string | null;
  timestamp: string;
  status: 'lost' | 'found';
}

interface ShelterMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  website_url?: string;
  location?: string;
  pet_count: number;
}

type MapLayer = 'all' | 'exchange' | 'lostPets' | 'shelters';
type SidebarView = 'list' | 'newPost' | 'lostPetForm';

// ── Leaflet loader ───────────────────────────────────────────────────────────

let leafletLoaded = false;
let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.crossOrigin = '';
      document.head.appendChild(css);
    }
    if ((window as any).L) {
      leafletLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.onload = () => { leafletLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

// ── Custom marker icons ──────────────────────────────────────────────────────

function createSvgIcon(color: string, innerSvg: string, size: [number, number] = [32, 42]) {
  const L = (window as any).L;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#000" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="10" fill="white" opacity="0.9"/>
    ${innerSvg}
  </svg>`;
  const base64Svg = btoa(unescape(encodeURIComponent(svg)));
  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + base64Svg,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1] + 5],
  });
}

function getOfferIcon() {
  return createSvgIcon('#d46a4e',
    `<text x="16" y="20" text-anchor="middle" font-size="14" font-weight="bold">🎁</text>`
  );
}

function getRequestIcon() {
  return createSvgIcon('#6b8fdb',
    `<text x="16" y="20" text-anchor="middle" font-size="14" font-weight="bold">🙏</text>`
  );
}

function getShelterIcon() {
  return createSvgIcon('#5d8560',
    `<text x="16" y="20" text-anchor="middle" font-size="14" font-weight="bold">🏠</text>`
  );
}

function getLostPetIcon(species: string) {
  const emoji = species === 'dog' ? '🐕' : species === 'cat' ? '🐈' : '❓';
  return createSvgIcon('#dc2626',
    `<text x="16" y="20" text-anchor="middle" font-size="14">${emoji}</text>`
  );
}

function getPlacingIcon() {
  return createSvgIcon('#f59e0b',
    `<text x="16" y="20" text-anchor="middle" font-size="14">📍</text>`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Pet Food': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  'Supplies & Gear': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  'Medical Items': { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  'Toys & Accessories': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  'Other': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

// ── NLP Post Composer ────────────────────────────────────────────────────────

interface NLPComposerProps {
  onPostCreated: (post: Omit<ExchangePost, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
  placedCoords: { lat: number; lng: number } | null;
  onStartPlacing: () => void;
  isPlacing: boolean;
}

function NLPComposer({ onPostCreated, onCancel, placedCoords, onStartPlacing, isPlacing }: NLPComposerProps) {
  const [postType, setPostType] = useState<'offer' | 'request'>('offer');
  const [naturalInput, setNaturalInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedExchangePost | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [step, setStep] = useState<'input' | 'review' | 'questions'>('input');
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize textarea automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [naturalInput]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── NLP Parse with Claude ──────────────────────────────────────────
  const handleParse = async () => {
    if (!naturalInput.trim()) return;
    setIsParsing(true);
    setParseError('');

    try {
      const systemPrompt = `You are an AI that parses natural language descriptions of pet items being offered or requested for a community exchange platform. 

Given a user's natural description, extract structured data AND identify what information is missing.

RESPOND ONLY in this exact JSON format (no markdown, no backticks):
{
  "parsed": {
    "title": "A clean, concise title for the listing (max 60 chars)",
    "brand": "Brand name if mentioned, or null",
    "category": "One of: Pet Food, Supplies & Gear, Medical Items, Toys & Accessories, Other",
    "quantity": "Quantity/amount if mentioned (e.g. '20lb bag', '3 cans'), or null",
    "condition": "Condition if mentioned (e.g. 'unopened', 'gently used', 'like new'), or null",
    "expiration": "Expiration date if mentioned (ISO format or descriptive), or null",
    "description": "A clean, helpful description based on what the user said. Expand slightly for clarity. 2-3 sentences max.",
    "petType": "Type of pet this is for if mentioned (e.g. 'dog', 'cat', 'puppy'), or null",
    "estimatedValue": "Estimated retail value if determinable, or null"
  },
  "questions": [
    {
      "field": "the field name this fills",
      "question": "A natural, friendly question to ask the user",
      "options": ["option1", "option2", "option3"]
    }
  ]
}

Rules for questions:
- Only ask about IMPORTANT missing fields (brand, condition, quantity, expiration, petType)
- Ask at most 3 questions
- Make questions conversational and friendly
- Include helpful options when possible
- Don't ask about things the user clearly implied
- If the post is very complete, return an empty questions array`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `I want to ${postType === 'offer' ? 'offer' : 'request'} the following:\n\n"${naturalInput.trim()}"`
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map((b: any) => b.text || '').join('') || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      setParsed(result.parsed);

      if (result.questions && result.questions.length > 0) {
        setAiQuestions(result.questions);
        setStep('questions');
      } else {
        setStep('review');
      }
    } catch (err) {
      console.error('Parse failed:', err);
      setParseError('Failed to parse your description. Please try again or be more specific.');
    } finally {
      setIsParsing(false);
    }
  };

  // ── Refine parsed data with answered questions ─────────────────────
  const handleRefine = async () => {
    if (!parsed) return;
    setIsRefining(true);

    try {
      const answersText = aiQuestions
        .map(q => `Q: ${q.question}\nA: ${questionAnswers[q.field] || 'Not provided'}`)
        .join('\n\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You refine a parsed exchange post with additional answers from the user. Return ONLY the updated parsed object in JSON (no markdown, no backticks, no wrapper). Keep the same field structure as provided.`,
          messages: [{
            role: 'user',
            content: `Original input: "${naturalInput}"\n\nCurrent parsed data:\n${JSON.stringify(parsed, null, 2)}\n\nUser's answers to follow-up questions:\n${answersText}\n\nReturn the refined parsed object with the new information incorporated.`
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map((b: any) => b.text || '').join('') || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const refined = JSON.parse(clean);
      setParsed(refined);
      setStep('review');
    } catch (err) {
      console.error('Refine failed:', err);
      setStep('review');
    } finally {
      setIsRefining(false);
    }
  };

  // ── Submit final post ──────────────────────────────────────────────
  const handleSubmit = () => {
    if (!parsed || !placedCoords) return;

    onPostCreated({
      type: postType,
      parsed,
      rawInput: naturalInput,
      user: 'You',
      badge: 'New Member',
      location: locationName || 'Your Area',
      latitude: placedCoords.lat,
      longitude: placedCoords.lng,
      status: 'active',
      photoDataUrl,
    });
  };

  // ── Render: Input Step ─────────────────────────────────────────────
  const renderInputStep = () => (
    <div className="space-y-4">
      {/* Post type toggle */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setPostType('offer')}
          className={`flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm transition-all flex items-center justify-center gap-2
            ${postType === 'offer' ? 'bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-terracotta-50'}`}>
          <Gift className="w-4 h-4" />
          I'm Offering
        </button>
        <button type="button" onClick={() => setPostType('request')}
          className={`flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm transition-all flex items-center justify-center gap-2
            ${postType === 'request' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-blue-50'}`}>
          <HelpCircle className="w-4 h-4" />
          I Need Help
        </button>
      </div>

      {/* NLP Text input */}
      <div className="relative">
        <div className="absolute top-3 left-3">
          <Sparkles className="w-5 h-5 text-terracotta-400" />
        </div>
        <textarea
          ref={textareaRef}
          value={naturalInput}
          onChange={e => setNaturalInput(e.target.value)}
          placeholder={postType === 'offer'
            ? "Describe what you'd like to offer...\n\ne.g. \"I have half a bag of Blue Buffalo puppy food left over, about 10lbs, expires next year. Unopened flea collar too.\""
            : "Describe what you need...\n\ne.g. \"Looking for a medium dog crate for a few weeks while mine is being repaired. Can pick up anywhere downtown.\""
          }
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-terracotta-400 focus:ring-0 outline-none resize-none min-h-[120px] leading-relaxed"
          rows={4}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Zap className="w-3 h-3 text-amber-500" />
        <span>AI will automatically extract brand, category, quantity, expiration & more</span>
      </div>

      {/* Photo upload */}
      <div className="flex items-center gap-3">
        {photoDataUrl ? (
          <div className="relative w-16 h-16 rounded-lg border-2 border-black overflow-hidden shadow-neo-sm">
            <img src={photoDataUrl} alt="Item" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setPhotoDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-terracotta-400 hover:text-terracotta-500 transition-colors">
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">Photo</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <div className="text-xs text-gray-400">Optional photo helps your listing stand out</div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pickup / Meetup Location</label>
        <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
          placeholder="Neighborhood or area name"
          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none mb-2" />
        <button type="button" onClick={onStartPlacing}
          className={`w-full py-2.5 rounded-lg border-2 border-black font-bold text-xs transition-all flex items-center justify-center gap-2
            ${isPlacing
              ? 'bg-yellow-400 text-black animate-pulse shadow-neo-sm'
              : placedCoords
                ? 'bg-sage-100 text-sage-800 border-sage-500'
                : 'bg-terracotta-50 text-terracotta-700 hover:bg-terracotta-100 border-terracotta-400'
            }`}>
          <MapPin className="w-3.5 h-3.5" />
          {isPlacing ? 'Click map to place pin...' : placedCoords ? `📍 Pin placed (${placedCoords.lat.toFixed(4)}, ${placedCoords.lng.toFixed(4)})` : 'Place pin on map'}
        </button>
      </div>

      {parseError && (
        <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg text-xs text-red-700 font-medium">
          {parseError}
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={!naturalInput.trim() || isParsing || !placedCoords}
        className="w-full py-3 rounded-xl border-2 border-black font-bold text-sm bg-gradient-to-r from-terracotta-500 via-terracotta-600 to-sage-600 text-white shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isParsing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            AI is parsing your post...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Parse & Create Listing
          </>
        )}
      </button>
    </div>
  );

  // ── Render: AI Questions Step ──────────────────────────────────────
  const renderQuestionsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
        <MessageSquare className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-900">Quick questions</p>
          <p className="text-xs text-amber-700">Help us complete your listing with a few details</p>
        </div>
      </div>

      {aiQuestions.map((q, i) => (
        <motion.div
          key={q.field}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="space-y-2"
        >
          <label className="block text-sm font-semibold text-gray-700">
            <CornerDownRight className="w-3 h-3 inline mr-1 text-terracotta-400" />
            {q.question}
          </label>
          {q.options && q.options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setQuestionAnswers(prev => ({ ...prev, [q.field]: opt }))}
                  className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all
                    ${questionAnswers[q.field] === opt
                      ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {opt}
                </button>
              ))}
              <input
                type="text"
                placeholder="Other..."
                value={q.options.includes(questionAnswers[q.field] || '') ? '' : questionAnswers[q.field] || ''}
                onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.field]: e.target.value }))}
                className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none w-24"
              />
            </div>
          ) : (
            <input
              type="text"
              value={questionAnswers[q.field] || ''}
              onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.field]: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none"
            />
          )}
        </motion.div>
      ))}

      <div className="flex gap-2 pt-2">
        <button onClick={() => setStep('input')}
          className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-white text-gray-700 hover:bg-gray-50 transition-all">
          Back
        </button>
        <button onClick={() => { setStep('review'); }} 
          className="px-4 py-2.5 rounded-lg border-2 border-gray-300 font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all">
          Skip
        </button>
        <button onClick={handleRefine} disabled={isRefining}
          className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {isRefining ? 'Refining...' : 'Continue'}
        </button>
      </div>
    </div>
  );

  // ── Render: Review Step ────────────────────────────────────────────
  const renderReviewStep = () => {
    if (!parsed) return null;
    const catColor = CATEGORY_COLORS[parsed.category] || CATEGORY_COLORS['Other'];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-sage-50 border-2 border-sage-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-sage-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-sage-900">AI-parsed listing preview</p>
            <p className="text-xs text-sage-700">Review and edit before posting</p>
          </div>
        </div>

        {/* Parsed card preview */}
        <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-neo-sm">
          {photoDataUrl && (
            <img src={photoDataUrl} alt="Item" className="w-full h-32 object-cover border-b-2 border-black" />
          )}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${postType === 'offer' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                {postType === 'offer' ? '🎁 OFFERING' : '🙏 REQUESTING'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                {parsed.category}
              </span>
            </div>

            <div>
              <h3 className="font-bold text-base text-gray-900 leading-tight">{parsed.title}</h3>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{parsed.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {parsed.brand && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Tag className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">{parsed.brand}</span>
                </div>
              )}
              {parsed.quantity && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Package className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">{parsed.quantity}</span>
                </div>
              )}
              {parsed.expiration && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Calendar className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">{parsed.expiration}</span>
                </div>
              )}
              {parsed.condition && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">{parsed.condition}</span>
                </div>
              )}
              {parsed.petType && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Heart className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">For {parsed.petType}</span>
                </div>
              )}
              {parsed.estimatedValue && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <ShoppingBag className="w-3 h-3 text-terracotta-400" />
                  <span className="font-semibold">~{parsed.estimatedValue}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1 border-t border-gray-100">
              <MapPin className="w-3 h-3" />
              <span>{locationName || 'Your Area'}</span>
            </div>
          </div>
        </div>

        {/* Original input collapsed */}
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-600 font-medium">
            View original input
          </summary>
          <p className="mt-1 p-2 bg-gray-50 rounded-lg text-gray-500 italic">"{naturalInput}"</p>
        </details>

        <div className="flex gap-2">
          <button onClick={() => { setStep('input'); setParsed(null); setAiQuestions([]); }}
            className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-white text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Start Over
          </button>
          <button onClick={handleSubmit} disabled={!placedCoords}
            className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <Send className="w-3.5 h-3.5" />
            Post Listing
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white border-3 border-black rounded-xl shadow-neo-sm overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-terracotta-500 via-terracotta-600 to-sage-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-display font-bold text-lg">
            {step === 'input' ? 'AI-Powered Listing' : step === 'questions' ? 'A Few Details' : 'Review Listing'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {['input', 'questions', 'review'].map((s, i) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-white scale-125' :
                ['input', 'questions', 'review'].indexOf(step) > i ? 'bg-white/60' : 'bg-white/30'
              }`} />
            ))}
          </div>
          <button type="button" onClick={onCancel} className="text-white/80 hover:text-white ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-5 max-h-[60vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'input' && <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderInputStep()}</motion.div>}
          {step === 'questions' && <motion.div key="questions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderQuestionsStep()}</motion.div>}
          {step === 'review' && <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderReviewStep()}</motion.div>}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Exchange Post Card ───────────────────────────────────────────────────────

function ExchangePostCard({ post, onLocate }: { post: ExchangePost; onLocate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(post.timestamp);
  const catColor = CATEGORY_COLORS[post.parsed.category] || CATEGORY_COLORS['Other'];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`border-2 rounded-xl overflow-hidden transition-all hover:shadow-md ${
        post.type === 'offer' ? 'border-terracotta-200 bg-terracotta-50/30' : 'border-blue-200 bg-blue-50/30'
      }`}
    >
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {post.photoDataUrl ? (
          <img src={post.photoDataUrl} alt={post.parsed.title}
            className="w-14 h-14 rounded-lg object-cover border-2 border-black shadow-sm flex-shrink-0" />
        ) : (
          <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center flex-shrink-0 text-xl
            ${post.type === 'offer' ? 'bg-terracotta-100 border-terracotta-300' : 'bg-blue-100 border-blue-300'}`}>
            {post.type === 'offer' ? '🎁' : '🙏'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              post.type === 'offer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {post.type === 'offer' ? 'OFFER' : 'REQUEST'}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>
              {post.parsed.category}
            </span>
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{timeAgo}
            </span>
          </div>
          <h4 className="font-bold text-sm text-gray-900 truncate leading-tight">{post.parsed.title}</h4>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {post.parsed.brand && `${post.parsed.brand} · `}
            {post.parsed.quantity || post.location}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              <p className="text-xs text-gray-700 leading-relaxed">{post.parsed.description}</p>

              <div className="flex flex-wrap gap-1.5">
                {post.parsed.brand && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> {post.parsed.brand}
                  </span>
                )}
                {post.parsed.quantity && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <Package className="w-2.5 h-2.5" /> {post.parsed.quantity}
                  </span>
                )}
                {post.parsed.expiration && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" /> Exp: {post.parsed.expiration}
                  </span>
                )}
                {post.parsed.condition && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> {post.parsed.condition}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" /> {post.location}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); onLocate(); }}
                    className="py-1 px-2.5 rounded-md border-2 border-black bg-white text-[10px] font-bold hover:bg-gray-50 transition-all flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5" /> Map
                  </button>
                  <button onClick={(e) => e.stopPropagation()}
                    className={`py-1 px-2.5 rounded-md border-2 border-black text-[10px] font-bold transition-all flex items-center gap-1
                      ${post.type === 'offer'
                        ? 'bg-terracotta-500 text-white hover:bg-terracotta-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}>
                    <MessageCircle className="w-2.5 h-2.5" />
                    {post.type === 'offer' ? 'Interested' : 'I Can Help'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Lost Pet Card (imported from Community) ──────────────────────────────────

function LostPetCard({ report, onLocate }: { report: LostPetReport; onLocate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(report.timestamp);

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      className={`border-2 rounded-xl overflow-hidden transition-all ${report.status === 'lost' ? 'border-red-300 bg-red-50/50' : 'border-sage-300 bg-sage-50/50'}`}>
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {report.photoDataUrl ? (
          <img src={report.photoDataUrl} alt={report.petName}
            className="w-14 h-14 rounded-lg object-cover border-2 border-black shadow-sm flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gray-200 border-2 border-gray-300 flex items-center justify-center flex-shrink-0 text-2xl">
            {report.species === 'dog' ? '🐕' : report.species === 'cat' ? '🐈' : '🐾'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${report.status === 'lost' ? 'bg-red-200 text-red-800' : 'bg-sage-200 text-sage-800'}`}>
              {report.status.toUpperCase()}
            </span>
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeAgo}</span>
          </div>
          <h4 className="font-bold text-sm text-gray-900 truncate">{report.petName}</h4>
          <p className="text-xs text-gray-500 truncate">{report.breed || report.species} · {report.color || 'Unknown color'}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              {report.description && <p className="text-xs text-gray-700 leading-relaxed">{report.description}</p>}
              {report.lastSeenAddress && (
                <p className="text-xs text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> {report.lastSeenAddress}</p>
              )}
              {report.contactInfo && (
                <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {report.contactInfo}</p>
              )}
              <button onClick={(e) => { e.stopPropagation(); onLocate(); }}
                className="w-full py-1.5 rounded-md border-2 border-black bg-white text-xs font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3" /> Show on Map
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Lost Pet Form (simplified) ───────────────────────────────────────────────

interface LostPetFormProps {
  onSubmit: (report: Omit<LostPetReport, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
  placedCoords: { lat: number; lng: number } | null;
  onStartPlacing: () => void;
  isPlacing: boolean;
}

function LostPetForm({ onSubmit, onCancel, placedCoords, onStartPlacing, isPlacing }: LostPetFormProps) {
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat' | 'other'>('dog');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'lost' | 'found'>('lost');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim() || !placedCoords) return;
    onSubmit({
      petName: petName.trim(), species, breed: breed.trim(), color: color.trim(),
      description: description.trim(), lastSeenAddress: lastSeenAddress.trim(),
      latitude: placedCoords.lat, longitude: placedCoords.lng,
      contactInfo: contactInfo.trim(), photoDataUrl, status,
    });
  };

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      onSubmit={handleSubmit} className="bg-white border-3 border-black rounded-xl shadow-neo-sm overflow-hidden">
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-display font-bold text-lg">Report Lost/Found Pet</h3>
        </div>
        <button type="button" onClick={onCancel} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
        {/* Status toggle */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStatus('lost')}
            className={`flex-1 py-2 rounded-lg border-2 border-black font-bold text-xs transition-all ${status === 'lost' ? 'bg-red-500 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-red-50'}`}>
            Lost Pet
          </button>
          <button type="button" onClick={() => setStatus('found')}
            className={`flex-1 py-2 rounded-lg border-2 border-black font-bold text-xs transition-all ${status === 'found' ? 'bg-sage-500 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-sage-50'}`}>
            Found Pet
          </button>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-3">
          {photoDataUrl ? (
            <div className="relative w-16 h-16 rounded-lg border-2 border-black overflow-hidden">
              <img src={photoDataUrl} alt="Pet" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setPhotoDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-400 hover:border-terracotta-400 hover:text-terracotta-500 transition-colors">
              <Camera className="w-5 h-5 mb-0.5" /><span className="text-[9px] font-medium">Photo</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Pet Name *</label>
            <input type="text" value={petName} onChange={e => setPetName(e.target.value)} required placeholder="e.g. Buddy"
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Species *</label>
            <select value={species} onChange={e => setSpecies(e.target.value as any)}
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none bg-white">
              <option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Breed</label>
            <input type="text" value={breed} onChange={e => setBreed(e.target.value)} placeholder="e.g. Golden Retriever"
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Color</label>
            <input type="text" value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. Golden"
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Last Seen Location *</label>
          <input type="text" value={lastSeenAddress} onChange={e => setLastSeenAddress(e.target.value)}
            placeholder="Address or cross streets"
            className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none mb-2" />
          <button type="button" onClick={onStartPlacing}
            className={`w-full py-2 rounded-lg border-2 border-black font-bold text-xs transition-all flex items-center justify-center gap-2
              ${isPlacing ? 'bg-yellow-400 text-black animate-pulse' : placedCoords ? 'bg-sage-100 text-sage-800 border-sage-500' : 'bg-terracotta-50 text-terracotta-700 hover:bg-terracotta-100 border-terracotta-400'}`}>
            <MapPin className="w-3.5 h-3.5" />
            {isPlacing ? 'Click map...' : placedCoords ? `📍 ${placedCoords.lat.toFixed(4)}, ${placedCoords.lng.toFixed(4)}` : 'Place pin on map'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Identifying features, collar, tags..."
            className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none resize-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Info</label>
          <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)} placeholder="Phone or email"
            className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none" />
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200 flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border-2 border-black font-bold text-xs bg-white text-gray-700">Cancel</button>
        <button type="submit" disabled={!petName.trim() || !placedCoords}
          className="flex-1 py-2 rounded-lg border-2 border-black font-bold text-xs bg-red-500 text-white shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          <Send className="w-3.5 h-3.5" /> Submit
        </button>
      </div>
    </motion.form>
  );
}

// ── MAIN EXCHANGE COMPONENT ──────────────────────────────────────────────────

export function Exchange() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const exchangeLayerRef = useRef<any>(null);
  const lostPetsLayerRef = useRef<any>(null);
  const sheltersLayerRef = useRef<any>(null);
  const placingMarkerRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shelters, setShelters] = useState<ShelterMarker[]>([]);
  const [exchangePosts, setExchangePosts] = useState<ExchangePost[]>([]);
  const [lostPetReports, setLostPetReports] = useState<LostPetReport[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('all');
  const [sidebarView, setSidebarView] = useState<SidebarView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Seed some demo exchange posts
  useEffect(() => {
    setExchangePosts([
      {
        id: '1', type: 'offer',
        parsed: {
          title: 'Blue Buffalo Puppy Food — 10lb Bag',
          brand: 'Blue Buffalo', category: 'Pet Food',
          quantity: '~10lbs remaining', condition: 'Opened, mostly full',
          expiration: '2027-03', description: 'Switched brands and my puppy won\'t eat this anymore. Nearly full bag of Life Protection Formula, great for large breed puppies.',
          petType: 'puppy', estimatedValue: '$35',
        },
        rawInput: 'I have half a bag of Blue Buffalo puppy food left over, about 10lbs, expires March 2027',
        user: 'Sarah M.', badge: 'Verified Donor', location: 'Downtown',
        latitude: 38.95, longitude: -92.33, timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'active', photoDataUrl: null,
      },
      {
        id: '2', type: 'request',
        parsed: {
          title: 'Need Medium Dog Crate (Temporary)',
          brand: null, category: 'Supplies & Gear',
          quantity: '1 crate', condition: null,
          expiration: null, description: 'Looking to borrow a medium-sized dog crate for about 2 weeks while mine is being repaired. Can pick up and return anywhere in the Northside area.',
          petType: 'dog', estimatedValue: null,
        },
        rawInput: 'Need to borrow a medium dog crate for a couple weeks. Mine broke and I\'m getting it fixed.',
        user: 'James K.', badge: 'Community Helper', location: 'Northside',
        latitude: 38.97, longitude: -92.30, timestamp: new Date(Date.now() - 7200000).toISOString(),
        status: 'active', photoDataUrl: null,
      },
      {
        id: '3', type: 'offer',
        parsed: {
          title: 'Gently Used Pet Crate — Medium',
          brand: null, category: 'Supplies & Gear',
          quantity: '1 crate', condition: 'Gently used',
          expiration: null, description: 'Medium-sized wire crate in great condition. My pup outgrew it. Includes the removable tray.',
          petType: 'dog', estimatedValue: '$50',
        },
        rawInput: 'Gently used medium pet crate, my pup outgrew it. Comes with removable tray.',
        user: 'Maria L.', badge: 'Verified Donor', location: 'West End',
        latitude: 38.94, longitude: -92.36, timestamp: new Date(Date.now() - 10800000).toISOString(),
        status: 'active', photoDataUrl: null,
      },
    ]);

    // Seed a lost pet for map demo
    setLostPetReports([
      {
        id: 'lp1', petName: 'Biscuit', species: 'dog', breed: 'Corgi Mix',
        color: 'Tan and White', description: 'Small corgi mix, very friendly. Wearing a red collar with tags. Last seen near the park.',
        lastSeenAddress: 'Central Park area', latitude: 38.955, longitude: -92.325,
        contactInfo: '555-0123', photoDataUrl: null,
        timestamp: new Date(Date.now() - 5400000).toISOString(), status: 'lost',
      }
    ]);
  }, []);

  // ── Load Leaflet + shelters ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const shelterData = await api.getShelters();
        if (!cancelled) {
          const mapped: ShelterMarker[] = (shelterData || [])
            .filter((s: any) => s.latitude && s.longitude)
            .map((s: any) => ({
              id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude,
              website_url: s.website_url, location: s.location, pet_count: s.pet_count || 0,
            }));
          setShelters(mapped);
        }
      } catch (err) { console.error('Failed to load shelters:', err); }

      try {
        await loadLeaflet();
        if (!cancelled) setLeafletReady(true);
      } catch (err) { console.error('Failed to load Leaflet:', err); }
      finally { if (!cancelled) setLoading(false); }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // ── Initialize map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapRef.current) return;
    const L = (window as any).L;

    const map = L.map(mapContainerRef.current, {
      center: [38.95, -92.33],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    exchangeLayerRef.current = L.layerGroup().addTo(map);
    lostPetsLayerRef.current = L.layerGroup().addTo(map);
    sheltersLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [leafletReady]);

  // ── Update exchange markers ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !exchangeLayerRef.current || !leafletReady) return;
    const L = (window as any).L;
    exchangeLayerRef.current.clearLayers();

    if (activeLayer === 'lostPets' || activeLayer === 'shelters') return;

    exchangePosts.forEach(post => {
      const icon = post.type === 'offer' ? getOfferIcon() : getRequestIcon();
      const marker = L.marker([post.latitude, post.longitude], { icon });
      const catColor = post.type === 'offer' ? '#d46a4e' : '#6b8fdb';
      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="background: ${post.type === 'offer' ? '#dcfce7' : '#dbeafe'}; color: ${post.type === 'offer' ? '#15803d' : '#1d4ed8'}; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${post.type === 'offer' ? '🎁 OFFER' : '🙏 REQUEST'}</span>
            <span style="font-size: 10px; color: #888;">${getTimeAgo(post.timestamp)}</span>
          </div>
          ${post.photoDataUrl ? `<img src="${post.photoDataUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />` : ''}
          <h3 style="font-weight: 700; font-size: 14px; margin: 0 0 4px; color: #111;">${post.parsed.title}</h3>
          <p style="font-size: 12px; color: #555; margin: 0 0 6px; line-height: 1.4;">${post.parsed.description.slice(0, 120)}${post.parsed.description.length > 120 ? '...' : ''}</p>
          ${post.parsed.brand ? `<p style="font-size: 11px; color: #888; margin: 0 0 2px;">🏷️ ${post.parsed.brand}</p>` : ''}
          ${post.parsed.quantity ? `<p style="font-size: 11px; color: #888; margin: 0 0 2px;">📦 ${post.parsed.quantity}</p>` : ''}
          ${post.parsed.expiration ? `<p style="font-size: 11px; color: #888; margin: 0 0 2px;">📅 Exp: ${post.parsed.expiration}</p>` : ''}
          <p style="font-size: 11px; color: ${catColor}; font-weight: 600; margin: 6px 0 0;">👤 ${post.user} · ${post.location}</p>
        </div>
      `);
      exchangeLayerRef.current.addLayer(marker);
    });
  }, [exchangePosts, activeLayer, leafletReady]);

  // ── Update lost pet markers ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lostPetsLayerRef.current || !leafletReady) return;
    const L = (window as any).L;
    lostPetsLayerRef.current.clearLayers();

    if (activeLayer === 'exchange' || activeLayer === 'shelters') return;

    lostPetReports.forEach(report => {
      const icon = getLostPetIcon(report.species);
      const marker = L.marker([report.latitude, report.longitude], { icon });
      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="background: ${report.status === 'lost' ? '#fecaca' : '#d1fae5'}; color: ${report.status === 'lost' ? '#991b1b' : '#065f46'}; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${report.status.toUpperCase()}</span>
            <span style="font-size: 11px; color: #888;">${getTimeAgo(report.timestamp)}</span>
          </div>
          ${report.photoDataUrl ? `<img src="${report.photoDataUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />` : ''}
          <h3 style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">${report.petName}</h3>
          <p style="color: #666; font-size: 12px; margin: 0 0 4px;">${report.breed || report.species} · ${report.color || 'Unknown'}</p>
          ${report.description ? `<p style="font-size: 12px; color: #444; margin: 0 0 6px; line-height: 1.4;">${report.description.slice(0, 120)}...</p>` : ''}
          ${report.contactInfo ? `<p style="font-size: 11px; color: #d46a4e; font-weight: 600;">📞 ${report.contactInfo}</p>` : ''}
        </div>
      `);
      lostPetsLayerRef.current.addLayer(marker);
    });
  }, [lostPetReports, activeLayer, leafletReady]);

  // ── Update shelter markers ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !sheltersLayerRef.current || !leafletReady) return;
    const L = (window as any).L;
    sheltersLayerRef.current.clearLayers();

    if (activeLayer === 'exchange' || activeLayer === 'lostPets') return;

    shelters.forEach(shelter => {
      const icon = getShelterIcon();
      const marker = L.marker([shelter.latitude, shelter.longitude], { icon });
      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 200px;">
          <h3 style="font-weight: 700; font-size: 14px; margin: 0 0 6px;">${shelter.name}</h3>
          <p style="color: #5d8560; font-weight: 600; font-size: 12px; margin: 0 0 4px;">${shelter.pet_count} pets available</p>
          ${shelter.location ? `<p style="color: #666; font-size: 11px; margin: 0 0 4px;">📍 ${shelter.location}</p>` : ''}
          ${shelter.website_url && !shelter.website_url.includes('placeholder')
            ? `<a href="${shelter.website_url}" target="_blank" rel="noopener" style="color: #d46a4e; font-size: 11px; font-weight: 600;">🌐 Website →</a>`
            : ''}
        </div>
      `);
      sheltersLayerRef.current.addLayer(marker);
    });
  }, [shelters, activeLayer, leafletReady]);

  // ── Pin placement ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletReady) return;
    const L = (window as any).L;
    const map = mapRef.current;

    function handleClick(e: any) {
      if (!isPlacingPin) return;
      const { lat, lng } = e.latlng;
      setPlacedCoords({ lat, lng });
      setIsPlacingPin(false);
      if (placingMarkerRef.current) map.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = L.marker([lat, lng], { icon: getPlacingIcon() }).addTo(map);
    }

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [isPlacingPin, leafletReady]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    mapContainerRef.current.style.cursor = isPlacingPin ? 'crosshair' : '';
  }, [isPlacingPin]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleNewExchangePost = (post: Omit<ExchangePost, 'id' | 'timestamp'>) => {
    const newPost: ExchangePost = {
      ...post,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setExchangePosts(prev => [newPost, ...prev]);
    setSidebarView('list');
    setPlacedCoords(null);
    setIsPlacingPin(false);
    if (placingMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = null;
    }
  };

  const handleNewLostPetReport = (report: Omit<LostPetReport, 'id' | 'timestamp'>) => {
    const newReport: LostPetReport = {
      ...report,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setLostPetReports(prev => [newReport, ...prev]);
    setSidebarView('list');
    setPlacedCoords(null);
    setIsPlacingPin(false);
    if (placingMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = null;
    }
  };

  const handleCancelForm = () => {
    setSidebarView('list');
    setPlacedCoords(null);
    setIsPlacingPin(false);
    if (placingMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = null;
    }
  };

  const locateExchangePost = (post: ExchangePost) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([post.latitude, post.longitude], 15, { duration: 1.2 });
  };

  const locateLostPet = (report: LostPetReport) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([report.latitude, report.longitude], 15, { duration: 1.2 });
  };

  // ── Filtered posts ─────────────────────────────────────────────────
  const filteredExchangePosts = exchangePosts.filter(p => {
    if (filterCategory !== 'all' && p.parsed.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.parsed.title.toLowerCase().includes(q) ||
        p.parsed.description.toLowerCase().includes(q) ||
        (p.parsed.brand || '').toLowerCase().includes(q) ||
        p.rawInput.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Category counts
  const categoryCounts = exchangePosts.reduce((acc, p) => {
    acc[p.parsed.category] = (acc[p.parsed.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b-3 border-black px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold text-gray-900">Community Exchange</h1>
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-terracotta-100 text-terracotta-700 border border-terracotta-300">
              {exchangePosts.filter(p => p.type === 'offer').length} Offers
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-300">
              {exchangePosts.filter(p => p.type === 'request').length} Requests
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-red-100 text-red-700 border border-red-300">
              {lostPetReports.length} Lost/Found
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles */}
          <div className="hidden md:flex bg-gray-100 rounded-lg border-2 border-gray-200 p-0.5">
            {[
              { key: 'all' as MapLayer, label: 'All', icon: Layers },
              { key: 'exchange' as MapLayer, label: 'Exchange', icon: Gift },
              { key: 'lostPets' as MapLayer, label: 'Lost', icon: AlertCircle },
              { key: 'shelters' as MapLayer, label: 'Shelters', icon: Heart },
            ].map(opt => (
              <button key={opt.key} onClick={() => setActiveLayer(opt.key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeLayer === opt.key ? 'bg-white text-gray-900 shadow-sm border border-gray-300' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <opt.icon className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <button onClick={() => { setSidebarView('newPost'); setSidebarOpen(true); }}
            className="px-3 py-2 rounded-lg border-2 border-black bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white font-bold text-xs shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Post</span>
            <span className="sm:hidden">Post</span>
          </button>

          <button onClick={() => { setSidebarView('lostPetForm'); setSidebarOpen(true); }}
            className="px-3 py-2 rounded-lg border-2 border-black bg-red-500 text-white font-bold text-xs shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lost Pet</span>
            <span className="sm:hidden">Lost</span>
          </button>

          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-50 transition-colors">
            {sidebarOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-gradient-to-br from-sage-100 to-terracotta-50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-sage-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Placing mode overlay */}
          <AnimatePresence>
            {isPlacingPin && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-yellow-400 border-2 border-black rounded-lg shadow-neo-sm px-4 py-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 animate-bounce" />
                <span className="font-bold text-sm">Click on the map to place a pin</span>
                <button onClick={() => setIsPlacingPin(false)} className="ml-2 text-black/60 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm border-2 border-gray-200 rounded-xl p-3 shadow-lg">
            <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Legend</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-gray-700">
                <span className="w-3 h-3 rounded-full bg-terracotta-500 border border-black"></span> Offers
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-700">
                <span className="w-3 h-3 rounded-full bg-blue-500 border border-black"></span> Requests
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-700">
                <span className="w-3 h-3 rounded-full bg-red-500 border border-black"></span> Lost/Found
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-700">
                <span className="w-3 h-3 rounded-full bg-sage-500 border border-black"></span> Shelters
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="border-l-3 border-black bg-white flex flex-col overflow-hidden flex-shrink-0"
            >
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {sidebarView === 'newPost' ? (
                    <div className="p-3" key="newPost">
                      <NLPComposer
                        onPostCreated={handleNewExchangePost}
                        onCancel={handleCancelForm}
                        placedCoords={placedCoords}
                        onStartPlacing={() => setIsPlacingPin(true)}
                        isPlacing={isPlacingPin}
                      />
                    </div>
                  ) : sidebarView === 'lostPetForm' ? (
                    <div className="p-3" key="lostPetForm">
                      <LostPetForm
                        onSubmit={handleNewLostPetReport}
                        onCancel={handleCancelForm}
                        placedCoords={placedCoords}
                        onStartPlacing={() => setIsPlacingPin(true)}
                        isPlacing={isPlacingPin}
                      />
                    </div>
                  ) : (
                    <div className="p-3 space-y-3" key="list">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search listings..."
                          className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg text-xs focus:border-terracotta-400 focus:ring-0 outline-none"
                        />
                      </div>

                      {/* Category filter pills */}
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setFilterCategory('all')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                            filterCategory === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}>
                          All ({exchangePosts.length})
                        </button>
                        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
                          <button key={cat} onClick={() => setFilterCategory(cat)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                              filterCategory === cat
                                ? `${colors.bg} ${colors.text} ${colors.border}`
                                : `bg-white text-gray-500 border-gray-200 hover:border-gray-300`
                            }`}>
                            {cat.split(' ')[0]} ({categoryCounts[cat] || 0})
                          </button>
                        ))}
                      </div>

                      {/* Quick action buttons */}
                      <div className="flex gap-2">
                        <button onClick={() => setSidebarView('newPost')}
                          className="flex-1 py-2.5 rounded-lg border-2 border-black bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white font-bold text-xs shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          AI-Powered Post
                        </button>
                        <button onClick={() => setSidebarView('lostPetForm')}
                          className="py-2.5 px-3 rounded-lg border-2 border-black bg-red-500 text-white font-bold text-xs shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Lost Pet
                        </button>
                      </div>

                      {/* Exchange listings */}
                      {(activeLayer === 'all' || activeLayer === 'exchange') && filteredExchangePosts.length > 0 && (
                        <div>
                          <h3 className="font-display font-bold text-xs text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5" />
                            Exchange Listings ({filteredExchangePosts.length})
                          </h3>
                          <div className="space-y-2">
                            {filteredExchangePosts.map(post => (
                              <ExchangePostCard key={post.id} post={post} onLocate={() => locateExchangePost(post)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lost pets */}
                      {(activeLayer === 'all' || activeLayer === 'lostPets') && lostPetReports.length > 0 && (
                        <div>
                          <h3 className="font-display font-bold text-xs text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Lost & Found Pets ({lostPetReports.length})
                          </h3>
                          <div className="space-y-2">
                            {lostPetReports.map(report => (
                              <LostPetCard key={report.id} report={report} onLocate={() => locateLostPet(report)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shelters section */}
                      {(activeLayer === 'all' || activeLayer === 'shelters') && shelters.length > 0 && (
                        <div>
                          <h3 className="font-display font-bold text-xs text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5" />
                            Nearby Shelters ({shelters.length})
                          </h3>
                          <div className="space-y-2">
                            {shelters.slice(0, 5).map(shelter => (
                              <div key={shelter.id}
                                className="p-3 rounded-lg border-2 border-sage-200 bg-sage-50/50 hover:bg-sage-100 transition-colors cursor-pointer"
                                onClick={() => mapRef.current?.flyTo([shelter.latitude, shelter.longitude], 14, { duration: 1 })}>
                                <h4 className="font-bold text-xs text-gray-900">{shelter.name}</h4>
                                <p className="text-[10px] text-sage-600 font-medium">{shelter.pet_count} pets available</p>
                                {shelter.website_url && !shelter.website_url.includes('placeholder') && (
                                  <a href={shelter.website_url} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-terracotta-500 font-semibold hover:underline flex items-center gap-1 mt-1"
                                    onClick={e => e.stopPropagation()}>
                                    <Globe className="w-2.5 h-2.5" /> Website
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {filteredExchangePosts.length === 0 && (activeLayer === 'all' || activeLayer === 'exchange') && (
                        <div className="text-center py-8">
                          <Gift className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 font-medium">No listings match your search</p>
                          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or create a new post</p>
                        </div>
                      )}

                      {/* Community banner */}
                      <div className="p-4 bg-gradient-to-r from-sage-100 to-terracotta-100 border-2 border-black rounded-xl text-center">
                        <Heart className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                        <h4 className="font-display font-bold text-sm text-gray-900 mb-1">Building a Caring Community</h4>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          Every item shared strengthens our community. Just type naturally — AI does the rest.
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}