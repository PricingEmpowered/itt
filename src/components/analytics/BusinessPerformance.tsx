import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../LoadingSpinner';
import { TrendingUp, TrendingDown, DollarSign, FileText, Award, Users, ArrowRight } from 'lucide-react';
import { CustomerPricePerformance } from './CustomerPricePerformance';
import { CustomerSummary } from './CustomerSummary';
import { MixAnalysis } from './MixAnalysis';

interface BusinessMetrics {
  revenue: number;
  revenue_change_pct: number;
  active_quotes: number;
  active_quotes_change_pct: number;
  win_rate: number;
  win_rate_change_pct: number;
  active_customers: number;
  active_customers_change_pct: number;
  price_index: number;
  cost_index: number;
  value_gap_pct: number;
  period_start: string;
}

interface MarginData {
  margin_total: number;
  margin_from_price: number;
  margin_from_cost: number;
  margin_from_volume: number;
  margin_from_new_business: number;
  margin_from_lost_business: number;
}

const PRODUCT_FAMILIES = [
  'All Product Families',
  'Accessories',
  'Controls & Automation',
  'Flow Control',
  'Pumps',
  'Valves'
];

const REGIONS = ['All Regions', 'North America', 'Europe', 'Asia Pacific', 'Middle East', 'Latin America'];
const CHANNELS = [
  'All Channels',
  'Direct Sales',
  'Distribution',
  'Partner',
  'E-Commerce',
  'OEM',
  'System Integrator'
];

type BusinessView = 'overview' | 'customer-performance' | 'customer-summary' | 'mix-analysis';

