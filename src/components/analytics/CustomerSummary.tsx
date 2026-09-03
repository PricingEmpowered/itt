import { useEffect, useState } from 'react';
import { trpcClient } from '../../lib/trpcClient';
import { ArrowLeft, ChevronRight, ChevronDown, Search } from 'lucide-react';

interface CustomerSummaryProps {
  onBack: () => void;
}

interface CustomerRow {
  id: string;
  name: string;
  sales: number;
  marginPct: number;
  discountPct: number;
  priceIndex: number;
  priceYoY: number;
  expanded?: boolean;
  products?: ProductRow[];
}

interface ProductRow {
  name: string;
  sales: number;
  marginPct: number;
  discountPct: number;
  priceIndex: number;
  priceYoY: number;
}

export function CustomerSummary({ onBack }: CustomerSummaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    trpcClient.analytics.customerSummary
      .query()
      .then((data) => {
        if (!cancelled) setRows(data as unknown as CustomerRow[]);
      })
      .catch((error) => {
        console.error('Error loading customer summary:', error);
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredData = rows.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-slate-900">Customer Summary</h2>
          <p className="text-sm text-slate-600">Comprehensive view of customer performance metrics</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Customer Summary</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search customers or products"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Customer / Product
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Sales
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Margin %
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Discount %
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Price Index
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Price YoY %
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading customers...
                  </td>
                </tr>
              )}
              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No customer sales in the selected period
                  </td>
                </tr>
              )}
              {filteredData.map((customer) => (
                <>
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => toggleRow(customer.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {expandedRows.has(customer.id) ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                        <span className="font-medium text-slate-900">{customer.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      ${customer.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">{customer.marginPct.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-slate-700">{customer.discountPct.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                          customer.priceIndex >= 100
                            ? 'bg-green-100 text-green-700'
                            : customer.priceIndex >= 95
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {customer.priceIndex.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                          customer.priceYoY >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {customer.priceYoY >= 0 ? '+' : ''}
                        {customer.priceYoY.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  {expandedRows.has(customer.id) &&
                    customer.products?.map((product, idx) => (
                      <tr
                        key={`${customer.id}-${idx}`}
                        className="bg-slate-50 border-b border-slate-100"
                      >
                        <td className="py-2 px-4 pl-12">
                          <span className="text-sm text-slate-600">{product.name}</span>
                        </td>
                        <td className="py-2 px-4 text-right text-sm text-slate-700">
                          ${product.sales.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right text-sm text-slate-700">
                          {product.marginPct.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right text-sm text-slate-700">
                          {product.discountPct.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right">
                          <span className="text-sm text-slate-700">{product.priceIndex.toFixed(1)}</span>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <span
                            className={`text-sm ${
                              product.priceYoY >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {product.priceYoY >= 0 ? '+' : ''}
                            {product.priceYoY.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
