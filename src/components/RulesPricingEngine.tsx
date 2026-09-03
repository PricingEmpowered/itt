import { useState, useEffect } from 'react';
import { Settings, Calculator, AlertTriangle } from 'lucide-react';
import { db } from '../lib/dataClient';

interface PricingRule {
  id: string;
  name: string;
  description: string;
  product_family_id: string;
  opportunity_threshold: number;
  is_active: boolean;
  decision_tree_logic: any;
}

interface PriceCalculation {
  customer_segment: 'Large Customer' | 'Med Customer' | 'Small Customer';
  has_existing_product: boolean;
  has_competition: boolean;
  complexity_level: 'Low' | 'Med' | 'High';
  is_variation_of_standard: boolean;
  standard_product_price?: number;
  product_cost?: number;
  market_segment?: string;
  opportunity_size: number;
}

export function RulesPricingEngine() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [loading, setLoading] = useState(true);

  // Calculator state
  const [calculation, setCalculation] = useState<PriceCalculation>({
    customer_segment: 'Med Customer',
    has_existing_product: false,
    has_competition: false,
    complexity_level: 'Med',
    is_variation_of_standard: true,
    opportunity_size: 50000,
  });

  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<any>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const { data, error } = await db
        .from('pricing_rules_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
      if (data && data.length > 0) {
        setSelectedRule(data[0].id);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = async () => {
    if (!selectedRule) return;

    try {
      const rule = rules.find(r => r.id === selectedRule);
      if (!rule) return;

      // Check if opportunity requires strategic review
      if (calculation.opportunity_size >= rule.opportunity_threshold) {
        setCalculationDetails({
          requires_strategic_review: true,
          message: `Opportunity size ($${calculation.opportunity_size.toLocaleString()}) exceeds threshold. Strategic pricing review required.`
        });
        setCalculatedPrice(null);
        return;
      }

      if (calculation.is_variation_of_standard) {
        // Multiplier-based pricing
        if (!calculation.standard_product_price) {
          alert('Please enter the standard product price');
          return;
        }

        const { data: multiplier, error } = await db
          .from('pricing_multipliers')
          .select('*')
          .eq('rules_config_id', selectedRule)
          .eq('customer_segment', calculation.customer_segment)
          .eq('has_existing_product', calculation.has_existing_product)
          .eq('has_competition', calculation.has_competition)
          .eq('complexity_level', calculation.complexity_level)
          .maybeSingle();

        if (error) throw error;

        if (multiplier) {
          const price = calculation.standard_product_price * multiplier.multiplier;
          setCalculatedPrice(price);
          setCalculationDetails({
            method: 'Multiplier Pricing',
            base_price: calculation.standard_product_price,
            multiplier: multiplier.multiplier,
            formula: `$${calculation.standard_product_price.toLocaleString()} × ${multiplier.multiplier}`,
            description: multiplier.description
          });
        } else {
          setCalculationDetails({
            error: 'No matching multiplier rule found for these conditions'
          });
        }
      } else {
        // Cost-plus pricing
        if (!calculation.product_cost) {
          alert('Please enter the product cost');
          return;
        }

        const { data: marginAdders, error } = await db
          .from('pricing_margin_adders')
          .select('*')
          .eq('rules_config_id', selectedRule)
          .eq('customer_segment', calculation.customer_segment)
          .eq('has_existing_product', calculation.has_existing_product)
          .eq('has_competition', calculation.has_competition)
          .eq('complexity_level', calculation.complexity_level);

        if (error) throw error;

        // Find base adder (no market segment)
        const baseAdder = marginAdders?.find(m => !m.market_segment);

        // Find market-specific adder if applicable
        const marketAdder = calculation.market_segment
          ? marginAdders?.find(m => m.market_segment === calculation.market_segment)
          : null;

        if (baseAdder) {
          const standardMargin = 0.40; // 40% standard margin
          const totalMarginAdder = baseAdder.margin_adder + (marketAdder?.market_adder || 0);
          const price = calculation.product_cost * (1 + standardMargin + totalMarginAdder);

          setCalculatedPrice(price);
          setCalculationDetails({
            method: 'Cost-Plus Pricing',
            cost: calculation.product_cost,
            standard_margin: standardMargin,
            margin_adder: baseAdder.margin_adder,
            market_adder: marketAdder?.market_adder || 0,
            total_margin: standardMargin + totalMarginAdder,
            formula: `$${calculation.product_cost.toLocaleString()} × (1 + ${(standardMargin + totalMarginAdder).toFixed(2)})`,
            description: baseAdder.description,
            market_description: marketAdder?.description
          });
        } else {
          setCalculationDetails({
            error: 'No matching margin adder rule found for these conditions'
          });
        }
      }
    } catch (error) {
      console.error('Error calculating price:', error);
      setCalculationDetails({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedRuleData = rules.find(r => r.id === selectedRule);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rules-Based Pricing Engine</h1>
            <p className="text-sm text-slate-600">Configure and use decision-tree pricing rules</p>
          </div>
        </div>
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Calculator className="h-4 w-4" />
          <span>{showCalculator ? 'Hide' : 'Show'} Calculator</span>
        </button>
      </div>

      {showCalculator && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Price Calculator</h2>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pricing Rule
              </label>
              <select
                value={selectedRule || ''}
                onChange={(e) => setSelectedRule(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {rules.map(rule => (
                  <option key={rule.id} value={rule.id}>{rule.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Opportunity Size
              </label>
              <input
                type="number"
                value={calculation.opportunity_size}
                onChange={(e) => setCalculation({ ...calculation, opportunity_size: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedRuleData && calculation.opportunity_size >= selectedRuleData.opportunity_threshold && (
                <p className="mt-1 text-sm text-amber-600 flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Exceeds threshold - requires strategic review</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Customer Segment
              </label>
              <select
                value={calculation.customer_segment}
                onChange={(e) => setCalculation({ ...calculation, customer_segment: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Large Customer">Large Customer</option>
                <option value="Med Customer">Med Customer</option>
                <option value="Small Customer">Small Customer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Complexity Level
              </label>
              <select
                value={calculation.complexity_level}
                onChange={(e) => setCalculation({ ...calculation, complexity_level: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Low">Low</option>
                <option value="Med">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div className="col-span-2 flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={calculation.is_variation_of_standard}
                  onChange={(e) => setCalculation({ ...calculation, is_variation_of_standard: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Variation of Standard Product</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={calculation.has_existing_product}
                  onChange={(e) => setCalculation({ ...calculation, has_existing_product: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Customer Has Existing Product</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={calculation.has_competition}
                  onChange={(e) => setCalculation({ ...calculation, has_competition: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Has Competition</span>
              </label>
            </div>

            {calculation.is_variation_of_standard ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Standard Product List Price
                </label>
                <input
                  type="number"
                  value={calculation.standard_product_price || ''}
                  onChange={(e) => setCalculation({ ...calculation, standard_product_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter list price"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Product Cost
                  </label>
                  <input
                    type="number"
                    value={calculation.product_cost || ''}
                    onChange={(e) => setCalculation({ ...calculation, product_cost: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter cost"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Market Segment (Optional)
                  </label>
                  <select
                    value={calculation.market_segment || ''}
                    onChange={(e) => setCalculation({ ...calculation, market_segment: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    <option value="Construction">Construction</option>
                    <option value="Crane">Crane</option>
                    <option value="Energy/Oil">Energy/Oil</option>
                    <option value="Military">Military</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <button
            onClick={calculatePrice}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Calculate Price
          </button>

          {calculatedPrice !== null && (
            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-2xl font-bold text-emerald-900 mb-2">
                ${calculatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {calculationDetails && (
                <div className="space-y-2 text-sm text-slate-700">
                  <p className="font-medium">{calculationDetails.method}</p>
                  <p className="font-mono">{calculationDetails.formula}</p>
                  {calculationDetails.description && (
                    <p className="text-slate-600">{calculationDetails.description}</p>
                  )}
                  {calculationDetails.market_description && (
                    <p className="text-slate-600">Market: {calculationDetails.market_description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {calculationDetails?.requires_strategic_review && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Strategic Review Required</p>
                  <p className="text-sm text-amber-700 mt-1">{calculationDetails.message}</p>
                </div>
              </div>
            </div>
          )}

          {calculationDetails?.error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{calculationDetails.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {rules.map(rule => (
          <div key={rule.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{rule.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4 text-sm">
                <span className="font-medium text-slate-700">Opportunity Threshold:</span>
                <span className="text-slate-900">${rule.opportunity_threshold.toLocaleString()}</span>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Decision Tree:</p>
                <div className="text-sm text-slate-600 space-y-2">
                  <p>1. If opportunity &gt; ${rule.opportunity_threshold.toLocaleString()} → Strategic Review</p>
                  <p>2. If variation of standard part → Multiplier Pricing</p>
                  <p className="ml-4">→ Price = List Price of Standard × Multiplier</p>
                  <p>3. If non-standard part → Cost-Plus Pricing</p>
                  <p className="ml-4">→ Price = Cost × (Standard Margin + Adder %)</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No pricing rules configured</p>
        </div>
      )}
    </div>
  );
}
