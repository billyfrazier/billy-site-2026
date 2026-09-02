// Sims-style props: one icon per chip, floating above the figure's head,
// slowly spinning like a plumbob. Everything except the book is built from
// primitives, so the whole set costs one texture (the real book cover).
import * as THREE from 'three';

const COVER = '/images/book-cover.jpg';

const INK = 0x1b1a19;
const WHITE = 0xfbf9f5;
const ACCENT = 0xe1a511;   // the book's orange, sampled from the cover art
const BLUE = 0x312dfb;     // the site's accent
const PAGE = 0xf1ece1;
const SPINE = 0xd2960f;

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

function buildBook(renderer) {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(COVER);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  // 6x9in paperback, ~0.7in thick — proportions taken from the real copy
  const W = 0.28, H = 0.4, D = 0.034;
  const cover = new THREE.MeshBasicMaterial({ map: tex }); // unlit: art stays true
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z (cover faces +z)
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [lambert(PAGE), lambert(SPINE), lambert(PAGE), lambert(PAGE), cover, lambert(ACCENT)],
  ));
  return g;
}

function buildMic() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), lambert(0x3a3a3a));
  head.scale.set(1, 1.05, 1);
  head.position.y = 0.13;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), lambert(ACCENT));
  collar.position.y = 0.045;
  collar.rotation.x = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.26, 16), lambert(INK));
  handle.position.y = -0.09;
  g.add(head, collar, handle);
  return g;
}

function buildEnvelope() {
  const g = new THREE.Group();
  const W = 0.34, H = 0.23;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), lambert(WHITE)));
  // the flap: a flat triangle sitting just proud of the front face
  const flap = new THREE.Shape();
  flap.moveTo(-W / 2, H / 2);
  flap.lineTo(W / 2, H / 2);
  flap.lineTo(0, -H / 12);
  flap.closePath();
  const flapMesh = new THREE.Mesh(new THREE.ShapeGeometry(flap), lambert(0xe4ded2));
  flapMesh.position.z = 0.011;
  const back = flapMesh.clone();
  back.position.z = -0.011;
  back.rotation.y = Math.PI;
  g.add(flapMesh, back);
  return g;
}

function buildBubble() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), lambert(WHITE));
  body.scale.set(1.25, 0.85, 0.55);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 12), lambert(WHITE));
  tail.position.set(-0.05, -0.15, 0);
  tail.rotation.z = 0.4;
  tail.scale.z = 0.55;
  g.add(body, tail);
  for (let i = -1; i <= 1; i++) { // "..." so it reads as a message
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), lambert(BLUE));
    dot.position.set(i * 0.07, 0, 0.09);
    g.add(dot);
  }
  return g;
}

const BUILDERS = { book: buildBook, mic: buildMic, envelope: buildEnvelope, bubble: buildBubble };

export function createProps({ scene, renderer }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const items = {};
  for (const [key, build] of Object.entries(BUILDERS)) {
    const obj = build(renderer);
    obj.visible = false;
    root.add(obj);
    items[key] = obj;
  }

  let base = 1;
  let baseY = 0;
  let current = null;
  let t = 0;

  function setLayout({ position, scale }) {
    root.position.copy(position);
    baseY = position.y;
    base = scale;
  }

  function setItem(key) {
    current = key && items[key] ? key : null;
    for (const [k, obj] of Object.entries(items)) obj.visible = k === current;
  }

  // 0 = absent, 1 = fully present. Scene eases this so items pop in and out.
  function setAmount(k) {
    root.visible = k > 0.001 && !!current;
    if (!root.visible) return;
    root.scale.setScalar(base * (0.55 + 0.45 * k));
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.transparent = k < 0.999;
        m.opacity = k;
        m.depthWrite = k > 0.5;
      }
    });
  }

  // Plumbob motion: a slow constant spin plus a gentle bob.
  function update(dt) {
    if (!root.visible) return;
    t += dt;
    root.rotation.y = t * 0.7;
    root.position.y = baseY + Math.sin(t * 1.6) * 0.03;
  }

  return { setLayout, setItem, setAmount, update, root };
}
