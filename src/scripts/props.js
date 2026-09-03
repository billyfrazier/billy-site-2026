// Held props: one object per chip, placed in his hands rather than floated
// over his head. Each is anchored to a bone with an offset given in the
// figure's frame at rest (his right −x, up +y, forward +z, metres), and rides
// that bone's movement since rest — so the phone stays on his ear when he
// turns his head, and the pencil stays in his hand as it scribbles. Everything
// except the book cover is primitives, so the set costs one texture.
import * as THREE from 'three';

const COVER = '/images/book-cover.jpg';

const INK = 0x1b1a19;
const ACCENT = 0xe1a511;   // the book's orange, sampled from the cover art
const PAGE = 0xf1ece1;
const SPINE = 0xd2960f;
const SPACE_GREY = 0x8d9096;
const SCREEN = 0x15171c;

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// 6x9in paperback, the real proportions. Cover faces +z.
function buildBook(renderer) {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(COVER);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const W = 0.152, H = 0.229, D = 0.018;
  const cover = new THREE.MeshBasicMaterial({ map: tex }); // unlit: art stays true
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  g.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
    [lambert(PAGE), lambert(SPINE), lambert(PAGE), lambert(PAGE), cover, lambert(ACCENT)]));
  return g;
}

// 14" MacBook Pro: base with a keyboard well, lid open ~105°, hinge at the back.
function buildLaptop() {
  const g = new THREE.Group();
  const W = 0.312, D = 0.221, T = 0.0155;
  const base = box(W, T, D, lambert(SPACE_GREY));
  const keys = box(W * 0.78, 0.002, D * 0.42, lambert(0x2a2c31));
  keys.position.set(0, T / 2 + 0.001, -D * 0.12);
  const pad = box(W * 0.36, 0.0015, D * 0.30, lambert(0x74777c));
  pad.position.set(0, T / 2 + 0.001, D * 0.28);
  // Lid: hinge on the far edge (+z, toward the camera), screen on the near
  // face so it faces him; the viewer sees the back of the lid, as they would.
  const lid = new THREE.Group();
  const shell = box(W, D, 0.004, lambert(SPACE_GREY));
  shell.position.y = D / 2;
  const screen = box(W * 0.94, D * 0.90, 0.001, new THREE.MeshBasicMaterial({ color: SCREEN }));
  screen.position.set(0, D / 2 + 0.01, -0.0026);
  const glow = box(W * 0.94, D * 0.90, 0.0005, new THREE.MeshBasicMaterial({ color: 0x3b4b6b }));
  glow.position.set(0, D / 2 + 0.01, -0.0031);
  lid.add(shell, screen, glow);
  lid.position.set(0, T / 2, D / 2);
  lid.rotation.x = THREE.MathUtils.degToRad(18); // open a little past vertical, leaning away from him
  g.add(base, keys, pad, lid);
  return g;
}

// A5 notebook, cream page block with a dark cover, lying open-flat is too
// much geometry to read at this size — closed, held like a clipboard.
function buildNotebook() {
  const g = new THREE.Group();
  const W = 0.148, H = 0.21, D = 0.014;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
    [lambert(PAGE), lambert(0x26241f), lambert(PAGE), lambert(PAGE), lambert(PAGE), lambert(0x26241f)]));
  // the open page faces him (+z is the figure's forward); a few ruled lines
  for (let i = -3; i <= 3; i++) {
    const line = box(W * 0.7, 0.0012, 0.0004, lambert(0xb9b2a2));
    line.position.set(0, i * 0.022, D / 2 + 0.0004);
    g.add(line);
  }
  return g;
}

// A pencil, tip toward −y so "down into the page" is the natural hold.
function buildPencil() {
  const g = new THREE.Group();
  const L = 0.175;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, L, 8), lambert(0xe3b52c));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.014, 8), lambert(0xd9c7a3));
  tip.position.y = -L / 2 - 0.007;
  tip.rotation.x = Math.PI;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0012, 0.004, 6), lambert(INK));
  lead.position.y = -L / 2 - 0.013;
  lead.rotation.x = Math.PI;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), lambert(0xc9c9c9));
  ferrule.position.y = L / 2 + 0.005;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.009, 8), lambert(0xe0a3a0));
  eraser.position.y = L / 2 + 0.015;
  g.add(body, tip, lead, ferrule, eraser);
  return g;
}

// iPhone, screen on +z.
function buildPhone() {
  const g = new THREE.Group();
  const W = 0.0716, H = 0.1476, D = 0.0078;
  g.add(box(W, H, D, lambert(INK)));
  const screen = box(W * 0.9, H * 0.94, 0.0006, new THREE.MeshBasicMaterial({ color: 0x1c2230 }));
  screen.position.z = D / 2 + 0.0003;
  g.add(screen);
  return g;
}

// Where each prop sits: bone, offset from that bone in the figure's frame at
// rest (metres), and its orientation there (euler, radians). Tuned by looking.
const ITEMS = {
  laptop: [{ build: buildLaptop, anchor: 'Spine', offset: [0.0, -0.30, 0.30], rot: [0.06, 0, 0] }],
  book: [{ build: buildBook, anchor: 'Spine', offset: [0.0, -0.17, 0.27], rot: [-0.45, 0, 0] }],
  notebook: [
    { build: buildNotebook, anchor: 'LeftHand', offset: [0.0, 0.07, 0.05], rot: [-0.85, 0.15, 0] },
    { build: buildPencil, anchor: 'RightHand', offset: [-0.01, 0.03, 0.05], rot: [-0.45, 0, 0.30] },
  ],
  // His right is −x: the phone sits just outside the hand, against the ear.
  phone: [{ build: buildPhone, anchor: 'RightHand', offset: [-0.035, 0.035, 0.03], rot: [0.10, 0.55, -0.20] }],
};

export function createProps({ scene, renderer }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const items = {};
  for (const [key, parts] of Object.entries(ITEMS)) {
    items[key] = parts.map((p) => {
      const obj = p.build(renderer);
      obj.visible = false;
      root.add(obj);
      return { ...p, obj, eul: new THREE.Euler(...p.rot) };
    });
  }

  let current = null;
  let amount = 0;
  const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

  function setItem(key) {
    current = key && items[key] ? key : null;
    for (const [k, parts] of Object.entries(items)) for (const p of parts) p.obj.visible = k === current;
  }

  // 0 = absent, 1 = fully present. Scene eases this so props pop in and out.
  function setAmount(k) {
    amount = k;
    root.visible = k > 0.001 && !!current;
    if (!root.visible) return;
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.transparent = k < 0.999;
        m.opacity = k;
        m.depthWrite = k > 0.5;
      }
    });
  }

  // Place every part of the current item on its bone. Needs the rig, which has
  // already posed him this frame.
  function update(dt, rig) {
    if (!root.visible || !current || !rig) return;
    rig.root.getWorldScale(_s);
    const scale = _s.x * (0.7 + 0.3 * amount);
    for (const p of items[current]) {
      const a = rig.anchor(p.anchor);
      if (!a) { p.obj.visible = false; continue; }
      p.obj.visible = true;
      _off.set(p.offset[0], p.offset[1], p.offset[2]).multiplyScalar(_s.x).applyQuaternion(a.q);
      p.obj.position.copy(a.pos).add(_off);
      p.obj.quaternion.copy(a.q).multiply(_q.setFromEuler(p.eul));
      p.obj.scale.setScalar(scale);
    }
  }

  return { setItem, setAmount, update, root };
}
