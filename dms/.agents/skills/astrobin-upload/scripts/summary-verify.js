'use strict';

/**
 * AstroBin's acquisition **Summary** block is the authoritative record of what
 * landed: it aggregates frames per filter, so AstroBin's date re-sort of the
 * imported rows cannot shift the answer. This module compares that summary with
 * the CSV rows we intended to import.
 *
 * `groups` is what AstroBin renders: `{ label, frames, duration }` per line of
 * `table.acquisition-summary-table` ("Baader UV/IR Cut / Luminance 36 mm",
 * "158 × 300s"). `rows` is our CSV intent: `{ filter, number, duration }`.
 */

/** Letter -> words that identify the filter in AstroBin's equipment names. */
const FILTER_MATCHERS = {
  H: /h[\s-]?alpha|\bha\b|hydrogen/i,
  O: /o[\s-]?iii|\bo3\b|oxygen/i,
  S: /s[\s-]?ii|\bs2\b|sulfur|sulphur/i,
  L: /luminance|\blum\b|\bl\b|clear|uv\/ir/i,
  R: /red/i,
  G: /green/i,
  B: /blue/i,
};

const FILTER_LABELS = {
  L: 'Luminance',
  R: 'Red',
  G: 'Green',
  B: 'Blue',
  H: 'Ha',
  O: 'OIII',
  S: 'SII',
};

const BLANK_FILTER = /^(select\.\.\.|optional|[^a-z0-9]*)$/i;

// AstroBin abbreviates filter names in the Summary: "UV/IR Cut", "B", "G", "R".
const SINGLE_LETTER = { b: 'B', g: 'G', r: 'R', l: 'L', h: 'H', o: 'O', s: 'S' };

/** Which filter letter an AstroBin equipment label corresponds to. */
function letterOfLabel(label, matchers = FILTER_MATCHERS) {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  if (!text || BLANK_FILTER.test(text)) return null;
  // A bare letter is AstroBin's own abbreviation for that filter.
  const single = SINGLE_LETTER[text.toLowerCase()];
  if (single) return single;
  for (const letter of Object.keys(matchers)) {
    if (matchers[letter].test(text)) return letter;
  }
  return null;
}

function fmtSeconds(total) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total - h * 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Compare the imported intent with AstroBin's summary. Returns
 * `{ ok, problems, expFrames, expSeconds, gotFrames, gotSeconds }`.
 * Every check is position-independent: AstroBin re-sorts rows by date, so
 * per-row positional checks are the thing this replaces.
 */
function verifyAcquisitionSummary(rows, groups, matchers = FILTER_MATCHERS) {
  const expFrames = rows.reduce((n, r) => n + r.number, 0);
  const expSeconds = rows.reduce((n, r) => n + r.number * r.duration, 0);
  const gotFrames = groups.reduce((n, g) => n + g.frames, 0);
  const gotSeconds = groups.reduce((n, g) => n + g.frames * g.duration, 0);

  const problems = [];
  if (gotFrames !== expFrames) {
    problems.push(`frame total ${gotFrames} in AstroBin vs ${expFrames} in the CSV`);
  }
  if (Math.abs(gotSeconds - expSeconds) > 1) {
    problems.push(`integration ${fmtSeconds(gotSeconds)} in AstroBin vs ${fmtSeconds(expSeconds)} in the CSV`);
  }

  const want = new Map();
  for (const r of rows) {
    const letter = r.filter || null;
    const key = letter || 'none';
    want.set(key, (want.get(key) || 0) + r.number);
  }
  const got = new Map();
  for (const g of groups) {
    const letter = letterOfLabel(g.label, matchers);
    if (!letter) {
      problems.push(`summary line "${g.label}" names no known filter (${g.frames} frames)`);
      continue;
    }
    got.set(letter, (got.get(letter) || 0) + g.frames);
  }

  for (const [key, n] of want) {
    if (key === 'none') {
      if (n) problems.push(`${n} CSV row frame(s) have no filter letter`);
      continue;
    }
    const g = got.get(key) || 0;
    if (g !== n) {
      problems.push(`${FILTER_LABELS[key] || key}: ${g} frame(s) in AstroBin vs ${n} in the CSV`);
    }
  }
  for (const [key, n] of got) {
    if (!want.has(key)) {
      problems.push(`AstroBin has a ${FILTER_LABELS[key] || key} group (${n} frames) no CSV row asked for`);
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    expFrames,
    expSeconds,
    gotFrames,
    gotSeconds,
  };
}

module.exports = { verifyAcquisitionSummary, letterOfLabel, FILTER_MATCHERS, FILTER_LABELS, fmtSeconds };
