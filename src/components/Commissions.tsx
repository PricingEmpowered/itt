import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Award, CheckCircle, Clock, Banknote } from 'lucide-react';

interface Commission {
  id: string;
  quote_id: string;
  sales_rep_email: string;
  deal_size: number;
  deal_score: number | null;
  base_commission_percent: number;
  deal_score_bonus_percent: number;
  total_commission_percent: number;
  commission_amount: number;
  status: string;
  won_date: string | null;
  paid_date: string | null;
  created_at: string;
}

interface CommissionSummary {
  sales_rep_email: string;
  total_deals: number;
  pending_deals: number;
  won_deals: number;
  paid_deals: number;
  total_won_revenue: number;
  pending_commission: number;
  won_unpaid_commission: number;
  paid_commission: number;
  avg_deal_score: number;
  avg_commission_percent: number;
}

export function Commissions() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'commissions' | 'summary' | 'tiers'>('commissions');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRep, setFilterRep] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadCommissions(), loadSummary()]);
    setLoading(false);
  };

  const loadCommissions = async () => {
    try {
      let query = supabase
        .from('sales_commissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterRep !== 'all') {
        query = query.eq('sales_rep_email', filterRep);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCommissions(data || []);
    } catch (error) {
      console.error('Error loading commissions:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('commission_summary_by_rep')
        .select('*')
        .order('total_won_revenue', { ascending: false });

      if (error) throw error;
      setSummary(data || []);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const markAsWon = async (commissionId: string) => {
    try {
      const { error } = await supabase
        .from('sales_commissions')
        .update({
          status: 'won',
          won_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', commissionId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error marking as won:', error);
    }
  };

  const markAsPaid = async (commissionId: string) => {
    try {
      const { error } = await supabase
        .from('sales_commissions')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', commissionId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      won: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'won': return <CheckCircle size={16} />;
      case 'paid': return <Banknote size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getTotalStats = () => {
    return {
      totalCommission: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
      wonCommission: commissions.filter(c => c.status === 'won').reduce((sum, c) => sum + c.commission_amount, 0),
      paidCommission: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
      avgDealScore: commissions.filter(c => c.deal_score).reduce((sum, c) => sum + (c.deal_score || 0), 0) / commissions.filter(c => c.deal_score).length || 0
    };
  };

  const stats = getTotalStats();
  const uniqueReps = Array.from(new Set(commissions.map(c => c.sales_rep_email))).sort();

  if (loading) {
    return <div className="flex justify-center p-8">Loading commissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sales Commissions</h2>
        <p className="text-sm text-gray-500 mt-1">Track and manage sales commissions based on deal size and deal score</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Total Commissions</span>
            <DollarSign size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Won (Unpaid)</span>
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.wonCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Paid</span>
            <Banknote size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.paidCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Avg Deal Score</span>
            <Award size={20} className="text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.avgDealScore.toFixed(0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('commissions')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'commissions'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Commissions
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Sales Rep
              </button>
            </div>

            {activeTab === 'commissions' && (
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setTimeout(loadCommissions, 0);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="won">Won</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={filterRep}
                  onChange={(e) => {
                    setFilterRep(e.target.value);
                    setTimeout(loadCommissions, 0);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Sales Reps</option>
                  {uniqueReps.map(rep => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {activeTab === 'commissions' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Quote ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales Rep</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Deal Size</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Deal Score</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Base %</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Bonus %</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total %</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Commission</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{commission.quote_id}</td>
                    <td className="py-3 px-4 text-gray-900">{commission.sales_rep_email}</td>
                    <td className="text-right py-3 px-4 text-gray-900">
                      ${commission.deal_size.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center py-3 px-4">
                      {commission.deal_score ? (
                        <span className={`font-semibold ${
                          commission.deal_score >= 80 ? 'text-green-600' :
                          commission.deal_score >= 70 ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {commission.deal_score}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-900">
                      {commission.base_commission_percent.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4">
                      {commission.deal_score_bonus_percent > 0 ? (
                        <span className="text-green-600 font-semibold">
                          +{commission.deal_score_bonus_percent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      {commission.total_commission_percent.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-bold text-green-600">
                      ${commission.commission_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(commission.status)}`}>
                        {getStatusIcon(commission.status)}
                        {commission.status}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        {commission.status === 'pending' && (
                          <button
                            onClick={() => markAsWon(commission.id)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Mark Won
                          </button>
                        )}
                        {commission.status === 'won' && (
                          <button
                            onClick={() => markAsPaid(commission.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales Rep</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Deals</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Won Deals</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Won Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Won (Unpaid)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Paid</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.map((rep, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{rep.sales_rep_email}</td>
                    <td className="text-center py-3 px-4 text-gray-900">{rep.total_deals}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">{rep.won_deals}</td>
                    <td className="text-right py-3 px-4 text-gray-900">
                      ${(rep.total_won_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4 text-green-600 font-semibold">
                      ${(rep.won_unpaid_commission || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4 text-blue-600 font-semibold">
                      ${(rep.paid_commission || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-900">
                      {rep.avg_deal_score ? rep.avg_deal_score.toFixed(0) : 'N/A'}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-900">
                      {rep.avg_commission_percent ? rep.avg_commission_percent.toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {commissions.length === 0 && activeTab === 'commissions' && (
          <div className="text-center py-12 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
            <p>No commissions found</p>
            <p className="text-sm mt-2">Commissions are created automatically when quotes are generated</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Commission Structure</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Small Deal</strong> ($0-$10k): 3% base + 0.5% bonus (score ≥70)</p>
          <p><strong>Standard Deal</strong> ($10k-$50k): 4% base + 1% bonus (score ≥70)</p>
          <p><strong>Large Deal</strong> ($50k-$150k): 5% base + 1.5% bonus (score ≥70)</p>
          <p><strong>Enterprise Deal</strong> ($150k+): 6% base + 2% bonus (score ≥70)</p>
          <p className="mt-3 text-xs">Deal score bonus is only applied when the deal score is 70 or higher</p>
        </div>
      </div>
    </div>
  );
}
