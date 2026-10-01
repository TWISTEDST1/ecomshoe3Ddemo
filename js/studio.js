/**
 * The photo studio and the live 3D viewers.
 *
 * - `photograph(spec, angles)` renders a product model to transparent WebP images (the product
 *   photos), with soft studio light and a contact shadow. One shared offscreen renderer.
 * - `Viewer` shows a model live on a canvas: drag (or swipe) to turn it, it idles with a slow spin,
 *   and it stops drawing whenever it is off screen.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './models.js';

/** A lit stage: environment, key light with soft shadow, fill, and a shadow-catcher floor. */
function makeStage(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c4bb, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2.5, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 8;
  key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff1e0, 0.6);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { scene, floor };
}

/** Wraps a model so it is centred, sits on y = 0 and has a known size. */
function mount(model) {
  const pivot = new THREE.Group();
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  pivot.add(model);
  const size = box.getSize(new THREE.Vector3());
  pivot.userData.radius = size.length() / 2;
  pivot.userData.height = size.y;
  return pivot;
}

/** Puts the camera where the whole model fits, looking slightly down at it. */
function frame(camera, pivot, { pad = 1.12, tilt = 0.32 } = {}) {
  const r = pivot.userData.radius * pad;
  const fitV = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitH = fitV / Math.min(1, camera.aspect);
  const d = Math.max(fitV, fitH);
  const cy = pivot.userData.height * 0.5;
  camera.position.set(0, cy + Math.sin(tilt) * d, Math.cos(tilt) * d);
  camera.lookAt(0, cy * 0.92, 0);
}

// ---------------------------------------------------------------------------------------------
// Product photos
// ---------------------------------------------------------------------------------------------
let shared = null;
function studio() {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const { scene } = makeStage(renderer);
  const camera = new THREE.PerspectiveCamera(26, 4 / 5, 0.05, 50);
  shared = { renderer, scene, camera };
  return shared;
}

const webp = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
})();

/**
 * Renders [spec] once per angle and resolves to image (blob) URLs. Angles: {y, x, w, h}.
 * The GPU draw is quick; the slow part, image encoding, runs off the main thread (toBlob), so the
 * page stays responsive while the catalogue's photos are made.
 */
export async function photograph(spec, angles) {
  const { renderer, scene, camera } = studio();
  const model = buildModel(spec);
  const pivot = mount(model);
  scene.add(pivot);
  const blobs = angles.map(({ y = -0.6, x = 0, w = 560, h = 700, pad = 1.12, tilt = 0.32 }) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    model.rotation.set(x, y, 0);
    frame(camera, pivot, { pad, tilt });
    renderer.render(scene, camera);
    // Copy the frame out (the WebGL canvas is reused for the next angle), then encode async.
    const copy = document.createElement('canvas');
    copy.width = w; copy.height = h;
    copy.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return new Promise((resolve) => copy.toBlob((b) => resolve(b), webp ? 'image/webp' : 'image/png', 0.88));
  });
  scene.remove(pivot);
  pivot.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); }
    }
  });
  return (await Promise.all(blobs)).map((b) => URL.createObjectURL(b));
}

// ---------------------------------------------------------------------------------------------
// Live viewer
// ---------------------------------------------------------------------------------------------
export class Viewer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas, { spin = 0.35, tilt = 0.3, pad = 1.08, float = true } = {}) {
    this.canvas = canvas;
    this.opts = { spin, tilt, pad, float };
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    const { scene, floor } = makeStage(r);
    this.scene = scene;
    this.floor = floor;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    this.pivot = null;
    this.yaw = -0.6;
    this.pitch = 0;
    this.vel = 0;
    this.dragging = false;
    this.visible = true;
    this.last = 0;
    this._bindInput();
    new ResizeObserver(() => this._resize()).observe(canvas);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
    this._loop = (t) => { requestAnimationFrame(this._loop); this._tick(t); };
    requestAnimationFrame(this._loop);
  }

  /** Shows a product (spec as in products.js), starting from [yaw]. */
  show(spec, yaw = -0.6) {
    if (this.pivot) {
      this.scene.remove(this.pivot);
      this.pivot.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); } } });
    }
    this.model = buildModel(spec);
    this.pivot = mount(this.model);
    this.scene.add(this.pivot);
    this.yaw = yaw;
    this.vel = 0;
    this._resize();
  }

  _resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.pivot) frame(this.camera, this.pivot, { pad: this.opts.pad, tilt: this.opts.tilt });
  }

  _bindInput() {
    const c = this.canvas;
    let lx = 0, ly = 0;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true; lx = e.clientX; ly = e.clientY; this.vel = 0;
      c.setPointerCapture(e.pointerId);
      c.classList.add('grabbing');
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.yaw += dx * 0.012;
      this.vel = dx * 0.012 * 60;
      this.pitch = Math.max(-0.35, Math.min(0.35, this.pitch + dy * 0.006));
    });
    const up = () => { this.dragging = false; c.classList.remove('grabbing'); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  _tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    if (!this.visible || !this.pivot) return;
    if (!this.dragging) {
      this.vel *= Math.pow(0.04, dt);         // a flick keeps turning, then settles…
      this.yaw += (this.vel + this.opts.spin) * dt; // …into the idle spin
      this.pitch *= Math.pow(0.2, dt);
    }
    this.model.rotation.set(this.pitch, this.yaw, 0);
    this.pivot.position.y = this.opts.float ? Math.sin(now / 900) * 0.035 + 0.04 : 0;
    this.floor.material.opacity = this.opts.float ? 0.16 - Math.sin(now / 900) * 0.03 : 0.16;
    this.renderer.render(this.scene, this.camera);
  }
}
