// Eye blink for an unrigged photogrammetry mesh.
//
// The scan has no eyelid geometry and no blendshapes — the eyes are painted
// into a shattered UV atlas, so there is nothing to "close". Instead we squash
// the eye-aperture vertices vertically toward each eye's centre line for ~140ms,
// which reads as a blink in motion. Centres/extents below were measured by
// raycasting the eye corners (see DESIGN.md); they are specific to
// public/models/billy-bust.glb and must be re-measured if the model is replaced.

export const EYES = [
  { x: -0.3627, y: 0.4132, z: 0.2755 }, // viewer-left
  { x: -0.1296, y: 0.4511, z: 0.2591 }, // viewer-right
];

// Full strength inside the plateau, easing out to zero at the outer radius.
const H_PLATEAU = 0.045, H_OUTER = 0.075;
const V_PLATEAU = 0.030, V_OUTER = 0.060;

// Eyes close low: the upper lid travels down to meet a near-static lower lid,
// so collapse toward a line below the aperture centre rather than the centre.
const CLOSE_BIAS = 0.012;

const CLOSE_MS = 60;
const OPEN_MS = 90;
const MIN_GAP_MS = 5000;
const MAX_GAP_MS = 7000;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function createBlink(mesh, opts = {}) {
  const hPlateau = opts.hPlateau ?? H_PLATEAU;
  const hOuter = opts.hOuter ?? H_OUTER;
  const vPlateau = opts.vPlateau ?? V_PLATEAU;
  const vOuter = opts.vOuter ?? V_OUTER;

  const pos = mesh.geometry.attributes.position;
  const idx = [];
  const weight = [];
  const baseY = [];
  const centreY = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    for (const e of EYES) {
      const dh = Math.hypot(x - e.x, z - e.z);
      const dv = Math.abs(y - e.y);
      if (dh > hOuter || dv > vOuter) continue;
      const wh = dh <= hPlateau ? 1 : smooth(1 - (dh - hPlateau) / (hOuter - hPlateau));
      const wv = dv <= vPlateau ? 1 : smooth(1 - (dv - vPlateau) / (vOuter - vPlateau));
      const w = wh * wv;
      if (w > 0.001) { idx.push(i); weight.push(w); baseY.push(y); centreY.push(e.y - CLOSE_BIAS); }
      break;
    }
  }

  let elapsed = 0;
  let nextAt = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
  let applied = 0;

  function apply(amount) {
    if (amount === applied) return;
    for (let k = 0; k < idx.length; k++) {
      const s = 1 - amount * weight[k];
      pos.setY(idx[k], centreY[k] + (baseY[k] - centreY[k]) * s);
    }
    pos.needsUpdate = true;
    applied = amount;
  }

  function update(dt) {
    elapsed += dt * 1000;
    const since = elapsed - nextAt;
    if (since < 0) return;
    if (since < CLOSE_MS) {
      apply(smooth(since / CLOSE_MS));
    } else if (since < CLOSE_MS + OPEN_MS) {
      apply(smooth(1 - (since - CLOSE_MS) / OPEN_MS));
    } else {
      apply(0);
      elapsed = 0;
      nextAt = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    }
  }

  return { update, apply, count: idx.length };
}
