import { useState, useEffect, useRef } from 'react';
import { getCurrentUser } from '../lib/currentUser';
import { trpcClient } from '../lib/trpcClient';
import { db } from '../lib/dataClient';
import { Product, Customer, PriceList, QuoteLine, ProductFamily, QuantityBreak, Currency, Service, QuoteService } from '../types';
import { Plus, Trash2, FileText, Filter, Layers, Package, Headphones, Upload, Sparkles, AlertTriangle } from 'lucide-react';
import { parseChannelPartnersForm, requestIdOf, type ParsedForm } from '../utils/channelPartnersForm';
import { PriceBandCell } from './PriceBandCell';
import { assessEscalation, summariseEscalation } from '../utils/escalation';
import type { PricedLine } from '../../server/pricing/priceQuoteLines';
import { PriceGuidance } from './PriceGuidance';
import { calculateDealScore } from '../utils/dealScoreCalculator';
import { DealScoreIndicator } from './DealScoreIndicator';
import { calculatePriceWithQuantityBreaks, getAvailableQuantityBreaks } from '../utils/quantityBreakCalculator';
import { calculateWinProbability } from '../utils/winProbabilityCalculator';
import { WinProbability } from './WinProbability';
import { deriveListPrice, discountFromListPrice } from '../utils/listPrice';

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
  const [pricedLines, setPricedLines] = useState<Record<number, PricedLine>>({});
  const [pricing, setPricing] = useState(false);
  const [uploadReport, setUploadReport] = useState<{
    fileName: string;
    form: ParsedForm;
    matched: number;
    unmatchedParts: string[];
    inactiveParts: string[];
    requestId: string | null;
    requestIdConflict: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [winProbability, setWinProbability] = useState<any>(null);
  const [calculatingWinProb, setCalculatingWinProb] = useState(false);

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
      const response = await fetch(
        `/api/currency-rates?base=${priceList.currency}&symbols=${quoteCurrency.code}`
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
        // These two need their related row embedded, which the generic table
        // API deliberately does not do; they have real endpoints instead.
        trpcClient.reference.activeProductsWithFamily.query().then((data) => ({ data })),
        trpcClient.reference.activeServicesWithSla.query().then((data) => ({ data })),
        db.from('customers').select('*'),
        db.from('price_lists').select('*'),
        db.from('currencies').select('*').eq('is_active', true).order('code'),
        db.from('product_families').select('*').order('name'),
        db.from('quantity_breaks').select('*'),
      ]);

      if (productsRes.data) {
        // The joined endpoints return untyped rows; their shape is asserted
        // here rather than threading generics through the query layer.
        const products = productsRes.data as unknown as (Product & { family?: ProductFamily })[];
        setProducts(products);
        setFilteredProducts(products);
      }
      if (servicesRes.data) {
        setServices((servicesRes.data as unknown as Service[]).map(s => ({
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

  const money = (v: number) =>
    '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /*
   * A target is a calculated figure and carries full precision; a unit price
   * is money and does not. $486.2559664397803 is not a price anyone can quote,
   * so anything that becomes a unit price is rounded to the cent first.
   */
  const toCents = (v: number) => Math.round(v * 100) / 100;

  /*
   * Prices every line in one call. Takes the lines as an argument rather than
   * reading state because the upload prices immediately after building them,
   * and a state update is not visible until the next render.
   */
  const priceAllLines = async (lines: Partial<QuoteLine>[], applyTargets = false) => {
    const payload = lines.map((l) => ({
      productId: l.product_id || null,
      partNumber: l.source_part_number ?? null,
      quantity: l.quantity ?? null,
      listPrice: l.entered_list_price ?? null,
      cost: l.booked_cost ?? null,
    }));
    if (payload.length === 0) return;

    setPricing(true);
    try {
      const result = await trpcClient.quotes.priceLines.query({
        customerId: selectedCustomer || null,
        lines: payload,
      });
      const byIndex: Record<number, PricedLine> = {};
      for (const p of result) byIndex[p.index] = p;
      setPricedLines(byIndex);

      /*
       * On upload the target becomes the starting unit price, so the analyst
       * opens a priced quote and adjusts from there rather than a quote of
       * zeroes. Lines that could not be priced are left at zero: there is no
       * number to start from, and inventing one is the thing this whole path
       * exists to avoid. Re-pricing an existing quote does not overwrite
       * prices the analyst has already set.
       */
      if (applyTargets) {
        const priced = lines.map((line, i) => {
          const raw = byIndex[i]?.band.target;
          if (raw === null || raw === undefined) return line;
          const target = toCents(raw);
          const qty = line.quantity || 0;
          const discount = line.discount_applied || 0;
          return {
            ...line,
            unit_price: target,
            line_total: qty * target * (1 - discount / 100),
          };
        });
        setQuoteLines(priced);
      } else {
        setQuoteLines(lines);
      }
    } catch (error) {
      console.error('Pricing failed:', error);
      setQuoteLines(lines);
    } finally {
      setPricing(false);
    }
  };

  /*
   * Reads an uploaded Channel Partners form into lines and prices them.
   *
   * A part number matching the catalogue becomes a catalogue line and can be
   * priced from comparable history. One that does not is kept as a line
   * carrying its part number: that is the configured-product case, and
   * dropping it would lose the part of the quote the desk most needs to see.
   *
   * Quantities that failed validation are left empty rather than defaulted to
   * one. An empty box is a question; a 1 is a wrong answer that looks right.
   */
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const form = parseChannelPartnersForm(await file.text());

    if (form.fatal.length > 0) {
      setUploadReport({
        fileName: file.name,
        form,
        matched: 0,
        unmatchedParts: [],
        inactiveParts: [],
        requestId: null,
        requestIdConflict: [],
      });
      return;
    }

    /*
     * Part numbers resolve on the server against the whole catalogue rather
     * than against the active-products list held here. An uploaded request
     * can name a discontinued part, and that part still has a cost and a
     * category to price from.
     */
    const partNumbers = form.lines
      .map((l) => l.partNumber)
      .filter((p): p is string => !!p);

    const resolved = new Map<
      string,
      { productId: string; status: string | null; name: string }
    >();
    if (partNumbers.length > 0) {
      try {
        const matches = await trpcClient.reference.resolveParts.query({ partNumbers });
        for (const m of matches) {
          resolved.set(m.partNumber, {
            productId: m.productId,
            status: m.status,
            name: m.name,
          });
        }
      } catch (error) {
        console.error('Part resolution failed:', error);
      }
    }

    const unmatchedParts: string[] = [];
    const inactiveParts: string[] = [];

    const newLines: Partial<QuoteLine>[] = form.lines.map((l) => {
      const match = l.partNumber ? resolved.get(l.partNumber.trim().toLowerCase()) : undefined;
      if (l.partNumber && !match) unmatchedParts.push(l.partNumber);
      if (l.partNumber && match && match.status !== 'Active') inactiveParts.push(l.partNumber);
      return {
        product_id: match?.productId ?? '',
        source_part_number: l.partNumber,
        quantity: l.quantity ?? undefined,
        unit_price: 0,
        discount_applied: 0,
        line_total: 0,
        entered_list_price: l.listPrice,
        booked_cost: l.cost,
      };
    });

    const { id, conflict } = requestIdOf(form);

    setServiceLines([]);
    setPricedLines({});
    setLineType('products');
    setUploadReport({
      fileName: file.name,
      form,
      matched: newLines.length - unmatchedParts.length,
      unmatchedParts,
      inactiveParts,
      requestId: id,
      requestIdConflict: conflict,
    });

    await priceAllLines(newLines, true);
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
        updated[index].unit_price = deriveListPrice(product);
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
        const discountPercent = discountFromListPrice(product, line.unit_price || 0);
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

      const { data: userData } = await getCurrentUser();
      if (!userData.user) {
        alert('Please sign in to create quotes');
        return;
      }

      const scoreResult = await calculateDealScore(quoteLines, products, selectedCustomer);

      const { error: quoteError } = await db.from('quotes').insert([
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

        const { error: linesError } = await db.from('quote_lines').insert(linesToInsert);
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

        const { error: servicesError } = await db.from('quote_services').insert(servicesToInsert);
        if (servicesError) throw servicesError;
      }

      const { data: tiers } = await db.from('commission_tiers').select('*').eq('is_active', true);

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

          await db.from('sales_commissions').insert({
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

      /*
       * Submit for approval. Until now a saved quote sat at Draft with
       * approvals_required 0 and nothing was ever added to the queue, so a
       * deep discount reached a customer with no review at all.
       *
       * The server recomputes discount, value and margin from the quote's own
       * lines and decides the level; nothing here is trusted for routing.
       */
      let outcome: string;
      try {
        const submission = await trpcClient.quotes.submitForApproval.mutate({ quoteId });
        const f = submission.financials;
        const margin =
          f.marginPercent === null ? 'margin unknown' : `${f.marginPercent.toFixed(1)}% margin`;

        outcome =
          submission.requiredLevel === 0
            ? `Quote ${quoteId} created and sent.\n\n` +
              `${f.discountPercent.toFixed(1)}% discount, ${margin} — within all approval thresholds.`
            : `Quote ${quoteId} created and submitted for approval.\n\n` +
              `${f.discountPercent.toFixed(1)}% discount, ${margin} — needs level ` +
              `${submission.requiredLevel} approval.`;

        if (submission.notes.length > 0) outcome += `\n\n${submission.notes.join('\n')}`;
      } catch (submitError) {
        /*
         * The quote is saved either way. Routing failing must not look like
         * the save failing, or someone re-enters it and creates a duplicate.
         */
        console.error('Error submitting for approval:', submitError);
        outcome =
          `Quote ${quoteId} was saved, but could not be submitted for approval.\n\n` +
          `It is in Draft and will not reach the approval queue until it is resubmitted.`;
      }

      alert(outcome);
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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                title="Upload a Channel Partners quote request"
              >
                <Upload size={16} />
                Upload request
              </button>
              <button
                onClick={() => priceAllLines(quoteLines)}
                disabled={pricing || quoteLines.length === 0}
                className="flex items-center gap-2 border border-blue-600 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Sparkles size={16} />
                {pricing ? 'Pricing…' : 'Price lines'}
              </button>
              <button
                onClick={addLine}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Add Line
              </button>
            </div>
          </div>

          {uploadReport && (() => {
            const rowsWithErrors = uploadReport.form.lines.filter((l) => l.errors.length > 0);
            const fatal = uploadReport.form.fatal.length > 0;
            return (
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  fatal ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium text-gray-800">{uploadReport.fileName}</div>
                  <button
                    onClick={() => setUploadReport(null)}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    dismiss
                  </button>
                </div>

                {fatal ? (
                  <div className="mt-1 text-red-800">{uploadReport.form.fatal.join(' ')}</div>
                ) : (
                  <div className="mt-1 space-y-1 text-gray-700">
                    <div>
                      {uploadReport.form.lines.length} line
                      {uploadReport.form.lines.length === 1 ? '' : 's'} read ·{' '}
                      {uploadReport.matched} matched the catalogue
                      {uploadReport.unmatchedParts.length > 0 && (
                        <>
                          {' '}· {uploadReport.unmatchedParts.length} not in the catalogue, kept as
                          entered
                        </>
                      )}
                    </div>

                    {uploadReport.inactiveParts.length > 0 && (
                      <div className="flex gap-1 text-xs text-amber-800">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>
                          {uploadReport.inactiveParts.length} part
                          {uploadReport.inactiveParts.length === 1 ? ' is' : 's are'} marked
                          inactive in the catalogue ({uploadReport.inactiveParts.join(', ')}). They
                          are priced from their catalogue cost and history, but check whether they
                          are still sellable.
                        </span>
                      </div>
                    )}

                    {uploadReport.requestId && (
                      <div className="text-xs text-gray-600">
                        Request <span className="font-medium">{uploadReport.requestId}</span>
                      </div>
                    )}

                    {uploadReport.requestIdConflict.length > 0 && (
                      <div className="flex gap-1 text-xs text-amber-800">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>
                          This file carries more than one request identifier (
                          {uploadReport.requestIdConflict.join(', ')}), which usually means two
                          requests were exported together. The returned win/loss and escalation
                          files cannot be matched back unless one request is quoted at a time.
                        </span>
                      </div>
                    )}

                    {uploadReport.form.unmappedHeaders.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Columns not used: {uploadReport.form.unmappedHeaders.join(', ')}
                      </div>
                    )}

                    {rowsWithErrors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-1 text-xs font-medium text-amber-800">
                          <AlertTriangle size={13} />
                          {rowsWithErrors.length} row
                          {rowsWithErrors.length === 1 ? '' : 's'} need attention
                        </div>
                        {rowsWithErrors.slice(0, 8).map((l) => (
                          <div key={l.rowNumber} className="text-xs text-amber-800 pl-4">
                            Row {l.rowNumber}
                            {l.partNumber ? ` (${l.partNumber})` : ''}: {l.errors.join(' ')}
                          </div>
                        ))}
                        {rowsWithErrors.length > 8 && (
                          <div className="text-xs text-amber-700 pl-4">
                            and {rowsWithErrors.length - 8} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {Object.keys(pricedLines).length > 0 && (() => {
            const counts = summariseEscalation(
              quoteLines.map((line, i) =>
                assessEscalation({
                  unitPrice: line.unit_price,
                  discountPercent: line.discount_applied,
                  cost: pricedLines[i]?.costUsed,
                  minimumMargin: pricedLines[i]?.authority.minimumMargin,
                })
              )
            );
            if (counts.needsApproval === 0 && counts.unknown === 0) {
              return (
                <div className="mb-3 text-xs text-emerald-700">
                  All {counts.total} line{counts.total === 1 ? '' : 's'} are at or above the minimum
                  margin.
                </div>
              );
            }
            return (
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {counts.needsApproval > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-red-700">
                    <AlertTriangle size={13} />
                    {counts.needsApproval} of {counts.total} line
                    {counts.total === 1 ? '' : 's'} will need approval at these prices
                  </span>
                )}
                {counts.unknown > 0 && (
                  <span className="text-gray-500">
                    {counts.unknown} could not be assessed (no cost or no price yet)
                  </span>
                )}
              </div>
            );
          })()}

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
                  Guidance
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
                      {line.source_part_number && (
                        <div className="text-xs">
                          <span className="font-medium text-gray-800">
                            {line.source_part_number}
                          </span>
                          {line.product_id &&
                            !products.some((p) => p.id === line.product_id) && (
                              <span
                                className="ml-1 text-amber-700"
                                title="Matched in the item master but not on the active product list, so it cannot be chosen from the dropdown below."
                              >
                                · inactive catalogue part
                              </span>
                            )}
                          {!line.product_id && (
                            <span className="ml-1 text-gray-500">· not in the catalogue</span>
                          )}
                        </div>
                      )}
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
                  <td className="px-4 py-3 align-top">
                    <PriceBandCell
                      priced={pricedLines[index]}
                      unitPrice={line.unit_price}
                      discountPercent={line.discount_applied}
                      format={money}
                      onApplyTarget={(price) => {
                        updateLine(index, 'unit_price', toCents(price));
                        setSelectedLineIndex(index);
                      }}
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
    </div>
  );
}
