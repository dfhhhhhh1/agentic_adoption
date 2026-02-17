import { useState } from 'react';
import { Heart, Info, MapPin, Calendar, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Pet, MatchResult } from '../../lib/types';

interface PetCardProps {
  pet: Pet;
  matchScore?: number;
  reasoning?: string;
  onClick: () => void;
}

export function PetCard({ pet, matchScore, reasoning, onClick }: PetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = pet.image_urls && pet.image_urls.length > 0 
  ? pet.image_urls[0] 
  : pet.image_path; 
  const personalityBadge = pet.personality_description?.[0] || 'Friendly';
  const badgeColors: Record<string, string> = {
    'Chill': 'bg-blue-100 text-blue-700 border-blue-300',
    'High Energy': 'bg-orange-100 text-orange-700 border-orange-300',
    'Friendly': 'bg-green-100 text-green-700 border-green-300',
    'Playful': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'Calm': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  };

  const age = pet.age_text
    ? `${pet.age_text} years`
    : `${pet.age_months || 0} months`;


  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-white border-3 border-black rounded-xl shadow-neo hover:shadow-neo-lg transition-all duration-200 cursor-pointer overflow-hidden group"
    >
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="w-12 h-12 text-gray-300 animate-pulse" />
          </div>
        )}
        <img
          src={imageUrl || `https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600`}
          alt={pet.name}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-300 ${
            imageLoaded ? 'opacity-100 group-hover:scale-110' : 'opacity-0'
          }`}
        />

        <div className="absolute top-3 left-3">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-black shadow-neo-sm backdrop-blur-sm ${
              badgeColors[personalityBadge] || badgeColors['Friendly']
            }`}
          >
            {personalityBadge}
          </span>
        </div>

        {matchScore !== undefined && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 right-3 bg-sage-500 text-white px-3 py-1 rounded-lg border-2 border-black font-bold text-sm shadow-neo-sm backdrop-blur-sm"
          >
            {matchScore}% Match
          </motion.div>
        )}

        <AnimatePresence>
          {isHovered && reasoning && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
            >
              <div className="text-center">
                <Info className="w-6 h-6 text-white mx-auto mb-2" />
                <p className="text-white text-sm font-medium">{reasoning}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-xl font-display font-bold text-gray-900 mb-1">
              {pet.name}
            </h3>
            <p className="text-sm text-gray-600 font-medium">
              {pet.breed} • {pet.species}
            </p>
          </div>
          {pet.adoption_fee !== undefined && (
            <div className="flex items-center gap-1 text-terracotta-600 font-bold">
              <DollarSign className="w-4 h-4" />
              <span>{pet.adoption_fee}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="w-3 h-3" />
            <span>{age}</span>
          </div>
          {pet.shelter_name && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <MapPin className="w-3 h-3" />
              <span>{pet.shelter_name}</span>
            </div>
          )}
        </div>

        {pet.personality_description && (
          <p className="text-sm text-gray-700 line-clamp-2 mb-3">
            {pet.personality_description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {pet.good_with_children && (
            <span className="px-2 py-1 bg-sage-50 text-sage-700 text-xs rounded border border-sage-200 font-medium">
              Good with kids
            </span>
          )}
          {pet.good_with_dogs && (
            <span className="px-2 py-1 bg-sage-50 text-sage-700 text-xs rounded border border-sage-200 font-medium">
              Good with dogs
            </span>
          )}
          {pet.good_with_cats && (
            <span className="px-2 py-1 bg-sage-50 text-sage-700 text-xs rounded border border-sage-200 font-medium">
              Good with cats
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
