import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  PriceSimulation as PriceSimulationType,
  SimulationResult,
  ProductFamily,
  Product,
  Customer,
  Quote,
  QuoteLine,
  Region,
  Industry,
} from '../types';
import { Play, TrendingUp, TrendingDown, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { calculateSimulationScenarios, formatCurrency, formatPercent } from '../utils/simulationCalculator';

export function PriceSimulation() {
  const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);

  const [simulationName, setSimulationName] = useState('');
  const [priceChange, setPriceChange] = useState<number>(0);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  const customerSegments = ['Enterprise', 'Mid-Market', 'Small Business', 'Startup'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [familiesRes, productsRes, customersRes, regionsRes, industriesRes] = await Promise.all([
        supabase.from('product_families').select('*').order('name'),
        supabase.from('products').select('*').eq('status', 'Active').order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
        supabase.from('industries').select('*').order('name'),
      ]);

      if (familiesRes.data) setProductFamilies(familiesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      if (customersRes.data) setCustomers(customersRes.data);
      if (regionsRes.data) setRegions(regionsRes.data);
      if (industriesRes.data) setIndustries(industriesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFamily = (familyId: string) => {
    setSelectedFamilies(prev =>
      prev.includes(familyId) ? prev.filter(id => id !== familyId) : [...prev, familyId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleSegment = (segment: string) => {
    setSelectedSegments(prev =>
      prev.includes(segment) ? prev.filter(s => s !== segment) : [...prev, segment]
    );
  };

  const toggleRegion = (regionId: string) => {
    setSelectedRegions(prev =>
      prev.includes(regionId) ? prev.filter(id => id !== regionId) : [...prev, regionId]
    );
  };

  const toggleIndustry = (industryId: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industryId) ? prev.filter(id => id !== industryId) : [...prev, industryId]
    );
  };

  const runSimulation = async () => {
    if (!simulationName.trim()) {
      alert('Please enter a simulation name');
      return;
    }

    if (priceChange === 0) {
      alert('Please enter a price change percentage');
      return;
    }

    if (selectedFamilies.length === 0 && selectedProducts.length === 0) {
      alert('Please select at least one product family or product');
      return;
    }

    setRunning(true);
    setResults([]);

    try {
      let affectedProductIds = [...selectedProducts];

      if (selectedFamilies.length > 0) {
        const familyProducts = products.filter(p => selectedFamilies.includes(p.family_id || ''));
        affectedProductIds = [...affectedProductIds, ...familyProducts.map(p => p.id)];
      }

      affectedProductIds = [...new Set(affectedProductIds)];

      let affectedCustomerIds: string[] = [];

      // Filter by segments
      if (selectedSegments.length > 0) {
        affectedCustomerIds = customers
          .filter(c => selectedSegments.includes(c.segment))
          .map(c => c.id);
      }

      // Filter by regions
      if (selectedRegions.length > 0) {
        const regionFiltered = customers
          .filter(c => c.region_id && selectedRegions.includes(c.region_id))
          .map(c => c.id);

        if (affectedCustomerIds.length > 0) {
          // Intersect with existing filters
          affectedCustomerIds = affectedCustomerIds.filter(id => regionFiltered.includes(id));
        } else {
          affectedCustomerIds = regionFiltered;
        }
      }

      // Filter by industries
      if (selectedIndustries.length > 0) {
        const industryFiltered = customers
          .filter(c => c.industry_id && selectedIndustries.includes(c.industry_id))
          .map(c => c.id);

        if (affectedCustomerIds.length > 0) {
          // Intersect with existing filters
          affectedCustomerIds = affectedCustomerIds.filter(id => industryFiltered.includes(id));
        } else {
          affectedCustomerIds = industryFiltered;
        }
      }

      const [quotesRes, quoteLinesRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('status', 'Approved'),
        supabase.from('quote_lines').select('*'),
      ]);

      const scenarios = calculateSimulationScenarios({
        priceChangePercent: priceChange,
        affectedProductIds,
        affectedCustomerIds,
        historicalData: {
          quotes: quotesRes.data || [],
          quoteLines: quoteLinesRes.data || [],
          products,
          customers,
        },
      });

      const { data: simulation, error: simError } = await supabase
        .from('price_simulations')
        .insert({
          name: simulationName,
          description: `Price change: ${priceChange > 0 ? '+' : ''}${priceChange}%`,
          price_change_percent: priceChange,
          applies_to_families: selectedFamilies,
          applies_to_products: selectedProducts,
          applies_to_customer_segments: selectedSegments,
          status: 'completed',
        })
        .select()
        .single();

      if (simError) throw simError;

      const resultsToInsert = scenarios.map(scenario => ({
        simulation_id: simulation.id,
        ...scenario,
      }));

      const { data: savedResults, error: resultsError } = await supabase
        .from('simulation_results')
        .insert(resultsToInsert)
        .select();

      if (resultsError) throw resultsError;

      setResults(savedResults || []);
    } catch (error: any) {
      console.error('Error running simulation:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'best_case':
        return <TrendingUp className="text-green-600" size={20} />;
      case 'worst_case':
        return <TrendingDown className="text-red-600" size={20} />;
      default:
        return <DollarSign className="text-blue-600" size={20} />;
    }
  };

  const getScenarioColor = (type: string) => {
    switch (type) {
      case 'best_case':
        return 'border-green-200 bg-green-50';
      case 'worst_case':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getScenarioLabel = (type: string) => {
    switch (type) {
      case 'best_case':
        return 'Best Case';
      case 'worst_case':
        return 'Worst Case';
      default:
        return 'Mid Case';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Price Simulation</h2>
        <p className="text-gray-600 mt-1">
          Test price changes and see best/mid/worst case scenarios with AI-powered analysis
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Simulation Name
          </label>
          <input
            type="text"
            value={simulationName}
            onChange={(e) => setSimulationName(e.target.value)}
            placeholder="e.g., Q1 2025 Price Increase"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price Change (%)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={priceChange}
              onChange={(e) => setPriceChange(Number(e.target.value))}
              className="flex-1"
            />
            <div className="w-32">
              <input
                type="number"
                value={priceChange}
                onChange={(e) => setPriceChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {priceChange > 0 ? 'Increase' : priceChange < 0 ? 'Decrease' : 'No change'}: {Math.abs(priceChange)}%
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Product Scope</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Families ({selectedFamilies.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {productFamilies.map((family) => (
                  <label
                    key={family.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFamilies.includes(family.id)}
                      onChange={() => toggleFamily(family.id)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{family.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specific Products ({selectedProducts.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{product.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Customer Scope</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Regions ({selectedRegions.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {regions.map((region) => (
                  <label
                    key={region.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRegions.includes(region.id)}
                      onChange={() => toggleRegion(region.id)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{region.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industries ({selectedIndustries.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {industries.map((industry) => (
                  <label
                    key={industry.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndustries.includes(industry.id)}
                      onChange={() => toggleIndustry(industry.id)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{industry.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Segments ({selectedSegments.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {customerSegments.map((segment) => (
                  <label
                    key={segment}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment)}
                      onChange={() => toggleSegment(segment)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{segment}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Leave customer filters empty to include all customers. Multiple filters are combined with AND logic.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={runSimulation}
            disabled={running}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={20} />
            {running ? 'Running Simulation...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900">Simulation Results</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {results
              .sort((a, b) => {
                const order = { best_case: 0, mid_case: 1, worst_case: 2 };
                return order[a.scenario_type] - order[b.scenario_type];
              })
              .map((result) => (
                <div
                  key={result.id}
                  className={`border-2 rounded-lg p-6 ${getScenarioColor(result.scenario_type)}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    {getScenarioIcon(result.scenario_type)}
                    <h4 className="text-lg font-bold text-gray-900">
                      {getScenarioLabel(result.scenario_type)}
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Projected Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(result.projected_revenue)}
                      </p>
                      <p className={`text-sm font-medium ${result.revenue_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(result.revenue_change_percent)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Projected Margin</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(result.projected_margin)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Volume Impact</p>
                      <p className={`text-lg font-semibold ${result.volume_impact_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(result.volume_impact_percent)}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-300">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Confidence</span>
                        <span className="font-semibold text-gray-900">
                          {result.confidence_score}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Key Factors:</p>
                    <ul className="space-y-1">
                      {result.rationale.factors.slice(0, 2).map((factor, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                          <CheckCircle size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-xs font-semibold text-gray-700 mb-2 mt-3">Risks:</p>
                    <ul className="space-y-1">
                      {result.rationale.risks.slice(0, 2).map((risk, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                          <AlertCircle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                        View Full Analysis
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="font-semibold text-gray-700">Opportunities:</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            {result.rationale.opportunities.map((opp, idx) => (
                              <li key={idx} className="text-gray-600">{opp}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Assumptions:</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            {result.rationale.assumptions.map((ass, idx) => (
                              <li key={idx} className="text-gray-600">{ass}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Affected Scope:</p>
                <p>
                  {results[0].affected_products} products •{' '}
                  {results[0].affected_customers} customers •{' '}
                  Based on historical transaction data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
