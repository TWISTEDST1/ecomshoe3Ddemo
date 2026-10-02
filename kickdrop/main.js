/**
 * Kickdrop — a looping "sneaker drop" scene in three.js.
 *
 * A phone shows a small shop app with a countdown. A claw-machine grabber slides out of the
 * screen holding a 3D high-top by its laces, the camera pushes in and pulls back, the countdown
 * hits zero, the shoe drops into a product card, spins, and turns into its box with a SUCCESS badge.
 *
 * Everything is made in code: the sneaker is a lofted mesh with a painted canvas texture, the
 * phone's screen is a canvas drawn every time its state changes, and the timeline is a pure
 * function of time (so Replay just resets the clock).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
/** 0 before a, 1 after b, linear in between. */
const ph = (t, a, b) => clamp01((t - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
/** Cubic Hermite curve through [x, y] knots: used for the shoe's height and width profiles. */
function spline(k) {
  const n = k.length;
  const m = k.map((_, i) => {
    const a = k[Math.max(i - 1, 0)], b = k[Math.min(i + 1, n - 1)];
    return (b[1] - a[1]) / (b[0] - a[0] || 1);
  });
  return (s) => {
    s = clamp01(s);
    let i = 0;
    while (i < n - 2 && s > k[i + 1][0]) i++;
    const [x0, y0] = k[i], [x1, y1] = k[i + 1];
    const h = x1 - x0, t = (s - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
  };
}
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
/** The STELLA sparkle (a four-point star) centred at (x, y). */
function drawStar(g, x, y, r, fill) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.bezierCurveTo(x + r * 0.05, y - r * 0.3, x + r * 0.3, y - r * 0.05, x + r, y);
  g.bezierCurveTo(x + r * 0.3, y + r * 0.05, x + r * 0.05, y + r * 0.3, x, y + r);
  g.bezierCurveTo(x - r * 0.05, y + r * 0.3, x - r * 0.3, y + r * 0.05, x - r, y);
  g.bezierCurveTo(x - r * 0.3, y - r * 0.05, x - r * 0.05, y - r * 0.3, x, y - r);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Colourway (an original design: cobalt, cream, charcoal, with a yellow bolt).
const C = { cream: '#f4efe4', cobalt: '#2456e6', dark: '#1b1d24', bolt: '#ffc93c', sole: '#fbfaf6', green: '#22b45e' };

// ---------------------------------------------------------------------------------------------
// Renderer, scene, light
// ---------------------------------------------------------------------------------------------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bcc6, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(1.4, 3.2, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.radius = 10;
key.shadow.bias = -0.0006;
Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
scene.add(key);

/** Everything tilts together with the pointer, like a product on a stand. */
const world = new THREE.Group();
scene.add(world);

// ---------------------------------------------------------------------------------------------
// The sneaker
// ---------------------------------------------------------------------------------------------
const SHOE = { L: 1.6, H: 0.8, W: 0.86 };
const heightAt = spline([[0, 0.9], [0.1, 1], [0.3, 0.98], [0.42, 0.8], [0.55, 0.58], [0.7, 0.43], [0.85, 0.35], [0.93, 0.29], [0.975, 0.2], [1, 0]]);
const widthAt = spline([[0, 0.13], [0.04, 0.24], [0.15, 0.3], [0.45, 0.33], [0.7, 0.38], [0.85, 0.36], [0.93, 0.3], [0.975, 0.2], [1, 0]]);
const shoeX = (s) => (s - 0.45) * SHOE.L;

/** The upper's paint job, in (u = heel→toe, v = around: 0 outer side … 0.5 top … 1 inner side). */
function paintUpper() {
  const W = 1024, H = 512, c = canvasOf(W, H), g = c.getContext('2d');
  const px = (u, v) => [u * W, (1 - v) * H];
  /** Fills a polygon and its mirror image on the other side of the shoe. */
  const poly = (pts, fill) => {
    for (const mirror of [false, true]) {
      g.beginPath();
      pts.forEach(([u, v], i) => { const [x, y] = px(u, mirror ? 1 - v : v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath(); g.fillStyle = fill; g.fill();
    }
  };
  const stitch = (pts) => {
    for (const mirror of [false, true]) {
      g.beginPath();
      pts.forEach(([u, v], i) => { const [x, y] = px(u, mirror ? 1 - v : v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.setLineDash([7, 6]); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke(); g.setLineDash([]);
    }
  };
  g.fillStyle = C.cream; g.fillRect(0, 0, W, H);
  // Heel counter and the mudguard that runs forward into the toe cap.
  poly([[0, 0], [0.22, 0], [0.2, 0.1], [0.15, 0.2], [0, 0.22]], C.cobalt);
  poly([[0.66, 0], [1, 0], [1, 0.5], [0.9, 0.5], [0.885, 0.3], [0.84, 0.17], [0.74, 0.12]], C.cobalt);
  // Collar and lining (the dark top of the ankle), then the lace panel and the tongue.
  poly([[0, 0.22], [0.15, 0.2], [0.3, 0.215], [0.4, 0.3], [0.4, 0.5], [0, 0.5]], C.dark);
  poly([[0.36, 0.31], [0.76, 0.33], [0.79, 0.4], [0.76, 0.5], [0.36, 0.5]], C.cobalt);
  poly([[0.38, 0.45], [0.75, 0.455], [0.75, 0.5], [0.38, 0.5]], C.cream);
  stitch([[0.21, 0.01], [0.19, 0.1], [0.14, 0.19], [0.01, 0.21]]);
  stitch([[0.67, 0.012], [0.74, 0.108], [0.835, 0.158], [0.873, 0.3], [0.888, 0.49]]);
  stitch([[0.37, 0.3], [0.765, 0.32]]);
  // Eyelets along the lace panel and air holes on the toe box.
  g.fillStyle = C.dark;
  for (let i = 0; i < 6; i++) for (const v of [0.355, 0.645]) { const [x, y] = px(0.41 + i * 0.062, v); g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(27,29,36,.5)';
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const [x, y] = px(0.8 + i * 0.022 - r * 0.004, 0.5 + side * (0.045 + r * 0.045)); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
  }
  // The side mark: the STELLA sparkle, yellow with a dark keyline (the same mark as the shop's shoes).
  for (const mirror of [false, true]) {
    const [x, y] = px(0.5, mirror ? 0.84 : 0.16);
    drawStar(g, x, y, 62, C.dark);
    drawStar(g, x, y, 52, C.bolt);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildShoe() {
  const g = new THREE.Group();
  // Upper: a loft of half-superellipse sections from heel to toe, open underneath (the sole covers it).
  const NS = 72, NT = 30, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, h = heightAt(s) * SHOE.H, w = widthAt(s) * SHOE.W;
    for (let j = 0; j <= NT; j++) {
      const a = (j / NT) * Math.PI, cs = Math.cos(a), sn = Math.sin(a);
      pos.push(shoeX(s), h * Math.pow(sn, 0.7), w * Math.sign(cs) * Math.pow(Math.abs(cs), 0.7));
      uv.push(s, j / NT);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + NT + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // Close the back of the heel with a fan.
  const centre = pos.length / 3;
  pos.push(shoeX(0), heightAt(0) * SHOE.H * 0.45, 0); uv.push(0.02, 0.1);
  for (let j = 0; j < NT; j++) idx.push(centre, j + 1, j);
  const upperGeo = new THREE.BufferGeometry();
  upperGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  upperGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  upperGeo.setIndex(idx);
  upperGeo.computeVertexNormals();
  const upper = new THREE.Mesh(upperGeo, new THREE.MeshStandardMaterial({ map: paintUpper(), roughness: 0.62, metalness: 0, side: THREE.DoubleSide }));
  g.add(upper);

  // Sole: the footprint extruded downwards (a chunky midsole on a thin coloured outsole).
  const foot = new THREE.Shape();
  const N = 48, edge = (s) => widthAt(s) * SHOE.W * 1.07 + 0.012;
  for (let i = 0; i <= N; i++) { const s = i / N; i ? foot.lineTo(shoeX(s), edge(s)) : foot.moveTo(shoeX(s), edge(s)); }
  for (let i = N; i >= 0; i--) { const s = i / N; foot.lineTo(shoeX(s), -edge(s)); }
  const soleGeo = (depth, bevel) => {
    const geo = new THREE.ExtrudeGeometry(foot, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
    geo.rotateX(Math.PI / 2); // shape → ground plane, extrusion → downwards
    return geo;
  };
  const mid = new THREE.Mesh(soleGeo(0.15, 0.03), new THREE.MeshStandardMaterial({ color: C.sole, roughness: 0.5 }));
  mid.position.y = 0.02;
  const out = new THREE.Mesh(soleGeo(0.035, 0.012), new THREE.MeshStandardMaterial({ color: C.cobalt, roughness: 0.7 }));
  out.position.y = -0.17;
  g.add(mid, out);

  // Laces: criss-crossed bars up the lace panel.
  const laceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const s = 0.41 + i * 0.062, w = widthAt(s) * SHOE.W * 0.5;
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, w * 2, 3, 8), laceMat);
    bar.rotation.x = Math.PI / 2;
    bar.rotation.z = i % 2 ? 0.32 : -0.32;
    bar.position.set(shoeX(s), heightAt(s) * SHOE.H * 0.985 + 0.012, 0);
    g.add(bar);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // Centre the model on its middle so it spins nicely on a turntable.
  const inner = new THREE.Group();
  g.position.y = -0.3;
  inner.add(g);
  /** Where the hanging laces tie on (front of the collar), in the holder's own space. */
  inner.userData.collar = new THREE.Vector3(shoeX(0.34), heightAt(0.34) * SHOE.H - 0.3, 0);
  return inner;
}

// ---------------------------------------------------------------------------------------------
// The phone and its screen
// ---------------------------------------------------------------------------------------------
const UI = { w: 540, h: 1170 };
const SCREEN = { w: 1.84, h: 1.84 * UI.h / UI.w };
/** UI pixel y → world y on the screen. */
const uiY = (y) => (0.5 - y / UI.h) * SCREEN.h;

const uiCanvas = canvasOf(UI.w, UI.h);
const ui = uiCanvas.getContext('2d');
const uiTexture = new THREE.CanvasTexture(uiCanvas);
uiTexture.colorSpace = THREE.SRGBColorSpace;
uiTexture.anisotropy = 8;
let shoeThumb = null; // a render of the 3D shoe, used for the product pictures in the app

function buildPhone() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(2.0, 4.14, 0.34), { depth: 0.18, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 12 });
  bodyGeo.translate(0, 0, -0.09);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#3a3c42', metalness: 0.9, roughness: 0.32 }));
  g.add(body);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1.94, 4.08, 0.31), 12), new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.2, metalness: 0.4 }));
  glass.position.z = 0.112;
  g.add(glass);
  // The screen keeps the UI's real colours (no lighting, no tone mapping).
  const screenGeo = new THREE.ShapeGeometry(roundedRect(SCREEN.w, SCREEN.h, 0.26), 12);
  const p = screenGeo.attributes.position, uvs = [];
  for (let i = 0; i < p.count; i++) uvs.push(p.getX(i) / SCREEN.w + 0.5, p.getY(i) / SCREEN.h + 0.5);
  screenGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: uiTexture, toneMapped: false }));
  screen.position.z = 0.114;
  g.add(screen);
  // A see-through layer that only shows shadows, so the shoe casts one onto the screen.
  const catcher = new THREE.Mesh(screenGeo, new THREE.ShadowMaterial({ opacity: 0.17 }));
  catcher.position.z = 0.117;
  catcher.receiveShadow = true;
  g.add(catcher);
  const btnMat = body.material;
  for (const [y, h] of [[0.75, 0.5], [0.1, 0.28]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.06), btnMat);
    b.position.set(1.01, y, 0);
    g.add(b);
  }
  return g;
}

