// Three.js stage: grey studio (CSS gradient behind an alpha canvas), the bust,
// and the render loop. Loaded eagerly one frame after first paint — this scene
// is the page's subject, not an enhancement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createControls } from './controls.js';

// Flip to false once public/models/billy-bust.glb exists.
const PLACEHOLDER = !document.body.dataset.hasBust;

// Pose calibration: squares the mesh's baked-in leftward pose to the camera.
// Overridable for tuning via ?bodyyaw= & ?headyaw= (dev only, harmless in prod).
const q = new URLSearchParams(location.search);
const BODY_YAW = parseFloat(q.get('bodyyaw') ?? '0.1');
const HEAD_REST_YAW = parseFloat(q.get('headyaw') ?? '0');
const MODEL_SUFFIX = q.get('model') ? `-${q.get('model')}` : ''; // dev: compare model candidates

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

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (narrow.matches) {
      pivot.position.set(0.06, 0.34, 0);
      pivot.scale.setScalar(0.7);
      camera.position.set(0, 0.1, 3.1);
    } else {
      // Larger and lower than the raw fit so the shoulders bleed off-screen.
      // Bust and camera share x=0: a dead-on, square perspective — the
      // right-of-center placement comes from a CSS translate on the canvas.
      pivot.position.set(0, -0.34, 0);
      pivot.scale.setScalar(1.28);
      camera.position.set(0, 0.1, 2.9);
    }
    camera.lookAt(0, 0.1, 0);
  }
  layout();
  addEventListener('resize', () => { layout(); if (!running) renderOnce(); });

  // Neutral studio lighting (used by placeholder and PBR GLBs; harmless for unlit)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ccd2, 1.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(-2, 2.5, 3);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xdfe6f0, 1.0);
  rim.position.set(2.5, 1, -2);
  scene.add(rim);

  const controls = createControls({ canvas, motionChip });

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
    if (headBone) {
      // Only the head follows; shoulders stay still on the pivot.
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
    elapsed += dt;
    controls.update(dt, elapsed);
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

  function attach(bust) {
    pivot.add(bust);
    renderOnce(); // synchronous first frame — never gate visibility on the loop
    canvas.classList.add('is-ready');
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
    return neckBone;
  }

  if (PLACEHOLDER) {
    attach(buildPlaceholder());
  } else {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      `/models/billy-bust${MODEL_SUFFIX}.glb`,
      (gltf) => {
        const bust = gltf.scene;
        // Generators return arbitrary scale/orientation/origin — normalize at runtime
        const box = new THREE.Box3().setFromObject(bust);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        bust.position.sub(center);
        bust.scale.setScalar(1.55 / Math.max(size.x, size.y, size.z));
        bust.rotation.x = 0.13; // counter the model's baked-in upward gaze
        bust.rotation.y = BODY_YAW; // square chest/shoulders to the camera
        headBone = skinBust(bust);
        attach(bust);
      },
      (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
      () => { /* GLB failed: shell + chips still fully work */ },
    );
  }

}
