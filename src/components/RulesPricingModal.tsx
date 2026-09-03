import { useState, useEffect } from 'react';
import { X, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '../lib/dataClient';

interface PricingRule {
  id: string;
  name: string;
  description: string;
  opportunity_threshold: number;
}

interface RulesPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPriceCalculated: (price: number, details: any) => void;
  customerSegment?: string;
  quoteValue?: number;
}

interface PriceCalculation {
  customer_segment: 'Large Customer' | 'Med Customer' | 'Small Customer';
  has_existing_product: boolean;
  has_competition: boolean;
  complexity_level: 'Low' | 'Med' | 'High';
  is_variation_of_standard: boolean;
  standard_product_id?: string;
  standard_product_price?: number;
  product_cost?: number;
  market_segment?: string;
  opportunity_size: number;
  unique_description?: string;
}

export function RulesPricingModal({ isOpen, onClose, onPriceCalculated, customerSegment, quoteValue = 0 }: RulesPricingModalProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [calculation, setCalculation] = useState<PriceCalculation>({
    customer_segment: customerSegment === 'Enterprise' ? 'Large Customer' : customerSegment === 'SMB' ? 'Small Customer' : 'Med Customer',
    has_existing_product: false,
    has_competition: false,
    complexity_level: 'Med',
    is_variation_of_standard: true,
    opportunity_size: quoteValue,
  });

  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRules();
      loadProducts();
      setCalculation(prev => ({
        ...prev,
        customer_segment: customerSegment === 'Enterprise' ? 'Large Customer' : customerSegment === 'SMB' ? 'Small Customer' : 'Med Customer',
        opportunity_size: quoteValue,
      }));
    }
  }, [isOpen, customerSegment, quoteValue]);

  const loadRules = async () => {
    try {
      const { data, error } = await db
        .from('pricing_rules_config')
        .select('*')
        .eq('is_active', true)
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

  const loadProducts = async () => {
    try {
      const { data, error } = await db
        .from('products')
        .select('id, name, base_cost, category')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const calculatePrice = async () => {
    if (!selectedRule) return;
    setCalculating(true);

    try {
      const rule = rules.find(r => r.id === selectedRule);
      if (!rule) return;

      if (calculation.opportunity_size >= rule.opportunity_threshold) {
        setCalculationDetails({
          requires_strategic_review: true,
          message: `Opportunity size ($${calculation.opportunity_size.toLocaleString()}) exceeds threshold. Strategic pricing review required.`
        });
        setCalculatedPrice(null);
        return;
      }

      if (calculation.is_variation_of_standard) {
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
          const selectedProduct = calculation.standard_product_id
            ? products.find(p => p.id === calculation.standard_product_id)
            : null;

          setCalculatedPrice(price);
          setCalculationDetails({
            method: 'Multiplier Pricing',
            base_price: calculation.standard_product_price,
            multiplier: multiplier.multiplier,
            formula: `$${calculation.standard_product_price.toLocaleString()} × ${multiplier.multiplier}`,
            description: multiplier.description,
            rule_name: rule.name,
            standard_product_id: calculation.standard_product_id,
            standard_product_name: selectedProduct?.name,
            unique_description: calculation.unique_description
          });
        } else {
          setCalculationDetails({
            error: 'No matching multiplier rule found for these conditions'
          });
        }
      } else {
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

        const baseAdder = marginAdders?.find(m => !m.market_segment);
        const marketAdder = calculation.market_segment
          ? marginAdders?.find(m => m.market_segment === calculation.market_segment)
          : null;

        if (baseAdder) {
          const standardMargin = 0.40;
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
            market_description: marketAdder?.description,
            rule_name: rule.name,
            unique_description: calculation.unique_description
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
    } finally {
      setCalculating(false);
    }
  };

  const applyPrice = () => {
    if (calculatedPrice !== null && calculationDetails) {
      onPriceCalculated(calculatedPrice, calculationDetails);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Rules-Based Price Calculator</h2>
              <p className="text-sm text-slate-600">Calculate price for non-standard products</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              No active pricing rules configured. Please configure rules in the Rules Pricing section.
            </div>
          ) : (
            <>
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

              <div className="grid grid-cols-2 gap-4">
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
                    <option value="Low">Low - Standard design, special materials</option>
                    <option value="Med">Medium - Non-std design, medium engineering</option>
                    <option value="High">High - Special non-std design, high engineering</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
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
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Closest Standard Product (Optional)
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        value={calculation.standard_product_id || ''}
                        onChange={(e) => {
                          const product = products.find(p => p.id === e.target.value);
                          setCalculation({
                            ...calculation,
                            standard_product_id: e.target.value || undefined,
                            standard_product_price: product?.base_cost ? product.base_cost * 1.5 : calculation.standard_product_price
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select closest standard product</option>
                        {products
                          .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                          .map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.category})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Standard Product List Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={calculation.standard_product_price || ''}
                      onChange={(e) => setCalculation({ ...calculation, standard_product_price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter list price"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      What makes this unique? *
                    </label>
                    <textarea
                      value={calculation.unique_description || ''}
                      onChange={(e) => setCalculation({ ...calculation, unique_description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe what makes this product different from the standard (e.g., special materials, non-standard dimensions, custom features)"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Product Cost *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={calculation.product_cost || ''}
                        onChange={(e) => setCalculation({ ...calculation, product_cost: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter product cost"
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
                        <option value="Construction">Construction (+3%)</option>
                        <option value="Crane">Crane (+2%)</option>
                        <option value="Energy/Oil">Energy/Oil (+7%)</option>
                        <option value="Military">Military (+7%)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Product Description *
                    </label>
                    <textarea
                      value={calculation.unique_description || ''}
                      onChange={(e) => setCalculation({ ...calculation, unique_description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe the custom/non-standard product specifications and requirements"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={calculatePrice}
                disabled={calculating}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calculating ? 'Calculating...' : 'Calculate Price'}
              </button>

              {calculatedPrice !== null && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Calculated Price</p>
                      <p className="text-3xl font-bold text-emerald-900">
                        ${calculatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  {calculationDetails && (
                    <div className="space-y-2 text-sm text-slate-700 border-t border-emerald-200 pt-3">
                      <p className="font-medium">{calculationDetails.method}</p>
                      {calculationDetails.standard_product_name && (
                        <p className="text-slate-600">
                          <span className="font-medium">Based on:</span> {calculationDetails.standard_product_name}
                        </p>
                      )}
                      <p className="font-mono text-xs bg-white px-2 py-1 rounded">{calculationDetails.formula}</p>
                      {calculationDetails.description && (
                        <p className="text-slate-600">{calculationDetails.description}</p>
                      )}
                      {calculationDetails.market_description && (
                        <p className="text-slate-600">Market: {calculationDetails.market_description}</p>
                      )}
                      {calculationDetails.unique_description && (
                        <div className="bg-white px-3 py-2 rounded border border-emerald-100">
                          <p className="font-medium text-slate-900 mb-1">What's Unique:</p>
                          <p className="text-slate-600">{calculationDetails.unique_description}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={applyPrice}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    Apply This Price
                  </button>
                </div>
              )}

              {calculationDetails?.requires_strategic_review && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
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
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{calculationDetails.error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