/** Rounded rectangle path on the UI canvas. */
function rr(x, y, w, h, r) { ui.beginPath(); ui.roundRect(x, y, w, h, r); }
function text(str, x, y, font, fill, align = 'left') { ui.font = font; ui.fillStyle = fill; ui.textAlign = align; ui.fillText(str, x, y); }

/** Draws the shop app. `st`: {timer, hero, dim, modal, progress, success}. */
function drawUI(st) {
  const g = ui, F = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#f6f5f2'; g.fillRect(0, 0, UI.w, UI.h);
  g.textBaseline = 'alphabetic';
  // Status bar.
  text('3:08', 46, 58, `600 24px ${F}`, '#111');
  rr(190, 26, 160, 44, 22); g.fillStyle = '#000'; g.fill();
  g.fillStyle = '#111';
  for (let i = 0; i < 4; i++) g.fillRect(418 + i * 8, 54 - i * 4, 5, 6 + i * 4);
  rr(462, 40, 38, 18, 5); g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke(); rr(465, 43, 26, 12, 3); g.fill();
  // Shop header.
  g.lineWidth = 4; g.strokeStyle = '#111'; g.beginPath(); g.arc(50, 116, 12, 0, 7); g.moveTo(59, 125); g.lineTo(68, 134); g.stroke();
  text('stella', 82, 128, `800 34px ${F}`, '#111');
  g.lineWidth = 3.5; g.beginPath(); g.moveTo(424, 110); g.bezierCurveTo(424, 96, 444, 96, 444, 110); g.bezierCurveTo(444, 96, 464, 96, 464, 110); g.bezierCurveTo(464, 124, 444, 134, 444, 138); g.bezierCurveTo(444, 134, 424, 124, 424, 110); g.stroke();
  rr(484, 108, 30, 30, 6); g.stroke(); g.beginPath(); g.arc(499, 108, 8, Math.PI, 0); g.stroke();
  g.fillStyle = '#ff4b3e'; g.beginPath(); g.arc(516, 104, 9, 0, 7); g.fill();
  rr(32, 156, 476, 58, 18); g.fillStyle = '#eceae5'; g.fill();
  g.lineWidth = 3; g.strokeStyle = '#8c8a86'; g.beginPath(); g.arc(62, 184, 9, 0, 7); g.moveTo(69, 191); g.lineTo(76, 198); g.stroke();
  text('Search drops', 90, 193, `500 22px ${F}`, '#8c8a86');
  // Featured cards.
  const card = (x, y, w, h) => { rr(x, y, w, h, 28); g.fillStyle = '#fff'; g.fill(); };
  card(32, 236, 300, 330);
  rr(46, 250, 272, 190, 20); g.fillStyle = '#eef0f4'; g.fill();
  if (st.hero && shoeThumb) g.drawImage(shoeThumb, 52, 246, 262, 197);
  text('STELLA', 52, 474, `700 20px ${F}`, '#111');
  text('Volt Rider Hi', 52, 500, `500 19px ${F}`, '#77756f');
  text('$129.00', 52, 528, `700 20px ${F}`, '#111');
  rr(222, 506, 96, 36, 18); g.fillStyle = '#111'; g.fill(); text('Buy now', 270, 530, `600 16px ${F}`, '#fff', 'center');
  card(348, 236, 300, 330);
  rr(362, 250, 272, 190, 20); g.fillStyle = '#e7e4de'; g.fill();
  g.fillStyle = '#2b2d33'; g.beginPath(); g.arc(452, 300, 26, 0, 7); g.fill(); rr(400, 326, 104, 114, 26); g.fill(); // a hoodie, loosely
  text('STELLA', 368, 474, `700 20px ${F}`, '#111');
  text('Fleece Hood', 368, 500, `500 19px ${F}`, '#77756f');
  text('$84.00', 368, 528, `700 20px ${F}`, '#111');
  for (let i = 0; i < 4; i++) { g.fillStyle = i === 0 ? '#111' : '#c9c7c2'; rr(232 + i * 20, 588, i === 0 ? 22 : 10, 6, 3); g.fill(); }
  // Countdown.
  text(st.timer > 0 ? 'Your drop opens in' : 'Your drop is live', 270, 654, `500 21px ${F}`, '#77756f', 'center');
  text(`00:0${st.timer}`, 270, 728, `700 68px ui-monospace, "SF Mono", Consolas, monospace`, '#111', 'center');
  // More drops.
  text('All drops', 32, 806, `800 26px ${F}`, '#111');
  text('See all', 508, 804, `600 18px ${F}`, '#2456e6', 'right');
  card(32, 830, 230, 210);
  if (shoeThumb) g.drawImage(shoeThumb, 44, 846, 206, 155);
  g.fillStyle = '#111'; g.beginPath(); g.arc(232, 860, 16, 0, 7); g.fill();
  card(278, 830, 230, 210);
  rr(330, 868, 126, 150, 30); g.fillStyle = '#1b1d24'; g.fill(); g.beginPath(); g.arc(393, 862, 28, 0, 7); g.fill();
  rr(294, 846, 54, 26, 13); g.fillStyle = '#eceae5'; g.fill(); text('New', 321, 865, `600 14px ${F}`, '#111', 'center');
  // Tab bar.
  g.fillStyle = '#fff'; g.fillRect(0, 1068, UI.w, 102);
  g.fillStyle = '#111';
  rr(52, 1100, 28, 26, 6); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#a3a19c';
  rr(152, 1100, 28, 26, 6); g.stroke(); rr(360, 1100, 28, 26, 6); g.stroke();
  g.beginPath(); g.arc(474, 1106, 9, 0, 7); g.moveTo(458, 1130); g.quadraticCurveTo(474, 1112, 490, 1130); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(270, 1108, 32, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(258, 1102); g.lineTo(282, 1102); g.lineTo(275, 1095); g.moveTo(282, 1114); g.lineTo(258, 1114); g.lineTo(265, 1121); g.stroke();
  rr(190, 1150, 160, 6, 3); g.fillStyle = '#111'; g.fill();

  if (st.dim > 0) { g.fillStyle = `rgba(22,23,28,${0.5 * st.dim})`; g.fillRect(0, 0, UI.w, UI.h); }
  if (st.modal > 0) {
    // The product card slides up from below.
    const y = 296 + (1 - st.modal) * 940;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    rr(56, y, 428, 620, 38); g.fillStyle = '#f7f6f3'; g.fill();
    g.restore();
    for (const x of [96, 444]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y + 44, 22, 0, 7); g.fill(); }
    g.lineWidth = 3; g.strokeStyle = '#111';
    g.beginPath(); g.moveTo(100, y + 35); g.lineTo(91, y + 44); g.lineTo(100, y + 53);
    g.moveTo(436, y + 36); g.lineTo(452, y + 52); g.moveTo(452, y + 36); g.lineTo(436, y + 52); g.stroke();
    rr(92, y + 574, 356, 6, 3); g.fillStyle = '#dcd9d3'; g.fill();
    rr(92, y + 574, Math.max(8, 356 * st.progress), 6, 3); g.fillStyle = '#111'; g.fill();
    if (st.success > 0) {
      const k = easeOutBack(st.success);
      g.save(); g.translate(270, y + 44); g.scale(k, k);
      rr(-78, -21, 156, 42, 21); g.fillStyle = C.green; g.fill();
      text('SUCCESS', 0, 8, `800 20px ${F}`, '#fff', 'center');
      g.restore();
      g.save(); g.translate(270, y - 30); g.scale(k, k);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill();
      g.fillStyle = C.green; g.beginPath(); g.arc(0, 0, 33, 0, 7); g.fill();
      g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff';
      g.beginPath(); g.moveTo(-14, 1); g.lineTo(-4, 11); g.lineTo(15, -10); g.stroke();
      g.restore();
    }
  }
  uiTexture.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------
// The grabber (a claw-machine claw on an arm that slides out of the screen) and the shoebox
// ---------------------------------------------------------------------------------------------
function buildClaw() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dce3', metalness: 1, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: '#23252c', metalness: 0.6, roughness: 0.4 });
  const tip = new THREE.MeshStandardMaterial({ color: C.bolt, roughness: 0.5 });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), dark);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.024, 10, 28), chrome);
  ring.rotation.x = Math.PI / 2;
  g.add(hub, ring);
  // Three fingers, hinged at the hub.
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, -0.02, 0), new THREE.Vector3(0.25, -0.1, 0), new THREE.Vector3(0.28, -0.29, 0), new THREE.Vector3(0.11, -0.43, 0)]);
  const fingerGeo = new THREE.TubeGeometry(path, 20, 0.032, 10);
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const yaw = new THREE.Group();
    yaw.rotation.y = (i / 3) * Math.PI * 2 + 0.5;
    const hinge = new THREE.Group();
    const f = new THREE.Mesh(fingerGeo, chrome);
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), tip);
    t.position.set(0.11, -0.43, 0);
    hinge.add(f, t); yaw.add(hinge); g.add(yaw);
    fingers.push(hinge);
  }
  // The arm reaches back and up into the screen.
  const back = new THREE.Vector3(0, 0.4, -0.9).normalize();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 2.6, 16), chrome);
  arm.position.copy(back).multiplyScalar(1.3);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), back);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 16), dark);
  cuff.position.copy(back).multiplyScalar(0.2);
  cuff.quaternion.copy(arm.quaternion);
  g.add(arm, cuff);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { fingers, back };
  return g;
}

