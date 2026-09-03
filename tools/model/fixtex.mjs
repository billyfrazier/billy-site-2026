// Texture repair for billy-body: paint the baked-in book off the tee, and pull
// the red bleed out of the black jeans. Masks come from mask.html (UV-space
// rasterisations of 3D-selected triangles), so nothing outside the real region
// is touched.
import sharp from 'sharp';

const [, , baseIn, dir, out] = process.argv;
const SIZE = 2048;

const load = async (f) => sharp(f).resize(SIZE, SIZE).greyscale().raw().toBuffer();
const [mBook, mLeg, mShirt, mZone] = await Promise.all(
  ['mask-book.png', 'mask-leg.png', 'mask-shirt.png', 'mask-bookzone.png'].map((f) => load(`${dir}/${f}`)));
// Per-texel target colour, sampled from the nearest real tee in 3D. It gets a
// *normalised* blur — blur(fill x mask) / blur(mask) — so colour spreads only
// within the painted area. A plain blur would drag in the black background,
// and feathering the mask itself is worse still: this atlas is thousands of
// tiny islands, so a soft edge means partial alpha nearly everywhere, letting
// the original cover amber bleed straight back through.
const RADIUS = 6;
const fillRaw = await sharp(`${dir}/mask-bookfill.png`).resize(SIZE, SIZE).removeAlpha().raw().toBuffer();
const fillBlur = await sharp(fillRaw, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .blur(RADIUS).raw().toBuffer();
const maskBlur = await sharp(`${dir}/mask-book.png`).resize(SIZE, SIZE).greyscale()
  .blur(RADIUS).raw().toBuffer();
const fillMap = new Uint8Array(SIZE * SIZE * 3);
for (let i = 0; i < SIZE * SIZE; i++) {
  const w = maskBlur[i] / 255;
  for (let c = 0; c < 3; c++) {
    fillMap[i * 3 + c] = w > 0.06 ? Math.min(255, Math.round(fillBlur[i * 3 + c] / w)) : 0;
  }
}
const img = await sharp(baseIn).resize(SIZE, SIZE).removeAlpha().raw().toBuffer();
const N = SIZE * SIZE;

// --- 1. the tee's true colour, median-sampled from shirt texels outside the book
// The mask alone still admits suede in shadow, which is dark but strongly
// chromatic. The tee is a near-neutral black, so filter on saturation too.
const shirt = [[], [], []];
for (let i = 0; i < N; i++) {
  if (mShirt[i] < 128 || mBook[i] > 64) continue;
  const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx > 90) continue;
  if (mx > 0 && (mx - mn) / mx > 0.32) continue;   // reject brown suede
  for (let c = 0; c < 3; c++) shirt[c].push(img[i * 3 + c]);
}
const med = shirt.map((a) => { a.sort((x, y) => x - y); return a[a.length >> 1] ?? 24; });
console.log('tee median rgb', med, 'from', shirt[0].length, 'texels');

// --- 2. fill the book with the tee, with a little grain so it is not dead flat
// Deterministic value noise, so a rebuild reproduces the same texture exactly.
let seed = 20260902;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let filled = 0;
for (let i = 0; i < N; i++) {
  // Hard alpha, deliberately: see the note on the fill map above.
  const a = mBook[i] > 127 ? 1 : 0;
  if (!a) continue;
  filled++;
  const n = (rnd() - 0.5) * 5;
  for (let c = 0; c < 3; c++) {
    // fillMap is black outside the rasterised triangles; fall back to the
    // median there so the feathered edge never fades toward black.
    const base = mBook[i] > 8 ? fillMap[i * 3 + c] : med[c];
    const target = Math.max(0, Math.min(255, (base || med[c]) + n));
    img[i * 3 + c] = Math.round(img[i * 3 + c] * (1 - a) + target * a);
  }
}
console.log('book texels repainted', filled);

// --- 2b. sweep leftover cover amber inside the book's 3D footprint ----------
// The cover's printed type and edge shading are neither saturated-yellow nor
// dark enough to be caught per-triangle; a colour sweep inside the zone gets
// them without touching the suede, which is browner and lives outside the box.
let swept = 0;
for (let i = 0; i < N; i++) {
  if (mZone[i] < 128 || mBook[i] > 200) continue;
  const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 80) continue;                       // already tee-dark
  const sat = mx ? (mx - mn) / mx : 0;
  // Cover amber ~(218,170,64): g/r .78, b/g .38. Suede ~(150,95,60): .63 / .63.
  // Both ratios have to agree before a texel counts as cover.
  const amber = r === mx && g > r * 0.68 && b < g * 0.55 && sat > 0.40;
  if (!amber) continue;
  const n = (rnd() - 0.5) * 5;
  for (let c = 0; c < 3; c++) {
    const base = mBook[i] > 8 ? (fillMap[i * 3 + c] || med[c]) : med[c];
    img[i * 3 + c] = Math.max(0, Math.min(255, Math.round(base + n)));
  }
  swept++;
}
console.log('leftover cover texels swept', swept);

// --- 3. neutralise the red cast on the jeans -------------------------------
// Black denim scanned against warm light picked up a red bleed. Inside the leg
// mask, push chroma toward neutral in proportion to how red-and-dark a texel is.
let neutralised = 0;
for (let i = 0; i < N; i++) {
  if (mLeg[i] < 128) continue;
  const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx > 175 || mx < 6) continue;              // leave boot highlights alone
  const sat = (mx - mn) / mx;
  if (sat < 0.16 || r !== mx) continue;          // only the red-dominant cast
  const k = Math.min(1, (sat - 0.16) / 0.30);    // fully neutral by sat 0.46
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  img[i * 3] = Math.round(r * (1 - k) + lum * k);
  img[i * 3 + 1] = Math.round(g * (1 - k) + lum * k);
  img[i * 3 + 2] = Math.round(b * (1 - k) + lum * k);
  neutralised++;
}
console.log('jean texels neutralised', neutralised);

await sharp(img, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toFile(out);
console.log('wrote', out);
