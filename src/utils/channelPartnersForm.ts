/**
 * Reads an uploaded Channel Partners quote export into quote lines.
 *
 * ## This file is the seam
 *
 * Every assumption about the export's layout lives here: which headers mean
 * what, which are required, and how a row becomes a line. The layout is
 * ITT's, not ours, so when it changes the edit is the COLUMNS map and nothing
 * else.
 *
 * ## What the real export looks like
 *
 * It is a tab-separated dump of about a hundred columns, most of them empty,
 * with the text NULL written wherever a value is missing. Column names are
 * upper-case with underscores (PART_NO, QTY_MOQ, COST_ESTIMATED). A few of
 * those columns look interchangeable and are not, so the choices below are
 * deliberate:
 *
 *   cost        COST_ESTIMATED. ITT's own margin reconciles to
 *               (price - cost_estimated) / price, which is how this was
 *               established. BOOK_COST is deliberately NOT read as a cost: it
 *               is a different basis that ITT has not defined, and on the
 *               sample it exceeds the price asked for, which as a cost would
 *               be a negative margin on every line that carries it.
 *   list price  no column in the export is known to be one, so none is read.
 *               A column literally named list price is still accepted.
 *   part        PART_NO is the catalogue number; PART_NO_MANUF is the
 *               internal one. Both are carried so either can find the part.
 *   requested   REQ_TARGET_PRICE_RESALE and _DISTR are what a distributor
 *               or its customer asked for. They are not ITT's selling price,
 *               so they are kept as information and never compared with a
 *               price band.
 *
 * ## Headers are matched loosely, values are read strictly
 *
 * Header matching ignores case, spacing and punctuation, so "Part No." and
 * PART_NO are the same column. Values get the opposite treatment: a quantity
 * that cannot be read becomes an error on that row, never a 1; a price that
 * cannot be read becomes an error, never a 0. On a system whose output is
 * quoted to customers, a silently defaulted number is the failure with no tell.
 *
 * ## Rows are kept even when they are wrong
 *
 * A row that fails validation still comes back, carrying its errors and its
 * original row number. Dropping bad rows would change the line count between
 * the file and the screen, and the person checking would have no way to see
 * what went missing.
 */

import { detectDelimiter, parseCsv, parseNumber } from './csv';

/** Field names this module produces, mapped to the headers it will accept. */
const COLUMNS = {
  /* PART_NO: the catalogue number. */
  partNumber: ['part number', 'part no', 'part', 'part num', 'item number', 'item no', 'sku', 'material', 'material number'],
  /* PART_NO_MANUF: the internal number. */
  altPartNumber: ['part no manuf', 'internal part number', 'manufacturer part number'],
  description: ['description', 'desc', 'item description', 'part description', 'product description', 'part no descr'],
  quantity: ['quantity', 'qty', 'order qty', 'order quantity', 'requested qty', 'req qty'],
  /* The minimum order quantity the price applies at. Not a quantity ordered. */
  moq: ['qty moq', 'moq', 'min order qty', 'minimum order quantity'],
  listPrice: ['list price', 'list', 'unit list price', 'list price usd', 'list amount', 'unit list'],
  /* Per-unit cost. COST_ESTIMATED, and never BOOK_COST: see the header note. */
  cost: ['cost estimated', 'cost', 'unit cost', 'standard cost', 'std cost'],
  /* What a distributor or its customer asked for. Information only. */
  requestedResalePrice: ['req target price resale'],
  requestedDistributorPrice: ['req target price distr'],
  productLine: ['product line', 'internal product line'],
  /* The region doing the quoting. */
  region: ['quoting region descr i', 'quoting region', 'region'],
  currency: ['currency given', 'currency target', 'currency'],
  /* The Channel Partners key for the line. It has to survive the round trip. */
  itemId: ['itemid', 'item id'],
  requestId: ['request id', 'request number', 'request no', 'quote id', 'quote number', 'quote ref', 'rfq', 'rfq number'],
  customer: ['customer', 'customer name', 'customer id', 'account', 'account name', 'sold to'],
  /* Flags that mean a line should not be priced. */
  isDeleted: ['is deleted'],
  isInactive: ['inactive'],
  isRejected: ['reject'],
  /* Present only on quotes that already have an outcome. */
  outcome: ['order status descr'],
} as const;

