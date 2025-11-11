interface DashboardFiltersProps {
  filters: {
    productFamily: string;
    timeframe: string;
    region: string;
    channel: string;
  };
  onFiltersChange: (filters: any) => void;
}

const timeframeOptions = [
  { value: 'month', label: 'Month over Month' },
  { value: 'quarter', label: 'Quarter over Quarter' },
  { value: 'year', label: 'Year over Year' },
];

const productFamilyOptions = [
  { value: 'all', label: 'All Products' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'services', label: 'Services' },
];

const regionOptions = [
  { value: 'all', label: 'All Regions' },
  { value: 'north-america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
];

const channelOptions = [
  { value: 'all', label: 'All Channels' },
  { value: 'direct', label: 'Direct' },
  { value: 'partner', label: 'Partner' },
  { value: 'online', label: 'Online' },
];

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const handleChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Timeframe
          </label>
          <select
            value={filters.timeframe}
            onChange={(e) => handleChange('timeframe', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Product Family
          </label>
          <select
            value={filters.productFamily}
            onChange={(e) => handleChange('productFamily', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {productFamilyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Region
          </label>
          <select
            value={filters.region}
            onChange={(e) => handleChange('region', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {regionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Channel
          </label>
          <select
            value={filters.channel}
            onChange={(e) => handleChange('channel', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {channelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
