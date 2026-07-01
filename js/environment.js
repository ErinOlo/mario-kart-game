import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THEMES } from './config.js';
import { createSakotis } from './sakotis.js';
import { createStrawberry } from './strawberry.js';

// Berlin's pretzel is now a real GLB model rather than procedural geometry.
const PRETZEL_MODEL_URL = 'public/models/pretzel.glb';

// ============================================================
//  Environment — themed scenery scattered around the fixed track.
//  Swapped wholesale when the player hits a theme/mode portal.
//
//  Every theme ships ONLY truly iconic items, in three depth bands:
//    • 3 big landmarks  — the skyline read (TV Tower, Windmill, …)
//    • 7 medium features — street-level icons (U-Bahn, canal boat, …)
//    • 10 small details  — near-track trinkets (currywurst, tulips, …)
//
//  Landmarks are scaled to read as a skyline but still FIT on screen
//  (tallest pieces ~25–35 units; the camera sits ~50–90 units away).
// ============================================================
export class Environment {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spinners = [];   // windmill sails, döner spits — rotated each frame

    // Berlin's giant pretzel landmark, loaded once from a GLB and cloned per build.
    this.pretzelModel = null;
    this.currentTheme = null;
    this._pretzelAdded = false;
    this._loadPretzelModel();
  }

  // Load the GLB pretzel once; drop it in immediately if Berlin is already showing.
  _loadPretzelModel() {
    new GLTFLoader().load(
      PRETZEL_MODEL_URL,
      (gltf) => {
        this.pretzelModel = gltf.scene;
        this.pretzelModel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        if (this.currentTheme === 'berlin') this._addPretzelLandmark();
      },
      undefined,
      (err) => console.error('Failed to load pretzel GLB:', err),
    );
  }

  // Clone the loaded pretzel, scale it to a skyline-landmark height, rest it on
  // the ground beside the track, and add it to the scene. No-op until loaded.
  _addPretzelLandmark() {
    if (!this.pretzelModel || this._pretzelAdded) return;
    const model = this.pretzelModel.clone(true);

    // scale so the model reads as a prominent landmark (~30u tall, like the gate)
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(model).getSize(size);
    const targetHeight = 30;
    model.scale.setScalar(size.y > 0 ? targetHeight / size.y : 1);

    // place it off to the side of the track early in the lap so it's clearly seen
    const wrap = new THREE.Group();
    wrap.name = 'pretzelLandmark';
    wrap.add(model);
    wrap.position.copy(this._outside(0.11, 1, 46, 0));
    // rest its lowest point on the ground after scaling
    const box = new THREE.Box3().setFromObject(wrap);
    model.position.y -= box.min.y;
    wrap.rotation.y = Math.PI;                 // face the track
    this._ensureClear(wrap, 5);
    this.group.add(wrap);
    this._pretzelAdded = true;
  }

  // pos just outside the road at param t, distance d beyond the curb
  _outside(t, side, dist, y = 0) {
    const base = this.track.placeAt(t, side, 0);
    const lat = this.track.lateralAt(t);
    return base.addScaledVector(lat, side * dist).setY(y);
  }

  // Guarantee an object's horizontal footprint stays clear of the ENTIRE
  // track loop. Because the circuit doubles back on itself, an object placed
  // far off one segment can overshoot the infield and land on another segment,
  // so we can't rely on the lateral offset alone. Push the object straight away
  // from whichever centerline point is nearest until it clears the road + gap.
  _ensureClear(obj, minGap = 3) {
    const half = this.track.width / 2;
    const pts = this.track._pts;
    const box = new THREE.Box3(), c = new THREE.Vector3(), size = new THREE.Vector3();
    for (let iter = 0; iter < 60; iter++) {
      box.setFromObject(obj); box.getCenter(c); box.getSize(size);
      const r = 0.5 * Math.hypot(size.x, size.z);        // horizontal footprint radius
      let dmin = Infinity, nx = 0, nz = 0;
      for (const p of pts) {
        const dx = c.x - p.x, dz = c.z - p.z;
        const d = dx * dx + dz * dz;
        if (d < dmin) { dmin = d; nx = p.x; nz = p.z; }
      }
      dmin = Math.sqrt(dmin);
      const clearance = dmin - r - half;
      if (clearance >= minGap) break;                    // already clear — the common case
      let ax = c.x - nx, az = c.z - nz;                  // push directly away from nearest point
      const len = Math.hypot(ax, az) || 1;
      obj.position.x += (ax / len) * (minGap - clearance + 0.5);
      obj.position.z += (az / len) * (minGap - clearance + 0.5);
    }
  }

  build(themeKey, mode) {
    this.clear();
    this.currentTheme = themeKey;
    this._pretzelAdded = false;
    const theme = THEMES[themeKey];
    const pal = theme[mode];
    // bright toy material — slight self-glow keeps colors saturated & non-grey
    const m = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.15 });

    // ---- big landmarks — far out so they loom as a skyline (depth layer 1) ----
    // pulled a little closer than before so the iconic shapes are clearly visible.
    for (let i = 0; i < 12; i++) {
      const t = i / 12 + 0.02;
      const side = i % 2 ? 1 : -1;
      const lm = this._landmark(themeKey, mode, m, i);
      lm.position.copy(this._outside(t, side, 42 + (i % 3) * 22, 0));
      lm.rotation.y = side > 0 ? Math.PI : 0;     // face the track
      this._ensureClear(lm, 4);                   // big pieces: keep a wider berth
      this.group.add(lm);
    }

    // ---- medium features — mid-field (depth layer 2), both sides, dense ----
    const medCount = 60;
    for (let i = 0; i < medCount; i++) {
      const t = (i / medCount + 0.006) % 1;
      const side = i % 2 ? 1 : -1;
      const med = this._medium(themeKey, mode, m, i);
      med.position.copy(this._outside(t, side, 17 + (i % 8) * 4.2, 0));
      med.rotation.y = i * 1.3;
      this._ensureClear(med, 3);
      this.group.add(med);
    }

    // ---- small details — near band (depth layer 3), VERY dense + varied ----
    // two interleaved sub-rings so both road sides stay crowded the whole loop.
    const smallCount = 260;
    for (let i = 0; i < smallCount; i++) {
      const t = (i / smallCount + (i % 2) * 0.0019) % 1;
      const side = (i % 2 ? 1 : -1);
      const small = this._small(themeKey, mode, m, i);
      // staggered: most hug the track, some pushed out to bridge toward mid-field
      const dist = 6 + (i % 11) * 2.3 + (i % 4) * 2.0;
      small.position.copy(this._outside(t, side, dist, 0));
      small.rotation.y = Math.sin(i * 2.1) * Math.PI;
      this._ensureClear(small, 2.5);
      this.group.add(small);
    }

    // ---- Berlin only: 100 strawberries scattered randomly across the field ----
    if (themeKey === 'berlin') {
      for (let i = 0; i < 100; i++) {
        const straw = createStrawberry(THREE, { size: 3, seed: i + 1 }); // 3× the natural size
        const t = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        const dist = 6 + Math.random() * 42;             // spread across the field band
        straw.position.copy(this._outside(t, side, dist, 0)); // group origin (y=0) is the bottom tip → sits on ground
        straw.rotation.y = Math.random() * Math.PI * 2;
        this._ensureClear(straw, 2);                     // keep off the racing path
        this.group.add(straw);
      }

      // the 3D pretzel landmark (loads async; added here once ready)
      this._addPretzelLandmark();
    }

    // ground & sky handled by Game via palette
    return pal;
  }

  // spin windmill sails / döner spits — called every frame by the game loop
  update(dt) {
    for (const s of this.spinners) s.rotation[s.userData.spinAxis] += s.userData.spinSpeed * dt;
  }

  // ---- depth band dispatch ------------------------------------------------
  _ctx(themeKey, mode, m, i) {
    const bad = mode === 'bad';
    const accent = THEMES[themeKey][mode].accent;
    const g = new THREE.Group();
    const add = (geo, c, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, m(c)); o.position.set(x, y, z); g.add(o); return o;
    };
    return { g, add, m, bad, accent, i, spinners: this.spinners };
  }

  _landmark(themeKey, mode, m, i) {
    const ctx = this._ctx(themeKey, mode, m, i);
    const arr = LANDMARKS[themeKey];
    arr[i % arr.length](ctx);
    return ctx.g;
  }

  _medium(themeKey, mode, m, i) {
    const ctx = this._ctx(themeKey, mode, m, i);
    const arr = MEDIUM[themeKey];
    arr[i % arr.length](ctx);
    return ctx.g;
  }

  _small(themeKey, mode, m, i) {
    if (mode === 'bad') return smallLitter(m, i);
    const ctx = this._ctx(themeKey, mode, m, i);
    const arr = SMALL[themeKey];
    arr[i % arr.length](ctx);
    ctx.g.scale.setScalar(1.5);
    return ctx.g;
  }

  clear() {
    this.spinners = [];
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      this.group.remove(c);
    }
  }
}

