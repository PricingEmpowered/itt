/**
 * Reading and maintaining the minimum margins an analyst may quote at
 * without approval.
 *
 * Anyone signed in can read the table, because every priced quote depends on
 * it. Only an administrator can change it: what counts as within someone's
 * authority is a control, and a pricing analyst editing their own limit would
 * defeat the point of having one.
 *
 * The role check is made here as well as in the database policies. Without it
 * a non-admin's update would be filtered out by row-level security and succeed
 * with zero rows changed, which reads as a save that quietly did nothing.
 *
 * Every change is written to the audit log in the same transaction, with the
 * figure it replaced.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';
import type { Queryable } from '../db.js';

const REGIONS = ['*', 'North America', 'Europe', 'Asia Pacific'] as const;

type FloorRow = {
  authority_level: string;
  product_line: string;
  region: string;
  minimum_margin: string;
  is_placeholder: boolean;
  note: string | null;
  updated_at: string;
};

async function requireAdmin(db: Queryable) {
  const { rows } = await db.query(
    `SELECT 1 FROM user_profiles WHERE id = auth.uid() AND lower(role) = 'admin'`
  );
  if (rows.length === 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only an administrator can change the minimum margins.',
    });
  }
}

const key = z.object({
  authorityLevel: z.string().trim().min(1).max(60).default('analyst'),
  productLine: z.string().trim().min(1).max(200),
  region: z.enum(REGIONS),
});

export const marginsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query<FloorRow>(
        /* Default rows first, then by product line, so the table reads top-down. */
        `SELECT authority_level, product_line, region, minimum_margin,
                is_placeholder, note, updated_at
           FROM margin_authority_floors
          ORDER BY authority_level,
                   (product_line = '*') DESC,
                   lower(product_line),
                   (region = '*') DESC,
                   region`
      );
      return rows.map((r) => ({
        authorityLevel: r.authority_level,
        productLine: r.product_line,
        region: r.region,
        minimumMargin: Number(r.minimum_margin),
        isPlaceholder: r.is_placeholder,
        note: r.note,
        updatedAt: r.updated_at,
      }));
    })
  ),

  /** Whether the signed-in user can edit, so the screen can show or hide the controls. */
  canEdit: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query(
        `SELECT 1 FROM user_profiles WHERE id = auth.uid() AND lower(role) = 'admin'`
      );
      return rows.length > 0;
    })
  ),

  save: protectedProcedure
    .input(
      key.extend({
        /** Percent, as people write it: 30 means 30%. Stored as a fraction. */
        minimumMarginPercent: z.number().min(0).max(99.99),
        isPlaceholder: z.boolean().default(false),
        note: z.string().trim().max(500).nullable().default(null),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        await requireAdmin(db);

        const fraction = Math.round(input.minimumMarginPercent * 100) / 10000;

        const { rows: before } = await db.query<{ minimum_margin: string }>(
          `SELECT minimum_margin FROM margin_authority_floors
            WHERE authority_level = $1 AND product_line = $2 AND region = $3`,
          [input.authorityLevel, input.productLine, input.region]
        );

        await db.query(
          `INSERT INTO margin_authority_floors
             (authority_level, product_line, region, minimum_margin,
              is_placeholder, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, now(), auth.uid())
           ON CONFLICT (authority_level, product_line, region) DO UPDATE
             SET minimum_margin = EXCLUDED.minimum_margin,
                 is_placeholder = EXCLUDED.is_placeholder,
                 note           = EXCLUDED.note,
                 updated_at     = now(),
                 updated_by     = auth.uid()`,
          [
            input.authorityLevel,
            input.productLine,
            input.region,
            fraction,
            input.isPlaceholder,
            input.note,
          ]
        );

        await db.query(
          `INSERT INTO audit_logs (entity, entity_id, action, changed_by, details)
           VALUES ('margin_authority_floors', $1, $2, auth.uid(), $3::jsonb)`,
          [
            `${input.authorityLevel}/${input.productLine}/${input.region}`,
            before.length === 0 ? 'create' : 'update',
            JSON.stringify({
              from: before.length === 0 ? null : Number(before[0].minimum_margin),
              to: fraction,
              isPlaceholder: input.isPlaceholder,
            }),
          ]
        );

        return { ok: true as const, minimumMargin: fraction };
      })
    ),

  remove: protectedProcedure.input(key).mutation(({ ctx, input }) =>
    ctx.withDb(async (db) => {
      await requireAdmin(db);

      /*
       * The default row is what every unmatched line falls back to. Deleting it
       * would leave those lines with no approval line at all, so it can be
       * changed but not removed.
       */
      if (input.productLine === '*' && input.region === '*') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'The default row applies to every product line and region, so it can be edited but not deleted.',
        });
      }

      const { rows } = await db.query<{ minimum_margin: string }>(
        `DELETE FROM margin_authority_floors
          WHERE authority_level = $1 AND product_line = $2 AND region = $3
          RETURNING minimum_margin`,
        [input.authorityLevel, input.productLine, input.region]
      );
      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That row no longer exists.' });
      }

      await db.query(
        `INSERT INTO audit_logs (entity, entity_id, action, changed_by, details)
         VALUES ('margin_authority_floors', $1, 'delete', auth.uid(), $2::jsonb)`,
        [
          `${input.authorityLevel}/${input.productLine}/${input.region}`,
          JSON.stringify({ from: Number(rows[0].minimum_margin) }),
        ]
      );

      return { ok: true as const };
    })
  ),
});
