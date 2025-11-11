import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../LoadingSpinner';

interface PricePerformanceData {
  product_id: string;
  part_number: string;
  sales: number;
  margin_at_list_pct: number;
  price_premium_vs_comp_a: number;
  pareto_category: string;
  pareto_cumulative_pct: number;
  average_discount_pct: number;
}

export function ListPricePerformance() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PricePerformanceData[]>([]);
  const [competitor, setCompetitor] = useState('Competitor A');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: perfData, error } = await supabase
        .from('analytics_price_performance')
        .select('*')
        .order('sales', { ascending: false })
        .limit(50);

      if (error) throw error;
      setData(perfData || []);
    } catch (error) {
      console.error('Error loading price performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryCounts = {
    A: data.filter(d => d.pareto_category === 'A').length,
    B: data.filter(d => d.pareto_category === 'B').length,
    C: data.filter(d => d.pareto_category === 'C').length,
    D: data.filter(d => d.pareto_category === 'D').length
  };

  const categorySales = {
    A: data.filter(d => d.pareto_category === 'A').reduce((sum, d) => sum + d.sales, 0),
    B: data.filter(d => d.pareto_category === 'B').reduce((sum, d) => sum + d.sales, 0),
    C: data.filter(d => d.pareto_category === 'C').reduce((sum, d) => sum + d.sales, 0),
    D: data.filter(d => d.pareto_category === 'D').reduce((sum, d) => sum + d.sales, 0)
  };

  const totalSales = Object.values(categorySales).reduce((sum, s) => sum + s, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Margin vs Sales Analysis
          </h3>
          <select
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Competitor A</option>
            <option>Competitor B</option>
            <option>Competitor C</option>
            <option>Competitor D</option>
          </select>
        </div>

        <div className="relative h-80 border border-slate-200 rounded-lg p-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              {data.slice(0, 30).map((item, idx) => {
                const x = (item.sales / 1000000) * 80;
                const y = 100 - item.margin_at_list_pct;

                return (
                  <div
                    key={idx}
                    className="absolute w-2 h-2 bg-blue-500 rounded-full hover:w-3 hover:h-3 transition-all cursor-pointer"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={`${item.part_number}: $${(item.sales / 1000).toFixed(0)}K, ${item.margin_at_list_pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-slate-600">
            Sales ($M)
          </div>
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-slate-600">
            Margin %
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Product Pareto Analysis
        </h3>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Category A</div>
            <div className="text-2xl font-bold text-green-900">{categoryCounts.A}</div>
            <div className="text-xs text-green-600 mt-1">
              {((categorySales.A / totalSales) * 100).toFixed(1)}% of sales
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">Category B</div>
            <div className="text-2xl font-bold text-blue-900">{categoryCounts.B}</div>
            <div className="text-xs text-blue-600 mt-1">
              {((categorySales.B / totalSales) * 100).toFixed(1)}% of sales
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-700 mb-1">Category C</div>
            <div className="text-2xl font-bold text-yellow-900">{categoryCounts.C}</div>
            <div className="text-xs text-yellow-600 mt-1">
              {((categorySales.C / totalSales) * 100).toFixed(1)}% of sales
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-sm text-slate-700 mb-1">Category D</div>
            <div className="text-2xl font-bold text-slate-900">{categoryCounts.D}</div>
            <div className="text-xs text-slate-600 mt-1">
              {((categorySales.D / totalSales) * 100).toFixed(1)}% of sales
            </div>
          </div>
        </div>

        <div className="h-64 flex items-end justify-between gap-1">
          {data.slice(0, 40).map((item, idx) => {
            const maxSales = Math.max(...data.map(d => d.sales));
            const height = (item.sales / maxSales) * 100;
            const bgColor =
              item.pareto_category === 'A' ? 'bg-green-500' :
              item.pareto_category === 'B' ? 'bg-blue-500' :
              item.pareto_category === 'C' ? 'bg-yellow-500' : 'bg-slate-400';

            return (
              <div
                key={idx}
                className={`flex-1 ${bgColor} rounded-t hover:opacity-80 transition-opacity cursor-pointer`}
                style={{ height: `${height}%`, minHeight: '4px' }}
                title={`${item.part_number}: $${(item.sales / 1000).toFixed(0)}K`}
              />
            );
          })}
        </div>
        <div className="mt-4 h-px bg-slate-200" />
        <div className="mt-2 text-xs text-slate-600 text-center">Part Numbers (sorted by sales)</div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Discount Analysis
        </h3>

        <div className="relative h-64 border border-slate-200 rounded-lg p-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              {data.slice(0, 30).map((item, idx) => {
                const x = (item.sales / 1000000) * 80;
                const y = 100 - (item.average_discount_pct * 3);

                return (
                  <div
                    key={idx}
                    className="absolute w-2 h-2 bg-blue-500 rounded-full hover:w-3 hover:h-3 transition-all cursor-pointer"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={`${item.part_number}: ${item.average_discount_pct.toFixed(1)}% discount`}
                  />
                );
              })}
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-slate-600">
            Sales ($M)
          </div>
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-slate-600">
            Avg Discount %
          </div>
        </div>
      </div>
    </div>
  );
}