function buildBox() {
  // A printed pattern: confetti shapes and the bolt, all drawn here.
  const c = canvasOf(512, 256), g = c.getContext('2d');
  g.fillStyle = C.cobalt; g.fillRect(0, 0, 512, 256);
  const cols = [C.bolt, '#ff6b5a', C.cream, '#7fd8c6', C.dark];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    g.save(); g.translate(rnd() * 512, rnd() * 256); g.rotate(rnd() * 6.3); g.fillStyle = cols[i % cols.length];
    const k = i % 3;
    if (k === 0) { g.beginPath(); g.arc(0, 0, 8 + rnd() * 14, 0, 7); g.fill(); }
    else if (k === 1) { g.fillRect(-22, -6, 44, 12); }
    else { g.beginPath(); g.moveTo(-16, 12); g.lineTo(0, -16); g.lineTo(16, 12); g.closePath(); g.fill(); }
    g.restore();
  }
  drawStar(g, 256, 128, 58, C.dark);
  drawStar(g, 256, 128, 48, C.bolt);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const printed = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.46, 0.78), printed);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.15, 0.83), printed);
  lid.position.y = 0.19;
  group.add(base, lid);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---------------------------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------------------------
const phone = buildPhone();
world.add(phone);

// Product photo: render the 3D shoe from the side once, and reuse it in the app's cards.
{
  const photoScene = new THREE.Scene();
  photoScene.environment = scene.environment;
  photoScene.add(new THREE.HemisphereLight(0xffffff, 0xb9bcc6, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 3, 4); photoScene.add(sun);
  const model = buildShoe(); model.rotation.set(0.12, -0.35, -0.12); photoScene.add(model);
  const cam = new THREE.OrthographicCamera(-1.05, 1.05, 0.79, -0.79, 0.1, 10); cam.position.set(0, 0.05, 5);
  renderer.setPixelRatio(1); renderer.setSize(512, 384, false);
  renderer.render(photoScene, cam);
  shoeThumb = canvasOf(512, 384);
  shoeThumb.getContext('2d').drawImage(renderer.domElement, 0, 0);
}

const GRIP_Y = uiY(300);                 // where the claw's fingers meet, over the top of the app
const CARD_Y = uiY(600);                 // middle of the product card
const OUT_Z = 0.62;                      // how far in front of the screen the action happens
const SHOE_SCALE = 0.6;                  // the shoe is about half the screen wide, like a product shot
const rig = new THREE.Group();           // claw + everything hanging from it
const claw = buildClaw();
const swing = new THREE.Group();         // pivots at the grip: laces + shoe
swing.position.y = -0.38 * 0.7;
claw.scale.setScalar(0.7);
const holder = new THREE.Group();        // the shoe's own transform (hanging pose → display pose)
const shoe = buildShoe();
holder.add(shoe);
const HANG = { pos: new THREE.Vector3(0.13, -0.6, 0), rotZ: -0.48 };
const SHOW = { pos: new THREE.Vector3(0, CARD_Y - GRIP_Y, 0) };
holder.position.copy(HANG.pos); holder.rotation.z = HANG.rotZ; holder.scale.setScalar(SHOE_SCALE); holder.updateMatrix();
// Two lace ends run from the collar up into the claw's grip.
const laces = new THREE.Group();
for (const side of [-1, 1]) {
  const end = shoe.userData.collar.clone().add(new THREE.Vector3(0, 0, side * 0.07)).applyMatrix4(holder.matrix);
  const mid = end.clone().multiplyScalar(0.5).add(new THREE.Vector3(side * 0.03, -0.03, side * 0.02));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), mid, end]), 16, 0.009, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }));
  tube.castShadow = true;
  laces.add(tube);
}
swing.add(laces, holder);
rig.add(claw, swing);
world.add(rig);

