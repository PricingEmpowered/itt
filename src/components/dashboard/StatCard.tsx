import { memo } from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon, TrendingUp } from 'lucide-react';

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
          <TrendingUp className="h-6 w-6" />
        </div>
      </div>
      <div className="flex items-center">
        <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          isPositive ? 'bg-red-500/90' : 'bg-red-500/90'
        }`}>
          {isPositive ? (
            <ArrowDownRight className="h-3 w-3 mr-1" />
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
  value: string;
  badge: string;
  gradient: string;
  number: string;
  onClick?: () => void;
}

export const MetricCard = memo(function MetricCard({ title, value, badge, gradient, number, onClick }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${gradient} rounded-xl p-4 min-w-[140px] max-w-[160px] text-white text-left group cursor-pointer hover:scale-[1.02] transition-all shadow-md hover:shadow-lg flex-shrink-0`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] font-bold bg-white/30 px-2 py-0.5 rounded backdrop-blur-sm">
          #{number}
        </div>
      </div>
      <div className="text-[10px] font-medium text-white/90 mb-1.5 leading-tight">{title}</div>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/90">
        {badge}
      </div>
    </button>
  );
});
