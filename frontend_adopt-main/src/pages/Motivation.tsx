import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Home,
  AlertTriangle,
  TrendingUp,
  Users,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  PawPrint,
  Siren,
  Ban,
  HandHeart,
  Brain,
  Undo2,
  Building2,
  DollarSign,
  MapPin,
} from 'lucide-react';

// ── Data ──────────────────────────────────────────────────────────────────────

const HERO_STATS = [
  { value: '94M', label: 'Pet Households', sub: '71% of all U.S. homes', icon: Home },
  { value: '5.8M', label: 'Enter Shelters', sub: 'cats & dogs yearly', icon: AlertTriangle },
  { value: '597K', label: 'Euthanized', sub: 'cats & dogs in 2025', icon: Ban },
  { value: '6%', label: 'Would End It', sub: 'more adopters = no-kill USA', icon: Heart },
];

const SHELTER_FLOW = {
  entering: { value: 5.8, label: 'Entering Shelters', unit: 'M' },
  adopted: { value: 4.2, label: 'Adopted', unit: 'M' },
  euthanized: { value: 0.597, label: 'Euthanized', unit: 'K', display: '597K' },
  returned: { value: '7–20%', label: 'Returns After Adoption' },
};

const WHY_ENTER = [
  { reason: 'Stray', pct: 60, color: 'bg-terracotta-400' },
  { reason: 'Surrendered', pct: 29, color: 'bg-sage-500' },
  { reason: 'Other', pct: 11, color: 'bg-gray-400' },
];

const ACQUISITION_DATA = {
  dogs: [
    { source: 'Breeders', pct: 34, color: 'bg-terracotta-500' },
    { source: 'Shelters', pct: 23, color: 'bg-sage-500' },
    { source: 'Friends/Family', pct: 20, color: 'bg-amber-400' },
    { source: 'Stray', pct: 6, color: 'bg-gray-400' },
  ],
  cats: [
    { source: 'Shelters', pct: 31, color: 'bg-sage-500' },
    { source: 'Friends/Family', pct: 28, color: 'bg-amber-400' },
    { source: 'Stray', pct: 27, color: 'bg-gray-400' },
    { source: 'Breeders', pct: 3, color: 'bg-terracotta-500' },
  ],
};

const MISSOURI_FACTS = [
  {
    icon: Siren,
    title: '#1 in Puppy Mills',
    description: 'Missouri leads the nation for 13+ consecutive years in abusive puppy mill operations.',
    url: 'https://www.humaneworld.org/en/issue/horrible-hundred',
    color: 'terracotta',
  },
  {
    icon: Building2,
    title: '500+ Shelters',
    description: 'Operating statewide with varying levels of resources, data tracking, and no-kill progress.',
    url: 'https://www.causeiq.com/directory/animal-shelters-list/missouri-state/',
    color: 'sage',
  },
  {
    icon: AlertTriangle,
    title: 'Not No-Kill',
    description: 'Missouri has not achieved no-kill status. Many shelters still struggle with overcrowding and limited resources.',
    url: 'https://www.causeiq.com/directory/animal-shelters-list/missouri-state/',
    color: 'terracotta',
  },
];

const IMPACT_CARDS = [
  {
    icon: Heart,
    title: 'Save Animal Lives',
    stat: '597,000',
    detail: 'euthanized in 2025',
    url: 'https://www.shelteranimalscount.org/2025-report/',
    gradient: 'from-terracotta-500 to-terracotta-600',
  },
  {
    icon: DollarSign,
    title: 'Reduce Shelter Costs',
    stat: '$2B+',
    detail: 'per year spent on sheltering',
    url: 'https://www.petradar.org/en/articles/us-animal-shelter-facts-statistics',
    gradient: 'from-sage-500 to-sage-600',
  },
  {
    icon: Brain,
    title: 'Improve Mental Health',
    stat: '96%',
    detail: 'say pets are family',
    url: 'https://www.driveresearch.com/market-research-company-blog/pet-adoption-statistics/',
    gradient: 'from-amber-500 to-amber-600',
  },
  {
    icon: Undo2,
    title: 'Prevent Returns',
    stat: 'Up to 20%',
    detail: 'returned after adoption',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8783015/',
    gradient: 'from-rose-500 to-rose-600',
  },
  {
    icon: Users,
    title: 'Strengthen Communities',
    stat: '71%',
    detail: 'of households own pets',
    url: 'https://worldanimalfoundation.org/advocate/pet-ownership-statistics/',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    icon: Shield,
    title: 'Fight Puppy Mills',
    stat: '10,000+',
    detail: 'estimated mills in USA',
    url: 'https://www.humaneworld.org/en/puppy-mill-research',
    gradient: 'from-purple-500 to-purple-600',
  },
];

