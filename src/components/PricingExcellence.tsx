import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, CheckCircle, Target, AlertCircle, BarChart3, LineChart, Info, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { DocumentUpload } from './DocumentUpload';
import {
  MaturityPillar,
  MaturityAssessment,
  calculatePillarScore,
  getMaturityLevel,
  getMaturityColor,
  getMaturityLabel,
  calculateOverallMaturity,
  getPillarRecommendations
} from '../utils/pricingMaturityCalculator';

export function PricingExcellence() {
  const [pillars, setPillars] = useState<MaturityPillar[]>([]);
  const [assessments, setAssessments] = useState<MaturityAssessment[]>([]);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [criteriaCompletion, setCriteriaCompletion] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'documents'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: pillarsData, error: pillarsError } = await supabase
        .from('pricing_maturity_pillars')
        .select('*')
        .order('pillar_order');

      if (pillarsError) throw pillarsError;

      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('pricing_maturity_assessments')
        .select('*')
        .order('assessment_date', { ascending: false })
        .limit(6);

      if (assessmentsError) throw assessmentsError;

      setPillars(pillarsData || []);
      setAssessments(assessmentsData || []);
    } catch (error) {
      console.error('Error loading pricing maturity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePillarExpansion = (pillarId: string) => {
    if (expandedPillar === pillarId) {
      setExpandedPillar(null);
    } else {
      setExpandedPillar(pillarId);
      const latestAssessment = assessments.find(a => a.pillar_id === pillarId);
      if (latestAssessment) {
        setCriteriaCompletion(latestAssessment.criteria_completion);
      } else {
        setCriteriaCompletion({});
      }
    }
  };

  const toggleCriterion = (criterionId: number) => {
    setCriteriaCompletion(prev => ({
      ...prev,
      [criterionId.toString()]: !prev[criterionId.toString()]
    }));
  };

  const saveAssessment = async (pillar: MaturityPillar) => {
    setSaving(true);
    try {
      const score = calculatePillarScore(pillar.criteria, criteriaCompletion);
      const maturityLevel = getMaturityLevel(score);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pricing_maturity_assessments')
        .insert({
          pillar_id: pillar.id,
          score,
          maturity_level: maturityLevel,
          criteria_completion: criteriaCompletion,
          assessed_by: user?.id
        });

      if (error) throw error;

      await loadData();
      setExpandedPillar(null);
      setCriteriaCompletion({});
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const getLatestAssessmentForPillar = (pillarId: string) => {
    return assessments.find(a => a.pillar_id === pillarId);
  };

  const overallScore = calculateOverallMaturity(
    pillars.map(p => getLatestAssessmentForPillar(p.id)).filter(Boolean) as MaturityAssessment[]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Award size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Pricing Excellence Program</h1>
            <p className="text-emerald-100 mt-1">Maturity Assessment & Performance Tracking</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-emerald-100 text-sm mb-1">Overall Maturity</div>
            <div className="text-3xl font-bold">{overallScore}%</div>
            <div className="text-emerald-100 text-xs mt-1">
              {getMaturityLabel(getMaturityLevel(overallScore))}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-emerald-100 text-sm mb-1">Pillars Assessed</div>
            <div className="text-3xl font-bold">
              {pillars.filter(p => getLatestAssessmentForPillar(p.id)).length}/{pillars.length}
            </div>
            <div className="text-emerald-100 text-xs mt-1">Assessment Coverage</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-emerald-100 text-sm mb-1">Optimized Pillars</div>
            <div className="text-3xl font-bold">
              {assessments.filter(a => a.maturity_level === 'optimized').length}
            </div>
            <div className="text-emerald-100 text-xs mt-1">Excellence Achieved</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-emerald-100 text-sm mb-1">In Progress</div>
            <div className="text-3xl font-bold">
              {assessments.filter(a => a.maturity_level === 'in_progress').length}
            </div>
            <div className="text-emerald-100 text-xs mt-1">Active Improvements</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-6 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={16} />
                Assessment & Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'metrics'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <LineChart size={16} />
                System Enablement
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'documents'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={16} />
                Documents
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Six Pillars of Pricing Excellence
                </h2>
                <p className="text-slate-600 mb-6">
                  Track your organization's pricing maturity across all critical dimensions.
                  Click any pillar to complete or update its assessment.
                </p>
              </div>

              <div className="space-y-4">
                {pillars.map((pillar) => {
                  const assessment = getLatestAssessmentForPillar(pillar.id);
                  const score = assessment?.score || 0;
                  const level = assessment?.maturity_level || 'not_started';
                  const isExpanded = expandedPillar === pillar.id;

                  return (
                    <div
                      key={pillar.id}
                      className={`border rounded-lg transition-all ${
                        isExpanded
                          ? 'border-emerald-300 shadow-lg'
                          : 'border-slate-200 hover:border-emerald-200 hover:shadow-md'
                      }`}
                    >
                      <div
                        className="p-5 cursor-pointer"
                        onClick={() => togglePillarExpansion(pillar.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                Pillar {pillar.pillar_order}
                              </span>
                              <h3 className="font-semibold text-slate-900 text-lg">
                                {pillar.pillar_name}
                              </h3>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getMaturityColor(level)}`}>
                                {score}%
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              {pillar.description}
                            </p>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                          <div className="ml-4 flex items-center gap-2">
                            <span className={`font-medium text-sm ${getMaturityColor(level)}`}>
                              {getMaturityLabel(level)}
                            </span>
                            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50 p-6 space-y-6">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                            <Info className="text-blue-600 flex-shrink-0" size={20} />
                            <div className="text-sm text-blue-800">
                              Check each criterion that your organization has successfully implemented.
                              Your maturity score will be calculated based on the weighted completion.
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-semibold text-slate-900">Assessment Criteria</h4>
                            {pillar.criteria.map((criterion) => (
                              <div
                                key={criterion.id}
                                className="bg-white border border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
                              >
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={criteriaCompletion[criterion.id.toString()] || false}
                                    onChange={() => toggleCriterion(criterion.id)}
                                    className="mt-1 w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-slate-900">
                                        {criterion.text}
                                      </span>
                                      <span className="text-sm text-slate-500 ml-2">
                                        {criterion.weight}%
                                      </span>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>

                          <div className="border-t pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <div className="text-sm text-slate-600 mb-1">Current Score</div>
                                <div className="text-3xl font-bold text-slate-900">
                                  {calculatePillarScore(pillar.criteria, criteriaCompletion)}%
                                </div>
                                <div className={`text-sm font-medium mt-1 ${getMaturityColor(getMaturityLevel(calculatePillarScore(pillar.criteria, criteriaCompletion)))}`}>
                                  {getMaturityLabel(getMaturityLevel(calculatePillarScore(pillar.criteria, criteriaCompletion)))}
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setExpandedPillar(null)}
                                  className="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:border-slate-400 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveAssessment(pillar)}
                                  disabled={saving}
                                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-sm hover:shadow disabled:opacity-50"
                                >
                                  {saving ? 'Saving...' : 'Save Assessment'}
                                </button>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                              <h5 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-600" />
                                Recommendations for Improvement
                              </h5>
                              <ul className="space-y-2">
                                {getPillarRecommendations(pillar.pillar_name, calculatePillarScore(pillar.criteria, criteriaCompletion))
                                  .slice(0, 3)
                                  .map((rec, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                      <span className="text-emerald-600 mt-0.5">•</span>
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {overallScore < 60 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-1">Improvement Opportunity</h4>
                    <p className="text-sm text-yellow-800">
                      Your overall maturity score is below 60%. Focus on completing assessments
                      and implementing recommendations to achieve pricing excellence.
                    </p>
                  </div>
                </div>
              )}

              {overallScore >= 90 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                  <Award className="text-green-600 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-green-900 mb-1">Excellence Achieved!</h4>
                    <p className="text-sm text-green-800">
                      Congratulations! Your organization has achieved pricing excellence with a
                      maturity score above 90%. Continue monitoring and optimizing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  System Enablement & Metrics
                </h2>
                <p className="text-slate-600">
                  The CPQ system automatically tracks key metrics that feed into your pricing maturity assessment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={20} />
                    Documentation & Measurement
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Price Waterfall:</strong> Automatic calculation on every quote</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Win/Loss Tracking:</strong> Available in All Quotes view</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Quote Speed Metrics:</strong> Tracked from creation to close</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Margin vs Sales Plots:</strong> Available in Deal Score Analytics</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={20} />
                    Process & Governance
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Discount Variance:</strong> Tracked against guidelines</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Approval Workflows:</strong> Delegation of authority enforced</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Cost-to-Serve:</strong> Integrated into pricing decisions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Guideline Updates:</strong> Based on win/loss feedback</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={20} />
                    List Prices & Quantity Breaks
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Price Lists:</strong> Multiple lists for segments and regions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Quantity Breaks:</strong> Automated volume discounting</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Price Simulation:</strong> Impact analysis before changes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Competitive Premiums:</strong> Track vs market positioning</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={20} />
                    Exception & Value Pricing
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Product Mapping:</strong> Non-standard to standard equivalents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>OEM Indexing:</strong> Strategic customer pricing plans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Value Propositions:</strong> Documented by product line</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Deal Scoring:</strong> Value-based pricing guidance</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-6 border border-emerald-200">
                <h3 className="font-semibold text-slate-900 mb-3">Continuous Tracking</h3>
                <p className="text-sm text-slate-700 mb-4">
                  This CPQ system is designed to support all six pillars of pricing excellence. As you use
                  the system, it automatically collects data and generates insights that feed directly into
                  your maturity assessment.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-medium text-slate-900 mb-1">Automated Tracking</div>
                    <div className="text-slate-600">No manual data entry required</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-medium text-slate-900 mb-1">Real-Time Insights</div>
                    <div className="text-slate-600">Instant visibility into performance</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-medium text-slate-900 mb-1">Continuous Improvement</div>
                    <div className="text-slate-600">PDCA cycles built into workflows</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <DocumentUpload />
          )}
        </div>
      </div>
    </div>
  );
}
