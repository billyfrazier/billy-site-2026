// Drives mask.html in a real browser (it needs WebGL to skin the mesh) and
// writes the UV masks it produces. Needs `playwright-core` and a Chrome.
//   node tools/model/domask.mjs <model-url-path> <out-dir>
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [model, outDir] = process.argv.slice(2);
if (!model || !outDir) {
  console.error('usage: node tools/model/domask.mjs /assets/models-raw/billy-body-raw.glb <out-dir>');
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(`http://localhost:4599/_t/mask.html?model=${encodeURIComponent(model)}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });

console.log(JSON.stringify(await page.evaluate(() => window.__stats)));
for (const [name, uri] of Object.entries(await page.evaluate(() => window.__masks))) {
  writeFileSync(`${outDir}/mask-${name}.png`, Buffer.from(uri.split(',')[1], 'base64'));
  console.log('wrote', `mask-${name}.png`);
}
await browser.close();