// shorthand geometry constructors -------------------------------------------
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const Cone = (r, h, s = 14) => new THREE.ConeGeometry(r, h, s);
const Sph = (r, s = 14) => new THREE.SphereGeometry(r, s, s);
const Dome = (r, s = 16) => new THREE.SphereGeometry(r, s, s, 0, Math.PI * 2, 0, Math.PI / 2);
const Tor = (r, t, arc) => new THREE.TorusGeometry(r, t, 10, 20, arc);
const Cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);
const Ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const grey = (bad, c) => (bad ? 0x5a5a54 : c);

// a bright blue canal-water patch with lighter ripple streaks
function water(add, w, d) {
  add(Box(w, 0.3, d), 0x1f8fe0, 0, 0.12, 0);                  // water surface
  for (let k = 0; k < 6; k++)
    add(Box(w * 0.72, 0.06, 0.3), 0x9fe0ff, (k % 2 ? 1 : -1) * 1.6, 0.28, -d / 2 + (k + 0.5) * d / 6); // ripples
}

// a single garment hanging from a rail at x / railY: shirt, dress or pants
function garment(add, x, railY, color, type) {
  add(Tor(0.18, 0.05, Math.PI), 0xcfd6dd, x, railY + 0.1, 0).rotation.z = Math.PI; // hook
  add(Box(1.5, 0.12, 0.12), 0xcfd6dd, x, railY - 0.45, 0);                          // shoulder bar
  if (type === 'dress') {
    add(Box(1.2, 1, 0.35), color, x, railY - 1.1, 0);                               // bodice
    add(Cone(0.95, 3, 12), color, x, railY - 2.2, 0);                               // flared skirt
  } else if (type === 'pants') {
    add(Box(1.4, 0.6, 0.45), color, x, railY - 1, 0);                               // waist
    for (const lx of [-0.34, 0.34]) add(Box(0.55, 2.6, 0.45), color, x + lx, railY - 2.4, 0); // legs
  } else { // shirt
    add(Box(1.6, 1.9, 0.4), color, x, railY - 1.5, 0);                              // body
    for (const sx of [-1, 1]) { const s = add(Box(0.55, 1.7, 0.4), color, x + sx, railY - 1.2, 0); s.rotation.z = sx * 0.55; } // sleeves
  }
}

// ============================================================
//  Shape Building Guide implementations (see CLAUDE.md)
//  Built to the documented spec exactly: the geometry constructors,
//  component positions, Z rotations (degrees → radians), hex colors,
//  MeshStandardMaterial, grouping and overall scale as written.
// ============================================================

// High Heel Shoe (Ladies Stiletto) — 3 components grouped together.
export function buildHighHeelShoe() {
  const group = new THREE.Group();
  const body = 0xFF1493;   // hot pink
  const heelCol = 0x333333; // dark grey
  // slight metallic sheen, shared style
  const sheen = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.35 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), sheen(body));
  main.position.set(0, 0.2, 0);
  group.add(main);

  const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2), sheen(heelCol));
  heel.position.set(0.25, -0.3, 0.3);
  group.add(heel);

  // Toe — stretched cone, color matches body
  const toe = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 16), sheen(body));
  toe.rotation.x = Math.PI / 2; // point the cone forward along +z
  toe.position.set(-0.3, 0, 0.4);
  group.add(toe);

  group.scale.setScalar(1.2); // 1.2 units overall height
  return group;
}

// ============================================================
//  BERLIN
// ============================================================
const LANDMARKS = { berlin: [], amsterdam: [], vilnius: [], vinted: [] };
const MEDIUM = { berlin: [], amsterdam: [], vilnius: [], vinted: [] };
const SMALL = { berlin: [], amsterdam: [], vilnius: [], vinted: [] };

// ---- Berlin landmarks ----
LANDMARKS.berlin = [
  // 1. Fernsehturm (TV Tower) — red/white, the dominant skyline piece, ~35 tall
  ({ g, add, bad }) => {
    g.scale.setScalar(2); // 2× size (position unchanged — placed at ground origin)
    const white = grey(bad, 0xffffff), red = grey(bad, 0xff2e3a);
    add(Cyl(0.8, 1.7, 22, 16), white, 0, 11, 0);                 // tapering shaft
    for (const y of [5, 10, 15]) add(Cyl(1.05, 1.15, 1.3, 16), red, 0, y, 0); // red bands
    add(Sph(2.7, 22), red, 0, 23.2, 0);                          // observation sphere
    const ring = add(Tor(2.6, 0.5), white, 0, 23.2, 0); ring.rotation.x = Math.PI / 2;
    add(Cyl(0.22, 0.45, 9, 10), white, 0, 30, 0);                // antenna mast
    for (const y of [27, 33]) add(Cyl(0.55, 0.55, 0.7, 10), red, 0, y, 0);
    add(Cone(0.25, 3, 8), red, 0, 36, 0);                        // tip
  },
  // 2. Brandenburg Gate — beige colonnade, gold arches, quadriga, ~12 tall
  ({ g, add, bad }) => {
    g.scale.setScalar(3); // 3× size (position unchanged — placed at ground origin)
    const beige = grey(bad, 0xe6cf92), gold = grey(bad, 0xf5b922);
    const W = 18, colN = 6, span = 3.0;
    add(Box(W, 1.2, 5), beige, 0, 0.6, 0);                       // plinth
    for (let c = 0; c < colN; c++) add(Cyl(0.8, 0.9, 8, 14), beige, (c - (colN - 1) / 2) * span, 4.6, 0);
    for (let a = 0; a < colN - 1; a++) {
      const arch = add(Tor(1.1, 0.32, Math.PI), gold, ((a + 0.5) - (colN - 1) / 2) * span, 8.4, 0);
    }
    add(Box(W, 2, 5), beige, 0, 9.8, 0);                         // entablature
    add(Box(W, 0.7, 5.4), gold, 0, 8.6, 0);                      // frieze
    add(Box(2.4, 1.4, 1.8), gold, 0, 11.6, 0);                   // chariot
    for (let h = 0; h < 4; h++) add(Box(0.5, 1.5, 1.6), gold, -1.8 + h * 1.0, 11.7, 0.9); // horses
  },
  // 3. Reichstag — stone block, portico + glass dome, smaller than TV Tower (~15)
  ({ g, add, bad, accent }) => {
    g.scale.setScalar(2); // 2× size (position unchanged — placed at ground origin)
    const stone = grey(bad, 0xddd6c4), glass = grey(bad, 0x9fdfe8);
    add(Box(16, 9, 10), stone, 0, 4.5, 0);                       // main block
    for (let c = 0; c < 4; c++) add(Cyl(0.7, 0.7, 7, 12), stone, -4.5 + c * 3, 4.5, 5.3); // portico columns
    add(Box(13, 1.6, 1.6), stone, 0, 8.7, 5.3);                  // portico beam
    const ped = add(Cone(2.4, 2.2, 4), stone, 0, 10.4, 5.3); ped.rotation.y = Math.PI / 4; ped.scale.set(2.6, 1, 0.5);
    add(Cyl(3.4, 3.7, 1.4, 22), stone, 0, 9.7, 0);               // dome drum
    add(Dome(3.2, 20), glass, 0, 10.4, 0);                       // glass dome
    add(Cyl(0.3, 0.3, 1.8, 8), accent, 0, 13.8, 0);              // lantern
  },
  // 4. Giant bratwurst on a fork — oversized Berlin street sausage
  ({ add, bad }) => {
    const meat = grey(bad, 0xa6632b);
    for (const x of [-5, 5]) add(Cyl(0.3, 0.3, 6.5, 8), grey(bad, 0x8a8f96), x, 3.2, 0); // support stakes
    const s = add(Cap(2.2, 11), meat, 0, 6.4, 0); s.rotation.z = Math.PI / 2;            // sausage
    for (let k = -2; k <= 2; k++) { const b = add(Cyl(2.26, 2.26, 0.45, 16), grey(bad, 0x6b3a18), k * 2.4, 6.4, 0); b.rotation.z = Math.PI / 2; } // grill char bands
    for (let k = 0; k < 9; k++) add(Sph(0.4, 8), grey(bad, 0xffd21f), -6 + k * 1.5, 8.6, Math.sin(k) * 0.5); // mustard squiggle
    add(Cyl(0.25, 0.25, 9, 8), grey(bad, 0xcfd6dd), 8, 9.5, 0);                          // fork handle
    for (let p = -1; p <= 1; p++) add(Cyl(0.12, 0.12, 2.4, 6), grey(bad, 0xcfd6dd), 8 + p * 0.45, 6.6, 0); // fork prongs
  },
  // (The giant pretzel landmark was replaced by the GLB model — see _addPretzelLandmark.)
];

