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

// A composition book: 7.5 × 9.75 in, black-and-white marbled cover with the
// white label, black cloth tape down the spine, cream page block. The cover
// is drawn to a canvas — the marble is random ink blots on white.
function drawCompositionCover() {
  const c = document.createElement('canvas'); c.width = 384; c.height = 500;
  const g = c.getContext('2d');
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 384, 500);
  // marble: two passes of irregular blots, dense enough to read as the pattern
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = '#141414';
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 384, y = rnd() * 500, r = 2 + rnd() * 7;
    g.beginPath();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * (0.6 + rnd() * 0.8); g.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  // black cloth spine
  g.fillStyle = '#111'; g.fillRect(0, 0, 46, 500);
  // the label
  g.fillStyle = '#fbfaf5'; g.beginPath(); g.roundRect(96, 150, 250, 190, 6); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(104, 158, 234, 174);
  g.fillStyle = '#222'; g.font = 'bold 22px Helvetica, Arial'; g.textAlign = 'center';
  g.fillText('COMPOSITIONS', 221, 205);
  g.strokeStyle = '#333'; g.lineWidth = 1.5;
  for (const y of [250, 285, 320]) { g.beginPath(); g.moveTo(124, y); g.lineTo(318, y); g.stroke(); }
  g.font = '13px Helvetica, Arial'; g.fillText('NAME', 150, 245);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function buildNotebook() {
  const g = new THREE.Group();
  const W = 0.19, H = 0.247, D = 0.014;
  const cover = new THREE.MeshLambertMaterial({ map: drawCompositionCover() });
  const spine = lambert(0x111111);
  // BoxGeometry order: +x, -x, +y, -y, +z, -z — spine on -x, marbled cover
  // front AND back (it spins; a black back read as a different object)
  g.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [lambert(PAGE), spine, lambert(PAGE), lambert(PAGE), cover, cover]));
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

