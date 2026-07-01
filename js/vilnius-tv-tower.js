/**
 * vilnius-tv-tower.js — procedural Vilnius TV Tower for Three.js
 * --------------------------------------------------------------
 * Returns a THREE.Group you can drop straight into your own scene.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { createVilniusTVTower } from './vilnius-tv-tower.js';
 *
 *   const tower = createVilniusTVTower(THREE, { size: 1, seed: 1 });
 *   tower.position.set(x, groundY, z);   // y = 0 is the base of the tower
 *   scene.add(tower);
 *
 * Notes:
 *  - Built at ~31 units tall (it's a 326 m tower). Use `size` to fit your scene —
 *    e.g. size: 0.2 to sit near the ~6-unit Gediminas Tower.
 *  - Uses MeshStandardMaterial — your scene needs lights.
 *  - THREE is passed in so it works with any version / loader.
 *  - group.userData.{ shaft, saucer, mast } for sub-group access.
 *  - Not using ES modules? Delete the `export` keyword and call directly.
 *
 * Structure (bottom → top, world units):
 *   0.0 – 1.2   round base building (drum, dark window strips, red top ring)
 *   1.2 – 16.0  tapering concrete shaft
 *  15.0 – 18.75 flying-saucer deck: underside cone, disc, banded restaurant tiers
 *  18.75– 19.85 grey transition cylinder
 *  19.85– 27.8  antenna mast (red/white bands, ring antennas, rods)
 *  27.8 – 30.4  spire + needle (red tip)
 */

