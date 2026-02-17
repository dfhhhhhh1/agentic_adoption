import { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizAnswers } from '../../lib/types';

interface MatchingQuizProps {
  onComplete: (query: string) => void;
  onClose: () => void;
}

const questions = [
  {
    id: 'living_situation',
    question: 'What is your living situation?',
    options: ['Apartment', 'House with small yard', 'House with large yard', 'Farm/Rural'],
  },
  {
    id: 'home_size',
    question: 'How would you describe your home size?',
    options: ['Small (Studio/1BR)', 'Medium (2-3BR)', 'Large (4+BR)', 'Very spacious'],
  },
  {
    id: 'yard',
    question: 'Do you have a yard?',
    options: ['No yard', 'Small yard', 'Large yard', 'Multiple acres'],
  },
  {
    id: 'experience',
    question: 'What is your pet ownership experience?',
    options: ['First-time owner', 'Some experience', 'Very experienced', 'Professional'],
  },
  {
    id: 'activity_level',
    question: 'How active are you?',
    options: ['Low activity', 'Moderate activity', 'Very active', 'Extremely active'],
  },
  {
    id: 'time_commitment',
    question: 'How much time can you dedicate daily?',
    options: ['Limited (1-2 hours)', 'Moderate (3-4 hours)', 'Plenty (5-6 hours)', 'Full-time'],
  },
  {
    id: 'other_pets',
    question: 'Do you have other pets?',
    options: ['No other pets', 'Have dogs', 'Have cats', 'Have multiple pets'],
  },
  {
    id: 'children',
    question: 'Do you have children?',
    options: ['No children', 'Young children (0-5)', 'School-age (6-12)', 'Teenagers (13+)'],
  },
];

export function MatchingQuiz({ onComplete, onClose }: MatchingQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: answer });
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      const query = buildQuery(answers);
      onComplete(query);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const buildQuery = (answers: Record<string, string>): string => {
    const parts = [
      `I live in ${answers.living_situation?.toLowerCase() || 'an apartment'}`,
      `with ${answers.home_size?.toLowerCase() || 'limited space'}`,
      `and ${answers.yard?.toLowerCase() || 'no yard'}.`,
      `I am ${answers.experience?.toLowerCase() || 'a first-time owner'}`,
      `with ${answers.activity_level?.toLowerCase() || 'moderate activity'}`,
      `and can dedicate ${answers.time_commitment?.toLowerCase() || 'limited time'} to a pet.`,
    ];

    if (answers.other_pets !== 'No other pets') {
      parts.push(`I ${answers.other_pets?.toLowerCase() || 'have other pets'}.`);
    }

    if (answers.children !== 'No children') {
      parts.push(`I ${answers.children?.toLowerCase() || 'have children'}.`);
    }

    return parts.join(' ');
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border-4 border-black rounded-2xl shadow-neo-lg max-w-2xl w-full overflow-hidden"
      >
        <div className="bg-gradient-to-r from-sage-500 to-sage-600 px-6 py-4 border-b-4 border-black">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-white" />
              <h2 className="text-xl font-display font-bold text-white">AI Matching Quiz</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="relative h-2 bg-sage-300 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 left-0 bg-white rounded-full"
            />
          </div>
          <p className="text-sage-100 text-sm mt-2">
            Question {currentStep + 1} of {questions.length}
          </p>
        </div>

        <div className="p-8 min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <h3 className="text-2xl font-display font-bold text-gray-900 mb-6">
                {currentQuestion.question}
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className={`
                      p-4 rounded-xl border-3 transition-all text-left font-medium
                      ${
                        answers[currentQuestion.id] === option
                          ? 'bg-sage-500 text-white border-black shadow-neo'
                          : 'bg-white border-gray-300 hover:border-sage-300 hover:bg-sage-50'
                      }
                    `}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`
                px-6 py-3 rounded-lg border-2 border-black font-semibold flex items-center gap-2
                ${
                  currentStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50 shadow-neo-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                }
              `}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!answers[currentQuestion.id]}
              className={`
                px-6 py-3 rounded-lg border-2 border-black font-semibold flex items-center gap-2
                ${
                  answers[currentQuestion.id]
                    ? 'bg-terracotta-500 text-white hover:bg-terracotta-600 shadow-neo-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {currentStep === questions.length - 1 ? 'Find Matches' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
