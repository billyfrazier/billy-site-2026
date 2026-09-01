// Props that float above the bust's head. One per chip reply; only the book
// exists so far. Built from primitives + the real cover art rather than a
// downloaded model, so it costs a single texture and stays instantly tweakable.
import * as THREE from 'three';

const COVER = '/images/book-cover.jpg';
const PAGE = 0xf3efe6;
const BOARD = 0x1b1a19;

const IN_MS = 480;
const OUT_MS = 300;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function buildBook(renderer) {
  const group = new THREE.Group();
  const tex = new THREE.TextureLoader().load(COVER);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const W = 0.28, H = 0.4, D = 0.05; // trade-paperback proportions
  const cover = new THREE.MeshBasicMaterial({ map: tex });          // unlit: art stays true
  const board = new THREE.MeshLambertMaterial({ color: BOARD });
  const pages = new THREE.MeshLambertMaterial({ color: PAGE });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [pages, board, pages, pages, cover, board],
  );
  group.add(book);
  return group;
}

// `anchor` is owned by the caller and may be moved between breakpoints;
// `base` scales the whole prop for narrow viewports.
export function createProps({ scene, renderer, anchor }) {
  const root = new THREE.Group();
  root.position.copy(anchor);
  root.visible = false;
  scene.add(root);
  let base = 1;

  const book = buildBook(renderer);
  root.add(book);

  let state = 'hidden';   // 'hidden' | 'in' | 'shown' | 'out'
  let phase = 0;          // ms into the current transition
  let t = 0;              // seconds, for the idle float

  function show() {
    if (state === 'in' || state === 'shown') return;
    state = 'in';
    phase = 0;
    root.visible = true;
  }

  function hide() {
    if (state === 'hidden' || state === 'out') return;
    state = 'out';
    phase = 0;
  }

  function update(dt) {
    if (state === 'hidden') return;
    t += dt;
    phase += dt * 1000;

    let k = 1;
    if (state === 'in') {
      k = smooth(phase / IN_MS);
      if (phase >= IN_MS) state = 'shown';
    } else if (state === 'out') {
      k = 1 - smooth(phase / OUT_MS);
      if (phase >= OUT_MS) { state = 'hidden'; root.visible = false; }
    }

    root.scale.setScalar(base * (0.55 + 0.45 * k));
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.transparent = k < 1;
        m.opacity = k;
      }
    });
    // drifts up into place, then breathes
    root.position.x = anchor.x;
    root.position.z = anchor.z;
    root.position.y = anchor.y - 0.12 * (1 - k) + Math.sin(t * 1.1) * 0.018;
    book.rotation.y = Math.sin(t * 0.45) * 0.5;
    book.rotation.z = Math.sin(t * 0.7) * 0.05;
  }

  const setBase = (s) => { base = s; };
  return { show, hide, update, setBase, root, isVisible: () => state !== 'hidden' };
}
