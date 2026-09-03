// Procedural performance for the rigged figure. Nothing here is a baked clip:
// every frame composes additive euler offsets on top of the GLB's rest pose —
// breathing and a weight shift underneath, the cursor look spread up the
// spine, a held-object pose, and one-shot reactions layered on top. That
// layering is what makes him read as somebody standing there rather than a
// prop being rotated.
//
// Axis map, measured against this rig (poke a bone and look — see DESIGN.md):
//   Head.x  negative = looks up          Head.y positive = turns to his left
//   Head.z  positive = tilts toward his right shoulder
// The arms are never driven by euler axes: their local axes are tilted, so a
// single-axis rotation sweeps a cone (RightArm.x "down" swung the arm behind
// him). Upper arms AND forearms are aimed at directions in the figure's frame
// every frame — see aimBone — which is what gives him real elbows.
import * as THREE from 'three';

// Which joints share the look, and how much each takes. Spreading it down the
// spine is what stops him reading like an owl bolted to a turntable.
const LOOK_CHAIN = [
  ['Spine02', 0.05],
  ['Spine01', 0.09],
  ['Spine', 0.13],
  ['neck', 0.24],
  ['Head', 0.49],
];

// Directions in the figure's frame: his right is −x, up +y, forward +z.
// `up` is the upper arm (shoulder → elbow), `fore` the forearm (elbow → wrist).
const R = (up, fore) => ({ up, fore });
const L = ({ up, fore }) => ({ up: [-up[0], up[1], up[2]], fore: [-fore[0], fore[1], fore[2]] });

// Poses: where the arms go and how the head sits while he holds something.
// Tuned by looking at him hold each prop; the prop positions live in props.js.
const HANG = R([-0.13, -0.99, 0.04], [-0.08, -0.98, 0.18]);
// Twist of each forearm about its own length, in radians: the A-pose scan
// has the palms facing out, a person at rest has them facing the thigh.
// ?twist= tunes it while a new model is calibrated.
const HAND_TWIST = parseFloat(new URLSearchParams(location.search).get('twist') ?? '-0.8');
// Finger curl, radians about the finger bone's x (measured: +x curls toward
// the palm). The scan has no finger bones; tools/model/fingers adds one per
// hand at the knuckles. A relaxed hand curls a little, a hand around a cup
// a lot. ?curl= tunes the rest value.
const REST_CURL = parseFloat(new URLSearchParams(location.search).get('curl') ?? '0.55');
export const POSES = {
  hang: { right: HANG, left: L(HANG), headPitch: 0, headRoll: 0, twist: HAND_TWIST, curl: REST_CURL },
  // Both hands out front under a laptop, eyes on the screen.
  laptop: {
    right: R([-0.34, -0.86, 0.38], [0.22, -0.18, 0.96]),
    left: L(R([-0.34, -0.86, 0.38], [0.22, -0.18, 0.96])),
    headPitch: 0, headRoll: 0, curl: 0.5,
  },
  // Book held up at the chest, head down into it.
  book: {
    right: R([-0.30, -0.84, 0.45], [0.46, 0.34, 0.82]),
    left: L(R([-0.30, -0.84, 0.45], [0.46, 0.34, 0.82])),
    headPitch: 0, headRoll: 0.04, curl: 0.5,
  },
  // Left hand carries the notebook; right hand writes in it.
  notebook: {
    right: R([-0.28, -0.84, 0.46], [0.62, 0.32, 0.72]),
    left: L(R([-0.34, -0.86, 0.38], [0.45, 0.22, 0.87])),
    headPitch: 0, headRoll: -0.05, curl: 0.8,
  },
  // To-go cup held up at the chest in the right hand, left arm hanging.
  coffee: {
    right: R([-0.30, -0.88, 0.36], [0.30, 0.62, 0.72]),
    left: L(HANG),
    headPitch: -0.04, headRoll: 0.03, curl: 1.0,
  },
  // Phone to the right ear, left arm hanging.
  phone: {
    right: R([-0.42, -0.86, 0.30], [0.42, 0.80, 0.42]),
    left: L(HANG),
    headPitch: 0.02, headRoll: 0.12, curl: 0.9,
  },
};

const bell = (u) => Math.sin(Math.PI * u);              // 0 → 1 → 0
const smooth = (u) => u * u * (3 - 2 * u);
// Rises fast, holds, releases — for a look that lands somewhere and stays.
const hold = (u, up = 0.25, down = 0.72) =>
  u < up ? smooth(u / up) : u > down ? 1 - smooth((u - down) / (1 - down)) : 1;
