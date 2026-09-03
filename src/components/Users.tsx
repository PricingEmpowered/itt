import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { Users as UsersIcon, Shield, Mail, Edit2 } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  approval_level: number;
  max_discount_approval: number;
  min_margin_percent: number;
  max_quote_size: number;
  department: string;
  active: boolean;
  created_at: string;
}

export function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await db
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setShowEditModal(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading users...</div>;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800';
      case 'VP Sales':
        return 'bg-purple-100 text-purple-800';
      case 'Director':
        return 'bg-blue-100 text-blue-800';
      case 'Sales Manager':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{users.length}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <UsersIcon className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.filter((u) => u.active).length}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <Shield className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sales Reps</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.filter((u) => u.role === 'Sales Rep').length}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <UsersIcon className="text-gray-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Managers+</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.filter((u) => u.approval_level > 0).length}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Shield className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold">User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Authority Limits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Mail className="text-gray-400 mr-2" size={16} />
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.department}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500">Discount:</span>
                        <span className="font-medium text-gray-900">{user.max_discount_approval}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500">Min Margin:</span>
                        <span className="font-medium text-gray-900">{user.min_margin_percent}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500">Max Quote:</span>
                        <span className="font-medium text-gray-900">${(user.max_quote_size / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={closeEditModal}
          onSave={() => {
            closeEditModal();
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

interface EditUserModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const [formData, setFormData] = useState<Partial<UserProfile>>(user);
  const [saving, setSaving] = useState(false);

  const roleOptions = [
    { role: 'Sales Rep', level: 0, discount: 0, minMargin: 20, maxQuote: 50000 },
    { role: 'Sales Manager', level: 1, discount: 15, minMargin: 15, maxQuote: 250000 },
    { role: 'Director', level: 2, discount: 25, minMargin: 10, maxQuote: 1000000 },
    { role: 'VP Sales', level: 3, discount: 35, minMargin: 5, maxQuote: 5000000 },
    { role: 'Admin', level: 4, discount: 100, minMargin: 0, maxQuote: 999999999.99 }
  ];

  const handleRoleChange = (role: string) => {
    const roleConfig = roleOptions.find(r => r.role === role);
    if (roleConfig) {
      setFormData({
        ...formData,
        role: roleConfig.role,
        approval_level: roleConfig.level,
        max_discount_approval: roleConfig.discount,
        min_margin_percent: roleConfig.minMargin,
        max_quote_size: roleConfig.maxQuote
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await db
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          approval_level: formData.approval_level,
          max_discount_approval: formData.max_discount_approval,
          min_margin_percent: formData.min_margin_percent,
          max_quote_size: formData.max_quote_size,
          department: formData.department,
          active: formData.active
        })
        .eq('id', user.id);

      if (error) throw error;
      onSave();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold mb-4">Edit User: {user.full_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              disabled
              value={formData.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {roleOptions.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              required
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Authority Limits</h4>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Approval Level (0-4)</label>
              <input
                type="number"
                min="0"
                max="4"
                step="1"
                required
                value={formData.approval_level}
                onChange={(e) => setFormData({ ...formData, approval_level: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={formData.max_discount_approval}
                onChange={(e) => setFormData({ ...formData, max_discount_approval: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Margin (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={formData.min_margin_percent}
                onChange={(e) => setFormData({ ...formData, min_margin_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Quote Size ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.max_quote_size}
                onChange={(e) => setFormData({ ...formData, max_quote_size: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Active User
            </label>
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
