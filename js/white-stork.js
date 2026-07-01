/**
 * white-stork.js — procedural White Stork (Ciconia ciconia) for Three.js
 * -----------------------------------------------------------------------
 * Standing pose. Stork faces –Z (camera at +Z sees the front).
 * Returns a THREE.Group: body, neck, head, beak, eyes, folded wings
 * (white covert blobs + black primary feathers), tail, legs, feet/claws.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { createWhiteStork } from './white-stork.js';
 *
 *   const stork = createWhiteStork(THREE, { size: 1, seed: 2 });
 *   stork.position.set(x, groundY, z);   // y = 0 is the bottom of the feet
 *   scene.add(stork);
 *
 * Options:
 *   size  (1) – uniform scale of the whole group
 *   seed  (1) – seeded RNG so the same seed always yields the same feathers
 *
 * Needs MeshStandardMaterial lighting in your scene.
 * Not using ES modules? Delete the `export` keyword and call directly.
 *
 * Approximate proportions at size=1:
 *   Foot–ankle  y = 0.00–0.14    Long pink legs
 *   Ankle–hip   y = 0.14–1.86    Pink tarsus + tarsometatarsus
 *   Body centre y ≈ 2.20         White oval torso
 *   Neck base   y ≈ 2.62         S-curved white tube
 *   Head centre y ≈ 3.82         White sphere, red eye ring
 *   Beak tip    y ≈ 3.65, z ≈ –0.92   Long orange bill
 *   Total height ≈ 4.05
 */

