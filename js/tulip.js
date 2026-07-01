/**
 * tulip.js — procedural Tulip for Three.js
 * ----------------------------------------
 * Returns a THREE.Group you can drop straight into your own scene.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { createTulip } from './tulip.js';
 *
 *   const tulip = createTulip(THREE, { size: 1, seed: 5 });
 *   tulip.position.set(x, groundY, z);   // group origin (y=0) is the bottom of the stem
 *   scene.add(tulip);
 *
 * Notes:
 *  - Uses MeshStandardMaterial, so your scene needs lights.
 *  - THREE is passed in, so it works with any version / loader (npm, CDN global, import map).
 *  - Same `seed` -> identical tulip. Change it for variety.
 *  - The bloom is 3 outer + 3 inner petals; petals & leaves are double-sided surfaces.
 *  - Want the low-poly faceted look of the reference? Set flatShading:true on the materials
 *    (petalMat / leafMat below) — I've left them smooth by default.
 *  - Not using ES modules? Delete the `export` keyword and call the function directly.
 */

export function createTulip(THREE, options = {}) {
  const {
    seed = 1,
    size = 1,
    petals = 3,       // outer petals (an equal inner set is added)
    leaves = true,
  } = options;

  const rng = mulberry32(seed);

  const STEM_H = 2.6;    // height of the bloom base
  const BLOOM_H = 1.65;  // height of the bloom itself
  const RMAX = 0.52;     // max bloom radius

  const group = new THREE.Group();

  // reusable colours
  const pinkCenter = new THREE.Color(0xf3a9c0);
  const pinkEdge   = new THREE.Color(0xd85c7e);
  const pinkDark   = new THREE.Color(0xae3c5d);
  const gMid       = new THREE.Color(0x5fae4c);
  const gEdge      = new THREE.Color(0x2f7a2e);
  const pc = new THREE.Color();
  const lc = new THREE.Color();

  // ---- bloom profile (surface of revolution the petals wrap onto) ----
  const rC = (u) => 0.05 + RMAX * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.92)), 0.8);
  const delta = (u, dmax) => dmax * Math.pow(Math.sin(Math.PI * u), 0.6); // angular half-width

  function petalColor(u, v) {
    const edge = Math.pow(Math.abs(v), 1.3);
    pc.copy(pinkCenter).lerp(pinkEdge, edge);
    if (u < 0.18) pc.lerp(pinkDark, ((0.18 - u) / 0.18) * 0.55); // darker at the base
    pc.offsetHSL(0, 0, 0.05 * Math.sin(v * 9 + u * 4));          // faint vertical veining
    return pc;
  }

  function buildPetal(phi, dmax, layerR, layerH, lighten) {
    return buildGridGeom(THREE, 22, 12, (u, v) => {
      const a = phi + v * delta(u, dmax);
      const r = rC(u) * layerR;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const y = STEM_H + BLOOM_H * layerH * u;
      petalColor(u, v);
      if (lighten) pc.lerp(WHITE, lighten);
      return [x, y, z, pc.r, pc.g, pc.b];
    });
  }

  const petalMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide,
  });
  const bloom = new THREE.Group();
  const dmaxOuter = (Math.PI / petals) * 1.18;
  for (let k = 0; k < petals; k++) {
    const phi = (k / petals) * Math.PI * 2;
    bloom.add(new THREE.Mesh(buildPetal(phi, dmaxOuter, 1.0, 1.0, 0.0), petalMat));       // outer
    bloom.add(new THREE.Mesh(buildPetal(phi + Math.PI / petals, dmaxOuter, 0.9, 0.92, 0.08), petalMat)); // inner
  }
  group.add(bloom);
  group.userData.bloom = bloom;

  // ---- stem ----
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6e8a3c, roughness: 0.7, metalness: 0.0 });
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, STEM_H * 0.45, 0.01),
    new THREE.Vector3(-0.02, STEM_H * 0.8, -0.01),
    new THREE.Vector3(0, STEM_H + 0.05, 0),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 24, 0.075, 8, false), stemMat);
  group.add(stem);

  // ---- leaves ----
  if (leaves) {
    const leafMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide,
    });
    const up = new THREE.Vector3(0, 1, 0);

    function buildLeaf(psi, p) {
      const oHat = new THREE.Vector3(Math.cos(psi), 0, Math.sin(psi));
      const C = (u) => {
        const out = p.reach * u;
        const h = Math.max(0.03, p.baseY + p.archH * Math.sin(u * Math.PI * 0.9) - p.dropH * Math.pow(u, 1.7));
        return new THREE.Vector3(oHat.x * out, h, oHat.z * out);
      };
      const T = new THREE.Vector3(), W = new THREE.Vector3(), Nn = new THREE.Vector3();
      const q = new THREE.Quaternion();

      return buildGridGeom(THREE, 30, 8, (u, v) => {
        const du = 0.01;
        const c0 = C(Math.max(0, u - du));
        const c1 = C(Math.min(1, u + du));
        const cu = C(u);
        T.copy(c1).sub(c0).normalize();
        W.copy(up).cross(T);
        if (W.lengthSq() < 1e-6) W.set(1, 0, 0);
        W.normalize();
        Nn.copy(T).cross(W).normalize();
        q.setFromAxisAngle(T, p.twist * (u - 0.2)); // progressive twist
        W.applyQuaternion(q); Nn.applyQuaternion(q);

        const w = p.Wmax * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.7); // lanceolate width
        const fold = p.fold * (v * v - 0.3);                                     // channel cross-section
        const x = cu.x + W.x * (w * v) + Nn.x * fold;
        const y = cu.y + W.y * (w * v) + Nn.y * fold;
        const z = cu.z + W.z * (w * v) + Nn.z * fold;

        const mid = 1 - Math.abs(v);
        lc.copy(gEdge).lerp(gMid, Math.pow(mid, 0.7));
        lc.offsetHSL(0, (rng() - 0.5) * 0.02, 0.03 * Math.sin(u * 9));
        return [x, y, z, lc.r, lc.g, lc.b];
      });
    }

    const leaf1 = { reach: 1.55, archH: 0.62, baseY: 0.42, dropH: 0.55, Wmax: 0.34, fold: 0.16, twist: 0.85 };
    const leaf2 = { reach: 1.45, archH: 0.50, baseY: 0.52, dropH: 0.62, Wmax: 0.31, fold: 0.18, twist: -0.75 };
    group.add(new THREE.Mesh(buildLeaf(2.55 + (rng() - 0.5) * 0.3, leaf1), leafMat));
    group.add(new THREE.Mesh(buildLeaf(-0.5 + (rng() - 0.5) * 0.3, leaf2), leafMat));
  }

  group.scale.setScalar(size);
  return group;
}

const WHITE = { r: 1, g: 1, b: 1 };

// build an indexed surface from a grid; fn(u,v) -> [x,y,z, r,g,b]
function buildGridGeom(THREE, Nu, Nv, fn) {
  const cols = Nv + 1, rows = Nu + 1;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  for (let iu = 0; iu < rows; iu++) {
    const u = iu / Nu;
    for (let iv = 0; iv < cols; iv++) {
      const v = -1 + (2 * iv) / Nv;
      const o = (iu * cols + iv) * 3;
      const r = fn(u, v);
      positions[o] = r[0]; positions[o + 1] = r[1]; positions[o + 2] = r[2];
      colors[o] = r[3]; colors[o + 1] = r[4]; colors[o + 2] = r[5];
    }
  }
  const indices = [];
  for (let iu = 0; iu < Nu; iu++) {
    for (let iv = 0; iv < Nv; iv++) {
      const a = iu * cols + iv, b = a + 1, c = a + cols, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// WHITE as a plain object is fine for THREE.Color.lerp(color, alpha) since lerp reads r,g,b
// (kept above as a shared constant)

// small seeded PRNG so a given seed always yields the same tulip
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
