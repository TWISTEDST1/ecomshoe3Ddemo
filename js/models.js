/**
 * STELLA SHOP product models, built in code with three.js: sneakers (high and low), caps, crew
 * socks and tote bags. Each builder takes a colourway, so one model makes a whole product line.
 * The same models are rendered into the product photos and shown live in the 3D viewers.
 */
import * as THREE from 'three';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Cubic Hermite curve through [x, y] knots: the sneaker's height and width profiles. */
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

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function texture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Draws the STELLA sparkle (a four-point star) centred at (x, y). */
export function drawStar(g, x, y, r, fill) {
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

function shadowed(group) {
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// =============================================================================================
// Sneaker
// =============================================================================================
const SHOE = { L: 1.6, H: 0.8, W: 0.86 };
const HIGH = spline([[0, 0.9], [0.1, 1], [0.3, 0.98], [0.42, 0.8], [0.55, 0.58], [0.7, 0.43], [0.85, 0.35], [0.93, 0.29], [0.975, 0.2], [1, 0]]);
const LOW = spline([[0, 0.5], [0.1, 0.56], [0.26, 0.55], [0.4, 0.5], [0.55, 0.46], [0.7, 0.4], [0.85, 0.34], [0.93, 0.28], [0.975, 0.2], [1, 0]]);
const WIDTH = spline([[0, 0.13], [0.04, 0.24], [0.15, 0.3], [0.45, 0.33], [0.7, 0.38], [0.85, 0.36], [0.93, 0.3], [0.975, 0.2], [1, 0]]);
const shoeX = (s) => (s - 0.45) * SHOE.L;

/** The upper's paint job in (u = heel→toe, v = around: 0 outer side … 0.5 top … 1 inner side). */
function paintUpper(cw, low) {
  const W = 1024, H = 512, c = canvasOf(W, H), g = c.getContext('2d');
  const px = (u, v) => [u * W, (1 - v) * H];
  const path = (pts, mirror) => {
    g.beginPath();
    pts.forEach(([u, v], i) => { const [x, y] = px(u, mirror ? 1 - v : v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  };
  const poly = (pts, fill) => { for (const m of [false, true]) { path(pts, m); g.closePath(); g.fillStyle = fill; g.fill(); } };
  const stitch = (pts) => {
    for (const m of [false, true]) {
      path(pts, m);
      g.setLineDash([7, 6]); g.lineWidth = 2; g.strokeStyle = cw.stitch || 'rgba(255,255,255,.7)'; g.stroke(); g.setLineDash([]);
    }
  };
  g.fillStyle = cw.base; g.fillRect(0, 0, W, H);
  // A faint leather grain.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  poly([[0, 0], [0.22, 0], [0.2, 0.1], [0.15, 0.2], [0, 0.22]], cw.accent);
  poly([[0.66, 0], [1, 0], [1, 0.5], [0.9, 0.5], [0.885, 0.3], [0.84, 0.17], [0.74, 0.12]], cw.accent);
  poly([[0, 0.22], [0.15, 0.2], [0.3, low ? 0.25 : 0.215], [0.4, 0.3], [0.4, 0.5], [0, 0.5]], cw.collar);
  poly([[0.36, 0.31], [0.76, 0.33], [0.79, 0.4], [0.76, 0.5], [0.36, 0.5]], cw.panel || cw.accent);
  poly([[0.38, 0.45], [0.75, 0.455], [0.75, 0.5], [0.38, 0.5]], cw.tongue || cw.base);
  stitch([[0.21, 0.01], [0.19, 0.1], [0.14, 0.19], [0.01, 0.21]]);
  stitch([[0.67, 0.012], [0.74, 0.108], [0.835, 0.158], [0.873, 0.3], [0.888, 0.49]]);
  stitch([[0.37, 0.3], [0.765, 0.32]]);
  g.fillStyle = cw.keyline || '#1b1d24';
  for (let i = 0; i < 6; i++) for (const v of [0.355, 0.645]) {
    const [x, y] = px(0.41 + i * 0.062, v); g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
  }
  g.globalAlpha = 0.45;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const [x, y] = px(0.8 + i * 0.022 - r * 0.004, 0.5 + side * (0.045 + r * 0.045)); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // The side mark: the STELLA sparkle with a keyline.
  for (const m of [false, true]) {
    const [x, y] = px(0.5, m ? 0.84 : 0.16);
    drawStar(g, x, y, 62, cw.keyline || '#1b1d24');
    drawStar(g, x, y, 52, cw.mark);
  }
  // Heel tab text.
  g.save();
  g.translate(...px(0.012, 0.5)); g.rotate(-Math.PI / 2);
  g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = cw.mark;
  g.fillText('STELLA', 0, 10);
  g.restore();
  return texture(c);
}

export function buildSneaker(cw, { low = false } = {}) {
  const heightAt = low ? LOW : HIGH;
  const g = new THREE.Group();
  const NS = 72, NT = 30, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, h = heightAt(s) * SHOE.H, w = WIDTH(s) * SHOE.W;
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
  const centre = pos.length / 3;
  pos.push(shoeX(0), heightAt(0) * SHOE.H * 0.45, 0); uv.push(0.02, 0.1);
  for (let j = 0; j < NT; j++) idx.push(centre, j + 1, j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: paintUpper(cw, low), roughness: 0.6, side: THREE.DoubleSide })));

  const foot = new THREE.Shape();
  const N = 48, edge = (s) => WIDTH(s) * SHOE.W * 1.07 + 0.012;
  for (let i = 0; i <= N; i++) { const s = i / N; i ? foot.lineTo(shoeX(s), edge(s)) : foot.moveTo(shoeX(s), edge(s)); }
  for (let i = N; i >= 0; i--) { const s = i / N; foot.lineTo(shoeX(s), -edge(s)); }
  const soleGeo = (depth, bevel) => {
    const sg = new THREE.ExtrudeGeometry(foot, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
    sg.rotateX(Math.PI / 2);
    return sg;
  };
  const mid = new THREE.Mesh(soleGeo(0.15, 0.03), new THREE.MeshStandardMaterial({ color: cw.sole, roughness: 0.5 }));
  mid.position.y = 0.02;
  const out = new THREE.Mesh(soleGeo(0.035, 0.012), new THREE.MeshStandardMaterial({ color: cw.outsole, roughness: 0.75 }));
  out.position.y = -0.17;
  g.add(mid, out);

  const laceMat = new THREE.MeshStandardMaterial({ color: cw.lace || '#ffffff', roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const s = 0.41 + i * 0.062, w = WIDTH(s) * SHOE.W * 0.5;
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, w * 2, 3, 8), laceMat);
    bar.rotation.x = Math.PI / 2;
    bar.rotation.z = i % 2 ? 0.32 : -0.32;
    bar.position.set(shoeX(s), heightAt(s) * SHOE.H * 0.985 + 0.012, 0);
    g.add(bar);
  }
  return shadowed(g);
}

// =============================================================================================
// Cap
// =============================================================================================
function paintCap(cw) {
  const W = 1024, H = 512, c = canvasOf(W, H), g = c.getContext('2d');
  g.fillStyle = cw.crown; g.fillRect(0, 0, W, H);
  // Twill: fine diagonal lines.
  g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 2;
  for (let x = -H; x < W; x += 7) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); }
  // Six panel seams with top-stitching, and an eyelet per panel. The crown uses the top half.
  for (let k = 0; k < 6; k++) {
    const x = (k / 6) * W;
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H / 2); g.stroke();
    g.setLineDash([6, 6]); g.strokeStyle = cw.stitch; g.lineWidth = 2;
    for (const d of [-9, 9]) { g.beginPath(); g.moveTo(x + d, 4); g.lineTo(x + d, H / 2); g.stroke(); }
    g.setLineDash([]);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + W / 12, 70, 7, 0, 7); g.fill();
  }
  // Front patch at u = 0.25 (facing +Z), on the lower part of the crown.
  const cx = 0.25 * W, cy = 0.36 * H;
  g.fillStyle = cw.patch; g.beginPath(); g.roundRect(cx - 92, cy - 42, 184, 84, 18); g.fill();
  drawStar(g, cx - 54, cy, 24, cw.logo);
  g.font = '800 30px system-ui, sans-serif'; g.fillStyle = cw.logo; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('STELLA', cx - 24, cy + 2);
  return texture(c);
}

