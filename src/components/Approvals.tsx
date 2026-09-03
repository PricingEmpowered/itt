import { useState, useEffect } from 'react';
import { getCurrentUser } from '../lib/currentUser';
import { db } from '../lib/dataClient';
import { Quote, Customer } from '../types';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Shield, Users, DollarSign, Percent, ChevronRight } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  quote_id: string;
  requested_by: string;
  requested_at: string;
  approver_role: string;
  approved_by?: string;
  approved_at?: string;
  status: string;
  reason: string;
  comments?: string;
  approval_level_required: number;
  approval_sequence: number;
  quote_total?: number;
  quote_discount_percent?: number;
  quote_margin_percent?: number;
}

interface ApprovalHistory {
  id: string;
  quote_id: string;
  approval_level: number;
  action: string;
  actioned_by_role: string;
  actioned_by_level: number;
  comments?: string;
  actioned_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  approval_level: number;
  max_discount_approval: number;
  max_quote_size: number;
  min_margin_percent: number;
}

export function Approvals() {
  const [quotes, setQuotes] = useState<(Quote & { customer: Customer })[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<{ [key: string]: ApprovalHistory[] }>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: userData } = await getCurrentUser();
      if (!userData.user) return;

      const { data: profileData } = await db
        .from('user_profiles')
        .select('*')
        .eq('id', userData.user.id)
        .maybeSingle();

      /*
       * A missing profile is reported, not created here. The INSERT policy on
       * user_profiles only admits admins, where "admin" means already having
       * a profile row with role 'admin' -- so this insert could never succeed
       * for the very users that needed it, and only produced a failed write.
       * Profiles are provisioned alongside the account by `npm run
       * create-user`.
       */
      setUserProfile(profileData ?? null);

      const { data: approvalsData } = await db
        .from('approval_requests')
        .select('*')
        .eq('status', 'Pending')
        .order('approval_level_required', { ascending: true })
        .order('requested_at', { ascending: true });

      const quoteIds = approvalsData?.map(a => a.quote_id) || [];

      // Load quotes for the pending approvals
      let quotesData: any[] = [];
      if (quoteIds.length > 0) {
        const { data: fetchedQuotes } = await db
          .from('quotes')
          .select(`
            *,
            customer:customers(*)
          `)
          .in('id', quoteIds);

        quotesData = fetchedQuotes || [];

        const { data: historyData } = await db
          .from('approval_history')
          .select('*')
          .in('quote_id', quoteIds)
          .order('actioned_at', { ascending: false });

        const historyByQuote = (historyData || []).reduce((acc, h) => {
          if (!acc[h.quote_id]) acc[h.quote_id] = [];
          acc[h.quote_id].push(h);
          return acc;
        }, {} as { [key: string]: ApprovalHistory[] });

        setApprovalHistory(historyByQuote);
      }

      setQuotes(quotesData);
      setApprovals(approvalsData || []);

      console.log('Loaded approval data:', {
        userProfile: profileData,
        quotesCount: quotesData?.length || 0,
        approvalsCount: approvalsData?.length || 0,
        pendingCount: approvalsData?.filter(a => a.status === 'Pending').length || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canApprove = (approvalLevel: number): boolean => {
    if (!userProfile) return false;
    return userProfile.approval_level >= approvalLevel;
  };

  const handleApproval = async (approval: ApprovalRequest, approved: boolean) => {
    try {
      const { data: userData } = await getCurrentUser();
      if (!userData.user || !userProfile) {
        alert('Please sign in');
        return;
      }

      if (!canApprove(approval.approval_level_required)) {
        alert(`You need approval level ${approval.approval_level_required} to approve this quote`);
        return;
      }

      const comments = commentText[approval.id] || (approved ? 'Approved' : 'Rejected');

      await db
        .from('approval_requests')
        .update({
          status: approved ? 'Approved' : 'Rejected',
          approved_by: userData.user.id,
          approved_at: new Date().toISOString(),
          comments: comments,
        })
        .eq('id', approval.id);

      await db.from('approval_history').insert({
        quote_id: approval.quote_id,
        approval_request_id: approval.id,
        approval_level: approval.approval_level_required,
        action: approved ? 'approved' : 'rejected',
        actioned_by: userData.user.id,
        actioned_by_role: userProfile.role,
        actioned_by_level: userProfile.approval_level,
        comments: comments,
        quote_total: approval.quote_total,
        quote_discount_percent: approval.quote_discount_percent,
        quote_margin_percent: approval.quote_margin_percent,
      });

      const quote = quotes.find(q => q.id === approval.quote_id);
      if (approved && quote) {
        const pendingApprovals = approvals.filter(
          a => a.quote_id === approval.quote_id && a.status === 'Pending' && a.id !== approval.id
        );

        if (pendingApprovals.length === 0) {
          await db
            .from('quotes')
            .update({
              status: 'Approved',
              current_approval_level: approval.approval_level_required
            })
            .eq('id', approval.quote_id);
        } else {
          await db
            .from('quotes')
            .update({ current_approval_level: approval.approval_level_required })
            .eq('id', approval.quote_id);
        }
      } else if (!approved) {
        await db
          .from('quotes')
          .update({ status: 'Rejected' })
          .eq('id', approval.quote_id);
      }

      alert(`Quote ${approved ? 'approved' : 'rejected'} successfully`);
      setCommentText({ ...commentText, [approval.id]: '' });
      loadData();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Error processing approval');
    }
  };

  const getLevelInfo = (level: number) => {
    const levels = {
      1: { name: 'Level 1', role: 'Sales Manager', icon: Users, color: 'blue', description: 'Standard discounts (0-15%)' },
      2: { name: 'Level 2', role: 'Regional Manager', icon: TrendingUp, color: 'yellow', description: 'Moderate discounts (15-25%) or deals $100K+' },
      3: { name: 'Level 3', role: 'Sales Director', icon: Shield, color: 'orange', description: 'High discounts (25-35%) or deals $500K+' },
      4: { name: 'Level 4', role: 'VP Sales', icon: AlertCircle, color: 'red', description: 'Exception discounts (35%+) or strategic deals $1M+' },
    };
    return levels[level as keyof typeof levels] || levels[1];
  };

  const getLevelBadgeColor = (level: number) => {
    const colors = {
      1: 'bg-blue-100 text-blue-700 border-blue-200',
      2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      3: 'bg-orange-100 text-orange-700 border-orange-200',
      4: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[level as keyof typeof colors] || colors[1];
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  const myPendingApprovals = approvals.filter(a => canApprove(a.approval_level_required));
  const totalPending = approvals.length;
  const totalMyQueue = myPendingApprovals.length;

  const filteredApprovals = filterLevel === 'all'
    ? myPendingApprovals
    : myPendingApprovals.filter(a => a.approval_level_required === filterLevel);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Approval Queue</h2>
            <p className="text-slate-200 mt-2">
              {userProfile?.role} - Level {userProfile?.approval_level} Approval Authority
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-sm text-slate-200">My Queue</div>
              <div className="text-3xl font-bold mt-1">{totalMyQueue}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-sm text-slate-200">Total Pending</div>
              <div className="text-3xl font-bold mt-1">{totalPending}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilterLevel('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterLevel === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Levels ({myPendingApprovals.length})
        </button>
        {[1, 2, 3, 4].map(level => {
          const count = myPendingApprovals.filter(a => a.approval_level_required === level).length;
          const levelInfo = getLevelInfo(level);
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === level
                  ? `bg-${levelInfo.color}-600 text-white`
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {levelInfo.name} ({count})
            </button>
          );
        })}
      </div>

      {!userProfile ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-orange-500 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Setting Up Your Profile</h3>
          <p className="text-slate-600">Creating your approval profile...</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {totalPending === 0 ? 'All Caught Up!' : 'No Approvals for Your Level'}
          </h3>
          <p className="text-slate-600">
            {totalPending === 0
              ? 'No approvals pending in the system'
              : `${totalPending} approval${totalPending !== 1 ? 's' : ''} require higher authorization levels`}
          </p>
          {totalPending === 0 && (
            <p className="text-sm text-slate-500 mt-4">
              Your approval authority: Level {userProfile.approval_level} ({userProfile.role})
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map(approval => {
            const quote = quotes.find(q => q.id === approval.quote_id);
            const levelInfo = getLevelInfo(approval.approval_level_required);
            const Icon = levelInfo.icon;
            const history = approvalHistory[approval.quote_id] || [];

            return (
              <div
                key={approval.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl ${getLevelBadgeColor(approval.approval_level_required)} border-2 flex items-center justify-center`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {quote?.customer?.name || 'Unknown Customer'}
                          </h3>
                          <span className={`text-xs font-semibold px-2 py-1 rounded border ${getLevelBadgeColor(approval.approval_level_required)}`}>
                            {levelInfo.name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">Quote ID: {approval.quote_id}</p>
                        <p className="text-xs text-slate-500">{levelInfo.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        ${quote?.total.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(approval.requested_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                        <Percent size={14} />
                        Discount
                      </div>
                      <div className="text-lg font-semibold text-slate-900">
                        {approval.quote_discount_percent?.toFixed(1) || '0.0'}%
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                        <TrendingUp size={14} />
                        Margin
                      </div>
                      <div className="text-lg font-semibold text-slate-900">
                        {approval.quote_margin_percent?.toFixed(1) || '0.0'}%
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                        <DollarSign size={14} />
                        Deal Size
                      </div>
                      <div className="text-lg font-semibold text-slate-900">
                        ${approval.quote_total?.toLocaleString() || '0'}
                      </div>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-semibold text-blue-900 mb-2">Approval Trail</div>
                      <div className="space-y-2">
                        {history.map((h) => (
                          <div key={h.id} className="flex items-center gap-2 text-xs text-blue-700">
                            <CheckCircle size={12} />
                            <span className="font-medium">Level {h.approval_level}</span>
                            <span>•</span>
                            <span>{h.actioned_by_role}</span>
                            <span>•</span>
                            <span className="capitalize">{h.action}</span>
                            {h.comments && (
                              <>
                                <span>•</span>
                                <span className="italic">{h.comments}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Comments {approval.approval_level_required >= 3 && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={commentText[approval.id] || ''}
                      onChange={(e) => setCommentText({ ...commentText, [approval.id]: e.target.value })}
                      placeholder="Add approval comments..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproval(approval, true)}
                      disabled={!canApprove(approval.approval_level_required)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <CheckCircle size={20} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval(approval, false)}
                      disabled={!canApprove(approval.approval_level_required)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <XCircle size={20} />
                      Reject
                    </button>
                  </div>

                  {!canApprove(approval.approval_level_required) && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-yellow-800">
                        <AlertCircle size={16} />
                        <span>
                          You need {levelInfo.role} authority (Level {approval.approval_level_required}) to approve this quote
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPending > totalMyQueue && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Other Pending Approvals</h3>
              <p className="text-sm text-slate-600 mt-1">
                {totalPending - totalMyQueue} approval{totalPending - totalMyQueue !== 1 ? 's' : ''} require higher authorization levels
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="text-sm">View all approvals</span>
              <ChevronRight size={20} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
