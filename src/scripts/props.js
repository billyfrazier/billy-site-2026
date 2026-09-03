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

// A 12oz to-go cup: tapered paper cup, kraft sleeve, dark lid. Up is +y.
function buildCoffee() {
  const g = new THREE.Group();
  const H = 0.11;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.032, H, 24), lambert(0xf3efe6));
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.036, H * 0.42, 24), lambert(0xb99566));
  sleeve.position.y = -H * 0.05;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24), lambert(0x2b2a29));
  lid.position.y = H / 2 + 0.006;
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.042, 0.010, 24), lambert(0x2b2a29));
  dome.position.y = H / 2 + 0.017;
  g.add(cup, sleeve, lid, dome);
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

// Where each prop sits. `anchor: 'hands'` puts it between the two hands —
// centred on their midpoint, its x-axis along the line from right hand to
// left — so a two-handed object is *in* the hands wherever the pose lands
// them. Single-bone anchors take an offset in the figure's frame at rest
// (metres) and an orientation there (euler, radians). There are no finger
// bones, so an object overlapping the palm is what "held" looks like.
const ITEMS = {
  // Offsets lean toward the camera (+z): the hands are flat, so an object a
  // few cm in front of the palm reads as gripped, one through it as clipped.
  laptop: [{ build: buildLaptop, anchor: 'hands', offset: [0, -0.02, 0.045], rot: [0.06, 0, 0] }],
  book: [{ build: buildBook, anchor: 'hands', offset: [0, 0.03, 0.03], rot: [-0.45, 0, 0] }],
  // Hand bones sit at the wrist; `along` walks out toward the fingers along
  // the forearm's direction (metres). `fixedRot` orients in the figure's frame
  // rather than the wrist's — the wrist's twist is whatever the scan gave it.
  notebook: [
    { build: buildNotebook, anchor: 'LeftHand', along: 0.05, offset: [0, 0.02, 0.01], rot: [-0.85, 0.15, 0], fixedRot: true },
    // tip (−y) down and forward into the page
    { build: buildPencil, anchor: 'RightHand', along: 0.07, offset: [0, 0.03, 0.0], rot: [0.55, 0, -0.45], fixedRot: true },
  ],
  coffee: [{ build: buildCoffee, anchor: 'RightHand', along: 0.05, offset: [-0.012, 0.015, 0.045], rot: [0, 0, 0], fixedRot: true }],
  // His right is −x: the phone sits in the palm, flat against the ear.
  phone: [{ build: buildPhone, anchor: 'RightHand', along: 0.05, offset: [-0.02, 0.01, 0.02], rot: [0.10, 0.55, -0.20], fixedRot: true }],
};

// Floating versions: one composite object per chip, spun over his head like a
// plumbob. The pencil lies across the notebook so the pair reads as one thing.
const FLOAT_ITEMS = {
  book: (r) => { const g = buildBook(r); return g; },
  notebook: () => {
    const g = new THREE.Group();
    const nb = buildNotebook();
    const pen = buildPencil();
    pen.position.set(0.01, 0.0, 0.012);
    pen.rotation.z = -0.55;
    g.add(nb, pen);
    return g;
  },
  phone: () => buildPhone(),
  coffee: () => buildCoffee(),
};
const FLOAT_SCALE = 1.6;   // × the figure's scale — real size is too small to read up there
const FLOAT_GAP = 0.05;    // metres of clear air above the crown

export function createProps({ scene, renderer, mode = 'float' }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const items = {};
  const source = mode === 'float' ? FLOAT_ITEMS : ITEMS;
  for (const [key, def] of Object.entries(source)) {
    const parts = mode === 'float' ? [{ build: def }] : def;
    items[key] = parts.map((p) => {
      const obj = p.build(renderer);
      obj.visible = false;
      root.add(obj);
      const halfH = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).y / 2;
      return { ...p, obj, halfH, eul: new THREE.Euler(...(p.rot ?? [0, 0, 0])) };
    });
  }

  let current = null;
  let amount = 0;
  let t = 0;
  const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _dir = new THREE.Vector3();

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

  // Between the hands: midpoint, with x along right → left hand and y kept
  // as close to the figure's up as that allows.
  const _r = new THREE.Vector3(), _l = new THREE.Vector3(), _x = new THREE.Vector3();
  const _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
  const _hands = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  function handsAnchor(rig) {
    const r = rig.anchor('RightHand'); if (!r) return null;
    _r.copy(r.pos);
    const l = rig.anchor('LeftHand'); if (!l) return null;
    _l.copy(l.pos);
    _hands.pos.copy(_r).add(_l).multiplyScalar(0.5);
    _x.copy(_l).sub(_r).normalize();                       // figure's +x is his left
    _y.set(0, 1, 0).applyQuaternion(rig.rootQ());
    _z.crossVectors(_x, _y).normalize();
    _y.crossVectors(_z, _x).normalize();
    _hands.q.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    return _hands;
  }

  // Float mode: the item hangs a fixed gap above the crown (head_end bone),
  // riding with his head, spinning slowly with a gentle bob.
  function updateFloat(dt, rig) {
    const crown = rig.anchor('head_end');
    if (!crown) return;
    t += dt;
    rig.root.getWorldScale(_s);
    const p = items[current][0];
    const scale = _s.x * FLOAT_SCALE * (0.55 + 0.45 * amount);
    p.obj.visible = true;
    p.obj.scale.setScalar(scale);
    p.obj.position.copy(crown.pos);
    p.obj.position.y += FLOAT_GAP * _s.x + p.halfH * scale + Math.sin(t * 1.6) * 0.03;
    p.obj.rotation.set(0, t * 0.7, 0);
  }

  // Place every part of the current item. Needs the rig, which has already
  // posed him this frame.
  function update(dt, rig) {
    if (!root.visible || !current || !rig) return;
    if (mode === 'float') return updateFloat(dt, rig);
    rig.root.getWorldScale(_s);
    const scale = _s.x * (0.7 + 0.3 * amount);
    for (const p of items[current]) {
      const a = p.anchor === 'hands' ? handsAnchor(rig) : rig.anchor(p.anchor);
      if (!a) { p.obj.visible = false; continue; }
      p.obj.visible = true;
      p.obj.position.copy(a.pos);
      if (p.along) {
        // out from the wrist toward the fingers: continue the forearm's line
        const fore = rig.anchor(p.anchor.replace('Hand', 'ForeArm'));
        if (fore) { _dir.copy(a.pos).sub(fore.pos).normalize(); p.obj.position.addScaledVector(_dir, p.along * _s.x); }
      }
      const frame = p.fixedRot ? rig.rootQ() : a.q;
      _off.set(p.offset[0], p.offset[1], p.offset[2]).multiplyScalar(_s.x).applyQuaternion(frame);
      p.obj.position.add(_off);
      p.obj.quaternion.copy(frame).multiply(_q.setFromEuler(p.eul));
      p.obj.scale.setScalar(scale);
    }
  }

  return { setItem, setAmount, update, root };
}