export function buildCap(cw) {
  const g = new THREE.Group();
  const R = 0.62;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: paintCap(cw), roughness: 0.9 }));
  crown.scale.y = 0.98;
  g.add(crown);
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 10, 64), new THREE.MeshStandardMaterial({ color: cw.crown, roughness: 0.9 }));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), new THREE.MeshStandardMaterial({ color: cw.button || cw.crown, roughness: 0.6 }));
  button.position.y = R * 0.98;
  button.scale.y = 0.6;
  g.add(button);
  // The brim: a crescent between the crown's front edge and a long curve.
  const s = new THREE.Shape();
  s.moveTo(0.6, 0);
  for (let i = 0; i <= 32; i++) { const t = (i / 32) * Math.PI; s.lineTo(0.66 * Math.cos(t), 0.04 + 1.12 * Math.sin(t) * 0.92); }
  for (let i = 32; i >= 0; i--) { const t = (i / 32) * Math.PI; s.lineTo(0.6 * Math.cos(t), 0.6 * Math.sin(t)); }
  const brimGeo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 });
  brimGeo.rotateX(Math.PI / 2);
  const brim = new THREE.Group();
  brim.add(new THREE.Mesh(brimGeo, new THREE.MeshStandardMaterial({ color: cw.brim, roughness: 0.85 })));
  const underGeo = new THREE.ShapeGeometry(s, 24);
  underGeo.rotateX(Math.PI / 2);
  const under = new THREE.Mesh(underGeo, new THREE.MeshStandardMaterial({ color: cw.under, roughness: 0.9 }));
  under.position.y = -0.049;
  brim.add(under);
  brim.rotation.x = 0.16;
  brim.position.y = 0.02;
  g.add(brim);
  g.position.y = 0.08;
  const wrap = new THREE.Group();
  wrap.add(g);
  return shadowed(wrap);
}

