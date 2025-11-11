import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { DealScoreDetails } from '../types';
import { getDealScoreBgColor, getDealScoreLabel } from '../utils/dealScoreCalculator';

interface DealScoreIndicatorProps {
  score: number | null | undefined;
  details?: DealScoreDetails | null;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export function DealScoreIndicator({
  score,
  details,
  size = 'medium',
  showDetails = false,
}: DealScoreIndicatorProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-600">
          No Score
        </span>
        {showDetails && (
          <div className="text-xs text-gray-500">Insufficient historical data</div>
        )}
      </div>
    );
  }

  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-3 py-1',
    large: 'text-lg px-4 py-2',
  };

  const iconSize = {
    small: 14,
    medium: 16,
    large: 20,
  };

  const getIcon = () => {
    if (score >= 110)
      return <TrendingUp size={iconSize[size]} className="text-green-600" />;
    if (score >= 90)
      return <Minus size={iconSize[size]} className="text-yellow-600" />;
    return <TrendingDown size={iconSize[size]} className="text-red-600" />;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {getIcon()}
        <span
          className={`${sizeClasses[size]} font-bold rounded-full ${getDealScoreBgColor(
            score
          )}`}
        >
          {score.toFixed(0)}
        </span>
        <span className={`${size === 'small' ? 'text-xs' : 'text-sm'} text-gray-600`}>
          {getDealScoreLabel(score)}
        </span>
      </div>

      {showDetails && details && (
        <div className="text-xs text-gray-500">
          ({details.comparable_deals_count} comparable deals)
        </div>
      )}
    </div>
  );
}

interface DealScoreCardProps {
  score: number | null | undefined;
  details: DealScoreDetails | null | undefined;
}

export function DealScoreCard({ score, details }: DealScoreCardProps) {
  if (score === null || score === undefined || !details) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-amber-900">Deal Score Not Available</p>
            <p className="text-xs text-amber-700 mt-1">
              Insufficient historical data to calculate deal score. At least 5 comparable
              deals from the same industry and region are needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const scoreDelta = score - 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Deal Score Analysis</h4>
        <DealScoreIndicator score={score} size="large" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-xs text-blue-700 font-medium mb-1">Current Margin</div>
          <div className="text-2xl font-bold text-blue-900">
            {details.current_avg_margin.toFixed(1)}%
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Baseline: {((details.industry_avg_margin + details.region_avg_margin) / 2).toFixed(1)}%
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-700 font-medium mb-1">Current Discount</div>
          <div className="text-2xl font-bold text-slate-900">
            {details.current_avg_discount.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-600 mt-1">
            Baseline: {((details.industry_avg_discount + details.region_avg_discount) / 2).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-700">Deal Performance</span>
          <span className="text-xs text-gray-500">
            {details.comparable_deals_count} comparable deals analyzed
          </span>
        </div>
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
            style={{ width: '100%' }}
          />
          <div
            className="absolute top-0 w-1 h-full bg-gray-900 shadow-lg"
            style={{
              left: `${Math.min(Math.max((score / 140) * 100, 0), 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Poor (80)</span>
          <span>Average (100)</span>
          <span>Excellent (120)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div>
          <div className="text-xs text-gray-600 mb-1">Industry Benchmark</div>
          <div className="text-sm text-gray-900">
            {details.industry_avg_margin.toFixed(1)}% margin,{' '}
            {details.industry_avg_discount.toFixed(1)}% discount
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Region Benchmark</div>
          <div className="text-sm text-gray-900">
            {details.region_avg_margin.toFixed(1)}% margin,{' '}
            {details.region_avg_discount.toFixed(1)}% discount
          </div>
        </div>
      </div>

      <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-700">
        <p className="font-medium mb-1">How is this calculated?</p>
        <p>
          Your deal score compares your margin and discount against {details.comparable_deals_count}{' '}
          similar deals from the same industry and region over the past 12 months.
          {scoreDelta > 0 ? (
            <span className="text-green-700 font-medium">
              {' '}
              Your deal is {Math.abs(scoreDelta).toFixed(0)}% better than the baseline.
            </span>
          ) : scoreDelta < 0 ? (
            <span className="text-red-700 font-medium">
              {' '}
              Your deal is {Math.abs(scoreDelta).toFixed(0)}% worse than the baseline.
            </span>
          ) : (
            <span className="text-gray-700 font-medium"> Your deal matches the baseline.</span>
          )}
        </p>
      </div>
    </div>
  );
}
