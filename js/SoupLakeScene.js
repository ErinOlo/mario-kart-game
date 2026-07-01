// SoupLakeScene.js
// -----------------------------------------------------------------------------
// "Ežeras-Šaltibarščiai" — a stylised 3D landscape of a cold-beet-soup lake.
// Rolling green hills, an irregular pink soup lake with live ripples + cream
// swirls, floating halved eggs, spoon-oared rowboats, a birch/pine treeline,
// a small village and a hand-painted wooden sign.
//
// Built to be dropped into a game. It's engine-agnostic Three.js: it returns a
// THREE.Group you can add to your own scene, plus an update(elapsed) function
// to call every frame for the animation (ripples, bobbing boats/eggs).
//
//   import * as THREE from 'three';
//   import { createSoupLakeScene } from './SoupLakeScene.js';
//
//   const world = createSoupLakeScene();     // { group, update, lake }
//   scene.add(world.group);
//   // in your render loop:  world.update(clock.getElapsedTime());
//
// Everything is procedural — no external textures/models needed.
// -----------------------------------------------------------------------------

import * as THREE from 'three';

// ---- palette (tuned to the illustration) -----------------------------------
const COLORS = {
  soupDeep:   0x9e1b52,
  soup:       0xc0286b,
  soupLight:  0xd94f8a,
  cream:      0xf7e9df,
  yolk:       0xf6b31e,
  eggWhite:   0xfbf7f0,
  grass:      0x6faa3a,
  grassDark:  0x4d8129,
  dirt:       0xb98a52,
  pine:       0x2f6d34,
  pineDark:   0x235528,
  birchTrunk: 0xf1efe6,
  birchLeaf:  0x8cc152,
  wood:       0x8a5a34,
  woodDark:   0x5f3c20,
  roofRed:    0x9c4a34,
  wall:       0xe9dcc2,
  skinA:      0xe8b58c,
  skinB:      0xd79a6a,
  shirtA:     0x3d6ea5,
  shirtB:     0xb5473f,
};

// small deterministic pseudo-random so the scene is reproducible
function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// SKY (gradient dome)
// -----------------------------------------------------------------------------
function makeSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#8fc3e8'); // upper sky
  g.addColorStop(0.55, '#cfe6f2');
  g.addColorStop(1.0, '#f6ecd6'); // warm horizon haze
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  return mesh;
}

// -----------------------------------------------------------------------------
// GROUND (rolling hills). The lake sits in a gentle central depression.
// -----------------------------------------------------------------------------
function hillHeight(x, z) {
  // sum of a few sines -> soft rolling hills
  const h =
    Math.sin(x * 0.05) * 2.2 +
    Math.cos(z * 0.045) * 2.0 +
    Math.sin((x + z) * 0.03) * 1.6 +
    Math.cos((x - z) * 0.07) * 0.8;
  // carve a bowl for the lake around the origin
  const d = Math.sqrt(x * x + z * z);
  const bowl = -Math.max(0, 1 - d / 60) * 3.5;
  return h + bowl;
}

