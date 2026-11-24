#!/usr/bin/env node
'use strict';

/**
 * Unit tests for the Summary verdict (summary-verify.js).
 *
 * The cases are taken from real AstroBin output: LBN762's Summary as it
 * rendered, plus the failure modes the check must catch.
 */

const { verifyAcquisitionSummary, letterOfLabel } = require('./summary-verify.js');

let pass = 0;
let fail = 0;

function check(name, rows, groups, ok) {
  const v = verifyAcquisitionSummary(rows, groups);
  const got = v.ok;
  const good = got === ok;
  if (good) {
    pass++;
    console.log(`PASS ${name}${ok ? '' : ` (rejected: ${v.problems[0]})`}`);
  } else {
    fail++;
    console.log(`FAIL ${name}: expected ok=${ok}, got ${got} — ${v.problems.join('; ')}`);
  }
}

// LBN762 as AstroBin reported it: 14 rows, L(Baader UV/IR Cut/Luminance) 158,
// B 22, G 21, R 20 — the run that the old per-row check aborted on.
const lbn = [
  { date: '2024-11-04', filter: 'L', number: 6, duration: 300 },
  { date: '2024-11-07', filter: 'B', number: 4, duration: 300 },
  { date: '2024-11-07', filter: 'G', number: 3, duration: 300 },
  { date: '2024-11-07', filter: 'L', number: 46, duration: 300 },
  { date: '2024-11-07', filter: 'R', number: 3, duration: 300 },
  { date: '2026-10-06', filter: 'L', number: 10, duration: 300 },
  { date: '2026-10-06', filter: 'L', number: 10, duration: 300 },
  { date: '2026-10-06', filter: 'L', number: 6, duration: 300 },
  { date: '2026-10-06', filter: 'L', number: 11, duration: 300 },
  { date: '2026-10-07', filter: 'L', number: 26, duration: 300 },
  { date: '2026-11-08', filter: 'B', number: 18, duration: 300 },
  { date: '2026-11-08', filter: 'G', number: 18, duration: 300 },
  { date: '2026-11-08', filter: 'L', number: 43, duration: 300 },
  { date: '2026-11-08', filter: 'R', number: 17, duration: 300 },
];
const lbnGroups = [
  { label: 'Baader UV/IR Cut / Luminance 36 mm', frames: 158, duration: 300 },
  { label: 'Baader Blue (B-CCD)', frames: 22, duration: 300 },
  { label: 'Baader Green (G-CCD) 36 mm', frames: 21, duration: 300 },
  { label: 'Baader Red (R-CCD)', frames: 20, duration: 300 },
];

check('LBN762 as AstroBin rendered it', lbn, lbnGroups, true);

// 6 rows silently dropped their filter (ids outside the equipment database):
// frames land in the Luminance group, B/G/R counts fall short.
const dropped = [
  lbnGroups[0],
  { label: 'Baader Blue (B-CCD)', frames: 4, duration: 300 },
  { label: 'Baader Green (G-CCD) 36 mm', frames: 3, duration: 300 },
  { label: 'Baader Red (R-CCD)', frames: 3, duration: 300 },
];
check('filter ids dropped, counts short', lbn, dropped, false);

// Totals add up but a count sits on the wrong label (positional slip).
const slipped = [
  lbnGroups[0],
  { label: 'Baader Blue (B-CCD)', frames: 21, duration: 300 },
  { label: 'Baader Green (G-CCD) 36 mm', frames: 22, duration: 300 },
  { label: 'Baader Red (R-CCD)', frames: 20, duration: 300 },
];
check('swapped B/G counts', lbn, slipped, false);

// Luminance listed under its bare UV/IR Cut name.
check('Luminance named UV/IR Cut', lbn, [{ label: 'Baader UV/IR Cut 2"', frames: 158, duration: 300 }, lbnGroups[1], lbnGroups[2], lbnGroups[3]], true);

// An extra filter group AstroBin invented.
check('extra filter group', lbn, [...lbnGroups, { label: 'Optolong L-Pro', frames: 10, duration: 300 }], false);

// One frame missing from the totals.
check('one frame short', lbn, [{ label: 'Baader UV/IR Cut / Luminance 36 mm', frames: 157, duration: 300 }, lbnGroups[1], lbnGroups[2], lbnGroups[3]], false);

// A CSV row with no filter letter: the blank column the abort is meant to stop.
check('row with no filter letter', [...lbn.slice(0, 13), { date: '2026-11-08', number: 17, duration: 300 }], lbnGroups, false);

// Summary line naming nothing recognisable.
check('unrecognised filter label', lbn, [lbnGroups[0], lbnGroups[1], lbnGroups[2], { label: 'Select...', frames: 20, duration: 300 }], false);

// Narrowband run, with L split across two durations.
const narrow = [
  { date: '2026-11-08', filter: 'H', number: 20, duration: 300 },
  { date: '2026-11-08', filter: 'O', number: 15, duration: 300 },
  { date: '2026-11-08', filter: 'S', number: 10, duration: 600 },
  { date: '2026-11-09', filter: 'S', number: 5, duration: 300 },
];
const narrowGroups = [
  { label: 'Optolong H-alpha 3nm', frames: 20, duration: 300 },
  { label: 'Optolong OIII 3nm', frames: 15, duration: 300 },
  { label: 'Optolong SII 3nm', frames: 10, duration: 600 },
  { label: 'Optolong SII 3nm', frames: 5, duration: 300 },
];
check('narrowband with two durations', narrow, narrowGroups, true);

// letterOfLabel is what the repair pass relies on.
const labels = [
  ['Baader UV/IR Cut / Luminance 36 mm', 'L'],
  ['Luminance', 'L'],
  ['Baader Blue (B-CCD)', 'B'],
  ['Baader Green (G-CCD) 36 mm', 'G'],
  ['Baader Red (R-CCD)', 'R'],
  ['Optolong H-alpha 3nm', 'H'],
  ['Optolong OIII 3nm', 'O'],
  ['Optolong SII 3nm', 'S'],
  ['Select...', null],
  ['', null],
  ['Bortle', null],
  // AstroBin abbreviates the Summary labels to bare letters (observed live).
  ['B', 'B'],
  ['G', 'G'],
  ['R', 'R'],
  ['L', 'L'],
  ['H', 'H'],
  ['O', 'O'],
  ['S', 'S'],
  ['UV/IR Cut', 'L'],
];
for (const [label, want] of labels) {
  const got = letterOfLabel(label);
  if (got === want) {
    pass++;
    console.log(`PASS letterOfLabel(${JSON.stringify(label)}) = ${got}`);
  } else {
    fail++;
    console.log(`FAIL letterOfLabel(${JSON.stringify(label)}) = ${got}, want ${want}`);
  }
}

// The Summary exactly as AstroBin rendered it for LBN762, with abbreviated
// labels: the verdict must accept it (the run that the per-row check aborted).
const abbreviated = [
  { label: 'UV/IR Cut', frames: 158, duration: 300 },
  { label: 'B', frames: 22, duration: 300 },
  { label: 'G', frames: 21, duration: 300 },
  { label: 'R', frames: 20, duration: 300 },
];
check('abbreviated Summary labels', lbn, abbreviated, true);

// Abbreviated labels with a count on the wrong one.
check('abbreviated, one count on the wrong letter', lbn, [abbreviated[0], { label: 'B', frames: 21, duration: 300 }, { label: 'G', frames: 22, duration: 300 }, abbreviated[3]], false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
