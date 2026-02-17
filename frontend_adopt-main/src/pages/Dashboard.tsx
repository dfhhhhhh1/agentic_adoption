import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, Heart, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AICommandBar } from '../components/dashboard/AICommandBar';
import { PetCard } from '../components/pet/PetCard';
import { PetDetailModal } from '../components/pet/PetDetailModal';
import { api } from '../lib/api';
import type { Pet, MatchResult } from '../lib/types';

export function Dashboard() {
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  const { data: pets, isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.getPets(),
  });

  const handleSearch = async (query: string) => {
    setIsMatching(true);
    try {
      const results = await api.matchPets({ query, max_results: 12 });
      setMatchResults(results);
    } catch (error) {
      console.error('Match error:', error);
    } finally {
      setIsMatching(false);
    }
  };

  const displayPets = matchResults 
  ? (Array.isArray(matchResults) ? matchResults.map(r => r.pet) : [])
  : (Array.isArray(pets) ? pets : []);
  const getMatchData = (petId: string) => {
    return matchResults?.find(r => r.pet.id === petId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-white to-terracotta-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-display font-bold text-gray-900 mb-4">
            Find Your Perfect Companion
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our agentic AI understands your lifestyle and preferences to find the ideal pet match
          </p>
        </motion.div>

        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12"
          >
            <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sage-100 border-2 border-sage-300 rounded-lg flex items-center justify-center">
                  <Heart className="w-6 h-6 text-sage-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Available Pets</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_pets}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-terracotta-100 border-2 border-terracotta-300 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-terracotta-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Partner Shelters</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_shelters}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 border-2 border-yellow-300 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">98%</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <AICommandBar onSearch={handleSearch} isLoading={isMatching} />

        {matchResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sage-100 border-2 border-sage-300 rounded-lg">
              <Heart className="w-5 h-5 text-sage-600" fill="currentColor" />
              <span className="text-sage-800 font-semibold">
                Found {matchResults.length} perfect matches for you!
              </span>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-sage-500 animate-spin" />
          </div>
        ) : displayPets.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No pets available at the moment</p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayPets.map((pet) => {
              const matchData = getMatchData(pet.id);
              return (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  matchScore={matchData?.match_percentage}
                  reasoning={matchData?.reasoning}
                  onClick={() => setSelectedPet(pet)}
                />
              );
            })}
          </motion.div>
        )}
      </div>

      <PetDetailModal
        pet={selectedPet}
        onClose={() => setSelectedPet(null)}
        matchScore={selectedPet ? getMatchData(selectedPet.id)?.match_percentage : undefined}
        reasoning={selectedPet ? getMatchData(selectedPet.id)?.reasoning : undefined}
      />
    </div>
  );
}
