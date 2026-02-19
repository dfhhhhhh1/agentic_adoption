import { X, Heart, Calendar, DollarSign, MapPin, CheckCircle2, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Pet } from '../../lib/types';

interface PetDetailModalProps {
  pet: Pet | null;
  onClose: () => void;
  matchScore?: number;
  reasoning?: string;
}

export function PetDetailModal({ pet, onClose, matchScore, reasoning }: PetDetailModalProps) {
  if (!pet) return null;

  const age = pet.age_text
    ? `${pet.age_text} years old`
    : `${pet.age_months || 0} months old`;

  const imageUrl = pet.image_urls && pet.image_urls.length > 0 
  ? pet.image_urls[0] 
  : pet.image_path; 

  const timeline = [
    { label: 'Intake', date: pet.intake_date, icon: Calendar },
    { label: 'Health Check', date: pet.intake_date, icon: CheckCircle2 },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white border-4 border-black rounded-2xl shadow-neo-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white border-b-4 border-black px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-2xl font-display font-bold text-gray-900">Meet {pet.name}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg border-2 border-black bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 p-6">
            <div className="space-y-4">
              <div className="relative aspect-square rounded-xl overflow-hidden border-4 border-black shadow-neo">
                <img
                  src={imageUrl || `https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800`}
                  alt={pet.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="bg-gray-50 border-3 border-black rounded-xl p-4 shadow-neo-sm">
                <h3 className="font-display font-bold text-lg mb-3">Quick Facts</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Species</p>
                    <p className="font-bold">{pet.species}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Breed</p>
                    <p className="font-bold">{pet.breed}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Age</p>
                    <p className="font-bold">{age}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Size</p>
                    <p className="font-bold">{pet.size || 'Medium'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Sex</p>
                    <p className="font-bold">{pet.sex || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Color</p>
                    <p className="font-bold">{pet.color || 'Mixed'}</p>
                  </div>
                </div>
              </div>

              {pet.adoption_fee !== undefined && (
                <div className="bg-terracotta-50 border-3 border-black rounded-xl p-4 shadow-neo-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-semibold">Adoption Fee</span>
                    <span className="text-2xl font-bold text-terracotta-600 flex items-center gap-1">
                      <DollarSign className="w-5 h-5" />
                      {pet.adoption_fee}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {matchScore !== undefined && reasoning && (
                <div className="bg-gradient-to-br from-sage-50 to-sage-100 border-3 border-sage-600 rounded-xl p-5 shadow-neo-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-sage-500 border-2 border-black rounded-lg flex items-center justify-center">
                      <Heart className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">AI Match Analysis</h3>
                      <p className="text-sm text-sage-700 font-medium">{matchScore}% Compatibility</p>
                    </div>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{reasoning}</p>
                </div>
              )}

              <div className="bg-white border-3 border-black rounded-xl p-5 shadow-neo-sm">
                <h3 className="font-display font-bold text-lg mb-3">About {pet.name}</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  {pet.personality_description || `${pet.name} is a wonderful ${pet.species.toLowerCase()} looking for a forever home!`}
                </p>

                {pet.personality && pet.personality.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Personality</h4>
                    <div className="flex flex-wrap gap-2">
                      {pet.personality.map((trait, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-sage-100 text-sage-700 rounded-lg border-2 border-sage-300 text-sm font-medium"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 mb-2">Compatibility</h4>
                  <div className="flex items-center gap-2">
                    {pet.good_with_kids ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-300" />
                    )}
                    <span className="text-sm text-gray-700">Good with kids</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pet.good_with_dogs ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-300" />
                    )}
                    <span className="text-sm text-gray-700">Good with dogs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pet.good_with_cats ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-300" />
                    )}
                    <span className="text-sm text-gray-700">Good with cats</span>
                  </div>
                </div>

                {pet.special_needs && (
                  <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Special Needs</h4>
                        <p className="text-sm text-gray-700">{pet.special_needs}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-3 border-black rounded-xl p-5 shadow-neo-sm">
                <h3 className="font-display font-bold text-lg mb-3">Journey Timeline</h3>
                <div className="space-y-3">
                  {timeline.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sage-100 border-2 border-sage-300 rounded-lg flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-sage-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-600">
                          {item.date ? new Date(item.date).toLocaleDateString() : 'Date unavailable'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pet.shelter_name && (
                <div className="bg-white border-3 border-black rounded-xl p-5 shadow-neo-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-gray-600" />
                    <h3 className="font-display font-bold text-lg">Location</h3>
                  </div>
                  <p className="text-gray-700">{pet.shelter_name}</p>
                </div>
              )}

              <button className="w-full py-4 bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold rounded-xl border-3 border-black shadow-neo hover:shadow-neo-sm transition-all">
                Start Adoption Process
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
