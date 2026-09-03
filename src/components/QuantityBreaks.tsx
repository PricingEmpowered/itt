import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { QuantityBreak, Product, PriceList, ProductFamily } from '../types';
import { Plus, Trash2, X, Layers, Copy } from 'lucide-react';

export function QuantityBreaks() {
  const [quantityBreaks, setQuantityBreaks] = useState<QuantityBreak[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterFamilyId, setFilterFamilyId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkFamilyFilter, setBulkFamilyFilter] = useState('');

  const [formData, setFormData] = useState({
    product_id: '',
    price_list_id: '',
    min_quantity: 1,
    max_quantity: null as number | null,
    pricing_type: 'discount' as 'discount' | 'fixed',
    discount_percent: 0,
    fixed_price: null as number | null,
  });

  const [bulkBreaks, setBulkBreaks] = useState<Array<{
    min_quantity: number;
    max_quantity: number | null;
    pricing_type: 'discount' | 'fixed';
    discount_percent: number;
    fixed_price: number | null;
  }>>([
    { min_quantity: 1, max_quantity: 10, pricing_type: 'discount', discount_percent: 0, fixed_price: null },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [breaksRes, productsRes, priceListsRes, familiesRes] = await Promise.all([
        db.from('quantity_breaks').select('*').order('product_id', { ascending: true }).order('min_quantity', { ascending: true }),
        db.from('products').select('*').eq('status', 'Active').order('name'),
        db.from('price_lists').select('*').order('name'),
        db.from('product_families').select('*').order('name'),
      ]);

      setQuantityBreaks(breaksRes.data || []);
      setProducts(productsRes.data || []);
      setProductFamilies(familiesRes.data || []);
      setPriceLists(priceListsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.product_id || formData.min_quantity < 1) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await db.from('quantity_breaks').insert([
        {
          product_id: formData.product_id,
          price_list_id: formData.price_list_id || null,
          min_quantity: formData.min_quantity,
          max_quantity: formData.max_quantity,
          discount_percent: formData.pricing_type === 'discount' ? formData.discount_percent : null,
          fixed_price: formData.pricing_type === 'fixed' ? formData.fixed_price : null,
        },
      ]);

      if (error) throw error;

      await loadData();
      setShowAddForm(false);
      resetForm();
      alert('Quantity break added successfully!');
    } catch (error: any) {
      console.error('Error adding quantity break:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quantity break?')) return;

    try {
      const { error } = await db.from('quantity_breaks').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting quantity break:', error);
      alert('Error deleting quantity break');
    }
  };

  const handleBulkApply = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select at least one product');
      return;
    }

    if (bulkBreaks.some(b => b.min_quantity < 1)) {
      alert('All minimum quantities must be at least 1');
      return;
    }

    try {
      const breaksToInsert = selectedProducts.flatMap(productId =>
        bulkBreaks.map(breakData => ({
          product_id: productId,
          price_list_id: formData.price_list_id || null,
          min_quantity: breakData.min_quantity,
          max_quantity: breakData.max_quantity,
          discount_percent: breakData.pricing_type === 'discount' ? breakData.discount_percent : null,
          fixed_price: breakData.pricing_type === 'fixed' ? breakData.fixed_price : null,
        }))
      );

      const { error } = await db.from('quantity_breaks').insert(breaksToInsert);
      if (error) throw error;

      await loadData();
      setShowBulkForm(false);
      setSelectedProducts([]);
      setBulkFamilyFilter('');
      setBulkBreaks([{ min_quantity: 1, max_quantity: 10, pricing_type: 'discount', discount_percent: 0, fixed_price: null }]);
      alert(`Successfully applied ${bulkBreaks.length} quantity breaks to ${selectedProducts.length} products!`);
    } catch (error: any) {
      console.error('Error applying bulk breaks:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const addBulkBreak = () => {
    setBulkBreaks([
      ...bulkBreaks,
      { min_quantity: 1, max_quantity: null, pricing_type: 'discount', discount_percent: 0, fixed_price: null },
    ]);
  };

  const updateBulkBreak = (index: number, field: string, value: any) => {
    const updated = [...bulkBreaks];
    updated[index] = { ...updated[index], [field]: value };
    setBulkBreaks(updated);
  };

  const removeBulkBreak = (index: number) => {
    setBulkBreaks(bulkBreaks.filter((_, i) => i !== index));
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const selectAllProducts = () => {
    const filtered = getFilteredProductsForBulk();
    setSelectedProducts(filtered.map(p => p.id));
  };

  const deselectAllProducts = () => {
    setSelectedProducts([]);
  };

  const getFilteredProductsForBulk = () => {
    if (!bulkFamilyFilter) return products;
    return products.filter(p => p.family_id === bulkFamilyFilter);
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      price_list_id: '',
      min_quantity: 1,
      max_quantity: null,
      pricing_type: 'discount',
      discount_percent: 0,
      fixed_price: null,
    });
  };

  const getProductName = (productId: string) => {
    return products.find((p) => p.id === productId)?.name || productId;
  };

  const getProductFamilyName = (familyId: string | undefined) => {
    if (!familyId) return null;
    return productFamilies.find((f) => f.id === familyId)?.name || null;
  };

  const getPriceListName = (priceListId: string | null | undefined) => {
    if (!priceListId) return 'All Price Lists';
    return priceLists.find((p) => p.id === priceListId)?.name || priceListId;
  };

  const filteredBreaks = quantityBreaks.filter((qb) => {
    if (filterProductId) {
      return qb.product_id === filterProductId;
    }
    if (filterFamilyId) {
      const product = products.find(p => p.id === qb.product_id);
      return product?.family_id === filterFamilyId;
    }
    return true;
  });

  const groupedBreaks = filteredBreaks.reduce((acc, qb) => {
    const key = `${qb.product_id}-${qb.price_list_id || 'default'}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(qb);
    return acc;
  }, {} as Record<string, QuantityBreak[]>);

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quantity Breaks</h2>
          <p className="text-gray-600 mt-1">Configure volume-based pricing tiers for products</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkForm(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Copy size={20} />
            Bulk Apply
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Single
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Product Family
            </label>
            <select
              value={filterFamilyId}
              onChange={(e) => {
                setFilterFamilyId(e.target.value);
                setFilterProductId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Families</option>
              {productFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Product
            </label>
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Products</option>
              {(filterFamilyId ? products.filter(p => p.family_id === filterFamilyId) : products).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Quantity Break</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price List (Optional)
                </label>
                <select
                  value={formData.price_list_id}
                  onChange={(e) => setFormData({ ...formData, price_list_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Price Lists</option>
                  {priceLists.map((priceList) => (
                    <option key={priceList.id} value={priceList.id}>
                      {priceList.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Quantity (blank for unlimited)
                  </label>
                  <input
                    type="number"
                    min={formData.min_quantity}
                    value={formData.max_quantity || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_quantity: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="Unlimited"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="discount"
                      checked={formData.pricing_type === 'discount'}
                      onChange={(e) =>
                        setFormData({ ...formData, pricing_type: e.target.value as 'discount' })
                      }
                      className="mr-2"
                    />
                    Discount %
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="fixed"
                      checked={formData.pricing_type === 'fixed'}
                      onChange={(e) =>
                        setFormData({ ...formData, pricing_type: e.target.value as 'fixed' })
                      }
                      className="mr-2"
                    />
                    Fixed Price
                  </label>
                </div>
              </div>

              {formData.pricing_type === 'discount' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Percent
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fixed Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fixed_price || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fixed_price: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Quantity Break
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Apply Quantity Breaks</h3>
              <button
                onClick={() => {
                  setShowBulkForm(false);
                  setSelectedProducts([]);
                  setBulkFamilyFilter('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Products ({selectedProducts.length} selected)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllProducts}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select All {bulkFamilyFilter && '(Filtered)'}
                      </button>
                      <button
                        onClick={deselectAllProducts}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Filter by Product Family
                    </label>
                    <select
                      value={bulkFamilyFilter}
                      onChange={(e) => setBulkFamilyFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Families</option>
                      {productFamilies.map((family) => (
                        <option key={family.id} value={family.id}>
                          {family.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                    {getFilteredProductsForBulk().map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">
                            {product.id}
                            {product.family_id && getProductFamilyName(product.family_id) && (
                              <span className="ml-2 text-blue-600">
                                • {getProductFamilyName(product.family_id)}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price List (Optional)
                  </label>
                  <select
                    value={formData.price_list_id}
                    onChange={(e) => setFormData({ ...formData, price_list_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Price Lists</option>
                    {priceLists.map((priceList) => (
                      <option key={priceList.id} value={priceList.id}>
                        {priceList.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Quantity Break Tiers
                  </label>
                  <button
                    onClick={addBulkBreak}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={16} />
                    Add Tier
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bulkBreaks.map((breakData, index) => (
                    <div key={index} className="border border-gray-300 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Tier {index + 1}</span>
                        {bulkBreaks.length > 1 && (
                          <button
                            onClick={() => removeBulkBreak(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Min Qty *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={breakData.min_quantity}
                            onChange={(e) =>
                              updateBulkBreak(index, 'min_quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Max Qty
                          </label>
                          <input
                            type="number"
                            min={breakData.min_quantity}
                            value={breakData.max_quantity || ''}
                            placeholder="Unlimited"
                            onChange={(e) =>
                              updateBulkBreak(
                                index,
                                'max_quantity',
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Pricing Type
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              checked={breakData.pricing_type === 'discount'}
                              onChange={() => updateBulkBreak(index, 'pricing_type', 'discount')}
                              className="mr-2"
                            />
                            Discount %
                          </label>
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              checked={breakData.pricing_type === 'fixed'}
                              onChange={() => updateBulkBreak(index, 'pricing_type', 'fixed')}
                              className="mr-2"
                            />
                            Fixed Price
                          </label>
                        </div>
                      </div>

                      {breakData.pricing_type === 'discount' ? (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Discount %
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={breakData.discount_percent}
                            onChange={(e) =>
                              updateBulkBreak(index, 'discount_percent', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Fixed Price
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={breakData.fixed_price || ''}
                            onChange={(e) =>
                              updateBulkBreak(
                                index,
                                'fixed_price',
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowBulkForm(false);
                  setSelectedProducts([]);
                  setBulkFamilyFilter('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApply}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Apply to {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.keys(groupedBreaks).length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Layers className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No quantity breaks configured yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Add quantity breaks to enable volume-based pricing
            </p>
          </div>
        ) : (
          Object.entries(groupedBreaks).map(([key, breaks]) => {
            const productId = breaks[0].product_id;
            const priceListId = breaks[0].price_list_id;

            return (
              <div key={key} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                  <h3 className="text-lg font-semibold">{getProductName(productId)}</h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {getPriceListName(priceListId)}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantity Range
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Pricing
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {breaks.map((qb) => (
                        <tr key={qb.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {qb.min_quantity} - {qb.max_quantity || '∞'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {qb.discount_percent !== null && qb.discount_percent !== undefined ? (
                              <span className="text-green-600 font-medium">
                                {qb.discount_percent}% discount
                              </span>
                            ) : qb.fixed_price ? (
                              <span className="text-blue-600 font-medium">
                                ${qb.fixed_price.toFixed(2)} per unit
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => handleDelete(qb.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
