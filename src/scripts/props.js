// Props that REPLACE the bust. Selecting a chip swaps Billy out for the object
// at full size; reset (or a chip with no prop) swaps him back. Only the book
// exists so far — a textured box using the real cover art, so it costs one
// image rather than a downloaded model.
import * as THREE from 'three';

const COVER = '/images/book-cover.jpg';
const PAGE = 0xf3efe6;
const BOARD = 0x1b1a19;

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
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [pages, board, pages, pages, cover, board],
  ));
  return group;
}

export function createProps({ scene, renderer }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const book = buildBook(renderer);
  root.add(book);

  let base = 1;    // full-size scale for the current breakpoint
  let t = 0;

  function setLayout({ position, scale }) {
    root.position.copy(position);
    base = scale;
  }

  // 0 = absent, 1 = fully swapped in. Scene drives this against the bust's fade.
  function setAmount(k) {
    root.visible = k > 0.001;
    if (!root.visible) return;
    root.scale.setScalar(base * (0.9 + 0.1 * k)); // settles into size as it arrives
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.transparent = k < 0.999;
        m.opacity = k;
        m.depthWrite = k > 0.5;
      }
    });
  }

  // Keeps the cursor-responsiveness of the bust it replaced, at lower amplitude.
  function update(dt, yaw = 0, pitch = 0) {
    if (!root.visible) return;
    t += dt;
    book.rotation.y = yaw * 0.75 + Math.sin(t * 0.35) * 0.14;
    book.rotation.x = -pitch * 0.5 + Math.sin(t * 0.5) * 0.03;
    book.rotation.z = Math.sin(t * 0.42) * 0.03;
    book.position.y = Math.sin(t * 1.1) * 0.012;
  }

  return { setLayout, setAmount, update, root };
}
