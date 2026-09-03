import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { Quote, QuoteLine, Customer, Product, Region, Industry } from '../types';
import { Eye, Trash2, Search, Filter, Printer, Clock } from 'lucide-react';
import { generateQuotePDF } from '../utils/pdfGenerator';
import { DealScoreIndicator, DealScoreCard } from './DealScoreIndicator';

interface QuoteWithDetails extends Quote {
  customer?: Customer & { regionData?: Region; industryData?: Industry };
  lines?: (QuoteLine & { product?: Product })[];
}

export function Quotes() {
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<QuoteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterDealScore, setFilterDealScore] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadQuotes();
    loadHierarchies();
  }, []);

  useEffect(() => {
    filterQuotesList();
  }, [quotes, searchTerm, filterStatus, filterSegment, filterRegion, filterIndustry, filterDealScore]);

  const loadQuotes = async () => {
    try {
      const { data, error } = await db
        .from('quotes')
        .select(`
          *,
          customer:customers(
            *,
            regionData:regions(id, name),
            industryData:industries(id, name)
          ),
          quote_lines(
            *,
            product:products(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quotesWithLines = data?.map((quote: any) => ({
        ...quote,
        lines: quote.quote_lines || []
      })) || [];

      console.log('Loaded quotes with lines:', quotesWithLines[0]?.lines);
      setQuotes(quotesWithLines);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQuotesList = () => {
    let filtered = [...quotes];

    if (searchTerm) {
      filtered = filtered.filter(
        (q) =>
          q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.customer?.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus) {
      filtered = filtered.filter((q) => q.status === filterStatus);
    }

    if (filterSegment) {
      filtered = filtered.filter((q) => q.customer?.segment === filterSegment);
    }

    if (filterRegion) {
      filtered = filtered.filter((q) => q.customer?.region_id === filterRegion);
    }

    if (filterIndustry) {
      filtered = filtered.filter((q) => q.customer?.industry_id === filterIndustry);
    }

    if (filterDealScore) {
      filtered = filtered.filter((q) => {
        if (!q.deal_score) return filterDealScore === 'none';
        if (filterDealScore === 'excellent') return q.deal_score >= 110;
        if (filterDealScore === 'good') return q.deal_score >= 90 && q.deal_score < 110;
        if (filterDealScore === 'poor') return q.deal_score < 90;
        return true;
      });
    }

    setFilteredQuotes(filtered);
  };

  const loadHierarchies = async () => {
    try {
      const [regionsRes, industriesRes] = await Promise.all([
        db.from('regions').select('*').order('name'),
        db.from('industries').select('*').order('name')
      ]);
      if (regionsRes.data) setRegions(regionsRes.data);
      if (industriesRes.data) setIndustries(industriesRes.data);
    } catch (error) {
      console.error('Error loading hierarchies:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quote?')) return;

    try {
      const { error } = await db.from('quotes').delete().eq('id', id);

      if (error) throw error;
      loadQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('Error deleting quote');
    }
  };

  const openDetailModal = (quote: QuoteWithDetails) => {
    setSelectedQuote(quote);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedQuote(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Under Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading quotes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">All Quotes</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{filteredQuotes.length}</span> quotes
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Draft</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {quotes.filter((q) => q.status === 'Draft').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Under Review</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {quotes.filter((q) => q.status === 'Under Review').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {quotes.filter((q) => q.status === 'Approved').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {quotes.filter((q) => q.status === 'Rejected').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={20} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by quote ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select
            value={filterSegment}
            onChange={(e) => setFilterSegment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Segments</option>
            <option value="Tier 1 Industrial">Tier 1 Industrial</option>
            <option value="Tier 2 Industrial">Tier 2 Industrial</option>
            <option value="Tier 3 Industrial">Tier 3 Industrial</option>
            <option value="OEM">OEM</option>
            <option value="Distributor">Distributor</option>
            <option value="End User">End User</option>
          </select>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Industries</option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
          <select
            value={filterDealScore}
            onChange={(e) => setFilterDealScore(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Deal Scores</option>
            <option value="excellent">Excellent (110+)</option>
            <option value="good">Good (90-110)</option>
            <option value="poor">Poor (&lt;90)</option>
            <option value="none">Not Scored</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quote ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deal Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  Approval Time
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredQuotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                  {quote.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{quote.customer?.name || 'N/A'}</div>
                  <div className="text-xs text-gray-500">{quote.customer?.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      quote.status
                    )}`}
                  >
                    {quote.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quote.lines?.length || 0} items
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DealScoreIndicator score={quote.deal_score} size="small" />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {quote.turnaround_time_hours ? (
                    <div>
                      <div className="font-medium">{(quote.turnaround_time_hours / 24).toFixed(1)}d</div>
                      <div className="text-xs text-gray-500">{quote.turnaround_time_hours.toFixed(0)}h</div>
                    </div>
                  ) : quote.approval_requested_at ? (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <Clock size={12} />
                      <span className="text-xs">Pending</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openDetailModal(quote)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(quote.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredQuotes.length === 0 && (
          <div className="p-8 text-center text-gray-500">No quotes found</div>
        )}
      </div>

      {showDetailModal && selectedQuote && (
        <QuoteDetailModal quote={selectedQuote} onClose={closeDetailModal} />
      )}
    </div>
  );
}

interface QuoteDetailModalProps {
  quote: QuoteWithDetails;
  onClose: () => void;
}

function QuoteDetailModal({ quote, onClose }: QuoteDetailModalProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Under Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePrintPDF = () => {
    generateQuotePDF(quote as any);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{quote.id}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Created {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer size={18} />
                Print PDF
              </button>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(
                  quote.status
                )}`}
              >
                {quote.status}
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Customer Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div>
                  <div className="text-xs text-gray-500">Company</div>
                  <div className="text-sm font-medium text-gray-900">
                    {quote.customer?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Customer ID</div>
                  <div className="text-sm text-gray-900">{quote.customer?.id || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Segment</div>
                  <div className="text-sm text-gray-900">{quote.customer?.segment || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Region</div>
                  <div className="text-sm text-gray-900">{quote.customer?.region || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Quote Summary</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${quote.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tax:</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${quote.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-base font-semibold text-gray-900">Total:</span>
                  <span className="text-base font-bold text-gray-900">
                    ${quote.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500">Price List</div>
                  <div className="text-sm text-gray-900">{quote.price_list_id}</div>
                </div>
                {(quote.approval_requested_at || quote.turnaround_time_hours) && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <Clock size={12} />
                      Approval Timeline
                    </div>
                    <div className="space-y-1">
                      {quote.approval_requested_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Requested:</span>
                          <span className="text-gray-900">{new Date(quote.approval_requested_at).toLocaleString()}</span>
                        </div>
                      )}
                      {quote.final_approval_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Approved:</span>
                          <span className="text-gray-900">{new Date(quote.final_approval_at).toLocaleString()}</span>
                        </div>
                      )}
                      {quote.turnaround_time_hours && (
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-gray-600">Turnaround:</span>
                          <span className="text-blue-600">
                            {(quote.turnaround_time_hours / 24).toFixed(1)} days ({quote.turnaround_time_hours.toFixed(0)}h)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DealScoreCard score={quote.deal_score} details={quote.deal_score_details} />

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Discount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.lines && quote.lines.length > 0 ? (
                    quote.lines.map((line, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {line.product?.name || line.product_id}
                          </div>
                          <div className="text-xs text-gray-500">{line.product_id}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {line.product?.category || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          ${typeof line.unit_price === 'number' ? line.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(line.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {typeof line.discount_applied === 'number' ? line.discount_applied.toFixed(2) : parseFloat(line.discount_applied).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          ${typeof line.line_total === 'number' ? line.line_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(line.line_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No line items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
