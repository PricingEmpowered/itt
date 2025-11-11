import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Customer, PriceList, Quote, QuoteLine, ProductFamily, QuantityBreak, Currency, Service, QuoteService } from '../types';
import { Plus, Trash2, FileText, Filter, Layers, Package, Headphones, Calculator } from 'lucide-react';
import { PriceGuidance } from './PriceGuidance';
import { RulesPricingModal } from './RulesPricingModal';
import { calculateDealScore } from '../utils/dealScoreCalculator';
import { DealScoreIndicator } from './DealScoreIndicator';
import { calculatePriceWithQuantityBreaks, getAvailableQuantityBreaks, formatQuantityBreakRange, formatQuantityBreakPricing } from '../utils/quantityBreakCalculator';
import { calculateWinProbability } from '../utils/winProbabilityCalculator';
import { WinProbability } from './WinProbability';

export function QuoteBuilder() {
  const [products, setProducts] = useState<(Product & { family?: ProductFamily })[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<(Product & { family?: ProductFamily })[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPriceList, setSelectedPriceList] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1.0);
  const [quoteLines, setQuoteLines] = useState<Partial<QuoteLine>[]>([]);
  const [serviceLines, setServiceLines] = useState<Partial<QuoteService>[]>([]);
  const [lineType, setLineType] = useState<'products' | 'services'>('products');
  const [loading, setLoading] = useState(true);
  const [filterFamily, setFilterFamily] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [productSearchTerms, setProductSearchTerms] = useState<{ [key: number]: string }>({});
  const [dealScore, setDealScore] = useState<number | null>(null);
  const [dealScoreDetails, setDealScoreDetails] = useState<any>(null);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [quantityBreaks, setQuantityBreaks] = useState<QuantityBreak[]>([]);
  const [winProbability, setWinProbability] = useState<any>(null);
  const [calculatingWinProb, setCalculatingWinProb] = useState(false);
  const [showRulesPricingModal, setShowRulesPricingModal] = useState(false);
  const [rulesPricingLineIndex, setRulesPricingLineIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProductsList();
  }, [products, filterFamily, filterCategory]);

  useEffect(() => {
    if (selectedCustomer && quoteLines.length > 0) {
      calculateScore();
      calculateWinProb();
    } else {
      setDealScore(null);
      setDealScoreDetails(null);
      setWinProbability(null);
    }
  }, [quoteLines, selectedCustomer, products]);

  useEffect(() => {
    if (selectedCurrency && selectedPriceList) {
      fetchExchangeRate();
    }
  }, [selectedCurrency, selectedPriceList]);

  const fetchExchangeRate = async () => {
    try {
      const priceList = priceLists.find(pl => pl.id === selectedPriceList);
      const quoteCurrency = currencies.find(c => c.id === selectedCurrency);

      if (!priceList || !quoteCurrency) {
        setExchangeRate(1.0);
        return;
      }

      if (priceList.currency === quoteCurrency.code) {
        setExchangeRate(1.0);
        return;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/currency-rates?base=${priceList.currency}&symbols=${quoteCurrency.code}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rates[quoteCurrency.code]) {
          setExchangeRate(data.rates[quoteCurrency.code]);
        } else {
          setExchangeRate(1.0);
        }
      } else {
        setExchangeRate(1.0);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(1.0);
    }
  };

  const filterProductsList = () => {
    let filtered = [...products];

    if (filterFamily) {
      filtered = filtered.filter(p => p.family_id === filterFamily);
    }

    if (filterCategory) {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    setFilteredProducts(filtered);
  };

  const loadData = async () => {
    try {
      const [productsRes, servicesRes, customersRes, priceListsRes, currenciesRes, familiesRes, quantityBreaksRes] = await Promise.all([
        supabase.from('products').select('*, family:product_families(id, name)').eq('status', 'Active'),
        supabase.from('services').select('*, sla_tier:service_sla_tiers(*)').eq('is_active', true),
        supabase.from('customers').select('*'),
        supabase.from('price_lists').select('*'),
        supabase.from('currencies').select('*').eq('is_active', true).order('code'),
        supabase.from('product_families').select('*').order('name'),
        supabase.from('quantity_breaks').select('*'),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
        setFilteredProducts(productsRes.data);
      }
      if (servicesRes.data) {
        setServices(servicesRes.data.map(s => ({
          ...s,
          features: s.features || []
        })));
      }
      if (customersRes.data) setCustomers(customersRes.data);
      if (priceListsRes.data) setPriceLists(priceListsRes.data);
      if (currenciesRes.data) {
        setCurrencies(currenciesRes.data);
        const usd = currenciesRes.data.find(c => c.code === 'USD');
        if (usd) setSelectedCurrency(usd.id);
      }
      if (familiesRes.data) setFamilies(familiesRes.data);
      if (quantityBreaksRes.data) setQuantityBreaks(quantityBreaksRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    if (lineType === 'products') {
      setQuoteLines([
        ...quoteLines,
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          discount_applied: 0,
          line_total: 0,
        },
      ]);
    } else {
      setServiceLines([
        ...serviceLines,
        {
          service_id: '',
          billing_period: 'annual',
          quantity: 1,
          unit_price: 0,
          discount_applied: 0,
          line_total: 0,
          contract_term_months: 12,
        },
      ]);
    }
  };

  const addServiceLine = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    setServiceLines([
      ...serviceLines,
      {
        service_id: serviceId,
        billing_period: 'annual',
        quantity: 1,
        unit_price: service.base_price_annual,
        discount_applied: 0,
        line_total: service.base_price_annual,
        contract_term_months: 12,
      },
    ]);
  };

  const updateServiceLine = (index: number, field: string, value: any) => {
    const updated = [...serviceLines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'service_id') {
      const service = services.find(s => s.id === value);
      if (service) {
        const billingPeriod = updated[index].billing_period || 'annual';
        updated[index].unit_price = billingPeriod === 'annual'
          ? service.base_price_annual
          : service.base_price_monthly;
      }
    }

    if (field === 'billing_period') {
      const service = services.find(s => s.id === updated[index].service_id);
      if (service) {
        updated[index].unit_price = value === 'annual'
          ? service.base_price_annual
          : service.base_price_monthly;
      }
    }

    if (field === 'quantity' || field === 'unit_price' || field === 'discount_applied') {
      const quantity = updated[index].quantity || 0;
      const unitPrice = updated[index].unit_price || 0;
      const discount = updated[index].discount_applied || 0;
      updated[index].line_total = quantity * (unitPrice - discount);
    }

    setServiceLines(updated);
  };

  const removeServiceLine = (index: number) => {
    setServiceLines(serviceLines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...quoteLines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].unit_price = product.base_cost * 1.5;
      }
    }

    if (field === 'product_id' || field === 'quantity') {
      const productId = updated[index].product_id;
      const quantity = updated[index].quantity || 0;
      const basePrice = updated[index].unit_price || 0;

      if (productId && quantity > 0) {
        const productBreaks = getAvailableQuantityBreaks(productId, quantityBreaks, selectedPriceList);
        const result = calculatePriceWithQuantityBreaks(basePrice, quantity, productBreaks, selectedPriceList);

        if (result.appliedBreak) {
          updated[index].unit_price = result.effectivePrice;
          updated[index].discount_applied = result.discount;
        }
      }
    }

    if (field === 'quantity' || field === 'unit_price' || field === 'discount_applied') {
      const qty = updated[index].quantity || 0;
      const price = updated[index].unit_price || 0;
      const discount = updated[index].discount_applied || 0;
      updated[index].line_total = qty * price * (1 - discount / 100);
    }

    setQuoteLines(updated);
  };

  const getFilteredProductsForLine = (index: number) => {
    const searchTerm = productSearchTerms[index] || '';
    if (!searchTerm) return filteredProducts;

    return filteredProducts.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const updateProductSearch = (index: number, searchTerm: string) => {
    setProductSearchTerms(prev => ({
      ...prev,
      [index]: searchTerm
    }));
  };

  const removeLine = (index: number) => {
    setQuoteLines(quoteLines.filter((_, i) => i !== index));
  };

  const handleRulesPriceCalculated = (price: number, details: any) => {
    if (rulesPricingLineIndex !== null) {
      updateLine(rulesPricingLineIndex, 'unit_price', price);
    }
    setShowRulesPricingModal(false);
    setRulesPricingLineIndex(null);
  };

  const openRulesPricingModal = (index: number) => {
    setRulesPricingLineIndex(index);
    setShowRulesPricingModal(true);
  };

  const calculateTotals = () => {
    const productTotal = quoteLines.reduce((sum, line) => sum + (line.line_total || 0), 0);
    const serviceTotal = serviceLines.reduce((sum, line) => sum + (line.line_total || 0), 0);
    const subtotal = productTotal + serviceTotal;
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    return { subtotal, tax, total, productTotal, serviceTotal };
  };

  const calculateScore = async () => {
    if (!selectedCustomer || (quoteLines.length === 0 && serviceLines.length === 0)) return;

    setCalculatingScore(true);
    try {
      const result = await calculateDealScore(quoteLines, products, selectedCustomer);
      setDealScore(result.score);
      setDealScoreDetails(result.details);
    } catch (error) {
      console.error('Error calculating deal score:', error);
    } finally {
      setCalculatingScore(false);
    }
  };

  const calculateWinProb = async () => {
    if (!selectedCustomer || (quoteLines.length === 0 && serviceLines.length === 0)) return;

    setCalculatingWinProb(true);
    try {
      const productIds = quoteLines
        .filter(line => line.product_id)
        .map(line => line.product_id as string);

      const totalDiscount = quoteLines.reduce((sum, line) => {
        const product = products.find(p => p.id === line.product_id);
        if (!product) return sum;
        const discountPercent = ((product.list_price - (line.unit_price || 0)) / product.list_price) * 100;
        return sum + discountPercent;
      }, 0);
      const averageDiscount = quoteLines.length > 0 ? totalDiscount / quoteLines.length : 0;

      const { total } = calculateTotals();
      const quoteTotal = total * exchangeRate;

      const result = await calculateWinProbability(
        selectedCustomer,
        productIds,
        averageDiscount,
        quoteTotal
      );

      setWinProbability(result);
    } catch (error) {
      console.error('Error calculating win probability:', error);
    } finally {
      setCalculatingWinProb(false);
    }
  };

  const saveQuote = async () => {
    if (!selectedCustomer || !selectedPriceList || (quoteLines.length === 0 && serviceLines.length === 0)) {
      alert('Please select customer, price list, and add at least one line item');
      return;
    }

    try {
      const { subtotal, tax, total } = calculateTotals();
      const quoteId = `Q-${Date.now()}`;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        alert('Please sign in to create quotes');
        return;
      }

      const scoreResult = await calculateDealScore(quoteLines, products, selectedCustomer);

      const { error: quoteError } = await supabase.from('quotes').insert([
        {
          id: quoteId,
          customer_id: selectedCustomer,
          price_list_id: selectedPriceList,
          status: 'Draft',
          subtotal: subtotal * exchangeRate,
          tax: tax * exchangeRate,
          total: total * exchangeRate,
          currency_id: selectedCurrency,
          exchange_rate: exchangeRate,
          created_by: userData.user.id,
          approvals_required: 0,
          deal_score: scoreResult.score,
          deal_score_details: scoreResult.details,
          deal_score_calculated_at: new Date().toISOString(),
        },
      ]);

      if (quoteError) throw quoteError;

      if (quoteLines.length > 0) {
        const linesToInsert = quoteLines.map((line) => ({
          quote_id: quoteId,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_applied: line.discount_applied,
          line_total: line.line_total,
        }));

        const { error: linesError } = await supabase.from('quote_lines').insert(linesToInsert);
        if (linesError) throw linesError;
      }

      if (serviceLines.length > 0) {
        const servicesToInsert = serviceLines.map((line) => ({
          quote_id: quoteId,
          service_id: line.service_id,
          billing_period: line.billing_period,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_applied: line.discount_applied,
          line_total: line.line_total,
          contract_term_months: line.contract_term_months,
        }));

        const { error: servicesError } = await supabase.from('quote_services').insert(servicesToInsert);
        if (servicesError) throw servicesError;
      }

      const { data: tiers } = await supabase.from('commission_tiers').select('*').eq('is_active', true);

      if (tiers && tiers.length > 0) {
        const dealSize = total * exchangeRate;
        const dealScore = scoreResult.score;

        const applicableTier = tiers
          .filter(tier => {
            const meetsMin = dealSize >= tier.min_deal_size;
            const meetsMax = tier.max_deal_size === null || dealSize <= tier.max_deal_size;
            return meetsMin && meetsMax;
          })
          .sort((a, b) => b.min_deal_size - a.min_deal_size)[0];

        if (applicableTier) {
          const basePercent = applicableTier.base_commission_percent;
          const qualifiesForBonus = dealScore && dealScore >= applicableTier.min_deal_score;
          const bonusPercent = qualifiesForBonus ? applicableTier.deal_score_bonus_percent : 0;
          const totalPercent = basePercent + bonusPercent;
          const commissionAmount = dealSize * (totalPercent / 100);

          await supabase.from('sales_commissions').insert({
            quote_id: quoteId,
            sales_rep_id: userData.user.id,
            sales_rep_email: userData.user.email || 'unknown',
            deal_size: dealSize,
            deal_score: dealScore,
            commission_tier_id: applicableTier.id,
            base_commission_percent: basePercent,
            deal_score_bonus_percent: bonusPercent,
            total_commission_percent: totalPercent,
            commission_amount: commissionAmount,
            status: 'pending'
          });
        }
      }

      alert(`Quote ${quoteId} created successfully!`);
      setQuoteLines([]);
      setServiceLines([]);
      setSelectedCustomer('');
      setSelectedPriceList('');
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Error saving quote');
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Create Quote</h2>
        <button
          onClick={saveQuote}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileText size={20} />
          Save Quote
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.segment})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price List
            </label>
            <select
              value={selectedPriceList}
              onChange={(e) => setSelectedPriceList(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Price List</option>
              {priceLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.currency})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} ({currency.symbol})
                </option>
              ))}
            </select>
            {exchangeRate !== 1.0 && (
              <p className="text-xs text-gray-500 mt-1">
                Exchange rate: {exchangeRate.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={20} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Product Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Family
            </label>
            <select
              value={filterFamily}
              onChange={(e) => setFilterFamily(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Families</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              <option value="Pumps">Pumps</option>
              <option value="Valves">Valves</option>
              <option value="Controls">Controls</option>
              <option value="Accessories">Accessories</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <button
              onClick={addLine}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={16} />
              Add Line
            </button>
          </div>
          <div className="flex gap-2 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setLineType('products')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                lineType === 'products'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package size={16} />
              Products ({quoteLines.length})
            </button>
            <button
              onClick={() => setLineType('services')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                lineType === 'services'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Headphones size={16} />
              Services ({serviceLines.length})
            </button>
          </div>
        </div>

        {lineType === 'products' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Discount %
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Margin %
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Line Total
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quoteLines.map((line, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearchTerms[index] || ''}
                        onChange={(e) => updateProductSearch(index, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        value={line.product_id}
                        onChange={(e) => {
                          updateLine(index, 'product_id', e.target.value);
                          setSelectedLineIndex(index);
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Select Product</option>
                        {getFilteredProductsForLine(index).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} {product.family?.name ? `(${product.family.name})` : ''}
                          </option>
                        ))}
                      </select>
                      {!line.product_id && (
                        <button
                          onClick={() => openRulesPricingModal(index)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Calculator size={14} />
                          Calculate Non-Standard Price
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                      />
                      {line.product_id && getAvailableQuantityBreaks(line.product_id, quantityBreaks, selectedPriceList).length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-blue-600">
                          <Layers size={12} />
                          <span>Qty breaks available</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => {
                        updateLine(index, 'unit_price', parseFloat(e.target.value));
                        setSelectedLineIndex(index);
                      }}
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={line.discount_applied}
                      onChange={(e) => updateLine(index, 'discount_applied', parseFloat(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {line.product_id && (() => {
                      const product = products.find(p => p.id === line.product_id);
                      if (product && line.unit_price) {
                        const effectivePrice = (line.unit_price || 0) * (1 - (line.discount_applied || 0) / 100);
                        const margin = ((effectivePrice - product.base_cost) / effectivePrice) * 100;
                        const marginColor = margin < 20 ? 'text-red-600' : margin < 30 ? 'text-amber-600' : 'text-emerald-600';
                        return <span className={`font-semibold ${marginColor}`}>{margin.toFixed(1)}%</span>;
                      }
                      return <span className="text-gray-400">-</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    ${(line.line_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeLine(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {quoteLines.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No product lines. Click "Add Line" to start adding products.
            </div>
          )}
        </div>
        )}

        {lineType === 'services' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Service
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Billing Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Line Total
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviceLines.map((line, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <select
                        value={line.service_id}
                        onChange={(e) => updateServiceLine(index, 'service_id', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Select Service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={line.billing_period}
                        onChange={(e) => updateServiceLine(index, 'billing_period', e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="annual">Annual</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateServiceLine(index, 'quantity', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateServiceLine(index, 'unit_price', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.discount_applied}
                        onChange={(e) => updateServiceLine(index, 'discount_applied', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      ${(line.line_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeServiceLine(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {serviceLines.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No service lines. Click "Add Line" to start adding services.
              </div>
            )}
          </div>
        )}
      </div>

      {selectedLineIndex !== null && quoteLines[selectedLineIndex]?.product_id && (
        <PriceGuidance
          productId={quoteLines[selectedLineIndex].product_id || ''}
          unitPrice={quoteLines[selectedLineIndex].unit_price || 0}
          discount={quoteLines[selectedLineIndex].discount_applied || 0}
          customerId={selectedCustomer}
        />
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quote Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span className="font-medium">
                  {currencies.find(c => c.id === selectedCurrency)?.symbol || '$'}
                  {(subtotal * exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Tax (5%):</span>
                <span className="font-medium">
                  {currencies.find(c => c.id === selectedCurrency)?.symbol || '$'}
                  {(tax * exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                <span>Total:</span>
                <span>
                  {currencies.find(c => c.id === selectedCurrency)?.symbol || '$'}
                  {(total * exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {exchangeRate !== 1.0 && (
                <div className="text-xs text-gray-500 pt-2 border-t">
                  <div>Price List: {priceLists.find(pl => pl.id === selectedPriceList)?.currency || 'USD'}</div>
                  <div>Quote: {currencies.find(c => c.id === selectedCurrency)?.code || 'USD'}</div>
                  <div>Rate: {exchangeRate.toFixed(4)}</div>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Deal Score</h3>
            {calculatingScore ? (
              <div className="text-sm text-gray-500">Calculating score...</div>
            ) : (
              <DealScoreIndicator score={dealScore} details={dealScoreDetails} showDetails />
            )}
            {dealScore && dealScoreDetails && (
              <div className="mt-2 text-xs text-gray-600">
                Based on {dealScoreDetails.comparable_deals_count} comparable deals from same industry and region
              </div>
            )}
          </div>
        </div>

        {winProbability && (
          <div className="mt-6">
            {calculatingWinProb ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="text-sm text-gray-500">Calculating win probability...</div>
              </div>
            ) : (
              <WinProbability
                probability={winProbability.probability}
                confidence={winProbability.confidence}
                factors={winProbability.factors}
                insights={winProbability.insights}
              />
            )}
          </div>
        )}
      </div>

      <RulesPricingModal
        isOpen={showRulesPricingModal}
        onClose={() => {
          setShowRulesPricingModal(false);
          setRulesPricingLineIndex(null);
        }}
        onPriceCalculated={handleRulesPriceCalculated}
        customerSegment={customers.find(c => c.id === selectedCustomer)?.segment}
        quoteValue={calculateTotals().total}
      />
    </div>
  );
}