// ---- Berlin medium ----
MEDIUM.berlin = [
  // 0. U-Bahn car — bright yellow body, red doors, windows, wheels
  ({ add, bad }) => {
    add(Box(8, 3, 2.6), grey(bad, 0xffd21f), 0, 2.2, 0);
    for (const x of [-2.6, 0, 2.6]) add(Box(1.2, 1.2, 2.7), grey(bad, 0x223), x, 2.6, 0); // windows
    for (const x of [-3.6, 3.6]) add(Box(0.6, 2.4, 2.7), grey(bad, 0xd0392b), x, 2.0, 0); // doors
    for (const x of [-2.6, 2.6]) for (const z of [-1.2, 1.2]) {
      const w = add(Cyl(0.6, 0.6, 0.4, 12), 0x1a1a22, x, 0.6, z); w.rotation.z = Math.PI / 2;
    }
  },
  // 1. Döner kebab spit — stacked rotating meat cone on a stand
  ({ g, add, m, bad, spinners }) => {
    add(Box(2.2, 2, 1.6), grey(bad, 0xc0392b), 0, 1, 0);        // grill base
    add(Cyl(0.12, 0.12, 5, 8), 0x999, 0, 3.4, 0);               // spit rod
    add(Sph(0.4, 10), grey(bad, 0xcd853f), 0, 5.4, 0);          // skewer top
    const spit = new THREE.Group(); spit.position.set(0, 3.2, 0);
    spit.add(new THREE.Mesh(Cone(0.95, 3.4, 14), m(grey(bad, 0xb5651d)))); // stacked meat
    spit.userData = { spinAxis: 'y', spinSpeed: 1.4 }; spinners.push(spit);
    g.add(spit);
  },
  // 2. Market stall — striped awning + counter
  ({ add, bad, accent }) => {
    add(Box(6, 0.6, 4), grey(bad, accent), 0, 4.4, 0);
    add(Box(5.4, 1.6, 3.4), grey(bad, 0xfff2e0), 0, 1.4, 0);
    for (const [x, z] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]])
      add(Cyl(0.18, 0.18, 4.4, 8), grey(bad, 0xe8e8e8), x, 2.2, z);
  },
  // 5. Bicycle with front basket
  ({ add, bad }) => {
    for (const x of [-1.1, 1.1]) { const w = add(Tor(0.7, 0.12, Math.PI * 2), 0x222, x, 0.7, 0); w.rotation.y = Math.PI / 2; }
    add(Box(2.2, 0.15, 0.12), grey(bad, 0xff2e63), 0, 1.0, 0);  // frame bar
    add(Cyl(0.05, 0.05, 1, 6), grey(bad, 0xff2e63), 1.0, 1.2, 0);
    add(Box(0.7, 0.6, 0.6), grey(bad, 0xe8c07a), 1.2, 1.5, 0);  // basket
  },
  // 6. Construction crane — Berlin's eternal skyline staple
  ({ add, bad }) => {
    const y = grey(bad, 0xffd21f);
    add(Box(0.9, 14, 0.9), y, 0, 7, 0);                         // mast
    add(Box(10, 0.7, 0.7), y, 2.5, 14, 0);                      // jib
    add(Box(3, 0.7, 0.7), y, -1.3, 14, 0);                      // counter-jib
    add(Box(1.4, 1.4, 1.4), grey(bad, 0x333), -2.4, 14, 0);     // counterweight
    add(Cyl(0.06, 0.06, 3, 6), 0x222, 6, 12.5, 0);              // cable
    add(Box(0.6, 0.6, 0.6), grey(bad, 0xff2e63), 6, 10.9, 0);   // hook block
  },
];

// ---- Berlin small ----
SMALL.berlin = [
  ({ add }) => { // 0 currywurst on a fork
    add(Box(0.7, 0.4, 0.5), 0xfff2e0, 0, 0.25, 0);
    for (let k = 0; k < 3; k++) add(Cap(0.12, 0.18), 0xff3b1e, -0.2 + k * 0.2, 0.55, 0);
    add(Cyl(0.04, 0.04, 1, 6), 0xcfd6dd, 0.28, 0.9, 0.1);
  },
  ({ add }) => { // 1 Berliner pastry — round doughnut, jam dot, sugar
    add(Sph(0.45, 12), 0xe8a85a, 0, 0.45, 0);
    add(Sph(0.16, 8), 0xd02a4a, 0, 0.78, 0);
    add(Sph(0.06, 6), 0xffffff, 0.18, 0.7, 0.1);
  },
  ({ add }) => { // 2 beer bottle
    add(Cyl(0.32, 0.32, 1.3, 12), 0x2f9e3a, 0, 0.65, 0);
    add(Cyl(0.12, 0.2, 0.5, 10), 0x2f9e3a, 0, 1.45, 0);
    add(Cyl(0.13, 0.13, 0.12, 10), 0xffd23f, 0, 1.72, 0);
    add(Cyl(0.33, 0.33, 0.4, 12), 0xfff2e0, 0, 0.6, 0);
  },
  ({ add, i }) => { // 3 neon cocktail glass
    add(Cone(0.5, 0.6, 14), 0x9be7ff, 0, 0.95, 0);
    add(Cone(0.4, 0.42, 14), [0xff4fa3, 0x4fd0ff][i % 2], 0, 0.92, 0);
    add(Cyl(0.05, 0.05, 0.7, 8), 0xbfeaff, 0, 0.45, 0);
    add(Cyl(0.28, 0.28, 0.07, 12), 0xbfeaff, 0, 0.1, 0);
  },
  ({ add, i }) => { // 4 coffee cup
    const c = [0xff5ca8, 0x1f9fff, 0xff7a18, 0x2ecc40][i % 4];
    add(Cyl(0.32, 0.24, 0.9, 14), c, 0, 0.45, 0);
    add(Cyl(0.35, 0.35, 0.12, 14), 0xffffff, 0, 0.96, 0);
    add(Cyl(0.06, 0.06, 0.2, 8), 0xffffff, 0, 1.1, 0);
  },
  ({ add }) => { // 6 sausage bunch — linked sausages
    for (let k = 0; k < 4; k++) { const s = add(Cap(0.16, 0.5), 0xb5651d, -0.45 + k * 0.3, 0.5 + (k % 2) * 0.2, 0); s.rotation.z = 0.4; }
  },
  ({ add, i }) => { // 7 street sign
    add(Cyl(0.08, 0.08, 2.2, 8), 0xbfc6cc, 0, 1.1, 0);
    add(Box(1.1, 0.5, 0.1), [0x1f6fff, 0xff2e63][i % 2], 0.3, 1.9, 0);
  },
  ({ add }) => { // 8 park bench
    add(Box(1.8, 0.16, 0.6), 0x2e7d4a, 0, 0.7, 0);              // seat
    add(Box(1.8, 0.5, 0.12), 0x2e7d4a, 0, 1.0, -0.24);          // back
    for (const x of [-0.8, 0.8]) add(Box(0.14, 0.7, 0.6), 0x445, x, 0.35, 0);
  },
  ({ add }) => { // 9 lamppost
    add(Cyl(0.1, 0.13, 2.4, 8), 0x35506b, 0, 1.2, 0);
    add(Sph(0.26, 10), 0xfff2a8, 0, 2.5, 0);
  },
];

