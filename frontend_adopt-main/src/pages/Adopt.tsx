import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Filter, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PetCard } from '../components/pet/PetCard';
import { PetDetailModal } from '../components/pet/PetDetailModal';
import { MatchingQuiz } from '../components/quiz/MatchingQuiz';
import { api } from '../lib/api';
import type { Pet, MatchResult } from '../lib/types';

export function Adopt() {
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [showQuiz, setShowQuiz] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const { data: pets, isLoading } = useQuery({
    queryKey: ['pets', selectedSpecies],
    queryFn: () => api.getPets(selectedSpecies || undefined),
  });

  const handleQuizComplete = async (query: string) => {
    setShowQuiz(false);
    setIsMatching(true);
    try {
      const results = await api.matchPets({ query, max_results: 15 });
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

  const species = ['dog', 'cat', 'bird', 'rabbit'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-white to-terracotta-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-display font-bold text-gray-900 mb-4">
            Browse & Adopt
          </h1>
          <p className="text-lg text-gray-600">
            Explore all available pets or take our AI matching quiz for personalized recommendations
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <button
            onClick={() => setShowQuiz(true)}
            className="flex-1 sm:flex-none px-6 py-4 bg-gradient-to-r from-sage-500 to-sage-600 text-white rounded-xl border-3 border-black shadow-neo hover:shadow-neo-sm hover:translate-x-1 hover:translate-y-1 transition-all font-bold flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Start Matching Quiz
          </button>

          {matchResults && (
            <button
              onClick={() => {
                setMatchResults(null);
                setSelectedSpecies('');
              }}
              className="px-6 py-4 bg-white text-gray-700 rounded-xl border-3 border-black shadow-neo-sm hover:bg-gray-50 transition-all font-semibold"
            >
              Clear Results
            </button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border-3 border-black rounded-xl p-4 shadow-neo-sm mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-display font-bold text-lg">Filter by Species</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedSpecies('');
                setMatchResults(null);
              }}
              className={`
                px-4 py-2 rounded-lg border-2 border-black font-medium transition-all
                ${
                  selectedSpecies === ''
                    ? 'bg-sage-500 text-white shadow-neo-sm'
                    : 'bg-white hover:bg-gray-50'
                }
              `}
            >
              All
            </button>
            {species.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSelectedSpecies(s);
                  setMatchResults(null);
                }}
                className={`
                  px-4 py-2 rounded-lg border-2 border-black font-medium transition-all capitalize
                  ${
                    selectedSpecies === s
                      ? 'bg-sage-500 text-white shadow-neo-sm'
                      : 'bg-white hover:bg-gray-50'
                  }
                `}
              >
                {s}s
              </button>
            ))}
          </div>
        </motion.div>

        {matchResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 p-4 bg-gradient-to-r from-sage-100 to-sage-200 border-3 border-sage-600 rounded-xl shadow-neo-sm"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-sage-700" />
              <div>
                <h3 className="font-display font-bold text-lg text-gray-900">
                  AI Match Results
                </h3>
                <p className="text-sage-800">
                  Found {matchResults.length} perfect companions based on your preferences
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {isLoading || isMatching ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-sage-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">
              {isMatching ? 'Finding your perfect matches...' : 'Loading pets...'}
            </p>
          </div>
        ) : displayPets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 border-2 border-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-xl text-gray-600">No pets found with current filters</p>
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

      {showQuiz && (
        <MatchingQuiz
          onComplete={handleQuizComplete}
          onClose={() => setShowQuiz(false)}
        />
      )}

      <PetDetailModal
        pet={selectedPet}
        onClose={() => setSelectedPet(null)}
        matchScore={selectedPet ? getMatchData(selectedPet.id)?.match_percentage : undefined}
        reasoning={selectedPet ? getMatchData(selectedPet.id)?.reasoning : undefined}
      />
    </div>
  );
}
