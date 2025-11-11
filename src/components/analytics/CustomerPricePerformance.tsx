import { useState } from 'react';
import { ArrowLeft, BarChart2, ScatterChart } from 'lucide-react';

interface CustomerPricePerformanceProps {
  onBack: () => void;
}

interface CustomerData {
  name: string;
  priceIndex: number;
  marginIndex: number;
  status: 'above' | 'at' | 'below';
}

const mockCustomers: CustomerData[] = [
  { name: 'A1 Solutions', priceIndex: 103.3, marginIndex: 94.4, status: 'above' },
  { name: 'B2 Technologies', priceIndex: 96.4, marginIndex: 107.0, status: 'at' },
  { name: 'C3 Industries', priceIndex: 101.5, marginIndex: 101.3, status: 'above' },
  { name: 'D4 Systems', priceIndex: 106.9, marginIndex: 100.5, status: 'above' },
  { name: 'E5 Innovations', priceIndex: 95.7, marginIndex: 101.4, status: 'at' },
  { name: 'F6 Enterprises (Below Market)', priceIndex: 83.1, marginIndex: 103.5, status: 'below' },
  { name: 'G7 Corporation', priceIndex: 104.4, marginIndex: 96.5, status: 'above' },
  { name: 'H8 Inc', priceIndex: 99.4, marginIndex: 103.3, status: 'at' },
  { name: 'I9 Ltd', priceIndex: 94.1, marginIndex: 79.6, status: 'below' },
  { name: 'J10 Group (Below Market)', priceIndex: 85.0, marginIndex: 116.3, status: 'below' },
  { name: 'K11 Solutions (Above Market)', priceIndex: 116.0, marginIndex: 76.7, status: 'above' },
  { name: 'L12 Technologies (Below Market)', priceIndex: 71.5, marginIndex: 101.3, status: 'below' },
  { name: 'M13 Industries (Below Market)', priceIndex: 71.0, marginIndex: 102.8, status: 'below' },
  { name: 'N14 Systems', priceIndex: 94.9, marginIndex: 96.5, status: 'at' },
  { name: 'O15 Innovations', priceIndex: 95.1, marginIndex: 107.3, status: 'at' },
  { name: 'P16 Enterprises (Below Market)', priceIndex: 86.6, marginIndex: 81.6, status: 'below' },
  { name: 'Q17 Corporation', priceIndex: 95.9, marginIndex: 99.5, status: 'at' },
  { name: 'R18 Inc (Below Market)', priceIndex: 72.1, marginIndex: 92.9, status: 'below' },
  { name: 'S19 Ltd', priceIndex: 96.6, marginIndex: 95.9, status: 'at' },
  { name: 'T20 Group', priceIndex: 107.4, marginIndex: 105.9, status: 'above' },
  { name: 'U21 Solutions (Below Market)', priceIndex: 67.9, marginIndex: 84.9, status: 'below' },
];

interface ScatterPoint {
  customer: string;
  sales: number;
  priceIndex: number;
  status: 'above' | 'at' | 'below';
}

const scatterData: ScatterPoint[] = [
  { customer: 'A1', sales: 50000, priceIndex: 135, status: 'above' },
  { customer: 'B2', sales: 150000, priceIndex: 145, status: 'above' },
  { customer: 'C3', sales: 120000, priceIndex: 155, status: 'above' },
  { customer: 'D4', sales: 80000, priceIndex: 140, status: 'above' },
  { customer: 'E5', sales: 200000, priceIndex: 100, status: 'at' },
  { customer: 'F6', sales: 180000, priceIndex: 115, status: 'at' },
  { customer: 'G7', sales: 100000, priceIndex: 105, status: 'at' },
  { customer: 'H8', sales: 220000, priceIndex: 110, status: 'at' },
  { customer: 'I9', sales: 1500000, priceIndex: 90, status: 'at' },
  { customer: 'J10', sales: 3000000, priceIndex: 100, status: 'at' },
  { customer: 'K11', sales: 4500000, priceIndex: 115, status: 'at' },
  { customer: 'L12', sales: 4800000, priceIndex: 110, status: 'at' },
  { customer: 'M13', sales: 1200000, priceIndex: 105, status: 'at' },
  { customer: 'N14', sales: 60000, priceIndex: 70, status: 'below' },
  { customer: 'O15', sales: 90000, priceIndex: 80, status: 'below' },
  { customer: 'P16', sales: 130000, priceIndex: 85, status: 'below' },
  { customer: 'Q17', sales: 110000, priceIndex: 75, status: 'below' },
  { customer: 'R18', sales: 50000, priceIndex: 60, status: 'below' },
  { customer: 'S19', sales: 70000, priceIndex: 65, status: 'below' },
  { customer: 'T20', sales: 150000, priceIndex: 80, status: 'below' },
];

