import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Calendar, Shield, Plus, Edit2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface SLATier {
  id: string;
  name: string;
  description: string;
  coverage_days: number;
  hours_per_day: number;
  response_time_hours: number;
  response_time_label: string;
  list_price_annual: number;
  list_price_monthly: number;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  sla_tier_id: string;
  base_price_annual: number;
  base_price_monthly: number;
  unit: string;
  is_active: boolean;
  features: string[];
  sla_tier?: SLATier;
}

export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [slaTiers, setSlaTiers] = useState<SLATier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [filterCoverage, setFilterCoverage] = useState<number | 'all'>('all');
  const [filterHours, setFilterHours] = useState<number | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Support Services',
    sla_tier_id: '',
    features: ['']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadServices(), loadSLATiers()]);
    setLoading(false);
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          sla_tier:service_sla_tiers(*)
        `)
        .order('name');

      if (error) throw error;
      setServices(data?.map(s => ({
        ...s,
        features: s.features || []
      })) || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadSLATiers = async () => {
    try {
      const { data, error } = await supabase
        .from('service_sla_tiers')
        .select('*')
        .eq('is_active', true)
        .order('coverage_days', { ascending: true })
        .order('hours_per_day', { ascending: true })
        .order('response_time_hours', { ascending: true });

      if (error) throw error;
      setSlaTiers(data || []);
    } catch (error) {
      console.error('Error loading SLA tiers:', error);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedTier = slaTiers.find(t => t.id === formData.sla_tier_id);
    if (!selectedTier) return;

    const serviceData = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      sla_tier_id: formData.sla_tier_id,
      base_price_annual: selectedTier.list_price_annual,
      base_price_monthly: selectedTier.list_price_monthly,
      unit: 'per contract',
      features: formData.features.filter(f => f.trim() !== ''),
      is_active: true
    };

    try {
      if (editingService) {
        await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);
      } else {
        const id = `SVC-${Date.now()}`;
        await supabase
          .from('services')
          .insert({ ...serviceData, id });
      }

      await loadServices();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      await supabase
        .from('services')
        .delete()
        .eq('id', id);

      await loadServices();
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      sla_tier_id: service.sla_tier_id,
      features: service.features.length > 0 ? service.features : ['']
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      category: 'Support Services',
      sla_tier_id: '',
      features: ['']
    });
  };

  const addFeatureField = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeatureField = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const filteredServices = services.filter(service => {
    if (filterCoverage !== 'all' && service.sla_tier?.coverage_days !== filterCoverage) return false;
    if (filterHours !== 'all' && service.sla_tier?.hours_per_day !== filterHours) return false;
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCoverageColor = (days: number) => {
    return days === 7 ? 'text-blue-600' : 'text-gray-600';
  };

  const getHoursColor = (hours: number) => {
    if (hours === 24) return 'text-purple-600';
    if (hours === 12) return 'text-indigo-600';
    return 'text-gray-600';
  };

  const getResponseColor = (hours: number) => {
    if (hours <= 6) return 'text-green-600';
    if (hours <= 24) return 'text-yellow-600';
    return 'text-orange-600';
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading services...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Catalog</h2>
          <p className="text-sm text-gray-500 mt-1">Manage SLA-based support services</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Service
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-center">
        <span className="text-sm font-medium text-gray-700">Filters:</span>
        <select
          value={filterCoverage}
          onChange={(e) => setFilterCoverage(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Coverage Days</option>
          <option value="5">5 Days/Week</option>
          <option value="7">7 Days/Week</option>
        </select>
        <select
          value={filterHours}
          onChange={(e) => setFilterHours(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Hours/Day</option>
          <option value="8">8 Hours/Day</option>
          <option value="12">12 Hours/Day</option>
          <option value="24">24 Hours/Day</option>
        </select>
        {(filterCoverage !== 'all' || filterHours !== 'all') && (
          <button
            onClick={() => {
              setFilterCoverage('all');
              setFilterHours('all');
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <div key={service.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditService(service)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {service.sla_tier && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className={getCoverageColor(service.sla_tier.coverage_days)} />
                    <span className={`font-medium ${getCoverageColor(service.sla_tier.coverage_days)}`}>
                      {service.sla_tier.coverage_days} Days/Week Coverage
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className={getHoursColor(service.sla_tier.hours_per_day)} />
                    <span className={`font-medium ${getHoursColor(service.sla_tier.hours_per_day)}`}>
                      {service.sla_tier.hours_per_day} Hours/Day On-Call
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield size={16} className={getResponseColor(service.sla_tier.response_time_hours)} />
                    <span className={`font-medium ${getResponseColor(service.sla_tier.response_time_hours)}`}>
                      {service.sla_tier.response_time_label} Response
                    </span>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Included Features:</h4>
                <ul className="space-y-1">
                  {service.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {service.features.length > 4 && (
                    <li className="text-sm text-blue-600 font-medium">
                      +{service.features.length - 4} more features
                    </li>
                  )}
                </ul>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Annual:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(service.base_price_annual)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Monthly:</span>
                  <span className="text-base font-semibold text-gray-700">{formatCurrency(service.base_price_monthly)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No services found matching the selected filters.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h3>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SLA Tier
                </label>
                <select
                  value={formData.sla_tier_id}
                  onChange={(e) => setFormData({ ...formData, sla_tier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select SLA Tier</option>
                  {slaTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - {tier.coverage_days}d/{tier.hours_per_day}h - {tier.response_time_label} - {formatCurrency(tier.list_price_annual)}/yr
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        placeholder="Enter feature"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeatureField(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFeatureField}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Feature
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
