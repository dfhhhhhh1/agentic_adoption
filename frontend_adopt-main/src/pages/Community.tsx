import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, AlertCircle, Navigation, Camera, X, Send, Sparkles, Loader2,
  ChevronDown, ChevronUp, Dog, Cat, Phone, Globe, Eye, EyeOff, Plus, Minus,
  Filter, Search, Clock, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

import vetData from '../../../vet_locations.json'; // Ensure the path matches your folder structure
// ── Types ────────────────────────────────────────────────────────────────────

interface ShelterMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  website_url?: string;
  location?: string;
  pet_count: number;
}

interface VetClinic extends ShelterMarker {
  is_24hr: boolean;
  address: string;
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

type MapLayer = 'shelters' | 'lostPets' | 'all';

// ── Leaflet loader (CDN, no npm needed) ──────────────────────────────────────

let leafletLoaded = false;
let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.crossOrigin = '';
      document.head.appendChild(css);
    }
    // JS
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

// ── Custom marker icons (SVG data URIs) ──────────────────────────────────────

function createSvgIcon(color: string, innerSvg: string, size: [number, number] = [32, 42]) {
  const L = (window as any).L;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#000" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="10" fill="white" opacity="0.9"/>
    ${innerSvg}
  </svg>`;

  // Fix: Use encodeURIComponent and unescape to handle Unicode (emojis)
  const base64Svg = btoa(unescape(encodeURIComponent(svg)));

  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + base64Svg,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1] + 5],
  });
}

function getShelterIcon() {
  return createSvgIcon('#5d8560',
    `<text x="16" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#5d8560">🏠</text>`
  );
}

function getLostDogIcon() {
  return createSvgIcon('#dc2626',
    `<text x="16" y="20" text-anchor="middle" font-size="14">🐕</text>`
  );
}

function getLostCatIcon() {
  return createSvgIcon('#dc2626',
    `<text x="16" y="20" text-anchor="middle" font-size="14">🐈</text>`
  );
}

function getLostOtherIcon() {
  return createSvgIcon('#dc2626',
    `<text x="16" y="20" text-anchor="middle" font-size="14">❓</text>`
  );
}

function getPlacingIcon() {
  return createSvgIcon('#f59e0b',
    `<text x="16" y="20" text-anchor="middle" font-size="14">📍</text>`
  );
}

