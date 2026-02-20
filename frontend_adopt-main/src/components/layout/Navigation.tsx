import { Home, Heart, Map, MessageCircle, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isApiOnline: boolean;
}

export function Navigation({ activeTab, onTabChange, isApiOnline }: NavigationProps) {
  const tabs = [
    { id: 'home', label: 'Discover', icon: Home },
    { id: 'adopt', label: 'Adopt', icon: Heart },
    { id: 'map', label: 'Community', icon: Map },
    { id: 'motivation', label: 'Impact', icon: BarChart3 },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'exchange', label: 'Exchange', icon: MessageCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },

  ];

  return (
    <nav className="bg-white border-b-4 border-black shadow-neo-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-sage-500 border-2 border-black rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-gray-900">PawMatch AI</h1>
              <p className="text-xs text-gray-600">Intelligent Pet Adoption</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 border-2 border-black p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    relative px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2
                    ${
                      activeTab === tab.id
                        ? 'bg-sage-500 text-white border-2 border-black shadow-neo-sm'
                        : 'text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-sage-500 border-2 border-black rounded-md -z-10"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-4 px-3 py-2 bg-gray-50 border-2 border-black rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  isApiOnline ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}
              />
              <span className="text-xs font-medium text-gray-700 hidden md:inline">
                {isApiOnline ? 'API Online' : 'API Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
