import * as THREE from 'three';
import { PICKUPS } from './config.js';

// ============================================================
//  Pickups — fixed power-up objects on the track + AI projectiles.
//  Only the player can collect pickups (per spec).
// ============================================================
export class Pickups {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.projectiles = [];
    this._build();
  }

  _build() {
    for (const def of PICKUPS) {
      const mesh = this._mesh(def);
      mesh.position.copy(this.track.placeAt(def.t, def.side, 1.6));
      this.group.add(mesh);
      // mode portals are large, so they get a correspondingly bigger hitbox
      const collectRadius = def.type === 'mode' ? 6.0 : 3.2;
      this.items.push({ def, mesh, active: true, respawn: 0, collectRadius });
    }
  }

  _mesh(def) {
    const g = new THREE.Group();
    const m = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, ...opts });
    switch (def.type) {
      case 'boost': {
        // glowing coffee cup
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 1.2, 12), m(0x6f4e37));
        g.add(cup);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 12), m(0xffffff));
        lid.position.y = 0.7; g.add(lid);
        g.userData.icon = '☕'; g.userData.spin = 2;
        break;
      }
      case 'theme': {
        // white shining oval portal with iconic object inside
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.35, 12, 28), m(0xffffff, { emissiveIntensity: 1.8 }));
        ring.scale.set(1, 1.4, 1);
        g.add(ring);
        const inner = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        inner.scale.set(1, 1.4, 1);
        g.add(inner);
        // strong white halo glow surrounding the portal (additive, larger than the ring)
        const halo = new THREE.Mesh(
          new THREE.CircleGeometry(3.2, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        halo.scale.set(1, 1.4, 1);
        halo.position.z = -0.05;
        g.add(halo);
        // actual light cast around the portal so it illuminates its surroundings
        const glowLight = new THREE.PointLight(0xffffff, 3.0, 16, 2);
        g.add(glowLight);
        // flag background (with bold centered letter) filling the portal interior
        const flag = themeFlag(def.theme);
        flag.scale.set(1, 1.4, 1);
        flag.position.z = 0.05;
        g.add(flag);
        g.scale.setScalar(1.5);
        g.userData.icon = '🌀'; g.userData.spin = 0.6; g.userData.billboard = true;
        break;
      }
      case 'mode': {
        if (def.mode === 'bad') {
          // organic HORROR PORTAL — a fleshy rift torn open in space
          // 1. Core rift: vertical pointed-oval (almond/eye) via bezier curves
          const rift = new THREE.Shape();
          rift.moveTo(0, 2.6);
          rift.bezierCurveTo(1.6, 1.4, 1.6, -1.4, 0, -2.6);
          rift.bezierCurveTo(-1.6, -1.4, -1.6, 1.4, 0, 2.6);
          const riftGeo = new THREE.ExtrudeGeometry(rift, { depth: 0.3, bevelEnabled: false });
          const riftMesh = new THREE.Mesh(riftGeo, m(0x1a0000, { emissiveIntensity: 0.7 }));
          riftMesh.position.z = -0.15;
          g.add(riftMesh);

          // 2. Membrane filling the rift + vertical "vein" details
          const membrane = new THREE.Mesh(
            new THREE.PlaneGeometry(2.4, 5),
            new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
          );
          membrane.position.z = 0.05;
          g.add(membrane);
          for (let i = 0; i < 6; i++) {
            const t = (i / 5 - 0.5);          // -0.5 .. 0.5
            const h = 4.4 * (1 - Math.abs(t) * 1.3); // taller in the middle of the eye
            if (h <= 0.2) continue;
            const vein = new THREE.Mesh(
              new THREE.BoxGeometry(0.05, h, 0.05),
              m(0x4d0000, { emissiveIntensity: 0.5 })
            );
            vein.position.set(t * 2.0, 0, 0.1);
            g.add(vein);
          }

          // 3. Tendrils: 8 thick curved tentacle arms radiating from the rift edge
          const tendrilColors = [0x1a0a00, 0x120800, 0x0a0400, 0x000000];
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const sx = Math.cos(a) * 1.2, sy = Math.sin(a) * 2.4; // start on the almond edge
            const dirx = Math.cos(a), diry = Math.sin(a);
            const curl = (i % 2 === 0 ? 1 : -1) * (0.8 + (i % 3) * 0.5);
            const pts = [
              new THREE.Vector3(sx, sy, 0),
              new THREE.Vector3(sx + dirx * 1.6 - diry * curl * 0.4, sy + diry * 1.6 + dirx * curl * 0.4, 0.3),
              new THREE.Vector3(sx + dirx * 3.0 + diry * curl, sy + diry * 3.0 - dirx * curl, -0.2),
              new THREE.Vector3(sx + dirx * 4.2 - diry * curl * 1.4, sy + diry * 4.2 + dirx * curl * 1.4, 0.4),
              new THREE.Vector3(sx + dirx * 5.0 + diry * curl * 2.0, sy + diry * 5.0 - dirx * curl * 2.0, -0.3),
            ];
            const curve = new THREE.CatmullRomCurve3(pts);
            const radius = 0.15 + (i % 4) * (0.20 / 3); // 0.15 .. 0.35
            const tube = new THREE.Mesh(
              new THREE.TubeGeometry(curve, 24, radius, 8, false),
              m(tendrilColors[i % tendrilColors.length], { emissiveIntensity: 0.25 })
            );
            g.add(tube);
          }

          // 4. Glow layers — coloured lights + emissive rings
          const pink = new THREE.PointLight(0xff00cc, 2.5, 30);
          pink.position.set(0, 0, 0.5);
          g.add(pink);
          const orange = new THREE.PointLight(0xff6600, 1.8, 30);
          orange.position.set(0.6, -0.6, 0.5);
          g.add(orange);
          const outerRing = new THREE.Mesh(
            new THREE.TorusGeometry(3.4, 0.25, 16, 40),
            m(0xff1493, { emissiveIntensity: 1.2 })
          );
          outerRing.scale.set(0.85, 1.3, 1);
          g.add(outerRing);
          const innerRing = new THREE.Mesh(
            new THREE.TorusGeometry(2.4, 0.2, 16, 36),
            m(0xff6600, { emissiveIntensity: 1.5 })
          );
          innerRing.scale.set(0.75, 1.2, 1);
          g.add(innerRing);

          // 5. behaviour
          g.userData.icon = '🌧'; g.userData.spin = 0.3; g.userData.billboard = true;
          break;
        }
        // green (good) PORTAL — big colored hollow ring you can see through
        const c = 0x33ff88;
        const R = 8.0; // spans the full 16-unit road width — edge to edge
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.4, 16, 36), m(c, { emissiveIntensity: 0.95 }));
        g.add(ring);
        // faint transparent membrane so the interior is hollow / see-through
        const inner = new THREE.Mesh(
          new THREE.CircleGeometry(R - 0.35, 36),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
        );
        g.add(inner);
        g.userData.icon = '🌞'; g.userData.spin = 1.0; g.userData.billboard = true;
        break;
      }
      case 'slowmo': {
        // cannabis leaf: 7 elongated pointed leaflets fanned around a central stem
        const leafMat = m(0x33cc44, { emissiveIntensity: 0.85 });
        // build a single pointed-ellipse leaflet shape, extruded for a bit of depth
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.bezierCurveTo(0.18, 0.5, 0.12, 1.1, 0, 1.5);   // up one side to the tip
        leafShape.bezierCurveTo(-0.12, 1.1, -0.18, 0.5, 0, 0);   // back down the other side
        const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.06, bevelEnabled: false });
        // base of the leaflet sits at the origin so it fans out from the stem
        leafGeo.center();
        leafGeo.translate(0, 0.75, 0);
        // 7 leaflets fanned out, centre tallest, shrinking toward the edges
        const angles = [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05];
        for (let i = 0; i < angles.length; i++) {
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          const len = 1 - Math.abs(angles[i]) * 0.45; // outer leaflets a bit shorter
          leaf.scale.set(len, len, 1);
          leaf.rotation.z = angles[i];
          g.add(leaf);
        }
        // thin central stem
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), m(0x2e8b2e, { emissiveIntensity: 0.5 }));
        stem.position.y = -0.6; g.add(stem);
        g.scale.setScalar(2.4);

        // ring of rainbow sparkles around the leaf
        const rainbow = [0xff0000, 0xff8800, 0xffee00, 0x33cc44, 0x00ccff, 0x3344ff, 0xaa33ff, 0xff33cc];
        const sparkles = [];
        for (let i = 0; i < 8; i++) {
          const sp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), m(rainbow[i], { emissiveIntensity: 0.9 }));
          const a = i / 8 * Math.PI * 2;
          sp.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
          g.add(sp);
          sparkles.push(sp);
        }
        g.userData.sparkles = sparkles;
        g.userData.icon = '🍁'; g.userData.spin = 0.8;
        break;
      }
    }
    return g;
  }

  // spin/bob animation + respawn handling
  update(dt, camera) {
    const tnow = performance.now() * 0.001;
    for (const it of this.items) {
      it.mesh.rotation.y += (it.mesh.userData.spin || 1) * dt;
      // theme portals are tall (1.5x scaled oval) — raise them so the whole flag clears the ground
      const baseY = it.def.type === 'slowmo' ? 1.0 : it.def.type === 'theme' ? 4.4 : 1.6;
      it.mesh.position.y = baseY + Math.sin(tnow * 2 + it.def.t * 10) * 0.2;
      if (it.mesh.userData.billboard && camera) {
        it.mesh.rotation.y = Math.atan2(camera.position.x - it.mesh.position.x, camera.position.z - it.mesh.position.z);
      }
      if (it.active && it.def.type === 'slowmo' && it.mesh.userData.sparkles) {
        const sparkles = it.mesh.userData.sparkles;
        for (let i = 0; i < sparkles.length; i++) {
          const sp = sparkles[i];
          // orbit around the Y axis, each sparkle offset by its index so they fan out
          const a = tnow * 1.5 + (i / sparkles.length) * Math.PI * 2;
          const r = 2.2;
          sp.position.set(Math.cos(a) * r, Math.sin(tnow * 2 + i) * 0.4, Math.sin(a) * r);
          // pulse scale with a sine wave so they twinkle
          const s = 0.7 + Math.abs(Math.sin(tnow * 4 + i * 0.8)) * 0.8;
          sp.scale.setScalar(s);
        }
      }
      if (!it.active) {
        it.respawn -= dt;
        if (it.respawn <= 0) { it.active = true; it.mesh.visible = true; }
      }
    }
    // projectiles
    for (const p of this.projectiles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 8;
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.life <= 0) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }

  // returns array of collected defs this frame
  checkCollect(playerKart) {
    const hits = [];
    for (const it of this.items) {
      if (!it.active) continue;
      // horizontal distance only — portals are raised well above the kart, so y must not count
      const dx = playerKart.pos.x - it.mesh.position.x;
      const dz = playerKart.pos.z - it.mesh.position.z;
      if (Math.hypot(dx, dz) < it.collectRadius) {
        it.active = false;
        it.mesh.visible = false;
        it.respawn = 10; // reappear later for replay value
        hits.push(it.def);
      }
    }
    return hits;
  }

  fireProjectile(fromKart, targetKart) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6),
      new THREE.MeshLambertMaterial({ color: 0x9b59ff, emissive: 0x6a3aff, emissiveIntensity: 0.6 })
    );
    mesh.position.copy(fromKart.pos).setY(1.4);
    const vel = new THREE.Vector3().subVectors(targetKart.pos, fromKart.pos).setY(0).normalize().multiplyScalar(48);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, vel, life: 2.5, from: fromKart });
  }

  // check projectile hits vs player; returns true if hit landed
  checkProjectileHits(playerKart) {
    if (playerKart.invuln) return false;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.mesh.position.distanceTo(playerKart.pos) < 2.4) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        return playerKart.applyHit();
      }
    }
    return false;
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
  }

  resetAll() {
    this.clearProjectiles();
    for (const it of this.items) { it.active = true; it.mesh.visible = true; it.respawn = 0; }
  }
}

// flag background that fills a theme portal — 3 horizontal stripes (or solid)
function themeFlag(theme) {
  const STRIPES = {
    berlin: ['#000000', '#FF0000', '#FFCC00'],
    vilnius: ['#FCD116', '#006633', '#D12630'],
    amsterdam: ['#AE1C28', '#FFFFFF', '#21468B'],
  };
  const LABELS = { berlin: 'B', vilnius: 'V', amsterdam: 'A', vinted: '❤️' };
  const S = 256; // canvas resolution
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (theme === 'vinted') {
    ctx.fillStyle = '#007782';
    ctx.fillRect(0, 0, S, S);
  } else {
    const cols = STRIPES[theme] || ['#ffffff', '#ffffff', '#ffffff'];
    const band = S / 3;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(0, i * band, S, band + 1); }
  }
  // large bold letter / emoji centered on top of the flag
  const label = LABELS[theme] || '';
  if (label) {
    ctx.font = `bold ${Math.round(S * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = S * 0.04;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(label, S / 2, S / 2);
    ctx.fillText(label, S / 2, S / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
}
