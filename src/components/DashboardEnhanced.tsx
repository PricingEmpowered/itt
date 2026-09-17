import { useState, useMemo, useCallback, useRef } from 'react';
import { DollarSign, FileText, TrendingUp, Users, BarChart3, Camera, Target, Activity, Award, Package } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { LoadingSpinner } from './LoadingSpinner';
import { StatCard, MetricCard } from './dashboard/StatCard';
import { DashboardFilters, type DashboardChartFilters } from './dashboard/DashboardFilters';
import { PricePerformanceChart } from './dashboard/PricePerformanceChart';
import { MarginAnalysisChart } from './dashboard/MarginAnalysisChart';
import { DrillDownModal } from './dashboard/DrillDownModal';
import html2canvas from 'html2canvas';
import { formatCurrency as fmtCurrency, formatNumber, formatPercent, MISSING } from '../utils/format';
import { getDealScoreBgColor } from '../utils/dealScoreCalculator';

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

/*
 * Colours for the pricing metric strip, keyed by metric. The values
 * themselves come from dashboard.overview; this is presentation only.
 *
 * What was here before was the values: ten cards of hardcoded percentages
 * ("Contribution Margin per Product 34.70%, +10.70%") with no query behind
 * them, which on a demo against real client data read as findings about that
 * data.
 */
const METRIC_GRADIENTS: Record<string, string> = {
  contribution_margin: 'bg-gradient-to-br from-lime-500 to-lime-600',
  net_price_realization: 'bg-gradient-to-br from-blue-500 to-blue-600',
  price_leakage: 'bg-gradient-to-br from-rose-500 to-rose-600',
  average_discount: 'bg-gradient-to-br from-orange-500 to-orange-600',
  quoted_value: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  revenue_growth_from_pricing: 'bg-gradient-to-br from-sky-500 to-sky-600',
  incremental_revenue_per_price_change: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  customer_lifetime_value: 'bg-gradient-to-br from-purple-500 to-purple-600',
  price_optimization_velocity: 'bg-gradient-to-br from-blue-400 to-blue-500',
  price_variance_change: 'bg-gradient-to-br from-slate-500 to-slate-600',
};

const EMPTY_METRICS: DashboardMetrics = {
  revenue_12m: 0,
  revenue_prev_12m: 0,
  active_quotes_12m: 0,
  active_quotes_prev_12m: 0,
  win_rate_12m: 0,
  win_rate_prev_12m: 0,
  active_customers_12m: 0,
  active_customers_prev_12m: 0,
};

