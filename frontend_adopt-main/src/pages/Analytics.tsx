import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Brain,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Heart,
  AlertTriangle,
  Loader2,
  MessageSquareQuote,
  PieChart,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  Dog,
  Cat,
  Bird,
  Activity,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronUp,
  Info,
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// ── Types ────────────────────────────────────────────────────────────────────

interface OverallStats {
  total_responses: number;
  retention_rate: number;
  still_has_pet: number;
  returned_pet: number;
  pet_type_distribution: Record<string, number>;
  gender_distribution: Record<string, number>;
  average_ratings: Record<string, number>;
  behavior_prediction_counts: Record<string, number>;
  behavior_none_count: number;
  shelter_distribution: Record<string, number>;
  nps_score: number;
  satisfaction_tiers: { promoters: number; passives: number; detractors: number };
  return_cases: Array<{ name: string; pet_type: string; shelter: string; comments: string }>;
}

interface ShelterReport {
  total_adoptions: number;
  retention_rate: number;
  shelter_grade: number;
  average_ratings: Record<string, number>;
  pet_type_distribution: Record<string, number>;
  behavior_predictions: Record<string, number>;
  behavior_none_count: number;
  positive_comments: Array<{ name: string; comment: string }>;
  negative_comments: Array<{ name: string; comment: string }>;
  tool_recommendation_rate: number;
}

interface ModelEval {
  total_with_predictions: number;
  total_without_predictions: number;
  behavior_hit_rates: Record<string, { count: number; rate: number }>;
  pet_type_accuracy: Record<string, { total: number; high_match_pct: number; low_match_pct: number }>;
  weakest_areas: Array<{ field: string; label: string; average: number }>;
  strongest_areas: Array<{ field: string; label: string; average: number }>;
  failures: Array<{
    name: string;
    pet_type: string;
    shelter: string;
    still_has_pet: string;
    tool_rating: number;
    shelter_comment: string;
    process_comment: string;
    predicted_behaviors: string;
  }>;
}

interface AIInsights {
  executive_summary?: string;
  model_strengths?: string[];
  model_weaknesses?: string[];
  priority_actions?: string[];
  shelter_insights?: Record<string, string>;
  risk_flags?: string[];
  retention_analysis?: string;
  fallback_mode?: boolean;
}

// ── Utility Components ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'sage',
  trend,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    sage: { bg: 'bg-sage-50', border: 'border-sage-300', icon: 'bg-sage-500', text: 'text-sage-700' },
    terracotta: { bg: 'bg-terracotta-50', border: 'border-terracotta-300', icon: 'bg-terracotta-500', text: 'text-terracotta-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', icon: 'bg-yellow-500', text: 'text-yellow-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'bg-blue-500', text: 'text-blue-700' },
    red: { bg: 'bg-red-50', border: 'border-red-300', icon: 'bg-red-500', text: 'text-red-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-300', icon: 'bg-purple-500', text: 'text-purple-700' },
  };
  const c = colorMap[color] || colorMap.sage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${c.bg} border-3 border-black rounded-xl p-5 shadow-neo-sm hover:shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 ${c.icon} border-2 border-black rounded-lg flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-display font-bold text-gray-900">{value}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
            trend === 'up' ? 'bg-green-100 text-green-700' : trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
          </div>
        )}
      </div>
      {subtext && <p className={`mt-2 text-xs ${c.text} font-medium`}>{subtext}</p>}
    </motion.div>
  );
}

