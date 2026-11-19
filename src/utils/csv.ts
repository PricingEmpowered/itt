/**
 * A CSV reader that handles the cases a split on commas does not.
 *
 * Written rather than added as a dependency because the parsing rules are
 * small and fixed, and because this application is installed on an internal
 * ITT server where every dependency is one more thing to review and patch.
 * The whole specification is: fields separated by commas, rows by newlines,
 * and a field may be wrapped in double quotes - inside which commas,
 * newlines and doubled quotes are literal.
 *
 * That last part is the reason this file exists. A part number like
 * "BRACKET, 3/4 IN" or a description carrying a comma is ordinary in an
 * engineering catalogue, and splitting on commas turns one line into two
 * fields and then into a quote with a wrong quantity.
 */

export interface CsvOptions {
  /** Field separator. Tab for .tsv, semicolon for some European exports. */
  delimiter?: string;
}

/**
 * Parses CSV text into rows of raw string fields. Nothing is trimmed,
 * coerced or interpreted here: that belongs to whatever knows the column
 * meanings.
 *
 * A trailing newline does not produce a final empty row, but a genuine blank
 * line in the middle does, because losing it would silently shift row
 * numbers in any error message that follows.
 */
export function parseCsv(text: string, options: CsvOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ',';

  /* Excel writes a UTF-8 BOM. Left in place it becomes part of the first header. */
  let input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  /* Normalise line endings so a CRLF file does not leave \r on every last field. */
  input = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      fieldWasQuoted = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = '';
      fieldWasQuoted = false;
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldWasQuoted = false;
      continue;
    }

    field += ch;
  }

  /*
   * The last field only becomes a row if there is something to record. A file
   * ending in a newline has already pushed its final row; one ending mid-field
   * has not.
   */
  if (field !== '' || fieldWasQuoted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Reads a number the way a spreadsheet exports one.
 *
 * Accepts thousands separators, a leading currency symbol, surrounding
 * whitespace, and accounting negatives in parentheses. Returns null rather
 * than NaN or 0 for anything it cannot read, because on a quote screen a
 * zero that should have been "unreadable" is a price.
 */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.trim();
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  /* Strip currency symbols, spaces and thousands separators, keep sign and point. */
  s = s.replace(/[^0-9.\-+]/g, '');
  if (s === '' || s === '-' || s === '+' || s === '.') return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
