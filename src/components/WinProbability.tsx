import { TrendingUp, Target, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface WinProbabilityProps {
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    customerWinRate: number;
    productWinRate: number;
    discountLevel: string;
    historicalQuotes: number;
  };
  insights: string[];
}

export function WinProbability({ probability, confidence, factors, insights }: WinProbabilityProps) {
  const probabilityPercent = probability * 100;

  const getProbabilityColor = () => {
    if (probabilityPercent >= 70) return 'text-green-600';
    if (probabilityPercent >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProbabilityBgColor = () => {
    if (probabilityPercent >= 70) return 'bg-green-50 border-green-200';
    if (probabilityPercent >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getProbabilityIcon = () => {
    if (probabilityPercent >= 70) return <CheckCircle className={getProbabilityColor()} size={24} />;
    if (probabilityPercent >= 50) return <Target className={getProbabilityColor()} size={24} />;
    return <AlertCircle className={getProbabilityColor()} size={24} />;
  };

  const getConfidenceBadge = () => {
    const colors = {
      high: 'bg-blue-100 text-blue-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-slate-100 text-slate-700'
    };
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded ${colors[confidence]}`}>
        {confidence.toUpperCase()} CONFIDENCE
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${getProbabilityBgColor()} border flex items-center justify-center`}>
            {getProbabilityIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Win Probability</h3>
            <p className="text-sm text-slate-600">Based on historical data analysis</p>
          </div>
        </div>
        {getConfidenceBadge()}
      </div>

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <span className={`text-5xl font-bold ${getProbabilityColor()}`}>
            {probabilityPercent.toFixed(0)}%
          </span>
          <span className="text-slate-600 mb-2">chance to win</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              probabilityPercent >= 70 ? 'bg-green-500' :
              probabilityPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${probabilityPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <div className="space-y-1">
          <div className="text-xs text-slate-600">Customer Win Rate</div>
          <div className="text-lg font-semibold text-slate-900">{factors.customerWinRate}%</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-600">Product Win Rate</div>
          <div className="text-lg font-semibold text-slate-900">{factors.productWinRate}%</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-600">Discount Level</div>
          <div className="text-sm font-medium text-slate-700">{factors.discountLevel}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-600">Historical Data</div>
          <div className="text-sm font-medium text-slate-700">{factors.historicalQuotes} quotes</div>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Info size={16} />
            Key Insights
          </div>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                <TrendingUp size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Win probability is calculated using historical data from similar customers, products,
            discount levels, and quote sizes. {confidence === 'low' && 'Limited historical data available - use with caution.'}
          </span>
        </div>
      </div>
    </div>
  );
}
