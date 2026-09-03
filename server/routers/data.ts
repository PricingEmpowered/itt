/**
 * Allowlisted table access.
 *
 * ## Why this exists
 *
 * The frontend was written against Supabase's PostgREST layer: components
 * issue table-oriented queries (`from('products').select('*').eq(...)`)
 * directly. Replacing that with ~100 bespoke procedures in one step would be
 * a large, regression-prone rewrite of 35 files at once.
 *
 * This router provides the same shape of access, minus the parts that made
 * doing it from a browser unsafe. It is a compatibility layer, not the end
 * state: feature-specific routers (auth, quotes, dashboard) already exist and
 * should absorb these call sites over time.
 *
 * ## Why it is safe
 *
 * No identifier ever comes from request input unchecked. On first use the
 * server reads `information_schema` and caches the real tables, views and
 * columns. A request naming anything outside that set — or outside the
 * explicit allowlist below — is rejected before any SQL is built. Values are
 * always bound as parameters, and operators come from a fixed map.
 *
 * Underneath, every query still runs as `authenticated` with the caller's
 * `app.current_user_id` set, so row-level security applies exactly as it did
 * under Supabase. Writes are additionally restricted to base tables.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Queryable } from '../db.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Relations the frontend is allowed to reach. Anything not listed here is
 * invisible to the API regardless of database privileges — notably
 * `auth.users`, which holds password hashes.
 */
const ALLOWED_RELATIONS = new Set([
  'ai_analytics_questions',
  'analytics_business_performance',
  'analytics_price_performance',
  'analytics_price_waterfall',
  'analytics_quote_funnel',
  'approval_history',
  'approval_requests',
  'approval_workflow_rules',
  'commission_payments',
  'commission_summary_by_rep',
  'commission_tiers',
  'currencies',
  'customer_price_lists',
  'customers',
  'deal_outcomes',
  'deal_score_analysis_by_customer_segment',
  'deal_score_analysis_by_product_family',
  'deal_score_config',
  'deal_score_recommendations',
  'exchange_rates',
  'expected_cost_changes',
  'industries',
  'price_change_alerts',
  'price_list_items',
  'price_lists',
  'price_simulations',
  'pricing_documents',
  'pricing_margin_adders',
  'pricing_maturity_assessments',
  'pricing_maturity_pillars',
  'pricing_multipliers',
  'pricing_rules_config',
  'product_families',
  'products',
  'quantity_breaks',
  'quote_lines',
  'quote_services',
  'quote_turnaround_analytics',
  'quotes',
  'regions',
  'sales_commissions',
  'service_sla_tiers',
  'services',
  'simulation_results',
  'user_profiles',
]);

type RelationInfo = { columns: Set<string>; isTable: boolean; primaryKey: string[] };
let schemaCache: Map<string, RelationInfo> | null = null;

async function loadSchema(db: Queryable): Promise<Map<string, RelationInfo>> {
  if (schemaCache) return schemaCache;

  const { rows } = await db.query<{
    table_name: string;
    column_name: string;
    is_table: boolean;
  }>(
    `SELECT c.table_name,
            c.column_name,
            (t.table_type = 'BASE TABLE') AS is_table
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'`
  );

  const map = new Map<string, RelationInfo>();
  for (const row of rows) {
    let entry = map.get(row.table_name);
    if (!entry) {
      entry = { columns: new Set(), isTable: row.is_table, primaryKey: [] };
      map.set(row.table_name, entry);
    }
    entry.columns.add(row.column_name);
  }

  // Primary keys are the default ON CONFLICT target for upsert.
  const { rows: keyRows } = await db.query<{ table_name: string; column_name: string }>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position`
  );
  for (const row of keyRows) {
    map.get(row.table_name)?.primaryKey.push(row.column_name);
  }

  schemaCache = map;
  return map;
}

async function relation(db: Queryable, name: string, forWrite: boolean): Promise<RelationInfo> {
  if (!ALLOWED_RELATIONS.has(name)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `Unknown relation: ${name}` });
  }
  const schema = await loadSchema(db);
  const info = schema.get(name);
  if (!info) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Relation does not exist: ${name}` });
  }
  if (forWrite && !info.isTable) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `${name} is a view and cannot be written` });
  }
  return info;
}