function makeGround() {
  const size = 320, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  const cGrass = new THREE.Color(COLORS.grass);
  const cDark = new THREE.Color(COLORS.grassDark);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = hillHeight(x, z);
    pos.setY(i, y);
    // shade by height + a little noise for a painted look
    const t = THREE.MathUtils.clamp((y + 4) / 10, 0, 1);
    const col = cDark.clone().lerp(cGrass, t);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

// -----------------------------------------------------------------------------
// SOUP LAKE — irregular blob outline, cream-swirl texture, live vertex ripple.
// -----------------------------------------------------------------------------
function makeSoupTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  // base beet colour
  ctx.fillStyle = '#c0286b';
  ctx.fillRect(0, 0, S, S);

  // soft magenta blotches
  const rng = makeRng(7);
  for (let i = 0; i < 40; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(217,79,138,0.5)');
    g.addColorStop(1, 'rgba(217,79,138,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // sour-cream swirls (the white spirals in the illustration)
  ctx.lineCap = 'round';
  for (let s = 0; s < 7; s++) {
    const cx = 60 + rng() * (S - 120);
    const cy = 60 + rng() * (S - 120);
    const turns = 2 + rng() * 2;
    ctx.strokeStyle = 'rgba(247,233,223,0.85)';
    ctx.lineWidth = 5 + rng() * 5;
    ctx.beginPath();
    for (let a = 0; a < turns * Math.PI * 2; a += 0.15) {
      const rad = a * (2.4 + rng() * 0.2);
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // dill flecks
  ctx.fillStyle = 'rgba(70,120,40,0.9)';
  for (let i = 0; i < 220; i++) {
    const x = rng() * S, y = rng() * S;
    ctx.fillRect(x, y, 2 + rng() * 3, 1 + rng() * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeLake() {
  // wobbly closed outline ~ organic lake blob
  const rng = makeRng(21);
  const shape = new THREE.Shape();
  const N = 48, R = 52;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.22 * Math.sin(a * 3 + 1) + 0.12 * Math.sin(a * 7) + (rng() - 0.5) * 0.06;
    const rx = R * 1.15 * wob;
    const rz = R * 0.8 * wob;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * rz;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }

  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2); // lie flat in XZ
  geo.computeBoundingBox();

  // planar UVs from bounding box so the swirl texture maps nicely
  const bb = geo.boundingBox;
  const sx = 1 / (bb.max.x - bb.min.x);
  const sz = 1 / (bb.max.z - bb.min.z);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) * sx;
    uv[i * 2 + 1] = (pos.getZ(i) - bb.min.z) * sz;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  // keep a copy of rest positions for the ripple animation
  const rest = pos.array.slice();

  const mat = new THREE.MeshStandardMaterial({
    map: makeSoupTexture(),
    roughness: 0.35,
    metalness: 0.0,
    transparent: true,
    opacity: 0.97,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.15;
  mesh.name = 'soupLake';
  mesh.receiveShadow = true;

  mesh.userData.animate = (t) => {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = rest[i * 3];
      const z = rest[i * 3 + 2];
      const ripple =
        Math.sin(x * 0.18 + t * 1.4) * 0.18 +
        Math.cos(z * 0.15 - t * 1.1) * 0.15 +
        Math.sin((x + z) * 0.1 + t * 0.7) * 0.1;
      p.setY(i, ripple);
    }
    p.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.material.map.offset.x = t * 0.005; // slow drift of the swirls
  };

  return mesh;
}

// -----------------------------------------------------------------------------
// FLOATING HALVED EGG (white oval, half-submerged, yolk on top)
// -----------------------------------------------------------------------------
function makeEgg(scale = 1) {
  const g = new THREE.Group();

  const white = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ color: COLORS.eggWhite, roughness: 0.6 })
  );
  white.scale.set(1.7, 0.6, 1.15);
  white.castShadow = true;
  g.add(white);

  const yolk = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshStandardMaterial({ color: COLORS.yolk, roughness: 0.5, emissive: 0x3a2400, emissiveIntensity: 0.15 })
  );
  yolk.scale.set(0.62, 0.18, 0.62);
  yolk.position.y = 0.5;
  g.add(yolk);

  g.scale.setScalar(scale);
  g.userData.baseY = 0.25 * scale; // sits low in the soup
  g.position.y = g.userData.baseY;
  return g;
}

// -----------------------------------------------------------------------------
// ROWBOAT with a little rower and a spoon-oar
// -----------------------------------------------------------------------------
function makeBoat() {
  const g = new THREE.Group();

  // hull: a scaled, tapered shape from a squashed sphere
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.9, side: THREE.DoubleSide })
  );
  hull.scale.set(1.5, 0.9, 3.2);
  hull.rotation.x = Math.PI;      // open side up
  hull.position.y = 0.55;
  hull.castShadow = true;
  g.add(hull);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 8, 24),
    new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.9 })
  );
  rim.scale.set(1.5, 3.2, 1);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.55;
  g.add(rim);

  // rower
  const rower = new THREE.Group();
  const rng = makeRng(Math.floor(Math.random() * 1e6) + 1);
  const shirt = rng() > 0.5 ? COLORS.shirtA : COLORS.shirtB;
  const skin = rng() > 0.5 ? COLORS.skinA : COLORS.skinB;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 })
  );
  body.position.y = 0.95;
  rower.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 12),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
  );
  head.position.y = 1.45;
  rower.add(head);
  g.add(rower);

  // spoon-oar: shaft + spoon bowl
  const oar = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.7, metalness: 0.2 })
  );
  shaft.rotation.z = Math.PI / 2.4;
  oar.add(shaft);

  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide })
  );
  bowl.scale.set(0.7, 0.3, 1);
  bowl.position.set(1.15, -0.95, 0);
  bowl.rotation.z = Math.PI / 2.4;
  oar.add(bowl);
  oar.position.set(0.4, 1.0, 0.5);
  g.add(oar);

  g.userData.oar = oar;
  g.userData.baseY = 0;
  return g;
}