const SOURCES = [
  { id: 1, text: 'APPA 2025 State of the Industry Report — 94M pet households, 71% of U.S. homes', url: 'https://worldanimalfoundation.org/advocate/pet-ownership-statistics/' },
  { id: 2, text: 'Drive Research — 96% consider pets family members', url: 'https://www.driveresearch.com/market-research-company-blog/pet-adoption-statistics/' },
  { id: 3, text: 'World Animal Foundation — Pet acquisition sources (shelters, breeders, strays)', url: 'https://worldanimalfoundation.org/advocate/pet-ownership-statistics/' },
  { id: 4, text: 'ASPCA — Why animals enter shelters (stray 60%, surrender 29%)', url: 'https://www.aspca.org/helping-shelters-people-pets/us-animal-shelter-statistics' },
  { id: 5, text: 'Shelter Animals Count 2025 — 5.8M entered, 4.2M adopted, 597K euthanized', url: 'https://www.shelteranimalscount.org/2025-report/' },
  { id: 6, text: 'NIH / PMC — 7–20% adoption return rate', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8783015/' },
  { id: 7, text: 'Humane World — Missouri #1 in puppy mills 13+ years', url: 'https://www.humaneworld.org/en/issue/horrible-hundred' },
  { id: 8, text: 'CauseIQ — 500+ Missouri shelters', url: 'https://www.causeiq.com/directory/animal-shelters-list/missouri-state/' },
  { id: 9, text: 'Best Friends — 6% more adopters would achieve no-kill nationwide', url: 'https://bestfriends.org' },
  { id: 10, text: 'PetRadar — $2B+ annual shelter spending', url: 'https://www.petradar.org/en/articles/us-animal-shelter-facts-statistics' },
  { id: 11, text: 'Humane World — Estimated 10K+ puppy mills in USA', url: 'https://www.humaneworld.org/en/puppy-mill-research' },
];

// ── Helper Components ─────────────────────────────────────────────────────────

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <motion.div
      className={`h-full rounded-full ${color}`}
      initial={{ width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay, ease: 'easeOut' }}
    />
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sage-100 text-sage-700 border-2 border-sage-300">
      {children}
    </span>
  );
}

// ── Funnel Visualization ──────────────────────────────────────────────────────

