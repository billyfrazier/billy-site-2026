// Builds the three generator inputs from the source photos:
//   node tools/model/matte.mjs <out-dir>
//
// 1. front-cutout.jpg — Billy alone from the launch group photo, the cover he
//    is holding painted tee-black, neighbours and the bookshelf wall matted
//    to flat grey. This goes FIRST: Meshy takes both the subject extent and
//    the face from the first image, and this is the only frontal, eyes-open
//    view. (Body-first runs inherited the body photo's downcast eyes; the
//    unmatted group photo reconstructed all three people and the wall.)
// 2. body.jpg — the 3/4 standing view, for the body and the hanging arms.
// 3. head.jpg — the portrait, for face detail.
//
// The silhouette is hand-drawn against the 400x1508 crop — an ellipse for the
// head, a polygon for the body, a wedge between the legs. Redraw it if the
// crop changes.
import sharp from 'sharp';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) { console.error('usage: node tools/model/matte.mjs <out-dir>'); process.exit(1); }
const SRC = 'assets/source-photos';

// --- 1. frontal cutout -------------------------------------------------------
const cover = await sharp({ create: { width: 118, height: 150, channels: 3, background: { r: 28, g: 27, b: 29 } } }).png().toBuffer();
const front = await sharp(join(SRC, 'IMG_2110.JPG')).rotate()
  .extract({ left: 470, top: 540, width: 400, height: 1508 })
  .composite([{ input: cover, left: 136, top: 440 }])   // the book in his hands
  .png().toBuffer();
const silhouette = Buffer.from(`<svg width='400' height='1508'>
  <ellipse cx='203' cy='152' rx='57' ry='100' fill='#fff'/>
  <polygon fill='#fff' points='96,268 132,246 176,236 232,236 276,246 316,270 322,420 318,560 318,645 318,705 296,722 293,1000 287,1190 282,1300 252,1320 168,1320 118,1312 110,1180 106,1000 102,722 84,705 82,560 78,420'/>
</svg>`);
const legGap = Buffer.from(`<svg width='400' height='1508'><polygon fill='#f4f4f4' points='199,900 216,1185 186,1185'/></svg>`);
const cut = await sharp(front).composite([{ input: silhouette, blend: 'dest-in' }]).png().toBuffer();
await sharp({ create: { width: 400, height: 1508, channels: 3, background: '#f4f4f4' } })
  .composite([{ input: cut }, { input: legGap }]).jpeg({ quality: 92 }).toFile(join(out, 'front-cutout.jpg'));

// --- 2. body, 3. head ---------------------------------------------------------
await sharp(join(SRC, 'IMG_2148.JPG')).rotate()
  .extract({ left: 150, top: 470, width: 580, height: 1578 }).jpeg({ quality: 92 }).toFile(join(out, 'body.jpg'));
await sharp(join(SRC, 'billy-7938 3.jpg')).rotate().jpeg({ quality: 92 }).toFile(join(out, 'head.jpg'));
console.log('wrote front-cutout.jpg, body.jpg, head.jpg →', out);