export function createWhiteStork(THREE, options = {}) {
  const { seed = 1, size = 1 } = options;
  const rng  = mulberry32(seed);
  const group = new THREE.Group();

  // ── materials ─────────────────────────────────────────────────────────────
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.68, metalness: 0.0 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x131318, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide });
  const pinkMat  = new THREE.MeshStandardMaterial({ color: 0xc83c3c, roughness: 0.65, metalness: 0.0 });
  const beakMat  = new THREE.MeshStandardMaterial({ color: 0xd44518, roughness: 0.50, metalness: 0.06 });
  const eyeMat   = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.25, metalness: 0.25 });
  const eyeRMat  = new THREE.MeshStandardMaterial({ color: 0xb53025, roughness: 0.58, metalness: 0.0 });

  // ── helpers ───────────────────────────────────────────────────────────────
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  /** Tube mesh from an array of [x,y,z] triplets. */
  function mkTube(pts, radius, mat, tSeg, rSeg) {
    tSeg = tSeg === undefined ? 18 : tSeg;
    rSeg = rSeg === undefined ? 8  : rSeg;
    var curve = new THREE.CatmullRomCurve3(pts.map(function(p) { return v3(p[0], p[1], p[2]); }));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, tSeg, radius, rSeg, false), mat);
  }

  var UP = v3(0, 1, 0);

  /** Rotate mesh so local +Y aligns with world direction (dx,dy,dz). */
  function pointAlong(mesh, dx, dy, dz) {
    mesh.quaternion.setFromUnitVectors(UP, v3(dx, dy, dz).normalize());
  }

  /** Pointed-ellipse feather geometry: base at local y=0, tip at y=len. */
  function featherGeo(len, wid) {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(-wid * 0.52, len * 0.42, 0, len);
    s.quadraticCurveTo( wid * 0.52, len * 0.42, 0, 0);
    return new THREE.ShapeGeometry(s, 8);
  }

  /** Place a single feather into `parent`. */
  function addFeather(parent, mat, len, wid, px, py, pz, dx, dy, dz) {
    var m = new THREE.Mesh(featherGeo(len, wid), mat);
    m.position.set(px, py, pz);
    pointAlong(m, dx, dy, dz);
    parent.add(m);
    return m;
  }

  // ── body ──────────────────────────────────────────────────────────────────
  var body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), whiteMat);
  body.scale.set(1.0, 1.10, 0.86);
  body.position.set(0, 2.20, 0.0);
  group.add(body);
  group.userData.body = body;

  // ── neck (S-curve from body front-top up to head) ─────────────────────────
  var neck = mkTube([
    [0, 2.62,  0.12],
    [0, 2.90,  0.20],
    [0, 3.15,  0.14],
    [0, 3.42,  0.00],
    [0, 3.64, -0.14],
  ], 0.125, whiteMat);
  group.add(neck);
  group.userData.neck = neck;

  // ── head ──────────────────────────────────────────────────────────────────
  var HX = 0, HY = 3.82, HZ = -0.19;
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), whiteMat);
  head.scale.set(0.96, 1.02, 0.93);
  head.position.set(HX, HY, HZ);
  group.add(head);
  group.userData.head = head;

  // Red bare-skin eye rings (both sides)
  var eyeXs = [-0.135, 0.135];
  for (var ei = 0; ei < eyeXs.length; ei++) {
    var ex = eyeXs[ei];
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.015, 8, 16), eyeRMat);
    ring.position.set(HX + ex, HY + 0.02, HZ - 0.130);
    ring.rotation.y = ex < 0 ? 0.28 : -0.28;
    group.add(ring);

    var eyeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), eyeMat);
    eyeSphere.position.set(HX + ex, HY + 0.02, HZ - 0.162);
    group.add(eyeSphere);
  }

  // ── beak ──────────────────────────────────────────────────────────────────
  var beak = mkTube([
    [HX, HY + 0.010, HZ - 0.20],
    [HX, HY - 0.048, HZ - 0.54],
    [HX, HY - 0.110, HZ - 0.86],
  ], 0.048, beakMat, 12, 8);
  group.add(beak);

  // Taper at the very tip
  var beakTip = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.10, 8), beakMat);
  beakTip.position.set(HX, HY - 0.135, HZ - 0.91);
  pointAlong(beakTip, 0, -0.12, -0.99);
  group.add(beakTip);
  group.userData.beak = beak;

  // ── wings ─────────────────────────────────────────────────────────────────
  // Each wing: white covert blob (upper) + 9 black primary feathers (hanging)
  //            + 5 white inner secondary feathers
  // sx = –1: left wing (–X), sx = +1: right wing (+X)
  var wingsGroup = new THREE.Group();

  for (var wi = 0; wi < 2; wi++) {
    var sx = wi === 0 ? -1 : 1;
    var wx = sx * 0.56;   // wing attachment x

    // White covert/scapular mass
    var cov = new THREE.Mesh(new THREE.SphereGeometry(0.40, 16, 12), whiteMat);
    cov.scale.set(0.50, 0.38, 0.20);
    cov.position.set(wx, 2.36, 0.08);
    wingsGroup.add(cov);

    // Black primary feathers (hang downward-backward from wing attachment)
    var NP = 9;
    for (var pi = 0; pi < NP; pi++) {
      var t   = pi / (NP - 1);
      var plen  = 0.58 + t * 0.35 + (rng() - 0.5) * 0.06;
      var pwid  = 0.088 + t * 0.04;
      var plean = 0.20  + t * 0.22 + (rng() - 0.5) * 0.04;
      var pfanX = wx + sx * t * 0.20 + (rng() - 0.5) * 0.02;
      var ppy   = 2.18 - t * 0.10   + (rng() - 0.5) * 0.04;
      var ppz   = 0.12 + t * 0.06;
      addFeather(wingsGroup, darkMat, plen, pwid, pfanX, ppy, ppz, sx * 0.04, -1, plean);
    }

    // White inner secondary feathers (partially cover top of primaries)
    var NS = 5;
    for (var si2 = 0; si2 < NS; si2++) {
      var ts = si2 / (NS - 1);
      addFeather(wingsGroup, whiteMat,
        0.30 + ts * 0.14, 0.10,
        wx + sx * ts * 0.08, 2.28 - ts * 0.06, 0.06 + ts * 0.04,
        sx * 0.02, -1, 0.10 + ts * 0.10
      );
    }
  }
  group.add(wingsGroup);
  group.userData.wings = wingsGroup;

  // ── tail feathers ─────────────────────────────────────────────────────────
  for (var ti = 0; ti < 7; ti++) {
    var tt = (ti - 3) / 3;    // –1 … +1
    var tlen = 0.38 + (1 - tt * tt) * 0.10;
    addFeather(group, whiteMat, tlen, 0.09,
      tt * 0.24, 1.95, 0.54,
      tt * 0.12, -0.38, 0.92
    );
  }

  // ── legs ──────────────────────────────────────────────────────────────────
  var legsGroup = new THREE.Group();

  function addLeg(sx2) {
    var lx = sx2 * 0.19;

    // Upper leg: hip → knee
    legsGroup.add(mkTube([
      [lx * 0.90, 1.84,  0.00],
      [lx * 1.08, 1.42,  0.04],
      [lx * 1.05, 0.97,  0.06],
    ], 0.056, pinkMat, 10, 8));

    // Lower leg: knee → ankle
    legsGroup.add(mkTube([
      [lx * 1.05, 0.97,  0.06],
      [lx * 1.00, 0.56,  0.04],
      [lx * 0.92, 0.14,  0.01],
    ], 0.044, pinkMat, 10, 8));

    // Ankle joint sphere
    var ankle = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), pinkMat);
    ankle.position.set(lx * 0.92, 0.14, 0.01);
    legsGroup.add(ankle);

    // Foot toes from foot base
    var fx = lx * 0.92, fy = 0.06, fz = 0.01;
    var toeData = [
      { d: [-0.30, -0.08, -0.40], L: 0.24 },   // forward-left
      { d: [ 0.00, -0.06, -0.42], L: 0.26 },   // forward-centre
      { d: [ 0.30, -0.08, -0.38], L: 0.22 },   // forward-right
      { d: [ 0.00, -0.04,  0.28], L: 0.17 },   // back
    ];

    for (var tdi = 0; tdi < toeData.length; tdi++) {
      var td = toeData[tdi];
      var dir = v3(td.d[0], td.d[1], td.d[2]).normalize();
      var half = dir.clone().multiplyScalar(td.L * 0.5);

      // Toe cylinder
      var toeGeo = new THREE.CylinderGeometry(0.012, 0.028, td.L, 6);
      var toe = new THREE.Mesh(toeGeo, pinkMat);
      toe.position.set(fx + half.x, fy + half.y, fz + half.z);
      toe.quaternion.setFromUnitVectors(UP, dir);
      legsGroup.add(toe);

      // Claw cone at toe tip
      var clawGeo = new THREE.ConeGeometry(0.012, 0.055, 6);
      var claw = new THREE.Mesh(clawGeo, pinkMat);
      var clOff = dir.clone().multiplyScalar(td.L + 0.027);
      claw.position.set(fx + clOff.x, fy + clOff.y, fz + clOff.z);
      claw.quaternion.setFromUnitVectors(UP, dir);
      legsGroup.add(claw);
    }
  }

  addLeg(-1);   // left leg
  addLeg(1);    // right leg
  group.add(legsGroup);
  group.userData.legs = legsGroup;

  group.scale.setScalar(size);
  return group;
}

// Deterministic PRNG — same seed → same feather layout every time
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
