import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, PriceList, CustomerPriceList } from '../types';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface PriceListModalProps {
  customer: Customer;
  onClose: () => void;
}

export function PriceListModal({ customer, onClose }: PriceListModalProps) {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [assignedPriceLists, setAssignedPriceLists] = useState<(CustomerPriceList & { price_list?: PriceList })[]>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [priceListsRes, assignedRes] = await Promise.all([
        supabase.from('price_lists').select('*').order('name'),
        supabase
          .from('customer_price_lists')
          .select('*, price_list:price_lists(*)')
          .eq('customer_id', customer.id)
          .order('priority')
      ]);

      if (priceListsRes.data) setPriceLists(priceListsRes.data);
      if (assignedRes.data) setAssignedPriceLists(assignedRes.data);
    } catch (error) {
      console.error('Error loading price lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPriceListId) {
      alert('Please select a price list');
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_price_lists')
        .insert([{
          customer_id: customer.id,
          price_list_id: selectedPriceListId,
          is_default: assignedPriceLists.length === 0,
          priority: assignedPriceLists.length + 1
        }]);

      if (error) {
        if (error.code === '23505') {
          alert('This price list is already assigned to this customer');
        } else {
          throw error;
        }
      } else {
        setSelectedPriceListId('');
        loadData();
      }
    } catch (error) {
      console.error('Error assigning price list:', error);
      alert('Error assigning price list');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await supabase
        .from('customer_price_lists')
        .update({ is_default: false })
        .eq('customer_id', customer.id);

      const { error } = await supabase
        .from('customer_price_lists')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error setting default:', error);
      alert('Error setting default price list');
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Remove this price list assignment?')) return;

    try {
      const { error } = await supabase
        .from('customer_price_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Error removing price list');
    }
  };

  const handleChangePriority = async (id: number, currentPriority: number, direction: 'up' | 'down') => {
    try {
      const newPriority = direction === 'up' ? currentPriority - 1 : currentPriority + 1;

      // Find the item to swap with
      const swapItem = assignedPriceLists.find(apl => apl.priority === newPriority);

      if (!swapItem) return;

      // Swap priorities
      await supabase
        .from('customer_price_lists')
        .update({ priority: currentPriority })
        .eq('id', swapItem.id);

      const { error } = await supabase
        .from('customer_price_lists')
        .update({ priority: newPriority })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error changing priority:', error);
      alert('Error changing priority');
    }
  };

  const availablePriceLists = priceLists.filter(
    pl => !assignedPriceLists.some(apl => apl.price_list_id === pl.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            Price Lists for {customer.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <>
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Assign New Price List</h4>
              <div className="flex gap-2">
                <select
                  value={selectedPriceListId}
                  onChange={(e) => setSelectedPriceListId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a price list</option>
                  {availablePriceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.currency})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!selectedPriceListId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Price Lists</h4>
              {assignedPriceLists.length === 0 ? (
                <p className="text-gray-500 text-sm">No price lists assigned</p>
              ) : (
                <div className="space-y-2">
                  {assignedPriceLists.map((apl, index) => (
                    <div
                      key={apl.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleChangePriority(apl.id, apl.priority, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => handleChangePriority(apl.id, apl.priority, 'down')}
                            disabled={index === assignedPriceLists.length - 1}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                        <div>
                          <div className="font-medium">{apl.price_list?.name}</div>
                          <div className="text-sm text-gray-500">
                            {apl.price_list?.currency} • Priority: {apl.priority}
                            {apl.is_default && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!apl.is_default && (
                          <button
                            onClick={() => handleSetDefault(apl.id)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(apl.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface AttributesModalProps {
  customer: Customer;
  onClose: () => void;
  onSave: () => void;
}

export function AttributesModal({ customer, onClose, onSave }: AttributesModalProps) {
  const [attributes, setAttributes] = useState<Record<string, any>>(customer.attributes || {});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddAttribute = () => {
    if (!newKey.trim()) {
      alert('Please enter an attribute name');
      return;
    }
    setAttributes({ ...attributes, [newKey]: newValue });
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveAttribute = (key: string) => {
    const updated = { ...attributes };
    delete updated[key];
    setAttributes(updated);
  };

  const handleUpdateAttribute = (key: string, value: any) => {
    setAttributes({ ...attributes, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ attributes })
        .eq('id', customer.id);

      if (error) throw error;
      onSave();
    } catch (error) {
      console.error('Error saving attributes:', error);
      alert('Error saving attributes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            Attributes for {customer.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Attribute</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Attribute name"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddAttribute}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current Attributes</h4>
            {Object.keys(attributes).length === 0 ? (
              <p className="text-gray-500 text-sm">No attributes defined</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(attributes).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="font-medium text-gray-700 w-1/3">{key}:</div>
                    <input
                      type="text"
                      value={typeof value === 'object' ? JSON.stringify(value) : value}
                      onChange={(e) => handleUpdateAttribute(key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveAttribute(key)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