// ── Lost Pet Form Component ──────────────────────────────────────────────────

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
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAiDescribe = async () => {
    if (!photoDataUrl && !petName) return;
    setAiLoading(true);
    try {
      const prompt = photoDataUrl
        ? `I have a ${status} ${species} named "${petName || 'unknown'}". Breed: ${breed || 'unknown'}. Color: ${color || 'unknown'}. Based on this information, write a brief, helpful ${status === 'lost' ? 'lost pet alert' : 'found pet'} description (2-3 sentences) that would help someone identify and return this pet. Be specific about likely physical features and include practical advice. Do NOT use markdown formatting.`
        : `Write a brief, helpful ${status === 'lost' ? 'lost pet alert' : 'found pet'} description for a ${species} named "${petName}". Breed: ${breed || 'unknown'}. Color: ${color || 'unknown'}. Write 2-3 sentences that would help someone identify this pet. Do NOT use markdown formatting.`;

      const messages: any[] = [{ role: 'user' as const, content: prompt }];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages,
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b: any) => b.text || '').join('') || '';
      if (text) setDescription(text.trim());
    } catch (err) {
      console.error('AI description failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim() || !placedCoords) return;
    onSubmit({
      petName: petName.trim(),
      species,
      breed: breed.trim(),
      color: color.trim(),
      description: description.trim(),
      lastSeenAddress: lastSeenAddress.trim(),
      latitude: placedCoords.lat,
      longitude: placedCoords.lng,
      contactInfo: contactInfo.trim(),
      photoDataUrl,
      status,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      onSubmit={handleSubmit}
      className="bg-white border-3 border-black rounded-xl shadow-neo-sm overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-display font-bold text-lg">Report a Pet</h3>
        </div>
        <button type="button" onClick={onCancel} className="text-white/80 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Status toggle */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStatus('lost')}
            className={`flex-1 py-2 rounded-lg border-2 border-black font-bold text-sm transition-all ${status === 'lost' ? 'bg-red-500 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-red-50'}`}>
            Lost Pet
          </button>
          <button type="button" onClick={() => setStatus('found')}
            className={`flex-1 py-2 rounded-lg border-2 border-black font-bold text-sm transition-all ${status === 'found' ? 'bg-sage-500 text-white shadow-neo-sm' : 'bg-white text-gray-700 hover:bg-sage-50'}`}>
            Found Pet
          </button>
        </div>

        {/* Photo upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Photo</label>
          <div className="flex items-center gap-3">
            {photoDataUrl ? (
              <div className="relative w-20 h-20 rounded-lg border-2 border-black overflow-hidden shadow-neo-sm">
                <img src={photoDataUrl} alt="Pet" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setPhotoDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-500 hover:border-terracotta-400 hover:text-terracotta-500 transition-colors">
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium">Add Photo</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="text-xs text-gray-500">JPG, PNG, or WebP<br />Max 5 MB</div>
          </div>
        </div>

        {/* Core fields row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Pet Name *</label>
            <input type="text" value={petName} onChange={e => setPetName(e.target.value)} required
              placeholder="e.g. Buddy"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Species *</label>
            <select value={species} onChange={e => setSpecies(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none bg-white">
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Breed</label>
            <input type="text" value={breed} onChange={e => setBreed(e.target.value)}
              placeholder="e.g. Golden Retriever"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Color</label>
            <input type="text" value={color} onChange={e => setColor(e.target.value)}
              placeholder="e.g. Golden, Brown"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none" />
          </div>
        </div>

        {/* Map pin placement */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Last Seen Location *</label>
          <input type="text" value={lastSeenAddress} onChange={e => setLastSeenAddress(e.target.value)}
            placeholder="Address or cross streets"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none mb-2" />
          <button type="button" onClick={onStartPlacing}
            className={`w-full py-2.5 rounded-lg border-2 border-black font-bold text-sm transition-all flex items-center justify-center gap-2
              ${isPlacing
                ? 'bg-yellow-400 text-black animate-pulse shadow-neo-sm'
                : placedCoords
                  ? 'bg-sage-100 text-sage-800 border-sage-500'
                  : 'bg-terracotta-50 text-terracotta-700 hover:bg-terracotta-100 border-terracotta-400'
              }`}>
            <MapPin className="w-4 h-4" />
            {isPlacing ? 'Click on the map to place pin...' : placedCoords ? `📍 Pin placed (${placedCoords.lat.toFixed(4)}, ${placedCoords.lng.toFixed(4)})` : 'Place pin on map'}
          </button>
        </div>

        {/* Description + AI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-semibold text-gray-700">Description</label>
            <button type="button" onClick={() => setShowAiHelper(!showAiHelper)}
              className="flex items-center gap-1 text-xs font-semibold text-sage-600 hover:text-sage-800 transition-colors">
              <Sparkles className="w-3 h-3" />
              AI Helper
            </button>
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            placeholder="Describe identifying features, behavior, collar, tags..."
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none resize-none" />
          <AnimatePresence>
            {showAiHelper && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <button type="button" onClick={handleAiDescribe} disabled={aiLoading || (!petName && !photoDataUrl)}
                  className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-sage-500 to-sage-600 text-white font-bold text-sm border-2 border-black shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiLoading ? 'Generating...' : 'Generate description with AI'}
                </button>
                <p className="text-[10px] text-gray-400 mt-1 text-center">Uses Claude to write a helpful, identifiable description</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Info</label>
          <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)}
            placeholder="Phone or email"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-terracotta-400 focus:ring-0 outline-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t-2 border-gray-200 flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-white text-gray-700 hover:bg-gray-50 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={!petName.trim() || !placedCoords}
          className="flex-1 py-2.5 rounded-lg border-2 border-black font-bold text-sm bg-red-500 text-white shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          Submit Report
        </button>
      </div>
    </motion.form>
  );
}

// ── Lost Pet Card ────────────────────────────────────────────────────────────

function LostPetCard({ report, onLocate }: { report: LostPetReport; onLocate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(report.timestamp);

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      className={`border-2 rounded-lg overflow-hidden transition-all ${report.status === 'lost' ? 'border-red-300 bg-red-50/50' : 'border-sage-300 bg-sage-50/50'}`}>
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {report.photoDataUrl ? (
          <img src={report.photoDataUrl} alt={report.petName}
            className="w-14 h-14 rounded-lg object-cover border-2 border-black shadow-neo-sm flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gray-200 border-2 border-gray-300 flex items-center justify-center flex-shrink-0 text-2xl">
            {report.species === 'dog' ? '🐕' : report.species === 'cat' ? '🐈' : '🐾'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${report.status === 'lost' ? 'bg-red-200 text-red-800' : 'bg-sage-200 text-sage-800'}`}>
              {report.status.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeAgo}</span>
          </div>
          <h4 className="font-bold text-sm text-gray-900 truncate">{report.petName}</h4>
          <p className="text-xs text-gray-600 truncate">{report.breed || report.species} • {report.color || 'Unknown color'}</p>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Main Community Component ─────────────────────────────────────────────────

export function Community() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const lostPetsLayerRef = useRef<any>(null);
  const placingMarkerRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [shelters, setShelters] = useState<ShelterMarker[]>([]);
  const [lostPetReports, setLostPetReports] = useState<LostPetReport[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // ── Load Leaflet + shelters ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    

    async function init() {
      try {
        // Load shelters from API
        const shelterData = await api.getShelters();
        if (!cancelled) {
          const mapped: ShelterMarker[] = (shelterData || [])
            .filter((s: any) => s.latitude && s.longitude)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              latitude: s.latitude,
              longitude: s.longitude,
              website_url: s.website_url,
              location: s.location,
              pet_count: s.pet_count || 0,
            }));
          setShelters(mapped);
        }
      } catch (err) {
        console.error('Failed to load shelters:', err);
      }

      try {
        await loadLeaflet();
        if (!cancelled) setLeafletReady(true);
      } catch (err) {
        console.error('Failed to load Leaflet:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Initialize map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapRef.current) return;

    const L = (window as any).L;

    // Default center: Missouri (where shelters are)
    const defaultCenter: [number, number] = [38.7, -91.5];
    const defaultZoom = 8;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
    });

    // Tile layer — CartoDB Voyager for clean look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create marker layer groups
    markersLayerRef.current = L.layerGroup().addTo(map);
    lostPetsLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // Fit to shelters if available
    if (shelters.length > 0) {
      const bounds = L.latLngBounds(shelters.map(s => [s.latitude, s.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [leafletReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update shelter markers ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current || !leafletReady) return;
    const L = (window as any).L;
    markersLayerRef.current.clearLayers();

    if (activeLayer === 'lostPets') return; // hide shelters

    shelters.forEach(shelter => {
      const icon = getShelterIcon();
      const marker = L.marker([shelter.latitude, shelter.longitude], { icon });
      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 200px;">
          <h3 style="font-weight: 700; font-size: 15px; margin: 0 0 6px;">${shelter.name}</h3>
          <p style="color: #5d8560; font-weight: 600; font-size: 13px; margin: 0 0 4px;">
            ${shelter.pet_count} pet${shelter.pet_count !== 1 ? 's' : ''} available
          </p>
          ${shelter.location ? `<p style="color: #666; font-size: 12px; margin: 0 0 4px;">📍 ${shelter.location}</p>` : ''}
          ${shelter.website_url && !shelter.website_url.includes('placeholder')
            ? `<a href="${shelter.website_url}" target="_blank" rel="noopener" style="color: #d46a4e; font-size: 12px; font-weight: 600; text-decoration: none;">🌐 Visit Website →</a>`
            : ''
          }
        </div>
      `, { className: 'shelter-popup' });
      markersLayerRef.current.addLayer(marker);
    });
  }, [shelters, activeLayer, leafletReady]);

  // ── Update lost pet markers ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lostPetsLayerRef.current || !leafletReady) return;
    const L = (window as any).L;
    lostPetsLayerRef.current.clearLayers();

    if (activeLayer === 'shelters') return; // hide lost pets

    lostPetReports.forEach(report => {
      const icon = report.species === 'dog' ? getLostDogIcon() : report.species === 'cat' ? getLostCatIcon() : getLostOtherIcon();
      const marker = L.marker([report.latitude, report.longitude], { icon });
      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="background: ${report.status === 'lost' ? '#fecaca' : '#d1fae5'}; color: ${report.status === 'lost' ? '#991b1b' : '#065f46'}; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${report.status.toUpperCase()}</span>
            <span style="font-size: 11px; color: #888;">${getTimeAgo(report.timestamp)}</span>
          </div>
          ${report.photoDataUrl ? `<img src="${report.photoDataUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
          <h3 style="font-weight: 700; font-size: 15px; margin: 0 0 4px;">${report.petName}</h3>
          <p style="color: #666; font-size: 12px; margin: 0 0 4px;">${report.breed || report.species} • ${report.color || 'Unknown color'}</p>
          ${report.description ? `<p style="font-size: 12px; color: #444; margin: 0 0 6px; line-height: 1.4;">${report.description.slice(0, 150)}${report.description.length > 150 ? '...' : ''}</p>` : ''}
          ${report.lastSeenAddress ? `<p style="font-size: 11px; color: #888; margin: 0 0 4px;">📍 ${report.lastSeenAddress}</p>` : ''}
          ${report.contactInfo ? `<p style="font-size: 11px; color: #d46a4e; font-weight: 600; margin: 0;">📞 ${report.contactInfo}</p>` : ''}
        </div>
      `);
      lostPetsLayerRef.current.addLayer(marker);
    });
  }, [lostPetReports, activeLayer, leafletReady]);

  // ── Pin placement click handler ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletReady) return;
    const L = (window as any).L;
    const map = mapRef.current;

    function handleClick(e: any) {
      if (!isPlacingPin) return;
      const { lat, lng } = e.latlng;
      setPlacedCoords({ lat, lng });
      setIsPlacingPin(false);

      // Show temporary marker
      if (placingMarkerRef.current) {
        map.removeLayer(placingMarkerRef.current);
      }
      placingMarkerRef.current = L.marker([lat, lng], { icon: getPlacingIcon() }).addTo(map);
    }

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [isPlacingPin, leafletReady]);

  // ── Map cursor for placing mode ────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    mapContainerRef.current.style.cursor = isPlacingPin ? 'crosshair' : '';
  }, [isPlacingPin]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSubmitReport = (report: Omit<LostPetReport, 'id' | 'timestamp'>) => {
    const newReport: LostPetReport = {
      ...report,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setLostPetReports(prev => [newReport, ...prev]);
    setShowReportForm(false);
    setPlacedCoords(null);
    setIsPlacingPin(false);

    // Clean up placing marker
    if (placingMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = null;
    }
  };

  const locateReport = (report: LostPetReport) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([report.latitude, report.longitude], 15, { duration: 1.2 });
  };

  const handleCancelReport = () => {
    setShowReportForm(false);
    setPlacedCoords(null);
    setIsPlacingPin(false);
    if (placingMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(placingMarkerRef.current);
      placingMarkerRef.current = null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b-3 border-black px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold text-gray-900">Community Map</h1>
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-sage-100 text-sage-700 border border-sage-300">
              {shelters.length} Shelters
            </span>
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-red-100 text-red-700 border border-red-300">
              {lostPetReports.length} Reports
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles */}
          <div className="hidden sm:flex bg-gray-100 rounded-lg border-2 border-gray-300 p-0.5">
            {[
              { key: 'all' as MapLayer, label: 'All' },
              { key: 'shelters' as MapLayer, label: 'Shelters' },
              { key: 'lostPets' as MapLayer, label: 'Lost' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setActiveLayer(opt.key)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeLayer === opt.key ? 'bg-white text-gray-900 shadow-sm border border-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Report button */}
          <button onClick={() => setShowReportForm(true)}
            className="px-4 py-2 rounded-lg border-2 border-black bg-red-500 text-white font-bold text-sm shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Report Lost Pet</span>
            <span className="sm:hidden">Report</span>
          </button>

          {/* Sidebar toggle */}
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
                <span className="font-bold text-sm">Click on the map to mark last seen location</span>
                <button onClick={() => setIsPlacingPin(false)} className="ml-2 text-black/60 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="border-l-3 border-black bg-white flex flex-col overflow-hidden flex-shrink-0"
            >
              <div className="flex-1 overflow-y-auto">
                {/* Report form or list */}
                <AnimatePresence mode="wait">
                  {showReportForm ? (
                    <div className="p-3" key="form">
                      <LostPetForm
                        onSubmit={handleSubmitReport}
                        onCancel={handleCancelReport}
                        placedCoords={placedCoords}
                        onStartPlacing={() => setIsPlacingPin(true)}
                        isPlacing={isPlacingPin}
                      />
                    </div>
                  ) : (
                    <div className="p-3 space-y-3" key="list">
                      {/* Shelter list */}
                      {(activeLayer === 'all' || activeLayer === 'shelters') && shelters.length > 0 && (
                        <div>
                          <h3 className="font-display font-bold text-sm text-gray-700 mb-2 flex items-center gap-1.5">
                            Nearby Shelters
                          </h3>
                          <div className="space-y-2">
                            {shelters.map(shelter => (
                              <div key={shelter.id}
                                className="p-3 rounded-lg border-2 border-sage-200 bg-sage-50/50 hover:bg-sage-100 transition-colors cursor-pointer"
                                onClick={() => mapRef.current?.flyTo([shelter.latitude, shelter.longitude], 14, { duration: 1 })}>
                                <h4 className="font-bold text-sm text-gray-900">{shelter.name}</h4>
                                <p className="text-xs text-sage-600 font-medium">{shelter.pet_count} pets available</p>
                                {shelter.website_url && !shelter.website_url.includes('placeholder') && (
                                  <a href={shelter.website_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-terracotta-500 font-semibold hover:underline flex items-center gap-1 mt-1"
                                    onClick={e => e.stopPropagation()}>
                                    <Globe className="w-3 h-3" /> Website
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lost pet reports */}
                      {(activeLayer === 'all' || activeLayer === 'lostPets') && (
                        <div>
                          <h3 className="font-display font-bold text-sm text-gray-700 mb-2 flex items-center gap-1.5">
                            Lost & Found Reports
                          </h3>
                          {lostPetReports.length === 0 ? (
                            <div className="text-center py-8">
                              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 font-medium">No reports yet</p>
                              <p className="text-xs text-gray-400 mt-1">Click "Report Lost Pet" to create one</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {lostPetReports.map(report => (
                                <LostPetCard key={report.id} report={report} onLocate={() => locateReport(report)} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="border-t-2 border-gray-200 pt-3">
                        <button onClick={() => setShowReportForm(true)}
                          className="w-full py-3 rounded-lg border-2 border-black bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Report a Lost or Found Pet
                        </button>
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