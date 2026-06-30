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
        // flag background filling the portal interior
        const flag = themeFlag(def.theme);
        flag.scale.set(1, 1.4, 1);
        flag.position.z = 0.05;
        g.add(flag);
        const sym = themeSymbol(def.theme);
        sym.position.z = 0.1;
        g.add(sym);
        g.scale.setScalar(1.5);
        g.userData.icon = '🌀'; g.userData.spin = 0.6; g.userData.billboard = true;
        break;
      }
      case 'mode': {
        // green (good) or red (bad) PORTAL — big colored hollow ring you can see through
        const c = def.mode === 'good' ? 0x33ff88 : 0xff2233;
        const R = 3.4; // ~2x the old portal — bigger & more visible
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.4, 16, 36), m(c, { emissiveIntensity: 0.95 }));
        g.add(ring);
        // faint transparent membrane so the interior is hollow / see-through
        const inner = new THREE.Mesh(
          new THREE.CircleGeometry(R - 0.35, 36),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
        );
        g.add(inner);
        g.userData.icon = def.mode === 'good' ? '🌞' : '🌧'; g.userData.spin = 1.0; g.userData.billboard = true;
        break;
      }
      case 'slowmo': {
        // big mushroom / cannabis side object
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2, 12), m(0xf3e5d0, { emissiveIntensity: 0.2 }));
        g.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m(0xcc3344, { emissiveIntensity: 0.5 }));
        cap.position.y = 1; cap.scale.y = 0.8; g.add(cap);
        for (let i = 0; i < 5; i++) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), m(0xffffff, { emissiveIntensity: 0.6 }));
          const a = i / 5 * Math.PI * 2;
          dot.position.set(Math.cos(a) * 1.0, 1.4, Math.sin(a) * 1.0); g.add(dot);
        }
        g.scale.setScalar(1.4);
        g.userData.icon = '🍄'; g.userData.spin = 0.8;
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
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (theme === 'vinted') {
    ctx.fillStyle = '#007782';
    ctx.fillRect(0, 0, 96, 96);
  } else {
    const cols = STRIPES[theme] || ['#ffffff', '#ffffff', '#ffffff'];
    for (let i = 0; i < 3; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(0, i * 32, 96, 32); }
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
}

// small iconic object shown inside a theme portal
function themeSymbol(theme) {
  const m = (c) => new THREE.MeshBasicMaterial({ color: c });
  const g = new THREE.Group();
  switch (theme) {
    case 'berlin': {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 2, 8), m(0xc0c8ff)); g.add(s);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), m(0xff4b2b)); b.position.y = 0.8; g.add(b);
      break;
    }
    case 'amsterdam': {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16), m(0xe8b04b)); p.rotation.x = 0.5; g.add(p);
      break;
    }
    case 'vilnius': {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.4, 8), m(0xb5503a)); g.add(t);
      break;
    }
    case 'vinted': {
      const v = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.18, 8, 20), m(0x09b1ba)); g.add(v);
      break;
    }
  }
  return g;
}