export function createVilniusTVTower(THREE, options = {}) {
  const { size = 1, seed = 1 } = options;
  const rng = mulberry32(seed);
  const group = new THREE.Group();

  // ── materials ─────────────────────────────────────────────────────────────
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.82, metalness: 0.02 });
  const lightGrey = new THREE.MeshStandardMaterial({ color: 0xcaccc9, roughness: 0.6, metalness: 0.1 });
  const red      = new THREE.MeshStandardMaterial({ color: 0xbe3626, roughness: 0.55, metalness: 0.05 });
  const white    = new THREE.MeshStandardMaterial({ color: 0xeae8e2, roughness: 0.55, metalness: 0.05 });
  const green    = new THREE.MeshStandardMaterial({ color: 0x6f8f5e, roughness: 0.6, metalness: 0.0 });
  const darkWin  = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.1 });
  const metal    = new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.45, metalness: 0.35 });

  // ── helpers ─────────────────────────────────────────────────────────────
  // vertical (co)cylinder; `y0` = bottom, returns the mesh
  function cyl(rTop, rBot, h, y0, mat, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg || 24), mat);
    m.position.y = y0 + h / 2;
    group.add(m);
    return m;
  }
  // horizontal ring
  function ring(r, tube, y, mat, seg) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg || 32), mat);
    m.position.y = y;
    m.rotation.x = Math.PI / 2;
    group.add(m);
    return m;
  }
  // alternating banded tube from y0..y1 with radius = rFn(t)
  function bandedTube(y0, y1, rFn, bands, matA, matB) {
    const h = (y1 - y0) / bands;
    for (let i = 0; i < bands; i++) {
      const rB = rFn(i / bands), rT = rFn((i + 1) / bands);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h * 1.02, 16), (i % 2) ? matA : matB);
      m.position.y = y0 + i * h + h / 2;
      group.add(m);
    }
  }
  // crossed horizontal antenna rods at several heights
  function rods(y0, y1, count, reach, rad, mat) {
    for (let i = 0; i < count; i++) {
      const y = y0 + (y1 - y0) * (i / Math.max(1, count - 1));
      for (let a = 0; a < 2; a++) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, reach * 2, 6), mat);
        rod.rotation.z = Math.PI / 2;
        rod.rotation.y = a * Math.PI / 2;
        rod.position.y = y;
        group.add(rod);
      }
    }
  }

  // ── 1. base building (drum) ─────────────────────────────────────────────
  const baseR = 2.6, baseH = 1.2;
  cyl(baseR, baseR + 0.06, baseH, 0, concrete, 40);
  // dark vertical window strips around the drum
  const winN = 34;
  for (let i = 0; i < winN; i++) {
    const a = (i / winN) * Math.PI * 2;
    if (i % 2 === 0) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.18, baseH * 0.78, 0.1), darkWin);
      w.position.set(Math.cos(a) * (baseR + 0.02), baseH * 0.5, Math.sin(a) * (baseR + 0.02));
      w.rotation.y = -a;
      group.add(w);
    }
  }
  ring(baseR + 0.08, 0.06, baseH, red, 48);          // red top rim
  cyl(1.6, baseR + 0.06, 0.14, baseH, concrete, 40); // sloped cap onto the shaft base

  // ── 2. tapering shaft ─────────────────────────────────────────────────────
  const shaftY0 = 1.34, shaftY1 = 16.0;
  const shaftRBot = 1.05, shaftRTop = 0.42;
  const shaftRAt = (y) => {
    const t = (y - shaftY0) / (shaftY1 - shaftY0);
    return shaftRBot + (shaftRTop - shaftRBot) * Math.pow(t, 0.86); // gentle concave taper
  };
  // build the shaft as stacked short segments to approximate the concave curve
  const shaftSegs = 14;
  for (let i = 0; i < shaftSegs; i++) {
    const ya = shaftY0 + (shaftY1 - shaftY0) * (i / shaftSegs);
    const yb = shaftY0 + (shaftY1 - shaftY0) * ((i + 1) / shaftSegs);
    cyl(shaftRAt(yb), shaftRAt(ya), yb - ya, ya, concrete, 28);
  }
  // two vertical rows of little windows (front +Z and back −Z)
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? 1 : -1;
    for (let i = 0; i < 9; i++) {
      const y = 3.0 + i * 1.4;
      const r = shaftRAt(y);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), darkWin);
      w.position.set(0, y, sign * (r + 0.02));
      group.add(w);
    }
  }
  group.userData.shaft = { y0: shaftY0, y1: shaftY1, rBot: shaftRBot, rTop: shaftRTop };

  // ── 3. flying-saucer observation / restaurant deck ────────────────────────
  const saucer = new THREE.Group();
  // support collar (thin vertical struts under the saucer)
  const collarN = 20;
  for (let i = 0; i < collarN; i++) {
    const a = (i / collarN) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 0.03), metal);
    strut.position.set(Math.cos(a) * 0.6, 15.5, Math.sin(a) * 0.6);
    group.add(strut);
  }
  cyl(2.2, 0.55, 0.7, 15.9, concrete, 40);           // underside cone (widens upward)
  ring(2.2, 0.08, 16.55, red, 48);                    // red underside rim
  cyl(2.4, 2.2, 0.3, 16.6, concrete, 48);             // main saucer disc
  ring(2.42, 0.07, 16.72, red, 48);                   // saucer edge rim
  // dark window/railing band around the rim
  cyl(2.3, 2.3, 0.14, 16.9, darkWin, 48);

  // banded restaurant tiers (green / white with red rings)
  cyl(2.0, 2.3, 0.55, 17.04, green, 40);
  ring(2.05, 0.05, 17.55, red, 44);
  cyl(1.6, 2.0, 0.5, 17.59, white, 36);
  ring(1.65, 0.05, 18.05, red, 40);
  cyl(1.15, 1.6, 0.45, 18.09, green, 32);
  ring(1.2, 0.045, 18.5, red, 36);
  cyl(0.6, 1.15, 0.35, 18.54, concrete, 28);          // top cap of the deck
  group.userData.saucer = saucer;

  // ── 4. grey transition cylinder ───────────────────────────────────────────
  cyl(0.5, 0.62, 1.1, 18.75, lightGrey, 20);

  // ── 5. antenna mast ─────────────────────────────────────────────────────
  const mast = new THREE.Group();
  // lower red/white banded section + ring antennas + rods
  bandedTube(19.85, 22.8, (t) => 0.42 + (0.30 - 0.42) * t, 12, red, white);
  for (let i = 0; i < 4; i++) ring(0.42 - i * 0.03, 0.05, 20.2 + i * 0.7, metal, 20);
  rods(20.1, 22.6, 5, 0.55, 0.02, metal);

  // middle white section with stacked ring antennas (helical look)
  cyl(0.24, 0.30, 2.7, 22.8, white, 18);
  for (let i = 0; i < 10; i++) ring(0.30 - i * 0.006, 0.028, 22.95 + i * 0.25, metal, 18);

  // upper red/white banded thin mast
  bandedTube(25.5, 27.8, (t) => 0.18 + (0.10 - 0.18) * t, 9, red, white);
  rods(25.7, 27.6, 4, 0.22, 0.014, metal);
  group.userData.mast = mast;

  // ── 6. spire + needle ─────────────────────────────────────────────────────
  cyl(0.055, 0.10, 1.0, 27.8, lightGrey, 12);
  cyl(0.012, 0.055, 1.6, 28.8, lightGrey, 10);        // thin needle
  // red band accents on the needle
  ring(0.05, 0.02, 29.0, red, 12);
  ring(0.03, 0.015, 29.7, red, 12);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), red);
  tip.position.y = 30.45;
  group.add(tip);

  group.scale.setScalar(size);
  return group;
}

// deterministic PRNG (kept for parity with the other asset modules)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
