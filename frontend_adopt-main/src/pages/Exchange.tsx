import { Gift, Package, Heart, MessageCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export function Exchange() {
  const categories = [
    { name: 'Pet Food', icon: Package, count: 24 },
    { name: 'Supplies & Gear', icon: Gift, count: 18 },
    { name: 'Medical Items', icon: Heart, count: 12 },
    { name: 'Toys & Accessories', icon: Users, count: 31 },
  ];

  const mockPosts = [
    {
      id: 1,
      type: 'offer',
      title: 'Free Dog Food - 20lb Bag',
      description: 'My dog switched brands. Nearly full bag of premium kibble, expires in 6 months.',
      user: 'Sarah M.',
      badge: 'Verified Donor',
      location: 'Downtown',
      category: 'Pet Food',
    },
    {
      id: 2,
      type: 'request',
      title: 'Need Cat Carrier for Vet Visit',
      description: 'Looking to borrow a cat carrier for a vet appointment next week. Can pick up/return.',
      user: 'James K.',
      badge: 'Community Helper',
      location: 'Northside',
      category: 'Supplies & Gear',
    },
    {
      id: 3,
      type: 'offer',
      title: 'Gently Used Pet Crate',
      description: 'Medium-sized crate, great condition. My pup outgrew it.',
      user: 'Maria L.',
      badge: 'Verified Donor',
      location: 'West End',
      category: 'Supplies & Gear',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-white to-terracotta-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-display font-bold text-gray-900 mb-4">
            Community Exchange
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            A circular economy for pet essentials. Give what you can, request what you need.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border-3 border-black rounded-xl p-4 shadow-neo-sm hover:shadow-neo transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-sage-100 border-2 border-sage-300 rounded-lg flex items-center justify-center">
                  <category.icon className="w-5 h-5 text-sage-600" />
                </div>
                <span className="font-bold text-2xl text-gray-900">{category.count}</span>
              </div>
              <p className="font-semibold text-gray-700 text-sm">{category.name}</p>
            </motion.button>
          ))}
        </motion.div>

        <div className="flex gap-4 mb-8">
          <button className="flex-1 px-6 py-4 bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white rounded-xl border-3 border-black shadow-neo hover:shadow-neo-sm hover:translate-x-1 hover:translate-y-1 transition-all font-bold flex items-center justify-center gap-2">
            <Gift className="w-5 h-5" />
            Offer Items
          </button>
          <button className="flex-1 px-6 py-4 bg-white text-gray-700 rounded-xl border-3 border-black shadow-neo hover:shadow-neo-sm hover:translate-x-1 hover:translate-y-1 transition-all font-bold flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Request Help
          </button>
        </div>

        <div className="space-y-4">
          {mockPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm hover:shadow-neo transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-black ${
                        post.type === 'offer'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {post.type === 'offer' ? 'Offering' : 'Requesting'}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                      {post.category}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-gray-900 mb-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-700 mb-3">{post.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-sage-500 border-2 border-black rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {post.user.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{post.user}</p>
                        <p className="text-xs text-sage-600">{post.badge}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.location}</span>
                    </div>
                  </div>
                </div>
                <button
                  className={`
                    px-6 py-3 rounded-lg border-2 border-black font-semibold transition-all
                    ${
                      post.type === 'offer'
                        ? 'bg-terracotta-500 text-white hover:bg-terracotta-600'
                        : 'bg-sage-500 text-white hover:bg-sage-600'
                    }
                    shadow-neo-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none
                  `}
                >
                  {post.type === 'offer' ? "I'm Interested" : 'I Can Help'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-6 bg-gradient-to-r from-sage-100 to-terracotta-100 border-3 border-black rounded-xl shadow-neo-sm text-center"
        >
          <Heart className="w-12 h-12 text-sage-600 mx-auto mb-3" />
          <h3 className="font-display font-bold text-xl text-gray-900 mb-2">
            Building a Caring Community
          </h3>
          <p className="text-gray-700 max-w-2xl mx-auto">
            Every item shared strengthens our community. Join neighbors helping neighbors care for their beloved companions.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