export type FieldName = keyof typeof COLUMNS;

/** Required for a row to be priceable at all. */
const REQUIRED: FieldName[] = ['partNumber', 'quantity'];

export interface UploadedLine {
  /** 1-based row number in the file, counting the header. For error messages. */
  rowNumber: number;
  partNumber: string | null;
  altPartNumber: string | null;
  description: string | null;
  quantity: number | null;
  moq: number | null;
  listPrice: number | null;
  cost: number | null;
  requestedResalePrice: number | null;
  requestedDistributorPrice: number | null;
  productLine: string | null;
  region: string | null;
  currency: string | null;
  itemId: string | null;
  requestId: string | null;
  customer: string | null;
  /** An outcome such as "Won", when the export already carries one. */
  outcome: string | null;
  /**
   * Channel Partners itself has deleted, deactivated or rejected this line. It
   * is reported and left out of the quote, unlike a line with a bad value, which
   * stays so that someone can correct it.
   */
  withdrawn: boolean;
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
  /** The field separator that was detected. */
  delimiter: string;
  /** The single currency the file is in, or null if absent or mixed. */
  currency: string | null;
  /** Currencies seen, when there is more than one. */
  mixedCurrencies: string[];
  /** How many lines already carry an outcome, which means this is history. */
  linesWithOutcome: number;
  /** File-level problems. Non-empty means nothing was read. */
  fatal: string[];
}

/** "Part No." and "part_number" are the same column. */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The export writes the text NULL for a missing value. That is an empty cell,
 * not a part called NULL, and must never reach a price or a part lookup.
 */
function blankToNull(s: string | undefined): string | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '' || t.toUpperCase() === 'NULL') return null;
  return t;
}

/** A flag column: 1, true or yes. Anything else, including NULL, is off. */
function isFlagSet(v: string | null): boolean {
  if (v === null) return false;
  return ['1', 'true', 'yes', 'y'].includes(v.trim().toLowerCase());
}

