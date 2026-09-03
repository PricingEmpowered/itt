import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Target, Users, Package, AlertCircle, Settings, Info } from 'lucide-react';

interface SegmentMetrics {
  segment_value: string;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  escalated_deals: number;
  avg_deal_score: number;
  win_rate: number;
  escalation_rate: number;
  avg_discount_percent: number;
}

interface Recommendation {
  id: string;
  segment_type: string;
  segment_value: string;
  issue_type: string;
  severity: string;
  current_metric_value: number;
  threshold_value: number;
  recommendation_text: string;
  suggested_action: string;
  status: string;
  created_at: string;
}

export function DealScoreAnalytics() {
  const [productMetrics, setProductMetrics] = useState<SegmentMetrics[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState<SegmentMetrics[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegmentType, setSelectedSegmentType] = useState<'product' | 'customer'>('product');
  const [showConfig, setShowConfig] = useState(false);
  const [weights, setWeights] = useState({
    margin_weight: 40,
    discount_weight: 30,
    price_competitiveness_weight: 30
  });
  const [overallStats, setOverallStats] = useState({
    totalDeals: 0,
    wonDeals: 0,
    overallWinRate: 0,
    overallEscalationRate: 0,
    avgDealScore: 0
  });

  useEffect(() => {
    loadData();
    loadWeights();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadProductMetrics(),
      loadCustomerMetrics(),
      loadOverallStats(),
      generateRecommendations()
    ]);
    setLoading(false);
  };

  const loadWeights = async () => {
    try {
      const { data, error } = await db
        .from('deal_score_config')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading weights:', error);
        return;
      }

      if (data) {
        setWeights({
          margin_weight: data.margin_weight || 40,
          discount_weight: data.discount_weight || 30,
          price_competitiveness_weight: data.price_competitiveness_weight || 30
        });
      }
    } catch (error) {
      console.error('Error loading weights:', error);
    }
  };

  const saveWeights = async () => {
    try {
      const total = weights.margin_weight + weights.discount_weight + weights.price_competitiveness_weight;
      if (total !== 100) {
        alert('Weights must sum to 100%');
        return;
      }

      const { error } = await db
        .from('deal_score_config')
        .upsert({
          id: 1,
          ...weights,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      alert('Weights saved successfully! These will be used for all future deal score calculations.');
    } catch (error) {
      console.error('Error saving weights:', error);
      alert('Error saving weights');
    }
  };

  const resetWeights = () => {
    setWeights({
      margin_weight: 40,
      discount_weight: 30,
      price_competitiveness_weight: 30
    });
  };

  const loadProductMetrics = async () => {
    try {
      const { data, error } = await db
        .from('deal_score_analysis_by_product_family')
        .select('*')
        .order('total_deals', { ascending: false });

      if (error) throw error;
      setProductMetrics(data || []);
    } catch (error) {
      console.error('Error loading product metrics:', error);
    }
  };

  const loadCustomerMetrics = async () => {
    try {
      const { data, error } = await db
        .from('deal_score_analysis_by_customer_segment')
        .select('*')
        .order('total_deals', { ascending: false });

      if (error) throw error;
      setCustomerMetrics(data || []);
    } catch (error) {
      console.error('Error loading customer metrics:', error);
    }
  };

  const loadOverallStats = async () => {
    try {
      const { data, error } = await db
        .from('deal_outcomes')
        .select('outcome, was_escalated, deal_score_at_creation');

      if (error) throw error;

      if (data) {
        const totalDeals = data.length;
        const wonDeals = data.filter(d => d.outcome === 'won').length;
        const closedDeals = data.filter(d => d.outcome === 'won' || d.outcome === 'lost').length;
        const escalatedDeals = data.filter(d => d.was_escalated).length;
        const avgScore = data.reduce((sum, d) => sum + (d.deal_score_at_creation || 0), 0) / totalDeals;

        setOverallStats({
          totalDeals,
          wonDeals,
          overallWinRate: closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0,
          overallEscalationRate: totalDeals > 0 ? (escalatedDeals / totalDeals) * 100 : 0,
          avgDealScore: avgScore
        });
      }
    } catch (error) {
      console.error('Error loading overall stats:', error);
    }
  };

  const generateRecommendations = async () => {
    try {
      const productData = await db.from('deal_score_analysis_by_product_family').select('*');
      const customerData = await db.from('deal_score_analysis_by_customer_segment').select('*');

      const newRecommendations: any[] = [];

      [
        ...(productData.data || []).map(m => ({ ...m, type: 'product_family' })),
        ...(customerData.data || []).map(m => ({ ...m, type: 'customer_segment' }))
      ].forEach((metric: any) => {
        if (metric.escalation_rate > 0.35 && metric.total_deals >= 5) {
          newRecommendations.push({
            segment_type: metric.type,
            segment_value: metric.segment_value,
            issue_type: 'high_escalation',
            severity: metric.escalation_rate > 0.50 ? 'critical' : 'high',
            current_metric_value: metric.escalation_rate * 100,
            threshold_value: 35,
            recommendation_text: `High escalation rate (${(metric.escalation_rate * 100).toFixed(1)}%) in ${metric.segment_value}`,
            suggested_action: `Review deal score guidelines for ${metric.segment_value}. Consider: 1) Tightening discount thresholds, 2) Adjusting pricing strategy, 3) Providing additional training on deal structure.`,
            status: 'active'
          });
        }

        if (metric.win_rate < 0.40 && metric.total_deals >= 5) {
          newRecommendations.push({
            segment_type: metric.type,
            segment_value: metric.segment_value,
            issue_type: 'low_win_rate',
            severity: metric.win_rate < 0.25 ? 'critical' : 'high',
            current_metric_value: metric.win_rate * 100,
            threshold_value: 40,
            recommendation_text: `Low win rate (${(metric.win_rate * 100).toFixed(1)}%) in ${metric.segment_value}`,
            suggested_action: `Investigate competitive positioning for ${metric.segment_value}. Actions: 1) Review pricing competitiveness, 2) Analyze loss reasons, 3) Consider value proposition adjustments, 4) Evaluate sales enablement materials.`,
            status: 'active'
          });
        }

        if (metric.avg_discount_percent > 15 && metric.total_deals >= 5) {
          newRecommendations.push({
            segment_type: metric.type,
            segment_value: metric.segment_value,
            issue_type: 'discount_pattern',
            severity: metric.avg_discount_percent > 20 ? 'high' : 'medium',
            current_metric_value: metric.avg_discount_percent,
            threshold_value: 15,
            recommendation_text: `High average discount (${metric.avg_discount_percent.toFixed(1)}%) in ${metric.segment_value}`,
            suggested_action: `Review discount policy for ${metric.segment_value}. Consider: 1) Raising list prices, 2) Implementing stricter approval thresholds, 3) Creating volume-based pricing tiers, 4) Enhancing value justification training.`,
            status: 'active'
          });
        }
      });

      for (const rec of newRecommendations) {
        await db
          .from('deal_score_recommendations')
          .upsert(rec, {
            onConflict: 'segment_type,segment_value,issue_type'
          });
      }

      const { data: savedRecs } = await db
        .from('deal_score_recommendations')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: true })
        .order('created_at', { ascending: false });

      setRecommendations(savedRecs || []);
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  const updateRecommendationStatus = async (id: string, status: string) => {
    try {
      const updateData: any = { status };
      if (status === 'acknowledged') {
        updateData.acknowledged_at = new Date().toISOString();
      } else if (status === 'implemented') {
        updateData.implemented_at = new Date().toISOString();
      }

      await db
        .from('deal_score_recommendations')
        .update(updateData)
        .eq('id', id);

      await generateRecommendations();
    } catch (error) {
      console.error('Error updating recommendation:', error);
    }
  };

  const getAccuracyScore = (metric: SegmentMetrics) => {
    const escalationFactor = 1 - Math.min(metric.escalation_rate, 1.0);
    const winRateFactor = metric.win_rate;
    const discountFactor = 1 - Math.min(metric.avg_discount_percent / 100, 1.0);
    return (escalationFactor * winRateFactor * discountFactor * 100).toFixed(1);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const metrics = selectedSegmentType === 'product' ? productMetrics : customerMetrics;

  if (loading) {
    return <div className="flex justify-center p-8">Loading analytics...</div>;
  }

  const totalWeight = weights.margin_weight + weights.discount_weight + weights.price_competitiveness_weight;
  const isValidTotal = totalWeight === 100;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deal Score Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Measuring deal score accuracy through escalation rates and win rates</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings size={18} />
            {showConfig ? 'Hide' : 'Show'} Configuration
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={20} className="text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Deal Score Configuration</h3>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <Info size={18} className="text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Configure how deal scores are calculated</p>
                <p>Adjust the weight (importance) of each factor. Total must equal 100%.</p>
                <p className="mt-2">These weights will be used for all future deal score calculations.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Margin Weight
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.margin_weight}
                  onChange={(e) => setWeights({ ...weights, margin_weight: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.margin_weight}
                  onChange={(e) => setWeights({ ...weights, margin_weight: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                />
                <span className="text-sm font-medium text-gray-700">%</span>
              </div>
              <p className="text-xs text-gray-500">How much does maintaining good margin matter?</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Discount Weight
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.discount_weight}
                  onChange={(e) => setWeights({ ...weights, discount_weight: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.discount_weight}
                  onChange={(e) => setWeights({ ...weights, discount_weight: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                />
                <span className="text-sm font-medium text-gray-700">%</span>
              </div>
              <p className="text-xs text-gray-500">How much does avoiding discounts matter?</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Price Competitiveness Weight
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.price_competitiveness_weight}
                  onChange={(e) => setWeights({ ...weights, price_competitiveness_weight: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.price_competitiveness_weight}
                  onChange={(e) => setWeights({ ...weights, price_competitiveness_weight: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                />
                <span className="text-sm font-medium text-gray-700">%</span>
              </div>
              <p className="text-xs text-gray-500">How much does competitive pricing matter?</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Total:</span>
              <span className={`text-xl font-bold ${isValidTotal ? 'text-green-600' : 'text-red-600'}`}>
                {totalWeight}%
              </span>
              {!isValidTotal && (
                <span className="text-sm text-red-600">Must equal 100%</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetWeights}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset to Default
              </button>
              <button
                onClick={saveWeights}
                disabled={!isValidTotal}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isValidTotal
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save Weights
              </button>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Current Formula</h4>
            <p className="text-sm text-gray-700 font-mono">
              Deal Score = (Margin Score × {weights.margin_weight}%) + (Discount Score × {weights.discount_weight}%) + (Price Competitiveness × {weights.price_competitiveness_weight}%)
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Total Deals</span>
            <Target size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{overallStats.totalDeals}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Won Deals</span>
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{overallStats.wonDeals}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Win Rate</span>
            {overallStats.overallWinRate >= 50 ? <TrendingUp size={20} className="text-green-600" /> : <TrendingDown size={20} className="text-red-600" />}
          </div>
          <div className="text-2xl font-bold text-gray-900">{overallStats.overallWinRate.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Escalation Rate</span>
            {overallStats.overallEscalationRate <= 30 ? <CheckCircle size={20} className="text-green-600" /> : <AlertTriangle size={20} className="text-orange-600" />}
          </div>
          <div className="text-2xl font-bold text-gray-900">{overallStats.overallEscalationRate.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Avg Deal Score</span>
            <Target size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{overallStats.avgDealScore.toFixed(0)}</div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 bg-red-50">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" />
              <h3 className="font-semibold text-gray-900">Active Recommendations ({recommendations.length})</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">Deal score guideline adjustments needed for optimal accuracy</p>
          </div>
          <div className="divide-y divide-gray-200">
            {recommendations.map((rec) => (
              <div key={rec.id} className={`p-4 ${getSeverityColor(rec.severity)} border-l-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getSeverityColor(rec.severity)}`}>
                        {rec.severity}
                      </span>
                      <span className="text-xs text-gray-500">{rec.segment_type}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{rec.recommendation_text}</h4>
                    <p className="text-sm text-gray-700 mb-3">{rec.suggested_action}</p>
                    <div className="text-xs text-gray-500">
                      Current: {rec.current_metric_value.toFixed(1)}% | Threshold: {rec.threshold_value}%
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateRecommendationStatus(rec.id, 'acknowledged')}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => updateRecommendationStatus(rec.id, 'implemented')}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Mark Implemented
                    </button>
                    <button
                      onClick={() => updateRecommendationStatus(rec.id, 'dismissed')}
                      className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Segment Analysis</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSegmentType('product')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedSegmentType === 'product'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Package size={16} />
                Product Families
              </button>
              <button
                onClick={() => setSelectedSegmentType('customer')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedSegmentType === 'customer'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users size={16} />
                Customer Segments
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Segment</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Deals</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Won</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Lost</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Win Rate</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Escalation Rate</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Discount</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Deal Score</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Accuracy Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map((metric, idx) => {
                const accuracyScore = parseFloat(getAccuracyScore(metric));
                const winRate = (metric.win_rate * 100);
                const escalationRate = (metric.escalation_rate * 100);

                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{metric.segment_value || 'Unknown'}</td>
                    <td className="text-center py-3 px-4 text-gray-900">{metric.total_deals}</td>
                    <td className="text-center py-3 px-4">
                      <span className="text-green-600 font-medium">{metric.won_deals}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-red-600 font-medium">{metric.lost_deals}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${winRate >= 50 ? 'text-green-600' : winRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${escalationRate <= 30 ? 'text-green-600' : escalationRate <= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {escalationRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-4 text-gray-900">{metric.avg_discount_percent?.toFixed(1) || '0.0'}%</td>
                    <td className="text-center py-3 px-4 text-gray-900">{metric.avg_deal_score?.toFixed(0) || 'N/A'}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-bold ${accuracyScore >= 60 ? 'text-green-600' : accuracyScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {accuracyScore}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {metrics.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <XCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p>No deal outcome data available yet.</p>
            <p className="text-sm mt-2">Create quotes and mark their outcomes to see analytics.</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">About Deal Score Accuracy</h4>
        <p className="text-sm text-blue-800">
          <strong>Accuracy Score</strong> is calculated as: (1 - Escalation Rate) × Win Rate × (1 - Discount Factor) × 100
        </p>
        <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
          <li><strong>Escalation Rate:</strong> % of deals requiring approval beyond normal authority</li>
          <li><strong>Win Rate:</strong> % of closed deals that were won</li>
          <li><strong>Discount Factor:</strong> Impact of average discounts on margin</li>
        </ul>
        <p className="text-sm text-blue-800 mt-2">
          Scores above 60 indicate healthy deal scoring. Lower scores suggest guidelines need refinement.
        </p>
      </div>
    </div>
  );
}
