import * as THREE from 'three';
import { KART, RACE } from './config.js';

// ============================================================
//  Kart — shared by the player and the AI racers.
//  Arcade physics in the XZ plane: position + heading + speed.
// ============================================================
export class Kart {
  constructor(scene, track, racer, index) {
    this.scene = scene;
    this.track = track;
    this.racer = racer;
    this.index = index;
    this.isPlayer = !!racer.player;

    this.pos = new THREE.Vector3();
    this.heading = 0;          // radians, 0 = +Z
    this.speed = 0;            // signed forward speed
    this.lateralVel = 0;       // drift slide
    this.bump = new THREE.Vector3();  // world-space knockback from kart-to-kart hits

    // race progress
    this.lap = 0;
    this.progress = 0;         // total t traveled (lap + fractional)
    this.lastT = 0;
    this.finished = false;
    this.finishTime = null;

    // once finished, AI racers pull off to a roadside slot and watch the race
    this.parking = false;
    this.parkPos = null;
    this.parkHeading = 0;

    // status effects
    this.boostTimer = 0;
    this.hitTimer = 0;
    this.slowFactor = 1;       // speed multiplier applied while hitTimer > 0
    this.shootCooldown = 0;    // SPACE-weapon cooldown (player only)
    this.invuln = false;

    // drift state
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;

    // AI state
    this.aiAttackCooldown = 2 + Math.random() * 3;

    this.mesh = buildKart(racer);
    scene.add(this.mesh);

    const { pos, heading } = track.startTransform(index);
    this.pos.copy(pos);
    this.heading = heading;
    this.lastT = track.project(pos).t;
    this._syncMesh();
  }

  _syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  reset() {
    const { pos, heading } = this.track.startTransform(this.index);
    this.pos.copy(pos);
    this.heading = heading;
    this.speed = 0; this.lateralVel = 0;
    this.bump.set(0, 0, 0);
    this.lap = 0; this.progress = 0; this.finished = false; this.finishTime = null;
    this.parking = false; this.parkPos = null; this.parkHeading = 0;
    this.mesh.rotation.z = 0;
    this.boostTimer = 0; this.hitTimer = 0; this.slowFactor = 1; this.shootCooldown = 0; this.invuln = false;
    this.drifting = false; this.driftCharge = 0;
    this.lastT = this.track.project(pos).t;
    this._syncMesh();
  }

  get speedKmh() { return Math.max(0, Math.round(Math.abs(this.speed) * 3.6)); }

  // ---------- PLAYER UPDATE ----------
  updatePlayer(dt, input, audio) {
    if (this.finished) { this._coast(dt); this._updateProgress(); return; }

    const fwd = input.up, back = input.down;
    const left = input.left, right = input.right;
    let max = KART.maxSpeed;
    if (this.boostTimer > 0) { max *= KART.boostMult; this.boostTimer -= dt; }
    if (this.hitTimer > 0) { max *= this.slowFactor; this.hitTimer -= dt; }
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // throttle / brake
    if (fwd) this.speed += KART.accel * dt;
    else if (back) {
      if (this.speed > 0.5) this.speed -= KART.brakeForce * dt;
      else this.speed -= KART.accel * 0.6 * dt;
    } else {
      this.speed *= Math.pow(KART.drag, dt * 4);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -KART.reverseSpeed, max);

    // steering — scales with speed; sharper while drifting
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const speed01 = Math.min(1, Math.abs(this.speed) / KART.maxSpeed);
    let turn = KART.turnRate * steerInput * (0.35 + 0.65 * speed01);

    // ---- drift mechanic (Space) ----
    if (input.drift && Math.abs(this.speed) > 18 && steerInput !== 0) {
      if (!this.drifting) { this.drifting = true; this.driftDir = steerInput; this.driftCharge = 0; }
    }
    if (this.drifting) {
      if (!input.drift || Math.abs(this.speed) < 8) {
        // release → reward proportional to charge
        if (this.driftCharge > 0.45) {
          const tier = this.driftCharge > 1.3 ? 1.0 : 0.6;
          this.speed = Math.min(max * KART.boostMult, this.speed + KART.driftBoostSpeed * tier);
          this.boostTimer = Math.max(this.boostTimer, 0.6 * tier + 0.4);
          audio.sfxDriftBoost();
        }
        this.drifting = false; this.driftCharge = 0;
      } else {
        turn = KART.turnRate * this.driftDir * KART.driftTurnBoost * (0.5 + 0.5 * speed01);
        // bias toward steering input so you can tighten/widen the drift
        if (steerInput === this.driftDir) turn *= 1.15;
        else if (steerInput === -this.driftDir) turn *= 0.6;
        this.driftCharge += dt;
        this.lateralVel = THREE.MathUtils.lerp(this.lateralVel, this.driftDir * this.speed * 0.35, dt * 4);
      }
    } else {
      this.lateralVel = THREE.MathUtils.lerp(this.lateralVel, 0, dt * 6);
    }

    if (this.speed < 0) turn = -turn; // reverse steering feels natural
    this.heading += turn * dt;

    this._integrate(dt);
    this._updateProgress();
    this._visualTilt(dt, steerInput);

    if (audio) audio.setEngine(speed01);
  }

