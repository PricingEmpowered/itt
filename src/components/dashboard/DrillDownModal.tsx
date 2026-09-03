import { X, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { trpcClient } from '../../lib/trpcClient';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: {
    title: string;
    value: string;
    badge: string;
    gradient: string;
  };
}

interface DataRow {
  customer_group: string;
  product_group: string;
  value: number;
  change: number;
  volume: number;
}

export function DrillDownModal({ isOpen, onClose, metric }: DrillDownModalProps) {
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    customerGroup: 'all',
    productGroup: 'all',
  });

  useEffect(() => {
    if (isOpen && metric) {
      loadDrillDownData();
    }
  }, [isOpen, filters, metric]);

  const loadDrillDownData = async () => {
    setLoading(true);
    try {
      const rows = (await trpcClient.analytics.metricDrillDown.query()) as unknown as DataRow[];

      const filteredData = rows.filter(
        (row) =>
          (filters.customerGroup === 'all' || row.customer_group === filters.customerGroup) &&
          (filters.productGroup === 'all' || row.product_group === filters.productGroup)
      );

      setData(filteredData);
    } catch (error) {
      console.error('Error loading drill-down data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !metric) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${metric.gradient} p-6 text-white flex items-center justify-between`}>
          <div>
            <h2 className="text-2xl font-bold mb-2">{metric.title}</h2>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold">{metric.value}</span>
              <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-semibold">
                {metric.badge}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-slate-600" />
            <select
              value={filters.customerGroup}
              onChange={(e) => setFilters({ ...filters, customerGroup: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Customer Groups</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Mid-Market">Mid-Market</option>
              <option value="Small Business">Small Business</option>
            </select>
            <select
              value={filters.productGroup}
              onChange={(e) => setFilters({ ...filters, productGroup: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Product Groups</option>
              <option value="Valves">Valves</option>
              <option value="Pumps">Pumps</option>
              <option value="Accessories">Accessories</option>
              <option value="Flow Control">Flow Control</option>
              <option value="Controls & Automation">Controls & Automation</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-600">Loading data...</div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Customer Group</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Product Group</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Value</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Change</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Volume</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-700 font-medium">{row.customer_group}</td>
                    <td className="py-3 px-4 text-slate-700">{row.product_group}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {row.value.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        row.change >= 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {row.change >= 0 ? '+' : ''}{row.change.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">
                      {row.volume.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
