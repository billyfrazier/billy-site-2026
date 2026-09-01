// Retouches the bust's colour texture: softens wrinkles/bags around the eyes and
// fills the thin hairline at the temple. The scan's UV atlas is shattered, so
// regions can't be found by eye in texture space — instead we walk the mesh
// triangles, keep the ones whose centroid falls inside a 3D region, and
// rasterise THOSE triangles' UVs into a mask. Edits are then applied through
// that mask (skin-hue gated, feathered) so nothing bleeds onto glasses or beard.
//
// Prerequisites:
//   npm i -D playwright-core            (not a runtime dependency)
//   cp assets/models-raw/billy-meshyhi.glb public/models/billy-bust-src.glb
//   PUBLIC_DEV_PAGES=1 npm run build && npm run preview   (serves ?model=src)
// Run:
//   node tools/edit-texture.mjs out/baseColor.jpg
// Then repack:
//   npx @gltf-transform/cli copy assets/models-raw/billy-meshyhi.glb tmp/m.gltf
//   cp out/baseColor.jpg tmp/baseColor.jpg
//   npx @gltf-transform/cli copy tmp/m.gltf tmp/edited.glb
//   npx @gltf-transform/cli optimize tmp/edited.glb public/models/billy-bust.glb \
//     --compress meshopt --texture-compress webp --texture-size 2048 --simplify false
//   rm public/models/billy-bust-src.glb
//
// Region coordinates are specific to this model — re-measure by raycasting if it
// is ever regenerated (see DESIGN.md).