  // ---------- AI UPDATE ----------
  updateAI(dt, playerKart, fireProjectile) {
    if (this.finished) {
      // finished AIs pull off to their roadside slot; before a slot is
      // assigned (same frame they cross) they just coast to a halt.
      if (this.parking) this._parkOffTrack(dt);
      else { this._coast(dt); this._updateProgress(); }
      return;
    }

    // look ahead on the track and steer toward it
    const aheadT = (this.lastT + 0.018) % 1;
    const target = this.track.placeAt(aheadT, this._aiLine(), 0);
    const toT = new THREE.Vector3().subVectors(target, this.pos);
    const desired = Math.atan2(toT.x, toT.z);
    let diff = desired - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += THREE.MathUtils.clamp(diff, -KART.turnRate * dt, KART.turnRate * dt);

    // throttle: slow a touch on tight turns
    let max = KART.aiMaxSpeed * (1 - Math.min(0.35, Math.abs(diff)));
    if (this.hitTimer > 0) { max *= this.slowFactor; this.hitTimer -= dt; }
    this.speed = THREE.MathUtils.lerp(this.speed, max, dt * 1.5);

    this._integrate(dt);
    this._updateProgress();

    // occasionally attack the player (if player not invulnerable & ahead-ish)
    this.aiAttackCooldown -= dt;
    if (this.aiAttackCooldown <= 0 && playerKart && !playerKart.invuln && !playerKart.finished) {
      this.aiAttackCooldown = 4 + Math.random() * 4;
      const d = this.pos.distanceTo(playerKart.pos);
      if (d < 70 && d > 6) fireProjectile(this, playerKart);
    }
  }

  // wander between racing lines so AIs don't stack perfectly
  _aiLine() {
    return Math.sin(this.lastT * Math.PI * 6 + this.index * 1.7) * 0.4;
  }

  _coast(dt) {
    this.speed *= Math.pow(0.85, dt * 4);
    this._integrate(dt);
  }

  // Reserve a stationary spectator slot off to the side of the finish line,
  // facing back toward the track. `slot`/`total` lay the finishers out in a
  // tidy row so they don't stack on top of each other.
  parkAsSpectator(slot, total) {
    const t0 = 0;                                   // the start/finish line
    const base = this.track.pointAt(t0);
    const lat = this.track.lateralAt(t0);           // perpendicular to the track
    const tan = this.track.tangentAt(t0);           // along the track
    const side = 1;                                 // pull over to one side
    const offset = this.track.width / 2 + 5;        // clear of the racing surface
    const spacing = 6.5;                            // gap between parked racers
    const along = (slot - (total - 1) / 2) * spacing;
    this.parkPos = base.clone()
      .addScaledVector(lat, side * offset)
      .addScaledVector(tan, along)
      .setY(0);
    // face inward, back toward the track, so they watch the race come in
    const face = lat.clone().multiplyScalar(-side);
    this.parkHeading = Math.atan2(face.x, face.z);
    this.parking = true;
  }

