import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PriceList, PriceListItem, Product, Currency } from '../types';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Percent, Target, TrendingDown as TrendingDownIcon, TrendingUp as TrendingUpIcon, Calendar } from 'lucide-react';

export function PriceLists() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});
  const [historicalRates, setHistoricalRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [selectedPriceList, setSelectedPriceList] = useState<string | null>(null);
  const [priceListItems, setPriceListItems] = useState<(PriceListItem & { product?: Product })[]>([]);

  useEffect(() => {
    loadPriceLists();
    loadCurrencies();
    loadCurrentExchangeRates();
    loadHistoricalExchangeRates();
  }, []);

  useEffect(() => {
    if (selectedPriceList) {
      loadPriceListItems(selectedPriceList);
    }
  }, [selectedPriceList]);

  const loadPriceLists = async () => {
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPriceLists(data || []);
      if (data && data.length > 0 && !selectedPriceList) {
        setSelectedPriceList(data[0].id);
      }
    } catch (error) {
      console.error('Error loading price lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCurrencies(data || []);
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  const loadCurrentExchangeRates = async () => {
    try {
      setLoadingRates(true);
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/currency-rates?base=USD&symbols=EUR,GBP,CAD,AUD,JPY,CNY`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCurrentRates(data.rates);

          // Save to database for historical tracking
          const ratesToSave = Object.entries(data.rates).map(([currency, rate]) => ({
            from_currency: 'USD',
            to_currency: currency,
            rate: rate as number,
            date: new Date().toISOString().split('T')[0],
          }));

          await supabase.from('exchange_rates').upsert(ratesToSave, {
            onConflict: 'from_currency,to_currency,date',
          });
        }
      }
    } catch (error) {
      console.error('Error loading current exchange rates:', error);
    } finally {
      setLoadingRates(false);
    }
  };

  const loadHistoricalExchangeRates = async () => {
    try {
      // Get last 12 months of rates
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', 'USD')
        .order('date', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by month and currency
      const groupedByMonth: Record<string, any> = {};

      if (data) {
        data.forEach((rate: any) => {
          const month = rate.date.substring(0, 7); // YYYY-MM
          if (!groupedByMonth[month]) {
            groupedByMonth[month] = { month, rates: {} };
          }
          if (!groupedByMonth[month].rates[rate.to_currency]) {
            groupedByMonth[month].rates[rate.to_currency] = rate.rate;
          }
        });
      }

      const monthlyRates = Object.values(groupedByMonth)
        .sort((a: any, b: any) => b.month.localeCompare(a.month))
        .slice(0, 12);

      setHistoricalRates(monthlyRates);
    } catch (error) {
      console.error('Error loading historical exchange rates:', error);
    }
  };

  const loadPriceListItems = async (priceListId: string) => {
    try {
      const { data, error } = await supabase
        .from('price_list_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('price_list_id', priceListId)
        .order('product_id');

      if (error) throw error;
      setPriceListItems(data || []);
    } catch (error) {
      console.error('Error loading price list items:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price list?')) return;

    try {
      const { error } = await supabase.from('price_lists').delete().eq('id', id);

      if (error) throw error;
      loadPriceLists();
      if (selectedPriceList === id) {
        setSelectedPriceList(null);
      }
    } catch (error) {
      console.error('Error deleting price list:', error);
      alert('Cannot delete price list: may have associated quotes');
    }
  };

  const openModal = (priceList?: PriceList) => {
    setEditingPriceList(priceList || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPriceList(null);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading price lists...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Price Lists</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRatesModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <DollarSign size={20} />
            Exchange Rates
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Price List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Price Lists</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {priceLists.map((priceList) => (
              <div
                key={priceList.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedPriceList === priceList.id
                    ? 'bg-blue-50 border-l-4 border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedPriceList(priceList.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{priceList.name}</p>
                    <p className="text-sm text-gray-500">
                      {priceList.currency} • v{priceList.version}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(priceList.effective_from).toLocaleDateString()} -{' '}
                      {new Date(priceList.effective_to).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(priceList);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(priceList.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {selectedPriceList
                ? `Items in ${priceLists.find((pl) => pl.id === selectedPriceList)?.name}`
                : 'Select a price list'}
            </h3>
            {selectedPriceList && priceListItems.length > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <DollarSign size={16} />
                Bulk Actions
              </button>
            )}
          </div>
          {selectedPriceList ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      List Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {priceListItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.product_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.product?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.product?.category || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        ${item.list_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {priceListItems.length === 0 && (
                <div className="p-8 text-center text-gray-500">No items in this price list</div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a price list to view its items
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <PriceListModal
          priceList={editingPriceList}
          currencies={currencies}
          onClose={closeModal}
          onSave={() => {
            closeModal();
            loadPriceLists();
          }}
        />
      )}

      {showBulkModal && selectedPriceList && (
        <BulkPriceActionsModal
          priceListId={selectedPriceList}
          onClose={() => setShowBulkModal(false)}
          onComplete={() => {
            setShowBulkModal(false);
            loadPriceListItems(selectedPriceList);
          }}
        />
      )}

      {showRatesModal && (
        <ExchangeRatesModal
          currentRates={currentRates}
          historicalRates={historicalRates}
          loadingRates={loadingRates}
          currencies={currencies}
          onClose={() => setShowRatesModal(false)}
          onRefresh={() => {
            loadCurrentExchangeRates();
            loadHistoricalExchangeRates();
          }}
        />
      )}
    </div>
  );
}

interface BulkPriceActionsModalProps {
  priceListId: string;
  onClose: () => void;
  onComplete: () => void;
}

function BulkPriceActionsModal({ priceListId, onClose, onComplete }: BulkPriceActionsModalProps) {
  const [actionType, setActionType] = useState<'increase' | 'decrease' | 'margin' | 'markup'>('increase');
  const [value, setValue] = useState<number>(0);
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [impact, setImpact] = useState<{
    itemsAffected: number;
    avgChange: number;
    totalCurrentValue: number;
    totalNewValue: number;
  } | null>(null);
  const [calculatingImpact, setCalculatingImpact] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (value > 0) {
      calculateImpact();
    } else {
      setImpact(null);
    }
  }, [actionType, value, category]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .order('category');

      if (error) throw error;
      const uniqueCategories = Array.from(new Set(data?.map(p => p.category) || []));
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const calculateImpact = async () => {
    setCalculatingImpact(true);

    try {
      let query = supabase
        .from('price_list_items')
        .select('id, list_price, product_id, products!inner(category, base_cost)')
        .eq('price_list_id', priceListId);

      if (category) {
        query = query.eq('products.category', category);
      }

      const { data: items, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!items || items.length === 0) {
        setImpact(null);
        setCalculatingImpact(false);
        return;
      }

      let totalCurrentValue = 0;
      let totalNewValue = 0;
      let totalChange = 0;

      items.forEach((item: any) => {
        let newPrice = item.list_price;

        switch (actionType) {
          case 'increase':
            newPrice = item.list_price * (1 + value / 100);
            break;
          case 'decrease':
            newPrice = item.list_price * (1 - value / 100);
            break;
          case 'margin':
            const minPriceForMargin = item.products.base_cost / (1 - value / 100);
            newPrice = Math.max(item.list_price, minPriceForMargin);
            break;
          case 'markup':
            const minPriceForMarkup = item.products.base_cost * (1 + value / 100);
            newPrice = Math.max(item.list_price, minPriceForMarkup);
            break;
        }

        newPrice = Math.round(newPrice * 100) / 100;

        totalCurrentValue += item.list_price;
        totalNewValue += newPrice;
        totalChange += (newPrice - item.list_price);
      });

      setImpact({
        itemsAffected: items.length,
        avgChange: totalChange / items.length,
        totalCurrentValue,
        totalNewValue
      });
    } catch (error) {
      console.error('Error calculating impact:', error);
    } finally {
      setCalculatingImpact(false);
    }
  };

  const handleApply = async () => {
    if (value <= 0) {
      alert('Please enter a valid value greater than 0');
      return;
    }

    setProcessing(true);

    try {
      let query = supabase
        .from('price_list_items')
        .select('id, list_price, product_id, products!inner(category, base_cost)')
        .eq('price_list_id', priceListId);

      if (category) {
        query = query.eq('products.category', category);
      }

      const { data: items, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!items || items.length === 0) {
        alert('No items found matching the criteria');
        setProcessing(false);
        return;
      }

      const updates = items.map((item: any) => {
        let newPrice = item.list_price;

        switch (actionType) {
          case 'increase':
            newPrice = item.list_price * (1 + value / 100);
            break;
          case 'decrease':
            newPrice = item.list_price * (1 - value / 100);
            break;
          case 'margin':
            const minPriceForMargin = item.products.base_cost / (1 - value / 100);
            newPrice = Math.max(item.list_price, minPriceForMargin);
            break;
          case 'markup':
            const minPriceForMarkup = item.products.base_cost * (1 + value / 100);
            newPrice = Math.max(item.list_price, minPriceForMarkup);
            break;
        }

        return {
          id: item.id,
          list_price: Math.round(newPrice * 100) / 100
        };
      });

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('price_list_items')
          .update({ list_price: update.list_price })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      alert(`Successfully updated ${updates.length} item(s)`);
      onComplete();
    } catch (error) {
      console.error('Error applying bulk action:', error);
      alert('Error applying bulk action');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold mb-4">Bulk Price Actions</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActionType('increase')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  actionType === 'increase'
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <TrendingUp className="mx-auto mb-1" size={20} />
                <div className="text-sm font-medium">Increase Prices</div>
              </button>
              <button
                onClick={() => setActionType('decrease')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  actionType === 'decrease'
                    ? 'border-red-600 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <TrendingDown className="mx-auto mb-1" size={20} />
                <div className="text-sm font-medium">Decrease Prices</div>
              </button>
              <button
                onClick={() => setActionType('margin')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  actionType === 'margin'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Percent className="mx-auto mb-1" size={20} />
                <div className="text-sm font-medium">Min Margin</div>
              </button>
              <button
                onClick={() => setActionType('markup')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  actionType === 'markup'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Target className="mx-auto mb-1" size={20} />
                <div className="text-sm font-medium">Min Markup</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {actionType === 'increase' || actionType === 'decrease' ? 'Percentage' :
               actionType === 'margin' ? 'Minimum Margin %' : 'Minimum Markup %'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter percentage"
              />
              <Percent className="absolute right-3 top-2.5 text-gray-400" size={18} />
            </div>
            {actionType === 'margin' && (
              <p className="text-xs text-gray-500 mt-1">
                Ensures prices maintain at least this margin percentage
              </p>
            )}
            {actionType === 'markup' && (
              <p className="text-xs text-gray-500 mt-1">
                Ensures prices have at least this markup over cost
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Category (Optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Action Summary:</strong>
              {actionType === 'increase' && ` Increase all prices by ${value}%`}
              {actionType === 'decrease' && ` Decrease all prices by ${value}%`}
              {actionType === 'margin' && ` Ensure minimum ${value}% profit margin`}
              {actionType === 'markup' && ` Ensure minimum ${value}% markup over cost`}
              {category && ` for ${category} products`}
            </p>

            {calculatingImpact && (
              <div className="text-sm text-gray-600 italic">Calculating impact...</div>
            )}

            {!calculatingImpact && impact && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Estimated Impact:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-2 rounded">
                    <div className="text-gray-600">Items Affected</div>
                    <div className="text-lg font-semibold text-gray-900">{impact.itemsAffected}</div>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <div className="text-gray-600">Avg Change</div>
                    <div className={`text-lg font-semibold ${impact.avgChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impact.avgChange >= 0 ? '+' : ''}${impact.avgChange.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <div className="text-gray-600">Current Total</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${impact.totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <div className="text-gray-600">New Total</div>
                    <div className={`text-lg font-semibold ${impact.totalNewValue >= impact.totalCurrentValue ? 'text-green-600' : 'text-red-600'}`}>
                      ${impact.totalNewValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-gray-600 text-sm">Total Change</div>
                  <div className={`text-xl font-bold ${(impact.totalNewValue - impact.totalCurrentValue) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(impact.totalNewValue - impact.totalCurrentValue) >= 0 ? '+' : ''}
                    ${(impact.totalNewValue - impact.totalCurrentValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-sm ml-2">
                      ({((impact.totalNewValue - impact.totalCurrentValue) / impact.totalCurrentValue * 100).toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={processing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PriceListModalProps {
  priceList: PriceList | null;
  currencies: Currency[];
  onClose: () => void;
  onSave: () => void;
}

function PriceListModal({ priceList, currencies, onClose, onSave }: PriceListModalProps) {
  const [formData, setFormData] = useState<Partial<PriceList>>(
    priceList || {
      id: '',
      name: '',
      currency: 'USD',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        .toISOString()
        .split('T')[0],
      version: 1,
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (priceList) {
        const { error } = await supabase
          .from('price_lists')
          .update(formData)
          .eq('id', priceList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('price_lists').insert([formData]);
        if (error) throw error;
      }
      onSave();
    } catch (error) {
      console.error('Error saving price list:', error);
      alert('Error saving price list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {priceList ? 'Edit Price List' : 'Add Price List'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price List ID
            </label>
            <input
              type="text"
              required
              disabled={!!priceList}
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} - {currency.name} ({currency.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective From
            </label>
            <input
              type="date"
              required
              value={formData.effective_from}
              onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective To
            </label>
            <input
              type="date"
              required
              value={formData.effective_to}
              onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Version
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ExchangeRatesModalProps {
  currentRates: Record<string, number>;
  historicalRates: any[];
  loadingRates: boolean;
  currencies: Currency[];
  onClose: () => void;
  onRefresh: () => void;
}

function ExchangeRatesModal({
  currentRates,
  historicalRates,
  loadingRates,
  currencies,
  onClose,
  onRefresh
}: ExchangeRatesModalProps) {
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const calculateChange = (current: number, previous: number) => {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  };

  const currencyOrder = ['EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Exchange Rates (USD Base)</h3>
            <p className="text-sm text-gray-500 mt-1">Live rates from European Central Bank via Frankfurter API</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={loadingRates}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loadingRates ? 'Refreshing...' : 'Refresh Rates'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Current Rates */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-green-600" />
                Current Exchange Rates
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {currencyOrder.map((code) => {
                  const rate = currentRates[code];
                  const currency = currencies.find(c => c.code === code);
                  const prevMonth = historicalRates[0]?.rates[code];
                  const change = prevMonth ? calculateChange(rate, prevMonth) : null;

                  if (!rate) return null;

                  return (
                    <div key={code} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">{currency?.name || code}</div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {currency?.symbol || code} {rate.toFixed(4)}
                      </div>
                      {change !== null && (
                        <div className={`text-xs flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change >= 0 ? <TrendingUpIcon size={14} /> : <TrendingDownIcon size={14} />}
                          {Math.abs(change).toFixed(2)}% vs last month
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historical Rates */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-blue-600" />
                Historical Rates by Month
              </h4>

              {historicalRates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No historical data available yet. Rates are automatically saved daily.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Month</th>
                        {currencyOrder.map(code => {
                          const currency = currencies.find(c => c.code === code);
                          return (
                            <th key={code} className="text-right py-3 px-4 font-semibold text-gray-700">
                              {currency?.symbol || ''} {code}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {historicalRates.map((monthData, idx) => (
                        <tr key={monthData.month} className={idx === 0 ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50'}>
                          <td className="py-3 px-4 text-gray-900">
                            {formatMonth(monthData.month)}
                            {idx === 0 && <span className="ml-2 text-xs text-blue-600">(Latest)</span>}
                          </td>
                          {currencyOrder.map(code => {
                            const rate = monthData.rates[code];
                            const prevRate = historicalRates[idx + 1]?.rates[code];
                            const change = prevRate ? calculateChange(rate, prevRate) : null;

                            return (
                              <td key={code} className="py-3 px-4 text-right">
                                {rate ? (
                                  <div>
                                    <div className="text-gray-900">{rate.toFixed(4)}</div>
                                    {change !== null && (
                                      <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