// iPhone 15 Pro proportions: 70.6 × 146.6 × 8.25 mm, 12.5 mm corners. Screen
// on +z. It spins when floated, so the back — camera plateau, three lenses,
// flash — matters as much as the front. Screen content is drawn to a canvas:
// wallpaper, 9:41, the Dynamic Island, an app grid and the dock.
function roundedRect(w, h, r) {
  const sh = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y); sh.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  sh.lineTo(x + w, y + h - r); sh.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  sh.lineTo(x + r, y + h); sh.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(x, y + r); sh.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return sh;
}
function slab(w, h, d, r, mat, bevel = 0) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), {
    depth: d - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12,
  });
  geo.translate(0, 0, -(d - 2 * bevel) / 2);
  return new THREE.Mesh(geo, mat);
}
function drawScreen() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 532;
  const g = c.getContext('2d');
  // wallpaper: deep blue to violet with two soft glows
  const bg = g.createLinearGradient(0, 0, 0, 532);
  bg.addColorStop(0, '#0e1a3a'); bg.addColorStop(0.55, '#2a1f5c'); bg.addColorStop(1, '#5a2a63');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 532);
  for (const [x, y, r, col] of [[70, 170, 150, 'rgba(90,120,255,0.35)'], [210, 380, 170, 'rgba(255,110,150,0.30)']]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 532);
  }
  // status bar + Dynamic Island
  g.fillStyle = '#fff'; g.font = 'bold 15px -apple-system, Helvetica, Arial'; g.textBaseline = 'middle';
  g.fillText('9:41', 24, 22);
  g.textAlign = 'right'; g.font = 'bold 12px Helvetica, Arial'; g.fillText('●●● ▲ ▮', 236, 22); g.textAlign = 'left';
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(88, 12, 80, 22, 11); g.fill();
  // app grid: 4 × 5 rounded squares
  const cols = ['#34c759', '#ff9500', '#007aff', '#ff3b30', '#af52de', '#5ac8fa', '#ffcc00', '#8e8e93', '#30b0c7', '#ff2d55', '#a2845e', '#64d2ff', '#32ade6', '#ff6482', '#30d158', '#bf5af2', '#0a84ff', '#ffd60a', '#ac8e68', '#ff453a'];
  let i = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
    g.fillStyle = cols[i++ % cols.length];
    g.beginPath(); g.roundRect(22 + col * 56, 62 + row * 68, 42, 42, 11); g.fill();
  }
  // dock
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.roundRect(16, 448, 224, 66, 22); g.fill();
  for (let col = 0; col < 4; col++) {
    g.fillStyle = ['#34c759', '#007aff', '#ff9500', '#5ac8fa'][col];
    g.beginPath(); g.roundRect(28 + col * 54, 460, 42, 42, 11); g.fill();
  }
  // home indicator
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.roundRect(88, 520, 80, 5, 3); g.fill();
  // rounded screen corners: punch the corners out so the glass shows through
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(0, 0, 256, 532, 34); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function buildPhone() {
  const g = new THREE.Group();
  const W = 0.0706, H = 0.1466, D = 0.00825, R = 0.0125;
  const titanium = new THREE.MeshStandardMaterial({ color: 0x9a9a9e, metalness: 0.75, roughness: 0.32 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0.2, roughness: 0.15 });
  const backGlass = new THREE.MeshStandardMaterial({ color: 0x3a3b3f, metalness: 0.3, roughness: 0.45 });
  // frame, with a soft edge
  g.add(slab(W, H, D, R, titanium, 0.0006));
  // front glass, then the screen, sitting just proud of the frame
  const front = slab(W - 0.002, H - 0.002, 0.0008, R - 0.001, glass);
  front.position.z = D / 2 + 0.0002;
  g.add(front);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.0045, H - 0.0045),
    new THREE.MeshBasicMaterial({ map: drawScreen(), transparent: true }));
  screen.position.z = D / 2 + 0.0007;
  g.add(screen);
  // back glass
  const back = slab(W - 0.002, H - 0.002, 0.0008, R - 0.001, backGlass);
  back.position.z = -D / 2 - 0.0002;
  g.add(back);
  // camera plateau (top-left seen from the back = +x here since the back faces −z)
  const plateau = slab(0.0365, 0.0365, 0.0018, 0.008, new THREE.MeshStandardMaterial({ color: 0x4a4b50, metalness: 0.4, roughness: 0.4 }));
  plateau.position.set(W / 2 - 0.0225, H / 2 - 0.0225, -D / 2 - 0.0012);
  g.add(plateau);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x101216, metalness: 0.6, roughness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x77787c, metalness: 0.8, roughness: 0.3 });
  for (const [dx, dy] of [[-0.008, 0.0085], [-0.008, -0.0085], [0.0075, 0.0]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0016, 24), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(plateau.position.x + dx, plateau.position.y + dy, -D / 2 - 0.0028);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.0018, 24), lensMat);
    lens.rotation.x = Math.PI / 2; lens.position.copy(ring.position); lens.position.z -= 0.0002;
    g.add(ring, lens);
  }
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0006, 16), new THREE.MeshBasicMaterial({ color: 0xf6e9c8 }));
  flash.rotation.x = Math.PI / 2; flash.position.set(plateau.position.x + 0.0075, plateau.position.y + 0.011, -D / 2 - 0.0022);
  g.add(flash);
  // side buttons: action + volume on his left edge (−x), power on the right
  for (const [x, y, h] of [[-W / 2, 0.041, 0.006], [-W / 2, 0.026, 0.011], [-W / 2, 0.011, 0.011], [W / 2, 0.026, 0.017]]) {
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.0012, h, 0.0032), titanium);
    btn.position.set(x, y, 0);
    g.add(btn);
  }
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
    pen.position.set(0.02, 0.0, 0.012);
    pen.rotation.z = -0.6;
    g.add(nb, pen);
    return g;
  },
  phone: () => buildPhone(),
  coffee: () => buildCoffee(),
};
const FLOAT_SCALE = 1.25;  // × the figure's scale — real size is too small to read up there
const FLOAT_GAP = 0.14;    // metres of clear air above the crown

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
