/**
 * The add-to-bag claw. When a product goes in the bag, a claw-machine claw drops onto the page,
 * grabs that product as a real 3D model (from where its picture was), lifts it, carries it up to
 * the bag icon and lets go. The returned promise resolves the moment the product lands in the bag,
 * so the bag count bumps exactly then.
 *
 * Drawn on one transparent full-screen canvas above the page that only renders while a drop is
 * playing. Screen pixels map 1:1 onto the z = 0 plane, so "from" and "to" can simply be the
 * bounding rectangles of page elements.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './models.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ph = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const lerp = (a, b, t) => a + (b - a) * t;

/** Timeline, in seconds. */
const T = { descend: [0.05, 0.45], grip: [0.45, 0.6], lift: [0.6, 1.0], carry: [1.0, 1.7], release: [1.7, 1.8], fall: [1.75, 2.0], retract: [1.85, 2.4], end: 2.5 };
const LAND = T.fall[1];
const HANG = 0.6; // how far below the hub the product's top sits, in fingertip lengths (the fingers close round it)

let gl = null;      // { renderer, scene, camera, canvas, claw, cable, confetti }
let queue = Promise.resolve();

function buildClaw() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dce3', metalness: 1, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: '#23252c', metalness: 0.6, roughness: 0.4 });
  const tip = new THREE.MeshStandardMaterial({ color: '#e8432e', roughness: 0.5 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), dark));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.024, 10, 28), chrome);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // Three hinged fingers.
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, -0.02, 0), new THREE.Vector3(0.25, -0.1, 0), new THREE.Vector3(0.28, -0.29, 0), new THREE.Vector3(0.11, -0.43, 0)]);
  const fingerGeo = new THREE.TubeGeometry(path, 20, 0.032, 10);
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const yaw = new THREE.Group();
    yaw.rotation.y = (i / 3) * Math.PI * 2 + 0.5;
    const hinge = new THREE.Group();
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), tip);
    t.position.set(0.11, -0.43, 0);
    hinge.add(new THREE.Mesh(fingerGeo, chrome), t);
    yaw.add(hinge);
    g.add(yaw);
    fingers.push(hinge);
  }
  // The cable runs straight up, off the top of the screen.
  const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 40, 10);
  cableGeo.translate(0, 20.1, 0);
  g.add(new THREE.Mesh(cableGeo, dark));
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), chrome);
  cuff.position.y = 0.17;
  g.add(cuff);
  g.userData.fingers = fingers;
  return g;
}

function setup() {
  if (gl) return gl;
  const canvas = document.createElement('canvas');
  canvas.className = 'claw-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c4bb, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.3, 1, 0.8);
  scene.add(key);
  // Orthographic, one unit per CSS pixel, y up; so page rectangles map straight on.
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  camera.position.z = 1000;
  const claw = buildClaw();
  scene.add(claw);
  const N = 70;
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
  const palette = ['#e8432e', '#e8b84a', '#2456e6', '#7fd8c0', '#15161a'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) confetti.setColorAt(i, palette[i % palette.length]);
  confetti.frustumCulled = false;
  scene.add(confetti);
  gl = { renderer, scene, camera, canvas, claw, confetti, bits: Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, life: 0 })) };
  return gl;
}

function resize() {
  const { renderer, camera } = gl;
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  // x: 0..w left to right, y: 0..-h top to bottom (page coordinates with y flipped).
  Object.assign(camera, { left: 0, right: w, top: 0, bottom: -h });
  camera.updateProjectionMatrix();
}

const dummy = new THREE.Object3D();
function burst(at, size) {
  for (const b of gl.bits) {
    const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random()) * size * 5;
    b.p.copy(at);
    b.v.set(Math.cos(a) * s, Math.abs(Math.sin(a)) * s * 1.2 + size * 2, 0);
    b.r = Math.random() * 6;
    b.life = 0.7 + Math.random() * 0.5;
  }
}
function stepConfetti(dt, size) {
  gl.bits.forEach((b, i) => {
    if (b.life > 0) {
      b.life -= dt;
      b.v.y -= size * 22 * dt;
      b.p.addScaledVector(b.v, dt);
      b.r += dt * 9;
      dummy.position.copy(b.p);
      dummy.rotation.set(b.r, b.r * 0.7, b.r * 0.3);
      dummy.scale.setScalar(size * 0.55 * clamp01(b.life * 3));
    } else dummy.scale.setScalar(0);
    dummy.updateMatrix();
    gl.confetti.setMatrixAt(i, dummy.matrix);
  });
  gl.confetti.instanceMatrix.needsUpdate = true;
}

/** Page rect centre → world point (y flipped). */
const centre = (r) => new THREE.Vector3(r.left + r.width / 2, -(r.top + r.height / 2), 0);