// =============================================================================================
// Crew socks (a pair)
// =============================================================================================
function paintSock(cw) {
  const W = 1024, H = 256, c = canvasOf(W, H), g = c.getContext('2d');
  g.fillStyle = cw.body; g.fillRect(0, 0, W, H);
  // Knit: soft vertical ribs along the whole sock, stronger on the cuff.
  for (let y = 0; y < H; y += 6) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, 2); }
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let y = 0; y < H; y += 8) g.fillRect(0, y, 0.12 * W, 3);
  // Stripes below the cuff, heel and toe in the accent colour.
  cw.stripes.forEach((col, i) => { g.fillStyle = col; g.fillRect((0.13 + i * 0.045) * W, 0, 0.025 * W, H); });
  g.fillStyle = cw.heel; g.fillRect(0.6 * W, 0, 0.12 * W, H * 0.5); g.fillRect(0.9 * W, 0, 0.1 * W, H);
  // A small sparkle on the shin.
  drawStar(g, 0.35 * W, H * 0.75, 26, cw.stripes[0]);
  return texture(c);
}

function buildSock(cw) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.15, 0), new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0.02, 0.18, 0),
    new THREE.Vector3(0.14, -0.04, 0), new THREE.Vector3(0.45, -0.1, 0), new THREE.Vector3(0.82, -0.1, 0),
  ]);
  const geo = new THREE.TubeGeometry(curve, 96, 0.15, 28, false);
  const mat = new THREE.MeshStandardMaterial({ map: paintSock(cw), roughness: 0.95 });
  const g = new THREE.Group();
  const tube = new THREE.Mesh(geo, mat);
  tube.scale.z = 0.62; // flattened, like a sock lying in a pack
  g.add(tube);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), new THREE.MeshStandardMaterial({ color: cw.heel, roughness: 0.95 }));
  toe.position.set(0.82, -0.1, 0); toe.scale.set(0.9, 1, 0.62);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 10, 32), new THREE.MeshStandardMaterial({ color: cw.body, roughness: 0.95 }));
  cuff.rotation.x = Math.PI / 2; cuff.position.y = 1.15; cuff.scale.y = 0.62;
  g.add(toe, cuff);
  return g;
}

