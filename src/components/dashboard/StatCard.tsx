import { memo } from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon, TrendingUp, HelpCircle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: LucideIcon;
  gradient: string;
  onClick?: () => void;
}

export const StatCard = memo(function StatCard({ title, value, change, isPositive, icon: Icon, gradient, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${gradient} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-white text-left w-full group cursor-pointer hover:scale-[1.02]`}
    >
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="text-sm font-medium text-white/90 mb-3">{title}</p>
          <h3 className="text-4xl font-bold">{value}</h3>
        </div>
        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="flex items-center">
        <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          isPositive ? 'bg-emerald-500/90' : 'bg-red-500/90'
        }`}>
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3 mr-1" />
          ) : (
            <ArrowDownRight className="h-3 w-3 mr-1" />
          )}
          {change}
        </div>
        <span className="text-xs text-white/80 ml-2">vs last year</span>
      </div>
    </button>
  );
});

interface MetricCardProps {
  title: string;
  /** Null when the data cannot support the metric. */
  value: string | null;
  /** Coverage, e.g. "2,427 of 2,433 lines". Omitted when the whole set counts. */
  badge?: string;
  gradient: string;
  number: string;
  /** Why there is no value. Rendered in place of one. */
  unavailable?: string | null;
  onClick?: () => void;
}

/**
 * A metric card, which has to be able to say "not known".
 *
 * These ten cards used to carry hardcoded numbers. A card with no data now
 * renders grey and states what is missing, because the alternative - a
 * plausible figure in the same styling as the real ones - is the failure
 * mode this screen already had.
 */
export const MetricCard = memo(function MetricCard({ title, value, badge, gradient, number, unavailable, onClick }: MetricCardProps) {
  const known = value !== null;
  return (
    <button
      onClick={onClick}
      title={unavailable ?? undefined}
      className={`${known ? gradient : 'bg-slate-200'} rounded-xl p-4 min-w-[150px] max-w-[170px] ${
        known ? 'text-white' : 'text-slate-600'
      } text-left group cursor-pointer hover:scale-[1.02] transition-all shadow-md hover:shadow-lg flex-shrink-0`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`${known ? 'bg-white/20' : 'bg-slate-300/60'} p-1.5 rounded-lg backdrop-blur-sm`}>
          {known ? <TrendingUp className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
        </div>
        <div className={`text-[10px] font-bold ${known ? 'bg-white/30' : 'bg-slate-300/70'} px-2 py-0.5 rounded backdrop-blur-sm`}>
          #{number}
        </div>
      </div>
      <div className={`text-[10px] font-medium ${known ? 'text-white/90' : 'text-slate-500'} mb-1.5 leading-tight`}>
        {title}
      </div>
      <div className="text-2xl font-bold mb-2">{value ?? '\u2014'}</div>
      {known ? (
        badge && (
          <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/25">
            {badge}
          </div>
        )
      ) : (
        <div className="text-[10px] leading-tight text-slate-500 line-clamp-3">
          {unavailable ?? 'Not available.'}
        </div>
      )}
    </button>
  );
});