const box = buildBox();
box.position.set(0, CARD_Y, OUT_Z);
world.add(box);

// Confetti: one instanced mesh, simple ballistic motion.
const CONFETTI = 140;
const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.04), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CONFETTI);
const bits = Array.from({ length: CONFETTI }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), life: 0 }));
{
  const palette = [C.bolt, '#ff6b5a', C.cobalt, '#7fd8c6', '#ffffff'].map((h) => new THREE.Color(h));
  bits.forEach((_, i) => confetti.setColorAt(i, palette[i % palette.length]));
  confetti.frustumCulled = false;
  world.add(confetti);
}
const dummy = new THREE.Object3D();
function burst() {
  for (const b of bits) {
    b.p.set(0, CARD_Y, OUT_Z + 0.2);
    const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.4;
    b.v.set(Math.cos(a) * s * 0.8, 1.5 + Math.random() * 3, Math.sin(a) * s * 0.5 + 0.6);
    b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    b.life = 1.6 + Math.random() * 0.8;
  }
}
function stepConfetti(dt) {
  bits.forEach((b, i) => {
    if (b.life > 0) {
      b.life -= dt;
      b.v.y -= 5.5 * dt; b.v.multiplyScalar(1 - 0.9 * dt);
      b.p.addScaledVector(b.v, dt);
      dummy.position.copy(b.p);
      dummy.rotation.set(b.r.x += dt * 7, b.r.y += dt * 5, b.r.z);
      dummy.scale.setScalar(clamp01(b.life * 2.5));
    } else dummy.scale.setScalar(0);
    dummy.updateMatrix();
    confetti.setMatrixAt(i, dummy.matrix);
  });
  confetti.instanceMatrix.needsUpdate = true;
}

