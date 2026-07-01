/**
 * strawberry.js — procedural Strawberry for Three.js
 * --------------------------------------------------
 * Returns a THREE.Group you can drop straight into your own scene.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { createStrawberry } from './strawberry.js';
 *
 *   const berry = createStrawberry(THREE, { size: 1, seed: 3 });
 *   berry.position.set(x, groundY, z);   // group origin (y=0) is the bottom tip
 *   scene.add(berry);
 *
 * Notes:
 *  - Uses MeshStandardMaterial, so your scene needs lights.
 *  - THREE is passed in, so it works with any version / loader (npm, CDN global, import map).
 *  - Same `seed` -> identical berry. Change it for variety.
 *  - Seeds + calyx are batched into InstancedMeshes, so it's cheap to render.
 *  - Spin the whole thing: berry.rotation.y += 0.02;  (origin is the tip, so it spins upright)
 *  - Want it glossier? Swap the body material for MeshPhysicalMaterial with clearcoat:1.
 *  - Not using ES modules? Delete the `export` keyword and call the function directly.
 */

export function createStrawberry(THREE, options = {}) {
  const {
    seed = 1,
    seedCount = 150,   // achenes (the little yellow pips)
    sepals = 8,        // outer green leaves of the calyx
    size = 1,          // uniform scale of the whole group
    calyx = true,      // green leafy top
    stem = true,       // short stem sticking up
  } = options;

  const rng = mulberry32(seed);
  const HS = 1.1;                 // height scale -> total height ≈ 2*HS
  const TOP_Y = 2 * HS;           // y of the very top (tip is at y = 0)

  const group = new THREE.Group();

  // ---- body silhouette: horizontal radius as a function of height t (0 tip .. 1 top) ----
  function profile(t) {
    t = Math.min(Math.max(t, 0), 1);
    const rise = Math.min(1, Math.pow(t / 0.45, 0.85));      // taper to a point at the bottom
    const topcut = 1 - 0.30 * smooth01((t - 0.72) / 0.28);   // narrow the shoulders
    const belly = 1 - 0.10 * Math.pow((t - 0.62) / 0.4, 2);  // widest around t≈0.62
    const roundTop = 1 - 0.55 * smooth01((t - 0.88) / 0.12); // dome the very top
    return rise * topcut * belly * roundTop;
  }

  // ---- fleshy body: a sphere remapped to the strawberry profile ----
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(0x8f1216);
  const cMid = new THREE.Color(0xd11f1f);
  const cTop = new THREE.Color(0xe53a26);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y * 0.5 + 0.5;
    const hyp = Math.hypot(x, z);
    const dx = hyp > 1e-5 ? x / hyp : 0;
    const dz = hyp > 1e-5 ? z / hyp : 0;
    const rH = profile(t);
    pos.setXYZ(i, dx * rH, 2 * t * HS, dz * rH);

    if (t < 0.5) c.copy(cLow).lerp(cMid, t / 0.5);
    else c.copy(cMid).lerp(cTop, (t - 0.5) / 0.5);
    c.offsetHSL(0, (rng() - 0.5) * 0.02, (rng() - 0.5) * 0.03);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const body = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.0 })
  );
  group.add(body);
  group.userData.body = body;

  // ---- seeds (achenes), sunk into the surface, oriented up-slope ----
  const seedGeo = new THREE.SphereGeometry(0.5, 6, 5);
  const seeds = new THREE.InstancedMesh(
    seedGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }),
    seedCount
  );

  const golden = Math.PI * (3 - Math.sqrt(5));
  const seedPal = [0xd9c24a, 0xc7b038, 0xe4d576, 0xbfae3c, 0xd8b24a];
  const lX = new THREE.Vector3(), lY = new THREE.Vector3(), lZ = new THREE.Vector3();
  const nrm = new THREE.Vector3(), tan = new THREE.Vector3(), p3 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const rot = new THREE.Matrix4(), scl = new THREE.Matrix4(), trs = new THREE.Matrix4(), M = new THREE.Matrix4();
  const sc = new THREE.Color();
  const eps = 0.001;

  for (let i = 0; i < seedCount; i++) {
    const f = (i + 0.5) / seedCount;
    const t = 0.06 + f * 0.80;                 // seed band: near tip up to below the shoulders
    const theta = i * golden + (rng() - 0.5) * 0.15;
    const cs = Math.cos(theta), sn = Math.sin(theta);

    const rH = profile(t);
    const y = 2 * t * HS;
    p3.set(rH * cs, y, rH * sn);

    // surface-of-revolution derivatives -> tangent (up-slope) and outward normal
    const drdt = (profile(t + eps) - profile(t - eps)) / (2 * eps);
    const drdy = drdt / (2 * HS);
    tan.set(drdt * cs, 2 * HS, drdt * sn).normalize();   // local Y (up the berry)
    nrm.set(cs, -drdy, sn).normalize();                  // local Z (outward)

    lY.copy(tan); lZ.copy(nrm);
    lX.crossVectors(lY, lZ).normalize();
    lZ.crossVectors(lX, lY).normalize();
    // small random roll so seeds aren't perfectly aligned
    q.setFromAxisAngle(lY, (rng() - 0.5) * 0.6);
    lX.applyQuaternion(q); lZ.applyQuaternion(q);

    const len = 0.10 + rng() * 0.05;
    const wid = 0.06 + rng() * 0.03;
    const dep = 0.05 + rng() * 0.02;

    p3.addScaledVector(nrm, -0.006);            // sink a touch into the flesh
    rot.makeBasis(lX, lY, lZ);
    scl.makeScale(wid, len, dep);
    trs.makeTranslation(p3.x, p3.y, p3.z);
    M.copy(trs).multiply(rot).multiply(scl);
    seeds.setMatrixAt(i, M);

    sc.setHex(seedPal[(rng() * seedPal.length) | 0]).offsetHSL(0, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.08);
    seeds.setColorAt(i, sc);
  }
  seeds.instanceMatrix.needsUpdate = true;
  if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
  group.add(seeds);

  // ---- calyx: green leaves + stem ----
  if (calyx) {
    const leafGeo = new THREE.ConeGeometry(1, 1, 4); // flattened -> pointed sepal
    leafGeo.translate(0, 0.5, 0);
    const inner = 4;
    const leafTotal = sepals + inner;
    const leaves = new THREE.InstancedMesh(
      leafGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.0 }),
      leafTotal
    );
    const greens = [0x3f9a33, 0x4bb03e, 0x2f7f27, 0x57b84a];
    const gc = new THREE.Color();

    let idx = 0;
    function placeLeaf(theta, elev, length, width, thick, baseR, baseY) {
      const cs = Math.cos(theta), sn = Math.sin(theta);
      const ce = Math.cos(elev), se = Math.sin(elev);
      lY.set(ce * cs, se, ce * sn).normalize();   // length axis: out + up (or down)
      lX.set(-sn, 0, cs);                          // tangential width axis
      lZ.crossVectors(lX, lY).normalize();
      rot.makeBasis(lX, lY, lZ);
      scl.makeScale(width, length, thick);
      trs.makeTranslation(baseR * cs, baseY, baseR * sn);
      M.copy(trs).multiply(rot).multiply(scl);
      leaves.setMatrixAt(idx, M);
      gc.setHex(greens[(rng() * greens.length) | 0]).offsetHSL(0, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.06);
      leaves.setColorAt(idx, gc);
      idx++;
    }

    // outer sepals: fan out over the shoulders, a few droop down
    for (let k = 0; k < sepals; k++) {
      const theta = (k / sepals) * Math.PI * 2 + (rng() - 0.5) * 0.15;
      const droop = rng() < 0.35;
      const elev = droop ? (-0.25 - rng() * 0.15) : (0.20 + rng() * 0.45);
      placeLeaf(theta, elev, 0.72 + rng() * 0.24, 0.17 + rng() * 0.05, 0.045, 0.14, TOP_Y - 0.02);
    }
    // inner sepals: shorter, more upright
    for (let k = 0; k < inner; k++) {
      const theta = (k / inner) * Math.PI * 2 + 0.4 + (rng() - 0.5) * 0.2;
      placeLeaf(theta, 0.9 + rng() * 0.35, 0.40 + rng() * 0.14, 0.12 + rng() * 0.04, 0.04, 0.06, TOP_Y);
    }

    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    group.add(leaves);

    if (stem) {
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e7d2f, roughness: 0.6, metalness: 0.0 });
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.55, 10), stemMat);
      st.position.set(0.04, TOP_Y + 0.24, 0.0);
      st.rotation.z = -0.18;
      group.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), stemMat);
      cap.position.set(0.02, TOP_Y + 0.02, 0.0);
      group.add(cap);
    }
  }

  group.scale.setScalar(size);
  return group;
}

function smooth01(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

// small seeded PRNG so a given seed always yields the same berry
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
