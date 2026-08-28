// Three.js stage: grey studio (CSS gradient behind an alpha canvas), the bust,
// and the render loop. Loaded eagerly one frame after first paint — this scene
// is the page's subject, not an enhancement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createControls } from './controls.js';

// Flip to false once public/models/billy-bust.glb exists.
const PLACEHOLDER = !document.body.dataset.hasBust;

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

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (narrow.matches) {
      pivot.position.set(0, 0.3, 0);
      pivot.scale.setScalar(0.85);
      camera.position.set(0, 0.1, 3.1);
    } else {
      pivot.position.set(0.55, 0.1, 0);
      pivot.scale.setScalar(1);
      camera.position.set(0, 0.1, 2.9);
    }
    camera.lookAt(0, 0.1, 0); // look left of the bust so it sits right-of-center
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
    pivot.rotation.y = controls.state.yaw;
    pivot.rotation.x = -controls.state.pitch;
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

  if (PLACEHOLDER) {
    attach(buildPlaceholder());
  } else {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      '/models/billy-bust.glb',
      (gltf) => {
        const bust = gltf.scene;
        // Generators return arbitrary scale/orientation/origin — normalize at runtime
        const box = new THREE.Box3().setFromObject(bust);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        bust.position.sub(center);
        bust.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z));
        attach(bust);
      },
      (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
      () => { /* GLB failed: shell + chips still fully work */ },
    );
  }

}
