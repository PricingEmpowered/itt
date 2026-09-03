import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { AlertTriangle, Plus, X, Check, Clock, TrendingUp, DollarSign, Calendar, Info, CheckSquare, Square } from 'lucide-react';

interface PriceAlert {
  id: string;
  product_id: string;
  product_name: string;
  product_category: string;
  current_base_cost: number;
  current_list_price: number;
  expected_new_cost: number;
  expected_cost_change_percent: number;
  effective_date: string;
  reason: string;
  status: string;
  recommended_price_increase: number | null;
  recommended_price_increase_percent: number | null;
  notes: string | null;
  current_margin_percent: number;
  expected_margin_percent: number;
  days_until_effective: number;
  urgency: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  base_cost: number;
}

export function PriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [newCost, setNewCost] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [targetMargin, setTargetMargin] = useState('30');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateType, setBulkUpdateType] = useState<'maintain-margin-percent' | 'maintain-margin-dollar' | 'recommended'>('recommended');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadAlerts(), loadProducts()]);
    setLoading(false);
  };

  const loadAlerts = async () => {
    try {
      const { data, error } = await db
        .from('price_change_alerts')
        .select('*')
        .order('days_until_effective', { ascending: true });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await db
        .from('products')
        .select('id, name, category, base_cost')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const calculateRecommendedPrice = (currentListPrice: number, newCost: number, targetMarginPercent: number) => {
    const recommendedPrice = newCost / (1 - targetMarginPercent / 100);
    const increasePercent = ((recommendedPrice - currentListPrice) / currentListPrice) * 100;
    return { recommendedPrice, increasePercent };
  };

  const handleAddAlert = async () => {
    try {
      const product = products.find(p => p.id === selectedProduct);
      if (!product) return;

      const expectedNewCost = parseFloat(newCost);
      const costChangePercent = ((expectedNewCost - product.base_cost) / product.base_cost) * 100;

      const { data: priceListItem } = await db
        .from('price_list_items')
        .select('list_price')
        .eq('product_id', selectedProduct)
        .eq('price_list_id', 'master')
        .maybeSingle();

      const currentListPrice = priceListItem?.list_price || 0;
      const { recommendedPrice, increasePercent } = calculateRecommendedPrice(
        currentListPrice,
        expectedNewCost,
        parseFloat(targetMargin)
      );

      const { error } = await db
        .from('expected_cost_changes')
        .insert({
          product_id: selectedProduct,
          current_cost: product.base_cost,
          expected_new_cost: expectedNewCost,
          expected_cost_change_percent: costChangePercent,
          effective_date: effectiveDate,
          reason,
          notes,
          recommended_price_increase: recommendedPrice,
          recommended_price_increase_percent: increasePercent,
          status: 'pending'
        });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      await loadAlerts();
    } catch (error) {
      console.error('Error adding alert:', error);
      alert('Error creating price alert');
    }
  };

  const updateAlertStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'price_updated') {
        updates.price_updated_at = new Date().toISOString();
      }

      const { error } = await db
        .from('expected_cost_changes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await loadAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setNewCost('');
    setEffectiveDate('');
    setReason('');
    setNotes('');
    setTargetMargin('30');
  };

  const toggleAlertSelection = (alertId: string) => {
    const newSelection = new Set(selectedAlerts);
    if (newSelection.has(alertId)) {
      newSelection.delete(alertId);
    } else {
      newSelection.add(alertId);
    }
    setSelectedAlerts(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map(a => a.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedAlerts.size === 0) {
      alert('Please select at least one alert');
      return;
    }

    try {
      const selectedAlertData = alerts.filter(a => selectedAlerts.has(a.id));

      for (const alert of selectedAlertData) {
        let newPrice: number;

        if (bulkUpdateType === 'recommended') {
          newPrice = alert.recommended_price_increase || alert.current_list_price;
        } else if (bulkUpdateType === 'maintain-margin-percent') {
          const currentMarginDollars = alert.current_list_price - alert.current_base_cost;
          const currentMarginPercent = (currentMarginDollars / alert.current_list_price) * 100;
          newPrice = alert.expected_new_cost / (1 - currentMarginPercent / 100);
        } else {
          const currentMarginDollars = alert.current_list_price - alert.current_base_cost;
          newPrice = alert.expected_new_cost + currentMarginDollars;
        }

        await db
          .from('price_list_items')
          .update({ list_price: newPrice })
          .eq('product_id', alert.product_id)
          .eq('price_list_id', 'master');

        await db
          .from('products')
          .update({ base_cost: alert.expected_new_cost })
          .eq('id', alert.product_id);

        await db
          .from('expected_cost_changes')
          .update({
            status: 'price_updated',
            price_updated_at: new Date().toISOString()
          })
          .eq('id', alert.id);
      }

      setSelectedAlerts(new Set());
      setShowBulkUpdateModal(false);
      await loadAlerts();

      alert(`Successfully updated ${selectedAlertData.length} product prices`);
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Error updating prices');
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-50 border-red-500';
      case 'high': return 'bg-orange-50 border-orange-500';
      case 'medium': return 'bg-yellow-50 border-yellow-500';
      default: return 'bg-blue-50 border-blue-500';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[urgency as keyof typeof colors] || colors.low;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading price alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Price Alerts</h2>
          <p className="text-sm text-gray-500 mt-1">Monitor expected cost changes and recommended price adjustments</p>
        </div>
        <div className="flex gap-2">
          {selectedAlerts.size > 0 && (
            <button
              onClick={() => setShowBulkUpdateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check size={18} />
              Update {selectedAlerts.size} Selected
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Cost Change Alert
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {selectedAlerts.size === alerts.length ? (
              <CheckSquare size={18} className="text-blue-600" />
            ) : (
              <Square size={18} />
            )}
            {selectedAlerts.size === alerts.length ? 'Deselect All' : 'Select All'}
            {selectedAlerts.size > 0 && ` (${selectedAlerts.size} selected)`}
          </button>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertTriangle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Price Alerts</h3>
          <p className="text-gray-600 mb-4">Create alerts to track expected cost changes and get pricing recommendations</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Create First Alert
          </button>
        </div>
      )}

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className={`border-l-4 rounded-lg shadow ${getUrgencyColor(alert.urgency)}`}>
            <div className="bg-white p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 flex-1">
                  <button
                    onClick={() => toggleAlertSelection(alert.id)}
                    className="mt-1"
                  >
                    {selectedAlerts.has(alert.id) ? (
                      <CheckSquare size={20} className="text-blue-600" />
                    ) : (
                      <Square size={20} className="text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{alert.product_name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getUrgencyBadge(alert.urgency)}`}>
                      {alert.urgency}
                    </span>
                    <span className="text-sm text-gray-500">{alert.product_category}</span>
                  </div>
                    <p className="text-sm text-gray-700 mb-1">{alert.reason}</p>
                    {alert.notes && (
                      <p className="text-sm text-gray-600 italic">{alert.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {alert.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Acknowledge"
                      >
                        <Clock size={18} />
                      </button>
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'price_updated')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Mark Price Updated"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'cancelled')}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      onClick={() => updateAlertStatus(alert.id, 'price_updated')}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      Mark Price Updated
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={14} />
                    <span>Effective Date</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {new Date(alert.effective_date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    {alert.days_until_effective} days away
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <TrendingUp size={14} />
                    <span>Cost Change</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    ${alert.current_base_cost.toFixed(2)} → ${alert.expected_new_cost.toFixed(2)}
                  </div>
                  <div className="text-xs text-red-600 font-medium">
                    +{alert.expected_cost_change_percent.toFixed(1)}%
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Current Margin</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {alert.current_margin_percent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">
                    at ${alert.current_list_price.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Expected Margin</div>
                  <div className={`text-sm font-semibold ${alert.expected_margin_percent < 20 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {alert.expected_margin_percent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">
                    if no price change
                  </div>
                </div>
              </div>

              {alert.recommended_price_increase && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <DollarSign size={18} className="text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">Recommended Price Adjustment</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-blue-800">
                            New list price: <span className="font-semibold">${alert.recommended_price_increase.toFixed(2)}</span>
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Increase from ${alert.current_list_price.toFixed(2)} (+{alert.recommended_price_increase_percent?.toFixed(1)}%)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-blue-800">
                            Maintains target margin with new cost
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Calculated to preserve profitability
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Cost Change Alert</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.category} (Current cost: ${product.base_cost.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected New Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Cost Change</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="Supplier price increase">Supplier price increase</option>
                  <option value="Material cost increase">Material cost increase</option>
                  <option value="Labor cost increase">Labor cost increase</option>
                  <option value="Shipping cost increase">Shipping cost increase</option>
                  <option value="Currency fluctuation">Currency fluctuation</option>
                  <option value="Regulatory/compliance costs">Regulatory/compliance costs</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Margin % (for price recommendation)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  System will calculate recommended list price to achieve this margin with the new cost
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional context or action items..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    The system will calculate the recommended price increase based on your target margin and the expected new cost.
                    You can review and adjust before updating actual prices.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAlert}
                  disabled={!selectedProduct || !newCost || !effectiveDate || !reason}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Price Update</h3>
              <button onClick={() => setShowBulkUpdateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                You have selected {selectedAlerts.size} alert{selectedAlerts.size > 1 ? 's' : ''}. Choose how to update prices:
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="updateType"
                    value="recommended"
                    checked={bulkUpdateType === 'recommended'}
                    onChange={(e) => setBulkUpdateType(e.target.value as any)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Use Recommended Prices</div>
                    <p className="text-sm text-gray-600">
                      Apply system-recommended prices (maintains 30% target margin with new costs)
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="updateType"
                    value="maintain-margin-percent"
                    checked={bulkUpdateType === 'maintain-margin-percent'}
                    onChange={(e) => setBulkUpdateType(e.target.value as any)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Maintain Current Margin % </div>
                    <p className="text-sm text-gray-600">
                      Adjust prices to keep the same margin percentage with new costs
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="updateType"
                    value="maintain-margin-dollar"
                    checked={bulkUpdateType === 'maintain-margin-dollar'}
                    onChange={(e) => setBulkUpdateType(e.target.value as any)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Maintain Current Margin $</div>
                    <p className="text-sm text-gray-600">
                      Adjust prices to keep the same dollar profit with new costs
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info size={18} className="text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">This action will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Update list prices in the master price list</li>
                    <li>Update product base costs to new expected costs</li>
                    <li>Mark alerts as "Price Updated"</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Update {selectedAlerts.size} Product{selectedAlerts.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
