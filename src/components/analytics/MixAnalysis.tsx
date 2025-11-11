import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface MixAnalysisProps {
  onBack: () => void;
}

interface SegmentData {
  name: string;
  currentShare: number;
  previousShare: number;
  currentMargin: number;
  previousMargin: number;
  mixImpact: number;
}

const mockSegmentData: SegmentData[] = [
  {
    name: 'Electronics',
    currentShare: 60.3,
    previousShare: 61.8,
    currentMargin: 42.5,
    previousMargin: 40.0,
    mixImpact: 0.9,
  },
  {
    name: 'Software',
    currentShare: 39.7,
    previousShare: 38.2,
    currentMargin: 67.5,
    previousMargin: 66.0,
    mixImpact: 2.0,
  },
];

export function MixAnalysis({ onBack }: MixAnalysisProps) {
  const [dimension, setDimension] = useState<'product' | 'customer'>('product');

  const totalMixImpact = mockSegmentData.reduce((sum, seg) => sum + seg.mixImpact, 0);
  const totalMargin = mockSegmentData.reduce(
    (sum, seg) => sum + (seg.currentShare / 100) * seg.currentMargin,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mix Analysis</h2>
          <p className="text-sm text-slate-600">
            Analyze the impact of segment mix changes on overall margin
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value as 'product' | 'customer')}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="product">Product Family Level 1</option>
          <option value="customer">Customer Segment</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Revenue Share Comparison</h3>
        <div className="space-y-6">
          {mockSegmentData.map((segment, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{segment.name}</span>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>Previous: {segment.previousShare.toFixed(1)}%</span>
                  <span>Current: {segment.currentShare.toFixed(1)}%</span>
                </div>
              </div>
              <div className="relative h-12 flex gap-1">
                <div
                  className="bg-slate-300 rounded flex items-center justify-center text-xs font-medium text-slate-700"
                  style={{ width: `${segment.previousShare}%` }}
                >
                  {segment.previousShare.toFixed(1)}%
                </div>
                <div
                  className={`${
                    idx === 0 ? 'bg-blue-500' : 'bg-emerald-500'
                  } rounded flex items-center justify-center text-xs font-medium text-white`}
                  style={{ width: `${segment.currentShare}%` }}
                >
                  {segment.currentShare.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-300 rounded" />
            <span className="text-slate-600">Previous Period Share</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-slate-600">Current Period Share</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Margin Impact by Segment</h3>
        <div className="relative h-64 border border-slate-200 rounded-lg p-4 bg-slate-50">
          <div className="absolute inset-4 flex items-end justify-around">
            {mockSegmentData.map((segment, idx) => {
              const maxMargin = 80;
              const currentHeight = (segment.currentMargin / maxMargin) * 100;
              const previousHeight = (segment.previousMargin / maxMargin) * 100;

              return (
                <div key={idx} className="flex items-end gap-2 flex-1 justify-center">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-16 bg-slate-300 rounded-t relative"
                      style={{ height: `${previousHeight}%`, minHeight: '20px' }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-700">
                        {segment.previousMargin.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 mt-2 text-center">{segment.name}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-16 ${
                        idx === 0 ? 'bg-blue-500' : 'bg-emerald-500'
                      } rounded-t relative`}
                      style={{ height: `${currentHeight}%`, minHeight: '20px' }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-900">
                        {segment.currentMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-300 rounded" />
            <span className="text-slate-600">Previous Margin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-slate-600">Current Margin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-slate-600">Positive Impact</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-slate-600">Negative Impact</span>
          </div>
          <div className="w-px h-4 bg-slate-300" />
          <span className="text-slate-600">Current Margin</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Detailed Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Segment
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Current Share
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Previous Share
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Current Margin
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Previous Margin
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mix Impact
                </th>
              </tr>
            </thead>
            <tbody>
              {mockSegmentData.map((segment, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium text-slate-900">{segment.name}</td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {segment.currentShare.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {segment.previousShare.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {segment.currentMargin.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {segment.previousMargin.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        segment.mixImpact >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {segment.mixImpact >= 0 ? '+' : ''}
                      {segment.mixImpact.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="py-3 px-4 text-slate-900">Total</td>
                <td className="py-3 px-4 text-right text-slate-900">100.0%</td>
                <td className="py-3 px-4 text-right text-slate-900">100.0%</td>
                <td className="py-3 px-4 text-right text-slate-900">{totalMargin.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right text-slate-900">
                  {(totalMargin - totalMixImpact).toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    +{totalMixImpact.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
