// Pack a raw generator GLB into the shipped one:
//   node tools/model/pack.mjs <raw.glb> <out.glb> [texture.png] [--simplify 0.45]
// Unpacks to glTF, swaps in a repaired texture if given, sets the material
// factors the generator gets wrong, re-encodes the texture as webp, and packs
// with meshopt. Needs `sharp` (a transitive dep already) and the
// @gltf-transform CLI via npx.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const simplifyAt = args.indexOf('--simplify');
// Opt-in, ratio only: the *default* simplify pass facets the silhouette and
// hairline, but a ratio near 0.45 with error 0.0004 is invisible at render
// scale and cuts ~30% off the file. Leave it off for models under ~50k tris.
const SIMPLIFY = simplifyAt >= 0 ? parseFloat(args.splice(simplifyAt, 2)[1]) : 0;
const [raw, out, texture] = args;
if (!raw || !out) {
  console.error('usage: node tools/model/pack.mjs <raw.glb> <out.glb> [texture.png] [--simplify 0.45]');
  process.exit(1);
}

const EMISSIVE = 0.28;   // generator ships 1.0 = fully self-lit; see README
const WEBP_QUALITY = 72; // ~450KB at 2048 — the face is the point of the page

const dir = mkdtempSync(join(tmpdir(), 'pack-'));
const gltfPath = join(dir, 'body.gltf');
const cli = (...args) => execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', ...args], { stdio: 'pipe' });

cli('copy', raw, gltfPath);
const g = JSON.parse(readFileSync(gltfPath, 'utf8'));

// Texture: the repaired one if supplied, else whatever the generator wrote.
const src = texture ?? join(dir, g.images[0].uri);
const info = await sharp(src).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(join(dir, 'baseColor.webp'));
console.log(`texture → webp q${WEBP_QUALITY}: ${(info.size / 1024) | 0}KB`);
g.images[0] = { name: 'texture_0', mimeType: 'image/webp', uri: 'baseColor.webp' };
g.textures[0] = { name: 'texture_0', extensions: { EXT_texture_webp: { source: 0 } } };
for (const k of ['extensionsUsed', 'extensionsRequired']) {
  g[k] ??= [];
  if (!g[k].includes('EXT_texture_webp')) g[k].push('EXT_texture_webp');
}

// Material: partial emissive so the lights shape him; specular back to physical.
const m = g.materials[0];
m.emissiveFactor = [EMISSIVE, EMISSIVE, EMISSIVE];
if (m.extensions?.KHR_materials_specular) m.extensions.KHR_materials_specular.specularColorFactor = [1, 1, 1];
writeFileSync(gltfPath, JSON.stringify(g));

const simplify = SIMPLIFY
  ? ['--simplify', 'true', '--simplify-ratio', String(SIMPLIFY), '--simplify-error', '0.0004']
  : ['--simplify', 'false'];
cli('optimize', gltfPath, out, ...simplify, '--texture-compress', 'false', '--compress', 'meshopt');
console.log(`packed → ${out}: ${(readFileSync(out).length / 1024) | 0}KB`);