function ShelterFunnel() {
  const steps = [
    { label: 'Enter Shelters', value: '5.8M', pct: 100, color: 'bg-terracotta-400', border: 'border-terracotta-500' },
    { label: 'Adopted', value: '4.2M', pct: 72, color: 'bg-sage-400', border: 'border-sage-500' },
    { label: 'Euthanized', value: '597K', pct: 10, color: 'bg-red-400', border: 'border-red-500' },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
          className="flex items-center gap-4"
        >
          <div className="w-24 text-right">
            <p className="font-display font-bold text-xl text-gray-900">{step.value}</p>
          </div>
          <div className="flex-1">
            <div className="h-10 bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden">
              <motion.div
                className={`h-full ${step.color} rounded-lg border-r-2 ${step.border} flex items-center justify-end pr-3`}
                initial={{ width: 0 }}
                whileInView={{ width: `${step.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.2, ease: 'easeOut' }}
              >
                <span className="text-xs font-bold text-white drop-shadow-sm">{step.label}</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
      <div className="flex items-center gap-4">
        <div className="w-24 text-right">
          <p className="font-display font-bold text-lg text-gray-600">7–20%</p>
        </div>
        <div className="flex-1">
          <div className="h-8 bg-amber-50 rounded-lg border-2 border-dashed border-amber-300 flex items-center px-3">
            <span className="text-xs font-bold text-amber-700">↩ Returned after adoption</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Acquisition Comparison ────────────────────────────────────────────────────

function AcquisitionChart() {
  const [species, setSpecies] = useState<'dogs' | 'cats'>('dogs');
  const data = ACQUISITION_DATA[species];

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(['dogs', 'cats'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpecies(s)}
            className={`px-4 py-2 rounded-lg border-2 border-black font-bold text-sm transition-all ${
              species === s
                ? 'bg-sage-500 text-white shadow-neo-sm'
                : 'bg-white text-gray-700 hover:bg-sage-50'
            }`}
          >
            {s === 'dogs' ? '🐕 Dogs' : '🐈 Cats'}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={species}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-3"
        >
          {data.map((item, i) => (
            <div key={item.source} className="flex items-center gap-3">
              <span className="w-28 text-sm font-medium text-gray-700 text-right">{item.source}</span>
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                <AnimatedBar pct={item.pct * (100 / 40)} color={item.color} delay={i * 0.1} />
              </div>
              <span className="w-10 text-sm font-bold text-gray-900">{item.pct}%</span>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Motivation() {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sage-800 via-sage-700 to-sage-900 text-white">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>
        {/* Decorative blob */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-terracotta-500 rounded-full opacity-10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sage-300 rounded-full opacity-10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-sm font-medium mb-6">
              <PawPrint className="w-4 h-4" />
              Why This Matters
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4">
              Millions Need a Home.
              <br />
              <span className="text-terracotta-300">We Can Change That.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-sage-200 text-lg">
              Every year, millions of animals enter shelters across the U.S. The data tells a story
              of preventable loss — and a path toward a no-kill future.
            </p>
          </motion.div>

          {/* Hero stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {HERO_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 md:p-5 text-center group hover:bg-white/15 transition-colors"
              >
                <stat.icon className="w-6 h-6 mx-auto mb-2 text-terracotta-300 group-hover:scale-110 transition-transform" />
                <p className="font-display text-2xl md:text-3xl font-bold">{stat.value}</p>
                <p className="text-sm font-semibold text-white/90">{stat.label}</p>
                <p className="text-xs text-sage-300 mt-0.5">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Pet Family Bond ───────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white border-3 border-black rounded-2xl shadow-neo p-6 md:p-10 flex flex-col md:flex-row items-center gap-8"
        >
          <div className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-terracotta-100 to-terracotta-200 border-3 border-black flex items-center justify-center shadow-neo-sm">
            <HandHeart className="w-16 h-16 md:w-20 md:h-20 text-terracotta-500" />
          </div>
          <div>
            <SectionTag>The Bond</SectionTag>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-3">
              <span className="text-terracotta-500">96%</span> of Americans Say Pets Are Family
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              With 94 million households owning a pet — that's 71% of the nation — companion animals are
              woven into the fabric of American life. Yet millions still enter the shelter system every year,
              and hundreds of thousands don't make it out.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://worldanimalfoundation.org/advocate/pet-ownership-statistics/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sage-600 hover:text-sage-800 transition-colors"
              >
                APPA 2025 Report <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-gray-300">•</span>
              <a
                href="https://www.driveresearch.com/market-research-company-blog/pet-adoption-statistics/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sage-600 hover:text-sage-800 transition-colors"
              >
                Drive Research <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Shelter Pipeline & Acquisition ─────────────────────────────── */}
      <section className="bg-sage-50 border-y-3 border-black py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionTag>The Numbers</SectionTag>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3">
              The Shelter Pipeline
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              Where they come from, where they end up, and how many never find a home.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Funnel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white border-3 border-black rounded-2xl shadow-neo p-6"
            >
              <h3 className="font-display font-bold text-lg mb-1">Shelter Outcomes (2025)</h3>
              <p className="text-sm text-gray-500 mb-5">Cats & dogs — Shelter Animals Count</p>
              <ShelterFunnel />
              <a
                href="https://www.shelteranimalscount.org/2025-report/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-sage-600 hover:text-sage-800"
              >
                Source: shelteranimalscount.org <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>

            {/* Why they enter */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white border-3 border-black rounded-2xl shadow-neo p-6 flex flex-col"
            >
              <h3 className="font-display font-bold text-lg mb-1">Why Animals Enter Shelters</h3>
              <p className="text-sm text-gray-500 mb-5">ASPCA national data</p>
              <div className="flex-1 flex flex-col justify-center space-y-4">
                {WHY_ENTER.map((item, i) => (
                  <div key={item.reason}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-700">{item.reason}</span>
                      <span className="text-sm font-bold text-gray-900">{item.pct}%</span>
                    </div>
                    <div className="h-6 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                      <AnimatedBar pct={item.pct} color={item.color} delay={i * 0.15} />
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="https://www.aspca.org/helping-shelters-people-pets/us-animal-shelter-statistics"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-5 text-xs font-semibold text-sage-600 hover:text-sage-800"
              >
                Source: aspca.org <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          </div>

          {/* Acquisition chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-6 bg-white border-3 border-black rounded-2xl shadow-neo p-6"
          >
            <h3 className="font-display font-bold text-lg mb-1">Where People Get Their Pets</h3>
            <p className="text-sm text-gray-500 mb-4">Acquisition sources — World Animal Foundation</p>
            <AcquisitionChart />
            <a
              href="https://worldanimalfoundation.org/advocate/pet-ownership-statistics/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-sage-600 hover:text-sage-800"
            >
              Source: worldanimalfoundation.org <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Missouri Spotlight ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <SectionTag>
            <MapPin className="w-3 h-3" /> Missouri Spotlight
          </SectionTag>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-3">
            The Fight Starts Here
          </h2>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Missouri is ground zero for puppy mills and shelter overcrowding. Here's why local action matters.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {MISSOURI_FACTS.map((fact, i) => (
            <motion.a
              key={fact.title}
              href={fact.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`block p-6 rounded-2xl border-3 border-black shadow-neo-sm hover:shadow-neo hover:-translate-y-1 transition-all ${
                fact.color === 'terracotta' ? 'bg-terracotta-50' : 'bg-sage-50'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center mb-4 ${
                  fact.color === 'terracotta'
                    ? 'bg-terracotta-200 text-terracotta-700'
                    : 'bg-sage-200 text-sage-700'
                }`}
              >
                <fact.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{fact.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{fact.description}</p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-sage-600">
                View source <ExternalLink className="w-3 h-3" />
              </span>
            </motion.a>
          ))}
        </div>
      </section>

      {/* ── What Adoption Solves ────────────────────────────────────────── */}
      <section className="bg-gray-900 text-white py-16 border-y-3 border-black">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 border border-white/20 text-white/80">
              <TrendingUp className="w-3 h-3" /> The Impact
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3">
              What Adoption Solves
            </h2>
            <p className="text-gray-400 mt-2 max-w-xl mx-auto">
              Choosing adoption creates a ripple effect — from saving lives to strengthening communities.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {IMPACT_CARDS.map((card, i) => (
              <motion.a
                key={card.title}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-2xl border-2 border-white/10 p-6 hover:border-white/30 transition-all"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-15 group-hover:opacity-25 transition-opacity`} />
                <div className="relative">
                  <card.icon className="w-8 h-8 mb-3 text-white/70 group-hover:text-white transition-colors" />
                  <p className="font-display text-3xl font-bold mb-1">{card.stat}</p>
                  <h3 className="font-bold text-white/90 mb-1">{card.title}</h3>
                  <p className="text-sm text-white/50">{card.detail}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-white/40 group-hover:text-white/70 transition-colors">
                    Source <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── The 6% Solution CTA ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden bg-gradient-to-br from-sage-600 to-sage-800 rounded-2xl border-3 border-black shadow-neo-lg p-8 md:p-12 text-white text-center"
        >
          <div className="absolute inset-0 opacity-5">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 mb-6">
              <Heart className="w-10 h-10 text-terracotta-300" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Just <span className="text-terracotta-300">6%</span> More Would End It
            </h2>
            <p className="text-sage-200 text-lg max-w-2xl mx-auto mb-6">
              If just 6% more American households chose adoption over purchasing, the entire country
              would achieve no-kill status. That's the gap we're here to close.
            </p>
            <a
              href="https://bestfriends.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta-500 text-white font-bold border-2 border-black shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              Learn More at Best Friends
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Sources ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="bg-white border-3 border-black rounded-2xl shadow-neo-sm overflow-hidden">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <span className="font-display font-bold text-lg">Sources & References</span>
            {sourcesOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          <AnimatePresence>
            {sourcesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t-2 border-gray-100 pt-4">
                  <ol className="space-y-2">
                    {SOURCES.map((src) => (
                      <li key={src.id} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sage-100 text-sage-700 font-bold text-xs flex items-center justify-center border border-sage-200">
                          {src.id}
                        </span>
                        <div>
                          <span className="text-gray-700">{src.text}</span>
                          <br />
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sage-600 hover:text-sage-800 underline underline-offset-2 text-xs break-all"
                          >
                            {src.url}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
