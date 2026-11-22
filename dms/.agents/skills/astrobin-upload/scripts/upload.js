#!/usr/bin/env node
'use strict';

/**
 * Upload a finished image to AstroBin as an unlisted staging draft.
 *
 *   upload.js <file> "<title>" [options]
 *   upload.js --resume <image-url-or-id> [--title "<title>"] [options]
 *
 * Options:
 *   --subject <name>          Content subject type (default "Deep sky")
 *   --source <name>           backyard | traveller | remote | external
 *                             (default traveller)
 *   --description <text>      Description for the Basic information step
 *   --description-file <path> Read the description from a file (preferred)
 *   --setup <name>            Override the "Your setups" name derived from
 *                             the inventory telescope
 *   --inventory-root <path>   Inventory root (default /data/Astro/CCD or
 *                             $ASTRO_INVENTORY_ROOT)
 *   --object-dir <path>       Inventory object directory, for --resume
 *   --telescope <name>        Inventory telescope, for --resume
 *   --no-setup                Do not apply a saved setup
 *   --no-acquisition          Do not import acquisition details
 *   --auto-description        Fetch a description from Wikipedia/DuckDuckGo
 *   --llm-description         Rephrase the fetched source text with a
 *                             headless `pi -p` call; accepted only if the
 *                             fact guard matches the source
 *   --llm-model <pattern>     Model for --llm-description (default:
 *                             llama.cpp/swift-1.5-iq2_xs)
 *   --no-brave                Skip the Brave Search API even if BRAVE_API_KEY
 *                             is set (Wikipedia + DuckDuckGo only)
 *   --dry-run                 Print the derived setup/acquisition CSV and exit
 *   --port <n>                DevTools port (default 9222)
 *   --timeout <ms>            Max wait for the file upload (default 900000)
 *
 * Never publishes: the image is left in the staging area for the user.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/** --source value -> [data source card, item in that card's drawer]. */
const SOURCE_LABELS = {
  backyard: ['My own equipment', 'Backyard'],
  traveller: ['My own equipment', 'Traveller'],
  remote: ['My own equipment', 'Remote observatory'],
  hosting: ['External data', 'Amateur hosting facility'],
  public: ['External data', 'Public amateur data'],
  external: ['External data', 'Public amateur data'],
  mix: ['External data', 'Mix of multiple sources'],
  other: ['External data', 'None of the above'],
};

const SUBJECTS = ['Deep sky', 'Solar system', 'Landscape', 'Other'];

/**
 * Inventory telescope directory -> AstroBin "Your setups" name.
 *
 * Inventory dirs (right-hand names in the mapping) are Esprit100, 8RC, 10RC;
 * AstroBin setups are named Esprit, RC8, RC10. Keys must match the directory
 * names under the inventory root, which is what the script derives from the
 * image path.
 */
const SETUP_BY_TELESCOPE = {
  '135mm': '135mm',
  Esprit100: 'Esprit',
  '8RC': 'RC8',
  '10RC': 'RC10',
};

/**
 * Default model for --llm-description. Pinned to the local llama.cpp server so
 * the skill never lands on a rate-limited free tier: pi's configured default is
 * an OpenRouter free model that returns 429 free-models-per-day.
 */
const DEFAULT_LLM_MODEL = 'llama.cpp/swift-1.5-iq2_xs';

/** Source URLs seen during retrieval, printed by --dry-run for fact checking. */
const sourceUrls = new Set();

/** Filter letter -> words used to recognise it in AstroBin's filter dropdown. */
const FILTER_MATCHERS = {
  H: /h[\s-]?alpha|\bha\b|hydrogen/i,
  O: /o[\s-]?iii|\bo3\b|oxygen/i,
  S: /s[\s-]?ii|\bs2\b|sulfur|sulphur/i,
  L: /luminance|\blum\b|\bl\b|clear/i,
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

const DEFAULT_INVENTORY_ROOT =
  process.env.ASTRO_INVENTORY_ROOT || '/data/Astro/CCD';

const STEP_IDS = {
  'Basic information': 'image-stepper-basic-information',
  Content: 'image-stepper-content',
  Equipment: 'image-stepper-equipment',
  Acquisition: 'image-stepper-acquisition',
  Settings: 'image-stepper-settings',
};

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_PATH,
    path.join(__dirname, '..', 'node_modules', 'puppeteer-core'),
    path.join(os.homedir(), '.cache', 'astrobin-upload', 'node_modules', 'puppeteer-core'),
    '/tmp/opencode/astrobin/node_modules/puppeteer-core',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (_) {
      /* try the next location */
    }
  }
  throw new Error(
    'puppeteer-core not found. Install it once with:\n' +
      '  npm install --prefix ~/.cache/astrobin-upload puppeteer-core'
  );
}

