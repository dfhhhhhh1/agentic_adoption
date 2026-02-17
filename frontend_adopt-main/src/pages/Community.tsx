import { MapPin, Navigation, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function Community() {
  const features = [
    {
      title: 'Lost Pet Alerts',
      description: 'Real-time notifications for lost pets in your area with AI-powered identification',
      icon: AlertCircle,
      color: 'bg-red-100 border-red-300 text-red-700',
    },
    {
      title: 'Shelter Locator',
      description: 'Find nearby shelters, veterinary clinics, and pet services on an interactive map',
      icon: MapPin,
      color: 'bg-sage-100 border-sage-300 text-sage-700',
    },
    {
      title: 'Community Events',
      description: 'Discover adoption events, pet meetups, and community gatherings near you',
      icon: Navigation,
      color: 'bg-terracotta-100 border-terracotta-300 text-terracotta-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-white to-terracotta-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-display font-bold text-gray-900 mb-4">
            Community Map
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your hyper-local hub for pet safety, shelters, and community events
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border-4 border-black rounded-2xl shadow-neo-lg overflow-hidden mb-8"
        >
          <div className="aspect-[16/9] bg-gradient-to-br from-sage-200 to-terracotta-200 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-display font-bold text-gray-900 mb-2">
                Interactive Map Coming Soon
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                We're building an intelligent geospatial platform powered by Mapbox with real-time lost pet alerts and community features.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm hover:shadow-neo transition-all"
            >
              <div
                className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center mb-4 ${feature.color}`}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