// ============================================================
//  AMSTERDAM
// ============================================================
LANDMARKS.amsterdam = [
  // 1. Windmill (Kinderdijk) — massive, rotating sails visible
  ({ g, add, m, bad, spinners }) => {
    add(Cyl(3, 4.6, 16, 14), grey(bad, 0x9c6b3f), 0, 8, 0);     // tapered tower
    add(Cone(5, 5, 14), grey(bad, 0x5a3a26), 0, 18.5, 0);       // cap
    add(Tor(4.7, 0.4, Math.PI * 2), grey(bad, 0x6b4a30), 0, 13, 0); // balcony ring
    add(Box(1.6, 3, 4), grey(bad, 0xc0392b), 0, 3, 4.4);        // door bay
    // 4 spinning sails on the front face
    const hub = new THREE.Group(); hub.position.set(0, 16.8, 5);
    for (let b = 0; b < 4; b++) {
      const arm = new THREE.Mesh(Box(1.6, 16, 0.3), m(grey(bad, 0xf3ecd6)));
      arm.rotation.z = b * Math.PI / 2; hub.add(arm);
      const lat = new THREE.Mesh(Box(2.0, 13, 0.1), m(grey(bad, 0x8a6a44)));
      lat.rotation.z = b * Math.PI / 2; lat.position.z = 0.15; hub.add(lat);
    }
    const bolt = new THREE.Mesh(Sph(0.6, 10), m(grey(bad, 0x333))); hub.add(bolt);
    hub.userData = { spinAxis: 'z', spinSpeed: 0.5 }; spinners.push(hub); g.add(hub);
  },
  // 2. Anne Frank House — narrow tall canal house, stepped gable
  ({ add, bad }) => {
    const brick = grey(bad, 0x6b4a3a), trim = grey(bad, 0xf2efe6);
    add(Box(6, 18, 6), brick, 0, 9, 0);                         // narrow facade
    // stepped gable
    add(Box(5, 1.2, 6.1), brick, 0, 18.6, 0);
    add(Box(3.4, 1.2, 6.1), brick, 0, 19.6, 0);
    add(Box(1.8, 1.4, 6.1), brick, 0, 20.7, 0);
    // window grid (4 floors × 2)
    for (let f = 0; f < 4; f++) for (const x of [-1.4, 1.4])
      add(Box(1.4, 2, 0.3), trim, x, 4 + f * 3.6, 3.05);
    add(Box(1.8, 3, 0.3), grey(bad, 0x3a2a20), 0, 2, 3.05);     // door
    const hook = add(Box(1.4, 0.3, 0.3), trim, 0, 17.6, 3.4);   // gable hoisting beam
  },
  // 3. Canal barge — long low boat floating on canal water
  ({ add, bad, accent }) => {
    water(add, 34, 14);                                         // the canal itself
    add(Box(22, 2.4, 5), grey(bad, 0x2e5d3a), 0, 1.4, 0);       // hull
    add(Box(20, 0.6, 4.4), grey(bad, 0x5a3a26), 0, 2.7, 0);     // deck
    add(Box(8, 2.4, 3.6), grey(bad, 0xf2efe6), -2, 4, 0);       // cabin
    for (let w = 0; w < 4; w++) add(Box(1, 1, 3.7), grey(bad, 0x2a4a6a), -5 + w * 2, 4.2, 0); // windows
    add(Cyl(0.12, 0.12, 5, 8), grey(bad, 0x333), 8, 4.5, 0);    // mast
    add(Box(1.6, 1, 0.1), grey(bad, accent), 8.8, 6, 0);        // flag
  },
  // 4. Dutch canal houses — narrow, tall, colorful gabled facades
  ({ add, bad }) => {
    const cols = [0xe8722e, 0xf2c14e, 0xc0392b, 0x2e7d4a, 0x2c5d9e];
    const N = 5, w = 3.4;
    for (let h = 0; h < N; h++) {
      const x = (h - (N - 1) / 2) * (w + 0.3);
      const H = 13 + (h % 3) * 2;
      const c = grey(bad, cols[h % cols.length]);
      add(Box(w, H, 4), c, x, H / 2, 0);
      if (h % 2 === 0) {                                        // bell gable
        add(Cone(w * 0.78, 2.6, 4), c, x, H + 1.2, 0).rotation.y = Math.PI / 4;
      } else {                                                 // stepped gable
        add(Box(w * 0.7, 0.9, 4), c, x, H + 0.5, 0);
        add(Box(w * 0.45, 0.9, 4), c, x, H + 1.3, 0);
        add(Box(w * 0.22, 1.0, 4), c, x, H + 2.1, 0);
      }
      for (let f = 0; f < 3; f++) for (const wx of [-0.8, 0.8])  // white windows
        add(Box(0.9, 1.3, 0.2), grey(bad, 0xfff8ee), x + wx, 3 + f * 3.2, 2.05);
      add(Box(0.8, 0.25, 0.25), grey(bad, 0x3a2a20), x, H - 0.6, 2.4); // gable hoist beam
    }
  },
  // 5. Huge cheese wedge — yellow, holes, dark rind
  ({ add, bad }) => {
    const yellow = grey(bad, 0xf2c200);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(11, 0); shape.lineTo(11, 6.5); shape.closePath();
    add(new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false }), yellow, -5.5, 0.1, -3); // wedge
    add(Box(0.7, 6.5, 6), grey(bad, 0xe0a000), 5.5, 3.35, 0);  // dark rind on tall face
    for (let k = 0; k < 5; k++) add(Sph(0.6 + (k % 2) * 0.35, 10), grey(bad, 0xe6ad00), -3 + k * 1.7, 1.3 + (k % 2) * 1.7, -3.0); // holes
    for (let k = 0; k < 3; k++) add(Sph(0.7, 10), grey(bad, 0xe6ad00), -1 + k * 2, 1.6 + k * 0.9, 3.0);
  },
  // 6. Stack of Dutch pancakes (poffertjes) — golden, fluffy, powdered sugar
  ({ add, bad }) => {
    add(Cyl(7, 7, 0.6, 24), grey(bad, 0xf0ece2), 0, 0.3, 0);   // plate
    const gold = grey(bad, 0xe0a64e);
    for (let k = 0; k < 6; k++) { const cake = add(Sph(4.4 - k * 0.15, 16), gold, 0, 1 + k * 1.5, 0); cake.scale.y = 0.45; }
    add(Box(1.6, 0.8, 1.6), grey(bad, 0xffe680), 0, 10, 0);    // pat of butter
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(Sph(0.25, 6), grey(bad, 0xffffff), Math.cos(a) * 3.5, 9 + Math.sin(a * 3) * 0.4, Math.sin(a) * 3.5); } // sugar
  },
];

