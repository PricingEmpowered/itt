/**
 * Keeping the pre-aggregated analytics current.
 *
 * The materialised views behind the Analytics and Dashboard screens are only
 * as good as their last refresh. On a 3M-line database a full rebuild takes
 * about 27 seconds, which is far too slow to do per page load and quite
 * cheap to do on a schedule.
 *
 * The schedule lives in this process rather than in cron or Windows Task
 * Scheduler. An on-premise install is meant to be one service to configure;
 * asking an ITT administrator to also register a scheduled task is a step
 * that gets skipped, and a skipped step here does not fail loudly - it just
 * means the dashboard quietly stops moving. Running it in-process makes the
 * refresh a property of the server being up.
 *
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` does not block readers, so a
 * refresh running underneath a user looking at a chart is safe; they see the
 * previous values until it commits.
 */
import { asOwner } from './db.js';
import { ENV } from './env.js';

export type RefreshRow = {
  view_name: string;
  rows_written: string | number;
  duration_ms: number;
};

export type AggregateStatus = {
  lastRefreshedAt: Date | null;
  lastDurationMs: number | null;
  lastRowsWritten: number | null;
  stale: boolean;
  intervalMinutes: number;
  running: boolean;
};

/* One refresh at a time. Two concurrent refreshes of the same matview would
   serialise in the database anyway, but the second would hold a connection
   for the whole of the first. */
let running = false;
let timer: NodeJS.Timeout | null = null;

export function isRefreshRunning(): boolean {
  return running;
}

export async function refreshAggregates(): Promise<RefreshRow[]> {
  if (running) {
    throw new Error('A refresh is already running.');
  }
  running = true;
  try {
    return await asOwner(async (db) => {
      const { rows } = await db.query<RefreshRow>('SELECT * FROM refresh_pricing_aggregates()');
      return rows;
    });
  } finally {
    running = false;
  }
}

export async function aggregateStatus(): Promise<AggregateStatus> {
  const intervalMinutes = ENV.aggregateRefreshMinutes;

  const last = await asOwner(async (db) => {
    const { rows } = await db.query<{
      refreshed_at: Date;
      duration_ms: number;
      rows_written: string;
    }>(
      'SELECT refreshed_at, duration_ms, rows_written FROM aggregate_refresh_log ORDER BY refreshed_at DESC LIMIT 1'
    );
    return rows[0] ?? null;
  });

  if (!last) {
    return {
      lastRefreshedAt: null,
      lastDurationMs: null,
      lastRowsWritten: null,
      /* Never refreshed is the most stale a thing can be. */
      stale: true,
      intervalMinutes,
      running,
    };
  }

  /* Twice the interval before calling it stale, so one slow or skipped cycle
     does not put a warning on the screen. */
  const ageMs = Date.now() - last.refreshed_at.getTime();
  return {
    lastRefreshedAt: last.refreshed_at,
    lastDurationMs: last.duration_ms,
    lastRowsWritten: Number(last.rows_written),
    stale: ageMs > intervalMinutes * 60 * 1000 * 2,
    intervalMinutes,
    running,
  };
}

/**
 * Starts the background schedule. Set AGGREGATE_REFRESH_MINUTES to 0 to turn
 * it off, for an install that would rather drive the refresh from its own
 * scheduler after a nightly ERP load.
 */
export function startAggregateSchedule(): void {
  const minutes = ENV.aggregateRefreshMinutes;
  if (minutes <= 0) {
    console.log('Aggregate refresh schedule disabled (AGGREGATE_REFRESH_MINUTES=0).');
    return;
  }

  const run = async (reason: string) => {
    if (running) return;
    const started = Date.now();
    try {
      const rows = await refreshAggregates();
      const total = rows.reduce((sum, r) => sum + Number(r.rows_written), 0);
      console.log(
        `[aggregates] ${reason}: ${total.toLocaleString()} rows in ${Date.now() - started}ms`
      );
    } catch (err) {
      /* A failed refresh must not take the server down. The screens keep
         serving the previous values and the status query reports the age. */
      console.error('[aggregates] refresh failed:', err instanceof Error ? err.message : err);
    }
  };

  /* Refresh at boot only if the data is actually stale, so restarting the
     service during the day does not trigger a 27-second rebuild each time. */
  void (async () => {
    try {
      const status = await aggregateStatus();
      if (status.stale) await run('startup refresh');
    } catch (err) {
      console.error('[aggregates] status check failed:', err instanceof Error ? err.message : err);
    }
  })();

  timer = setInterval(() => void run('scheduled refresh'), minutes * 60 * 1000);
  /* Do not hold the event loop open on shutdown. */
  timer.unref();
  console.log(`Aggregate refresh scheduled every ${minutes} minutes.`);
}

export function stopAggregateSchedule(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