function parseArgs(argv) {
  const opts = {
    subject: 'Deep sky',
    source: 'traveller',
    port: 9222,
    timeout: 900000,
    inventoryRoot: DEFAULT_INVENTORY_ROOT,
    doSetup: true,
    doAcquisition: true,
    autoDescription: false,
    llmDescription: false,
    llmModel: null,
    noBrave: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    if (a === '--subject') opts.subject = next();
    else if (a === '--source') opts.source = next().toLowerCase();
    else if (a === '--port') opts.port = Number(next());
    else if (a === '--timeout') opts.timeout = Number(next());
    else if (a === '--title') opts.title = next();
    else if (a === '--resume') opts.resume = next();
    else if (a === '--description') opts.description = next();
    else if (a === '--description-file') opts.descriptionFile = next();
    else if (a === '--setup') opts.setupName = next();
    else if (a === '--inventory-root') opts.inventoryRoot = next();
    else if (a === '--object-dir') opts.objectDir = next();
    else if (a === '--telescope') opts.telescope = next();
    else if (a === '--no-setup') opts.doSetup = false;
    else if (a === '--no-acquisition') opts.doAcquisition = false;
    else if (a === '--auto-description') opts.autoDescription = true;
    else if (a === '--llm-description') opts.llmDescription = true;
    else if (a === '--llm-model') opts.llmModel = next();
    else if (a === '--no-brave') opts.noBrave = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`);
    else positional.push(a);
  }
  if (opts.resume) {
    if (opts.title === undefined && positional.length) opts.title = positional.join(' ');
  } else {
    opts.file = positional[0];
    opts.title = opts.title !== undefined ? opts.title : positional[1];
  }
  if (opts.descriptionFile) {
    opts.description = fs.readFileSync(opts.descriptionFile, 'utf8').trim();
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Inventory: telescope, object and acquisition details --------------------

const pad2 = (n) => String(n).padStart(2, '0');

/** Local date (YYYY-MM-DD) for a FITS DATE-OBS, which is UTC. */
function utcDateToLocal(s) {
  if (!s) return null;
  let iso = String(s).trim().replace(' ', 'T');
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Recursively list files, skipping hidden, master and calibration dirs. */
function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(master|logs|darks|flats|cal|calibration)$/i.test(e.name)) continue;
      walkFiles(full, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/** Parse the first 28 KB of a FITS header into a keyword map. */
function readFitsHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(28800);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const text = buf.subarray(0, n).toString('latin1');
    const map = {};
    for (let i = 0; i + 80 <= text.length; i += 80) {
      const card = text.slice(i, i + 80);
      const key = card.slice(0, 8).trim();
      if (!key || key === 'END') continue;
      if (card[8] !== '=') continue;
      let raw = card.slice(10);
      const slash = raw.indexOf(' /');
      if (slash >= 0) raw = raw.slice(0, slash);
      raw = raw.trim();
      if (raw.startsWith("'")) {
        const end = raw.lastIndexOf("'");
        raw = end > 0 ? raw.slice(1, end) : raw.slice(1);
      }
      map[key] = raw.trim();
    }
    return map;
  } finally {
    fs.closeSync(fd);
  }
}

function parseExposure(value) {
  if (!value) return null;
  const s = String(value).replace(/\s*s$/i, '').trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

/** FITS light frames under an inventory object directory. */
function fitsFrames(objectDir) {
  const rows = [];
  for (const file of walkFiles(objectDir)) {
    if (!/\.(fits|fit|fts)$/i.test(file)) continue;
    let h;
    try {
      h = readFitsHeader(file);
    } catch (_) {
      continue;
    }
    const type = String(h.IMAGETYP || h.FRAME || '').toUpperCase();
    if (type && !type.includes('LIGHT')) continue;
    const duration = numOrNull(h.EXPTIME);
    if (!(duration > 0)) continue;
    const date = utcDateToLocal(h['DATE-OBS']);
    if (!date) continue;
    const rawFilter = String(h.FILTER || '').trim().toUpperCase();
    const letter = rawFilter.slice(0, 1);
    rows.push({
      date,
      filter: /^[LRBGSOH]$/.test(letter) ? letter : null,
      duration,
      binning: intOrNull(h.XBINNING || h.BINNING) || 1,
      gain: numOrNull(h.GAIN),
      sensorCooling: intOrNull(h['CCD-TEMP']),
      iso: intOrNull(h.ISO),
    });
  }
  return rows;
}

/** DSLR/mirrorless frames under an inventory object directory, via exiv2. */
function exifFrames(objectDir) {
  const files = walkFiles(objectDir).filter((f) =>
    /\.(cr3|cr2|nef|arw|dng|raf|orf|jpg|jpeg)$/i.test(f)
  );
  // A frame is often stored twice (RAW + JPG): keep the RAW.
  const byBase = new Map();
  for (const f of files) {
    const base = f.replace(/\.[^.]+$/, '').toLowerCase();
    const raw = !/\.(jpe?g)$/i.test(f);
    const prev = byBase.get(base);
    if (!prev || (raw && !prev.raw)) byBase.set(base, { file: f, raw });
  }
  const list = [...byBase.values()].map((v) => v.file);
  const rows = [];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    let out = '';
    try {
      out = execFileSync(
        'exiv2',
        [
          '-q',
          '-K', 'Exif.Photo.DateTimeOriginal',
          '-K', 'Exif.Photo.ExposureTime',
          '-K', 'Exif.Photo.ISOSpeedRatings',
          ...chunk,
        ],
        { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 }
      );
    } catch (_) {
      continue; // exiv2 missing or unreadable chunk
    }
    const rec = {};
    for (const line of out.split('\n')) {
      const hit = chunk.find((f) => line.startsWith(f + '  '));
      if (!hit) continue;
      const rest = line.slice(hit.length).trim();
      const m = rest.match(/^(\S+)\s+\S+\s+\d+\s+(.*)$/);
      if (!m) continue;
      (rec[hit] || (rec[hit] = {}))[m[1]] = m[2].trim();
    }
    for (const f of chunk) {
      const r = rec[f];
      if (!r) continue;
      const dt = r['Exif.Photo.DateTimeOriginal'];
      const date = dt ? dt.slice(0, 10).replace(/:/g, '-') : null;
      const duration = parseExposure(r['Exif.Photo.ExposureTime']);
      if (!date || !(duration > 0)) continue;
      rows.push({
        date,
        filter: null,
        duration,
        binning: null,
        gain: null,
        sensorCooling: null,
        iso: intOrNull(r['Exif.Photo.ISOSpeedRatings']),
      });
    }
  }
  return rows;
}

/**
 * Group frames into one row per date/filter/binning/gain/cooling/ISO.
 *
 * FITS/EXIF exposure times jitter by a fraction of a second (a "120s" frame
 * may read 120.1 or 121.4), so durations within ~2% of an existing value are
 * merged into one row instead of producing a row per frame.
 */
function aggregateFrames(frames) {
  const groups = new Map();
  for (const r of frames) {
    const groupKey = [
      r.date,
      r.filter || '',
      r.binning ?? '',
      r.gain ?? '',
      r.sensorCooling ?? '',
      r.iso ?? '',
    ].join('|');
    let g = groups.get(groupKey);
    if (!g) {
      g = { base: { ...r, duration: undefined }, durations: new Map() };
      groups.set(groupKey, g);
    }
    let bucket = null;
    for (const d of g.durations.keys()) {
      const tolerance = Math.max(0.05, Math.abs(d) * 0.02);
      if (Math.abs(d - r.duration) <= tolerance) {
        bucket = d;
        break;
      }
    }
    if (bucket === null) {
      // AstroBin accepts up to 4 decimals; keep sub-second exposures non-zero.
      bucket = r.duration >= 10 ? Math.round(r.duration) : Math.round(r.duration * 10000) / 10000;
      g.durations.set(bucket, 0);
    }
    g.durations.set(bucket, g.durations.get(bucket) + 1);
  }

  const rows = [];
  for (const g of groups.values()) {
    for (const [duration, number] of g.durations) {
      rows.push({ ...g.base, duration, number });
    }
  }
  return rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.filter || '').localeCompare(String(b.filter || '')) ||
      a.duration - b.duration
  );
}

/** AstroBin CSV: filter is deliberately omitted, it is set in the UI. */
function acquisitionCsv(rows) {
  const columns = ['date', 'number', 'duration'];
  if (rows.some((r) => r.iso != null)) columns.push('iso');
  if (rows.some((r) => r.binning != null)) columns.push('binning');
  if (rows.some((r) => r.gain != null)) columns.push('gain');
  if (rows.some((r) => r.sensorCooling != null)) columns.push('sensorCooling');
  const lines = [columns.join(',')];
  for (const r of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = r[c];
          return v == null ? '' : String(v);
        })
        .join(',')
    );
  }
  return lines.join('\n');
}

function fmtIntegration(seconds) {
  let s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

/** Derive the inventory context from the image path or explicit options. */
function inventoryContext(opts) {
  if (opts.objectDir) {
    const objectDir = path.resolve(opts.objectDir);
    const telescope = opts.telescope || path.basename(path.dirname(objectDir));
    return { telescope, object: path.basename(objectDir), objectDir };
  }
  if (!opts.file) return null;
  const root = path.resolve(opts.inventoryRoot);
  const rel = path.relative(root, path.resolve(opts.file));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const parts = rel.split(path.sep);
  if (parts.length < 2) return null;
  return {
    telescope: parts[0],
    object: parts[1],
    objectDir: path.join(root, parts[0], parts[1]),
  };
}

/** Scan the inventory and return the setup name plus aggregated rows. */
function scanInventory(opts) {
  const ctx = inventoryContext(opts);
  if (!ctx) return { ctx: null, setup: opts.setupName || null, rows: [] };
  const setup = opts.setupName || SETUP_BY_TELESCOPE[ctx.telescope] || null;

  let frames = [];
  try {
    frames = fitsFrames(ctx.objectDir);
    if (!frames.length) frames = exifFrames(ctx.objectDir);
  } catch (e) {
    console.warn(`warning: could not scan ${ctx.objectDir}: ${e.message}`);
  }
  const rows = aggregateFrames(frames);
  return { ctx, setup, rows };
}

function describeAcquisition(ctx, setup, rows) {
  console.log('');
  console.log('Inventory:', ctx ? `${ctx.telescope}/${ctx.object}` : '(not under inventory root)');
  console.log('AstroBin setup:', setup || '(none — telescope not in the mapping)');
  if (!rows.length) {
    console.log('Acquisition: no light frames found');
    return;
  }
  const total = rows.reduce((sum, r) => sum + r.number * r.duration, 0);
  const byFilter = new Map();
  for (const r of rows) {
    const k = r.filter ? FILTER_LABELS[r.filter] || r.filter : 'No filter';
    const v = byFilter.get(k) || { n: 0, s: 0 };
    v.n += r.number;
    v.s += r.number * r.duration;
    byFilter.set(k, v);
  }
  console.log(
    `Acquisition: ${rows.length} row(s), ${rows.reduce((n, r) => n + r.number, 0)} frame(s), ` +
      fmtIntegration(total)
  );
  for (const [name, v] of byFilter) {
    console.log(`  ${name}: ${v.n} frame(s), ${fmtIntegration(v.s)}`);
  }
}

/**
 * Fetch a short description (5-10 sentences) for an astronomical object.
 *
 * Sources, in order:
 *  1. Wikipedia REST summary — free, no key; deep-sky articles cover object
 *     type, constellation, distance, discovery, and notable facts.
 *  2. Wikipedia opensearch + full-text search, when the object name is not a
 *     Wikipedia title (e.g. "Orion Nebula" -> "Orion Nebula" is a redirect).
 *  3. DuckDuckGo HTML snippets, as a last resort.
 *
 * Returns a plain-text paragraph, or null. This is a best-effort helper: the
 * recommended path is for the agent to run web_search itself and pass
 * --description-file, which gives a curated 5-10 sentence text.
 */

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
        'User-Agent':
          'AstrobinUploadHelper/1.0 (personal astrophotography upload script; contact: local user)',
        ...headers,
      },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url.split('/')[2]} returned ${res.status}`);
  return res.json();
}

