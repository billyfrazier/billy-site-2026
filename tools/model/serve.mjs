// Static server for the model tools: the repo at /, this folder at /_t/.
// Vite/astro-dev rewrites module paths, which breaks the raw three.js import
// map mask.html needs — hence a plain file server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const REPO = join(TOOLS, '..', '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.css': 'text/css', '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const root = p.startsWith('/_t/') ? (p = p.slice(3), TOOLS) : REPO;
  try {
    const file = join(root, normalize(p));
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'access-control-allow-origin': '*', 'cache-control': 'no-store',
    });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(4599, () => console.log('model tools serving on http://localhost:4599'));
