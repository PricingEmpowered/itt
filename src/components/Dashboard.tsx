import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, DollarSign, FileText, Users, Clock, Package, ShoppingCart, CheckCircle2, AlertCircle, TrendingDown, Award, XCircle, Percent, Target, BarChart3, Layers } from 'lucide-react';
import { DealScoreIndicator } from './DealScoreIndicator';
import { PricePerformanceChart } from './dashboard/PricePerformanceChart';
import { MarginAnalysisChart } from './dashboard/MarginAnalysisChart';
import { DashboardFilters } from './dashboard/DashboardFilters';

interface DashboardStats {
  totalQuotes: number;
  totalRevenue: number;
  averageDiscount: number;
  pendingApprovals: number;
  activeProducts: number;
  totalCustomers: number;
  wonQuotes: number;
  lostQuotes: number;
  winRate: number;
  averageQuoteValue: number;
  averageMargin: number;
  averageDealScore: number;
  excellentDeals: number;
  goodDeals: number;
  poorDeals: number;
}

interface QuotesByStatus {
  status: string;
  count: number;
  total_value: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalQuotes: 0,
    totalRevenue: 0,
    averageDiscount: 0,
    pendingApprovals: 0,
    activeProducts: 0,
    totalCustomers: 0,
    wonQuotes: 0,
    lostQuotes: 0,
    winRate: 0,
    averageQuoteValue: 0,
    averageMargin: 0,
    averageDealScore: 0,
    excellentDeals: 0,
    goodDeals: 0,
    poorDeals: 0,
  });
  const [quotesByStatus, setQuotesByStatus] = useState<QuotesByStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillDownStatus, setDrillDownStatus] = useState<string | null>(null);
  const [drillDownQuotes, setDrillDownQuotes] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    productFamily: 'all',
    timeframe: 'year',
    region: 'all',
    channel: 'all',
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDrillDown = async (status: string) => {
    try {
      let query = supabase
        .from('quotes')
        .select('*, customers(name)');

      if (status === 'Win Rate') {
        query = query.in('status', ['Approved', 'Rejected']);
      } else {
        query = query.eq('status', status);
      }

      const { data } = await query.order('created_at', { ascending: false });

      setDrillDownQuotes(data || []);
      setDrillDownStatus(status);
    } catch (error) {
      console.error('Error loading drill-down data:', error);
    }
  };

  const closeDrillDown = () => {
    setDrillDownStatus(null);
    setDrillDownQuotes([]);
  };

  const loadDashboardData = async () => {
    try {
      const [quotesRes, approvalsRes, productsRes, customersRes, quoteLinesRes] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('approval_requests').select('*').eq('status', 'Pending'),
        supabase.from('products').select('*').eq('status', 'Active'),
        supabase.from('customers').select('*'),
        supabase.from('quote_lines').select('discount_applied, unit_price, products(base_cost)'),
      ]);

      const quotes = quotesRes.data || [];
      const customers = customersRes.data || [];
      const totalRevenue = customers.reduce((sum, c) => sum + (Number(c.annual_revenue) || 0), 0);

      const quoteLines = quoteLinesRes.data || [];
      const avgDiscount = quoteLines.length > 0
        ? quoteLines.reduce((sum, line) => sum + (line.discount_applied || 0), 0) / quoteLines.length
        : 0;

      let totalMargin = 0;
      let marginCount = 0;
      quoteLines.forEach((line: any) => {
        if (line.unit_price && line.products?.base_cost) {
          const effectivePrice = line.unit_price * (1 - (line.discount_applied || 0) / 100);
          const margin = ((effectivePrice - line.products.base_cost) / effectivePrice) * 100;
          if (!isNaN(margin) && isFinite(margin)) {
            totalMargin += margin;
            marginCount++;
          }
        }
      });
      const avgMargin = marginCount > 0 ? totalMargin / marginCount : 0;

      const wonQuotes = quotes.filter(q => q.status === 'Approved').length;
      const lostQuotes = quotes.filter(q => q.status === 'Rejected').length;
      const totalDecided = wonQuotes + lostQuotes;
      const winRate = totalDecided > 0 ? (wonQuotes / totalDecided) * 100 : 0;

      const totalQuoteValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
      const averageQuoteValue = quotes.length > 0 ? totalQuoteValue / quotes.length : 0;

      const quotesWithScores = quotes.filter(q => q.deal_score !== null && q.deal_score !== undefined);
      const avgDealScore = quotesWithScores.length > 0
        ? quotesWithScores.reduce((sum, q) => sum + q.deal_score, 0) / quotesWithScores.length
        : 0;
      const excellentDeals = quotesWithScores.filter(q => q.deal_score >= 110).length;
      const goodDeals = quotesWithScores.filter(q => q.deal_score >= 90 && q.deal_score < 110).length;
      const poorDeals = quotesWithScores.filter(q => q.deal_score < 90).length;

      const statusCounts: Record<string, QuotesByStatus> = {};
      quotes.forEach((quote) => {
        const status = quote.status || 'Unknown';
        if (!statusCounts[status]) {
          statusCounts[status] = { status, count: 0, total_value: 0 };
        }
        statusCounts[status].count++;
        statusCounts[status].total_value += quote.total || 0;
      });

      setStats({
        totalQuotes: quotes.length,
        totalRevenue,
        averageDiscount: avgDiscount,
        pendingApprovals: approvalsRes.data?.length || 0,
        activeProducts: productsRes.data?.length || 0,
        totalCustomers: customersRes.data?.length || 0,
        wonQuotes,
        lostQuotes,
        winRate,
        averageQuoteValue,
        averageMargin: avgMargin,
        averageDealScore: avgDealScore,
        excellentDeals,
        goodDeals,
        poorDeals,
      });

      setQuotesByStatus(Object.values(statusCounts));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-slate-600 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-600 mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
          <Clock className="text-slate-400" size={16} />
          <span className="text-sm text-slate-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<FileText className="text-emerald-600" size={28} />}
          label="Total Quotes"
          value={stats.totalQuotes.toString()}
          trend="+12.5%"
          trendUp={true}
          bgGradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          icon={<DollarSign className="text-blue-600" size={28} />}
          label="Avg Quote Value"
          value={`$${(stats.averageQuoteValue / 1000).toFixed(0)}K`}
          trend="+8.20%"
          trendUp={true}
          bgGradient="from-blue-500 to-blue-600"
        />
        <StatCard
          icon={<Award className="text-emerald-600" size={28} />}
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          trend="+5.3%"
          trendUp={true}
          bgGradient="from-emerald-500 to-teal-600"
        />
        <StatCard
          icon={<Percent className="text-purple-600" size={28} />}
          label="Avg Margin"
          value={`${stats.averageMargin.toFixed(1)}%`}
          trend="+3.2%"
          trendUp={true}
          bgGradient="from-purple-500 to-purple-600"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Deal Score Overview</h3>
            <p className="text-sm text-slate-600 mt-1">Performance benchmarking against historical data</p>
          </div>
          {stats.averageDealScore > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Average Score:</span>
              <DealScoreIndicator score={stats.averageDealScore} size="medium" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <Target className="text-green-600" size={24} />
              <span className="text-3xl font-bold text-green-700">{stats.excellentDeals}</span>
            </div>
            <h4 className="text-sm font-medium text-green-900">Excellent Deals</h4>
            <p className="text-xs text-green-700 mt-1">Score 110+ (Above average)</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <Target className="text-yellow-600" size={24} />
              <span className="text-3xl font-bold text-yellow-700">{stats.goodDeals}</span>
            </div>
            <h4 className="text-sm font-medium text-yellow-900">Good Deals</h4>
            <p className="text-xs text-yellow-700 mt-1">Score 90-110 (Average range)</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-6 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="text-red-600" size={24} />
              <span className="text-3xl font-bold text-red-700">{stats.poorDeals}</span>
            </div>
            <h4 className="text-sm font-medium text-red-900">Needs Attention</h4>
            <p className="text-xs text-red-700 mt-1">Score &lt;90 (Below average)</p>
          </div>
        </div>
      </div>

      <DashboardFilters filters={filters} onFiltersChange={setFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Price Performance</h2>
                <p className="text-sm text-slate-500">Index trends over time</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <PricePerformanceChart filters={filters} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Layers className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Margin Analysis</h2>
                <p className="text-sm text-slate-500">Causality breakdown</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <MarginAnalysisChart filters={filters} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => loadDrillDown('Approved')}
            className={`bg-white rounded-2xl shadow-sm border-2 p-6 cursor-pointer hover:shadow-md transition-all ${
              drillDownStatus === 'Approved' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-bold text-emerald-600">{stats.wonQuotes}</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600">Won Quotes</h3>
            <p className="text-xs text-slate-500 mt-1">Click to view details</p>
          </div>

          <div
            onClick={() => loadDrillDown('Rejected')}
            className={`bg-white rounded-2xl shadow-sm border-2 p-6 cursor-pointer hover:shadow-md transition-all ${
              drillDownStatus === 'Rejected' ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                <XCircle className="text-white" size={24} />
              </div>
              <span className="text-2xl font-bold text-red-600">{stats.lostQuotes}</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600">Lost Quotes</h3>
            <p className="text-xs text-slate-500 mt-1">Click to view details</p>
          </div>

          <div
            onClick={() => loadDrillDown('Win Rate')}
            className={`bg-white rounded-2xl shadow-sm border-2 p-6 cursor-pointer hover:shadow-md transition-all ${
              drillDownStatus === 'Win Rate' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <TrendingUp className="text-white" size={24} />
              </div>
              <span className="text-2xl font-bold text-blue-600">{stats.winRate.toFixed(1)}%</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600">Win Rate</h3>
            <p className="text-xs text-slate-500 mt-1">{stats.wonQuotes} won / {stats.lostQuotes} lost • Click to view</p>
          </div>
        </div>

        {drillDownStatus && drillDownQuotes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{drillDownStatus === 'Win Rate' ? 'Decided Quotes' : `${drillDownStatus} Quotes`}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {drillDownQuotes.length} quotes • Total: ${(drillDownQuotes.reduce((sum, q) => sum + (q.total || 0), 0) / 1000).toFixed(0)}K
                  </p>
                </div>
                <button
                  onClick={closeDrillDown}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Quote ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      {drillDownStatus === 'Win Rate' ? 'Result' : 'Status'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {drillDownQuotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        Q-{quote.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {quote.customers?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        ${(quote.total / 1000).toFixed(1)}K
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          quote.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : quote.status === 'Rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {drillDownStatus === 'Win Rate'
                            ? (quote.status === 'Approved' ? 'Won' : 'Lost')
                            : quote.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Quotes by Status</h3>
            <ShoppingCart className="text-slate-400" size={20} />
          </div>
          <div className="space-y-4">
            {quotesByStatus.map((statusData) => {
              const percentage = stats.totalQuotes > 0
                ? (statusData.count / stats.totalQuotes) * 100
                : 0;

              let colorClass = 'bg-slate-200';
              let textColor = 'text-slate-700';
              let iconColor = 'text-slate-500';

              if (statusData.status === 'Approved') {
                colorClass = 'bg-emerald-500';
                textColor = 'text-emerald-700';
                iconColor = 'text-emerald-600';
              } else if (statusData.status === 'Under Review') {
                colorClass = 'bg-yellow-500';
                textColor = 'text-yellow-700';
                iconColor = 'text-yellow-600';
              } else if (statusData.status === 'Draft') {
                colorClass = 'bg-slate-500';
                textColor = 'text-slate-700';
                iconColor = 'text-slate-600';
              } else if (statusData.status === 'Rejected') {
                colorClass = 'bg-red-500';
                textColor = 'text-red-700';
                iconColor = 'text-red-600';
              }

              return (
                <div
                  key={statusData.status}
                  onClick={() => loadDrillDown(statusData.status)}
                  className="space-y-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusData.status === 'Approved' && <CheckCircle2 className={iconColor} size={18} />}
                      {statusData.status === 'Under Review' && <AlertCircle className={iconColor} size={18} />}
                      {statusData.status === 'Draft' && <FileText className={iconColor} size={18} />}
                      {statusData.status === 'Rejected' && <AlertCircle className={iconColor} size={18} />}
                      <span className={`text-sm font-medium ${textColor}`}>{statusData.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-slate-900">{statusData.count} quotes</span>
                      <span className="text-xs text-slate-500">${(statusData.total_value / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`${colorClass} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Key Metrics</h3>
            <TrendingUp className="text-slate-400" size={20} />
          </div>
          <div className="space-y-6">
            <MetricRow
              label="Average Discount"
              value={`${stats.averageDiscount.toFixed(2)}%`}
              icon={<DollarSign size={18} className="text-emerald-600" />}
            />
            <MetricRow
              label="Pending Approvals"
              value={stats.pendingApprovals.toString()}
              icon={<Clock size={18} className="text-yellow-600" />}
              alert={stats.pendingApprovals > 0}
            />
            <MetricRow
              label="Total Customers"
              value={stats.totalCustomers.toString()}
              icon={<Users size={18} className="text-blue-600" />}
            />
            <MetricRow
              label="Total Products"
              value={stats.activeProducts.toString()}
              icon={<Package size={18} className="text-violet-600" />}
            />
            <MetricRow
              label="Average Gross Margin"
              value={`${stats.averageMargin.toFixed(1)}%`}
              icon={<Percent size={18} className="text-purple-600" />}
            />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">Ready to create a new quote?</h3>
            <p className="text-emerald-100 text-sm">
              Access our full product catalog and intelligent pricing engine to build winning proposals.
            </p>
          </div>
          <button className="px-6 py-3 bg-white text-emerald-600 rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105">
            Create Quote
          </button>
        </div>
      </div>

    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  bgGradient: string;
}

function StatCard({ icon, label, value, trend, trendUp, bgGradient }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-600 text-sm font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mb-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              <TrendingUp
                size={14}
                className={trendUp ? 'text-emerald-600' : 'text-red-600'}
              />
              <span className={`text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend}
              </span>
              <span className="text-xs text-slate-500">vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${bgGradient} flex items-center justify-center shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  alert?: boolean;
}

function MetricRow({ label, value, icon, alert }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-slate-900">{value}</span>
        {alert && (
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}
