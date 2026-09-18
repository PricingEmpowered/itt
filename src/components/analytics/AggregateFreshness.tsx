import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { trpcClient } from '../../lib/trpcClient';

/*
 * Every figure on the Analytics and Dashboard screens comes from a
 * materialised view, which is a photograph rather than a window. A user
 * quoting from this app needs to know how old the photograph is -- otherwise
 * a dashboard that stopped refreshing overnight looks exactly like one that
 * is current.
 */
type Status = {
  lastRefreshedAt: Date | null;
  lastDurationMs: number | null;
  lastRowsWritten: number | null;
  stale: boolean;
  intervalMinutes: number;
  running: boolean;
};

function describeAge(at: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function AggregateFreshness() {
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus((await trpcClient.system.aggregateStatus.query()) as Status);
      setError(null);
    } catch (err) {
      console.error('Error loading aggregate status:', err);
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await trpcClient.system.refreshAggregates.mutate();
      await load();
      /* The screens below read their own data on mount, so a rebuild is only
         visible after they re-query. Reloading is blunt but honest about
         what just changed. */
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  if (!status) return null;

  const neverRun = status.lastRefreshedAt === null;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-sm ${
        status.stale
          ? 'bg-amber-50 border-amber-200'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {status.stale && (
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={16} />
        )}
        <span className={status.stale ? 'text-amber-900' : 'text-slate-600'}>
          {neverRun ? (
            <>
              Analytics have never been built. Everything below will be empty
              until the first refresh.
            </>
          ) : (
            <>
              Figures as of{' '}
              <span className="font-medium">
                {new Date(status.lastRefreshedAt as Date).toLocaleString()}
              </span>{' '}
              ({describeAge(new Date(status.lastRefreshedAt as Date))})
              {status.stale && ' — later than the schedule expects'}
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {error && <span className="text-red-600">{error}</span>}
        <button
          onClick={refresh}
          disabled={refreshing || status.running}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing || status.running ? 'Rebuilding…' : 'Refresh now'}
        </button>
      </div>
    </div>
  );
}