export function CustomerPricePerformance({ onBack }: CustomerPricePerformanceProps) {
  const [viewMode, setViewMode] = useState<'table' | 'scatter'>('table');

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
          <h2 className="text-2xl font-bold text-slate-900">Customer Price Performance</h2>
          <p className="text-sm text-slate-600">Analyze customer pricing performance and trends</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 size={16} />
            Index View
          </button>
          <button
            onClick={() => setViewMode('scatter')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'scatter'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScatterChart size={16} />
            Funnel Analysis
          </button>
        </div>

        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>Year over Year</option>
          <option>Month over Month</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Product Families</option>
          <option>Networking</option>
          <option>Security</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Sub-Families</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Products</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Regions</option>
          <option>NA</option>
          <option>EMEA</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Sub-Regions</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Price Lists</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Industries</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium">
          <option>All Channels</option>
        </select>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="grid grid-cols-2 gap-6 p-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Customer Per Price Index</h3>
                <span className="text-xs text-slate-500">Indexed to 100</span>
              </div>
              <div className="space-y-2">
                {mockCustomers.map((customer, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-48 truncate">{customer.name}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          customer.status === 'above'
                            ? 'bg-blue-500'
                            : customer.status === 'below'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${customer.priceIndex}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-900 w-12 text-right">
                      {customer.priceIndex.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Customer Margin Index</h3>
                <span className="text-xs text-slate-500">Indexed to 100</span>
              </div>
              <div className="space-y-2">
                {mockCustomers.map((customer, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-48 truncate">{customer.name}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          customer.status === 'above'
                            ? 'bg-blue-500'
                            : customer.status === 'below'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${customer.marginIndex}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-900 w-12 text-right">
                      {customer.marginIndex.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Pricing Funnel Analysis</h3>
            <p className="text-sm text-slate-600">
              Larger customers cluster near market average (100); smaller customers show greater price dispersion
            </p>
          </div>
          <div className="relative h-96 border border-slate-200 rounded-lg p-4">
            <div className="absolute inset-0 p-4">
              <div className="relative h-full w-full">
                {scatterData.map((point, idx) => {
                  const x = (point.sales / 5000000) * 100;
                  const y = 100 - ((point.priceIndex - 50) / 100) * 100;
                  const color =
                    point.status === 'above'
                      ? 'bg-teal-500'
                      : point.status === 'at'
                      ? 'bg-blue-500'
                      : 'bg-red-500';

                  return (
                    <div
                      key={idx}
                      className={`absolute w-2 h-2 ${color} rounded-full`}
                      style={{
                        left: `${Math.min(x, 95)}%`,
                        top: `${Math.max(Math.min(y, 95), 5)}%`,
                      }}
                      title={`${point.customer}: $${point.sales.toLocaleString()} - Index: ${point.priceIndex}`}
                    />
                  );
                })}

                <div className="absolute left-0 top-1/2 w-full h-px bg-slate-300" />
                <div className="absolute left-0 top-0 bottom-0 right-0 flex items-end justify-between text-xs text-slate-500 pointer-events-none">
                  <span className="absolute bottom-0 left-0">$0M</span>
                  <span className="absolute bottom-0 left-1/4">$1.5M</span>
                  <span className="absolute bottom-0 left-1/2">$3M</span>
                  <span className="absolute bottom-0 left-3/4">$4.5M</span>
                  <span className="absolute bottom-0 right-0">$6M</span>
                </div>
                <div className="absolute top-0 left-0 h-full flex flex-col justify-between text-xs text-slate-500">
                  <span>200</span>
                  <span>130</span>
                  <span>100</span>
                  <span>50</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-slate-600 pb-2">
              Sales
            </div>
            <div className="absolute left-0 top-0 bottom-0 flex items-center">
              <span className="text-xs text-slate-600 -rotate-90 whitespace-nowrap">
                Price Index (Indexed to 100)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full" />
              <span className="text-slate-600">Above Market (Index &gt; 110)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-slate-600">At Market (90-110)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-slate-600">Below Market (Index &lt; 90)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
