#!/usr/bin/env node
'use strict';

/**
 * Upload a finished image to AstroBin as an unlisted staging draft.
 *
 *   upload.js <file> "<title>" [options]
 *   upload.js --resume <image-url-or-id> [--title "<title>"] [options]
 *
 * Options:
 *   --subject <name>   Content subject type (default "Deep sky")
 *   --source <name>    backyard | traveller | remote | external (default backyard)
 *   --port <n>         DevTools port (default 9222)
 *   --timeout <ms>     Max wait for the file upload (default 900000)
 *
 * Never publishes: the image is left in the staging area for the user.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SOURCE_LABELS = {
  backyard: 'Backyard',
  traveller: 'Traveller',
  remote: 'Remote observatory',
  external: 'External data',
};

const SUBJECTS = ['Deep sky', 'Solar system', 'Landscape', 'Other'];

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
  const opts = { subject: 'Deep sky', source: 'backyard', port: 9222, timeout: 900000 };
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
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const leaf = Array.from(document.querySelectorAll('*')).find(
      (e) => e.children.length === 0 && (e.innerText || '').trim() === txt
    );
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

async function uploadFile(page, opts) {
  console.log(`Uploading ${path.basename(opts.file)} ...`);
  await page.goto('https://app.astrobin.com/uploader', { waitUntil: 'networkidle2', timeout: 60000 });
  await assertLoggedIn(page);

  // The id is duplicated on the <astrobin-drag-drop-area> wrapper: match the input.
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

  const field = await page.$('#image-title-field');
  if (!field) throw new Error('title field not found');
  await field.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(opts.title, { delay: 40 });
  const value = await page.$eval('#image-title-field', (el) => el.value);
  if (value !== opts.title) throw new Error(`title did not stick (got "${value}")`);
  console.log(`Title set to "${value}".`);

  if (!(await clickVisible(page, '#upload-next-button'))) throw new Error('Next button not clickable');
  await page.waitForFunction(() => /\/i\/[A-Za-z0-9]+\/edit/.test(location.pathname), { timeout: 60000 });
  await sleep(1500);
}

async function fillRequiredContent(page, opts) {
  await page.waitForSelector('.icon-picker-card', { timeout: 60000 });
  await sleep(800);

  await selectCard(page, 'Photograph');
  await selectCard(page, opts.subject);

  if (opts.source === 'external') {
    await selectCard(page, 'External data');
  } else {
    const label = SOURCE_LABELS[opts.source];
    if (!label) throw new Error(`unknown --source "${opts.source}"`);
    // Clicking the card opens a drawer with the location type; an already
    // selected card needs no drawer (and none would be open).
    const state = await selectCard(page, 'My own equipment');
    if (state !== 'already') {
      await sleep(1200);
      if (!(await clickText(page, label))) throw new Error(`location option "${label}" not found`);
      await sleep(1200);
    }
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

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'usage: upload.js <file> "<title>" [--subject "Deep sky"] [--source backyard] [--port 9222]\n' +
        '       upload.js --resume <image-url-or-id> [--title "<title>"]'
    );
    return;
  }
  if (!opts.resume) {
    if (!opts.file || !opts.title) throw new Error('usage: upload.js <file> "<title>"');
    if (!fs.existsSync(opts.file)) throw new Error(`file not found: ${opts.file}`);
    if (!SUBJECTS.includes(opts.subject)) {
      throw new Error(`--subject must be one of: ${SUBJECTS.join(', ')}`);
    }
  }

  const puppeteer = loadPuppeteer();
  let browser;
  let page;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${opts.port}`,
      defaultViewport: null,
    });
    const pages = await browser.pages();
    page = pages.find((p) => /astrobin\.com/.test(p.url())) || pages[0] || (await browser.newPage());
    await page.bringToFront();

    if (opts.resume) {
      const id = String(opts.resume).match(/([A-Za-z0-9]+)\/?$/)?.[1] || opts.resume;
      await page.goto(`https://app.astrobin.com/i/${id}/edit`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      await assertLoggedIn(page);
      if (opts.title) {
        const field = await page.$('#image-title-field');
        if (field) {
          await field.click();
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          await page.keyboard.type(opts.title, { delay: 40 });
        }
      }
      // Jump straight to the Content step, which holds the required fields.
      await page.evaluate(() => {
        const a = document.querySelector('a[href="#step-1"]');
        a && a.click();
      });
      await sleep(1500);
    } else {
      await uploadFile(page, opts);
    }

    await fillRequiredContent(page, opts);
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
