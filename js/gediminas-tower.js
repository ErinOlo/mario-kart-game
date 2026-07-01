/**
 * gediminas-tower.js — procedural Gediminas Tower for Three.js
 * -------------------------------------------------------------
 * Returns a THREE.Group you can drop straight into your own scene.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { createGediminasTower } from './gediminas-tower.js';
 *
 *   const tower = createGediminasTower(THREE, { size: 1, seed: 3 });
 *   tower.position.set(x, groundY, z);   // y=0 is the base of the plinth
 *   scene.add(tower);
 *
 * Notes:
 *  - Uses MeshStandardMaterial throughout — your scene needs lights.
 *  - THREE is passed in so it works with any version / loader.
 *  - Same seed → same brick pattern every time.
 *  - group.userData.stories / .flag / .pole for sub-group access.
 *  - Not using ES modules? Delete the `export` keyword and call directly.
 *
 * Structure (bottom → top, world units):
 *  y=0.00 : base of stone plinth
 *  y=0.20 : story 1 starts (entrance door on face 0)
 *  y=2.08 : belt course 1
 *  y=2.25 : story 2 starts
 *  y=3.97 : belt course 2
 *  y=4.14 : story 3 starts
 *  y=5.74 : belt course 3
 *  y=5.91 : parapet + merlons
 *  y=6.36 : roof cap, flagpole base
 */

