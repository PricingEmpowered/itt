/**
 * Checks on reading a margin table pasted from a spreadsheet.
 *
 *   npx tsx scripts/check-margin-table.ts
 *
 * The first block runs ITT's table as it was supplied, so the behaviour on
 * their real data is pinned: which cells load, and which are held back
 * because they are not percentages.
 */

import assert from 'node:assert/strict';
import { parseMarginTable, readPercent } from '../src/utils/marginTable';

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

/* Entered as cells and joined with real tabs, so the fixture survives any editor. */
const ITT: Array<[string, string, string]> = [
  ['38999 Series I, II, and III', '57.0%', 'US'],
  ['AD', '71.9%', 'Asia'],
  ['Audio', 'Asia', 'Asia'],
  ['CA Bayonet', 'Europe', '35.0%'],
  ['CLC SLC SLE', 'Asia', 'Asia'],
  ['D_Sub', '57.6%', '36.0%'],
  ['DL', 'Asia', 'Asia'],
  ['EV', '20.0%', '25.0%'],
  ['Fiber Optics', '51.0%', 'US'],
  ['Filters', '23.0%', 'US'],
  ['HDX', '20.1%', 'US'],
  ['Hermetics', '43.1%', 'US'],
  ['High Frequency Specials', '89.2%', 'US'],
  ['IT Series', '25.0%', '25.0%'],
  ['Micros', '53.8%', 'US'],
  ['MIL-DTL 26482 Series I & Mil Battery', '20.1%', '28.0%'],
  ['MIL-DTL 5015 Firewall', '52.3%', 'US'],
  ['MIL-DTL 5015 Series I', '27.2%', '37.0%'],
  ['Nemesis', '35.0%', 'US'],
  ['PV/CV/KPD', '69.2%', 'US'],
  ['QLC', 'Asia', 'US'],
  ['Quadrax', '62.0%', 'US'],
  ['Rack and Panel', '51.4%', 'US'],
  ['RF', '37.8%', 'US'],
  ['Space and Specials', '45.5%', 'US'],
  ['Trident', 'Europe', '45.0%'],
  ['Trinity MKJ', '29.0%', '35.0%'],
  ['Universal Contact', 'Asia', 'Asia'],
  ['Veam Cir, FRCIR', '57.0%', '40.0%'],
  ['Veam Others', 'Europe', '40.0%'],
  ['Veam Powerlock & Snaplock', '47.2%', '35.0%'],
  ['Veam PT', '47.0%', '35.0%'],
  ['Veam VBN', 'Europe', '25.0%'],
  ['Vector APD Harness Others', '54.0%', '45.0%'],
];

const ITT_TEXT = [
  'Budget Margin',
  ['Product Line', 'North America', 'Europe'].join('\t'),
  ...ITT.map((r) => r.join('\t')),
].join('\n');

console.log("\nITT's table, as supplied");

check('39 figures load and 29 cells are held back', () => {
  const t = parseMarginTable(ITT_TEXT);
  assert.equal(t.fatal, null);
  assert.equal(t.rows.length, 39);
  assert.equal(t.skipped.length, 29);
  assert.equal(t.rows.length + t.skipped.length, ITT.length * 2, 'every cell is accounted for');
});

check('the held-back cells are the region names, and only those', () => {
  const t = parseMarginTable(ITT_TEXT);
  const count = (c: string) => t.skipped.filter((s) => s.cell === c).length;
  assert.equal(count('US'), 15);
  assert.equal(count('Asia'), 10);
  assert.equal(count('Europe'), 4);
});

check('the title line is ignored, and the header sets the columns', () => {
  const t = parseMarginTable(ITT_TEXT);
  assert.equal(t.ignoredLines, 1);
  assert.deepEqual(t.columns, ['North America', 'Europe']);
});