MEDIUM.amsterdam = [
  // 0 double-decker tour boat — long glass-roofed canal boat on water
  ({ add, bad }) => {
    water(add, 15, 7);
    add(Box(9, 1.6, 3), grey(bad, 0x2c3e6a), 0, 1, 0);          // hull
    add(Box(8.4, 1.6, 2.8), grey(bad, 0xbfe7ff), 0, 2.6, 0);    // glass lower deck
    add(Box(8, 0.3, 2.8), grey(bad, 0xffffff), 0, 3.5, 0);      // roof
    add(Box(1.2, 0.8, 2.8), grey(bad, 0x88aacc), 3.8, 4, 0);    // pilot cabin
  },
  // 1 cheese wheel stack — yellow wheels with red wax
  ({ add, bad }) => {
    for (let k = 0; k < 3; k++) {
      add(Cyl(1, 1, 0.7, 16), grey(bad, 0xf2c200), 0, 0.6 + k * 0.8, 0);
      add(Tor(1, 0.1, Math.PI * 2), grey(bad, 0xc0392b), 0, 0.6 + k * 0.8, 0).rotation.x = Math.PI / 2;
    }
  },
  // 2 tulip bundle in a bucket
  ({ add, bad }) => {
    add(Cyl(0.8, 0.6, 1.2, 12), grey(bad, 0x3a7a4a), 0, 0.6, 0);
    const cols = [0xff2e63, 0xffd23f, 0xff7a18, 0x9b4dff, 0xffffff];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, r = 0.4;
      add(Cyl(0.05, 0.05, 1.6, 6), 0x2e9e3a, Math.cos(a) * r, 1.6, Math.sin(a) * r);
      add(Sph(0.22, 8), grey(bad, cols[k % 5]), Math.cos(a) * r, 2.5, Math.sin(a) * r);
    }
  },
  // 3 stroopwafel stand — cart with a round waffle sign
  ({ add, bad }) => {
    add(Box(3, 2, 2), grey(bad, 0x8a5a33), 0, 1.4, 0);
    add(Box(3.4, 0.3, 1.2), grey(bad, 0xffffff), 0, 3, 1), add(Box(3.4, 0.3, 1.2), grey(bad, 0xc0392b), 0, 3.3, 1);
    const s = add(Cyl(1, 1, 0.2, 18), grey(bad, 0xc98a3c), 0, 4.2, 0); s.rotation.x = Math.PI / 2;
  },
  // 4 overflowing bicycle rack
  ({ add, bad }) => {
    add(Box(5, 0.2, 0.2), grey(bad, 0x778), 0, 0.6, 0);         // rail
    const cols = [0xff2e63, 0x1f9fff, 0x2ecc40, 0xffd23f];
    for (let b = 0; b < 4; b++) {
      const lean = (b - 1.5) * 0.2;
      for (const dz of [-0.3, 0.3]) { const w = add(Tor(0.5, 0.08, Math.PI * 2), 0x222, -1.6 + b * 1.1, 0.5, dz); w.rotation.y = Math.PI / 2; w.rotation.z = lean; }
      add(Box(1, 0.1, 0.08), grey(bad, cols[b]), -1.6 + b * 1.1, 0.9, 0).rotation.z = lean;
    }
  },
  // 5 flower-market stall — awning over flower trays
  ({ add, bad, accent }) => {
    add(Box(5, 0.5, 3), grey(bad, accent), 0, 3.8, 0);
    for (const [x, z] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) add(Cyl(0.14, 0.14, 3.6, 8), grey(bad, 0xeee), x, 1.9, z);
    const cols = [0xff2e63, 0xffd23f, 0x9b4dff];
    for (let k = 0; k < 3; k++) add(Box(1.2, 0.4, 2.2), grey(bad, cols[k]), -1.6 + k * 1.6, 1.2, 0);
  },
  // 6 drawbridge — white raised double-leaf bridge
  ({ add, bad }) => {
    const wood = grey(bad, 0xf2efe6);
    for (const x of [-2.5, 2.5]) add(Box(0.6, 6, 0.6), wood, x, 3, 0);     // towers
    add(Box(6, 0.6, 0.6), wood, 0, 6, 0);                                  // top beam
    const leaf = add(Box(0.4, 4, 1.4), wood, -1.8, 4, 0); leaf.rotation.z = -0.7;  // raised deck
    const leaf2 = add(Box(0.4, 4, 1.4), wood, 1.8, 4, 0); leaf2.rotation.z = 0.7;
    for (const x of [-2.5, 2.5]) add(Box(1, 1, 0.8), grey(bad, 0x556), x, 5.4, 0); // counterweights
  },
];

SMALL.amsterdam = [
  ({ add, i }) => { // 0 tulip
    add(Cyl(0.05, 0.06, 1.1, 6), 0x2e9e3a, 0, 0.55, 0);
    add(Sph(0.24, 8), [0xff2e63, 0xffd23f, 0x9b4dff, 0xff7a18][i % 4], 0, 1.2, 0);
  },
  ({ add }) => { // 1 stroopwafel stack
    for (let k = 0; k < 3; k++) { const w = add(Cyl(0.5, 0.5, 0.12, 16), 0xc98a3c, 0, 0.3 + k * 0.16, 0); }
  },
  ({ add }) => { // 2 cheese wedge with holes
    const wedge = add(Cone(0.6, 0.7, 4), 0xf2c200, 0, 0.4, 0); wedge.rotation.y = Math.PI / 4; wedge.scale.set(1, 0.7, 1.3);
    add(Sph(0.08, 6), 0xe0a800, 0.1, 0.45, 0.2);
  },
  ({ add }) => { // 3 wooden clog
    const c = add(Cap(0.22, 0.5), 0xffd23f, 0, 0.3, 0); c.rotation.z = Math.PI / 2;
    add(Cone(0.2, 0.4, 8), 0xffd23f, 0.4, 0.45, 0);
  },
  ({ add }) => { // 4 Delft blue pottery vase
    add(Sph(0.4, 12), 0xffffff, 0, 0.5, 0);
    add(Cyl(0.18, 0.22, 0.4, 10), 0xffffff, 0, 0.95, 0);
    add(Tor(0.3, 0.05, Math.PI * 2), 0x1f4fa0, 0, 0.55, 0).rotation.x = Math.PI / 2;
  },
  ({ add }) => { // 5 pancake stack with topping
    for (let k = 0; k < 3; k++) add(Cyl(0.55, 0.55, 0.14, 16), 0xe8c07a, 0, 0.3 + k * 0.16, 0);
    add(Sph(0.12, 8), 0xd02a4a, 0, 0.85, 0);
  },
  ({ add }) => { // 6 canal lantern
    add(Cyl(0.06, 0.06, 1.4, 6), 0x2a2a2a, 0, 0.7, 0);
    add(Box(0.3, 0.4, 0.3), 0xfff2a8, 0, 1.5, 0);
  },
  ({ add, i }) => { // 7 flower pot
    add(Cyl(0.3, 0.22, 0.5, 10), 0xc0653a, 0, 0.25, 0);
    for (let k = 0; k < 3; k++) add(Sph(0.14, 8), [0xff2e63, 0xffd23f, 0x9b4dff][(i + k) % 3], -0.15 + k * 0.15, 0.6, 0);
  },
  ({ add }) => { // 8 door knocker on a panel
    add(Box(0.6, 0.9, 0.12), 0x4a3a2a, 0, 0.6, 0);
    add(Tor(0.16, 0.05, Math.PI * 2), 0xd4af37, 0, 0.6, 0.1).rotation.x = 0.2;
  },
  ({ add }) => { // 9 bicycle bell — domed cap on a stem
    add(Dome(0.3, 12), 0xc0392b, 0, 0.4, 0);
    add(Cyl(0.04, 0.04, 0.4, 6), 0x888, 0, 0.2, 0);
  },
];

