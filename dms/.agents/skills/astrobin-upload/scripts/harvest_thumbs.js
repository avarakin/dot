// Harvest AstroBin thumb URL per slug from each image's detail page.
// Usage: node ab_thumbs3.js [parallel=2]
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PAR = parseInt(process.argv[2] || '2', 10);

const OUT = '/tmp/ab_thumbs.json';
const gallery = JSON.parse(fs.readFileSync('/tmp/ab_gallery_all.json', 'utf8')).map(g => g.slug);
// staging slugs (from earlier scrape) — merged below if file exists
let staging = [];
try { staging = JSON.parse(fs.readFileSync('/tmp/ab_staging.json', 'utf8')).map(g => g.slug); } catch (e) {}
let registry = [];
try { registry = Object.values(JSON.parse(fs.readFileSync('/home/alex/.cache/astro_inventory/submitted.json', 'utf8'))).map(v => v.slug); } catch (e) {}
const slugs = [...new Set([...gallery, ...staging, ...registry])];

const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = slugs.filter(s => !done[s]);
console.log('total', slugs.length, 'cached', slugs.length - todo.length, 'todo', todo.length);

(async () => {
  const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const b = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, defaultViewport: null, protocolTimeout: 120000 });
  let i = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  const worker = async () => {
    const page = await b.newPage();
    while (i < todo.length) {
      const slug = todo[i++];
      try {
        await page.goto('https://app.astrobin.com/i/' + slug, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(1500);
        const src = await page.evaluate(() => {
          const imgs = [...document.querySelectorAll('img')].filter(i => /cdn\.astrobin\.com\/(thumbs|solutions)\//.test(i.currentSrc || i.src));
          const big = imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))[0];
          return big ? (big.currentSrc || big.src) : '';
        });
        if (src) done[slug] = src; else done[slug] = null;
      } catch (e) { done[slug] = null; }
      process.stdout.write('.');
      if (i % 10 === 0) save();
    }
    await page.close().catch(() => {});
  };
  await Promise.all(Array.from({ length: PAR }, worker));
  save();
  const got = Object.values(done).filter(Boolean).length;
  console.log('\nwith thumb:', got, 'missing:', Object.values(done).filter(x => !x).length);
  await b.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
