import { useState, useEffect } from 'react';
import { BarChart3, Package, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QuantityBreaksDetailModal } from './QuantityBreaksDetailModal';

interface ProductOrderingPattern {
  product_id: string;
  product_name: string;
  product_category: string;
  times_ordered: number;
  total_quantity_ordered: number;
  avg_quantity_per_order: number;
  min_quantity: number;
  max_quantity: number;
  avg_unit_price: number;
  avg_discount_percent: number;
  total_revenue: number;
}

interface QuantityBreakEffectiveness {
  product_id: string;
  product_name: string;
  break_tier: string;
  min_quantity: number;
  max_quantity: number | null;
  discount_percent: number;
  times_triggered: number;
  total_quantity_in_tier: number;
  avg_order_size_in_tier: number;
  revenue_in_tier: number;
  discount_cost: number;
  effectiveness_score: number;
}

interface QuantityDistribution {
  quantity_range: string;
  order_count: number;
  total_revenue: number;
  avg_discount: number;
}

export function QuantityBreaksAnalytics() {
  const [orderingPatterns, setOrderingPatterns] = useState<ProductOrderingPattern[]>([]);
  const [breakEffectiveness, setBreakEffectiveness] = useState<QuantityBreakEffectiveness[]>([]);
  const [quantityDistribution, setQuantityDistribution] = useState<QuantityDistribution[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOrderingPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    patterns: true,
    effectiveness: true,
    distribution: true,
    recommendations: true
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOrderingPatterns(),
        loadBreakEffectiveness(),
        loadQuantityDistribution()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderingPatterns = async () => {
    const { data, error } = await supabase.rpc('execute_analytics_query', {
      query: `
        SELECT
          ql.product_id,
          p.name as product_name,
          p.category as product_category,
          COUNT(DISTINCT ql.quote_id) as times_ordered,
          SUM(ql.quantity) as total_quantity_ordered,
          AVG(ql.quantity) as avg_quantity_per_order,
          MIN(ql.quantity) as min_quantity,
          MAX(ql.quantity) as max_quantity,
          AVG(ql.unit_price) as avg_unit_price,
          AVG(COALESCE(ql.discount_applied, 0)) as avg_discount_percent,
          SUM(ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)) as total_revenue
        FROM quote_lines ql
        JOIN products p ON p.id = ql.product_id
        JOIN quotes q ON q.id = ql.quote_id
        WHERE q.status != 'Cancelled'
        GROUP BY ql.product_id, p.name, p.category
        ORDER BY total_quantity_ordered DESC
        LIMIT 50
      `
    });

    if (error) throw error;
    setOrderingPatterns(data || []);
  };

  const loadBreakEffectiveness = async () => {
    const { data, error } = await supabase.rpc('execute_analytics_query', {
      query: `
        WITH quantity_break_usage AS (
          SELECT
            ql.product_id,
            p.name as product_name,
            qb.id as break_id,
            qb.min_quantity,
            qb.max_quantity,
            qb.discount_percent,
            COUNT(*) as times_triggered,
            SUM(ql.quantity) as total_quantity_in_tier,
            AVG(ql.quantity) as avg_order_size_in_tier,
            SUM(ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)) as revenue_in_tier,
            SUM(ql.quantity * ql.unit_price * COALESCE(ql.discount_applied, 0) / 100) as discount_cost
          FROM quote_lines ql
          JOIN products p ON p.id = ql.product_id
          JOIN quotes q ON q.id = ql.quote_id
          JOIN quantity_breaks qb ON qb.product_id = ql.product_id
          WHERE q.status != 'Cancelled'
            AND ql.quantity >= qb.min_quantity
            AND (qb.max_quantity IS NULL OR ql.quantity <= qb.max_quantity)
          GROUP BY ql.product_id, p.name, qb.id, qb.min_quantity, qb.max_quantity, qb.discount_percent
        )
        SELECT
          product_id,
          product_name,
          CASE
            WHEN max_quantity IS NULL THEN min_quantity::text || '+'
            ELSE min_quantity::text || '-' || max_quantity::text
          END as break_tier,
          min_quantity,
          max_quantity,
          discount_percent,
          times_triggered,
          total_quantity_in_tier,
          ROUND(avg_order_size_in_tier, 2) as avg_order_size_in_tier,
          ROUND(revenue_in_tier, 2) as revenue_in_tier,
          ROUND(discount_cost, 2) as discount_cost,
          ROUND(
            CASE
              WHEN discount_cost > 0 THEN (revenue_in_tier / discount_cost)
              ELSE 0
            END,
            2
          ) as effectiveness_score
        FROM quantity_break_usage
        ORDER BY product_name, min_quantity
      `
    });

    if (error) throw error;
    setBreakEffectiveness(data || []);
  };

  const loadQuantityDistribution = async () => {
    const { data, error } = await supabase.rpc('execute_analytics_query', {
      query: `
        SELECT
          CASE
            WHEN quantity <= 5 THEN '1-5'
            WHEN quantity <= 10 THEN '6-10'
            WHEN quantity <= 20 THEN '11-20'
            WHEN quantity <= 50 THEN '21-50'
            WHEN quantity <= 100 THEN '51-100'
            ELSE '100+'
          END as quantity_range,
          COUNT(*) as order_count,
          SUM(quantity * unit_price * (1 - COALESCE(discount_applied, 0) / 100)) as total_revenue,
          AVG(COALESCE(discount_applied, 0)) as avg_discount
        FROM quote_lines ql
        JOIN quotes q ON q.id = ql.quote_id
        WHERE q.status != 'Cancelled'
        GROUP BY quantity_range
        ORDER BY
          CASE quantity_range
            WHEN '1-5' THEN 1
            WHEN '6-10' THEN 2
            WHEN '11-20' THEN 3
            WHEN '21-50' THEN 4
            WHEN '51-100' THEN 5
            WHEN '100+' THEN 6
          END
      `
    });

    if (error) throw error;
    setQuantityDistribution(data || []);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getEffectivenessColor = (score: number) => {
    if (score >= 5) return 'text-emerald-600 bg-emerald-50';
    if (score >= 3) return 'text-blue-600 bg-blue-50';
    if (score >= 2) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getEffectivenessLabel = (score: number) => {
    if (score >= 5) return 'Excellent';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const filteredBreaks = selectedProduct
    ? breakEffectiveness.filter(b => b.product_id === selectedProduct.product_id)
    : breakEffectiveness;

  return (
    <div className="space-y-6">
      {selectedProduct && (
        <QuantityBreaksDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quantity Breaks Analytics</h2>
          <p className="text-slate-600 mt-1">Analyze customer ordering behavior and discount effectiveness</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>

      <div
        className="bg-white rounded-lg border border-slate-200 shadow-sm"
      >
        <button
          onClick={() => toggleSection('patterns')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center space-x-3">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Customer Ordering Patterns</h3>
          </div>
          {expandedSections.patterns ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.patterns && (
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Min-Max</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orderingPatterns.slice(0, 20).map((pattern) => (
                    <tr key={pattern.product_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{pattern.product_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{pattern.product_category}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">{pattern.times_ordered}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">{Number(pattern.avg_quantity_per_order).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{pattern.min_quantity}-{pattern.max_quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{Number(pattern.avg_discount_percent).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900 font-medium">${Number(pattern.total_revenue).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => setSelectedProduct(pattern)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <button
          onClick={() => toggleSection('effectiveness')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center space-x-3">
            <Target className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Quantity Break Effectiveness</h3>
          </div>
          {expandedSections.effectiveness ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.effectiveness && (
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-600 mb-4">
              Effectiveness Score = Revenue Generated / Discount Cost. Higher scores indicate better ROI on discounts.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Times Used</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg Order Size</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Discount Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredBreaks.map((effectiveness, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{effectiveness.product_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{effectiveness.break_tier}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">{Number(effectiveness.discount_percent).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">{effectiveness.times_triggered}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">{Number(effectiveness.avg_order_size_in_tier).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900">${Number(effectiveness.revenue_in_tier).toLocaleString(undefined, {minimumFractionDigits: 0})}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">${Number(effectiveness.discount_cost).toLocaleString(undefined, {minimumFractionDigits: 0})}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEffectivenessColor(effectiveness.effectiveness_score)}`}>
                          {Number(effectiveness.effectiveness_score).toFixed(1)}x - {getEffectivenessLabel(effectiveness.effectiveness_score)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <button
          onClick={() => toggleSection('distribution')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Order Quantity Distribution</h3>
          </div>
          {expandedSections.distribution ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.distribution && (
          <div className="px-6 pb-6 space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quantityDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quantity_range" />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="order_count" fill="#3b82f6" name="Order Count" />
                <Bar yAxisId="right" dataKey="total_revenue" fill="#10b981" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quantityDistribution.map((dist) => (
                <div key={dist.quantity_range} className="p-4 border border-slate-200 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 mb-1">Qty: {dist.quantity_range}</div>
                  <div className="text-2xl font-bold text-slate-900">{dist.order_count}</div>
                  <div className="text-sm text-slate-600 mt-2">
                    ${Number(dist.total_revenue).toLocaleString(undefined, {minimumFractionDigits: 0})} revenue
                  </div>
                  <div className="text-sm text-slate-600">
                    {Number(dist.avg_discount).toFixed(1)}% avg discount
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