export function DashboardEnhanced() {
  const [filters, setFilters] = useState<DashboardChartFilters>({
    periodDays: 365,
    familyId: null,
    region: null,
    channel: null,
  });

  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    metric: any;
  }>({ isOpen: false, metric: null });

  const statsRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<HTMLDivElement>(null);
  const marginChartRef = useRef<HTMLDivElement>(null);

  const metricsQuery = trpc.dashboard.metrics.useQuery({ periodDays: filters.periodDays });
  const overviewQuery = trpc.dashboard.overview.useQuery({ periodDays: filters.periodDays });
  const overview = overviewQuery.data ?? null;

  /*
   * The dashboard renders zeroes rather than nothing when metrics are
   * unavailable, so a reporting failure does not blank the landing page. The
   * error is surfaced separately below.
   */
  const metrics: DashboardMetrics | null = metricsQuery.data
    ? (metricsQuery.data as unknown as DashboardMetrics)
    : metricsQuery.isError
      ? EMPTY_METRICS
      : null;
  const loading = metricsQuery.isLoading;
  const error = metricsQuery.error?.message ?? null;

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
            onClick={() => metricsQuery.refetch()}
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
      {/*
        This position previously held four hardcoded <select> elements with no
        value or onChange -- they listed options but controlled nothing. The
        real filter control lives here now, so the dashboard has one filter bar
        that actually drives the charts below.
      */}
      <DashboardFilters filters={filters} onFiltersChange={setFilters} />

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
          {overviewQuery.isLoading && (
            <p className="text-sm text-slate-500">Computing pricing metrics...</p>
          )}
          {overviewQuery.isError && (
            <p className="text-sm text-red-600">
              Could not compute pricing metrics: {overviewQuery.error.message}
            </p>
          )}
          <div className="flex gap-4 min-w-max">
            {(overview?.pricingMetrics ?? []).map((metric, index) => {
              const value =
                metric.value === null
                  ? null
                  : metric.unit === 'currency'
                    ? fmtCurrency(metric.value, { decimals: 0 })
                    : metric.unit === 'percent'
                      ? formatPercent(metric.value, { decimals: 2 })
                      : formatNumber(metric.value);
              /*
               * The badge says how much of the data the figure covers rather
               * than a change against a prior period: with one window of
               * quote history there is nothing to compare against, and the
               * "+10.70%" these cards used to show was invented.
               */
              const badge =
                metric.basis !== null && metric.total !== null && metric.total > 0
                  ? metric.basis === metric.total
                    ? `all ${formatNumber(metric.total)} lines`
                    : `${formatNumber(metric.basis)} of ${formatNumber(metric.total)} lines`
                  : undefined;
              return (
                <MetricCard
                  key={metric.key}
                  title={metric.title}
                  value={value}
                  badge={badge}
                  unavailable={metric.unavailable}
                  number={String(index + 1)}
                  gradient={METRIC_GRADIENTS[metric.key] ?? 'bg-gradient-to-br from-slate-500 to-slate-600'}
                  onClick={() =>
                    handleCardClick({
                      title: metric.title,
                      value: value ?? MISSING,
                      badge: badge ?? metric.unavailable ?? '',
                      gradient: METRIC_GRADIENTS[metric.key] ?? '',
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      <DrillDownModal
        isOpen={drillDownModal.isOpen}
        onClose={closeDrillDown}
        metric={drillDownModal.metric || { title: '', value: '', badge: '', gradient: '' }}
      />

      {/*
        Deal score health, recent activity, commission overview and top
        products. The walkthrough presents all four on the landing page and
        none of them existed on it.
      */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Deal Score Health</h2>
            </div>
            <div className="p-6">
              {overview.dealScore.scored === 0 ? (
                <p className="text-sm text-slate-500">
                  None of the {formatNumber(overview.dealScore.total)} quotes in this
                  window has been scored. Run <code>npm run score-quotes</code> to
                  score the existing history.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-4xl font-bold text-slate-900">
                      {formatNumber(overview.dealScore.average, { decimals: 1 })}
                    </span>
                    <span className="text-sm text-slate-500">
                      average across {formatNumber(overview.dealScore.scored)} of{' '}
                      {formatNumber(overview.dealScore.total)} quotes
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Excellent (110+)', count: overview.dealScore.excellent, bar: 'bg-emerald-500' },
                      { label: 'Good (90-109)', count: overview.dealScore.good, bar: 'bg-amber-400' },
                      { label: 'Needs attention (<90)', count: overview.dealScore.attention, bar: 'bg-red-500' },
                    ].map((band) => (
                      <div key={band.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-44 shrink-0">{band.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`${band.bar} h-full rounded-full`}
                            style={{
                              width: `${
                                overview.dealScore.scored > 0
                                  ? (band.count / overview.dealScore.scored) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-12 text-right tabular-nums">
                          {formatNumber(band.count)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {overview.dealScore.scored < overview.dealScore.total && (
                    <p className="text-xs text-slate-500 mt-4">
                      {formatNumber(overview.dealScore.total - overview.dealScore.scored)}{' '}
                      quote(s) could not be scored - their customers have no industry or
                      region, so there is no cohort to benchmark against.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.recentActivity.length === 0 && (
                <p className="p-6 text-sm text-slate-500">No quotes yet.</p>
              )}
              {overview.recentActivity.map((quote: any) => (
                <div key={quote.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {quote.customer_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {quote.id} &middot;{' '}
                      {quote.activity_at
                        ? new Date(quote.activity_at).toLocaleDateString()
                        : MISSING}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {quote.deal_score !== null && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${getDealScoreBgColor(
                          Number(quote.deal_score)
                        )}`}
                      >
                        {formatNumber(quote.deal_score, { decimals: 0 })}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">{quote.status}</span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums w-24 text-right">
                      {fmtCurrency(quote.total, { decimals: 0 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Commission Overview</h2>
            </div>
            <div className="p-6">
              {overview.commissions.records === 0 ? (
                <p className="text-sm text-slate-500">
                  No commissions recorded. A commission is written when a quote is
                  won through the quote builder, so this fills in as deals close.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total', value: overview.commissions.total },
                    { label: 'Paid', value: overview.commissions.paid },
                    { label: 'Pending', value: overview.commissions.pending },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-xl font-bold text-slate-900">
                        {fmtCurrency(item.value, { decimals: 0 })}
                      </div>
                    </div>
                  ))}
                  <div className="col-span-3 text-xs text-slate-500">
                    {formatNumber(overview.commissions.records)} record(s) across{' '}
                    {formatNumber(overview.commissions.reps)} rep(s)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Top Products by Quoted Value</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.topProducts.length === 0 && (
                <p className="p-6 text-sm text-slate-500">
                  No quoted line in this window carries a value.
                </p>
              )}
              {overview.topProducts.map((product: any) => (
                <div key={product.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatNumber(product.units)} unit(s) over{' '}
                      {formatNumber(product.quote_count)} quote(s)
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {fmtCurrency(product.revenue, { decimals: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
