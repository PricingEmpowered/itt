/**
 * PostgREST-shaped client over the tRPC `data` router.
 *
 * ## Why
 *
 * Every component in this app was written against Supabase's query builder.
 * Rewriting all 35 of them into bespoke endpoints in one pass would be a
 * large simultaneous change with a lot of room for silent behavioural
 * regressions. This exposes the same chainable shape, so porting a component
 * is a change of import rather than a rewrite of its queries.
 *
 * It is deliberately a compatibility layer. Feature routers (`trpc.quotes`,
 * `trpc.dashboard`, `trpc.reference`) are the destination; call sites should
 * move onto them over time, and this file should shrink.
 *
 * ## Differences from the Supabase client
 *
 * - Only the subset the app actually used is implemented. Anything else is a
 *   compile error rather than a silent no-op.
 * - Nested/embedded selects (`select('*, customer:customers(name)')`) are not
 *   supported; those call sites need a real endpoint. `trpc.quotes.list`
 *   already covers the one in useQuotes.
 * - Relations and columns are validated server-side against the real schema,
 *   so a typo fails loudly instead of returning nothing.
 */
import { trpcClient } from './trpcClient';

export type QueryError = { message: string; code?: string };
export type QueryResult<T> = { data: T | null; error: QueryError | null };

type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is';
type Filter = { column: string; op: FilterOp; value: unknown };
type Order = { column: string; ascending: boolean; nullsFirst?: boolean };

function toError(err: unknown): QueryError {
  return { message: err instanceof Error ? err.message : String(err) };
}

class SelectBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
  private filters: Filter[] = [];
  private orderBy: Order[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(
    private table: string,
    private columns?: string[]
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }
  like(column: string, value: string) {
    this.filters.push({ column, op: 'like', value });
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push({ column, op: 'ilike', value });
    return this;
  }
  is(column: string, value: null) {
    this.filters.push({ column, op: 'is', value });
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderBy.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  private run() {
    return trpcClient.data.list.query({
      table: this.table,
      columns: this.columns,
      filters: this.filters.length ? this.filters : undefined,
      order: this.orderBy.length ? this.orderBy : undefined,
      limit: this.limitValue,
      offset: this.offsetValue,
    }) as Promise<T[]>;
  }

  /** Exactly one row expected; more or fewer is an error, as in PostgREST. */
  async single(): Promise<QueryResult<T>> {
    try {
      const rows = await this.run();
      if (rows.length !== 1) {
        return { data: null, error: { message: `Expected 1 row, got ${rows.length}` } };
      }
      return { data: rows[0], error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  /** Zero or one row; zero yields null data rather than an error. */
  async maybeSingle(): Promise<QueryResult<T>> {
    try {
      const rows = await this.run();
      if (rows.length > 1) {
        return { data: null, error: { message: `Expected at most 1 row, got ${rows.length}` } };
      }
      return { data: rows[0] ?? null, error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  then<R1 = QueryResult<T[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run()
      .then((rows) => ({ data: rows, error: null }) as QueryResult<T[]>)
      .catch((err) => ({ data: null, error: toError(err) }) as QueryResult<T[]>)
      .then(onfulfilled, onrejected);
  }
}

class MutationBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
  private filters: Filter[] = [];

  constructor(
    private kind: 'update' | 'delete',
    private table: string,
    private values?: Record<string, unknown>
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }
  is(column: string, value: null) {
    this.filters.push({ column, op: 'is', value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  /** No-op: the API always returns affected rows. Kept for call-site parity. */
  select() {
    return this;
  }

  async single(): Promise<QueryResult<T>> {
    const result = await this.run();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data ?? [];
    if (rows.length !== 1) {
      return { data: null, error: { message: `Expected 1 row, got ${rows.length}` } };
    }
    return { data: rows[0], error: null };
  }

  private async run(): Promise<QueryResult<T[]>> {
    try {
      if (this.filters.length === 0) {
        // The server enforces this too; failing here gives a clearer message.
        throw new Error(
          `${this.kind} on ${this.table} requires a filter — refusing to affect every row`
        );
      }
      const rows =
        this.kind === 'update'
          ? await trpcClient.data.update.mutate({
              table: this.table,
              values: this.values ?? {},
              filters: this.filters as never,
            })
          : await trpcClient.data.remove.mutate({
              table: this.table,
              filters: this.filters as never,
            });
      return { data: rows as T[], error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  then<R1 = QueryResult<T[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class InsertBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
  constructor(
    private table: string,
    private rows: Record<string, unknown>[]
  ) {}

  select() {
    return this;
  }

  async single(): Promise<QueryResult<T>> {
    const result = await this.run();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data ?? [];
    if (rows.length !== 1) {
      return { data: null, error: { message: `Expected 1 row, got ${rows.length}` } };
    }
    return { data: rows[0], error: null };
  }

  private async run(): Promise<QueryResult<T[]>> {
    try {
      const rows = await trpcClient.data.insert.mutate({
        table: this.table,
        rows: this.rows as never,
      });
      return { data: rows as T[], error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  then<R1 = QueryResult<T[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class UpsertBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
  constructor(
    private table: string,
    private rows: Record<string, unknown>[],
    private onConflict?: string[]
  ) {}

  select() {
    return this;
  }

  private async run(): Promise<QueryResult<T[]>> {
    try {
      const rows = await trpcClient.data.upsert.mutate({
        table: this.table,
        rows: this.rows as never,
        onConflict: this.onConflict,
      });
      return { data: rows as T[], error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  then<R1 = QueryResult<T[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Result of a head/count query: no rows, just the total. */
class CountBuilder implements PromiseLike<{ count: number | null; error: QueryError | null }> {
  private filters: Filter[] = [];
  constructor(private table: string) {}

  eq(column: string, value: unknown) { this.filters.push({ column, op: 'eq', value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, op: 'neq', value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, op: 'gt', value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, op: 'gte', value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ column, op: 'lt', value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ column, op: 'lte', value }); return this; }
  is(column: string, value: null) { this.filters.push({ column, op: 'is', value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ column, op: 'in', value: values }); return this; }

  private async run() {
    try {
      const count = await trpcClient.data.count.query({
        table: this.table,
        filters: this.filters.length ? this.filters : undefined,
      });
      return { count, error: null };
    } catch (err) {
      return { count: null, error: toError(err) };
    }
  }

  then<R1 = { count: number | null; error: QueryError | null }, R2 = never>(
    onfulfilled?: ((value: { count: number | null; error: QueryError | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class TableClient {
  constructor(private table: string) {}

  /**
   * `columns` accepts a comma-separated list as the Supabase client did.
   * '*' and embedded selects are handled by passing no explicit column list;
   * embedded selects are not supported and need a real endpoint.
   */
  select(columns: string, options: { count: 'exact'; head: true }): CountBuilder;
  select(columns?: string): SelectBuilder;
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): any {
    // head:true means "don't return rows, just the count".
    if (options?.head) {
      return new CountBuilder(this.table);
    }
    const list =
      !columns || columns.trim() === '*' || columns.includes('(')
        ? undefined
        : columns
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0 && c !== '*');
    return new SelectBuilder(this.table, list);
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    return new InsertBuilder(this.table, Array.isArray(rows) ? rows : [rows]);
  }

  /**
   * `onConflict` is a comma-separated column list, as in the Supabase client.
   * Omitted, the server falls back to the table's primary key.
   */
  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ) {
    return new UpsertBuilder(
      this.table,
      Array.isArray(rows) ? rows : [rows],
      options?.onConflict?.split(',').map((c) => c.trim()).filter(Boolean)
    );
  }

  update(values: Record<string, unknown>) {
    return new MutationBuilder('update', this.table, values);
  }

  delete() {
    return new MutationBuilder('delete', this.table);
  }
}

export const db = {
  from(table: string) {
    return new TableClient(table);
  },
};
