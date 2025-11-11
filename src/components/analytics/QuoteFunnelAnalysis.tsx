import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../LoadingSpinner';
import { Clock } from 'lucide-react';

interface FunnelData {
  business_type: string;
  stage: string;
  quote_count: number;
  quote_value: number;
  average_value: number;
  win_rate: number;
  average_cycle_time_days: number;
}

interface TurnaroundStats {
  avg_turnaround_hours: number;
  median_turnaround_hours: number;
  fast_count: number;
  standard_count: number;
  slow_count: number;
  very_slow_count: number;
}

export function QuoteFunnelAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FunnelData[]>([]);
  const [turnaroundStats, setTurnaroundStats] = useState<TurnaroundStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: funnelData, error } = await supabase
        .from('analytics_quote_funnel')
        .select('*')
        .is('region', null)
        .is('channel', null)
        .is('segment', null)
        .order('period_start', { ascending: false })
        .limit(24);

      if (error) throw error;
      setData(funnelData || []);

      const { data: turnaroundData } = await supabase
        .from('quote_turnaround_analytics')
        .select('turnaround_time_hours, turnaround_category');

      if (turnaroundData) {
        const times = turnaroundData
          .filter(q => q.turnaround_time_hours)
          .map(q => q.turnaround_time_hours);

        const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        const sortedTimes = [...times].sort((a, b) => a - b);
        const median = times.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;

        setTurnaroundStats({
          avg_turnaround_hours: avg,
          median_turnaround_hours: median,
          fast_count: turnaroundData.filter(q => q.turnaround_category?.includes('Fast')).length,
          standard_count: turnaroundData.filter(q => q.turnaround_category?.includes('Standard')).length,
          slow_count: turnaroundData.filter(q => q.turnaround_category?.includes('Slow') && !q.turnaround_category?.includes('Very')).length,
          very_slow_count: turnaroundData.filter(q => q.turnaround_category?.includes('Very Slow')).length
        });
      }
    } catch (error) {
      console.error('Error loading quote funnel:', error);
    } finally {
      setLoading(false);
    }
  };

  const latestPeriod = data.slice(0, 8);

  const newBusinessData = latestPeriod.filter(d => d.business_type === 'new');
  const repeatBusinessData = latestPeriod.filter(d => d.business_type === 'repeat');

  const newTotal = newBusinessData.reduce((sum, d) => sum + d.quote_value, 0);
  const repeatTotal = repeatBusinessData.reduce((sum, d) => sum + d.quote_value, 0);
  const totalQuotes = newBusinessData.reduce((sum, d) => sum + d.quote_count, 0) +
    repeatBusinessData.reduce((sum, d) => sum + d.quote_count, 0);
  const totalValue = newTotal + repeatTotal;

  const newWinRate = newBusinessData.find(d => d.stage === 'technical_review')?.win_rate || 0;
  const repeatWinRate = repeatBusinessData.find(d => d.stage === 'technical_review')?.win_rate || 0;
  const avgWinRate = ((newWinRate + repeatWinRate) / 2);

  const newCycleTime = newBusinessData.find(d => d.stage === 'technical_review')?.average_cycle_time_days || 0;
  const repeatCycleTime = repeatBusinessData.find(d => d.stage === 'technical_review')?.average_cycle_time_days || 0;
  const avgCycleTime = Math.round((newCycleTime + repeatCycleTime) / 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-2">Total Quotes</div>
          <div className="text-3xl font-bold text-slate-900">{totalQuotes}</div>
          <div className="text-xs text-slate-500 mt-1">
            (${(totalValue / 1000000).toFixed(1)}M)
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-2">Average Win Rate</div>
          <div className="text-3xl font-bold text-slate-900">{avgWinRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-1">Across all segments</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-2">Average Cycle Time</div>
          <div className="text-3xl font-bold text-slate-900">{avgCycleTime}</div>
          <div className="text-xs text-slate-500 mt-1">days</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-2">Conversion Rate</div>
          <div className="text-3xl font-bold text-slate-900">{avgWinRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-1">Quote to order</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
            <Clock size={16} />
            Approval Time
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {turnaroundStats ? `${(turnaroundStats.avg_turnaround_hours / 24).toFixed(1)}d` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {turnaroundStats ? `${turnaroundStats.avg_turnaround_hours.toFixed(0)}h average` : 'No data'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Quote Funnel</h3>
        <div className="h-96">
          <div className="grid grid-cols-3 gap-4 h-full">
            {['technical_review', 'negotiation', 'won'].map((stage) => {
              const newStage = newBusinessData.find(d => d.stage === stage);
              const repeatStage = repeatBusinessData.find(d => d.stage === stage);

              const newCount = newStage?.quote_count || 0;
              const repeatCount = repeatStage?.quote_count || 0;
              const total = newCount + repeatCount;

              const maxCount = Math.max(
                ...newBusinessData.map(d => d.quote_count),
                ...repeatBusinessData.map(d => d.quote_count)
              ) * 1.5;

              const newHeight = (newCount / maxCount) * 100;
              const repeatHeight = (repeatCount / maxCount) * 100;

              return (
                <div key={stage} className="flex flex-col items-center justify-end h-full">
                  <div className="w-full flex flex-col items-center gap-1 mb-4">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${newHeight}%`, minHeight: '8px' }}
                    />
                    <div
                      className="w-full bg-green-500 rounded-b"
                      style={{ height: `${repeatHeight}%`, minHeight: '8px' }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900 capitalize mb-1">
                      {stage.replace('_', ' ')}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{total}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-slate-600">New Business</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-slate-600">Repeat Business</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Segment Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Metric</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900">New Business</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900">Repeat Business</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900">Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-4 text-sm text-slate-600">Total Quotes</td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {newBusinessData.reduce((sum, d) => sum + d.quote_count, 0)}
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {repeatBusinessData.reduce((sum, d) => sum + d.quote_count, 0)}
                </td>
                <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                  +{repeatBusinessData.reduce((sum, d) => sum + d.quote_count, 0) -
                    newBusinessData.reduce((sum, d) => sum + d.quote_count, 0)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-4 text-sm text-slate-600">Total Value</td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  ${(newTotal / 1000000).toFixed(2)}M
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  ${(repeatTotal / 1000000).toFixed(2)}M
                </td>
                <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                  +${((repeatTotal - newTotal) / 1000000).toFixed(2)}M
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-4 text-sm text-slate-600">Average Value</td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  ${newBusinessData[0]?.average_value.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  ${repeatBusinessData[0]?.average_value.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                  +${((repeatBusinessData[0]?.average_value || 0) - (newBusinessData[0]?.average_value || 0)).toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-4 text-sm text-slate-600">Win Rate</td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {newWinRate.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {repeatWinRate.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                  +{(repeatWinRate - newWinRate).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-slate-600">Average Cycle Time</td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {newCycleTime} days
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 text-right">
                  {repeatCycleTime} days
                </td>
                <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                  -{newCycleTime - repeatCycleTime} days
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
