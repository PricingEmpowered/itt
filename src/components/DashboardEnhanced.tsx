import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DollarSign, FileText, TrendingUp, Users, BarChart3, Layers, ChevronDown, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './LoadingSpinner';
import { StatCard, MetricCard } from './dashboard/StatCard';
import { DashboardFilters } from './dashboard/DashboardFilters';
import { PricePerformanceChart } from './dashboard/PricePerformanceChart';
import { MarginAnalysisChart } from './dashboard/MarginAnalysisChart';
import { DrillDownModal } from './dashboard/DrillDownModal';
import html2canvas from 'html2canvas';

interface DashboardMetrics {
  revenue_12m: number;
  revenue_prev_12m: number;
  active_quotes_12m: number;
  active_quotes_prev_12m: number;
  win_rate_12m: number;
  win_rate_prev_12m: number;
  active_customers_12m: number;
  active_customers_prev_12m: number;
}

const metricsData = [
  { title: 'Contribution Margin per Product', value: '34.70%', badge: '+10.70%', gradient: 'bg-gradient-to-br from-lime-500 to-lime-600', number: '4' },
  { title: 'Revenue Growth from Pricing', value: '8.30%', badge: '+1.40%', gradient: 'bg-gradient-to-br from-sky-500 to-sky-600', number: '5' },
  { title: 'Incremental Revenue per Price Change', value: '2.40%', badge: '+0.90%', gradient: 'bg-gradient-to-br from-cyan-500 to-cyan-600', number: '6' },
  { title: 'Net Price Realization', value: '87.20%', badge: '+7.10%', gradient: 'bg-gradient-to-br from-blue-500 to-blue-600', number: '7' },
  { title: 'Average Discount', value: '18.50%', badge: '+8.20%', gradient: 'bg-gradient-to-br from-orange-500 to-orange-600', number: '8' },
  { title: 'Avg Discount Off List Price', value: '15.80%', badge: '+4.10%', gradient: 'bg-gradient-to-br from-amber-500 to-amber-600', number: '9' },
  { title: 'Price Leakage', value: '12.30%', badge: '+7.60%', gradient: 'bg-gradient-to-br from-rose-500 to-rose-600', number: '10' },
  { title: 'Customer Lifetime Value', value: '89.50%', badge: '+8.10%', gradient: 'bg-gradient-to-br from-purple-500 to-purple-600', number: '11' },
  { title: 'Price Optimization Velocity Change', value: '5.20%', badge: '+1.50%', gradient: 'bg-gradient-to-br from-blue-400 to-blue-500', number: '12' },
  { title: 'Avg Change in Price Variance', value: '4.2M/yr', badge: '+3.20%', gradient: 'bg-gradient-to-br from-slate-500 to-slate-600', number: '13' },
];

