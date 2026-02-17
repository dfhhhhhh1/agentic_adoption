import { useState } from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AICommandBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function AICommandBar({ onSearch, isLoading = false }: AICommandBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const suggestions = [
    'I live in a small apartment and work from home',
    'Looking for a high-energy companion for hiking',
    'First-time owner seeking a calm, friendly pet',
    'Need a pet good with kids and other animals',
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <form onSubmit={handleSubmit} className="relative">
          <div
            className={`
              relative bg-white border-4 transition-all duration-200
              ${
                isFocused
                  ? 'border-sage-500 shadow-neo-lg'
                  : 'border-black shadow-neo'
              }
              rounded-2xl overflow-hidden
            `}
          >
            <div className="flex items-center px-6 py-4">
              <div className="flex-shrink-0 mr-4">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 text-sage-500 animate-spin" />
                ) : (
                  <Sparkles className="w-6 h-6 text-sage-500" />
                )}
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Tell me what kind of companion you're looking for..."
                className="flex-1 text-lg font-medium outline-none bg-transparent placeholder:text-gray-400"
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className={`
                  ml-4 px-6 py-3 rounded-lg font-semibold border-2 border-black
                  transition-all duration-200 flex items-center gap-2
                  ${
                    query.trim() && !isLoading
                      ? 'bg-terracotta-500 text-white hover:bg-terracotta-600 shadow-neo-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            <div className="bg-gradient-to-r from-sage-100 to-terracotta-50 px-6 py-3 border-t-2 border-gray-200">
              <p className="text-sm text-gray-600 mb-2 font-medium">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setQuery(suggestion)}
                    className="px-3 py-1 bg-white border-2 border-black rounded-lg text-xs font-medium hover:bg-sage-50 transition-colors shadow-neo-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-center"
        >
          <p className="text-sm text-gray-600">
            Powered by{' '}
            <span className="font-semibold text-sage-600">Agentic AI</span> - Understanding your needs, not just keywords
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
