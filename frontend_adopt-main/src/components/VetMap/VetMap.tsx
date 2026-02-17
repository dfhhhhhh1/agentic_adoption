import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, UserRound } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface Vet {
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  is_24hr: boolean;
}

// 1. Modern Vet Icon (Rose color to match your theme)
const vetIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div className="bg-rose-500 border-2 border-black p-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white">
        <MapPin size={18} strokeWidth={2.5} />
      </div>
      <div className="absolute -bottom-1 w-2 h-2 bg-black rotate-45"></div>
    </div>
  ),
  className: 'custom-div-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// 2. Modern User Icon (Blue with a pulse effect)
const userIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div className="absolute w-8 h-8 bg-blue-400 rounded-full animate-ping opacity-40"></div>
      <div className="bg-blue-600 border-2 border-black p-1.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white relative z-10">
        <UserRound size={16} strokeWidth={2.5} />
      </div>
    </div>
  ),
  className: 'custom-div-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export function VetMap({ clinics, userLocation }: { clinics: Vet[], userLocation: [number, number] }) {
  return (
    <div className="h-72 w-full rounded-xl border-3 border-black overflow-hidden mt-3 shadow-neo-sm relative">
      <MapContainer 
        center={userLocation} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        {/* 3. Modern "Voyager" Tile Style (Cleaner and more modern than default) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* 4. User Location Marker */}
        <Marker position={userLocation} icon={userIcon}>
          <Popup>
            <span className="font-bold">You are here</span>
          </Popup>
        </Marker>

        {/* 5. Clinic Markers */}
        {clinics.map((vet, idx) => (
          <Marker 
            key={idx} 
            position={[vet.latitude, vet.longitude]} 
            icon={vetIcon}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <p className="font-bold text-gray-900 leading-tight mb-1">{vet.name}</p>
                <p className="text-[10px] text-gray-600 mb-2">{vet.address}</p>
                {vet.is_24hr && (
                  <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-200">
                    24/7 OPEN
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}