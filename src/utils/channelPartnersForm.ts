/**
 * Reads an uploaded Channel Partners quote request into quote lines.
 *
 * ## This file is the seam, and that is its whole purpose
 *
 * ITT has not yet supplied the real export layout. Rather than guess once
 * and scatter the guess through the upload screen, every assumption about
 * the file lives here: which headers mean what, which columns are required,
 * and how a row becomes a line. When the real layout arrives, the change is
 * COLUMNS and nothing else.
 *
 * ## Headers are matched loosely, values are read strictly
 *
 * Header matching is case-insensitive, ignores punctuation and spacing, and
 * accepts several spellings, because "Part No." and "part_number" are the
 * same column and a pilot should not fail on a capital letter.
 *
 * Values get the opposite treatment. A quantity that cannot be read becomes
 * an error on that row, never a 1; a price that cannot be read becomes an
 * error, never a 0. On a system whose output is quoted to customers, a
 * silently defaulted number is the failure with no tell.
 *
 * ## Rows are kept even when they are wrong
 *
 * A row that fails validation still comes back, carrying its errors and its
 * original row number. Dropping bad rows would change the line count between
 * the file and the screen, and the person checking would have no way to see
 * what went missing.
 */

import { parseCsv, parseNumber } from './csv';

/** Field names this module produces, mapped to the headers it will accept. */
const COLUMNS = {
  partNumber: ['part number', 'part no', 'part', 'part num', 'item', 'item number', 'item no', 'sku', 'material', 'material number'],
  description: ['description', 'desc', 'item description', 'part description', 'product description'],
  quantity: ['quantity', 'qty', 'order qty', 'order quantity', 'requested qty', 'req qty'],
  listPrice: ['list price', 'list', 'unit list price', 'list price usd', 'list amount', 'unit list'],
  cost: ['cost', 'unit cost', 'standard cost', 'booked cost', 'std cost'],
  requestId: ['request id', 'request number', 'request no', 'quote id', 'quote number', 'quote ref', 'rfq', 'rfq number'],
  customer: ['customer', 'customer name', 'customer id', 'account', 'account name', 'sold to'],
} as const;

export type FieldName = keyof typeof COLUMNS;

/** Required for a row to be priceable at all. */
const REQUIRED: FieldName[] = ['partNumber', 'quantity'];

export interface UploadedLine {
  /** 1-based row number in the file, counting the header. For error messages. */
  rowNumber: number;
  partNumber: string | null;
  description: string | null;
  quantity: number | null;
  listPrice: number | null;
  cost: number | null;
  requestId: string | null;
  customer: string | null;
  /** Empty when the row is usable. */
  errors: string[];
}

export interface ParsedForm {
  lines: UploadedLine[];
  /** Which header in the file supplied each field. For showing the user. */
  matchedHeaders: Partial<Record<FieldName, string>>;
  /** Required fields with no matching header. A file missing these is rejected. */
  missingRequired: FieldName[];
  /** Headers present in the file that this module does not use. */
  unmappedHeaders: string[];
  /** File-level problems. Non-empty means nothing was read. */
  fatal: string[];
}