// ============================================================
//  VILNIUS
// ============================================================
LANDMARKS.vilnius = [
  // 1. Gediminas Tower — red-brick tower on a green hill, flag on top
  ({ add, bad }) => {
    add(Cone(10, 8, 18), grey(bad, 0x6f9a4a), 0, 4, 0);         // hill
    add(Cyl(3.5, 4, 13, 8), grey(bad, 0xb5503a), 0, 14.5, 0);   // octagonal tower
    for (let c = 0; c < 8; c++) { const a = c / 8 * Math.PI * 2; add(Box(0.8, 1.2, 0.8), grey(bad, 0x8a3a2a), Math.cos(a) * 3.7, 21.4, Math.sin(a) * 3.7); } // crenellations
    add(Cyl(0.08, 0.08, 3, 6), 0x555, 0, 23.5, 0);              // flagpole
    add(Box(1.4, 0.9, 0.05), grey(bad, 0xfdb913), 0.7, 24.4, 0);
    add(Box(1.4, 0.9, 0.05), grey(bad, 0x006a44), 0.7, 23.5, 0);
  },
  // 2. Vilnius Cathedral — white neoclassical block + freestanding belfry
  ({ add, bad, accent }) => {
    const white = grey(bad, 0xfff8ee);
    add(Box(13, 11, 9), white, -3, 5.5, 0);                     // main body
    for (let c = 0; c < 5; c++) add(Cyl(0.7, 0.7, 9, 12), white, -7 + c * 2, 5.5, 5);  // portico columns
    const ped = add(Box(11, 3, 1.6), white, -3, 11.8, 4.6);     // pediment block
    add(Cone(1.2, 2, 4), white, -3, 14, 4.6).rotation.y = Math.PI / 4;
    // round belfry tower
    add(Cyl(2.2, 2.6, 16, 16), white, 8, 8, 0);
    add(Cyl(1.8, 2.0, 4, 16), white, 8, 17.5, 0);
    add(Cone(2, 4, 16), grey(bad, accent), 8, 21.5, 0);         // green spire cap
    add(Cyl(0.1, 0.1, 1.4, 6), grey(bad, 0xd4af37), 8, 24, 0);
  },
  // 3. Hill of Crosses — distinctive mound bristling with crosses
  ({ add, bad }) => {
    add(Cone(9, 5, 16), grey(bad, 0x7a6a4a), 0, 2.5, 0);        // mound
    let n = 0;
    for (let ring = 0; ring < 3; ring++) {
      const count = 6 + ring * 4, rad = 2 + ring * 2.4, hy = 5 - ring * 1.2;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + ring;
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        const h = 1.6 + (n % 4) * 0.6; n++;
        add(Box(0.14, h, 0.14), grey(bad, 0x6b4a2a), x, hy + h / 2, z);          // upright
        add(Box(0.7, 0.14, 0.14), grey(bad, 0x6b4a2a), x, hy + h * 0.7, z);      // crossbar
      }
    }
  },
  // 4. Šakotis — Lithuanian spit cake: tan tapering tower bristling with spikes
  ({ add, bad }) => {
    const cake = grey(bad, 0xc89b5e), spike = grey(bad, 0xb07d3e);
    add(Cyl(3.2, 4, 2, 16), grey(bad, 0x8a6a44), 0, 1, 0);              // base stand
    const levels = 9;
    for (let L = 0; L < levels; L++) {
      const y = 3 + L * 1.9;
      const r = 3.2 * (1 - L / (levels + 1));
      add(Cyl(r, r + 0.3, 1.4, 16), cake, 0, y, 0);                     // ring layer
      add(Tor(r + 0.1, 0.35, Math.PI * 2), cake, 0, y, 0).rotation.x = Math.PI / 2; // ridge
      const sn = 10;
      for (let k = 0; k < sn; k++) {                                    // ring of outward spikes
        const a = (k / sn) * Math.PI * 2 + L * 0.4;
        const sp = add(Cone(0.4, 1.6, 6), spike, Math.cos(a) * (r + 0.4), y, Math.sin(a) * (r + 0.4));
        sp.rotation.z = -Math.cos(a) * 1.3; sp.rotation.x = Math.sin(a) * 1.3;
      }
    }
    add(Cone(0.6, 2.2, 8), cake, 0, 3 + levels * 1.9, 0);               // top point
  },
  // 5. Sūrelis — big pale Lithuanian curd cheese wheels with chocolate glaze
  ({ add, bad }) => {
    const curd = grey(bad, 0xf5e9cf), glaze = grey(bad, 0x5a3b22);
    const radii = [5, 4.2, 3.4];
    let y = 0;
    for (let k = 0; k < radii.length; k++) {
      const h = 3.2 - k * 0.3;
      add(Cyl(radii[k], radii[k], h, 24), curd, 0, y + h / 2, 0);
      y += h;
    }
    add(Cyl(3.5, 3.5, 0.7, 24), glaze, 0, y + 0.2, 0);                  // glaze cap
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(Cap(0.3, 1.2), glaze, Math.cos(a) * 3.2, y - 0.4, Math.sin(a) * 3.2); } // drips
  },
  // Šakotis (Lithuanian tree cake) — huge procedural roadside decoration
  ({ g }) => {
    const cake = createSakotis(THREE, { height: 6.5, seed: 7 });
    cake.scale.setScalar(4.8);                          // scale up to read as a skyline landmark (~31u tall)
    const box = new THREE.Box3().setFromObject(cake);
    cake.position.y -= box.min.y;                       // rest the board flat on the ground
    g.add(cake);
  },
  // Second Šakotis — 25% smaller than the first, placed elsewhere along the road
  ({ g }) => {
    const cake = createSakotis(THREE, { height: 6.5, seed: 7 });
    cake.scale.setScalar(3.6);                          // 25% smaller than the 4.8 one (~23u tall)
    const box = new THREE.Box3().setFromObject(cake);
    cake.position.y -= box.min.y;                       // rest the board flat on the ground
    g.add(cake);
  },
];

MEDIUM.vilnius = [
  // 0 University — long ochre baroque facade w/ red roof
  ({ add, bad }) => {
    add(Box(8, 5, 3), grey(bad, 0xe8b96a), 0, 2.5, 0);
    add(Box(8.4, 1.2, 3.4), grey(bad, 0xa0392b), 0, 5.6, 0);    // red roof band
    for (let w = 0; w < 5; w++) add(Box(0.8, 1.4, 0.2), grey(bad, 0xfff2e0), -3.2 + w * 1.6, 2.6, 1.55);
    add(Tor(0.7, 0.2, Math.PI), grey(bad, 0xfff2e0), 0, 1.4, 1.55); // arched entrance
  },
  // 1 Gate of Dawn (Aušros Vartai) — yellow arched gate w/ chapel above
  ({ add, bad }) => {
    add(Box(5, 7, 3), grey(bad, 0xf2c14e), 0, 3.5, 0);
    add(Tor(1.4, 0.4, Math.PI), grey(bad, 0xc99a2e), 0, 4, 1.5);  // arch
    add(Box(3.5, 2.4, 2.6), grey(bad, 0xf7d978), 0, 8, 0);       // chapel above
    add(Cyl(0.08, 0.08, 1.4, 6), 0xd4af37, 0, 10, 0);            // small cross
    add(Box(0.5, 0.1, 0.1), 0xd4af37, 0, 9.7, 0);
  },
  // 2 small white church w/ spire
  ({ add, bad, accent }) => {
    add(Box(3, 5, 4), grey(bad, 0xfff8ee), 0, 2.5, 0);
    add(Cyl(0.9, 0.9, 4, 8), grey(bad, 0xfff8ee), 0, 6, -1);     // tower
    add(Cone(1, 3, 8), grey(bad, accent), 0, 9, -1);             // spire
  },
  // 3 basketball hall — Vilnius lives for hoops; modern domed arena
  ({ add, bad, accent }) => {
    add(Cyl(4, 4, 3, 18), grey(bad, 0xb6c2cc), 0, 1.5, 0);
    add(Dome(4, 18), grey(bad, accent), 0, 3, 0);               // dome roof
    add(Box(0.1, 1.4, 1.4), grey(bad, 0xffffff), 4, 3, 0);      // backboard hint
  },
  // 4 Vilnius TV Tower — tall slim concrete tower w/ flared base + ring
  ({ add, bad }) => {
    add(Cone(2.6, 4, 12), grey(bad, 0xdfe4e8), 0, 2, 0);        // flared base
    add(Cyl(0.5, 0.9, 12, 12), grey(bad, 0xeef2f5), 0, 9, 0);   // shaft
    add(Cyl(1.6, 1.6, 1.4, 16), grey(bad, 0xc0c8cf), 0, 13, 0); // observation ring
    add(Cyl(0.12, 0.2, 5, 8), grey(bad, 0xff3b2e), 0, 16, 0);   // mast
  },
  // 5 Mindaugas Bridge — modern span with cables
  ({ add, bad }) => {
    add(Box(9, 0.5, 1.6), grey(bad, 0x9aa4ac), 0, 1.5, 0);      // deck
    for (const x of [-3.5, 3.5]) add(Box(0.4, 4, 0.4), grey(bad, 0x778), x, 3.5, 0);  // pylons
    for (let k = 0; k < 4; k++) { const c = add(Cyl(0.03, 0.03, 4, 5), 0xccc, -3 + k * 0.8, 3, 0); c.rotation.z = 0.4 - k * 0.1; }
  },
  // 6 standalone old-town bell tower
  ({ add, bad, accent }) => {
    add(Box(2.4, 8, 2.4), grey(bad, 0xfff2e0), 0, 4, 0);
    add(Box(1.6, 1.6, 1.6), grey(bad, 0x6a4a3a), 0, 8.8, 0);    // bell housing
    add(Cone(1.4, 2.4, 4), grey(bad, accent), 0, 10.8, 0).rotation.y = Math.PI / 4;
  },
];