// A soft contact shadow under the floating phone.
{
  const c = canvasOf(256, 64), g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 32, 2, 128, 32, 126);
  grad.addColorStop(0, 'rgba(0,0,0,.42)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 64);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, -2.45, 0.2);
  scene.add(blob);
}

// ---------------------------------------------------------------------------------------------
// Sound (off until asked for; a few synthesised blips)
// ---------------------------------------------------------------------------------------------
let audio = null, soundOn = false;
function blip(freq, dur, { type = 'sine', gain = 0.12, to = freq } = {}) {
  if (!soundOn || !audio) return;
  const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
}
document.getElementById('sound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  if (soundOn && !audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (soundOn) audio.resume();
  e.currentTarget.textContent = `Sound: ${soundOn ? 'on' : 'off'}`;
});

// ---------------------------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------------------------
const T = { emerge: [1.0, 2.5], zoomIn: [1.0, 2.8], zoomOut: [3.5, 4.7], dim: [3.4, 4.2], modal: [5.0, 5.8], open: [5.75, 5.95],
  drop: [5.9, 6.9], retract: [6.05, 6.9], toBox: [7.9, 8.4], boxIn: [8.25, 8.85], success: [8.55, 9.05], burst: 8.3, loop: 12.5 };
const state = { start: performance.now(), last: 0, angle: 0, vel: 0, lastUI: '', fired: new Set() };
function restart() { state.start = performance.now(); state.last = 0; state.angle = 0; state.vel = 0; state.fired.clear(); bits.forEach((b) => (b.life = 0)); }
document.getElementById('replay').addEventListener('click', restart);