function play({ spec, from, to, yaw = -0.55, onLand }) {
  return new Promise((resolve) => {
    setup();
    resize();
    const { renderer, scene, camera, canvas, claw } = gl;

    // The product, scaled to how big its picture was, standing where its picture was.
    const model = buildModel(spec);
    model.rotation.y = yaw;
    const holder = new THREE.Group();
    holder.add(model);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    const fit = (Math.min(from.width, from.height) * 0.62) / Math.max(size.x, size.y, size.z * 0.8);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.max.y, -c.z); // grip point (top centre) at the holder's origin
    const height = size.y * fit;
    const product = new THREE.Group();
    product.add(holder);
    holder.scale.setScalar(fit);
    scene.add(product);

    // Claw size follows the product; it is drawn in front of it (z), so it reads as gripping.
    const clawScale = Math.max(60, Math.min(210, height * 0.8));
    claw.scale.setScalar(clawScale);
    claw.visible = true;
    const tipDrop = 0.36 * clawScale;      // hub to the fingertips
    const start = centre(from);
    const grip = start.clone().add(new THREE.Vector3(0, height / 2, 0)); // top of the product
    const bag = centre(to);
    const lifted = grip.clone().add(new THREE.Vector3(0, Math.max(60, height * 0.35), 0));
    const above = bag.clone().add(new THREE.Vector3(0, -tipDrop * 0.35 - 6, 0));
    const ctrl = new THREE.Vector3(lerp(lifted.x, above.x, 0.35), Math.max(lifted.y, above.y) + 140, 0);
    const endScale = Math.max(0.12, (to.height * 1.6) / Math.max(height, 1));
    const confettiSize = Math.max(6, to.height * 0.28);
    let swing = 0, swingV = 0, landed = false, last = performance.now(), prevX = grip.x;
    const t0 = performance.now();

    canvas.classList.add('on');
    const frame = (now) => {
      // window.__clawT freezes the timeline at that second (screenshots in testing).
      const t = typeof window.__clawT === 'number' ? window.__clawT : (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Where the claw's hub is.
      const topY = 60 + tipDrop; // just above the top edge
      let hub;
      if (t < T.lift[0]) {
        const d = easeOut(ph(t, ...T.descend));
        hub = new THREE.Vector3(grip.x, lerp(topY, grip.y + tipDrop * HANG, d), 400);
      } else if (t < T.carry[0]) {
        const k = easeInOut(ph(t, ...T.lift));
        hub = new THREE.Vector3(grip.x, lerp(grip.y, lifted.y, k) + tipDrop * HANG, 400);
      } else {
        const k = easeInOut(ph(t, ...T.carry));
        const p = new THREE.Vector3().copy(lifted).multiplyScalar((1 - k) * (1 - k))
          .addScaledVector(ctrl, 2 * (1 - k) * k).addScaledVector(above, k * k);
        hub = p.add(new THREE.Vector3(0, tipDrop * HANG * lerp(1, 0.55, k), 400));
        const r = easeInOut(ph(t, ...T.retract));
        hub.y = lerp(hub.y, topY + 200, r);
      }
      claw.position.copy(hub);
      claw.scale.setScalar(clawScale * lerp(1, 0.55, easeInOut(ph(t, ...T.carry))));
      const open = 0.62 - 0.5 * easeOut(ph(t, ...T.grip)) + 0.5 * easeOut(ph(t, ...T.release));
      claw.userData.fingers.forEach((f) => (f.rotation.z = open));

      // The product: still until gripped, then hangs from the claw and swings with the motion.
      const held = t >= T.grip[1] && t < T.release[0];
      const carryK = easeInOut(ph(t, ...T.carry));
      const s = lerp(1, endScale, carryK);
      if (t < T.grip[1]) {
        product.position.copy(start).add(new THREE.Vector3(0, height / 2, 0));
        product.scale.setScalar(easeOutBack(ph(t, 0, 0.25)) * 0.85 + 0.15 * clamp01(t / 0.25));
      } else if (held) {
        product.position.set(claw.position.x, claw.position.y - tipDrop * HANG * (claw.scale.x / clawScale), 0);
        product.scale.setScalar(s);
      } else {
        const f = easeIn(ph(t, ...T.fall));
        const from2 = above.clone();
        product.position.set(lerp(from2.x, bag.x, f), lerp(from2.y, bag.y, f), 0);
        product.scale.setScalar(endScale * (1 - f * 0.9));
      }
      // Pendulum: driven by the claw's sideways acceleration.
      const vx = (claw.position.x - prevX) / Math.max(dt, 1e-3);
      prevX = claw.position.x;
      swingV += (-swing * 40 - swingV * 5 - (held ? vx * 0.004 : 0)) * dt;
      swing += swingV * dt;
      product.rotation.z = held ? Math.max(-0.5, Math.min(0.5, swing)) : swing * 0.3;
      holder.rotation.y = held ? (t - T.grip[1]) * 1.6 : 0;
      product.visible = t < LAND + 0.05;

      if (!landed && t >= LAND) {
        landed = true;
        burst(bag, confettiSize);
        onLand?.();
      }
      stepConfetti(dt, confettiSize);
      renderer.render(scene, camera);

      if (t < T.end) requestAnimationFrame(frame);
      else {
        scene.remove(product);
        product.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); } } });
        claw.visible = false;
        canvas.classList.remove('on');
        renderer.render(scene, camera);
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/**
 * Plays the claw for one product. Resolves when the product lands in the bag (call sites add it
 * to the bag then); drops queue behind each other. Falls back to resolving at once when WebGL is
 * missing or the visitor prefers reduced motion.
 */
export function clawToBag(opts) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  let landed;
  const land = new Promise((r) => { landed = r; });
  queue = queue.then(() => play({ ...opts, onLand: landed }).catch((e) => { console.warn('claw', e); landed(); }));
  // Never leave the bag waiting: if anything stalls, add the item anyway.
  return Promise.race([land, new Promise((r) => setTimeout(r, 6000))]);
}