export function buildSocks(cw) {
  const g = new THREE.Group();
  const a = buildSock(cw), b = buildSock(cw);
  a.position.set(-0.32, -0.5, 0); a.rotation.z = 0.06;
  b.position.set(0.12, -0.55, -0.16); b.rotation.z = -0.04;
  g.add(a, b);
  // Laid flat, like a flat-lay product photo: legs away from the viewer, toes to the side.
  g.rotation.x = -Math.PI / 2;
  const wrap = new THREE.Group();
  wrap.add(g);
  return shadowed(wrap);
}

// =============================================================================================
// Tote bag
// =============================================================================================
function paintTote(cw) {
  const W = 512, H = 600, c = canvasOf(W, H), g = c.getContext('2d');
  g.fillStyle = cw.body; g.fillRect(0, 0, W, H);
  // Canvas weave.
  for (let i = 0; i < W; i += 4) { g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(i, 0, 1, H); }
  for (let j = 0; j < H; j += 4) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, j, W, 1); }
  drawStar(g, W / 2, H * 0.42, 92, cw.print);
  g.textAlign = 'center'; g.fillStyle = cw.print;
  g.font = '800 64px system-ui, sans-serif'; g.fillText('STELLA', W / 2, H * 0.68);
  g.font = '600 30px system-ui, sans-serif'; g.fillText('S H O P', W / 2, H * 0.75);
  g.strokeStyle = cw.print; g.lineWidth = 3; g.setLineDash([10, 8]);
  g.strokeRect(24, 24, W - 48, H - 48);
  return texture(c);
}

export function buildTote(cw) {
  const g = new THREE.Group();
  const front = paintTote(cw);
  const plain = new THREE.MeshStandardMaterial({ color: cw.body, roughness: 0.95 });
  const printed = new THREE.MeshStandardMaterial({ map: front, roughness: 0.95 });
  // Box faces: +x, -x, +y, -y, +z (front, printed), -z (back, printed too).
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.18, 0.16, 1, 1, 1), [plain, plain, plain, plain, printed, printed]);
  g.add(body);
  const handleMat = new THREE.MeshStandardMaterial({ color: cw.handle, roughness: 0.9 });
  for (const z of [0.07, -0.07]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.28, 0.56, z), new THREE.Vector3(-0.3, 0.95, z), new THREE.Vector3(0, 1.18, z),
      new THREE.Vector3(0.3, 0.95, z), new THREE.Vector3(0.28, 0.56, z),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.03, 10, false), handleMat);
    handle.scale.z = 0.5;
    g.add(handle);
  }
  g.position.y = -0.2;
  const wrap = new THREE.Group();
  wrap.add(g);
  return shadowed(wrap);
}

/** Builds the model for a product spec ({kind, cw, low}). */
export function buildModel(spec) {
  switch (spec.kind) {
    case 'sneaker': return buildSneaker(spec.cw, { low: spec.low });
    case 'cap': return buildCap(spec.cw);
    case 'socks': return buildSocks(spec.cw);
    case 'tote': return buildTote(spec.cw);
    default: throw new Error(`unknown model ${spec.kind}`);
  }
}