  // Glide to the reserved slot, rotate to face the track, and sit upright.
  _parkOffTrack(dt) {
    this.speed = 0; this.lateralVel = 0; this.bump.set(0, 0, 0);
    this.pos.lerp(this.parkPos, Math.min(1, dt * 2.5));
    this.pos.y = 0;
    let diff = this.parkHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 3);
    this._syncMesh();
    // undo any leftover drift roll so they stand level
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, Math.min(1, dt * 6));
  }

  _integrate(dt) {
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const lat = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.pos.addScaledVector(dir, this.speed * dt);
    this.pos.addScaledVector(lat, this.lateralVel * dt);

    // apply & decay knockback from kart-to-kart collisions (world space)
    if (this.bump.lengthSq() > 1e-4) {
      this.pos.addScaledVector(this.bump, dt);
      this.bump.multiplyScalar(Math.pow(KART.collideDecay, dt));
    } else {
      this.bump.set(0, 0, 0);
    }

    // keep on the road: heavy drag + nudge back when off
    const proj = this.track.project(this.pos);
    const edge = this.track.width / 2;
    if (Math.abs(proj.lateral) > edge) {
      this.speed *= Math.pow(KART.offTrackDrag, dt * 3);
      const overshoot = Math.abs(proj.lateral) - edge;
      const latDir = this.track.lateralAt(proj.t);
      this.pos.addScaledVector(latDir, -Math.sign(proj.lateral) * overshoot * Math.min(1, dt * 8));
    }
    this.pos.y = 0;
    this._syncMesh();
  }

  _visualTilt(dt, steer) {
    const targetRoll = this.drifting ? -this.driftDir * 0.28 : -steer * 0.12;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, dt * 8);
    // tiny bob
    this.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.02)) * 0.04 * (this.speed / KART.maxSpeed);
  }

  _updateProgress() {
    const proj = this.track.project(this.pos);
    let t = proj.t;
    // lap crossing detection (wrap from ~1 to ~0)
    if (this.lastT > 0.8 && t < 0.2) {
      this.lap++;
      if (this.lap >= RACE.totalLaps && !this.finished) {
        this.finished = true;   // finishTime is stamped by the game controller
      }
    } else if (this.lastT < 0.2 && t > 0.8) {
      this.lap = Math.max(0, this.lap - 1); // went backwards over the line
    }
    this.lastT = t;
    this.progress = this.lap + t;
  }

  applyHit() {
    if (this.invuln || this.finished) return false;
    this.speed *= 0.35;
    this.slowFactor = 0.45;
    this.hitTimer = 1.4;
    return true;
  }

  // Slowed by the player's SPACE weapon: cut top speed by `effect` (0..1) for `duration` sec.
  applySlow(duration, effect) {
    if (this.invuln || this.finished) return false;
    this.slowFactor = Math.max(0.05, 1 - effect);
    this.hitTimer = Math.max(this.hitTimer, duration);
    this.speed *= this.slowFactor;      // immediate jolt so the hit feels responsive
    return true;
  }

  giveBoost(sec) { this.boostTimer = Math.max(this.boostTimer, sec); }
}

// ============================================================
//  Kart model builder — chunky bright cartoon base, a seated
//  driver in colorful clothing, and a food "body" emblem.
// ============================================================
// Bright material: a little emissive so the saturated colors stay
// vibrant even on the shadowed side — chunky toy look, no greys.
function brightMat(c, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.18,
    ...opts,
  });
}