SMALL.vilnius = [
  ({ add }) => { // 0 amber jewelry — glowing orange gem on a base
    add(Cyl(0.3, 0.3, 0.1, 12), 0x2a2a2a, 0, 0.1, 0);
    const gem = add(Ico(0.32, 0), 0xff9a1e, 0, 0.45, 0); gem.scale.set(1, 1.3, 1);
  },
  ({ add }) => { // 1 kibinai — golden half-moon pastry
    const k = add(Cap(0.22, 0.5), 0xd8a24a, 0, 0.3, 0); k.rotation.z = Math.PI / 2; k.scale.set(1, 1, 0.7);
    add(Box(0.5, 0.05, 0.1), 0xb5772e, 0, 0.5, 0);             // crimped seam
  },
  ({ add }) => { // 2 mead bottle — honey-gold
    add(Cyl(0.3, 0.3, 1.1, 12), 0xd9a300, 0, 0.55, 0);
    add(Cyl(0.1, 0.16, 0.45, 10), 0xd9a300, 0, 1.3, 0);
    add(Cyl(0.11, 0.11, 0.12, 8), 0x6b4423, 0, 1.55, 0);
  },
  ({ add, i }) => { // 3 folk ornament — colorful geometric diamond
    const d = add(Ico(0.4, 0), [0xff3b2e, 0xfdb913, 0x006a44][i % 3], 0, 0.6, 0); d.scale.set(0.7, 1.4, 0.7);
  },
  ({ add }) => { // 4 church candle — lit
    add(Cyl(0.12, 0.14, 0.9, 8), 0xfff2e0, 0, 0.45, 0);
    add(Sph(0.1, 8), 0xffcf5a, 0, 1.0, 0);
  },
  ({ add }) => { // 5 Lithuanian flag — yellow/green/red
    add(Cyl(0.06, 0.06, 2.2, 6), 0xcccccc, 0, 1.1, 0);
    add(Box(1, 0.3, 0.04), 0xfdb913, 0.55, 1.95, 0);
    add(Box(1, 0.3, 0.04), 0x006a44, 0.55, 1.65, 0);
    add(Box(1, 0.3, 0.04), 0xc1272d, 0.55, 1.35, 0);
  },
  ({ add }) => { // 6 straw ornament (sodas) — pale geometric hanging shape
    const s = add(Ico(0.4, 0), 0xe8d28a, 0, 0.7, 0); s.scale.set(0.8, 1.6, 0.8);
    add(Cyl(0.02, 0.02, 0.4, 4), 0xe8d28a, 0, 1.2, 0);
  },
  ({ add }) => { // 7 basketball hoop
    add(Cyl(0.08, 0.08, 1.8, 6), 0x778, 0, 0.9, 0);
    add(Box(0.7, 0.5, 0.06), 0xffffff, 0, 1.8, 0.1);
    add(Tor(0.22, 0.04, Math.PI * 2), 0xff7a18, 0, 1.6, 0.3).rotation.x = Math.PI / 2;
  },
  ({ add, i }) => { // 8 folk costume on a stand
    add(Cyl(0.06, 0.06, 1.4, 6), 0x6b4423, 0, 0.7, 0);
    add(Cone(0.5, 1.1, 10), [0xc1272d, 0x006a44][i % 2], 0, 0.9, 0);   // skirt
    add(Sph(0.18, 8), 0xe8c07a, 0, 1.6, 0);                            // head
  },
  ({ add }) => { // 9 amber bead string
    for (let k = 0; k < 5; k++) add(Sph(0.13, 8), 0xff9a1e, -0.3 + k * 0.15, 0.5 + Math.sin(k) * 0.1, 0);
  },
];

// ============================================================
//  VINTED — mountains of secondhand fashion
// ============================================================
const FASHION = [0x09b1ba, 0xff5ca8, 0xffd23f, 0x7a5cff, 0xff7a18, 0x2ecc71];
LANDMARKS.vinted = [
  // 1. Giant hangers — oversized clothing hangers holding garments
  ({ add, bad }) => {
    add(Box(16, 0.5, 0.5), grey(bad, 0x556), 0, 18, 0);         // top rod
    for (const x of [-7.5, 7.5]) add(Box(0.5, 18, 0.5), grey(bad, 0x556), x, 9, 0); // posts
    for (let h = 0; h < 4; h++) {
      const x = -6 + h * 4;
      add(Tor(0.5, 0.12, Math.PI), grey(bad, 0xcfd6dd), x, 17.4, 0).rotation.z = Math.PI; // hook
      // triangular hanger bar
      const barL = add(Box(3, 0.2, 0.2), grey(bad, 0xcfd6dd), x, 15.8, 0);
      const l = add(Box(0.2, 2.4, 0.2), grey(bad, 0xcfd6dd), x - 1.4, 16.8, 0); l.rotation.z = 0.5;
      const r = add(Box(0.2, 2.4, 0.2), grey(bad, 0xcfd6dd), x + 1.4, 16.8, 0); r.rotation.z = -0.5;
      // garment hanging
      add(Box(3.4, 5, 0.4), grey(bad, FASHION[h % FASHION.length]), x, 13, 0);
      add(Box(1.2, 2.5, 0.5), grey(bad, FASHION[h % FASHION.length]), x - 2, 14.6, 0).rotation.z = 0.6; // sleeve
      add(Box(1.2, 2.5, 0.5), grey(bad, FASHION[h % FASHION.length]), x + 2, 14.6, 0).rotation.z = -0.6;
    }
  },
  // 2. Shoe rack — massive multi-level shoe display
  ({ add, bad }) => {
    const frame = grey(bad, 0xb6c2cc);
    for (const x of [-5, 5]) add(Box(0.5, 16, 3), frame, x, 8, 0);   // side frames
    for (let s = 0; s < 5; s++) {
      add(Box(10, 0.4, 3), frame, 0, 2 + s * 3, 0);                  // shelf
      for (let p = 0; p < 5; p++) {                                  // shoes per shelf
        const col = FASHION[(s + p) % FASHION.length];
        const shoe = add(Cap(0.5, 1.1), grey(bad, col), -3.8 + p * 1.9, 2.7 + s * 3, 0.4);
        shoe.rotation.z = Math.PI / 2; shoe.scale.set(1, 1, 0.8);
        add(Box(1.2, 0.5, 1.2), grey(bad, col), -3.8 + p * 1.9, 2.4 + s * 3, 0.4); // toe block
      }
    }
  },
  // 3. Clothing pile — a mountain of colorful garments
  ({ add, bad }) => {
    add(Cone(8, 4, 8), grey(bad, 0x3a4a52), 0, 2, 0);          // base heap silhouette
    let seed = 1;
    for (let k = 0; k < 40; k++) {
      seed = (seed * 9301 + 49297) % 233280; const r1 = seed / 233280;
      seed = (seed * 9301 + 49297) % 233280; const r2 = seed / 233280;
      const ang = r1 * Math.PI * 2, rad = (1 - r2) * 7;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const y = 1.5 + (1 - rad / 7) * 12 + r2 * 2;
      const g = add(Box(2 + r1 * 1.5, 1.2, 1.6 + r2), grey(bad, FASHION[k % FASHION.length]), x, y, z);
      g.rotation.set(r1 * 1.5, r2 * 3, r1 * 1.2);
    }
  },
  // 4. Giant stiletto — oversized glossy high-heel pump with a thin spike heel
  ({ add, bad }) => {
    const red = grey(bad, 0xe21b4c), S = 1.7;
    // pump silhouette (toe at +x, heel at -x): underside arches up — only the toe touches down
    const raw = [[6, 0.3], [6.3, 1.6], [2.5, 2.6], [-0.6, 3.6], [-2.4, 4.5], [-3.5, 4.4],
                 [-3.7, 2.3], [-2.8, 2.0], [-0.5, 1.5], [2.2, 0.5]];
    const shape = new THREE.Shape();
    raw.forEach(([x, y], k) => { const X = x * S, Y = y * S; k ? shape.lineTo(X, Y) : shape.moveTo(X, Y); });
    shape.closePath();
    add(new THREE.ExtrudeGeometry(shape, { depth: 3 * S, bevelEnabled: false }), red, 0, 0, -1.5 * S); // upper
    const heel = add(Cone(0.55, 2.3 * S + 0.4, 10), red, -3.45 * S, (2.3 * S) / 2, 0); heel.rotation.x = Math.PI; // thin spike heel
    add(Box(5.5 * S, 0.5, 2.4 * S), grey(bad, 0xf2c9d2), 3.2 * S, 0.25, 0);   // glossy sole under the front
    const hole = add(Cyl(2, 2, 0.5, 16), grey(bad, 0x7a0f2a), -2.0 * S, 3.95 * S, 0); hole.rotation.z = 0.5; hole.scale.set(1.3, 1, 1.2); // foot opening
  },
];