/** "Part No." and "part_number" are the same column. */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function blankToNull(s: string | undefined): string | null {
  if (s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

export function parseChannelPartnersForm(text: string): ParsedForm {
  const empty: ParsedForm = {
    lines: [],
    matchedHeaders: {},
    missingRequired: [],
    unmappedHeaders: [],
    fatal: [],
  };

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ...empty, fatal: ['The file is empty.'] };
  }

  const headerRow = rows[0].map(normaliseHeader);
  const dataRows = rows.slice(1);

  /* Map each known field to the first header that matches one of its spellings. */
  const indexOf: Partial<Record<FieldName, number>> = {};
  const matchedHeaders: Partial<Record<FieldName, string>> = {};
  const usedIndexes = new Set<number>();

  for (const field of Object.keys(COLUMNS) as FieldName[]) {
    const accepted: readonly string[] = COLUMNS[field];
    const i = headerRow.findIndex((h, idx) => !usedIndexes.has(idx) && accepted.includes(h));
    if (i !== -1) {
      indexOf[field] = i;
      matchedHeaders[field] = rows[0][i].trim();
      usedIndexes.add(i);
    }
  }

  const missingRequired = REQUIRED.filter((f) => indexOf[f] === undefined);
  const unmappedHeaders = rows[0]
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h !== '' && !usedIndexes.has(i))
    .map(({ h }) => h);

  if (missingRequired.length > 0) {
    return {
      ...empty,
      matchedHeaders,
      missingRequired,
      unmappedHeaders,
      fatal: [
        `The file has no column for ${missingRequired.join(' or ')}. ` +
          `Found: ${rows[0].map((h) => h.trim()).filter(Boolean).join(', ') || '(no headers)'}.`,
      ],
    };
  }

  const cell = (row: string[], field: FieldName): string | null => {
    const i = indexOf[field];
    return i === undefined ? null : blankToNull(row[i]);
  };

  const lines: UploadedLine[] = [];

  dataRows.forEach((row, i) => {
    /* Row 1 is the header, so the first data row is row 2 as a person counts. */
    const rowNumber = i + 2;

    /* A wholly blank line is spreadsheet padding, not a row someone meant. */
    if (row.every((c) => c.trim() === '')) return;

    const errors: string[] = [];

    const partNumber = cell(row, 'partNumber');
    if (partNumber === null) errors.push('No part number.');

    const quantityRaw = cell(row, 'quantity');
    const quantity = parseNumber(quantityRaw);
    if (quantityRaw === null) {
      errors.push('No quantity.');
    } else if (quantity === null) {
      errors.push(`Quantity "${quantityRaw}" is not a number.`);
    } else if (quantity <= 0) {
      errors.push(`Quantity ${quantity} is not greater than zero.`);
    } else if (!Number.isInteger(quantity)) {
      errors.push(`Quantity ${quantity} is not a whole number.`);
    }

    const listRaw = cell(row, 'listPrice');
    const listPrice = parseNumber(listRaw);
    if (listRaw !== null && listPrice === null) {
      errors.push(`List price "${listRaw}" is not a number.`);
    } else if (listPrice !== null && listPrice < 0) {
      errors.push(`List price ${listPrice} is negative.`);
    }

    const costRaw = cell(row, 'cost');
    const cost = parseNumber(costRaw);
    if (costRaw !== null && cost === null) {
      errors.push(`Cost "${costRaw}" is not a number.`);
    } else if (cost !== null && cost < 0) {
      errors.push(`Cost ${cost} is negative.`);
    }

    lines.push({
      rowNumber,
      partNumber,
      description: cell(row, 'description'),
      quantity: quantity !== null && quantity > 0 && Number.isInteger(quantity) ? quantity : null,
      listPrice: listPrice !== null && listPrice >= 0 ? listPrice : null,
      cost: cost !== null && cost >= 0 ? cost : null,
      requestId: cell(row, 'requestId'),
      customer: cell(row, 'customer'),
      errors,
    });
  });

  return { lines, matchedHeaders, missingRequired: [], unmappedHeaders, fatal: [] };
}

/**
 * The request identifier, if the file carried one and agreed with itself.
 *
 * This matters more than it looks: the identifier has to survive the round
 * trip out to Price Space and back, or the monthly win/loss and escalation
 * returns cannot be matched to the quotes they describe. A file carrying two
 * different identifiers is a sign the export merged two requests, which is
 * worth refusing rather than guessing at.
 */
export function requestIdOf(form: ParsedForm): { id: string | null; conflict: string[] } {
  const ids = [...new Set(form.lines.map((l) => l.requestId).filter((v): v is string => !!v))];
  if (ids.length === 0) return { id: null, conflict: [] };
  if (ids.length === 1) return { id: ids[0], conflict: [] };
  return { id: null, conflict: ids };
}
