// Three.js stage: grey studio (CSS gradient behind an alpha canvas), the bust,
// and the render loop. Loaded eagerly one frame after first paint — this scene
// is the page's subject, not an enhancement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createControls } from './controls.js';
import { createBlink } from './blink.js';
import { createProps } from './props.js';
import { createRig } from './rig.js';

// Flip to false once public/models/billy-bust.glb exists.
const PLACEHOLDER = !document.body.dataset.hasBust;

// Pose calibration: squares the mesh's baked-in leftward pose to the camera.
// Overridable for tuning via ?bodyyaw= & ?headyaw= (dev only, harmless in prod).
const q = new URLSearchParams(location.search);
const BODY_YAW = parseFloat(q.get('bodyyaw') ?? '0.1');
const HEAD_REST_YAW = parseFloat(q.get('headyaw') ?? '-0.12');
const BODY_TILT = parseFloat(q.get('tilt') ?? '0');
// The rigged full-body figure; ?model=bust loads the earlier head-and-shoulders one.
const MODEL_URL = q.get('model') === 'bust' ? '/models/billy-bust.glb'
  : q.get('model') === 'src' ? '/models/billy-body-src.glb'   // dev: uncompressed, for texture edits
  : '/models/billy-body.glb';

export function initScene({ stage, motionChip, onProgress }) {
  const canvas = document.createElement('canvas');
  try {
    if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) return;
  } catch {
    return;
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);

  const narrow = matchMedia('(max-width: 720px)');
  const pivot = new THREE.Group();
  scene.add(pivot);
  let headBone = null; // set once the GLB is skinned; shoulders stay on the pivot
  let blink = null;   // eye blink, created once the mesh is skinned
  let props = null;   // floating prop above the head, created with the bust
  let rig = null;     // full-body performance layer (rigged model only)
  let swapT = 0, swapTarget = 0; // 0 = showing Billy, 1 = showing the prop
  let bodyBox = null; // world-space proxy for "is the cursor over him"
  let figure = null;
  let lastDt = 0;

  function updateBodyBox() {
    if (!figure) return;
    pivot.updateMatrixWorld(true);
    bodyBox = new THREE.Box3().setFromObject(figure);
  }

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (narrow.matches) {
      // Framed in the clear space above the text sheet
      // Phones crop to the upper body so he stays legible above the text sheet
      pivot.position.set(0.04, parseFloat(q.get('moby') ?? '-0.06'), 0);
      pivot.scale.setScalar(parseFloat(q.get('mobs') ?? '1.0'));
      camera.position.set(0, 0.1, 3.1);
    } else {
      // Larger and lower than the raw fit so the shoulders bleed off-screen.
      // Bust and camera share x=0: a dead-on, square perspective — the
      // right-of-center placement comes from a CSS translate on the canvas.
      pivot.position.set(0, parseFloat(q.get('busty') ?? '0.0'), 0);
      pivot.scale.setScalar(parseFloat(q.get('busts') ?? '0.8'));
      camera.position.set(0, 0.1, 2.9);
    }
    camera.lookAt(0, 0.1, 0);
  }
  layout();
  addEventListener('resize', () => { layout(); updateBodyBox(); if (!running) renderOnce(); });

  // Neutral studio lighting (used by placeholder and PBR GLBs; harmless for unlit)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ccd2, 1.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(-2, 2.5, 3);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xdfe6f0, 1.0);
  rim.position.set(2.5, 1, -2);
  scene.add(rim);

  const controls = createControls({ canvas, motionChip });
  window.__bfDbg = { THREE, camera, scene, pivot }; // debug/test handle

  // --- looking at the cursor ------------------------------------------------
  // Aim at the point under the pointer on a plane a metre in front of him,
  // rather than mapping screen position straight to an angle: the plane keeps
  // the turn proportional to the real geometry, so he tracks the cursor instead
  // of just leaning with it. The canvas is CSS-shifted (translateX(14vw)) on
  // desktop, so NDC has to come from the canvas rect, not the window.
  const LOOK_PLANE = 1.0;   // metres in front of his head
  const MAX_LOOK_YAW = 0.62;
  const MAX_LOOK_PITCH = 0.30;
  const raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _headW = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _plane = new THREE.Plane();
  const _dir = new THREE.Vector3();

  function pointerToNdc(cx, cy) {
    const r = canvas.getBoundingClientRect();
    _ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    return _ndc;
  }

  // Where the pointer lands in the world, on the look plane. Also the hit test
  // for "is the cursor over him" — a box proxy, not the 33k-triangle mesh.
  function pointerWorld(cx, cy) {
    if (!headBone) return null;
    headBone.getWorldPosition(_headW);
    raycaster.setFromCamera(pointerToNdc(cx, cy), camera);
    _plane.set(new THREE.Vector3(0, 0, 1), -(_headW.z + LOOK_PLANE));
    return raycaster.ray.intersectPlane(_plane, _target) ? _target : null;
  }

  function updateLookFromPointer(cx, cy) {
    const hit = pointerWorld(cx, cy);
    if (!hit) return;
    _dir.copy(hit).sub(_headW);
    pivot.updateMatrixWorld();
    // Into the figure's own frame, so his body yaw does not skew the aim.
    _dir.applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion()).invert());
    const flat = Math.hypot(_dir.x, _dir.z) || 1e-4;
    const yaw = Math.atan2(_dir.x, _dir.z) - BODY_YAW;
    const pitch = Math.atan2(_dir.y, flat);
    controls.state.tYaw = Math.max(-MAX_LOOK_YAW, Math.min(MAX_LOOK_YAW, yaw));
    controls.state.tPitch = Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, pitch));
    controls.state.lastInput = performance.now();
  }

  // Hover and poke. The canvas sits behind the text column and takes no pointer
  // events, so both ride on window listeners and a ray/box test instead.
  let hovering = false;
  function overFigure(cx, cy) {
    if (!bodyBox) return false;
    raycaster.setFromCamera(pointerToNdc(cx, cy), camera);
    return raycaster.ray.intersectsBox(bodyBox);
  }

  // These listeners are registered after the ones inside createControls, so the
  // accurate aim overwrites the controls' straight screen-to-angle map. If
  // there is no head bone to aim (the placeholder figure), this bails early and
  // that simpler mapping is what stands.
  if (!reduced && !matchMedia('(pointer: coarse)').matches) {
    addEventListener('pointermove', (e) => {
      updateLookFromPointer(e.clientX, e.clientY);
      const over = overFigure(e.clientX, e.clientY);
      if (over !== hovering) {
        hovering = over;
        if (over) rig?.trigger('nod');   // he clocks you arriving
      }
    }, { passive: true });

    addEventListener('pointerdown', (e) => {
      // Never steal a click meant for a chip, link or button.
      if (e.target instanceof Element && e.target.closest('button, a, input')) return;
      if (!overFigure(e.clientX, e.clientY)) return;
      rig?.trigger('recoil');
    }, { passive: true });
  }

  function buildPlaceholder() {
    // Stand-in bust: capsule torso + sphere head, matcap-ish grey. Swapped for the GLB later.
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.55, metalness: 0.05 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.35, 8, 24), mat);
    torso.position.y = -0.62;
    torso.scale.z = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), mat);
    head.scale.set(0.82, 1, 0.88);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.25, 16), mat);
    neck.position.y = -0.36;
    // A nose, so head orientation is visible on an otherwise symmetric stand-in
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), mat);
    nose.position.set(0, -0.02, 0.31);
    nose.rotation.x = Math.PI / 2;
    g.add(torso, neck, head, nose);
    return g;
  }

  // Render loop — paused when the tab is hidden (page never scrolls)
  const clock = new THREE.Clock();
  let elapsed = 0;
  let running = false;
  let rafId = 0;

  function renderOnce() {
    if (rig) {
      // Full rig: the look is shared up the spine and layered under breathing,
      // a weight shift and any running reaction.
      const idle = Math.min(1, Math.max(0, (performance.now() - controls.state.lastInput - 2500) / 3000));
      // No rest offset here: HEAD_REST_YAW counters a head-turn baked into the
      // *bust* mesh. This rig's head bone is already neutral, and the aim above
      // is computed in his own frame — adding it would skew his gaze off you.
      rig.setLook(controls.state.yaw, controls.state.pitch);
      rig.update(lastDt, elapsed, idle);
      props?.update(lastDt, rig);   // held props sit on bones: place them after the pose
    } else if (headBone) {
      // Unrigged bust: only the head follows; shoulders stay still on the pivot.
      // The rest offset counters the head-turn baked into the mesh geometry.
      headBone.rotation.y = HEAD_REST_YAW + controls.state.yaw; // rest: face front
      headBone.rotation.x = -controls.state.pitch;
    } else {
      pivot.rotation.y = controls.state.yaw;
      pivot.rotation.x = -controls.state.pitch;
    }
    renderer.render(scene, camera);
  }

  function frame() {
    window.__bfFrames = (window.__bfFrames ?? 0) + 1; // debug/test handle
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    lastDt = dt;
    elapsed += dt;
    controls.update(dt, elapsed);
    blink?.update(dt);
    swapT += (swapTarget - swapT) * (1 - Math.exp(-7 * dt));
    if (Math.abs(swapTarget - swapT) < 0.002) swapT = swapTarget;
    applySwap();
    renderOnce();
  }

  function start() {
    if (running || reduced) return;
    running = true;
    clock.getDelta();
    frame();
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  // Which reply puts what in his hands. The pose of the same name in rig.js
  // brings his arms and head to it.
  const PROP_FOR = { help: 'laptop', book: 'book', substack: 'notebook', contact: 'phone' };

  function wireProps() {
    props = createProps({ scene, renderer });
    layout(); // re-run so the prop picks up its per-breakpoint placement
    document.addEventListener('bf:reply', (e) => {
      const item = PROP_FOR[e.detail.key];
      if (item) props.setItem(item);      // swap the object while it is hidden
      swapTarget = item ? 1 : 0;
      rig?.setPose(item ?? 'hang');       // arms and head go to the object (or back)
      if (!item) rig?.trigger('shrug');   // reset: back to nothing in particular
      if (!running) { swapT = swapTarget; applySwap(); renderOnce(); } // no loop: snap
    });
    // Dev: ?pose=laptop|book|notebook|phone lands him in that pose on load.
    const dev = q.get('pose');
    if (dev) {
      const key = Object.keys(PROP_FOR).find((k) => PROP_FOR[k] === dev);
      if (key) document.dispatchEvent(new CustomEvent('bf:reply', { detail: { key } }));
    }
  }

  // The figure stays; the item above the head fades in and out.
  function applySwap() {
    props?.setAmount(swapT);
  }

  function attach(bust) {
    pivot.add(bust);
    renderOnce(); // synchronous first frame — never gate visibility on the loop
    canvas.classList.add('is-ready');
    wireProps();
    // A hello once he's in — also the only place the wave is used now that the
    // chips put things in his hands instead.
    if (rig && !reduced && !q.get('pose')) setTimeout(() => rig?.trigger('wave'), 900);
    onProgress?.(1);
    if (!reduced) start();
  }

  stage.appendChild(canvas);

  // The GLB is a single unrigged mesh. Give it two bones at runtime — a still
  // root (shoulders) and a head bone — with a smoothstep blend band across the
  // neck, so the head turns like a person and not like a statue on a turntable.
  const NECK_BLEND_START = parseFloat(q.get('neck0') ?? '0.28'); // fraction of mesh height where the neck begins
  const NECK_BLEND_END = parseFloat(q.get('neck1') ?? '0.42');   // fully head above this
  function skinBust(bust) {
    let source = null;
    bust.traverse((o) => { if (o.isMesh && !source) source = o; });
    if (!source) return null;

    const geo = source.geometry;
    geo.computeBoundingBox();
    const minY = geo.boundingBox.min.y;
    const height = geo.boundingBox.max.y - minY;
    const y0 = minY + NECK_BLEND_START * height;
    const y1 = minY + NECK_BLEND_END * height;

    const pos = geo.attributes.position;
    const skinIndex = new Uint16Array(pos.count * 4);
    const skinWeight = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      let w = (pos.getY(i) - y0) / (y1 - y0);
      w = Math.max(0, Math.min(1, w));
      w = w * w * (3 - 2 * w); // smoothstep: gradual bend through the neck
      skinIndex[i * 4] = 0;
      skinIndex[i * 4 + 1] = 1;
      skinWeight[i * 4] = 1 - w;
      skinWeight[i * 4 + 1] = w;
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

    const rootBone = new THREE.Bone();
    const neckBone = new THREE.Bone();
    neckBone.position.y = y0; // head rotates about the base of the neck
    rootBone.add(neckBone);

    const skinned = new THREE.SkinnedMesh(geo, source.material);
    skinned.position.copy(source.position);
    skinned.rotation.copy(source.rotation);
    skinned.scale.copy(source.scale);
    skinned.add(rootBone);
    skinned.bind(new THREE.Skeleton([rootBone, neckBone]));
    source.parent.add(skinned);
    source.parent.remove(source);
    window.__bfMesh = skinned; // debug/test handle
    return neckBone;
  }

  if (PLACEHOLDER) {
    attach(buildPlaceholder());
  } else {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        const bust = gltf.scene;
        // Generators return arbitrary scale/orientation/origin — normalize at runtime
        const box = new THREE.Box3().setFromObject(bust);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        bust.position.sub(center);
        bust.scale.setScalar(1.55 / Math.max(size.x, size.y, size.z));
        bust.rotation.x = BODY_TILT; // per-model: the v2 scan gazed up (+0.13); v7 already leans forward
        bust.rotation.y = BODY_YAW; // square chest/shoulders to the camera
        // A rigged model already has a head bone; only the unrigged bust needs
        // the runtime two-bone hack.
        const bones = [];
        bust.traverse((o) => { if (o.isBone) bones.push(o); });
        window.__bfBones = bones.map((b) => b.name); // debug handle
        // Exact match first: this rig also carries `head_end` and `headfront`.
        headBone = bones.find((b) => b.name === 'Head') ?? bones.find((b) => /head/i.test(b.name)) ?? null;
        if (!headBone) {
          headBone = skinBust(bust);
          if (window.__bfMesh) blink = window.__bfBlink = createBlink(window.__bfMesh);
        } else {
          bust.traverse((o) => { if (o.isSkinnedMesh) window.__bfMesh = o; });
          rig = window.__bfRig = createRig(bust); // full humanoid rig: perform with it
        }
        window.__bfHeadBone = headBone;
        attach(bust);
        figure = bust;
        updateBodyBox();
      },
      (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
      () => { /* GLB failed: shell + chips still fully work */ },
    );
  }

}
