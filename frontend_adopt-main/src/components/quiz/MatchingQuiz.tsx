import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizAnswers } from '../../lib/types';

interface MatchingQuizProps {
  onComplete: (query: string) => void;
  onClose: () => void;
}

const questions = [
  {
    id: 'pet_preference',
    question: 'What kind of pet are you hoping to adopt?',
    options: [
      { label: 'Dog', desc: 'Puppies, adults, or seniors' },
      { label: 'Cat', desc: 'Kittens, adults, or seniors' },
      { label: 'Small Animal', desc: 'Rabbits, Guinea Pigs, Hamsters' },
      { label: 'Open to anything!', desc: 'Match me based on my lifestyle' }
    ],
  },
  {
    id: 'home_environment',
    question: 'What best describes your home?',
    options: [
      { label: 'Apartment/Condo', desc: 'No private yard space' },
      { label: 'House (Unfenced)', desc: 'Yard, but requires leash walking' },
      { label: 'House (Fenced)', desc: 'Secure outdoor space to roam' },
      { label: 'Rural / Acreage', desc: 'Lots of wide open space' }
    ],
  },
  {
    id: 'alone_time',
    question: 'How often will the pet be left completely alone?',
    options: [
      { label: 'Rarely', desc: 'Someone is usually home (WFH/Retired)' },
      { label: 'Part-time', desc: 'Alone for 4-6 hours a day' },
      { label: 'Full workday', desc: 'Alone for 8+ hours a day' },
      { label: 'Varies widely', desc: 'Unpredictable schedule' }
    ],
  },
  {
    id: 'exercise_provision',
    question: 'How much pet-focused exercise can you provide?',
    options: [
      { label: 'Low', desc: 'Short bathroom walks / indoor play' },
      { label: 'Moderate', desc: 'Daily 30-60 min walks / active play' },
      { label: 'High', desc: 'Long daily hikes, runs, or dog parks' },
      { label: 'Very High', desc: 'Working breeds, agility, farm work' }
    ],
  },
  {
    id: 'experience',
    question: 'What is your pet ownership experience?',
    options: [
      { label: 'First-time owner', desc: 'Never owned this type of pet' },
      { label: 'Some experience', desc: 'Have owned pets in the past' },
      { label: 'Very experienced', desc: 'Comfortable with training needs' },
      { label: 'Expert', desc: 'Comfortable with behavioral/medical issues' }
    ],
  },
  {
    id: 'other_pets',
    question: 'Do you currently have other pets?',
    options: ['No other pets', 'Yes, Dog(s)', 'Yes, Cat(s)', 'Yes, Multiple types'],
  },
  {
    id: 'children',
    question: 'Are there children in the home?',
    options: ['No children', 'Young children (0-5)', 'School-age (6-12)', 'Teenagers (13+)'],
  },
];
export function MatchingQuiz({ onComplete, onClose }: MatchingQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  // Auto-advance logic
  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    
    // Small delay so user sees their selection before it slides away
    if (currentStep < questions.length - 1) {
      setTimeout(() => {
        setDirection(1);
        setCurrentStep(prev => prev + 1);
      }, 400);
    }
  };

  const handleFinish = () => {
    const query = buildQuery(answers);
    onComplete(query);
  };
  const buildQuery = (ans: Record<string, string>): string => {
    // Structured clear prompt for the LLM
    return `
      Act as an expert pet adoption counselor. Based on the following user profile, recommend 3 specific breeds or types of pets that would be a perfect match, and explain why.
      
      User Profile:
      - Desired Pet: ${ans.pet_preference}
      - Home Environment: ${ans.home_environment}
      - Pet's Alone Time: ${ans.alone_time}
      - Exercise/Activity Provided: ${ans.exercise_provision}
      - Owner Experience Level: ${ans.experience}
      - Household Context: Other pets: ${ans.other_pets} | Children: ${ans.children}
      
      Please include any potential challenges the user might face with your recommendations based on their lifestyle.
    `.trim().replace(/\s+/g, ' '); // Keep the replace if you want it on one line, though LLMs handle line breaks perfectly fine!
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-sage-500 px-6 py-6 border-b-4 border-black relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-5 h-5 text-sage-600" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Matchmaker</h2>
          </div>

          <div className="h-4 bg-black/20 rounded-full border-2 border-black overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-white border-r-2 border-black"
            />
          </div>
        </div>

        <div className="p-8">
          <div className="min-h-[320px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                initial={{ x: direction > 0 ? 50 : -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -50 : 50, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <span className="text-sage-600 font-bold text-sm uppercase tracking-widest">
                  Step {currentStep + 1} of {questions.length}
                </span>
                <h3 className="text-3xl font-black text-black mt-2 mb-8 leading-tight">
                  {currentQuestion.question}
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {currentQuestion.options.map((option) => {
                    const label = typeof option === 'string' ? option : option.label;
                    const isSelected = answers[currentQuestion.id] === label;
                    
                    return (
                      <button
                        key={label}
                        onClick={() => handleAnswer(label)}
                        className={`
                          group p-4 rounded-2xl border-4 transition-all text-left
                          ${isSelected 
                            ? 'bg-sage-500 border-black translate-x-1 translate-y-1 shadow-none' 
                            : 'bg-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:bg-sage-50'
                          }
                        `}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-black'}`}>
                              {label}
                            </p>
                            {typeof option !== 'string' && (
                              <p className={`text-sm ${isSelected ? 'text-sage-100' : 'text-gray-500'}`}>
                                {option.desc}
                              </p>
                            )}
                          </div>
                          {isSelected && <Sparkles className="w-5 h-5 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={() => { setDirection(-1); setCurrentStep(s => s - 1); }}
              disabled={currentStep === 0}
              className="flex items-center gap-2 font-bold uppercase text-sm disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>

            {currentStep === questions.length - 1 && (
              <button
                onClick={handleFinish}
                disabled={!answers[currentQuestion.id]}
                className="bg-orange-400 px-8 py-3 rounded-xl border-4 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                Find My Match
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}