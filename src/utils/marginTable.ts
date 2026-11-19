/**
 * Reads a margin table pasted from a spreadsheet.
 *
 * ITT keeps its minimum margins as a grid: a product line down the side, a
 * column per region, a percentage in each cell. Pasting that grid is faster
 * and safer than retyping thirty-odd rows, so this turns pasted text into
 * rows for the margin table.
 *
 * ## Only numbers are loaded
 *
 * Some cells in ITT's grid are not percentages at all. They hold a region
 * name, such as "US" or "Asia", which reads as "see that region's figure".
 * Whether that is the right reading, and what to do where it points at a column
 * that has not been supplied, is ITT's to say. So those cells are listed as
 * skipped and nothing is loaded for them. A line with no row of its own falls
 * back to the default, which is visible and can be changed, rather than to a
 * figure inferred from an ambiguous cell.
 *
 * ## A percentage must look like one
 *
 * "57.0%" is read as 57%. A bare "57" is read as 57%. A bare "0.57" is
 * refused: it is either 0.57% or a fraction, the two differ by a factor of a
 * hundred, and a margin wrong by that much is exactly what this table must
 * not hold. Whoever pasted it can add the % sign.
 */

import { canonicalRegion, type RegionName } from '../../server/pricing/marginFloors';

export interface ParsedMarginRow {
  productLine: string;
  region: RegionName;
  /** Percent, as written: 57 means 57%. */
  marginPercent: number;
  /** 1-based line in the pasted text, for messages. */
  lineNumber: number;
}

export interface SkippedCell {
  lineNumber: number;
  productLine: string;
  region: RegionName | null;
  cell: string;
  reason: string;
}

export interface ParsedMarginTable {
  rows: ParsedMarginRow[];
  skipped: SkippedCell[];
  /** Regions the pasted columns were matched to, in column order. */
  columns: RegionName[];
  /** Lines ignored because they carried no product line and figures (titles, blanks). */
  ignoredLines: number;
  /** File-level problem. Non-empty means nothing was read. */
  fatal: string | null;
}

const DEFAULT_COLUMNS: RegionName[] = ['North America', 'Europe'];

/** Reads one cell as a percent, or says why it is not one. */
export function readPercent(
  raw: string
): { ok: true; percent: number } | { ok: false; reason: string } {
  const cell = raw.trim();
  if (cell === '') return { ok: false, reason: 'empty' };

  const m = /^(\d{1,3}(?:\.\d+)?)\s*(%?)$/.exec(cell);
  if (!m) return { ok: false, reason: `"${cell}" is not a percentage` };

  const value = Number(m[1]);
  const hasPercentSign = m[2] === '%';

  if (!hasPercentSign && value < 1) {
    return {
      ok: false,
      reason: `"${cell}" is ambiguous: 0.57% or 57%? Add a % sign`,
    };
  }
  if (value >= 100) return { ok: false, reason: `${value}% is not a possible margin` };
  return { ok: true, percent: value };
}

export function parseMarginTable(text: string): ParsedMarginTable {
  const empty: ParsedMarginTable = {
    rows: [],
    skipped: [],
    columns: [],
    ignoredLines: 0,
    fatal: null,
  };

  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  if (lines.every((l) => l.trim() === '')) {
    return { ...empty, fatal: 'Nothing was pasted.' };
  }

  /*
   * Spreadsheets paste tab-separated. A comma-separated paste is accepted too,
   * but only when no line contains a tab, since a product line can legitimately
   * hold a comma ("38999 Series I, II, and III").
   */
  const hasTabs = lines.some((l) => l.includes('\t'));
  if (!hasTabs) {
    return {
      ...empty,
      fatal:
        'Paste the table straight from the spreadsheet so the columns arrive separated by tabs. Commas are not used because product lines contain them.',
    };
  }

  let columns = DEFAULT_COLUMNS;
  const rows: ParsedMarginRow[] = [];
  const skipped: SkippedCell[] = [];
  let ignoredLines = 0;
  let headerSeen = false;

  lines.forEach((line, i) => {
    const lineNumber = i + 1;
    if (line.trim() === '') return;

    const cells = line.split('\t').map((c) => c.trim());

    /* A header names the region columns: use it, so a re-ordered paste still lands right. */
    const headerRegions = cells.slice(1).map((c) => canonicalRegion(c));
    if (
      !headerSeen &&
      headerRegions.length >= 1 &&
      headerRegions.every((r): r is RegionName => r !== null)
    ) {
      columns = headerRegions;
      headerSeen = true;
      return;
    }

    /* A title line or a lone label has a product line and no figures to read. */
    if (cells.length < 2 || cells[0] === '') {
      ignoredLines++;
      return;
    }

    const productLine = cells[0];
    cells.slice(1).forEach((cell, c) => {
      const region = columns[c] ?? null;
      if (region === null) return; // a column beyond the ones we know

      const read = readPercent(cell);
      if (read.ok) {
        rows.push({ productLine, region, marginPercent: read.percent, lineNumber });
      } else if (cell !== '') {
        skipped.push({ lineNumber, productLine, region, cell, reason: read.reason });
      }
    });
  });

  if (rows.length === 0 && skipped.length === 0) {
    return {
      ...empty,
      columns,
      ignoredLines,
      fatal: 'No product lines with margins were found in what was pasted.',
    };
  }

  return { rows, skipped, columns, ignoredLines, fatal: null };
}
