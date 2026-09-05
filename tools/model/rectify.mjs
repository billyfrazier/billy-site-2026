// node rectify.mjs <image-url-path> <out.png> [w h]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [src, out, w = '1200', h = '1800'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const p = await b.newPage(); p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto(`http://localhost:4599/_t/rectify.html?src=${encodeURIComponent(src)}&w=${w}&h=${h}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const o = await p.evaluate(() => window.__out);
writeFileSync(out, Buffer.from(o.png.split(',')[1], 'base64'));
console.log('corners', JSON.stringify(o.corners), 'orange px', o.orangePixels, '→', out);
await b.close();