/**
 * Split into sentences without breaking decimal numbers: a sentence ends at
 * . / ! / ? that is followed by whitespace (so "2.878 light-years" stays whole).
 */
function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

/** Strip citation markers, HTML entities, stray headings, truncated ellipses. */
function cleanText(text) {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function wikipediaSummary(title) {
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (data.type === 'redirect') return [];
  return splitSentences(cleanText(data.extract || ''));
}

/** Full intro paragraph(s); resolves redirects (M33 -> Triangulum Galaxy). */
async function wikipediaIntro(objectName) {
  const data = await fetchJson(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        titles: objectName,
        redirects: '1',
        prop: 'extracts',
        exintro: '1',
        explaintext: '1',
        format: 'json',
      })
  );
  const pages = data.query?.pages || {};
  const page = Object.values(pages).find((p) => p.extract);
  if (!page) return [];
  const sentences = splitSentences(cleanText(page.extract)).filter(
    (s) => !/^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(s) // drop bare section headings
  );
  return sentences;
}

/**
 * Last resort: DuckDuckGo snippets. Snippets are marketing-heavy, so keep only
 * encyclopedic prose (drop SEO/marketing, credit lines, blog notes) and rank by
 * informativeness, never by count.
 */
/**
 * Brave Search API (needs BRAVE_API_KEY). The llm/context endpoint returns
 * grounding snippets per source, with hostname + URL, which is what grounded
 * generation and the fact guard want. No HTML scraping, so no regex fragility.
 * Rate limit is 1 request/second; the plan is metered ($5 per 1k requests).
 */