check('figures land in the right region', () => {
  const t = parseMarginTable(ITT_TEXT);
  const find = (pl: string, rg: string) =>
    t.rows.find((r) => r.productLine === pl && r.region === rg)?.marginPercent;
  assert.equal(find('38999 Series I, II, and III', 'North America'), 57);
  assert.equal(find('D_Sub', 'Europe'), 36);
  assert.equal(find('CA Bayonet', 'Europe'), 35);
  assert.equal(find('CA Bayonet', 'North America'), undefined);
  assert.equal(find('High Frequency Specials', 'North America'), 89.2);
});

check('a product line containing a comma is kept whole', () => {
  const t = parseMarginTable(ITT_TEXT);
  assert.ok(t.rows.some((r) => r.productLine === 'Veam Cir, FRCIR'));
});

check('a line with no figures of its own loads nothing, rather than a guess', () => {
  const t = parseMarginTable(ITT_TEXT);
  for (const pl of ['Audio', 'CLC SLC SLE', 'DL', 'Universal Contact', 'QLC']) {
    assert.equal(
      t.rows.filter((r) => r.productLine === pl).length,
      0,
      `${pl} must have no row until ITT supplies its figures`
    );
  }
});

check('a "US" cell does not copy the North America figure across', () => {
  const t = parseMarginTable(ITT_TEXT);
  assert.equal(
    t.rows.find((r) => r.productLine === 'Filters' && r.region === 'Europe'),
    undefined
  );
  const s = t.skipped.find((c) => c.productLine === 'Filters');
  assert.equal(s?.region, 'Europe');
  assert.equal(s?.cell, 'US');
});

console.log('\nreading a percentage');

check('a percent sign is read', () => {
  assert.deepEqual(readPercent('57.0%'), { ok: true, percent: 57 });
  assert.deepEqual(readPercent(' 20% '), { ok: true, percent: 20 });
});

check('a bare number above one is read as a percent', () => {
  assert.deepEqual(readPercent('57'), { ok: true, percent: 57 });
});

check('a bare number below one is refused as ambiguous', () => {
  const r = readPercent('0.57');
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason.includes('ambiguous'));
});

check('but with a percent sign it is read', () => {
  assert.deepEqual(readPercent('0.57%'), { ok: true, percent: 0.57 });
});

check('100% or more, negatives, words and blanks are refused', () => {
  for (const v of ['100%', '150', '-5%', 'Asia', 'n/a', '', '12 percent', '5%%']) {
    assert.equal(readPercent(v).ok, false, JSON.stringify(v));
  }
});

console.log('\nthe paste itself');

check('columns follow the header, not an assumed order', () => {
  const text = ['Line\tEurope\tNorth America', 'Pumps\t41%\t52%'].join('\n');
  const t = parseMarginTable(text);
  assert.equal(t.rows.find((r) => r.region === 'Europe')?.marginPercent, 41);
  assert.equal(t.rows.find((r) => r.region === 'North America')?.marginPercent, 52);
});

check('without a header, the columns are North America then Europe', () => {
  const t = parseMarginTable('Pumps\t41%\t52%');
  assert.equal(t.rows.find((r) => r.region === 'North America')?.marginPercent, 41);
  assert.equal(t.rows.find((r) => r.region === 'Europe')?.marginPercent, 52);
});

check('an Asia column is accepted when it is supplied', () => {
  const t = parseMarginTable(
    ['Line\tNorth America\tEurope\tAsia', 'Pumps\t41%\t52%\t33%'].join('\n')
  );
  assert.equal(t.rows.find((r) => r.region === 'Asia Pacific')?.marginPercent, 33);
});

check('nothing pasted is reported', () => {
  assert.ok(parseMarginTable('  \n ').fatal?.includes('Nothing'));
});

check('a paste with no tabs is refused with the reason', () => {
  const t = parseMarginTable('Pumps,41%,52%');
  assert.ok(t.fatal?.includes('tabs'));
  assert.equal(t.rows.length, 0);
});

check('line numbers point at the pasted line', () => {
  const t = parseMarginTable(['Line\tNorth America\tEurope', 'Pumps\t41%\tUS'].join('\n'));
  assert.equal(t.skipped[0].lineNumber, 2);
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