/** Rejects any column the relation does not actually have. */
function checkColumn(info: RelationInfo, name: string, relationName: string): string {
  if (!info.columns.has(name)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown column ${relationName}.${name}`,
    });
  }
  return `"${name}"`;
}

/** Fixed operator set; the request supplies the name, never the SQL. */
const OPERATORS = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'ILIKE',
} as const;

const filterSchema = z.object({
  column: z.string().min(1).max(63),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is']),
  value: z.unknown(),
});

type Filter = z.infer<typeof filterSchema>;

/** Builds the WHERE clause, appending bound values to `params`. */
function buildWhere(
  filters: Filter[] | undefined,
  info: RelationInfo,
  relationName: string,
  params: unknown[]
): string {
  if (!filters || filters.length === 0) return '';

  const clauses = filters.map((filter) => {
    const column = checkColumn(info, filter.column, relationName);

    if (filter.op === 'is') {
      // Only NULL comparisons; anything else belongs to eq.
      if (filter.value !== null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '`is` only supports null' });
      }
      return `${column} IS NULL`;
    }

    if (filter.op === 'in') {
      if (!Array.isArray(filter.value)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '`in` requires an array' });
      }
      if (filter.value.length === 0) return 'false';
      params.push(filter.value);
      return `${column} = ANY($${params.length})`;
    }

    params.push(filter.value);
    return `${column} ${OPERATORS[filter.op]} $${params.length}`;
  });

  return `WHERE ${clauses.join(' AND ')}`;
}

const orderSchema = z.object({
  column: z.string().min(1).max(63),
  ascending: z.boolean().default(true),
  nullsFirst: z.boolean().optional(),
});

export const dataRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        columns: z.array(z.string().min(1).max(63)).optional(),
        filters: z.array(filterSchema).max(20).optional(),
        order: z.array(orderSchema).max(4).optional(),
        limit: z.number().int().min(1).max(5000).optional(),
        offset: z.number().int().min(0).optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, false);

        const selection = input.columns?.length
          ? input.columns.map((c) => checkColumn(info, c, input.table)).join(', ')
          : '*';

        const params: unknown[] = [];
        const where = buildWhere(input.filters, info, input.table, params);

        const orderBy = input.order?.length
          ? `ORDER BY ${input.order
              .map((o) => {
                const column = checkColumn(info, o.column, input.table);
                const direction = o.ascending ? 'ASC' : 'DESC';
                const nulls =
                  o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
                return `${column} ${direction}${nulls}`;
              })
              .join(', ')}`
          : '';

        let tail = '';
        if (input.limit !== undefined) {
          params.push(input.limit);
          tail += ` LIMIT $${params.length}`;
        }
        if (input.offset !== undefined) {
          params.push(input.offset);
          tail += ` OFFSET $${params.length}`;
        }

        const { rows } = await db.query(
          `SELECT ${selection} FROM "${input.table}" ${where} ${orderBy}${tail}`,
          params
        );
        return rows;
      })
    ),

  /** Row count, replacing `select('*', { count: 'exact', head: true })`. */
  count: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        filters: z.array(filterSchema).max(20).optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, false);
        const params: unknown[] = [];
        const where = buildWhere(input.filters, info, input.table, params);
        const { rows } = await db.query<{ count: number }>(
          `SELECT count(*)::bigint AS count FROM "${input.table}" ${where}`,
          params
        );
        return rows[0]?.count ?? 0;
      })
    ),

  insert: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, true);

        // Every row is written with the same column list so a single
        // multi-row INSERT stays well-formed.
        const columns = Object.keys(input.rows[0]);
        if (columns.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No columns supplied' });
        }
        const quoted = columns.map((c) => checkColumn(info, c, input.table));

        const params: unknown[] = [];
        const tuples = input.rows.map((row) => {
          const placeholders = columns.map((column) => {
            params.push(row[column] ?? null);
            return `$${params.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        const { rows } = await db.query(
          `INSERT INTO "${input.table}" (${quoted.join(', ')})
           VALUES ${tuples.join(', ')}
           RETURNING *`,
          params
        );
        return rows;
      })
    ),

  /**
   * INSERT ... ON CONFLICT DO UPDATE, replacing the Supabase client's
   * `upsert`. `onConflict` names the conflicting columns; when omitted the
   * table's primary key is used, which is what PostgREST does.
   */
  upsert: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
        onConflict: z.array(z.string().min(1).max(63)).max(5).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, true);

        const columns = Object.keys(input.rows[0]);
        if (columns.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No columns supplied' });
        }
        const quoted = columns.map((c) => checkColumn(info, c, input.table));

        const conflictColumns = input.onConflict ?? info.primaryKey;
        if (conflictColumns.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${input.table} has no primary key; onConflict is required`,
          });
        }
        const conflictQuoted = conflictColumns.map((c) => checkColumn(info, c, input.table));

        const params: unknown[] = [];
        const tuples = input.rows.map((row) => {
          const placeholders = columns.map((column) => {
            params.push(row[column] ?? null);
            return `$${params.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        // Conflict columns identify the row, so updating them would be a no-op
        // at best and a surprise at worst.
        const updates = quoted
          .filter((c) => !conflictQuoted.includes(c))
          .map((c) => `${c} = EXCLUDED.${c}`);

        const action = updates.length
          ? `DO UPDATE SET ${updates.join(', ')}`
          : 'DO NOTHING';

        const { rows } = await db.query(
          `INSERT INTO "${input.table}" (${quoted.join(', ')})
           VALUES ${tuples.join(', ')}
           ON CONFLICT (${conflictQuoted.join(', ')}) ${action}
           RETURNING *`,
          params
        );
        return rows;
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        values: z.record(z.string(), z.unknown()),
        filters: z.array(filterSchema).min(1).max(20),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, true);

        const entries = Object.entries(input.values);
        if (entries.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No values supplied' });
        }

        const params: unknown[] = [];
        const assignments = entries.map(([column, value]) => {
          const quoted = checkColumn(info, column, input.table);
          params.push(value ?? null);
          return `${quoted} = $${params.length}`;
        });

        // Filters are mandatory: an unfiltered UPDATE would rewrite the table.
        const where = buildWhere(input.filters, info, input.table, params);

        const { rows } = await db.query(
          `UPDATE "${input.table}" SET ${assignments.join(', ')} ${where} RETURNING *`,
          params
        );
        return rows;
      })
    ),

  remove: protectedProcedure
    .input(
      z.object({
        table: z.string().min(1).max(63),
        filters: z.array(filterSchema).min(1).max(20),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const info = await relation(db, input.table, true);
        const params: unknown[] = [];
        // As with update, filters are mandatory so a bug cannot empty a table.
        const where = buildWhere(input.filters, info, input.table, params);
        const { rows } = await db.query(
          `DELETE FROM "${input.table}" ${where} RETURNING *`,
          params
        );
        return rows;
      })
    ),
});