export function BusinessPerformance() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [priceHistory, setPriceHistory] = useState<BusinessMetrics[]>([]);
  const [marginData, setMarginData] = useState<MarginData | null>(null);
  const [productFamily, setProductFamily] = useState('All Product Families');
  const [region, setRegion] = useState('All Regions');
  const [channel, setChannel] = useState('All Channels');
  const [currentView, setCurrentView] = useState<BusinessView>('overview');

  useEffect(() => {
    if (currentView === 'overview') {
      loadData();
    }
  }, [productFamily, region, channel, currentView]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('analytics_business_performance')
        .select('*')
        .eq('period_type', 'month');

      // Apply product family filter
      if (productFamily === 'All Product Families') {
        query = query.is('product_family', null);
      } else {
        query = query.eq('product_family', productFamily);
      }

      // Apply region filter
      if (region === 'All Regions') {
        query = query.is('region', null);
      } else {
        query = query.eq('region', region);
      }

      // Apply channel filter
      if (channel === 'All Channels') {
        query = query.is('channel', null);
      } else {
        query = query.eq('channel', channel);
      }

      query = query.order('period_start', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setMetrics(data[0]);
        setPriceHistory(data.slice(0, 10).reverse());
        setMarginData({
          margin_total: data[0].margin_total,
          margin_from_price: data[0].margin_from_price,
          margin_from_cost: data[0].margin_from_cost,
          margin_from_volume: data[0].margin_from_volume,
          margin_from_new_business: data[0].margin_from_new_business,
          margin_from_lost_business: data[0].margin_from_lost_business
        });
      }
    } catch (error) {
      console.error('Error loading business performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (currentView === 'customer-performance') {
    return <CustomerPricePerformance onBack={() => setCurrentView('overview')} />;
  }

  if (currentView === 'customer-summary') {
    return <CustomerSummary onBack={() => setCurrentView('overview')} />;
  }

  if (currentView === 'mix-analysis') {
    return <MixAnalysis onBack={() => setCurrentView('overview')} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalysisCard
          title="Customer Price Performance"
          description="Analyze customer pricing performance and trends"
          onClick={() => setCurrentView('customer-performance')}
        />
        <AnalysisCard
          title="Mix Analysis"
          description="Analyze impact of product and customer mix"
          onClick={() => setCurrentView('mix-analysis')}
        />
        <AnalysisCard
          title="Trend Analysis"
          description="Track price and margin trends over time"
          onClick={() => {}}
        />
        <AnalysisCard
          title="Customer Summary"
          description="View comprehensive customer performance data"
          onClick={() => setCurrentView('customer-summary')}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={productFamily}
          onChange={(e) => setProductFamily(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PRODUCT_FAMILIES.map((pf) => (
            <option key={pf} value={pf}>
              {pf}
            </option>
          ))}
        </select>

        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              icon={<DollarSign size={24} />}
              label="Revenue"
              value={formatCurrency(metrics.revenue)}
              change={metrics.revenue_change_pct}
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <KPICard
              icon={<FileText size={24} />}
              label="Active Quotes"
              value={metrics.active_quotes.toString()}
              change={metrics.active_quotes_change_pct}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <KPICard
              icon={<Award size={24} />}
              label="Win Rate"
              value={`${metrics.win_rate}%`}
              change={metrics.win_rate_change_pct}
              iconColor="text-yellow-600"
              iconBg="bg-yellow-50"
            />
            <KPICard
              icon={<Users size={24} />}
              label="Active Customers"
              value={metrics.active_customers.toString()}
              change={metrics.active_customers_change_pct}
              iconColor="text-slate-600"
              iconBg="bg-slate-50"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">
              Price Performance
            </h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {priceHistory.map((item, idx) => {
                const maxIndex = Math.max(
                  ...priceHistory.map((h) => Math.max(h.price_index, h.cost_index))
                );
                const priceHeight = (item.price_index / maxIndex) * 100;
                const costHeight = (item.cost_index / maxIndex) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col gap-0.5">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${priceHeight}%`, minHeight: '4px' }}
                      />
                      <div
                        className="w-full bg-red-400 rounded-b"
                        style={{ height: `${costHeight}%`, minHeight: '4px' }}
                      />
                    </div>
                    <span className="text-xs text-slate-600">
                      {new Date(item.period_start).toLocaleDateString('en-US', {
                        month: 'short'
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span className="text-slate-600">Price Index</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-400 rounded" />
                <span className="text-slate-600">Cost Index</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Value Gap: {metrics.value_gap_pct}%</span>
              </div>
            </div>
          </div>

          {marginData && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Margin Analysis
              </h3>
              <div className="h-64 flex items-end justify-between gap-4">
                <MarginBar label="Last Year" value={marginData.margin_total * 0.85} />
                <MarginBar
                  label="Price"
                  value={marginData.margin_from_price}
                  isPositive
                />
                <MarginBar
                  label="Cost"
                  value={marginData.margin_from_cost}
                  isNegative
                />
                <MarginBar
                  label="Volume"
                  value={marginData.margin_from_volume}
                  isPositive
                />
                <MarginBar
                  label="New Business"
                  value={marginData.margin_from_new_business}
                  isPositive
                />
                <MarginBar
                  label="Lost Business"
                  value={marginData.margin_from_lost_business}
                  isNegative
                />
                <MarginBar label="This Year" value={marginData.margin_total} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number;
  iconColor: string;
  iconBg: string;
}

function KPICard({ icon, label, value, change, iconColor, iconBg }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-sm font-medium">{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
      {change !== null && (
        <div className="text-xs text-slate-500 mt-1">vs last month</div>
      )}
    </div>
  );
}

interface MarginBarProps {
  label: string;
  value: number;
  isPositive?: boolean;
  isNegative?: boolean;
}

function MarginBar({ label, value, isPositive, isNegative }: MarginBarProps) {
  const maxValue = 900000;
  const height = (Math.abs(value) / maxValue) * 100;
  const bgColor = isNegative ? 'bg-red-500' : isPositive ? 'bg-green-500' : 'bg-blue-600';

  return (
    <div className="flex-1 flex flex-col items-center">
      <div
        className={`w-full ${bgColor} rounded-t transition-all`}
        style={{ height: `${height}%`, minHeight: '8px' }}
      />
      <span className="text-xs text-slate-600 mt-2 text-center">{label}</span>
      <span className="text-xs font-medium text-slate-900 mt-1">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          notation: 'compact'
        }).format(value)}
      </span>
    </div>
  );
}

interface AnalysisCardProps {
  title: string;
  description: string;
  onClick: () => void;
}

function AnalysisCard({ title, description, onClick }: AnalysisCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-left hover:shadow-md hover:border-blue-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-slate-600">{description}</p>
    </button>
  );
}
