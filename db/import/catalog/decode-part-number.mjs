#!/usr/bin/env node
/*
 * Decode an ITT Cannon micro-D part number into its attributes.
 *
 * ## Why
 *
 * Section 5 of the target pricing specification fits a list-price model on
 * configured-part attributes: series and shell size for the base, plating and
 * contact type as cost adders, high-temperature and similar as value adders,
 * and a per-contact increment. None of those are columns in any extract ITT
 * has supplied -- the item master carries a part number, a description and
 * four family levels, and nothing else.
 *
 * They are, however, encoded in the part number itself. The catalog publishes
 * the grammar, so the attributes can be recovered rather than keyed by hand
 * across the catalogue. That is the difference between section 5 being a few
 * weeks of work and being a data-entry project.
 *
 * ## Scope
 *
 * Micro-D only (MDM, MDLM and their RoHS-prefixed forms). MM38999, which is
 * three of the four parts in the quote sample, is a different product family
 * with its own catalog and is not covered.
 *
 * ## Reading a part number
 *
 * Part numbers appear both dash-separated (MDM-25-P-H-003-M2-A174-F222) and
 * compact (MDM-37SSM5-A174), so segments are consumed positionally from the
 * remaining text rather than by splitting on dashes alone.
 *
 * Usage:
 *   node db/import/catalog/decode-part-number.mjs MDM-37SSM5-A174
 *   node db/import/catalog/decode-part-number.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GRAMMAR = JSON.parse(readFileSync(path.join(HERE, 'micro-d-grammar.json'), 'utf8'));

/** Longest-first so M5 is preferred over M, and A174 over A. */
function codesByLength(dimension) {
  return Object.keys(GRAMMAR.dimensions[dimension].values)
    .filter((k) => k !== '')
    .sort((a, b) => b.length - a.length);
}

export function decodePartNumber(raw) {
  const input = String(raw ?? '').trim().toUpperCase();
  if (!input) return { ok: false, reason: 'empty part number' };

  /* RoHS is a prefix on the series, not a segment. */
  const rohs = /^R(MDM|MDLM)/.test(input);
  let rest = input.replace(/^R(?=MDM|MDLM)/, '');

  const series = Object.keys(GRAMMAR.series)
    .sort((a, b) => b.length - a.length)
    .find((s) => rest.startsWith(s));
  if (!series) {
    return { ok: false, reason: `no known micro-D series prefix (have ${Object.keys(GRAMMAR.series).join(', ')})` };
  }

  rest = rest.slice(series.length).replace(/^-/, '');
  const attributes = { series, rohs_compliant: rohs };
  const unparsed = [];

  for (const dim of GRAMMAR.series[series].pattern) {
    rest = rest.replace(/^-/, '');
    if (!rest) break;
    const spec = GRAMMAR.dimensions[dim];
    /* A pattern may name a dimension the grammar does not define yet. */
    if (!spec) continue;

    if (spec.kind === 'numeric') {
      const m = rest.match(/^(\d+)/);
      if (!m) continue;
      const n = Number(m[1]);
      /* A constrained numeric must be one of the published values; a stray
       * number is more likely the next field than an unlisted size. A `free`
       * numeric (a termination modification code) takes whatever is there. */
      if (!spec.free && spec.values && !spec.values.includes(n)) continue;
      attributes[dim] = n;
      rest = rest.slice(m[1].length);
      continue;
    }

    const code = codesByLength(dim).find((c) => rest.startsWith(c));
    if (!code) continue;
    attributes[dim] = code;
    attributes[`${dim}_description`] = spec.values[code];
    rest = rest.slice(code.length);
  }

  if (rest.replace(/^-/, '')) unparsed.push(rest.replace(/^-/, ''));

  /* Shell finish is the field the commodity restatement in spec 2.3 needs. */
  const indexed = GRAMMAR.dimensions.shell_finish.commodity_indexed;
  if (attributes.shell_finish && indexed[attributes.shell_finish]) {
    attributes.commodity_exposure = indexed[attributes.shell_finish];
  }

  return { ok: true, input, attributes, unparsed: unparsed.length ? unparsed : null };
}

const SELF_TEST = [
  ['MDM-37SSM5-A174', { series: 'MDM', contact_arrangement: 37, contact_type: 'S', termination_type: 'S', hardware: 'M5', shell_finish: 'A174' }],
  ['MDM-25-P-H-003-M2-A174-F222', { series: 'MDM', contact_arrangement: 25, contact_type: 'P', termination_type: 'H', hardware: 'M2', shell_finish: 'A174', mod_code: 'F222' }],
  ['RMDM-51-S-S-B-A172', { series: 'MDM', rohs_compliant: true, contact_arrangement: 51, contact_type: 'S', shell_finish: 'A172' }],
  ['MDLM-25-P-6-P-Y-18-L-A174-F222', { series: 'MDLM', contact_arrangement: 25, contact_type: 'P', wire_gauge: '6', wire_type: 'P', wire_color: 'Y', hardware: 'L', shell_finish: 'A174', mod_code: 'F222' }],
  ['MM38999-12S-20188', null],
];

if (process.argv.includes('--self-test')) {
  let failures = 0;
  for (const [pn, expected] of SELF_TEST) {
    const got = decodePartNumber(pn);
    if (expected === null) {
      const pass = !got.ok;
      console.log(`${pass ? 'ok  ' : 'FAIL'}  ${pn.padEnd(32)} correctly rejected: ${got.reason ?? 'ACCEPTED'}`);
      if (!pass) failures++;
      continue;
    }
    const bad = Object.entries(expected).filter(([k, v]) => got.attributes?.[k] !== v);
    console.log(`${bad.length ? 'FAIL' : 'ok  '}  ${pn.padEnd(32)} ${bad.length ? JSON.stringify(bad) : JSON.stringify(got.attributes)}`);
    if (bad.length) failures++;
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
  process.exit(failures ? 1 : 0);
} else if (process.argv[2]) {
  console.log(JSON.stringify(decodePartNumber(process.argv[2]), null, 2));
}