export function parseChannelPartnersForm(text: string): ParsedForm {
  const empty: ParsedForm = {
    lines: [],
    matchedHeaders: {},
    missingRequired: [],
    unmappedHeaders: [],
    delimiter: ',',
    currency: null,
    mixedCurrencies: [],
    linesWithOutcome: 0,
    fatal: [],
  };

  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, { delimiter });
  if (rows.length === 0) {
    return { ...empty, delimiter, fatal: ['The file is empty.'] };
  }

  const headerRow = rows[0].map(normaliseHeader);
  const dataRows = rows.slice(1);

  /*
   * Map each known field to the columns that can supply it, in the order the
   * spellings are listed in COLUMNS. That order is a priority, not a set: the
   * export has CURRENCY_TARGET ahead of CURRENCY_GIVEN, and picking whichever
   * came first in the file read the wrong one. A field can match several
   * columns; the first is the primary and the rest are fallbacks for a row
   * where the primary is empty. A column supplies only one field.
   */
  const columnsFor: Partial<Record<FieldName, number[]>> = {};
  const matchedHeaders: Partial<Record<FieldName, string>> = {};
  const usedIndexes = new Set<number>();

  for (const field of Object.keys(COLUMNS) as FieldName[]) {
    const accepted: readonly string[] = COLUMNS[field];
    const found: number[] = [];
    for (const spelling of accepted) {
      const i = headerRow.findIndex((h, idx) => h === spelling && !usedIndexes.has(idx));
      if (i !== -1) found.push(i);
    }
    if (found.length > 0) {
      columnsFor[field] = found;
      matchedHeaders[field] = rows[0][found[0]].trim();
      found.forEach((i) => usedIndexes.add(i));
    }
  }

  const missingRequired = REQUIRED.filter((f) => columnsFor[f] === undefined);
  const unmappedHeaders = rows[0]
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h !== '' && !usedIndexes.has(i))
    .map(({ h }) => h);

  if (missingRequired.length > 0) {
    return {
      ...empty,
      delimiter,
      matchedHeaders,
      missingRequired,
      unmappedHeaders,
      fatal: [
        `The file has no column for ${missingRequired.join(' or ')}. ` +
          `Found: ${
            rows[0]
              .map((h) => h.trim())
              .filter(Boolean)
              .slice(0, 12)
              .join(', ') || '(no headers)'
          }${rows[0].length > 12 ? ', …' : ''}.`,
      ],
    };
  }

  /** The first non-empty value among the columns that can supply this field. */
  const cell = (row: string[], field: FieldName): string | null => {
    for (const i of columnsFor[field] ?? []) {
      const value = blankToNull(row[i]);
      if (value !== null) return value;
    }
    return null;
  };

  /** Reads an optional number, recording an error for one that is present and unreadable. */
  const optionalNumber = (
    row: string[],
    field: FieldName,
    label: string,
    errors: string[],
    options: { allowZero?: boolean } = {}
  ): number | null => {
    const raw = cell(row, field);
    if (raw === null) return null;
    const n = parseNumber(raw);
    if (n === null) {
      errors.push(`${label} "${raw}" is not a number.`);
      return null;
    }
    if (n < 0) {
      errors.push(`${label} ${n} is negative.`);
      return null;
    }
    if (n === 0 && !options.allowZero) return null;
    return n;
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

    /*
     * A zero in a price or cost column is "not supplied", not a price of
     * nothing: the export writes 0 as well as NULL for an unset figure (it did
     * on PRICE_TRANSFER). Zero is therefore read as absent, and a cost of zero
     * can never become a margin.
     */
    const listPrice = optionalNumber(row, 'listPrice', 'List price', errors);
    const cost = optionalNumber(row, 'cost', 'Cost', errors);
    const requestedResalePrice = optionalNumber(row, 'requestedResalePrice', 'Requested resale price', errors);
    const requestedDistributorPrice = optionalNumber(
      row,
      'requestedDistributorPrice',
      'Requested distributor price',
      errors
    );
    const moq = optionalNumber(row, 'moq', 'Minimum order quantity', errors);

    /* Lines Channel Partners itself has withdrawn must not be priced. */
    let withdrawn = false;
    if (isFlagSet(cell(row, 'isDeleted'))) {
      errors.push('Deleted in Channel Partners.');
      withdrawn = true;
    }
    if (isFlagSet(cell(row, 'isInactive'))) {
      errors.push('Marked inactive in Channel Partners.');
      withdrawn = true;
    }
    if (isFlagSet(cell(row, 'isRejected'))) {
      errors.push('Rejected in Channel Partners.');
      withdrawn = true;
    }

    const currency = cell(row, 'currency');

    lines.push({
      rowNumber,
      partNumber,
      altPartNumber: cell(row, 'altPartNumber'),
      description: cell(row, 'description'),
      quantity: quantity !== null && quantity > 0 && Number.isInteger(quantity) ? quantity : null,
      moq: moq !== null && Number.isInteger(moq) ? moq : null,
      listPrice,
      cost,
      requestedResalePrice,
      requestedDistributorPrice,
      productLine: cell(row, 'productLine'),
      region: cell(row, 'region'),
      currency: currency === null ? null : currency.toUpperCase(),
      itemId: cell(row, 'itemId'),
      requestId: cell(row, 'requestId'),
      customer: cell(row, 'customer'),
      outcome: cell(row, 'outcome'),
      withdrawn,
      errors,
    });
  });

  const currencies = [...new Set(lines.map((l) => l.currency).filter((c): c is string => !!c))];

  return {
    lines,
    matchedHeaders,
    missingRequired: [],
    unmappedHeaders,
    delimiter,
    currency: currencies.length === 1 ? currencies[0] : null,
    mixedCurrencies: currencies.length > 1 ? currencies : [],
    linesWithOutcome: lines.filter((l) => l.outcome !== null).length,
    fatal: [],
  };
}

/**
 * The request identifier, if the file carried one and agreed with itself.
 *
 * Only an explicit request column is read. The export's per-line key is
 * ITEMID, carried on each line, which is what has to come back; grouping
 * lines into a request is not guessed from some other column.
 *
 * A file carrying two different identifiers is a sign the export merged two
 * requests, which is worth refusing rather than guessing at.
 */
export function requestIdOf(form: ParsedForm): { id: string | null; conflict: string[] } {
  const ids = [...new Set(form.lines.map((l) => l.requestId).filter((v): v is string => !!v))];
  if (ids.length === 0) return { id: null, conflict: [] };
  if (ids.length === 1) return { id: ids[0], conflict: [] };
  return { id: null, conflict: ids };
}
