/**
 * Exchange rates.
 *
 * Replaces the `currency-rates` Supabase Edge Function, which called
 * frankfurter.dev on every request. An air-gapped server cannot reach it, so
 * rates are served from the `exchange_rates` table instead: whatever the
 * organisation has loaded is what the app uses.
 *
 * Where the server does have outbound access, setting FX_API_URL lets an
 * operator refresh the stored rates via POST /api/currency-rates/refresh.
 * Nothing calls out on its own.
 *
 * The response keeps the shape the frontend already expects
 * ({ success, base, date, rates }) so call sites did not have to change.
 */
import type { Express, Request, Response } from 'express';
import { asOwner } from './db.js';
import { readSession } from './session.js';

type RateRow = { to_currency: string; rate: number; date: string };

export function registerCurrencyRoutes(app: Express): void {
  app.get('/api/currency-rates', async (req: Request, res: Response) => {
    if (!(await readSession(req))) {
      res.status(401).json({ success: false, error: 'Not signed in' });
      return;
    }

    const base = String(req.query.base ?? 'USD').toUpperCase().slice(0, 8);
    const symbols = String(req.query.symbols ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 50);

    try {
      /*
       * Most recent rate per target currency. DISTINCT ON keeps one row per
       * pair, taking the latest date.
       */
      const rows = await asOwner(async (db) => {
        const params: unknown[] = [base];
        let filter = '';
        if (symbols.length > 0) {
          params.push(symbols);
          filter = `AND to_currency = ANY($${params.length})`;
        }
        const result = await db.query<RateRow>(
          `SELECT DISTINCT ON (to_currency) to_currency, rate, date
             FROM exchange_rates
            WHERE from_currency = $1 ${filter}
            ORDER BY to_currency, date DESC`,
          params
        );
        return result.rows;
      });

      const rates: Record<string, number> = {};
      let latest: string | null = null;
      for (const row of rows) {
        rates[row.to_currency] = Number(row.rate);
        const date = String(row.date);
        if (!latest || date > latest) latest = date;
      }

      res.json({
        success: true,
        base,
        date: latest,
        rates,
        /*
         * Signals an empty rate table so the UI can tell "no rates loaded"
         * apart from "this currency is 1:1".
         */
        stored: rows.length > 0,
      });
    } catch (err) {
      console.error('[currency-rates] lookup failed:', err);
      res.status(500).json({ success: false, error: 'Could not read exchange rates' });
    }
  });
}
