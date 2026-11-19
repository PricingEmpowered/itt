/**
 * Checks on the CSV reader and the Channel Partners form mapping.
 *
 *   npx tsx scripts/check-quote-upload.ts
 *
 * The upload decides what a quote contains, so a parsing slip becomes a
 * wrong quantity or a wrong price on a document sent to a customer. These
 * run the cases a naive split on commas gets wrong, and the validation rules
 * that stop an unreadable value becoming a plausible default.
 */

import assert from 'node:assert/strict';
import { parseCsv, parseNumber } from '../src/utils/csv';
import { parseChannelPartnersForm, requestIdOf } from '../src/utils/channelPartnersForm';

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${(e as Error).message.split('\n')[0]}`);
  }
}

console.log('\ncsv reader');

check('plain rows', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

check('a quoted field keeps its commas', () => {
  const rows = parseCsv('part,qty\n"BRACKET, 3/4 IN",5');
  assert.deepEqual(rows[1], ['BRACKET, 3/4 IN', '5']);
});

check('a quoted field keeps its newlines', () => {
  const rows = parseCsv('a,b\n"line one\nline two",2');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], 'line one\nline two');
});

check('doubled quotes are one literal quote', () => {
  const rows = parseCsv('a\n"he said ""no"""');
  assert.equal(rows[1][0], 'he said "no"');
});

check('CRLF leaves no carriage return on the last field', () => {
  const rows = parseCsv('a,b\r\n1,2\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});

check('a UTF-8 BOM does not become part of the first header', () => {
  const rows = parseCsv('\uFEFFpart,qty\nX,1');
  assert.equal(rows[0][0], 'part');
});

check('a trailing newline does not add an empty row', () => {
  assert.equal(parseCsv('a,b\n1,2\n').length, 2);
});

check('a blank row in the middle is kept, so row numbers hold', () => {
  const rows = parseCsv('a,b\n1,2\n\n3,4');
  assert.equal(rows.length, 4);
});

check('an empty quoted field is a field', () => {
  assert.deepEqual(parseCsv('a,""'), [['a', '']]);
});

console.log('\nnumber reading');

check('thousands separators and currency symbols', () => {
  assert.equal(parseNumber('$1,234.56'), 1234.56);
});
check('accounting negatives', () => {
  assert.equal(parseNumber('(45.00)'), -45);
});
check('surrounding whitespace', () => {
  assert.equal(parseNumber('  12  '), 12);
});
check('unreadable values are null, never zero', () => {
  for (const v of ['', 'abc', '-', '.', 'N/A', null, undefined]) {
    assert.equal(parseNumber(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

console.log('\nheader matching');

const GOOD = [
  'Part No.,Description,Qty,List Price,Unit Cost,Request ID',
  'ABC-123,Widget,10,100.00,60.00,RQ-9001',
  'DEF-456,"Bracket, 3/4 IN",5,250.00,150.00,RQ-9001',
].join('\n');

check('headers match regardless of case, spacing and punctuation', () => {
  const f = parseChannelPartnersForm(GOOD);
  assert.deepEqual(f.fatal, []);
  assert.equal(f.matchedHeaders.partNumber, 'Part No.');
  assert.equal(f.matchedHeaders.quantity, 'Qty');
  assert.equal(f.matchedHeaders.listPrice, 'List Price');
  assert.equal(f.matchedHeaders.cost, 'Unit Cost');
});

check('values come through', () => {
  const f = parseChannelPartnersForm(GOOD);
  assert.equal(f.lines.length, 2);
  assert.equal(f.lines[0].partNumber, 'ABC-123');
  assert.equal(f.lines[0].quantity, 10);
  assert.equal(f.lines[0].listPrice, 100);
  assert.equal(f.lines[0].cost, 60);
  assert.equal(f.lines[1].description, 'Bracket, 3/4 IN');
});

check('a file with no part number column is rejected, not half-read', () => {
  const f = parseChannelPartnersForm('Thing,Qty\nX,1');
  assert.deepEqual(f.missingRequired, ['partNumber']);
  assert.equal(f.lines.length, 0);
  assert.ok(f.fatal[0].includes('partNumber'));
});

check('unrecognised headers are reported rather than ignored silently', () => {
  const f = parseChannelPartnersForm('Part,Qty,Ship Date\nX,1,2026-01-01');
  assert.deepEqual(f.unmappedHeaders, ['Ship Date']);
});

check('an empty file is rejected', () => {
  assert.ok(parseChannelPartnersForm('').fatal.length > 0);
});

console.log('\nrow validation');

check('an unreadable quantity is an error, not a 1', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,many');
  assert.equal(f.lines[0].quantity, null);
  assert.ok(f.lines[0].errors.some((e) => e.includes('not a number')));
});

check('a fractional quantity is an error', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,2.5');
  assert.equal(f.lines[0].quantity, null);
  assert.ok(f.lines[0].errors.some((e) => e.includes('whole number')));
});

check('a zero or negative quantity is an error', () => {
  for (const q of ['0', '-3']) {
    const f = parseChannelPartnersForm(`Part,Qty\nABC,${q}`);
    assert.equal(f.lines[0].quantity, null, `quantity ${q}`);
    assert.ok(f.lines[0].errors.some((e) => e.includes('greater than zero')));
  }
});

check('an unreadable list price is an error, not a 0', () => {
  const f = parseChannelPartnersForm('Part,Qty,List Price\nABC,1,TBD');
  assert.equal(f.lines[0].listPrice, null);
  assert.ok(f.lines[0].errors.some((e) => e.includes('List price')));
});

check('a missing list price is allowed and silent', () => {
  const f = parseChannelPartnersForm('Part,Qty,List Price\nABC,1,');
  assert.equal(f.lines[0].listPrice, null);
  assert.deepEqual(f.lines[0].errors, []);
});

check('bad rows are kept so the line count matches the file', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,1\nDEF,oops\nGHI,3');
  assert.equal(f.lines.length, 3);
  assert.equal(f.lines[1].errors.length, 1);
});

check('row numbers match what a person sees in the spreadsheet', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,1\n\nDEF,bad');
  assert.equal(f.lines[0].rowNumber, 2);
  assert.equal(f.lines[1].rowNumber, 4, 'the blank row must still consume a number');
});

check('blank padding rows are dropped', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,1\n\n\n');
  assert.equal(f.lines.length, 1);
});

console.log('\nrequest identifier');

check('one identifier is carried', () => {
  assert.equal(requestIdOf(parseChannelPartnersForm(GOOD)).id, 'RQ-9001');
});

check('no identifier is null, not an error', () => {
  const f = parseChannelPartnersForm('Part,Qty\nABC,1');
  assert.deepEqual(requestIdOf(f), { id: null, conflict: [] });
});

check('two identifiers in one file are reported as a conflict', () => {
  const f = parseChannelPartnersForm('Part,Qty,Request ID\nA,1,RQ-1\nB,2,RQ-2');
  const r = requestIdOf(f);
  assert.equal(r.id, null);
  assert.deepEqual(r.conflict, ['RQ-1', 'RQ-2']);
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