// -----------------------------------------------------------------------------
// TREES
// -----------------------------------------------------------------------------
function makePine(rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 1.4, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 1 })
  );
  trunk.position.y = 0.7;
  g.add(trunk);

  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const r = 1.9 - i * 0.5;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 2.0, 9),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? COLORS.pine : COLORS.pineDark, roughness: 1,
      })
    );
    cone.position.y = 1.6 + i * 1.15;
    cone.castShadow = true;
    g.add(cone);
  }
  g.scale.setScalar(0.9 + rng() * 0.8);
  return g;
}

function makeBirch(rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.birchTrunk, roughness: 0.9 })
  );
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  g.add(trunk);

  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(1.1 - i * 0.15, 12, 10),
      new THREE.MeshStandardMaterial({ color: COLORS.birchLeaf, roughness: 1 })
    );
    leaf.position.set((rng() - 0.5) * 0.8, 3.4 + i * 0.5, (rng() - 0.5) * 0.8);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.scale.setScalar(0.9 + rng() * 0.6);
  return g;
}

// -----------------------------------------------------------------------------
// VILLAGE HOUSE (timber wall + pitched roof + chimney)
// -----------------------------------------------------------------------------
function makeHouse(rng) {
  const g = new THREE.Group();
  const w = 2 + rng() * 1.2, d = 2.2 + rng() * 1.2, h = 1.6 + rng() * 0.6;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 1 })
  );
  wall.position.y = h / 2;
  wall.castShadow = true;
  g.add(wall);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.3, 4),
    new THREE.MeshStandardMaterial({ color: COLORS.roofRed, roughness: 1 })
  );
  roof.position.y = h + 0.65;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.8, 0.3),
    new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 1 })
  );
  chimney.position.set(w * 0.25, h + 0.9, d * 0.2);
  g.add(chimney);

  return g;
}

// -----------------------------------------------------------------------------
// WOODEN SIGN — "EŽERAS–ŠALTIBARŠČIAI"
// -----------------------------------------------------------------------------
function makeSign(text = 'EŽERAS–ŠALTIBARŠČIAI') {
  const g = new THREE.Group();

  const postMat = new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 1 });
  for (const x of [-2.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 4, 8), postMat);
    post.position.set(x, 2, 0);
    post.castShadow = true;
    g.add(post);
  }

  // plank with painted text (canvas texture)
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 220;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, 0, c.width, c.height);
  // wood grain
  ctx.strokeStyle = 'rgba(60,38,20,0.35)';
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 22) * c.height + Math.sin(i) * 4);
    ctx.lineTo(c.width, (i / 22) * c.height + Math.cos(i) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#f6ecd6';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 1.1, 0.14),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  plank.position.set(0, 3, 0);
  plank.castShadow = true;
  g.add(plank);

  return g;
}