const decay = (u, cycles = 1.5) => Math.sin(Math.PI * 2 * cycles * u) * (1 - u) ** 2;

// One-shot reactions. Each writes additive euler offsets through
// `add(bone, axis, v)` and nudges an arm through `arm(side, part, dir, k)`
// (k = 0 leaves it where the pose put it), for a normalised time u in [0,1].
// Durations are in seconds.
const REACTIONS = {
  // A short "got it" dip of the head.
  nod: { dur: 0.85, apply: (u, add) => {
    const s = bell(u);
    add('Head', 'x', 0.19 * s);
    add('neck', 'x', 0.07 * s);
  } },

  // Glances up at the prop that just appeared over his head, then comes back.
  glance: { dur: 1.55, apply: (u, add) => {
    const s = hold(u);
    add('Head', 'x', -0.40 * s);
    add('neck', 'x', -0.15 * s);
    add('Spine', 'x', -0.045 * s);
    add('Head', 'z', 0.05 * s);
  } },

  // Poked: a quick recoil that settles.
  recoil: { dur: 0.75, apply: (u, add, arm) => {
    const d = decay(u, 1.25);
    add('Spine02', 'x', 0.085 * d);
    add('Spine', 'x', 0.05 * d);
    add('Head', 'x', 0.13 * d);
    arm('right', 'up', [-0.45, -0.88, 0.10], Math.max(0, d));
    arm('left', 'up', [0.45, -0.88, 0.10], Math.max(0, d));
  } },

  // Both arms lift a little, head sinks — a shrug without shoulder joints.
  shrug: { dur: 1.15, apply: (u, add, arm) => {
    const s = hold(u, 0.3, 0.6);
    arm('right', 'up', [-0.42, -0.90, 0.08], s);
    arm('left', 'up', [0.42, -0.90, 0.08], s);
    add('Head', 'x', 0.07 * s);
    add('neck', 'x', 0.05 * s);
  } },
};