export function DashboardEnhanced() {
  const [filters, setFilters] = useState({
    productFamily: 'all',
    timeframe: 'year',
    region: 'all',
    channel: 'all',
  });

  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    metric: any;
  }>({ isOpen: false, metric: null });

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statsRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<HTMLDivElement>(null);
  const marginChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('get_dashboard_metrics');

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        setError(rpcError.message);
        // Set default metrics if there's an error
        setMetrics({
          revenue_12m: 0,
          revenue_prev_12m: 0,
          active_quotes_12m: 0,
          active_quotes_prev_12m: 0,
          win_rate_12m: 0,
          win_rate_prev_12m: 0,
          active_customers_12m: 0,
          active_customers_prev_12m: 0,
        });
        return;
      }

      if (data) {
        setMetrics(data as DashboardMetrics);
      } else {
        // Set default metrics if no data
        setMetrics({
          revenue_12m: 0,
          revenue_prev_12m: 0,
          active_quotes_12m: 0,
          active_quotes_prev_12m: 0,
          win_rate_12m: 0,
          win_rate_prev_12m: 0,
          active_customers_12m: 0,
          active_customers_prev_12m: 0,
        });
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
      // Set default metrics on error
      setMetrics({
        revenue_12m: 0,
        revenue_prev_12m: 0,
        active_quotes_12m: 0,
        active_quotes_prev_12m: 0,
        win_rate_12m: 0,
        win_rate_prev_12m: 0,
        active_customers_12m: 0,
        active_customers_prev_12m: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const calculateChange = useCallback((current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous * 100);
  }, []);

  const formatChange = useCallback((change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }, []);

  const handleCardClick = useCallback((metric: any) => {
    setDrillDownModal({ isOpen: true, metric });
  }, []);

  const closeDrillDown = useCallback(() => {
    setDrillDownModal({ isOpen: false, metric: null });
  }, []);

  const captureScreenshot = useCallback(async (ref: React.RefObject<HTMLDivElement>, sectionName: string) => {
    if (!ref.current) return;

    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${sectionName}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }, []);

  const statsData = useMemo(() => {
    if (!metrics) return [];

    const revenueChange = calculateChange(metrics.revenue_12m, metrics.revenue_prev_12m);
    const winRateChange = calculateChange(metrics.win_rate_12m, metrics.win_rate_prev_12m);
    const quotesChange = calculateChange(metrics.active_quotes_12m, metrics.active_quotes_prev_12m);
    const customersChange = calculateChange(metrics.active_customers_12m, metrics.active_customers_prev_12m);

    return [
      {
        title: 'Revenue',
        value: formatCurrency(metrics.revenue_12m),
        change: formatChange(revenueChange),
        isPositive: revenueChange >= 0,
        icon: DollarSign,
        gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
        metric: 'revenue'
      },
      {
        title: 'Win Rate',
        value: `${metrics.win_rate_12m.toFixed(1)}%`,
        change: formatChange(winRateChange),
        isPositive: winRateChange >= 0,
        icon: TrendingUp,
        gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
        metric: 'win_rate'
      },
      {
        title: 'Active Quotes',
        value: metrics.active_quotes_12m.toString(),
        change: formatChange(quotesChange),
        isPositive: quotesChange >= 0,
        icon: FileText,
        gradient: 'bg-gradient-to-br from-violet-500 to-violet-600',
        metric: 'quotes'
      },
      {
        title: 'Active Customers',
        value: metrics.active_customers_12m.toString(),
        change: formatChange(customersChange),
        isPositive: customersChange >= 0,
        icon: Users,
        gradient: 'bg-gradient-to-br from-pink-500 to-pink-600',
        metric: 'customers'
      }
    ];
  }, [metrics, calculateChange, formatCurrency, formatChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-slate-600 text-lg mb-4">Failed to load dashboard metrics</p>
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <button
            onClick={loadMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-end gap-3 mb-4">
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>Year over Year</option>
          <option>Month over Month</option>
          <option>Quarter over Quarter</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All Product Families</option>
          <option>Valves</option>
          <option>Pumps</option>
          <option>Accessories</option>
          <option>Flow Control</option>
          <option>Controls & Automation</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All Regions</option>
          <option>North America</option>
          <option>EMEA</option>
        </select>
        <select className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All Channels</option>
          <option>Direct</option>
          <option>Partner</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Key Performance Metrics</h2>
          <button
            onClick={() => captureScreenshot(statsRef, 'key-metrics')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Camera className="h-4 w-4" />
            Screenshot
          </button>
        </div>
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-6 rounded-lg">
          {statsData.map((stat) => (
            <StatCard key={stat.title} {...stat} onClick={() => handleCardClick({ title: stat.title, value: stat.value, badge: stat.change, gradient: stat.gradient })} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pricing Analytics</h2>
          <button
            onClick={() => captureScreenshot(metricsRef, 'pricing-analytics')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Camera className="h-4 w-4" />
            Screenshot
          </button>
        </div>
        <div ref={metricsRef} className="overflow-x-auto pb-2 scrollbar-visible bg-white p-6 rounded-lg">
          <div className="flex gap-4 min-w-max">
            {metricsData.map((metric) => (
              <MetricCard key={metric.title} {...metric} onClick={() => handleCardClick(metric)} />
            ))}
          </div>
        </div>
      </div>

      <DrillDownModal
        isOpen={drillDownModal.isOpen}
        onClose={closeDrillDown}
        metric={drillDownModal.metric || { title: '', value: '', badge: '', gradient: '' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div ref={priceChartRef} className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Price Performance</h2>
              </div>
              <button
                onClick={() => captureScreenshot(priceChartRef, 'price-performance')}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                Screenshot
              </button>
            </div>
          </div>
          <div className="p-6">
            <PricePerformanceChart filters={filters} />
          </div>
        </div>

        <div ref={marginChartRef} className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Margin Analysis</h2>
              </div>
              <button
                onClick={() => captureScreenshot(marginChartRef, 'margin-analysis')}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                Screenshot
              </button>
            </div>
          </div>
          <div className="p-6">
            <MarginAnalysisChart filters={filters} />
          </div>
        </div>
      </div>

    </div>
  );
}
