import { useState, useEffect } from 'react';
import { X, TrendingUp, AlertCircle, CheckCircle, Target, Package } from 'lucide-react';
import { trpcClient } from '../lib/trpcClient';
import { db } from '../lib/dataClient';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Area } from 'recharts';

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

interface QuantityHistogramData {
  quantity_bucket: string;
  bucket_min: number;
  bucket_max: number;
  order_count: number;
  total_quantity: number;
  avg_discount: number;
  total_revenue: number;
}

interface CurrentBreak {
  min_quantity: number;
  max_quantity: number | null;
  discount_percent: number;
  times_used: number;
}

interface Props {
  product: ProductOrderingPattern;
  onClose: () => void;
}

export function QuantityBreaksDetailModal({ product, onClose }: Props) {
  const [histogram, setHistogram] = useState<QuantityHistogramData[]>([]);
  const [currentBreaks, setCurrentBreaks] = useState<CurrentBreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetailedData();
  }, [product.product_id]);

  const loadDetailedData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHistogram(),
        loadCurrentBreaks()
      ]);
    } catch (error) {
      console.error('Error loading detailed data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistogram = async () => {
    setHistogram(
      (await trpcClient.analytics.productQuantityHistogram.query({
        productId: product.product_id,
      })) as unknown as QuantityHistogramData[]
    );
  };

  const loadCurrentBreaks = async () => {
    const { data, error } = await db
      .from('quantity_breaks')
      .select('min_quantity, max_quantity, discount_percent')
      .eq('product_id', product.product_id)
      .is('price_list_id', null)
      .order('min_quantity');

    if (error) throw error;

    const breaksWithUsage = await Promise.all((data || []).map(async (brk) => {
      const { count } = await db
        .from('quote_lines')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product.product_id)
        .gte('quantity', brk.min_quantity)
        .lte('quantity', brk.max_quantity || 999999);

      return {
        ...brk,
        times_used: count || 0
      };
    }));

    setCurrentBreaks(breaksWithUsage);
  };

  const generateRecommendations = () => {
    const recommendations: { type: 'success' | 'warning' | 'info'; message: string }[] = [];

    const avgQty = product.avg_quantity_per_order;
    const maxQty = product.max_quantity;
    const ordersCount = product.times_ordered;

    if (histogram.length === 0) {
      return [{ type: 'info' as const, message: 'No order data available for analysis' }];
    }

    const totalOrders = histogram.reduce((sum, h) => sum + h.order_count, 0);
    const highVolumeOrders = histogram
      .filter(h => h.bucket_min > avgQty)
      .reduce((sum, h) => sum + h.order_count, 0);

    const highVolumePercent = (highVolumeOrders / totalOrders) * 100;

    if (currentBreaks.length === 0) {
      recommendations.push({
        type: 'warning',
        message: `No quantity breaks configured. With ${ordersCount} orders averaging ${avgQty.toFixed(1)} units, consider adding tiered pricing.`
      });
    }

    if (highVolumePercent > 30) {
      recommendations.push({
        type: 'success',
        message: `${highVolumePercent.toFixed(0)}% of orders exceed average quantity - current breaks are driving volume effectively.`
      });
    } else if (highVolumePercent < 15) {
      recommendations.push({
        type: 'warning',
        message: `Only ${highVolumePercent.toFixed(0)}% of orders exceed average quantity - consider more aggressive discounts to drive volume.`
      });
    }

    const mostCommonBucket = histogram.reduce((prev, curr) =>
      curr.order_count > prev.order_count ? curr : prev
    );

    if (!currentBreaks.some(b =>
      b.min_quantity <= mostCommonBucket.bucket_min &&
      (b.max_quantity === null || b.max_quantity >= mostCommonBucket.bucket_max)
    )) {
      recommendations.push({
        type: 'info',
        message: `Most orders (${mostCommonBucket.order_count}) fall in ${mostCommonBucket.quantity_bucket} range - consider adding a break here.`
      });
    }

    const gapAnalysis = [];
    for (let i = 0; i < histogram.length - 1; i++) {
      const current = histogram[i];
      const next = histogram[i + 1];
      if (next.bucket_min - current.bucket_max > 1) {
        const hasBreakInGap = currentBreaks.some(b =>
          b.min_quantity > current.bucket_max && b.min_quantity < next.bucket_min
        );
        if (!hasBreakInGap && current.order_count > 3 && next.order_count > 3) {
          gapAnalysis.push({
            type: 'info' as const,
            message: `Consider adding a break between ${current.quantity_bucket} and ${next.quantity_bucket} to capture orders in that range.`
          });
        }
      }
    }

    if (product.avg_discount_percent > 15) {
      recommendations.push({
        type: 'warning',
        message: `Average discount is ${product.avg_discount_percent.toFixed(1)}% - consider reducing discounts or restructuring tiers.`
      });
    }

    if (maxQty > avgQty * 4 && currentBreaks.length < 3) {
      recommendations.push({
        type: 'info',
        message: `Wide quantity range (${product.min_quantity}-${maxQty}) with only ${currentBreaks.length} breaks - add more tiers for better granularity.`
      });
    }

    const unusedBreaks = currentBreaks.filter(b => b.times_used === 0);
    if (unusedBreaks.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${unusedBreaks.length} break(s) never used: ${unusedBreaks.map(b => `${b.min_quantity}+`).join(', ')} - consider adjusting thresholds.`
      });
    }

    return [...recommendations, ...gapAnalysis];
  };

  const recommendations = generateRecommendations();

  const chartData = histogram.map(h => ({
    name: h.quantity_bucket,
    orders: h.order_count,
    revenue: Number(h.total_revenue),
    discount: Number(h.avg_discount),
    quantity: h.total_quantity
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{product.product_name}</h2>
            <p className="text-sm text-slate-600 mt-1">
              {product.product_category} • {product.times_ordered} orders • ${Number(product.total_revenue).toLocaleString()} total revenue
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading detailed analytics...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-blue-600 mb-1">Avg Order Size</div>
                  <div className="text-2xl font-bold text-blue-900">{product.avg_quantity_per_order.toFixed(1)}</div>
                  <div className="text-xs text-blue-600 mt-1">units per order</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-emerald-600 mb-1">Range</div>
                  <div className="text-2xl font-bold text-emerald-900">{product.min_quantity}-{product.max_quantity}</div>
                  <div className="text-xs text-emerald-600 mt-1">min to max quantity</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-amber-600 mb-1">Avg Discount</div>
                  <div className="text-2xl font-bold text-amber-900">{Number(product.avg_discount_percent).toFixed(1)}%</div>
                  <div className="text-xs text-amber-600 mt-1">across all orders</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 mb-1">Current Breaks</div>
                  <div className="text-2xl font-bold text-slate-900">{currentBreaks.length}</div>
                  <div className="text-xs text-slate-600 mt-1">active tiers</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-blue-600" />
                  Order Quantity Distribution
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="orders" fill="#3b82f6" name="Order Count" />
                    <Line yAxisId="right" dataKey="discount" stroke="#f59e0b" name="Avg Discount %" strokeWidth={2} />
                    <Area yAxisId="left" dataKey="quantity" fill="#8b5cf6" stroke="#8b5cf6" fillOpacity={0.3} name="Total Quantity" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {currentBreaks.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-emerald-600" />
                    Current Quantity Breaks
                  </h3>
                  <div className="space-y-3">
                    {currentBreaks.map((brk, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm font-medium text-slate-900">
                            {brk.min_quantity}{brk.max_quantity ? `-${brk.max_quantity}` : '+'} units
                          </div>
                          <div className="text-sm text-emerald-600 font-medium">
                            {Number(brk.discount_percent).toFixed(0)}% discount
                          </div>
                        </div>
                        <div className="text-sm text-slate-600">
                          Used {brk.times_used} time{brk.times_used !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start space-x-3 p-4 rounded-lg ${
                        rec.type === 'success'
                          ? 'bg-emerald-50 border border-emerald-200'
                          : rec.type === 'warning'
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      {rec.type === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                          rec.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
                        }`} />
                      )}
                      <p className={`text-sm ${
                        rec.type === 'success'
                          ? 'text-emerald-900'
                          : rec.type === 'warning'
                          ? 'text-amber-900'
                          : 'text-blue-900'
                      }`}>
                        {rec.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-2">Detailed Order Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Quantity Range</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Orders</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Avg Discount</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {histogram.map((h, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-sm text-slate-900">{h.quantity_bucket}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-900">{h.order_count}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-900">{h.total_quantity}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-600">{Number(h.avg_discount).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-900">${Number(h.total_revenue).toLocaleString(undefined, {minimumFractionDigits: 0})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
