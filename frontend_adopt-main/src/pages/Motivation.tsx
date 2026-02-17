import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, TrendingUp, BookOpen, X } from 'lucide-react';

interface RegionData {
  title: string;
  body: string;
}

interface RegionDataMap {
  [key: string]: RegionData;
}

export function Motivation() {
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [showCities, setShowCities] = useState(true);
  const [showMills, setShowMills] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  const regionData: RegionDataMap = {
    nw: {
      title: "Northwest Missouri",
      body: "<strong>Status:</strong> Moderate risk. Mix of small rural shelters with limited resources. Low population density means fewer adopters and minimal spay/neuter access. Some counties have no dedicated animal shelter — strays are handled by county sheriff's office. <strong>Key need:</strong> Mobile spay/neuter clinics, transport networks to metro areas."
    },
    ne: {
      title: "Northeast Missouri",
      body: "<strong>Status:</strong> Moderate risk. Agricultural region with high stray intake and few adoption resources. Limited veterinary infrastructure. Some shelters operate on shoestring budgets with volunteer-only staff. <strong>Key need:</strong> Telehealth vet support, digital adoption platforms to connect with metro adopters."
    },
    kc: {
      title: "Kansas City Metro",
      body: "<strong>Status:</strong> Near no-kill. KC Pet Project achieved <strong>93.7% live-release rate</strong> in 2024 — up from 30% in 2008. Serves 509K residents, processes 40-60 animals daily across 14 locations. A national model for progressive sheltering. <strong>Challenge:</strong> Overcrowding crisis emerging in 2025 as intake outpaces outcomes. Cost of vet care rising."
    },
    central: {
      title: "Central Missouri (Columbia/Jeff City)",
      body: "<strong>Status:</strong> Moderate-good. Home to University of Missouri vet school, providing some resource advantage. Central MO Humane Society and local SPAYs serve the region. <strong>Challenge:</strong> Surrounding rural counties still lack affordable services. Shelter intake remains high from surrounding areas with no shelters."
    },
    stl: {
      title: "St. Louis Metro",
      body: "<strong>Status:</strong> Improving. St. Louis City went from <strong>58% euthanasia to 9%</strong> after partnering with Stray Rescue. Humane Society of Missouri is the state's largest shelter system. St. Louis County's new animal care center still working to improve save rates. <strong>Key strength:</strong> Strong rescue network and foster community."
    },
    sw: {
      title: "Southwest Missouri (Joplin Area)",
      body: "<strong>Status:</strong> HIGH CRISIS. The <strong>Hunte Corporation</strong> in Goodman, MO (SW corner) is the nation's largest puppy broker — handling ~90,000 puppies/year. SW Missouri is the hub of the puppy industry. Joplin-area shelters overwhelmed with surrendered mill dogs and strays. <strong>Key need:</strong> Enforcement, breeding regulation, rescue networks."
    },
    ozarks: {
      title: "Ozarks Region (S-Central Missouri)",
      body: "<strong>Status:</strong> CRITICAL. The <strong>highest concentration of puppy mills</strong> in the nation. Hills and hollows provide cover for operations evading inspection. In 2025, nearly 20 of Missouri's 26 Horrible Hundred mills are here — in Dora, West Plains, Wasola, Niangua, Cabool, Bolivar, Pleasant Hope, and more. Extremely limited spay/neuter access. <strong>Key need:</strong> Tech-driven mapping, inspection support, mass spay/neuter programs."
    },
    se: {
      title: "Southeast Missouri (Bootheel)",
      body: "<strong>Status:</strong> High risk. One of Missouri's poorest regions with very limited veterinary access. Cape Girardeau's SEMO Pets provides SNAP spay/neuter program but coverage is sparse across the vast rural Bootheel. High stray populations, minimal shelter infrastructure. <strong>Key need:</strong> Mobile clinics, community cat programs, transport to larger shelters."
    }
  };

  const handleRegionClick = (region: string) => {
    setActiveRegion(activeRegion === region ? null : region);
  };

  const stateData = [
    { state: 'TX', name: 'Texas', gap: '~86K gap', width: '80%', color: 'bg-red-600' },
    { state: 'CA', name: 'California', gap: '~62K gap', width: '65%', color: 'bg-red-500' },
    { state: 'NC', name: 'N. Carolina', gap: '~35K gap', width: '42%', color: 'bg-amber-500' },
    { state: 'FL', name: 'Florida', gap: '~29K gap', width: '35%', color: 'bg-amber-500' },
    { state: 'LA', name: 'Louisiana', gap: '~23K gap', width: '28%', color: 'bg-amber-600' },
    { state: 'MO', name: 'Missouri', gap: '~12K gap*', width: '18%', color: 'bg-terracotta-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-display font-bold mb-3 bg-gradient-to-r from-terracotta-400 to-amber-400 bg-clip-text text-transparent">
            PawMatch AI — Missouri Geographic Mapping
          </h1>
          <p className="text-gray-300 max-w-3xl mx-auto text-base leading-relaxed">
            Missouri faces a <strong className="text-white">12,000-animal shelter gap</strong> and leads the nation in puppy mills. Rural regions lack veterinary care, while metros approach no-kill. <strong className="text-white">PawMatch AI</strong> can bridge these divides — connecting adopters, shelters, and resources across geography.
          </p>
        </motion.div>

        {/* Map and Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-7 mb-10">
          {/* Map Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 relative overflow-hidden"
          >
            {/* Orange glow effect */}
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-terracotta-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h2 className="font-display text-2xl text-white mb-4 flex items-center gap-2">
                <MapPin className="w-6 h-6" />
                Missouri Regions
              </h2>

              {/* Layer Controls */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setShowRegions(!showRegions)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-black transition-all ${
                    showRegions
                      ? 'bg-sage-500 text-white shadow-neo-sm'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Regions
                </button>
                <button
                  onClick={() => setShowCities(!showCities)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-black transition-all ${
                    showCities
                      ? 'bg-sage-500 text-white shadow-neo-sm'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Cities
                </button>
                <button
                  onClick={() => setShowMills(!showMills)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-black transition-all ${
                    showMills
                      ? 'bg-red-500 text-white shadow-neo-sm'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Puppy Mills
                </button>
              </div>

              {/* SVG Map */}
              <div className="relative w-full">
                <svg viewBox="0 0 800 600" className="w-full h-auto">
                  {/* Regions */}
                  <g style={{ opacity: showRegions ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                    {/* Northwest */}
                    <path
                      data-region="nw"
                      onClick={() => handleRegionClick('nw')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'nw' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#1B5E3A"
                      stroke={activeRegion === 'nw' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'nw' ? '2.5' : '1'}
                      d="M 50,50 L 300,50 L 300,200 L 50,200 Z"
                    />
                    {/* Northeast */}
                    <path
                      data-region="ne"
                      onClick={() => handleRegionClick('ne')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'ne' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#1A5048"
                      stroke={activeRegion === 'ne' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'ne' ? '2.5' : '1'}
                      d="M 500,50 L 750,50 L 750,200 L 500,200 Z"
                    />
                    {/* Kansas City */}
                    <path
                      data-region="kc"
                      onClick={() => handleRegionClick('kc')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'kc' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#0D9488"
                      stroke={activeRegion === 'kc' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'kc' ? '2.5' : '1'}
                      d="M 300,50 L 500,50 L 500,200 L 300,200 Z"
                    />
                    {/* Central */}
                    <path
                      data-region="central"
                      onClick={() => handleRegionClick('central')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'central' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#2D5A27"
                      stroke={activeRegion === 'central' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'central' ? '2.5' : '1'}
                      d="M 200,200 L 550,200 L 550,350 L 200,350 Z"
                    />
                    {/* St. Louis */}
                    <path
                      data-region="stl"
                      onClick={() => handleRegionClick('stl')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'stl' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#155E75"
                      stroke={activeRegion === 'stl' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'stl' ? '2.5' : '1'}
                      d="M 550,200 L 750,200 L 750,400 L 550,400 Z"
                    />
                    {/* Southwest */}
                    <path
                      data-region="sw"
                      onClick={() => handleRegionClick('sw')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'sw' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#991B1B"
                      stroke={activeRegion === 'sw' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'sw' ? '2.5' : '1'}
                      d="M 50,350 L 200,350 L 200,550 L 50,550 Z"
                    />
                    {/* Ozarks */}
                    <path
                      data-region="ozarks"
                      onClick={() => handleRegionClick('ozarks')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'ozarks' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#7F1D1D"
                      stroke={activeRegion === 'ozarks' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'ozarks' ? '2.5' : '1'}
                      d="M 200,350 L 550,350 L 550,550 L 200,550 Z"
                    />
                    {/* Southeast */}
                    <path
                      data-region="se"
                      onClick={() => handleRegionClick('se')}
                      className={`cursor-pointer transition-all duration-300 ${
                        activeRegion === 'se' ? 'brightness-140' : 'hover:brightness-130'
                      }`}
                      fill="#92400E"
                      stroke={activeRegion === 'se' ? '#E8763A' : '#2A2E3E'}
                      strokeWidth={activeRegion === 'se' ? '2.5' : '1'}
                      d="M 550,400 L 750,400 L 750,550 L 550,550 Z"
                    />
                  </g>

                  {/* Cities */}
                  {showCities && (
                    <g>
                      <circle cx="380" cy="125" r="5" fill="#E8763A" stroke="white" strokeWidth="1.5" className="cursor-pointer hover:r-7 transition-all" />
                      <text x="380" y="145" fill="white" fontSize="9" fontWeight="600" textAnchor="middle">Kansas City</text>
                      
                      <circle cx="665" cy="290" r="5" fill="#E8763A" stroke="white" strokeWidth="1.5" className="cursor-pointer hover:r-7 transition-all" />
                      <text x="665" y="310" fill="white" fontSize="9" fontWeight="600" textAnchor="middle">St. Louis</text>
                      
                      <circle cx="375" cy="275" r="4" fill="#E8763A" stroke="white" strokeWidth="1.5" className="cursor-pointer hover:r-7 transition-all" />
                      <text x="375" y="292" fill="white" fontSize="8" fontWeight="600" textAnchor="middle">Columbia</text>
                      
                      <circle cx="150" cy="435" r="4" fill="#E8763A" stroke="white" strokeWidth="1.5" className="cursor-pointer hover:r-7 transition-all" />
                      <text x="150" y="452" fill="white" fontSize="8" fontWeight="600" textAnchor="middle">Joplin</text>
                      
                      <circle cx="375" cy="460" r="4" fill="#E8763A" stroke="white" strokeWidth="1.5" className="cursor-pointer hover:r-7 transition-all" />
                      <text x="375" y="477" fill="white" fontSize="8" fontWeight="600" textAnchor="middle">Springfield</text>
                    </g>
                  )}

                  {/* Puppy Mills */}
                  {showMills && (
                    <g>
                      <circle cx="130" cy="490" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="340" cy="490" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="390" cy="480" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="310" cy="470" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="280" cy="450" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="420" cy="460" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="360" cy="430" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="150" cy="460" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="180" cy="485" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                      <circle cx="250" cy="500" r="3.5" fill="#EF4444" opacity="0.7" className="cursor-pointer hover:opacity-100 hover:r-5 transition-all" />
                    </g>
                  )}
                </svg>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-terracotta-500" />
                  <span>Cities</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Puppy Mills</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-teal-600" />
                  <span>No-Kill</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-green-800" />
                  <span>Moderate</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-red-900" />
                  <span>Crisis</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* Stats Cards */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-terracotta-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-terracotta-500/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-terracotta-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Shelter Gap</div>
                  <div className="font-display text-2xl text-white">12,000+</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Missouri needs to save <strong className="text-white">12,000 more animals/year</strong> to reach no-kill (90%+ save rate). Currently at ~82% statewide.
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-terracotta-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Puppy Mills</div>
                  <div className="font-display text-2xl text-white">#1 State</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Missouri leads the nation for <strong className="text-white">13 consecutive years</strong> in HSUS's "Horrible Hundred" report. 26 of 100 worst mills (2025) are in Missouri.
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-terracotta-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Geographic Divide</div>
                  <div className="font-display text-2xl text-white">5×</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Rural euthanasia rates are <strong className="text-white">5× higher</strong> than metro areas. KC and STL near no-kill, while Ozarks face crisis-level conditions.
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-terracotta-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Vet Shortage</div>
                  <div className="font-display text-2xl text-white">73%</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-white">73%</strong> of shelters report vet shortages. <strong className="text-white">91%</strong> have spay/neuter backlogs. <strong className="text-white">53%</strong> of shelter vets considering leaving within 3 years.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Region Detail Modal */}
        {activeRegion && regionData[activeRegion] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setActiveRegion(null)}
          >
            <div
              className="bg-gray-800 border-3 border-terracotta-500 rounded-2xl p-6 max-w-2xl w-full shadow-neo-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-display text-2xl text-white">{regionData[activeRegion].title}</h3>
                <button
                  onClick={() => setActiveRegion(null)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div
                className="text-sm text-gray-300 leading-relaxed [&>strong]:text-white [&>strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: regionData[activeRegion].body }}
              />
            </div>
          </motion.div>
        )}

        {/* National Context Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
          >
            <h3 className="font-display text-xl text-white mb-2">📊 Top States: Share of National Euthanasia</h3>
            <p className="text-sm text-gray-400 mb-4">
              Five states account for <strong className="text-white">44–52%</strong> of all shelter euthanasia nationally. Missouri is not in the top 5, but its rural areas and puppy mill legacy create concentrated crisis zones.
            </p>

            <div className="space-y-3">
              {stateData.map((state, index) => (
                <motion.div
                  key={state.state}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-white font-bold text-sm w-8">{state.state}</span>
                  <div className="flex-1 h-8 bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: state.width }}
                      transition={{ delay: 0.6 + index * 0.05, duration: 0.8, ease: 'easeOut' }}
                      className={`h-full ${state.color} flex items-center px-3`}
                    >
                      <span className="text-white text-xs font-semibold">{state.name}</span>
                    </motion.div>
                  </div>
                  <span className="text-gray-400 text-xs w-20 text-right">{state.gap}</span>
                </motion.div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              * Missouri's gap is concentrated in rural/Ozark regions. Metro KC and STL shelter near no-kill.
              <br />Source: Best Friends Animal Society 2024 Lifesaving Data; Newsweek analysis, April 2025.
            </p>
          </motion.div>

          {/* Data Sources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
          >
            <h3 className="font-display text-xl text-white mb-4">📚 Data Sources & References</h3>
            <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
              <li>
                <strong className="text-white">Best Friends Animal Society</strong> — 2024 National Dataset & Missouri Dashboard. Save rates, no-kill status, shelter counts.{' '}
                <a href="https://bestfriends.org/no-kill/animal-shelter-statistics/missouri" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  bestfriends.org/missouri
                </a>
              </li>
              <li>
                <strong className="text-white">HSUS "Horrible Hundred"</strong> — 2024 & 2025 Reports. Missouri #1 for 13 consecutive years, 26 of 100 mills in MO (2025).{' '}
                <a href="https://www.humaneworld.org/en/horrible-hundred" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  humaneworld.org
                </a>
              </li>
              <li>
                <strong className="text-white">ASPCA</strong> — MO has 3,000+ commercial breeding facilities (20%+ of nationwide). Exports 40%+ of pet store puppies.{' '}
                <a href="https://aspca.org" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  aspca.org
                </a>
              </li>
              <li>
                <strong className="text-white">Shelter Animals Count</strong> — 2024 State-Level Data. Intake, adoptions, euthanasia by state.{' '}
                <a href="https://shelteranimalscount.org/state-level-data/" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  shelteranimalscount.org
                </a>
              </li>
              <li>
                <strong className="text-white">KC Pet Project</strong> — 93.7% live-release rate (2024). Serves 16,000+ animals/year.{' '}
                <a href="https://kcpetproject.org/about/no-kill/" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  kcpetproject.org
                </a>
              </li>
              <li>
                <strong className="text-white">Univ. of Florida Shelter Medicine</strong> — Rural vs urban disparities: rural euthanasia 5× higher; intake 2.6× higher per capita.{' '}
                <a href="https://sheltermedicine.vetmed.ufl.edu" target="_blank" rel="noopener noreferrer" className="text-terracotta-400 hover:text-terracotta-300 underline">
                  sheltermedicine.vetmed.ufl.edu
                </a>
              </li>
              <li>
                <strong className="text-white">Petco Love / UF Study</strong> — 73% of shelters short-staffed for vets; 91% have spay/neuter backlogs. Shortage projected 10+ more years.
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
