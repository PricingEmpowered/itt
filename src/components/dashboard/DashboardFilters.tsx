import { trpc } from '../../lib/trpc';

/**
 * What the dashboard charts are filtered by. `periodDays` is the window;
 * the other three are null for "all".
 */
export interface DashboardChartFilters {
  periodDays: number;
  familyId: string | null;
  region: string | null;
  channel: string | null;
}

/*
 * Timeframe is a window length rather than a comparison basis. The previous
 * control offered "Month over Month / Quarter over Quarter / Year over Year",
 * which promised a period comparison nothing computed.
 */
const timeframeOptions = [
  { value: 90, label: 'Last 90 days' },
  { value: 182, label: 'Last 6 months' },
  { value: 365, label: 'Last 12 months' },
  { value: 730, label: 'Last 24 months' },
];

interface DashboardFiltersProps {
  filters: DashboardChartFilters;
  onFiltersChange: (filters: DashboardChartFilters) => void;
}

/**
 * The filter bar.
 *
 * Its options used to be hardcoded lists - Hardware / Software / Services,
 * North America / Europe / Asia, Direct / Partner / Online - none of which
 * exist in ITT's data: the families are a four-level hierarchy of part
 * families, the regions include "Asia Pacific" and "Americas", and channel is
 * carried on the customer as segment. Selecting any of them would have
 * filtered to nothing. They are read from the database now, so the bar can
 * only offer what is actually there.
 */
export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const options = trpc.dashboard.filterOptions.useQuery();

  const set = <K extends keyof DashboardChartFilters>(
    key: K,
    value: DashboardChartFilters[K]
  ) => onFiltersChange({ ...filters, [key]: value });

  const selectClass =
    'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">Timeframe</label>
          <select
            value={filters.periodDays}
            onChange={(e) => set('periodDays', Number(e.target.value))}
            className={selectClass}
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">Product Family</label>
          <select
            value={filters.familyId ?? ''}
            onChange={(e) => set('familyId', e.target.value || null)}
            className={selectClass}
          >
            <option value="">All Families</option>
            {(options.data?.productFamilies ?? []).map((family: any) => (
              <option key={family.id} value={family.id}>
                {family.is_root ? family.name : `  ${family.name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">Region</label>
          <select
            value={filters.region ?? ''}
            onChange={(e) => set('region', e.target.value || null)}
            className={selectClass}
          >
            <option value="">All Regions</option>
            {(options.data?.regions ?? []).map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Channel
            <span className="text-slate-400 font-normal"> (customer segment)</span>
          </label>
          <select
            value={filters.channel ?? ''}
            onChange={(e) => set('channel', e.target.value || null)}
            className={selectClass}
          >
            <option value="">All Channels</option>
            {(options.data?.channels ?? []).map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