import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR', m.text()); });
await page.goto('http://localhost:4321/?instant&model=src', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

const result = await page.evaluate(async (cfg) => {
  const mesh = window.__bfMesh;
  const geo = mesh.geometry;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const index = geo.index;
  const img = mesh.material.map.image;
  const W = img.width, H = img.height;

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const src = mk(W, H);
  src.getContext('2d').drawImage(img, 0, 0);

  // --- rasterise a mask from triangles whose centroid falls inside a region ---
  function buildMask(test) {
    const c = mk(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2; // stroke closes seams
    const triCount = index ? index.count / 3 : pos.count / 3;
    let hits = 0;
    for (let t = 0; t < triCount; t++) {
      const a = index ? index.getX(t * 3) : t * 3;
      const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const d = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(d)) / 3;
      const cy = (pos.getY(a) + pos.getY(b) + pos.getY(d)) / 3;
      const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(d)) / 3;
      if (!test(cx, cy, cz)) continue;
      hits++;
      g.beginPath();
      g.moveTo(uv.getX(a) * W, (1 - uv.getY(a)) * H);
      g.lineTo(uv.getX(b) * W, (1 - uv.getY(b)) * H);
      g.lineTo(uv.getX(d) * W, (1 - uv.getY(d)) * H);
      g.closePath(); g.fill(); g.stroke();
    }
    // feather so edits fade rather than stopping at a triangle edge
    const soft = mk(W, H);
    const sg = soft.getContext('2d');
    sg.filter = 'blur(3px)';
    sg.drawImage(c, 0, 0);
    return { data: sg.getImageData(0, 0, W, H).data, hits };
  }

  const dist = (x, y, z, p) => Math.hypot(x - p[0], y - p[1], z - p[2]);
  const eyeMask = buildMask((x, y, z) => cfg.eyes.some(p => dist(x, y, z, p) < cfg.eyeR));
  const hairMask = buildMask((x, y, z) => cfg.hair.some(p => dist(x, y, z, p) < cfg.hairR));

  const base = src.getContext('2d').getImageData(0, 0, W, H);
  const out = src.getContext('2d').getImageData(0, 0, W, H);

  const blurCanvas = (px) => {
    const c = mk(W, H); const g = c.getContext('2d');
    g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0);
    return g.getImageData(0, 0, W, H).data;
  };
  const soft = blurCanvas(cfg.softBlur);   // fine-detail smoothing
  const wide = blurCanvas(cfg.wideBlur);   // local mean

  const D = base.data, O = out.data;
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const isSkin = (r, g, b) => lum(r, g, b) > 90 && r > b + 12;

  // --- 1. soften wrinkles + lift under-eye bags ---
  let eyePx = 0;
  for (let i = 0; i < D.length; i += 4) {
    const m = eyeMask.data[i] / 255;
    if (m <= 0.01) continue;
    const r = D[i], g = D[i + 1], b = D[i + 2];
    if (!isSkin(r, g, b)) continue;
    eyePx++;
    const k = m * cfg.softAmt;
    let nr = r + (soft[i] - r) * k;
    let ng = g + (soft[i + 1] - g) * k;
    let nb = b + (soft[i + 2] - b) * k;
    const lNow = lum(nr, ng, nb), lMean = lum(wide[i], wide[i + 1], wide[i + 2]);
    if (lNow < lMean) { // darker than its surroundings = a line or a bag
      const lift = m * cfg.liftAmt;
      nr += (wide[i] - nr) * lift;
      ng += (wide[i + 1] - ng) * lift;
      nb += (wide[i + 2] - nb) * lift;
    }
    O[i] = nr; O[i + 1] = ng; O[i + 2] = nb;
  }

  // --- 2. fill thin hairline: recolour skin-through-hair toward hair tone ---
  let hr = 0, hg = 0, hb = 0, hn = 0;
  for (let i = 0; i < D.length; i += 4) {
    if (hairMask.data[i] < 200) continue;
    const r = D[i], g = D[i + 1], b = D[i + 2];
    if (lum(r, g, b) < 95) { hr += r; hg += g; hb += b; hn++; } // existing hair
  }
  const hair = hn > 50 ? [hr / hn, hg / hn, hb / hn] : cfg.hairFallback;
  let hairPx = 0;
  for (let i = 0; i < D.length; i += 4) {
    const m = hairMask.data[i] / 255;
    if (m <= 0.01) continue;
    const r = D[i], g = D[i + 1], b = D[i + 2];
    if (!(lum(r, g, b) > cfg.skinLumMin && r > b + 12)) continue; // only bare skin
    const meanL = lum(wide[i], wide[i + 1], wide[i + 2]);
    if (meanL > cfg.hairSurroundMax) continue;   // open skin, not a gap between strands
    const gapFade = Math.min(1, (cfg.hairSurroundMax - meanL) / 25); // ease in at the boundary
    hairPx++;
    // keep the pixel's own shading, retint it to hair
    const ratio = Math.max(0.55, Math.min(1.45, lum(r, g, b) / Math.max(1, lum(wide[i], wide[i + 1], wide[i + 2]))));
    const tr = hair[0] * ratio, tg = hair[1] * ratio, tb = hair[2] * ratio;
    const k = m * cfg.hairAmt * gapFade;
    O[i] = r + (tr - r) * k;
    O[i + 1] = g + (tg - g) * k;
    O[i + 2] = b + (tb - b) * k;
  }

  const dst = mk(W, H);
  dst.getContext('2d').putImageData(out, 0, 0);
  return {
    size: [W, H], eyeTris: eyeMask.hits, hairTris: hairMask.hits, eyePx, hairPx,
    hair: hair.map(n => Math.round(n)),
    jpeg: dst.toDataURL('image/jpeg', 0.95),
  };
}, {
  eyes: [[-0.3627, 0.4132, 0.2755], [-0.1296, 0.4511, 0.2591]],
  eyeR: 0.13,
  hair: [[0.0162, 0.7746, -0.094], [0.0443, 0.7446, -0.069], [0.0724, 0.6747, -0.0461], [0.0999, 0.6032, -0.0511]],
  hairR: 0.065,
  softBlur: 4, wideBlur: 22,
  softAmt: 0.72, liftAmt: 0.58,
  hairAmt: 0.85, skinLumMin: 112, hairSurroundMax: 156,
  hairFallback: [70, 58, 48],
});

const { jpeg, ...stats } = result;
console.log(JSON.stringify(stats));
writeFileSync(process.argv[2], Buffer.from(jpeg.split(',')[1], 'base64'));
console.log('texture written to', process.argv[2]);
await browser.close();
