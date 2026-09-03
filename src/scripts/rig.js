// Procedural performance for the rigged figure. Nothing here is a baked clip:
// every frame composes additive euler offsets on top of the GLB's rest pose —
// breathing and a weight shift underneath, the cursor look spread up the
// spine, and one-shot reactions layered on top. That layering is what makes
// him read as somebody standing there rather than a prop being rotated.
//
// Axis map, measured against this rig (poke a bone and look — see DESIGN.md):
//   Head.x  negative = looks up          Head.y positive = turns to his left
//   Head.z  positive = tilts toward his right shoulder
//   RightForeArm.x negative = bends the elbow up
// The upper arms are NOT driven by euler axes: their local axes are tilted, so
// a single-axis rotation sweeps a cone (RightArm.x swings the arm *behind* him
// while looking "down" from the front). They are aimed instead — see swingTo.
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

// Where each upper arm points, in the figure's own frame (his right is −x,
// forward is +z). The generator delivers an A-pose; a person talking to you
// has their arms hanging, so `hang` is the base and the others are gesture
// targets a reaction blends toward.
const ARM_AIMS = {
  RightArm: {
    hang: [-0.13, -0.99, 0.04],
    raise: [-0.76, 0.58, 0.16],     // out and up: the wave
    present: [-0.55, -0.40, 0.72],  // forward and open
    lift: [-0.40, -0.90, 0.06],     // a little out: shrug / recoil
  },
  LeftArm: {
    hang: [0.13, -0.99, 0.04],
    raise: [0.76, 0.58, 0.16],
    present: [0.55, -0.40, 0.72],
    lift: [0.40, -0.90, 0.06],
  },
};

const bell = (u) => Math.sin(Math.PI * u);              // 0 → 1 → 0
const smooth = (u) => u * u * (3 - 2 * u);
// Rises fast, holds, releases — for a look that lands somewhere and stays.
const hold = (u, up = 0.25, down = 0.72) =>
  u < up ? smooth(u / up) : u > down ? 1 - smooth((u - down) / (1 - down)) : 1;
const decay = (u, cycles = 1.5) => Math.sin(Math.PI * 2 * cycles * u) * (1 - u) ** 2;

// One-shot reactions. Each writes additive euler offsets through
// `add(bone, axis, v)`, and aims an upper arm through `swing(bone, aim, k)`
// (k = 0 hanging, 1 fully at the aim), for a normalised time u in [0,1].
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

  // Right arm up and a few passes of the forearm. His right is the side the
  // text column sits on, so the wave reads as directed at the reader.
  wave: { dur: 2.0, apply: (u, add, swing) => {
    const env = bell(u);
    swing('RightArm', 'raise', env);
    add('RightForeArm', 'x', -0.55 * env);
    add('RightForeArm', 'y', Math.sin(u * Math.PI * 7) * 0.38 * env);
    add('Head', 'z', 0.06 * env);
    add('Spine', 'y', -0.05 * env);
  } },

  // An open-handed "here's the thing" gesture.
  present: { dur: 1.7, apply: (u, add, swing) => {
    const env = bell(u);
    swing('RightArm', 'present', env);
    add('RightForeArm', 'x', -0.30 * env);
    add('RightForeArm', 'y', -0.45 * env);
    add('Spine', 'y', -0.07 * env);
    add('Head', 'y', -0.05 * env);
  } },

  // Poked: a quick recoil that settles.
  recoil: { dur: 0.75, apply: (u, add, swing) => {
    const d = decay(u, 1.25);
    add('Spine02', 'x', 0.085 * d);
    add('Spine', 'x', 0.05 * d);
    add('Head', 'x', 0.13 * d);
    swing('RightArm', 'lift', Math.max(0, d));
    swing('LeftArm', 'lift', Math.max(0, d));
  } },

  // Both arms lift a little, head sinks — a shrug without shoulder joints.
  shrug: { dur: 1.15, apply: (u, add, swing) => {
    const s = hold(u, 0.3, 0.6);
    swing('RightArm', 'lift', s);
    swing('LeftArm', 'lift', s);
    add('Head', 'x', 0.07 * s);
    add('neck', 'x', 0.05 * s);
  } },
};