// Embedded in the shop (?embed=1): no page chrome, a transparent background, and the shop decides
// when it plays. It starts paused and restarts from the top each time it scrolls into view, so a
// visitor always sees the whole drop; off screen it draws nothing.
const EMBED = new URLSearchParams(location.search).has('embed');
let running = !EMBED;
if (EMBED) document.body.classList.add('embed');
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'kickdrop') return;
  if ('visible' in e.data) {
    if (e.data.visible && !running) restart();
    running = !!e.data.visible;
  }
  if (e.data.replay) { restart(); running = true; }
});
/** Runs `fn` once per loop, the first frame `t` passes `at`. */
function once(name, t, at, fn) { if (t >= at && !state.fired.has(name)) { state.fired.add(name); fn(); } }

const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; });

let fitDist = 12;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Far enough back that the whole phone fits, whichever way the window is shaped.
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  fitDist = Math.max(2.75 / tan, 1.45 / (tan * camera.aspect));
}
window.addEventListener('resize', resize);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  if (!running) return;
  let t = (now - state.start) / 1000;
  if (t > T.loop) { restart(); t = 0; }
  const dt = Math.min(0.05, Math.max(0, t - state.last));
  state.last = t;

  // --- camera: push in on the top of the screen, then pull back
  const zoom = easeInOut(ph(t, ...T.zoomIn)) * (1 - easeInOut(ph(t, ...T.zoomOut)));
  camera.position.set(0, lerp(0, 0.75, zoom), lerp(fitDist, fitDist * 0.56, zoom));
  camera.lookAt(0, lerp(0, 0.75, zoom), 0);
  world.rotation.y = lerp(world.rotation.y, pointer.x * 0.22 + Math.sin(t * 0.5) * 0.04, 0.06);
  world.rotation.x = lerp(world.rotation.x, pointer.y * 0.12, 0.06);
  world.position.y = Math.sin(t * 0.9) * 0.03;

  // --- the claw slides out of the screen along its arm
  const e = ph(t, ...T.emerge), out = easeOutBack(e), back = claw.userData.back;
  rig.visible = e > 0;
  rig.position.set(0, GRIP_Y + 0.38 * 0.7, OUT_Z).addScaledVector(back, (1 - out) * 1.3);
  rig.scale.setScalar(lerp(0.3, 1, easeOut(e)));
  const r = easeInOut(ph(t, ...T.retract));
  claw.position.copy(back).multiplyScalar(r * 1.7);
  claw.scale.setScalar(0.7 * lerp(1, 0.35, r));
  claw.visible = r < 1;
  const open = easeOut(ph(t, ...T.open));
  claw.userData.fingers.forEach((f) => (f.rotation.z = open * 0.55));

  // --- the shoe swings like a pendulum while it hangs (a damped spring, kicked at the big moves)
  once('kick1', t, T.emerge[0], () => { state.vel = 2.6; blip(180, 0.5, { type: 'sawtooth', gain: 0.05, to: 620 }); });
  once('kick2', t, T.zoomOut[0], () => { state.vel += 1.3; });
  state.vel += (-state.angle * 22 - state.vel * 1.5) * dt;
  state.angle += state.vel * dt;
  const d = ph(t, ...T.drop);
  swing.rotation.z = state.angle * (1 - easeOut(ph(t, T.drop[0], T.drop[0] + 0.4)));
  laces.visible = d === 0;

  // --- drop into the card, turn on the spot, then become the box
  const fall = easeOutBounce(d), settle = easeOut(ph(t, T.drop[0], T.drop[0] + 0.55));
  const spin = Math.max(0, t - T.drop[1]);
  const k = ph(t, ...T.toBox);
  holder.position.set(lerp(HANG.pos.x, SHOW.pos.x, settle), lerp(HANG.pos.y, SHOW.pos.y, fall) + (d === 1 ? Math.sin(spin * 2) * 0.03 : 0), 0);
  holder.rotation.set(d === 1 ? 0.12 : 0, d === 1 ? -0.35 + spin * 0.9 + easeIn(k) * 7 : lerp(0, -0.35, settle), lerp(HANG.rotZ, -0.1, settle));
  holder.scale.setScalar(SHOE_SCALE * (1 - easeIn(k)) * lerp(1, 1.25, settle));
  holder.visible = k < 1;
  once('thud', t, T.drop[0] + 0.36, () => blip(120, 0.18, { type: 'triangle', gain: 0.2, to: 60 }));

  const b = ph(t, ...T.boxIn);
  box.visible = b > 0;
  box.scale.setScalar(Math.max(0.0001, 0.8 * easeOutBack(b)));
  box.rotation.set(0.42, -0.55 + Math.sin(t * 0.8) * 0.12, 0.06);
  box.position.y = CARD_Y - 0.08 + Math.sin(t * 1.6) * 0.02;
  once('burst', t, T.burst, () => { burst(); blip(660, 0.14, { gain: 0.14 }); setTimeout(() => blip(880, 0.16, { gain: 0.14 }), 110); setTimeout(() => blip(1320, 0.3, { gain: 0.14 }), 230); });
  stepConfetti(dt);

  // --- the app's screen: redraw only when something on it changed
  const timer = t < 1.5 ? 3 : t < 2.4 ? 2 : t < 3.4 ? 1 : 0;
  once(`tick${timer}`, t, 0, () => blip(timer ? 880 : 1320, 0.08, { type: 'square', gain: 0.05 }));
  const screen = {
    timer, hero: t < T.emerge[0] + 0.1,
    dim: easeOut(ph(t, ...T.dim)), modal: easeOut(ph(t, ...T.modal)),
    progress: ph(t, T.modal[1], T.burst), success: ph(t, ...T.success),
  };
  const sig = `${screen.timer}|${screen.hero}|${screen.dim.toFixed(3)}|${screen.modal.toFixed(3)}|${screen.progress.toFixed(3)}|${screen.success.toFixed(3)}`;
  if (sig !== state.lastUI) { state.lastUI = sig; drawUI(screen); }

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Test handle: lets a script jump to a moment in the loop (window.__drop.seek(6.2)).
window.__drop = { seek: (sec) => { state.start = performance.now() - sec * 1000; state.last = sec; state.fired.clear(); }, T };