function buildKart(racer) {
  const { food, color, shirt = 0x1fa8ff, pants = 0xff7a18 } = racer;
  const g = new THREE.Group();
  const mat = brightMat;

  // chunky bright chassis in the racer's color (rounded by a slim top deck)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 3.2), mat(color));
  chassis.position.y = 0.6;
  g.add(chassis);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 2.4), mat(color));
  deck.position.y = 1.0;
  g.add(deck);
  // dark seat cradle so the driver reads as sitting "in" the kart
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.4), brightMat(0x2a2030, { emissiveIntensity: 0.05 }));
  seat.position.set(0, 1.15, -0.55);
  g.add(seat);

  // chunky wheels with a colored hubcap
  const tireGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.55, 14);
  const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.58, 10);
  for (const [x, z] of [[-1.2, 1.05], [1.2, 1.05], [-1.2, -1.05], [1.2, -1.05]]) {
    const tire = new THREE.Mesh(tireGeo, brightMat(0x1a1a22, { emissiveIntensity: 0.04 }));
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, 0.55, z);
    g.add(tire);
    const hub = new THREE.Mesh(hubGeo, mat(0xffe14d));
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.55, z);
    g.add(hub);
  }

  // food body emblem — sits up front like a hood ornament
  const body = buildFood(food, color, mat);
  body.position.set(0, 1.35, 0.7);
  body.scale.setScalar(0.8);
  g.add(body);

  // seated cartoon driver
  const driver = buildDriver(shirt, pants);
  driver.position.set(0, 1.35, -0.55);
  g.add(driver);

  g.scale.setScalar(1.0);
  return g;
}

// A simple, recognizable cartoon driver: round head, bright torso,
// two stubby arms reaching to a wheel, and colored legs.
function buildDriver(shirt, pants) {
  const d = new THREE.Group();
  const skin = 0xffcd94;

  // legs (pants) poking forward into the footwell
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 1.1), brightMat(pants));
  legs.position.set(0, -0.05, 0.55);
  d.add(legs);

  // torso (shirt/jacket)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 6, 12), brightMat(shirt));
  torso.position.set(0, 0.55, 0);
  d.add(torso);

  // arms reaching forward to grip the wheel
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, brightMat(shirt));
    arm.position.set(side * 0.4, 0.5, 0.45);
    arm.rotation.x = 1.1;
    d.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), brightMat(skin));
    hand.position.set(side * 0.4, 0.45, 0.85);
    d.add(hand);
  }

  // head + simple helmet-ish cap in the shirt color
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), brightMat(skin));
  head.position.set(0, 1.2, -0.02);
  d.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), brightMat(shirt));
  cap.position.set(0, 1.24, -0.02);
  d.add(cap);

  return d;
}

function buildFood(food, color, mat) {
  const f = new THREE.Group();
  switch (food) {
    case 'currywurst': {
      const sausage = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.6, 6, 12), mat(0xc06a2e));
      sausage.rotation.z = Math.PI / 2;
      f.add(sausage);
      const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), mat(0xff3b1e));
      sauce.scale.set(1.2, 0.5, 0.7);
      sauce.position.y = 0.35;
      f.add(sauce);
      break;
    }
    case 'pretzel': {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 10, 20), mat(0x9c5a23));
      torus.rotation.x = Math.PI / 2;
      f.add(torus);
      break;
    }
    case 'doner': {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.4, 14), mat(0xe8c98f));
      wrap.rotation.z = 0.4;
      f.add(wrap);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x6db33f));
      top.position.set(0.1, 0.7, 0);
      f.add(top);
      break;
    }
    case 'beer': {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 16), mat(0xf6c026, { transparent: true, opacity: 0.85 }));
      f.add(mug);
      const foam = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0xfffdf0));
      foam.scale.y = 0.5; foam.position.y = 0.7;
      f.add(foam);
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), mat(color));
      f.add(box);
    }
  }
  // accent glow ring in racer color
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 24), mat(color));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.5;
  f.add(ring);
  return f;
}