function HorizontalBar({ label, value, max, color = '#5d8560' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs font-semibold text-gray-600 w-44 truncate" title={label}>{label}</span>
      <div className="flex-1 h-7 bg-gray-100 border-2 border-black rounded-md overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold text-gray-700">
          {value}
        </span>
      </div>
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  const getColor = (v: number) => {
    if (v >= 4.5) return '#5d8560';
    if (v >= 3.5) return '#7a9d7e';
    if (v >= 2.5) return '#e18b74';
    return '#c05139';
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-600 w-40 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-gray-100 border border-gray-300 rounded-md overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className="h-full rounded-sm"
          style={{ backgroundColor: getColor(value) }}
        />
      </div>
      <span className="text-sm font-bold text-gray-800 w-10 text-right">{value}/5</span>
    </div>
  );
}

function DonutChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let cumulativeAngle = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const pct = total > 0 ? d.value / total : 0;
          const dashArray = `${pct * circumference} ${circumference}`;
          const rotation = cumulativeAngle * 360 - 90;
          cumulativeAngle += pct;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={24}
              strokeDasharray={dashArray}
              strokeLinecap="butt"
              transform={`rotate(${rotation} ${cx} ${cy})`}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 18} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display font-bold text-xl" fill="#1a1a1a">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-xs font-medium" fill="#6b7280">
          total
        </text>
      </svg>
      <div className="flex flex-wrap gap-3 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-black" style={{ backgroundColor: d.color }} />
            <span className="text-xs font-medium text-gray-600">{d.label} ({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NPSGauge({ score }: { score: number }) {
  // Map NPS from -100..100 to 0..100% for the gauge
  const pct = (score + 100) / 200 * 100;
  const getLabel = (s: number) => {
    if (s >= 70) return { text: 'Excellent', color: 'text-green-600' };
    if (s >= 50) return { text: 'Great', color: 'text-sage-600' };
    if (s >= 30) return { text: 'Good', color: 'text-yellow-600' };
    if (s >= 0) return { text: 'Needs Work', color: 'text-orange-600' };
    return { text: 'Critical', color: 'text-red-600' };
  };
  const label = getLabel(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-48 h-24 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Background arc */}
          <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
          {/* Colored arc */}
          <path
            d="M 10 95 A 90 90 0 0 1 190 95"
            fill="none"
            stroke="url(#npsGradient)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${pct * 2.83} 283`}
          />
          <defs>
            <linearGradient id="npsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c05139" />
              <stop offset="33%" stopColor="#e18b74" />
              <stop offset="66%" stopColor="#7a9d7e" />
              <stop offset="100%" stopColor="#5d8560" />
            </linearGradient>
          </defs>
          <text x="100" y="75" textAnchor="middle" className="font-display font-bold text-3xl" fill="#1a1a1a">
            {score}
          </text>
        </svg>
      </div>
      <p className={`text-sm font-bold ${label.color}`}>{label.text}</p>
      <p className="text-xs text-gray-500">Net Promoter Score</p>
    </div>
  );
}

function ShelterGradeBadge({ grade }: { grade: number }) {
  const getLetter = (g: number) => {
    if (g >= 4.5) return { letter: 'A+', bg: 'bg-sage-500' };
    if (g >= 4.0) return { letter: 'A', bg: 'bg-sage-400' };
    if (g >= 3.5) return { letter: 'B+', bg: 'bg-yellow-500' };
    if (g >= 3.0) return { letter: 'B', bg: 'bg-yellow-400' };
    if (g >= 2.5) return { letter: 'C', bg: 'bg-orange-500' };
    return { letter: 'D', bg: 'bg-red-500' };
  };
  const { letter, bg } = getLetter(grade);

  return (
    <div className={`${bg} w-14 h-14 border-3 border-black rounded-xl flex items-center justify-center shadow-neo-sm`}>
      <span className="text-white font-display font-bold text-xl">{letter}</span>
    </div>
  );
}

// ── Section Components ───────────────────────────────────────────────────────

function OverviewSection({ stats, insights }: { stats: OverallStats; insights: AIInsights }) {
  const petColors: Record<string, string> = { Dog: '#5d8560', Cat: '#d46a4e', Bird: '#eab308' };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {insights.executive_summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-sage-50 to-white border-3 border-black rounded-xl p-6 shadow-neo-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-sage-500 border-2 border-black rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg mb-2">AI Executive Summary</h3>
              <p className="text-gray-700 leading-relaxed">{insights.executive_summary}</p>
              {insights.fallback_mode && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Generated via deterministic analysis (Ollama unavailable)
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Responses" value={stats.total_responses} color="sage" />
        <StatCard
          icon={Heart}
          label="Retention"
          value={`${stats.retention_rate}%`}
          subtext={`${stats.still_has_pet} kept / ${stats.returned_pet} returned`}
          color={stats.retention_rate >= 90 ? 'sage' : 'terracotta'}
          trend={stats.retention_rate >= 90 ? 'up' : 'down'}
        />
        <StatCard
          icon={Target}
          label="NPS Score"
          value={stats.nps_score}
          subtext={stats.nps_score >= 50 ? 'Strong advocacy' : 'Room to grow'}
          color={stats.nps_score >= 50 ? 'sage' : 'yellow'}
        />
        <StatCard
          icon={Star}
          label="Avg Tool Rating"
          value={`${stats.average_ratings.tool_helpfulness}/5`}
          subtext="Tool helpfulness"
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pet Type Distribution */}
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-sage-600" /> Pet Type Distribution
          </h4>
          <DonutChart
            data={Object.entries(stats.pet_type_distribution).map(([label, value]) => ({
              label,
              value,
              color: petColors[label] || '#94a3b8',
            }))}
          />
        </div>

        {/* NPS Gauge */}
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm flex flex-col items-center justify-center">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-sage-600" /> Net Promoter Score
          </h4>
          <NPSGauge score={stats.nps_score} />
          <div className="flex gap-4 mt-4 text-xs font-medium">
            <span className="text-green-600">Promoters: {stats.satisfaction_tiers.promoters}</span>
            <span className="text-gray-500">Passive: {stats.satisfaction_tiers.passives}</span>
            <span className="text-red-500">Detractors: {stats.satisfaction_tiers.detractors}</span>
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-sage-600" /> Gender Distribution
          </h4>
          <DonutChart
            data={Object.entries(stats.gender_distribution).map(([label, value]) => ({
              label,
              value,
              color: label === 'Female' ? '#d46a4e' : label === 'Male' ? '#5d8560' : '#eab308',
            }))}
          />
        </div>
      </div>

      {/* Rating Breakdown */}
      <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
        <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sage-600" /> Rating Breakdown (All Responses)
        </h4>
        <div className="space-y-3">
          {Object.entries(stats.average_ratings)
            .sort(([, a], [, b]) => b - a)
            .map(([key, val]) => (
              <RatingBar key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={val} />
            ))}
        </div>
      </div>
    </div>
  );
}

function ModelEvalSection({ evaluation, insights }: { evaluation: ModelEval; insights: AIInsights }) {
  const [showFailures, setShowFailures] = useState(false);

  const maxBehaviorCount = Math.max(...Object.values(evaluation.behavior_hit_rates).map(b => b.count), 1);

  const behaviorColors = [
    '#5d8560', '#7a9d7e', '#a1bba4', '#d46a4e', '#e18b74',
  ];

  return (
    <div className="space-y-6">
      {/* Prediction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Brain}
          label="Accurate Predictions"
          value={evaluation.total_with_predictions}
          subtext={`${evaluation.total_without_predictions} had no accurate predictions`}
          color="sage"
        />
        <StatCard
          icon={AlertTriangle}
          label="Failure Cases"
          value={evaluation.failures.length}
          subtext="Tool rated ≤2/5"
          color="red"
        />
        <StatCard
          icon={Activity}
          label="Prediction Rate"
          value={`${Math.round((evaluation.total_with_predictions / (evaluation.total_with_predictions + evaluation.total_without_predictions)) * 100)}%`}
          subtext="Respondents with accurate predictions"
          color="blue"
        />
      </div>

      {/* Behavior Prediction Accuracy */}
      <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
        <h4 className="font-display font-bold text-sm mb-1 flex items-center gap-2">
          <Brain className="w-4 h-4 text-sage-600" /> Behavior Prediction Accuracy
        </h4>
        <p className="text-xs text-gray-500 mb-4">How often each behavior was accurately predicted (as validated by adopters)</p>
        <div className="space-y-3">
          {Object.entries(evaluation.behavior_hit_rates).map(([behavior, { count, rate }], i) => (
            <HorizontalBar
              key={behavior}
              label={behavior}
              value={count}
              max={maxBehaviorCount}
              color={behaviorColors[i % behaviorColors.length]}
            />
          ))}
        </div>
      </div>

      {/* Pet Type Accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(evaluation.pet_type_accuracy).map(([pet, acc]) => {
          const IconComp = pet === 'Dog' ? Dog : pet === 'Cat' ? Cat : Bird;
          return (
            <div key={pet} className="bg-white border-3 border-black rounded-xl p-5 shadow-neo-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 border-2 border-black rounded-lg flex items-center justify-center ${
                  pet === 'Dog' ? 'bg-sage-500' : pet === 'Cat' ? 'bg-terracotta-500' : 'bg-yellow-500'
                }`}>
                  <IconComp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h5 className="font-display font-bold">{pet} Adoptions</h5>
                  <p className="text-xs text-gray-500">{acc.total} total</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> High Match
                  </span>
                  <span className="font-bold">{acc.high_match_pct}%</span>
                </div>
                <div className="h-3 bg-gray-100 border border-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-sage-500 rounded-full" style={{ width: `${acc.high_match_pct}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-red-500 font-semibold flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3" /> Low Match
                  </span>
                  <span className="font-bold">{acc.low_match_pct}%</span>
                </div>
                <div className="h-3 bg-gray-100 border border-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${acc.low_match_pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sage-600" /> Strongest Rating Areas
          </h4>
          <div className="space-y-2">
            {evaluation.strongest_areas.map((a) => (
              <RatingBar key={a.field} label={a.field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={a.average} />
            ))}
          </div>
        </div>
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-terracotta-600" /> Weakest Rating Areas
          </h4>
          <div className="space-y-2">
            {evaluation.weakest_areas.map((a) => (
              <RatingBar key={a.field} label={a.field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={a.average} />
            ))}
          </div>
        </div>
      </div>

      {/* Failure Cases */}
      <div className="bg-white border-3 border-black rounded-xl shadow-neo-sm overflow-hidden">
        <button
          onClick={() => setShowFailures(!showFailures)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h4 className="font-display font-bold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Failure Cases ({evaluation.failures.length})
          </h4>
          {showFailures ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <AnimatePresence>
          {showFailures && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-4 space-y-3">
                {evaluation.failures.map((f, i) => (
                  <div key={i} className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="font-bold text-sm">{f.name}</span>
                      <span className="text-xs text-gray-500">— {f.pet_type} from {f.shelter}</span>
                      {f.still_has_pet === 'No' && (
                        <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">RETURNED</span>
                      )}
                    </div>
                    {f.shelter_comment && <p className="text-xs text-gray-600 mb-1"><strong>Shelter:</strong> {f.shelter_comment}</p>}
                    {f.process_comment && <p className="text-xs text-gray-600"><strong>PawMatch:</strong> {f.process_comment}</p>}
                    <p className="text-xs text-gray-400 mt-1">Predicted: {f.predicted_behaviors || 'None'} · Tool rating: {f.tool_rating}/5</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ShelterReportsSection({
  shelterReports,
  shelterInsights,
}: {
  shelterReports: Record<string, ShelterReport>;
  shelterInsights?: Record<string, string>;
}) {
  const [expandedShelter, setExpandedShelter] = useState<string | null>(null);

  const sortedShelters = Object.entries(shelterReports).sort(([, a], [, b]) => b.shelter_grade - a.shelter_grade);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-2">
        Tap any shelter card to expand their full report. These reports can be shared with shelter partners as feedback.
      </p>

      {sortedShelters.map(([name, report]) => {
        const isExpanded = expandedShelter === name;
        return (
          <motion.div
            key={name}
            layout
            className="bg-white border-3 border-black rounded-xl shadow-neo-sm overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedShelter(isExpanded ? null : name)}
              className="w-full px-6 py-5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
            >
              <ShelterGradeBadge grade={report.shelter_grade} />
              <div className="flex-1 min-w-0">
                <h4 className="font-display font-bold text-base truncate">{name}</h4>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                  <span>{report.total_adoptions} adoptions</span>
                  <span>·</span>
                  <span className={report.retention_rate >= 90 ? 'text-sage-600 font-bold' : 'text-terracotta-600 font-bold'}>
                    {report.retention_rate}% retention
                  </span>
                  <span>·</span>
                  <span>{report.tool_recommendation_rate}% recommend tool</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-2xl font-display font-bold text-gray-900">{report.shelter_grade}</p>
                  <p className="text-xs text-gray-400">/5.00</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            {/* Expanded Report */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 space-y-5 border-t-2 border-gray-200 pt-5">
                    {/* AI Insight for this shelter */}
                    {shelterInsights?.[name] && (
                      <div className="bg-sage-50 border-2 border-sage-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-sage-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-sage-800">{shelterInsights[name]}</p>
                        </div>
                      </div>
                    )}

                    {/* Ratings */}
                    <div>
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Rating Breakdown</h5>
                      <div className="space-y-2">
                        {Object.entries(report.average_ratings)
                          .sort(([, a], [, b]) => b - a)
                          .map(([key, val]) => (
                            <RatingBar key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={val} />
                          ))}
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Positive */}
                      <div>
                        <h5 className="text-xs font-bold text-sage-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> Positive Feedback ({report.positive_comments.length})
                        </h5>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {report.positive_comments.slice(0, 5).map((c, i) => (
                            <div key={i} className="p-3 bg-sage-50 border border-sage-200 rounded-lg">
                              <p className="text-xs text-gray-700 leading-relaxed">"{c.comment}"</p>
                              <p className="text-xs text-gray-400 mt-1">— {c.name}</p>
                            </div>
                          ))}
                          {report.positive_comments.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No positive comments recorded</p>
                          )}
                        </div>
                      </div>
                      {/* Negative */}
                      <div>
                        <h5 className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3" /> Areas for Improvement ({report.negative_comments.length})
                        </h5>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {report.negative_comments.slice(0, 5).map((c, i) => (
                            <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-xs text-gray-700 leading-relaxed">"{c.comment}"</p>
                              <p className="text-xs text-gray-400 mt-1">— {c.name}</p>
                            </div>
                          ))}
                          {report.negative_comments.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No critical feedback — great job!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function AIInsightsSection({ insights }: { insights: AIInsights }) {
  if (!insights || (!insights.model_strengths && !insights.priority_actions)) return null;

  return (
    <div className="space-y-6">
      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sage-600" /> Model Strengths
          </h4>
          <div className="space-y-3">
            {insights.model_strengths?.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 bg-sage-100 border border-sage-300 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sage-700 text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-700">{s}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-terracotta-600" /> Model Weaknesses
          </h4>
          <div className="space-y-3">
            {insights.model_weaknesses?.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 bg-terracotta-100 border border-terracotta-300 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-terracotta-700 text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-700">{w}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Priority Actions */}
      {insights.priority_actions && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-3 border-black rounded-xl p-6 shadow-neo">
          <h4 className="font-display font-bold text-base mb-4 flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-yellow-400" /> Priority Action Items
          </h4>
          <div className="space-y-3">
            {insights.priority_actions.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3"
              >
                <div className="w-7 h-7 bg-yellow-400 border-2 border-black rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-black text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Flags */}
      {insights.risk_flags && (
        <div className="bg-red-50 border-3 border-red-300 rounded-xl p-6">
          <h4 className="font-display font-bold text-sm mb-4 flex items-center gap-2 text-red-700">
            <Shield className="w-4 h-4" /> Risk Flags
          </h4>
          <div className="space-y-2">
            {insights.risk_flags.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention Analysis */}
      {insights.retention_analysis && (
        <div className="bg-white border-3 border-black rounded-xl p-6 shadow-neo-sm">
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-terracotta-600" /> Retention Analysis
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed">{insights.retention_analysis}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Analytics Page ──────────────────────────────────────────────────────

type TabId = 'overview' | 'model' | 'shelters' | 'insights';

export function Analytics() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [shelterReports, setShelterReports] = useState<Record<string, ShelterReport> | null>(null);
  const [modelEval, setModelEval] = useState<ModelEval | null>(null);
  const [aiInsights, setAIInsights] = useState<AIInsights | null>(null);

  const fetchAnalytics = useCallback(async (useOllama = false) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch overview + insights
      const overviewResp = await fetch(`${API_BASE}/analytics/overview?use_ollama=${useOllama}`);
      if (!overviewResp.ok) throw new Error('Failed to fetch analytics overview');
      const overviewData = await overviewResp.json();
      setOverallStats(overviewData.overall);
      setAIInsights(overviewData.ai_insights);

      // Fetch shelter reports
      const shelterResp = await fetch(`${API_BASE}/analytics/shelters`);
      if (!shelterResp.ok) throw new Error('Failed to fetch shelter reports');
      const shelterData = await shelterResp.json();
      setShelterReports(shelterData.shelter_reports);

      // Fetch model evaluation
      const evalResp = await fetch(`${API_BASE}/analytics/model-eval`);
      if (!evalResp.ok) throw new Error('Failed to fetch model evaluation');
      const evalData = await evalResp.json();
      setModelEval(evalData.evaluation);
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError('Could not load analytics. Make sure the API server is running and the analytics router is configured.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  const handleGenerateWithAI = async () => {
    setGenerating(true);
    await fetchAnalytics(true);
    setGenerating(false);
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'model', label: 'Model Eval', icon: Brain },
    { id: 'shelters', label: 'Shelter Reports', icon: Building2 },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-sage-500 border-2 border-black rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              PawMatch Analytics
            </h2>
            <p className="text-gray-500 mt-1">Adoption follow-up survey analysis & AI model evaluation</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fetchAnalytics(false)}
              disabled={loading}
              className="px-4 py-2 bg-white border-2 border-black rounded-lg font-semibold text-sm shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleGenerateWithAI}
              disabled={generating || loading}
              className="px-4 py-2 bg-sage-500 text-white border-2 border-black rounded-lg font-semibold text-sm shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Generate AI Insights'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex gap-1 bg-gray-100 border-2 border-black p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-sage-500 text-white border-2 border-black shadow-neo-sm'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-3 border-red-300 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-sm">Connection Error</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <p className="text-red-500 text-xs mt-2">
              Ensure the API server is running: <code className="bg-red-100 px-1.5 py-0.5 rounded">uvicorn api.main:app --reload --port 8000</code>
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-sage-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading analytics data...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && overallStats && aiInsights && (
              <OverviewSection stats={overallStats} insights={aiInsights} />
            )}
            {activeTab === 'model' && modelEval && aiInsights && (
              <ModelEvalSection evaluation={modelEval} insights={aiInsights} />
            )}
            {activeTab === 'shelters' && shelterReports && (
              <ShelterReportsSection shelterReports={shelterReports} shelterInsights={aiInsights?.shelter_insights} />
            )}
            {activeTab === 'insights' && aiInsights && (
              <AIInsightsSection insights={aiInsights} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