export function createRig(root) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  if (!bones.Head) return null;

  // Rest pose, captured once — every layer is additive on top of this.
  root.updateMatrixWorld(true);
  const rest = new Map();
  for (const b of Object.values(bones)) {
    rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
  }

  // --- arm aiming ------------------------------------------------------------
  // The local rotation that points `bone` (an upper arm) at `aim`, given in
  // the figure's frame. Solved in world space with the rest pose as reference:
  //   W' = R · W,  R = rotation taking the rest arm direction to the aim,
  //   local' = P⁻¹ · R · P · local   (P = parent's world rotation).
  // Solved once per aim at init, so the frame cost is a slerp.
  const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
  function swingTo(bone, child, aim) {
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const restDir = child.position.clone().applyQuaternion(boneQ).normalize();
    const wantDir = new THREE.Vector3(...aim).applyQuaternion(rootQ).normalize();
    const R = new THREE.Quaternion().setFromUnitVectors(restDir, wantDir);
    return parentQ.clone().invert().multiply(R).multiply(parentQ).multiply(bone.quaternion);
  }
  const armPose = {}; // bone name → { hang, raise, present, lift } local quaternions
  for (const [name, aims] of Object.entries(ARM_AIMS)) {
    const bone = bones[name], child = bones[name.replace('Arm', 'ForeArm')];
    if (!bone || !child) continue;
    armPose[name] = Object.fromEntries(Object.entries(aims).map(([k, v]) => [k, swingTo(bone, child, v)]));
  }

  const offs = new Map();   // bone name → {x,y,z} euler offset for this frame
  const add = (name, axis, v) => {
    if (!bones[name]) return;
    let o = offs.get(name);
    if (!o) offs.set(name, (o = { x: 0, y: 0, z: 0 }));
    o[axis] += v;
  };
  const swings = new Map(); // arm name → { aim, k } — strongest request wins
  const swing = (name, aim, k) => {
    if (!armPose[name]?.[aim]) return;
    const cur = swings.get(name);
    if (!cur || k > cur.k) swings.set(name, { aim, k });
  };

  const look = { yaw: 0, pitch: 0 };
  const active = [];        // running one-shots: { def, t }
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const base = new THREE.Quaternion();

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

  // idleness: 0 while the pointer is live, 1 once he has been left alone.
  function update(dt, t, idleness = 0) {
    offs.clear();
    swings.clear();

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
    // the hanging arms drift a touch outward with the lean
    swing('RightArm', 'lift', Math.max(0, 0.12 * w));
    swing('LeftArm', 'lift', Math.max(0, -0.12 * w));

    // --- look: shared out along the spine ----------------------------------
    driftT += dt;
    if (driftT > driftDur) rollDrift();
    const dk = idleness * bell(Math.min(1, driftT / driftDur));
    const yaw = look.yaw + driftYaw * dk;
    const pitch = look.pitch + driftPitch * dk;
    for (const [name, share] of LOOK_CHAIN) {
      add(name, 'y', yaw * share);
      add(name, 'x', -pitch * share);
    }
    // A head that turns also tips very slightly — pure yaw looks mechanical.
    add('Head', 'z', yaw * 0.10);

    // --- one-shot reactions -------------------------------------------------
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      a.t += dt;
      const u = a.t / a.def.dur;
      if (u >= 1) { active.splice(i, 1); continue; }
      a.def.apply(u, add, swing);
    }

    // --- compose: arms from their aimed base, everything else from rest ----
    for (const name of Object.keys(armPose)) {
      const req = swings.get(name);
      base.copy(armPose[name].hang);
      if (req) base.slerp(armPose[name][req.aim], req.k);
      bones[name].quaternion.copy(base);
    }
    for (const [name, o] of offs) {
      const b = bones[name];
      const from = armPose[name] ? b.quaternion : rest.get(b).q;
      e.set(o.x, o.y, o.z, 'YXZ');
      b.quaternion.copy(from).multiply(q.setFromEuler(e));
    }
  }

  return { update, setLook, trigger, bones, isBusy: () => active.length > 0 };
}