// place an object on the terrain surface, with optional facing
function placeOnGround(obj, x, z, extraY = 0) {
  obj.position.set(x, hillHeight(x, z) + extraY, z);
}

// -----------------------------------------------------------------------------
// MAIN BUILDER
// -----------------------------------------------------------------------------
export function createSoupLakeScene(options = {}) {
  const {
    seed = 42,
    withSky = true,
    signText = 'EŽERAS–ŠALTIBARŠČIAI',
  } = options;

  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'SoupLakeLandscape';

  if (withSky) group.add(makeSky());
  group.add(makeGround());

  const lake = makeLake();
  group.add(lake);

  // ---- floating eggs ----
  const eggs = [];
  const eggSpots = [
    [-14, 6], [8, -10], [22, 8], [-4, 20], [16, 22],
    [-24, -6], [2, 2], [30, -6], [-30, 14],
  ];
  eggSpots.forEach(([x, z], i) => {
    const egg = makeEgg(2.2 + rng() * 1.6);
    egg.position.x = x; egg.position.z = z;
    egg.rotation.y = rng() * Math.PI;
    egg.userData.phase = i * 0.9;
    group.add(egg);
    eggs.push(egg);
  });

  // ---- boats ----
  const boats = [];
  const boatSpots = [[-2, 12], [18, -2], [10, 16]];
  boatSpots.forEach(([x, z], i) => {
    const boat = makeBoat();
    boat.position.set(x, 0.4, z);
    boat.rotation.y = rng() * Math.PI * 2;
    boat.userData.phase = i * 1.7;
    group.add(boat);
    boats.push(boat);
  });

  // ---- treeline around the lake (ring of pines + birches) ----
  const treeCount = 90;
  for (let i = 0; i < treeCount; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 70 + rng() * 70;
    const x = Math.cos(a) * rad * 1.1;
    const z = Math.sin(a) * rad * 0.85;
    const tree = rng() > 0.45 ? makePine(rng) : makeBirch(rng);
    placeOnGround(tree, x, z);
    tree.rotation.y = rng() * Math.PI * 2;
    group.add(tree);
  }

  // ---- village on the far hill ----
  const village = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const house = makeHouse(rng);
    const x = 55 + (rng() - 0.5) * 34;
    const z = -55 + (rng() - 0.5) * 26;
    placeOnGround(house, x, z);
    house.rotation.y = rng() * Math.PI * 2;
    village.add(house);
  }
  group.add(village);

  // ---- sign at the near shore ----
  const sign = makeSign(signText);
  placeOnGround(sign, -46, 40);
  sign.rotation.y = Math.PI * 0.15;
  group.add(sign);

  // ---------------------------------------------------------------------------
  // per-frame update
  // ---------------------------------------------------------------------------
  function update(elapsed) {
    lake.userData.animate(elapsed);

    for (const egg of eggs) {
      egg.position.y = egg.userData.baseY + Math.sin(elapsed * 0.9 + egg.userData.phase) * 0.25;
      egg.rotation.y += 0.0015;
    }

    for (const boat of boats) {
      const p = boat.userData.phase;
      boat.position.y = 0.4 + Math.sin(elapsed * 0.8 + p) * 0.2;
      boat.rotation.z = Math.sin(elapsed * 0.8 + p) * 0.04;
      if (boat.userData.oar) {
        boat.userData.oar.rotation.y = Math.sin(elapsed * 1.6 + p) * 0.5;
      }
    }
  }

  return { group, update, lake, eggs, boats };
}

export default createSoupLakeScene;

// Exported so a single soup lake can be reused on its own (as a decorative
// water feature) without building the entire landscape (sky/ground/trees/etc.).
export { makeLake };