export function createGediminasTower(THREE, options = {}) {
  const {
    seed     = 1,
    size     = 1,
    showFlag = true,   // Lithuanian tricolour on top
  } = options;

  const rng   = mulberry32(seed);
  const SIDES = 8;   // octagonal cross-section
  const group = new THREE.Group();

  // ── materials ────────────────────────────────────────────────────────────
  const brickMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.0,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xc2a882, roughness: 0.82, metalness: 0.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0c0705, roughness: 0.90, metalness: 0.0, side: THREE.DoubleSide,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1e2419, roughness: 0.72, metalness: 0.08,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x9a6520, roughness: 0.78, metalness: 0.0,
  });

  // ── brick vertex colour ──────────────────────────────────────────────────
  const B_BASE  = new THREE.Color(0xb35526);
  const B_DARK  = new THREE.Color(0x783412);
  const B_LIGHT = new THREE.Color(0xcc6e3c);
  const bv      = new THREE.Color();
  const COURSE  = 0.11;   // world-unit height of one brick course

  /**
   * Paint brick-course vertex colours on a CylinderGeometry or BoxGeometry.
   * geoH = the full height of the geometry (used to offset centered vertices).
   */
  function applyBrickColors(geo, geoH) {
    const pos  = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const localY = pos.getY(i) + geoH * 0.5;   // centre → 0..geoH
      const frac   = (localY % COURSE) / COURSE;
      const joint  = frac < 0.10 || frac > 0.90;
      bv.copy(B_BASE);
      if (joint) bv.lerp(B_DARK,  0.42 + rng() * 0.28);
      else        bv.lerp(B_LIGHT, rng() * 0.40);
      bv.offsetHSL((rng() - 0.5) * 0.014, (rng() - 0.5) * 0.055, (rng() - 0.5) * 0.06);
      cols[i * 3] = bv.r; cols[i * 3 + 1] = bv.g; cols[i * 3 + 2] = bv.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // ── geometry helpers ─────────────────────────────────────────────────────
  /** Distance from centre to face-midpoint of a regular polygon. */
  const apo = (r) => r * Math.cos(Math.PI / SIDES);

  /** World-space angle of face k's outward normal. */
  const faceAngle = (k) => (k + 0.5) * (Math.PI * 2 / SIDES);

  /** Build, paint and place a brick octagonal cylinder. */
  function brickCylinder(r, h, y0, vSegs = 22) {
    const geo = applyBrickColors(new THREE.CylinderGeometry(r, r, h, SIDES, vSegs), h);
    const m   = new THREE.Mesh(geo, brickMat);
    m.position.y = y0 + h * 0.5;
    group.add(m);
    return m;
  }

  /** Build a stone belt / ledge ring. */
  function addBelt(r, y, bH = 0.17, ext = 0.11) {
    const geo = new THREE.CylinderGeometry(r + ext, r + ext, bH, SIDES);
    const m   = new THREE.Mesh(geo, stoneMat);
    m.position.y = y + bH * 0.5;
    group.add(m);
  }

  /** Arch-shaped THREE.Shape (bottom at y=0, top at y=h). */
  function archShape(w, h) {
    const hw = w * 0.5;
    const s  = new THREE.Shape();
    s.moveTo(-hw, 0);
    s.lineTo(-hw, h - hw);            // straight sides
    s.absarc(0, h - hw, hw, Math.PI, 0, false);  // semicircle top
    s.lineTo(hw, 0);
    s.closePath();
    return s;
  }

  /**
   * Place a flat dark arch opening on face k of a cylinder with outer radius r.
   * bottomY = world y of the bottom edge of the opening.
   */
  function addOpening(r, k, bottomY, w, h) {
    const a   = faceAngle(k);
    const geo = new THREE.ShapeGeometry(archShape(w, h), 12);
    const m   = new THREE.Mesh(geo, darkMat);
    m.position.set(
      Math.cos(a) * (apo(r) + 0.028),
      bottomY,
      Math.sin(a) * (apo(r) + 0.028)
    );
    m.rotation.y = -a;
    group.add(m);
  }

  // ── plinth (stone base) ──────────────────────────────────────────────────
  const PH = 0.20;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(2.34, 2.44, PH, SIDES),
    stoneMat
  );
  plinth.position.y = PH * 0.5;
  group.add(plinth);

  // ── story 1 ──────────────────────────────────────────────────────────────
  const BH   = 0.17;   // belt height
  const S1r  = 2.20, S1h = 1.88, S1y = PH;
  brickCylinder(S1r, S1h, S1y);
  addBelt(S1r, S1y + S1h);
  // windows — skip face 0 (entrance)
  for (let k = 1; k < SIDES; k++) addOpening(S1r, k, S1y + (S1h - 0.72) * 0.55, 0.44, 0.72);
  // entrance arch (face 0, taller, starts near plinth top)
  addOpening(S1r, 0, S1y + 0.03, 0.54, 0.94);

  // ── story 2 ──────────────────────────────────────────────────────────────
  const S2r = 2.10, S2h = 1.72, S2y = S1y + S1h + BH;
  brickCylinder(S2r, S2h, S2y);
  addBelt(S2r, S2y + S2h);
  for (let k = 0; k < SIDES; k++) addOpening(S2r, k, S2y + (S2h - 0.68) * 0.50, 0.41, 0.68);

  // ── story 3 ──────────────────────────────────────────────────────────────
  const S3r = 2.00, S3h = 1.60, S3y = S2y + S2h + BH;
  brickCylinder(S3r, S3h, S3y);
  addBelt(S3r, S3y + S3h);
  for (let k = 0; k < SIDES; k++) addOpening(S3r, k, S3y + (S3h - 0.62) * 0.50, 0.38, 0.62);

  // ── parapet ──────────────────────────────────────────────────────────────
  const PRy = S3y + S3h + BH;
  const PRr = 2.02, PRh = 0.44;
  brickCylinder(PRr, PRh, PRy, 6);

  // merlons — one per octagon face, raised above parapet top
  const TOP_Y = PRy + PRh;
  const MH = 0.30, MW = 0.30, MD = 0.22;
  for (let k = 0; k < SIDES; k++) {
    const a   = faceAngle(k);
    const geo = applyBrickColors(new THREE.BoxGeometry(MW, MH, MD), MH);
    const m   = new THREE.Mesh(geo, brickMat);
    m.position.set(
      Math.cos(a) * (apo(PRr) + MD * 0.38),
      TOP_Y + MH * 0.5,
      Math.sin(a) * (apo(PRr) + MD * 0.38)
    );
    m.rotation.y = -a;
    group.add(m);
  }

  // ── dark roof cap ─────────────────────────────────────────────────────────
  const roofCap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.94, PRr + 0.06, 0.14, SIDES),
    roofMat
  );
  roofCap.position.y = TOP_Y + 0.07;
  group.add(roofCap);

  // slight roof slope suggestion (thin cone on top)
  const roofCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 1.94, 0.18, SIDES),
    roofMat
  );
  roofCone.position.y = TOP_Y + 0.14 + 0.09;
  group.add(roofCone);

  // ── flagpole ──────────────────────────────────────────────────────────────
  if (showFlag) {
    const POLE_H  = 1.85;
    const POLE_BY = TOP_Y + 0.18;   // base of pole above roof

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.055, POLE_H, 8),
      poleMat
    );
    pole.position.set(0, POLE_BY + POLE_H * 0.5, 0);
    group.add(pole);
    group.userData.pole = pole;

    // ball finial
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), poleMat);
    ball.position.set(0, POLE_BY + POLE_H + 0.07, 0);
    group.add(ball);

    // Lithuanian tricolour: yellow (top) / green (middle) / red (bottom)
    const FW = 0.90, FH = 0.52;
    const stripeH    = FH / 3;
    const poleTopY   = POLE_BY + POLE_H;
    const flagColors = [0xf7b016, 0x1a7f30, 0xbe2e14];

    const flagGroup = new THREE.Group();
    for (let si = 0; si < 3; si++) {
      const cy  = poleTopY - stripeH * (si + 0.5);
      const geo = new THREE.PlaneGeometry(FW, stripeH);
      const m   = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: flagColors[si], roughness: 0.60, metalness: 0.0, side: THREE.DoubleSide,
      }));
      m.position.set(FW * 0.5, cy, 0);
      flagGroup.add(m);
    }
    // slight wave — tilt the flag group a touch
    flagGroup.rotation.y = -0.18;
    group.add(flagGroup);
    group.userData.flag = flagGroup;
  }

  group.userData.stories = { S1: { r: S1r, h: S1h, y: S1y }, S2: { r: S2r, h: S2h, y: S2y }, S3: { r: S3r, h: S3h, y: S3y } };

  group.scale.setScalar(size);
  return group;
}

// deterministic PRNG — same seed → same brick pattern
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