MEDIUM.vinted = [
  // 0 rolling clothing rack — frame on wheels packed with hanging garments
  ({ add, bad }) => {
    const frame = grey(bad, 0x9aa3ac);
    add(Box(6, 0.25, 0.25), frame, 0, 5.2, 0);                 // top rail
    for (const x of [-2.7, 2.7]) add(Cyl(0.12, 0.12, 5.2, 8), frame, x, 2.6, 0);  // uprights
    for (const x of [-2.7, 2.7]) add(Box(1.7, 0.15, 0.15), frame, x, 0.15, 0);    // feet
    for (const x of [-2.7, 2.7]) for (const z of [-0.6, 0.6]) { const w = add(Cyl(0.25, 0.25, 0.15, 10), 0x222, x, 0.15, z); w.rotation.x = Math.PI / 2; }
    const types = ['shirt', 'dress', 'pants', 'shirt', 'dress'];
    for (let k = 0; k < 5; k++) garment(add, -2 + k, 5.0, grey(bad, FASHION[k % FASHION.length]), types[k]);
  },
  // 1 stacked suitcases
  ({ add, bad }) => {
    for (let k = 0; k < 3; k++) add(Box(2.4 - k * 0.4, 1.4, 1.6 - k * 0.2), grey(bad, FASHION[k]), 0, 0.7 + k * 1.5, 0);
    for (let k = 0; k < 3; k++) add(Tor(0.3, 0.06, Math.PI), grey(bad, 0x333), 0, 1.4 + k * 1.5, 0);
  },
  // 2 big shopping bags
  ({ add, bad, i }) => {
    add(Box(2, 2.6, 1.4), grey(bad, FASHION[i % FASHION.length]), 0, 1.5, 0);
    for (const x of [-0.5, 0.5]) add(Tor(0.3, 0.05, Math.PI), grey(bad, 0xfff), x, 2.9, 0).rotation.x = Math.PI / 2;
  },
  // 3 giant hanging price tag
  ({ add, bad, accent }) => {
    add(Cyl(0.1, 0.1, 4, 6), grey(bad, 0x99a), 0, 2, 0);       // post
    const tag = add(Box(2.4, 1.6, 0.2), grey(bad, accent), 0.8, 3.6, 0);
    add(Cyl(0.12, 0.12, 0.2, 8), grey(bad, 0xffffff), -0.2, 4.2, 0).rotation.z = Math.PI / 2; // eyelet
  },
  // 4 fashion sketch easel
  ({ add, bad }) => {
    add(Box(2.6, 3.4, 0.2), grey(bad, 0xfff8ee), 0, 3, 0);     // canvas
    add(Cone(0.6, 1.6, 8), grey(bad, FASHION[3]), 0, 2.8, 0.2);// dress sketch
    for (const x of [-1, 1]) { const l = add(Box(0.12, 4, 0.12), grey(bad, 0x6b4423), x, 2, 0.4); l.rotation.x = -0.2; }
    add(Box(0.12, 4, 0.12), grey(bad, 0x6b4423), 0, 2, -0.4);
  },
  // 5 clothesline rod packed with shirts, pants & dresses
  ({ add, bad }) => {
    add(Cyl(0.1, 0.1, 6.5, 8), grey(bad, 0x9aa3ac), 0, 5, 0).rotation.z = Math.PI / 2;
    for (const x of [-3, 3]) add(Cyl(0.12, 0.12, 5, 8), grey(bad, 0x9aa3ac), x, 2.5, 0);
    const types = ['dress', 'shirt', 'pants', 'shirt', 'dress', 'pants'];
    for (let k = 0; k < 6; k++) garment(add, -2.5 + k, 4.9, grey(bad, FASHION[(k + 2) % FASHION.length]), types[k]);
  },
  // 6 bolts of fabric leaning
  ({ add, bad }) => {
    for (let k = 0; k < 4; k++) { const b = add(Cyl(0.3, 0.3, 4, 10), grey(bad, FASHION[k % FASHION.length]), -1.2 + k * 0.8, 2, 0); b.rotation.z = 0.25; }
  },
];

SMALL.vinted = [
  ({ add, i }) => { // 0 sneaker
    const s = add(Cap(0.3, 0.8), FASHION[i % FASHION.length], 0, 0.3, 0); s.rotation.z = Math.PI / 2; s.scale.set(1, 1, 0.7);
    add(Box(0.9, 0.2, 0.5), 0xffffff, 0.1, 0.12, 0);           // sole
  },
  ({ add }) => { // 1 shirt button
    const b = add(Cyl(0.35, 0.35, 0.1, 16), 0xf0f0f0, 0, 0.3, 0); b.rotation.x = Math.PI / 2;
    for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) add(Sph(0.04, 6), 0x888, x, 0.31, z);
  },
  ({ add, i }) => { // 2 price tag
    const tag = add(Box(0.7, 0.5, 0.08), FASHION[i % FASHION.length], 0, 0.6, 0);
    add(Cyl(0.04, 0.04, 0.3, 6), 0xffffff, -0.3, 0.9, 0);
  },
  ({ add, i }) => { // 3 folded shirt stack
    for (let k = 0; k < 3; k++) add(Box(0.9, 0.18, 0.7), FASHION[(i + k) % FASHION.length], 0, 0.2 + k * 0.2, 0);
  },
  ({ add, i }) => { // 4 dress on a hanger
    add(Tor(0.18, 0.04, Math.PI), 0xcfd6dd, 0, 1.3, 0).rotation.z = Math.PI;
    add(Box(0.7, 0.06, 0.06), 0xcfd6dd, 0, 1.0, 0);
    add(Cone(0.45, 1.1, 10), FASHION[i % FASHION.length], 0, 0.55, 0);
  },
  ({ add, i }) => { // 5 handbag
    add(Box(0.7, 0.5, 0.3), FASHION[i % FASHION.length], 0, 0.5, 0);
    add(Tor(0.2, 0.04, Math.PI), 0x333, 0, 0.85, 0).rotation.x = Math.PI / 2;
  },
  ({ g }) => { // 6 high-heel shoe — built to the Shape Building Guide spec
    const shoe = buildHighHeelShoe();
    const box = new THREE.Box3().setFromObject(shoe);
    shoe.position.y -= box.min.y; // rest its lowest point on the ground
    g.add(shoe);
  },
  ({ add, i }) => { // 7 hat
    add(Cyl(0.4, 0.4, 0.06, 14), FASHION[i % FASHION.length], 0, 0.25, 0);  // brim
    add(Cyl(0.24, 0.26, 0.4, 14), FASHION[i % FASHION.length], 0, 0.45, 0); // crown
  },
  ({ add }) => { // 8 pair of folded socks
    for (const x of [-0.2, 0.2]) add(Box(0.3, 0.4, 0.3), 0xfff, x, 0.4, 0);
    for (const x of [-0.2, 0.2]) add(Box(0.3, 0.1, 0.3), 0xff5ca8, x, 0.62, 0);
  },
  ({ add }) => { // 9 sunglasses
    for (const x of [-0.25, 0.25]) add(Cyl(0.18, 0.18, 0.05, 12), 0x222, x, 0.5, 0).rotation.x = Math.PI / 2;
    add(Box(0.2, 0.05, 0.05), 0x222, 0, 0.5, 0);
  },
];

// ============================================================
//  Bad-mode litter — replaces small details when the world sours.
// ============================================================
function smallLitter(m, i) {
  const g = new THREE.Group();
  const add = (geo, c, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m(c)); o.position.set(x, y, z); g.add(o); return o; };
  const kind = i % 3;
  if (kind === 0) add(Cyl(0.4, 0.5, 1.2, 8), 0x4a4a44, 0, 0.6, 0);
  else if (kind === 1) add(new THREE.DodecahedronGeometry(0.7), 0x55504a, 0, 0.5, 0);
  else add(Box(1.6, 1.6, 0.2), 0x6a6a60, 0, 0.9, 0);
  g.scale.setScalar(1.4);
  return g;
}
