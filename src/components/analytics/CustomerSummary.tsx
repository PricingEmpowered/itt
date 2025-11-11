import { useState } from 'react';
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

const mockData: CustomerRow[] = [
  {
    id: '1',
    name: 'D4 Systems',
    sales: 20440.0,
    marginPct: 37.9,
    discountPct: 16.2,
    priceIndex: 99.5,
    priceYoY: 4.3,
    products: [
      { name: 'Network Switch Pro', sales: 8200, marginPct: 42.1, discountPct: 12.3, priceIndex: 102.3, priceYoY: 5.2 },
      { name: 'Security Gateway', sales: 6140, marginPct: 35.8, discountPct: 18.4, priceIndex: 98.1, priceYoY: 3.8 },
      { name: 'Storage Array', sales: 4100, marginPct: 33.2, discountPct: 19.1, priceIndex: 96.7, priceYoY: 3.1 },
    ],
  },
  {
    id: '2',
    name: 'G7 Corporation',
    sales: 12888.0,
    marginPct: 36.3,
    discountPct: 22.2,
    priceIndex: 97.3,
    priceYoY: 1.9,
    products: [
      { name: 'Network Switch Pro', sales: 5800, marginPct: 38.5, discountPct: 20.1, priceIndex: 99.2, priceYoY: 2.4 },
      { name: 'Firewall Appliance', sales: 4288, marginPct: 34.8, discountPct: 24.5, priceIndex: 95.8, priceYoY: 1.5 },
      { name: 'Cloud Connector', sales: 2800, marginPct: 34.6, discountPct: 22.8, priceIndex: 96.5, priceYoY: 1.8 },
    ],
  },
  {
    id: '3',
    name: 'J10 Group',
    sales: 11907.0,
    marginPct: 29.6,
    discountPct: 25.0,
    priceIndex: 107.6,
    priceYoY: -1.0,
    products: [
      { name: 'Enterprise Router', sales: 5200, marginPct: 32.1, discountPct: 22.3, priceIndex: 110.2, priceYoY: -0.5 },
      { name: 'Load Balancer', sales: 3807, marginPct: 28.4, discountPct: 26.8, priceIndex: 106.3, priceYoY: -1.2 },
      { name: 'VPN Gateway', sales: 2900, marginPct: 27.2, discountPct: 26.5, priceIndex: 105.8, priceYoY: -1.5 },
    ],
  },
  {
    id: '4',
    name: 'Y25 Innovations',
    sales: 7343.0,
    marginPct: 26.0,
    discountPct: 16.9,
    priceIndex: 94.9,
    priceYoY: 4.0,
    products: [
      { name: 'Storage NAS', sales: 3500, marginPct: 28.3, discountPct: 15.2, priceIndex: 96.8, priceYoY: 4.8 },
      { name: 'Backup Solution', sales: 2343, marginPct: 24.8, discountPct: 18.1, priceIndex: 93.5, priceYoY: 3.5 },
      { name: 'Archive System', sales: 1500, marginPct: 23.5, discountPct: 17.5, priceIndex: 93.8, priceYoY: 3.2 },
    ],
  },
  {
    id: '5',
    name: 'N40 Group',
    sales: 6103.0,
    marginPct: 44.3,
    discountPct: 26.8,
    priceIndex: 103.6,
    priceYoY: 0.6,
    products: [
      { name: 'Advanced Firewall', sales: 2800, marginPct: 46.2, discountPct: 24.5, priceIndex: 105.3, priceYoY: 1.2 },
      { name: 'IDS/IPS System', sales: 2103, marginPct: 43.8, discountPct: 28.2, priceIndex: 102.5, priceYoY: 0.3 },
      { name: 'Security Manager', sales: 1200, marginPct: 41.5, discountPct: 28.5, priceIndex: 102.8, priceYoY: 0.2 },
    ],
  },
  {
    id: '6',
    name: 'T46 Enterprises',
    sales: 4835.0,
    marginPct: 29.7,
    discountPct: 21.7,
    priceIndex: 92.1,
    priceYoY: 5.9,
    products: [
      { name: 'Managed Switch', sales: 2200, marginPct: 31.2, discountPct: 20.1, priceIndex: 93.8, priceYoY: 6.5 },
      { name: 'Access Point', sales: 1635, marginPct: 28.9, discountPct: 22.5, priceIndex: 91.2, priceYoY: 5.6 },
      { name: 'Controller', sales: 1000, marginPct: 28.1, discountPct: 22.8, priceIndex: 90.8, priceYoY: 5.1 },
    ],
  },
];

export function CustomerSummary({ onBack }: CustomerSummaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredData = mockData.filter(customer =>
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