async function braveContext(query, known) {
  if (!process.env.BRAVE_API_KEY) return [];
  const data = await fetchJson(
    `https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}`,
    { 'X-Subscription-Token': process.env.BRAVE_API_KEY, Accept: 'application/json' }
  );
  const snippets = [];
  for (const group of (data.grounding && data.grounding.generic) || []) {
    const block = [group.title, ...(group.snippets || [])].join(' ');
    // Identity check: a page about a different catalogue number is not about this
    // object. "Bubble Nebula" is NGC 7635 and also NGC 6822, and the API returns
    // both; grounding on the wrong article is worse than no grounding.
    const found = designations(block);
    if (known && known.length) {
      const foreign = found.filter((d) => !known.includes(d));
      if (foreign.length) continue;
    }
    if (group.url) sourceUrls.add(group.url);
    for (const raw of group.snippets || []) {
      // Strip markdown markers and citation brackets, keep prose intact.
      const text = cleanText(raw.replace(/[#*^]|\[\d+\]/g, ' ').replace(/\s+/g, ' ').trim());
      if (text.length >= 60) snippets.push(text);
    }
  }
  return snippets.slice(0, 12);
}

/** Catalogue numbers in text, normalised without spaces (NGC 7635 -> NGC7635). */
function designations(text) {
  return (String(text).match(/\b(NGC|IC|Sh\s?2|LBN|Messier|M)(\s?\d+[a-z]?)/gi) || [])
    .map((d) => d.replace(/\s+/g, ''));
}

async function duckduckgoSnippets(query) {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
  const html = await res.text();
  const re = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = [];
  for (let m; (m = re.exec(html)); ) {
    const text = cleanText(m[1].replace(/<[^>]*>/g, ''));
    if (text.length < 60) continue;
    // DuckDuckGo truncates snippets with "..."; a truncated snippet is not prose.
    if (/\.\.\.|…/.test(text)) continue;
    // Label-value dumps ("Constellation: Triangulum Designations: ...") are not sentences.
    if (/^(Constellation|Designations|Distance|Apparent Size|Magnitude|Naked Eye):/i.test(text)) continue;
    if (/(explore|learn more|shop|buy|sign up|contact us|read more|capturing the beauty|my observing|credit:|time to image|tips for|stunning|look to the|interactive|table below|search and filter)/i.test(text)) continue;
    if (!/(constellation|galaxy|nebula|cluster|light-?year|discovered|magnitude)/i.test(text)) continue;
    // Rank: encyclopedic answers that name type + constellation + distance first.
    let score = 0;
    if (/constellation/i.test(text)) score += 3;
    if (/light-?year|parsec|pc/i.test(text)) score += 3;
    if (/(discovered|catalogued|designated|classified|spiral|emission|supernova remnant|H ?II|open cluster|planetary nebula)/i.test(text)) score += 2;
    score += Math.min(text.length / 120, 4);
    candidates.push({ text, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 4).map((c) => c.text);
}

/**
 * Normalise an inventory object name for lookup: underscores to spaces, and a
 * compact catalogue number (NGC6946, IC1396, Sh2-158) to its spaced form.
 * "M33" is left as-is: that is the Wikipedia article title; "M 33" is not.
 */
function normalizeObjectName(name) {
  let n = String(name).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  n = n.replace(/\b(NGC|IC|Sh\s?2|LBN)(\d)/gi, '$1 $2');
  return n;
}

/** Sentence-level junk: page furniture, SEO prose, image credits. */
function isJunkSentence(s) {
  return (
    /^(About This Object|About the|What Is It|Complete details|This page contains|This is in reference|Additional resources|Contents|Pictures, altitude|An interactive|Search and filter|Look to the|Naked Eye|Observation guide|Where is)/i.test(s) ||
    /credit:|image of the|time to image|capturing the beauty/i.test(s) ||
    // Site boilerplate: field-label dumps, chart/finder-chart furniture, citation
    // fragments, and sentences that end mid-word (a scrape artefact).
    /The physical distance from Earth|The physical size of the object|A name or catalog number|Charts created using|Limiting magnitudes:|Times are shown for timezone|Please set your location|Retrieved\s+October|Retrieved\s+November|\u2191|\[\d+\]/.test(s) ||
    // A fragment with no terminating punctuation is a truncated scrape, not a sentence.
    /[A-Za-z,)]\s*$/.test(s)
  );
}

/** A result about a veil, a heart, or a bubble is only usable if it is astronomy. */
function isAstronomical(sentences) {
  return sentences.some((s) =>
    /(nebula|galaxy|star cluster|cluster of stars|supernova|constellation|light-?year|parsec|magnitude|catalogued|designated|Messier|NGC|IC\s?\d)/i.test(s)
  );
}

async function describeName(name, opts = {}) {
  const known = designations(name);
  const sources = [
    () => wikipediaIntro(name),
    () => wikipediaSummary(name),
    () => (opts.noBrave ? [] : braveContext(`${name} deep sky object constellation distance discovery`, known)),
    () => duckduckgoSnippets(`${name} deep sky object constellation distance`),
  ];
  let best = [];
  for (const source of sources) {
    try {
      const sentences = ((await source()) || []).filter((s) => !isJunkSentence(s));
      if (!isAstronomical(sentences)) continue;
      if (sentences.length > best.length) best = sentences;
      if (best.length >= 4) return best;
    } catch (_) {
      /* try the next source */
    }
  }
  return best;
}

function descriptionCandidates(ctx, title) {
  const seen = new Set();
  const out = [];
  const push = (name) => {
    const n = normalizeObjectName(name);
    if (!n || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    out.push(n);
  };
  const designations = (text) =>
    (String(text).match(/\b(NGC|IC|Sh\s?2|LBN|Messier|M)(\s?\d+[a-z]?)/gi) || []).map(
      (d) => d.replace(/\s+/g, '')
    );

  for (const d of designations(ctx ? ctx.object : '')) push(d);
  for (const d of designations(title || '')) push(d);
  const nickname = ctx ? ctx.object : null;
  if (nickname) {
    push(nickname);
    // "Veil", "Bubble", "Heart" are common nouns: try them as object names.
    const nick = nickname.trim();
    if (/^[A-Za-z'-]+$/.test(nick) && !/nebula|galaxy|cluster/i.test(nick)) {
      push(`${nick} Nebula`);
      push(`${nick} Galaxy`);
    }
  }
  const bareTitle = (title || '').replace(/^(the|a|an)\s+/i, '').trim();
  if (bareTitle) {
    push(bareTitle);
    // Only append a suffix when the name does not already carry one.
    if (!/nebula|galaxy|cluster|remnant/i.test(bareTitle)) push(`${bareTitle} Nebula`);
  }
  return out;
}

async function fetchAutoDescription(names, opts = {}) {
  const candidates = Array.isArray(names) ? names : [normalizeObjectName(names)];
  let best = [];
  for (const name of candidates) {
    const sentences = await describeName(name, opts);
    if (sentences.length > best.length) best = sentences;
    if (best.length >= 5) break;
  }
  if (best.length < 2) return null;
  const deterministic = best.slice(0, 10).join(' ');
  if (!opts.llmDescription) return { text: deterministic, path: 'deterministic' };

  // The LLM is a phrasing layer over the retrieved source; it is never a fact
  // source, and its output is rejected unless every fact traces back to the source.
  const sourceText = best.join(' ');
  const summary = await llmSummarize(sourceText, candidates[0], opts.llmModel);
  if (!summary) return { text: deterministic, path: 'llm unavailable' };
  const problems = factGuard(summary, sourceText);
  if (problems.length) {
    console.warn(`llm description rejected by fact guard: ${problems.join('; ')}`);
    return { text: deterministic, path: 'llm rejected' };
  }
  return { text: summary, path: 'llm' };
}

/** Run a one-shot, toolless, non-interactive pi call; null on any failure. */
async function llmCall(prompt, model) {
  const args = ['-p', '--no-session', '--no-tools'];
  args.push('--model', model || process.env.PI_MODEL || DEFAULT_LLM_MODEL);
  args.push(prompt);
  try {
    // stdin must be ignored: pi waits for piped stdin when it is a pipe, which
    // stalls the call until the timeout fires.
    const out = execFileSync('pi', args, {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim() || null;
  } catch (e) {
    console.warn(`llm call failed: ${e.code === 'ENOENT' ? 'pi not found on PATH' : e.message}`);
    return null;
  }
}

async function llmSummarize(sourceText, objectName, model) {
  const prompt =
    `Write a 5-10 sentence AstroBin image description for "${objectName}".\n` +
    'Use ONLY facts present in the SOURCE below. Cover object type, constellation,\n' +
    'distance, discoverer + year, and one or two notable facts. If the source lacks\n' +
    'a fact, omit it; emit fewer than 5 sentences if that is all the source supports.\n' +
    'Plain prose, no markdown, no bullets, no marketing language, no facts absent\n' +
    'from the source. Reply with the description text only.\n\nSOURCE:\n' +
    sourceText;
  return llmCall(prompt, model);
}

/** Lowercase, strip number separators, unify unit spellings. */
function normForCompare(s) {
  return String(s)
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/\blight[\s-]?years?\b/g, 'ly')
    .replace(/\bparsecs?\b/g, 'pc')
    .replace(/\bsolar masses\b|\bm☉\b/g, 'msun')
    .replace(/\bkilometres? per second\b|\bkilometers per second\b/g, 'km/s')
    .replace(/\barcminutes?\b|\barc-minutes?\b/g, 'arcmin')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numbers, units and proper nouns the LLM text asserts, checked against source. */
function factGuard(summary, sourceText) {
  const source = normForCompare(sourceText);
  const problems = [];
  const sentences = splitSentences(summary).filter((s) => s.trim());
  if (sentences.length > 10) problems.push(`${sentences.length} sentences (max 10)`);
  if (/```|\*\*|^\s*[-*]\s/m.test(summary)) problems.push('markdown present');

  // Every number the LLM states must appear in the source.
  const sourceNumbers = new Set(
    (source.match(/\d+(?:\.\d+)?/g) || []).map((n) => String(Number(n)))
  );
  for (const n of normForCompare(summary).match(/\d+(?:\.\d+)?/g) || []) {
    if (!sourceNumbers.has(String(Number(n)))) problems.push(`number ${n} not in source`);
  }

  // Spelled-out numbers are facts: verify them against the source numerically.
  const wordNumbers = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, billion: 1e9,
    trillion: 1e12,
  };
  // Source facts can be spelled out too. Scan the source as a word stream with
  // the same maximal-run logic so "nine hundred sixty-seven" yields 967.
  const SCALE = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, trillion: 1e12 };
  function parseNumberRun(run) {
    let total = 0, segment = 0;
    for (const w of run) {
      const v = wordNumbers[w];
      if (SCALE[w]) {
        segment = (segment || 1) * SCALE[w];
        total += segment;
        segment = 0;
      } else {
        segment += v;
      }
    }
    return total + segment;
  }
  function collectNumberValues(text) {
    const values = new Set((text.match(/\d+(?:\.\d+)?/g) || []).map((n) => Number(n)));
    // Split on whitespace AND hyphens so "sixty-seven" participates in a run.
    const tokens = text.toLowerCase().split(/[\s-]+/);
    let k = 0;
    while (k < tokens.length) {
      const run = [];
      while (k < tokens.length && wordNumbers[tokens[k]] !== undefined) {
        run.push(tokens[k]);
        k++;
      }
      if (!run.length) { k++; continue; }
      values.add(parseNumberRun(run));
    }
    return values;
  }
  const sourceValues = collectNumberValues(source);
  const summaryValues = collectNumberValues(normForCompare(summary));
  for (const v of summaryValues) {
    if (!sourceValues.has(v)) problems.push(`number value ${v} not in source`);
  }

  // Proper nouns must be in the source; ordinary English words are not facts, so
  // capitalized function/everyday words are skipped to avoid false rejections.
  const common = new Set(
    ('a an the and or but if then than that this these those it its i you we they he she him her his my our your their me mine ' +
     'is are was were be been being has have had do does did will would can could shall should may might must not no yes of in on at to from by with as for about above below under over into onto out up down off near far per via per each every all any some more most other others such same very too also only just ever never always often sometimes few many little much less least ' +
     'there here when where why how who whom whose which what while after before since until during within without between among across around against along beside beyond because besides thus hence therefore moreover furthermore however nevertheless despite although though so as well further future past current present recent early late annual midnight culmination meridian opposition naked eye telescope optics imaging '  +
     'cataloged catalogued cataloging discovered observed recorded measured named called known called called located lying lying sits sits sits positioned placed appears appear appearing shows shown visible visible observable best observed early late first second third last next previous ' +
     'galaxy galaxies nebulae nebula cluster clusters star stars planet planets object objects deep sky sky night sun moon earth sun moon constellation constellations distance magnitude brightness size surface ' +
     'approximately around about roughly nearly over under with than then once twice three four five six seven eight nine ten hundred thousand million billion trillion ' +
     'new old large small bright faint red blue white yellow black brown young massive giant dwarf northern southern eastern western central southern').split(/\s+/)
  );
  const stop = new Set(['I', 'It', 'NGC', 'IC', 'Messier', 'The', 'This', 'These', 'M']);
  const seen = new Set();
  // Only mid-sentence capitals are treated as claims: sentence-initial capitals
  // are ordinary words that got capitalized by the sentence start.
  for (const token of summary.match(/(?<=[a-z]\s)[A-Z][a-z\u00e0-\u00ff]+(?:'s)?\b/g) || []) {
    const key = token.toLowerCase().replace(/'s$/, '');
    if (stop.has(token) || common.has(key) || wordNumbers[key] !== undefined || seen.has(key)) continue;
    seen.add(key);
    if (!new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(source)) {
      problems.push(`"${token}" not in source`);
    }
  }
  // Designations (NGC 1333, L1450, Barnard 205, Sh2-311) must be in the source.
  for (const d of summary.match(/\b(?:NGC|IC|LBN|Sh\s?2|Barnard|PGC|Messier|M)\s?\d+[a-z]?\b/g) || []) {
    const key = normForCompare(d).replace(/\s+/g, '');
    if (!normForCompare(source).replace(/\s+/g, '').includes(key)) {
      problems.push(`designation "${d}" not in source`);
    }
  }
  return problems;
}

// --- Puppeteer helpers -------------------------------------------------------

/** Click the first element matching `selector` that actually has a box. */
async function clickVisible(page, selector) {
  const box = await page.evaluate((sel) => {
    const els = Array.from(document.querySelectorAll(sel)).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.disabled;
    });
    const el = els[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, selector);
  if (!box || !box.w) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

/** Click the element whose text is exactly `text` (card labels, drawer rows). */
async function clickText(page, text) {
  const box = await page.evaluate((txt) => {
    // Wizard step labels render as "Content*" (the asterisk marks a required
    // step), so exact equality never matches them. Strip trailing stars.
    const norm = (s) => (s || '').replace(/\*+\s*$/, '').trim();
    // Wizard step labels are not leaves: "Content*" is a link wrapping a span +
    // the required-star badge, so a leaf-only search never matches. Take the
    // deepest (smallest) element whose whole text equals the label.
    // Keep only visible matches: Angular keeps template copies in the DOM with
    // zero-size rects, and a smallest-area sort would pick one of those.
    const matches = Array.from(document.querySelectorAll('*')).filter((e) => {
      const r = e.getBoundingClientRect();
      return norm(e.innerText) === txt && r.width > 0 && r.height > 0;
    });
    const leaf = matches.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    })[0];
    if (!leaf) return null;
    const target =
      leaf.closest('a, button, li, [role=option], .list-group-item, .dropdown-item, .icon-picker-card') || leaf;
    target.scrollIntoView({ block: 'center' });
    const r = target.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, text);
  if (!box || !box.w) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

/** Click a visible button/link whose own label is exactly `text`. */
async function clickButtonText(page, text) {
  const box = await page.evaluate((txt) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const candidates = Array.from(
      document.querySelectorAll('button, a, [role=button], .btn, .dropdown-item')
    ).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.disabled && norm(e.innerText).replace(/\*+\s*$/, '') === txt;
    });
    const el = candidates[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, text);
  if (!box || !box.w) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

/** Select an icon-picker card by its first line of text; no-op if selected. */
async function selectCard(page, label) {
  const state = await page.evaluate((lbl) => {
    const card = Array.from(document.querySelectorAll('.icon-picker-card')).find(
      (c) => (c.innerText || '').trim().split('\n')[0].trim() === lbl
    );
    if (!card) return 'missing';
    if (card.classList.contains('selected')) return 'already';
    card.scrollIntoView({ block: 'center' });
    const r = card.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, label);
  if (state === 'missing') throw new Error(`content option "${label}" not found`);
  if (state === 'already') return 'already';
  if (!state.w) throw new Error(`content option "${label}" is not visible`);
  await page.mouse.click(state.x, state.y);
  await sleep(900);
  return 'clicked';
}

async function assertLoggedIn(page) {
  const text = await page.evaluate(() => document.body.innerText);
  if (/^\s*Log in\s*$/m.test(text) && !/Logout/.test(text)) {
    throw new Error('not logged in to AstroBin — log in inside the automated Chrome window and retry');
  }
  if (/captcha|recaptcha/i.test(await page.content())) {
    throw new Error('CAPTCHA on the page — solve it in the window, then retry');
  }
}

/** Click a wizard tab by its label and wait for its step host to be visible. */
async function goToStep(page, label) {
  const ok = await clickText(page, label);
  if (!ok) {
    // A failed match means the wizard is not where we think it is; report the
    // page's real tab labels.
    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('li, a, button'))
        .map((e) => (e.innerText || '').trim().replace(/\s+/g, ' '))
        .filter((t) => t && t.length < 24)
        .slice(0, 25)
    );
    throw new Error(`wizard step "${label}" not found (url=${page.url()}, tabs=[${tabs.join(' | ')}])`);
  }
  const id = STEP_IDS[label];
  if (id) {
    await page
      .waitForFunction(
        (sid) => {
          const el = document.getElementById(sid);
          return !!el && el.getBoundingClientRect().height > 0;
        },
        { timeout: 30000 },
        id
      )
      .catch(() => {});
  }
  await sleep(800);
}

/** Fill the Basic information description editor (Tiptap, CKEditor or textarea). */
async function fillDescription(page, text) {
  if (!text) return;
  const visible = await page.evaluate(() => {
    const el = document.querySelector(
      '#image-description-field .ProseMirror, #image-description-field[contenteditable="true"], textarea#image-description-field, .ck-editor__editable[contenteditable="true"]'
    );
    return !!el && el.getBoundingClientRect().height > 0;
  });
  if (!visible) await goToStep(page, 'Basic information');
  await sleep(800);

  const info = await page.evaluate(() => {
    const ta = document.querySelector('textarea#image-description-field');
    const pm = document.querySelector(
      '#image-description-field .ProseMirror, #image-description-field[contenteditable="true"], astrobin-formly-field-tiptap .ProseMirror'
    );
    const ck = document.querySelector('.ck-editor__editable[contenteditable="true"]');
    const el = ta || pm || ck;
    if (!el) return { kind: 'missing' };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { kind: ta ? 'textarea' : pm ? 'prosemirror' : 'ckeditor', x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (info.kind === 'missing') throw new Error('description editor not found');

  await page.mouse.click(info.x, info.y);
  await sleep(300);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press('Enter');
    if (lines[i]) await page.keyboard.type(lines[i], { delay: 0 });
  }
  await sleep(400);
  console.log(`Description set (${String(text).length} chars).`);
}

/** Apply a saved setup from the Equipment step's "Your setups" picker. */
async function applySetup(page, setupName) {
  await goToStep(page, 'Equipment');
  await sleep(1200);
  if (!(await clickButtonText(page, 'Your setups')) && !(await clickText(page, 'Your setups'))) {
    throw new Error('"Your setups" button not found on the Equipment step');
  }
  await sleep(1800);

  const box = await page.evaluate((name) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(name);
    // Prefer the smallest ancestor that holds both the setup name and an
    // "Apply" button, so we never hit a same-named telescope elsewhere.
    const buttons = Array.from(document.querySelectorAll('button')).filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && norm(b.innerText) === 'apply';
    });
    let best = null;
    for (const btn of buttons) {
      let node = btn.parentElement;
      for (let depth = 0; depth < 12 && node; depth++, node = node.parentElement) {
        if (norm(node.innerText).includes(want)) {
          best = btn;
          break;
        }
      }
      if (best) break;
    }
    if (!best) return null;
    best.scrollIntoView({ block: 'center' });
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, setupName);

  if (!box) throw new Error(`saved setup "${setupName}" not found in the Your setups picker`);
  await page.mouse.click(box.x, box.y);
  await sleep(3000);
  console.log(`Applied setup "${setupName}".`);
}

/** Fill the CSV import modal and import the rows. */
async function importAcquisitionCsv(page, csv) {
  await goToStep(page, 'Acquisition');
  await sleep(1200);

  // The acquisition step has an "Import" button with a dropdown.
  if ((await clickButtonText(page, 'Import')) || (await clickText(page, 'Import'))) {
    await sleep(700);
  } else {
    // Fallback: kebab menu.
    const kebab = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) =>
          b.getBoundingClientRect().height > 0 &&
          (/more options|ellipsis|kebab/i.test(b.title || '') || b.querySelector('.fa-ellipsis'))
      );
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!kebab) throw new Error('acquisition Import menu not found');
    await page.mouse.click(kebab.x, kebab.y);
    await sleep(700);
  }

  if (!(await clickButtonText(page, 'From CSV')) && !(await clickText(page, 'From CSV'))) {
    throw new Error('"From CSV" menu item not found');
  }
  await sleep(1200);

  // Existing sessions trigger a confirmation dialog before the CSV modal.
  const asked = await page.evaluate(() => /about to remove all acquisition sessions/i.test(document.body.innerText));
  if (asked) {
    const ok = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.modal button, .modal .btn')).find((b) =>
        /^(ok|confirm|yes|continue)$/i.test((b.innerText || '').trim())
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!ok) throw new Error('replacement confirmation dialog has no OK button');
    await sleep(1000);
  }

  await page.waitForFunction(() => /Import acquisition sessions from CSV/i.test(document.body.innerText), {
    timeout: 30000,
  });

  const filled = await page.evaluate((text) => {
    const modal = Array.from(document.querySelectorAll('.modal')).find(
      (m) => /Import acquisition sessions from CSV/i.test(m.innerText) && m.getBoundingClientRect().height > 0
    );
    if (!modal) return false;
    const ta = modal.querySelector('textarea');
    if (!ta) return false;
    ta.focus();
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    ta.blur();
    return true;
  }, csv);
  if (!filled) throw new Error('CSV textarea not found');
  await sleep(900);

  const clicked = await page.evaluate(() => {
    const modal = Array.from(document.querySelectorAll('.modal')).find(
      (m) => /Import acquisition sessions from CSV/i.test(m.innerText) && m.getBoundingClientRect().height > 0
    );
    if (!modal) return false;
    const btn = Array.from(modal.querySelectorAll('button')).find(
      (b) => (b.innerText || '').trim() === 'Import' && !b.disabled
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error('CSV Import button not clickable (validation failed?)');

  await page
    .waitForFunction(() => !/Import acquisition sessions from CSV/i.test(document.body.innerText), {
      timeout: 60000,
    })
    .catch(() => {});
  await sleep(1500);
  console.log('Acquisition CSV imported.');
}

/** After import, set each row's filter from the image's equipment filters. */
async function applyAcquisitionFilters(page, rows) {
  const wanted = rows.filter((r) => r.filter).length;
  if (!wanted) return;

  await page
    .waitForFunction(
      () => document.querySelectorAll('.acquisition-table .datatable-body-row').length > 0,
      { timeout: 30000 }
    )
    .catch(() => {});
  const rowCount = await page.evaluate(
    () => document.querySelectorAll('.acquisition-table .datatable-body-row').length
  );
  if (rowCount < rows.length) {
    console.warn(`warning: ${rows.length} CSV row(s) but ${rowCount} acquisition row(s) rendered`);
  }
  // AstroBin re-sorts imported sessions by date, and filter assignment is
  // positional, so rows sharing a date can slip.
  const dates = rows.map((r) => r.date);
  const shared = [...new Set(dates.filter((d, i) => dates.indexOf(d) !== i))];
  if (shared.length) {
    console.warn(
      `warning: ${shared.length} date(s) hold several rows (${shared.join(', ')}). ` +
        'AstroBin re-sorts by date, so verify the filter column after import.'
    );
  }

  for (let i = 0; i < Math.min(rowCount, rows.length); i++) {
    const letter = rows[i].filter;
    if (!letter) continue;
    const ok = await selectFilterInRow(page, i, letter);
    if (!ok) {
      console.warn(`warning: could not set filter ${FILTER_LABELS[letter] || letter} on acquisition row ${i + 1}`);
    }
  }
}

async function selectFilterInRow(page, index, letter) {
  const box = await page.evaluate((idx) => {
    const rows = document.querySelectorAll('.acquisition-table .datatable-body-row');
    const row = rows[idx];
    if (!row) return null;
    const cell = row.querySelector('.acquisition-col--filter') || row;
    const ng = cell.querySelector('ng-select, .ng-select');
    if (!ng) return null;
    ng.scrollIntoView({ block: 'center' });
    const r = ng.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, index);
  if (!box) return false;

  await page.mouse.click(box.x, box.y);
  await sleep(500);

  const option = await page.evaluate((filter) => {
    const re = {
      H: /h[\s-]?alpha|\bha\b|hydrogen/i,
      O: /o[\s-]?iii|\bo3\b|oxygen/i,
      S: /s[\s-]?ii|\bs2\b|sulfur|sulphur/i,
      L: /luminance|\blum\b|\bl\b|clear/i,
      R: /red/i,
      G: /green/i,
      B: /blue/i,
    }[filter];
    if (!re) return null;
    const opts = Array.from(document.querySelectorAll('.ng-dropdown-panel .ng-option')).filter((o) => {
      const r = o.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const hit = opts.find((o) => re.test(o.innerText || ''));
    if (!hit) return { found: false, options: opts.map((o) => (o.innerText || '').trim()).slice(0, 20) };
    hit.scrollIntoView({ block: 'center' });
    const r = hit.getBoundingClientRect();
    return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2, label: (hit.innerText || '').trim() };
  }, letter);

  if (!option || !option.found) {
    await page.keyboard.press('Escape').catch(() => {});
    if (option && option.options && option.options.length) {
      console.warn(`  available filters: ${option.options.join(' | ')}`);
    }
    return false;
  }
  await page.mouse.click(option.x, option.y);
  await sleep(400);
  return true;
}

// --- Upload flow -------------------------------------------------------------

async function uploadFile(page, opts) {
  console.log(`Uploading ${path.basename(opts.file)} ...`);
  // `networkidle2` never fires here: the AstroBin app keeps a long-lived
  // service-worker/push connection, so the SPA is permanently "busy" and the
  // goto times out. `domcontentloaded` is enough — every later step gates on
  // its own waitForFunction.
  await page.goto('https://app.astrobin.com/uploader', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await assertLoggedIn(page);

  // The id is duplicated on the <astrobin-drag-drop-area> wrapper: match the input.
  // `domcontentloaded` returns before the Angular app has rendered the form;
  // `page.$` right after would see nothing and fail with a layout-change error.
  await page.waitForSelector('input#image-file-field', { timeout: 30000 });

  const input = await page.$('input#image-file-field');
  if (!input) throw new Error('upload form not found (layout changed?)');
  await input.uploadFile(opts.file);

  await page.waitForFunction(
    () => {
      const el = document.querySelector('input#image-file-field');
      return !!el && el.classList.contains('ng-valid') && /UPLOAD COMPLETE/i.test(document.body.innerText);
    },
    { timeout: opts.timeout, polling: 1000 }
  );
  console.log('Upload complete.');

  console.log('Filling title...');
  const field = await page.$('#image-title-field');
  if (!field) throw new Error('title field not found');
  // `ElementHandle.click()` runs the actionable checks (stable bounding box,)
  // which never complete on AstroBin's animating wizard. Focus the input
  // directly; the keyboard path below only needs focus, not a mouse click.
  await page.evaluate((sel) => document.querySelector(sel).focus(), '#image-title-field');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(opts.title, { delay: 40 });
  const value = await page.$eval('#image-title-field', (el) => el.value);
  if (value !== opts.title) throw new Error(`title did not stick (got "${value}")`);
  console.log(`Title set to "${value}".`);

  console.log('Clicking Next (Basic -> Content)...');
  if (!(await clickVisible(page, '#upload-next-button'))) throw new Error('Next button not clickable');
  // AstroBin creates the image id on this click, which is a full save round-trip
  // (the 1.7 MB upload is committed server-side); 60 s is not enough on a slow
  // connection, so the wizard is given 3 minutes.
  await page.waitForFunction(() => /\/i\/[A-Za-z0-9]+\/edit/.test(location.pathname), { timeout: 180000 });
  console.log('On the edit page.');
  await sleep(1500);
}

async function fillRequiredContent(page, opts) {
  const onContent = await page.evaluate(() => {
    const el = document.querySelector('.icon-picker-card');
    return !!el && el.getBoundingClientRect().height > 0;
  });
  if (!onContent) await goToStep(page, 'Content');
  await page.waitForSelector('.icon-picker-card', { timeout: 60000 });
  await sleep(800);

  console.log('Content step: picking Photograph / subject / source cards...');
  await selectCard(page, 'Photograph');
  await selectCard(page, opts.subject);

  const pair = SOURCE_LABELS[opts.source];
  if (!pair) throw new Error(`unknown --source "${opts.source}"`);
  console.log(`Source card: ${pair[0]} → ${pair[1]}`);
  // Clicking the card opens a drawer with the location type; an already
  // selected card needs no drawer (and none would be open).
  const cardState = await selectCard(page, pair[0]);
  if (cardState !== 'already') {
    await sleep(1200);
    if (!(await clickText(page, pair[1]))) throw new Error(`location option "${pair[1]}" not found`);
    await sleep(1200);
  }

  const state = await page.evaluate(() => ({
    selected: Array.from(document.querySelectorAll('.icon-picker-card.selected')).map((e) =>
      (e.innerText || '').trim().replace(/\s+/g, ' ')
    ),
    missing: Array.from(document.querySelectorAll('.invalid-feedback, .text-danger'))
      .map((e) => (e.innerText || '').trim())
      .filter((t) => /required/i.test(t)),
  }));
  console.log('Content selected:', state.selected.join(', ') || '(none)');
  if (state.missing.length) throw new Error(`required field still empty: ${state.missing.join(' / ')}`);
}

async function saveDraft(page) {
  if (!(await clickVisible(page, '#save-button'))) throw new Error('Save button not clickable');
  await page.waitForFunction(() => /\/i\/[A-Za-z0-9]+\/?$/.test(location.pathname), { timeout: 120000 });
  await sleep(2500);

  const info = await page.evaluate(() => ({
    url: location.href,
    headline: (document.querySelector('h1')?.innerText || '').trim(),
    staging: /staging area/i.test(document.body.innerText),
    publishButton: Array.from(document.querySelectorAll('button, a')).some(
      (e) => (e.innerText || '').trim() === 'Publish'
    ),
    errors: Array.from(document.querySelectorAll('.invalid-feedback, .text-danger'))
      .map((e) => (e.innerText || '').trim())
      .filter(Boolean),
  }));

  console.log('');
  console.log('Saved draft:', info.url);
  console.log('Title on page:', info.headline || '(none)');
  console.log('In staging area (unpublished):', info.staging ? 'yes' : 'NO — verify manually');
  console.log('Publish button present:', info.publishButton ? 'yes (left unpressed)' : 'no');
  if (info.errors.length) console.log('Page errors:', info.errors.join(' / '));
  if (!info.staging) process.exitCode = 3;
  return info.url;
}

// --- Main --------------------------------------------------------------------

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'usage: upload.js <file> "<title>" [--description-file <path>] [--subject "Deep sky"]\n' +
        '                [--source traveller|backyard|remote|public|hosting|mix] [--setup <name>]\n' +
        '                [--no-setup] [--no-acquisition] [--auto-description]\n' +
        '                [--inventory-root /data/Astro/CCD] [--dry-run] [--port 9222] [--llm-description] [--llm-model <pattern>]\n' +
        '                [--no-brave] (default LLM model: ' + DEFAULT_LLM_MODEL + ')\n' +
        '       upload.js --resume <image-url-or-id> [--title "<title>"] [--object-dir <dir>]'
    );
    return;
  }
  if (!opts.resume) {
    // Only --dry-run may run without a file, to inspect an inventory directory.
    if (!opts.file && !opts.dryRun) throw new Error('usage: upload.js <file> "<title>"');
    if (opts.file && !opts.title && !opts.dryRun) throw new Error('usage: upload.js <file> "<title>"');
    if (opts.file && !fs.existsSync(opts.file)) throw new Error(`file not found: ${opts.file}`);
    if (!SUBJECTS.includes(opts.subject)) {
      throw new Error(`--subject must be one of: ${SUBJECTS.join(', ')}`);
    }
  }

  const { ctx, setup, rows } = opts.doAcquisition || opts.doSetup
    ? scanInventory(opts)
    : { ctx: null, setup: null, rows: [] };
  describeAcquisition(ctx, setup, rows);
  const csv = rows.length ? acquisitionCsv(rows) : '';

  // Auto-description: fetch from web if requested and no explicit description
  if (opts.autoDescription && !opts.description && (ctx?.object || opts.title)) {
    const names = descriptionCandidates(ctx, opts.title);
    console.log(`
Fetching auto-description, searching: ${names.join(' | ')}`);
    const autoDesc = await fetchAutoDescription(names, opts);
    if (autoDesc) {
      opts.description = autoDesc.text;
      console.log(`Description path: ${autoDesc.path} (${autoDesc.text.length} chars)`);
      console.log(`Auto-description: ${autoDesc.text}`);
    } else {
      console.warn('Auto-description: no results found');
    }
  }

  if (opts.dryRun) {
    if (opts.description) console.log(`\nWould set description: ${opts.description}`);
    if (sourceUrls.size) {
      console.log(`\nSource URLs used (${sourceUrls.size}):`);
      for (const u of sourceUrls) console.log(`  ${u}`);
    }
    if (setup) console.log(`\nWould apply setup: ${setup}`);
    if (csv) console.log(`\nAcquisition CSV (${rows.length} row(s)):\n${csv}`);
    return;
  }

  const puppeteer = loadPuppeteer();
  let browser;
  let page;
  try {
    // Fetch the debugger WebSocket URL first, then connect. Connecting via
    // `browserURL` leaves `browser.pages()` stalling on this machine; the
    // endpoint path works (verified with a standalone probe).
    const version = await fetchJson(`http://127.0.0.1:${opts.port}/json/version`, 15000);
    browser = await puppeteer.connect({
      browserWSEndpoint: version.webSocketDebuggerUrl,
      defaultViewport: null,
      // The default protocol timeout (30 s) is too short on this machine:
      // `Network.enable` on a page with AstroBin's service worker alive can
      // take minutes, and the failure kills an in-progress upload.
      protocolTimeout: opts.timeout,
    });
    console.log('Browser connected.');
    const pages = await browser.pages();
    console.log('Pages: ' + pages.map((p) => p.url().slice(0, 40)).join(' | '));
    page = pages.find((p) => /astrobin\.com/.test(p.url())) || pages[0] || (await browser.newPage());
    // `bringToFront` can hang for minutes on a window that Wayland reports as
    // occluded; bound it, and never let it block the upload.
    await Promise.race([page.bringToFront().catch(() => {}), sleep(3000)]);

    if (opts.resume) {
      const id = String(opts.resume).match(/([A-Za-z0-9]+)\/?$/)?.[1] || opts.resume;
      const open = pages.find((p) => new RegExp(`/i/${id}(/|$)`).test(p.url()));
      if (open) {
        // The wizard tab is already open (e.g. an interrupted run). Navigating
        // a background/occluded tab stalls; reuse it as-is.
        page = open;
        console.log(`Reusing open wizard tab for draft ${id} (no navigation).`);
        await Promise.race([page.bringToFront().catch(() => {}), sleep(3000)]);
        await sleep(1200);
      } else {
        console.log(`Opening draft ${id} ...`);
        await page.goto(`https://app.astrobin.com/i/${id}/edit`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        console.log('Page loaded, checking login...');
        await assertLoggedIn(page);
        console.log('Logged in, waiting for wizard tabs...');
        // The edit page renders its wizard tabs asynchronously; goToStep on a
        // not-yet-built page sees zero tabs.
        await page.waitForFunction(() => /Content/.test(document.body.innerText), { timeout: 180000 });
        await sleep(1200);
      }
      if (opts.title) {
        const field = await page.$('#image-title-field');
        if (field) {
          // Focus directly: `ElementHandle.click()`'s actionable checks hang on
          // AstroBin's animating wizard (see the same fix in `uploadFile`).
          await page.evaluate((sel) => document.querySelector(sel).focus(), '#image-title-field');
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          await page.keyboard.type(opts.title, { delay: 40 });
        }
      }
      // Jump straight to the Content step, which holds the required fields.
      await goToStep(page, 'Content');
    } else {
      await uploadFile(page, opts);
    }

    if (opts.description) await fillDescription(page, opts.description);
    await fillRequiredContent(page, opts);
    if (opts.doSetup && setup) await applySetup(page, setup);
    if (opts.doAcquisition && csv) await importAcquisitionCsv(page, csv);
    if (opts.doAcquisition && csv) await applyAcquisitionFilters(page, rows);

    const url = await saveDraft(page);
    console.log(`\nOpen it at: ${url}`);
  } catch (err) {
    if (page) {
      const shot = '/tmp/opencode/astrobin-error.png';
      await page.screenshot({ path: shot }).catch(() => {});
      console.error(`\nScreenshot for debugging: ${shot}`);
    }
    throw err;
  } finally {
    // Disconnect, never close: the user watches the window and may need to log in.
    if (browser) await browser.disconnect().catch(() => {});
  }
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
