// node fixweights.mjs <model-url> <out-dir> [r] [xin] → writes joints.bin / weights.bin
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [model, out, r = '0.075', xin = '0.20'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto(`http://localhost:4599/_t/fixweights.html?model=${encodeURIComponent(model)}&r=${r}&xin=${xin}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const o = await p.evaluate(() => window.__out);
writeFileSync(`${out}/joints.bin`, Buffer.from(o.joints, 'base64'));
writeFileSync(`${out}/weights.bin`, Buffer.from(o.weights, 'base64'));
console.log(`verts ${o.n}, touched ${o.moved}, weight moved ${o.movedWeight}; bones: ${o.boneNames.join(',')}`);
await b.close();
