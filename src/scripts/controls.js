// Input layer: one damped {yaw, pitch} state shared by every input mode.
// The scene only ever reads state.yaw / state.pitch each frame.

const MAX_YAW = 0.5;
const MAX_PITCH = 0.28;
const BASE_YAW = 0; // rest facing the viewer; the head does the looking

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createControls({ canvas, motionChip }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(pointer: coarse)').matches;

  const state = {
    tYaw: BASE_YAW, tPitch: 0,
    yaw: BASE_YAW, pitch: 0,
    lastInput: 0,
  };
  let mode = 'idle'; // 'pointer' | 'tilt' | 'fallback' | 'idle'
  let glanceUntil = 0, glanceYaw = 0, glancePitch = 0;
  window.__bfState = state; // debug/test handle

  // Look somewhere specific for a moment (a prop above the head), then hand
  // control back to the pointer. Bypasses the normal clamps so he can look up
  // further than cursor-following ever asks for.
  function glanceAt(yaw, pitch, ms) {
    glanceYaw = yaw; glancePitch = pitch;
    glanceUntil = performance.now() + ms;
  }

  function update(dt, t) {
    if (reduced) { state.yaw = -0.22; state.pitch = 0.03; return; }
    if (performance.now() < glanceUntil) {
      state.tYaw = glanceYaw;
      state.tPitch = glancePitch;
      const gk = 1 - Math.exp(-5 * dt);
      state.yaw += (state.tYaw - state.yaw) * gk;
      state.pitch += (state.tPitch - state.pitch) * gk;
      return;
    }
    if ((mode === 'fallback' || mode === 'idle') && performance.now() - state.lastInput > 4000) {
      state.tYaw = BASE_YAW + Math.sin(t * 0.4) * 0.12; // slow idle sway
      state.tPitch = Math.sin(t * 0.27) * 0.04;
    }
    const k = 1 - Math.exp(-6 * dt);
    state.yaw += (state.tYaw - state.yaw) * k;
    state.pitch += (state.tPitch - state.pitch) * k;
  }

  if (reduced) return { state, update, glanceAt };

  if (!isTouch) {
    mode = 'pointer';
    addEventListener('pointermove', (e) => {
      state.tYaw = BASE_YAW + ((e.clientX / innerWidth) * 2 - 1) * MAX_YAW;
      state.tPitch = -((e.clientY / innerHeight) * 2 - 1) * MAX_PITCH;
      state.lastInput = performance.now();
    }, { passive: true });
    return { state, update, glanceAt };
  }

  // Touch devices: tilt (with iOS permission gesture) or drag/idle fallback
  function startFallback() {
    if (mode === 'fallback') return;
    mode = 'fallback';
    let dragging = false, px = 0, py = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      state.tYaw = clamp(state.tYaw + (e.clientX - px) * 0.005, BASE_YAW - MAX_YAW, BASE_YAW + MAX_YAW);
      state.tPitch = clamp(state.tPitch - (e.clientY - py) * 0.004, -MAX_PITCH, MAX_PITCH);
      px = e.clientX; py = e.clientY;
      state.lastInput = performance.now();
    }, { passive: true });
  }

  function startTilt() {
    let baseBeta = null;
    let got = false;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      got = true;
      mode = 'tilt';
      baseBeta ??= e.beta; // holding angle becomes neutral
      state.tYaw = BASE_YAW + clamp(e.gamma / 30, -1, 1) * MAX_YAW;
      state.tPitch = clamp((e.beta - baseBeta) / 30, -1, 1) * MAX_PITCH;
      state.lastInput = performance.now();
    });
    setTimeout(() => { if (!got) startFallback(); }, 1500);
  }

  async function enableTilt() {
    motionChip?.remove();
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return startFallback();
      } catch {
        return startFallback();
      }
    }
    startTilt();
  }

  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    // iOS 13+: needs a user gesture — surface the chip
    if (motionChip) {
      motionChip.hidden = false;
      motionChip.addEventListener('click', enableTilt);
    }
    startFallback(); // usable immediately; tilt upgrades it if granted
  } else if ('DeviceOrientationEvent' in window) {
    startTilt();
  } else {
    startFallback();
  }

  return { state, update, glanceAt };
}