export function createRig(root) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  if (!bones.Head || !bones.RightArm || !bones.LeftArm) return null;

  // Rest pose, captured once — every layer is additive on top of this.
  root.updateMatrixWorld(true);
  const rest = new Map();
  const restWorldQ = new Map();
  for (const b of Object.values(bones)) {
    rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    restWorldQ.set(b, b.getWorldQuaternion(new THREE.Quaternion()));
  }

  const ARMS = {
    right: { up: [bones.RightArm, bones.RightForeArm], fore: [bones.RightForeArm, bones.RightHand] },
    left: { up: [bones.LeftArm, bones.LeftForeArm], fore: [bones.LeftForeArm, bones.LeftHand] },
  };

  // --- aiming ------------------------------------------------------------------
  // Point `bone` (whose child sits at child.position in its local frame) along
  // `dir`, given in the figure's frame. Solved against the bone's *rest* local
  // rotation so the twist stays what the artist gave it — only the swing
  // changes. Parents are refreshed first, so a forearm aims correctly whatever
  // the upper arm just did.
  const rootQ = new THREE.Quaternion();
  const _pq = new THREE.Quaternion(), _bw = new THREE.Quaternion(), _r = new THREE.Quaternion();
  const _c = new THREE.Vector3(), _w = new THREE.Vector3();
  const _t = new THREE.Quaternion();
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  function aimBone(bone, child, dir, twist = 0) {
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(_pq);
    _bw.copy(_pq).multiply(rest.get(bone).q).invert();     // world → bone's rest-local
    _w.set(dir[0], dir[1], dir[2]).applyQuaternion(rootQ).applyQuaternion(_bw).normalize();
    _c.copy(child.position).normalize();
    _r.setFromUnitVectors(_c, _w);
    bone.quaternion.copy(rest.get(bone).q).multiply(_r);
    if (twist) bone.quaternion.multiply(_t.setFromAxisAngle(_c, twist)); // about its own length
  }

  // --- pose blending -----------------------------------------------------------
  let poseFrom = POSES.hang, poseTo = POSES.hang, poseK = 1;
  const POSE_SPEED = 2.6;   // 1/s — roughly 0.4s to settle
  const lerpDir = (a, b, k, out) => out.set(
    a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k).normalize();
  const cur = { right: { up: new THREE.Vector3(), fore: new THREE.Vector3() },
    left: { up: new THREE.Vector3(), fore: new THREE.Vector3() } };
  const nudges = [];   // this frame's arm nudges from reactions: { side, part, dir, k }
  const arm = (side, part, dir, k) => { if (k > 0) nudges.push({ side, part, dir, k }); };

  function setPose(name) {
    const next = POSES[name] ?? POSES.hang;
    if (next === poseTo) return;
    // Blend from wherever he is now, not from the last pose's endpoint, and
    // drop any gesture in flight — a shrug finishing while he picks up the
    // book has him doing two things with one arm.
    poseFrom = snapshotPose();
    poseTo = next;
    poseK = 0;
    active.length = 0;
  }
  function snapshotPose() {
    const k = smooth(poseK);
    const mix = (a, b, i) => a[i] + (b[i] - a[i]) * k;
    const dir = (side, part) => [0, 1, 2].map((i) => mix(poseFrom[side][part], poseTo[side][part], i));
    return {
      right: { up: dir('right', 'up'), fore: dir('right', 'fore') },
      left: { up: dir('left', 'up'), fore: dir('left', 'fore') },
      headPitch: mix([poseFrom.headPitch], [poseTo.headPitch], 0),
      headRoll: mix([poseFrom.headRoll], [poseTo.headRoll], 0),
      twist: mix([poseFrom.twist ?? 0], [poseTo.twist ?? 0], 0),
      curl: mix([poseFrom.curl ?? 0], [poseTo.curl ?? 0], 0),
    };
  }

  // Business while holding something — typing, scribbling, talking, reading —
  // so the pose never freezes into a mannequin.
  function busywork(t, add, arm, k) {
    if (poseTo === POSES.laptop) {
      arm('right', 'fore', [0.22, -0.18 + Math.sin(t * 9) * 0.04, 0.96], k);
      arm('left', 'fore', [-0.22, -0.18 + Math.sin(t * 9 + 1.3) * 0.04, 0.96], k);
    } else if (poseTo === POSES.notebook) {
      arm('right', 'fore', [0.62 + Math.sin(t * 7) * 0.06, 0.32 + Math.cos(t * 5) * 0.04, 0.72], k);
    } else if (poseTo === POSES.phone) {
      add('Head', 'x', Math.sin(t * 3.1) * 0.02 * k);        // talking
      add('Head', 'y', Math.sin(t * 1.7) * 0.03 * k);
    } else if (poseTo === POSES.book) {
      add('Head', 'y', Math.sin(t * 0.9) * 0.025 * k);       // eyes across the page
    } else if (poseTo === POSES.coffee) {
      // a sip every so often: the cup comes up to the mouth and back
      const sip = Math.max(0, Math.sin(t * 0.55)) ** 6;
      arm('right', 'fore', [0.22, 0.86, 0.46], sip * k);
      add('Head', 'x', 0.10 * sip * k);
    }
  }

  const offs = new Map();   // bone name → {x,y,z} euler offset for this frame
  const add = (name, axis, v) => {
    if (!bones[name]) return;
    let o = offs.get(name);
    if (!o) offs.set(name, (o = { x: 0, y: 0, z: 0 }));
    o[axis] += v;
  };

  const look = { yaw: 0, pitch: 0 };
  const active = [];        // running one-shots: { def, t }
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();

  // Idle gaze drift: when nothing is driving him, he glances off and back
  // rather than staring dead ahead. Re-rolled each time it completes.
  let driftT = 0, driftDur = 4, driftYaw = 0, driftPitch = 0;
  function rollDrift() {
    driftT = 0;
    driftDur = 3.5 + Math.random() * 4;
    driftYaw = (Math.random() * 2 - 1) * 0.16;
    driftPitch = (Math.random() * 2 - 1) * 0.06;
  }
  rollDrift();

  function trigger(name) {
    const def = REACTIONS[name];
    if (!def) return;
    // Re-triggering the same reaction restarts it instead of stacking.
    const existing = active.find((a) => a.def === def);
    if (existing) existing.t = 0;
    else active.push({ def, t: 0 });
  }

  function setLook(yaw, pitch) { look.yaw = yaw; look.pitch = pitch; }

  // A bone's world position and its rotation *relative to rest*, for hanging
  // props off it: offsets given in the figure's frame at rest come out right
  // wherever the bone has moved since.
  // Returns fresh objects: callers compare two anchors in one frame.
  const _rq = new THREE.Quaternion();
  function anchor(name) {
    const b = bones[name];
    if (!b) return null;
    b.updateWorldMatrix(true, false);
    const pos = b.getWorldPosition(new THREE.Vector3());
    const q = b.getWorldQuaternion(new THREE.Quaternion()).multiply(_rq.copy(restWorldQ.get(b)).invert()); // delta from rest
    return { pos, q: q.multiply(rootQ) };
  }

  // idleness: 0 while the pointer is live, 1 once he has been left alone.
  function update(dt, t, idleness = 0) {
    offs.clear();
    nudges.length = 0;
    root.getWorldQuaternion(rootQ);
    if (poseK < 1) poseK = Math.min(1, poseK + dt * POSE_SPEED);
    const pk = smooth(poseK);

    // --- breath: the chest leads, the head rides on top of it ---------------
    const br = Math.sin(t * 1.15);
    add('Spine02', 'x', -0.009 * br);
    add('Spine01', 'x', -0.007 * br);
    add('Spine', 'x', -0.005 * br);
    add('Head', 'x', 0.004 * br);

    // --- weight shift: two slow sines so the cycle never repeats obviously --
    const w = Math.sin(t * 0.21) * 0.7 + Math.sin(t * 0.13 + 1.7) * 0.3;
    add('Hips', 'z', 0.030 * w);
    add('Spine02', 'z', -0.020 * w);
    add('Spine', 'z', -0.011 * w);
    add('Head', 'z', -0.010 * w);

    // --- look: shared out along the spine, plus where the pose puts his head
    driftT += dt;
    if (driftT > driftDur) rollDrift();
    const dk = idleness * bell(Math.min(1, driftT / driftDur));
    const headPitch = poseFrom.headPitch + (poseTo.headPitch - poseFrom.headPitch) * pk;
    const headRoll = poseFrom.headRoll + (poseTo.headRoll - poseFrom.headRoll) * pk;
    // Holding something, he keeps most of his attention on it.
    const attention = 1 - 0.65 * Math.abs(headPitch) / 0.5;
    const yaw = (look.yaw + driftYaw * dk) * attention;
    const pitch = (look.pitch + driftPitch * dk) * attention + headPitch;
    for (const [name, share] of LOOK_CHAIN) {
      add(name, 'y', yaw * share);
      add(name, 'x', -pitch * share);
    }
    // A head that turns also tips very slightly — pure yaw looks mechanical.
    add('Head', 'z', yaw * 0.10 + headRoll);

    // --- arms: the blended pose, then whatever he's busy with ---------------
    for (const side of ['right', 'left']) {
      lerpDir(poseFrom[side].up, poseTo[side].up, pk, cur[side].up);
      lerpDir(poseFrom[side].fore, poseTo[side].fore, pk, cur[side].fore);
    }
    // the hanging arms drift a touch outward with the lean
    if (poseTo === POSES.hang) {
      arm('right', 'up', [-0.40, -0.90, 0.06], Math.max(0, 0.12 * w));
      arm('left', 'up', [0.40, -0.90, 0.06], Math.max(0, -0.12 * w));
    }
    busywork(t, add, arm, pk);

    // --- one-shot reactions -------------------------------------------------
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      a.t += dt;
      const u = a.t / a.def.dur;
      if (u >= 1) { active.splice(i, 1); continue; }
      a.def.apply(u, add, arm);
    }
    for (const n of nudges) {
      const v = cur[n.side][n.part];
      lerpDir([v.x, v.y, v.z], n.dir, n.k, v);
    }

    // --- compose: torso and head from rest + offsets, then aim the arms ------
    for (const [name, o] of offs) {
      const b = bones[name];
      e.set(o.x, o.y, o.z, 'YXZ');
      b.quaternion.copy(rest.get(b).q).multiply(q.setFromEuler(e));
    }
    const twist = (poseFrom.twist ?? 0) + ((poseTo.twist ?? 0) - (poseFrom.twist ?? 0)) * pk;
    for (const side of ['right', 'left']) {
      const c = cur[side];
      aimBone(ARMS[side].up[0], ARMS[side].up[1], [c.up.x, c.up.y, c.up.z]);
      // the twist mirrors: a right forearm rolled in is a left one rolled the other way
      aimBone(ARMS[side].fore[0], ARMS[side].fore[1], [c.fore.x, c.fore.y, c.fore.z], side === 'right' ? twist : -twist);
    }
    // Fingers: the added knuckle bones, curled toward the palm.
    const curl = (poseFrom.curl ?? 0) + ((poseTo.curl ?? 0) - (poseFrom.curl ?? 0)) * pk;
    for (const name of ['RightFingers', 'LeftFingers']) {
      const b = bones[name];
      if (b) b.quaternion.copy(rest.get(b).q).multiply(_t.setFromAxisAngle(X_AXIS, curl));
    }
  }

  return { update, setLook, setPose, trigger, anchor, rootQ: () => rootQ, bones, root, isBusy: () => active.length > 0 };
}
