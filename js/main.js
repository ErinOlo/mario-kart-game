import * as THREE from 'three';
import { RACE, RACERS, THEMES, KART, WEAPON } from './config.js';
import { Track } from './track.js';
import { Environment } from './environment.js';
import { Pickups } from './powerups.js';
import { Kart } from './kart.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

// ============================================================
//  Vinted Kart — main game controller & loop.
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 20, -30);

    // lights
    this.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.position.set(60, 120, 40);
    this.scene.add(this.ambient, this.sun);

    // ground
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x6fae54 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.scene.add(this.ground);

    // world objects
    this.track = new Track(this.scene);
    this.environment = new Environment(this.scene, this.track);
    this.pickups = new Pickups(this.scene, this.track);
    this.karts = RACERS.map((r, i) => new Kart(this.scene, this.track, r, i));
    this.player = this.karts.find((k) => k.isPlayer);

    this.input = new Input();
    this.ui = new UI();

    // state
    this.state = 'menu';   // menu | countdown | racing | results
    this.theme = 'berlin';
    this.mode = 'good';
    this.timeLeft = RACE.durationSec;
    this.slowMoTimer = 0;
    this.cameraTarget = new THREE.Vector3();
    this.clock = new THREE.Clock();
    this.particles = [];

    this._bindUI();
    this._applyTheme('berlin', 'good', true);

    window.addEventListener('resize', () => this._resize());
    // first interaction unlocks audio
    const unlock = () => { Audio.init(); Audio.resume(); document.getElementById('audio-note').classList.add('hidden'); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.getElementById('audio-note').classList.remove('hidden');

    this.ui.showStart();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _bindUI() {
    this.ui.onStart(() => this._startRace(this.ui.selectedTheme));
    this.ui.onAgain(() => this._startRace(this.theme));
    this.ui.onChangeTheme(() => { this.state = 'menu'; this.ui.showStart(); });
  }

  // ---------- race lifecycle ----------
  async _startRace(theme) {
    this.ui.hideStart();
    this.theme = theme;
    this.mode = 'good';
    this.timeLeft = RACE.durationSec;
    this.slowMoTimer = 0;
    this._clearParticles();
    this.pickups.resetAll();
    this.karts.forEach((k) => k.reset());
    this._applyTheme(theme, 'good', true);
    this._positionCameraBehindPlayer(true);

    Audio.init();
    Audio.setMusicMode('good');

    this.state = 'countdown';
    await this.ui.countdown(Audio);
    Audio.startEngine();
    Audio.startMusic();
    this.ui.showHUD();
    this.state = 'racing';
    this.clock.getDelta(); // flush accumulated time during countdown
  }

  _endRace() {
    this.state = 'results';
    Audio.stopMusic();
    Audio.stopEngine();
    Audio.setMusicMode('good');
    Audio.sfxFinish();

    const standings = this._standings();
    standings.forEach((r, i) => { r.points = RACE.points[i] || 0; });

    // cumulative career points in localStorage
    const career = this._loadCareer();
    standings.forEach((r) => { career[r.name] = (career[r.name] || 0) + r.points; });
    this._saveCareer(career);
    const cumulative = Object.entries(career)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    this.ui.showResults(standings, cumulative);
  }

  _standings() {
    return this.karts
      .map((k) => ({
        name: k.racer.name,
        player: k.isPlayer,
        finished: k.finished,
        finishTime: k.finished ? k.finishTime : null,
        progress: k.progress,
        laps: Math.min(RACE.totalLaps, Math.floor(k.progress)),
      }))
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      });
  }

  _loadCareer() {
    try { return JSON.parse(localStorage.getItem('collageKartCareer')) || {}; }
    catch (e) { return {}; }
  }
  _saveCareer(c) {
    try { localStorage.setItem('collageKartCareer', JSON.stringify(c)); } catch (e) {}
  }

  // ---------- theme / mode ----------
  _applyTheme(theme, mode, rebuild) {
    this.theme = theme;
    this.mode = mode;
    const pal = THEMES[theme][mode];
    this.scene.background = new THREE.Color(pal.sky);
    this.scene.fog = new THREE.Fog(pal.fog, 120, 520);
    this.ground.material.color.setHex(pal.ground);
    this.track.applyPalette(pal);

    // lighting tone for good/bad
    if (mode === 'bad') { this.ambient.intensity = 0.58; this.sun.intensity = 0.6; this.sun.color.setHex(0x9099aa); }
    else { this.ambient.intensity = 0.75; this.sun.intensity = 1.0; this.sun.color.setHex(0xffffff); }

    if (rebuild) this.environment.build(theme, mode);
  }

  _onThemePortal(theme) {
    this._applyTheme(theme, this.mode, true);
    Audio.sfxWhoosh();
    this.ui.banner(`→ ${THEMES[theme].name}`);
  }
  _onModePortal(mode) {
    this._applyTheme(this.theme, mode, true);
    if (mode === 'good') Audio.sfxModeGood(); else Audio.sfxModeBad();
    Audio.setMusicMode(this.slowMoTimer > 0 ? 'slowmo' : mode);
    this.ui.banner(mode === 'good' ? '🌸🍀✨' : 'You entered the Upside Down 👹 Watch out for... Vecna......', mode === 'good' ? 2000 : 3000);
  }

  // ---------- power-up effects ----------
  _collect(def) {
    switch (def.type) {
      case 'boost':
        this.player.giveBoost(5 + Math.random() * 5);
        Audio.sfxBoost();
        this.ui.banner('SPEED BOOST!', 900);
        this._spawnBurst(0xffd23f);
        break;
      case 'theme':
        this._onThemePortal(def.theme);
        break;
      case 'mode':
        this._onModePortal(def.mode);
        break;
      case 'slowmo': {
        this.slowMoTimer = 15;
        this.player.invuln = true;
        Audio.sfxSlowmo();
        Audio.setMusicMode('slowmo');
        this.pickups.clearProjectiles();
        this.ui.banner('✨ Look around,\nSavour the moment\nTime is slowing\nFor all tournament ✨ ', 3500);

        // 1. full-screen white flash
        let flash = document.getElementById('flash-overlay');
        if (!flash) {
          flash = document.createElement('div');
          flash.id = 'flash-overlay';
          flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999;background:#fff;opacity:0;transition:opacity 0.08s';
          document.body.appendChild(flash);
        }
        flash.style.transition = 'opacity 0.08s';
        flash.style.opacity = '0.85';
        setTimeout(() => {
          flash.style.transition = 'opacity 0.4s';
          flash.style.opacity = '0';
        }, 80);

        // 2. big rainbow particle burst
        const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
        this._spawnBurst(0xffffff, { count: 60, hues, velY: 12, spread: 14, life: 1.8 });

        // 3. hallucinogenic phase for the duration of slow-mo
        if (this.halluciTimer) clearInterval(this.halluciTimer);
        let h = 0;
        this.scene.fog.near = 60;
        this.scene.fog.far = 200;
        this.halluciTimer = setInterval(() => {
          h = (h + 0.07) % 1;
          this.scene.background.setHSL(h, 0.9, 0.55);
          this.scene.fog.color.setHSL((h + 0.5) % 1, 0.9, 0.45);
        }, 400);
        break;
      }
    }
  }

  // ---------- main loop ----------
  _frame() {
    const realDt = Math.min(0.05, this.clock.getDelta());

    if (this.state === 'racing') {
      this._updateRace(realDt);
    } else {
      // idle scenery spin / menu camera drift
      this._idleCamera(realDt);
    }

    this._updateParticles(realDt);
    this.environment.update(realDt);   // spin windmill sails / döner spits
    this.renderer.render(this.scene, this.camera);
  }

  _updateRace(realDt) {
    // slow-motion time scaling affects physics AND the race clock
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= realDt;
      if (this.slowMoTimer <= 0) {
        this.slowMoTimer = 0;
        this.player.invuln = false;
        Audio.setMusicMode(this.mode);
        this.ui.banner('▶ NORMAL SPEED', 800);
        // end hallucinogenic phase — restore theme palette & fog distances
        if (this.halluciTimer) { clearInterval(this.halluciTimer); this.halluciTimer = null; }
        const pal = THEMES[this.theme][this.mode];
        this.scene.background.setHex(pal.sky);
        this.scene.fog.color.setHex(pal.fog);
        this.scene.fog.near = 120;
        this.scene.fog.far = 520;
      }
    }
    const timeScale = this.slowMoTimer > 0 ? 0.4 : 1.0;
    const dt = realDt * timeScale;

    // update karts
    this.player.updatePlayer(dt, this.input.state, Audio);
    for (const k of this.karts) {
      if (k.isPlayer) continue;
      k.updateAI(dt, this.player, (from, to) => this.pickups.fireProjectile(from, to));
    }

    // kart-to-kart bumping (after everyone has moved this frame)
    this._resolveKartCollisions();

    // player weapon — SPACE fires a fast forward shot (cooldown + one-at-a-time)
    if (this.input.state.shoot && this.player.shootCooldown <= 0
        && !this.player.finished && !this.pickups.hasPlayerShot()) {
      this.pickups.firePlayerShot(this.player, WEAPON.projectileSpeed);
      this.player.shootCooldown = WEAPON.cooldown;
      Audio.sfxShoot();
    }

    // pickups & projectiles
    this.pickups.update(dt, this.camera);
    if (this.pickups.checkProjectileHits(this.player)) {
      Audio.sfxHit();
      this._spawnBurst(0x9b59ff);
    }
    // player's shots slowing rival racers
    for (const hitKart of this.pickups.checkPlayerHits(this.karts)) {
      if (hitKart.applySlow(WEAPON.slowdownDuration, WEAPON.slowdownEffect)) {
        Audio.sfxHit();
        this._spawnBurst(0x25d0ff, { origin: hitKart.pos, count: 10, spread: 6 });
      }
    }
    for (const def of this.pickups.checkCollect(this.player)) this._collect(def);

    // boost particle trail
    if (this.player.boostTimer > 0 && Math.random() < 0.6) this._spawnTrail();

    // race clock
    this.timeLeft -= dt;

    // stamp a finish time for any kart that just completed the required laps
    for (const k of this.karts) {
      if (k.finished && k.finishTime == null) k.finishTime = RACE.durationSec - this.timeLeft;
    }

    // race ends when the PLAYER finishes (early finish) or the clock runs out.
    // AI completing their laps does not end the race (they can't beat you to it).
    let raceOver = false;
    if (this.player.finished) raceOver = true;
    if (this.timeLeft <= 0) { this.timeLeft = 0; raceOver = true; }

    // camera + HUD
    this._updateCamera(realDt, timeScale);
    this._updateHUD();
    Audio.setEngine(Math.abs(this.player.speed) / KART.maxSpeed);

    if (raceOver) this._endRace();
  }

  // ---------- kart-to-kart collision ----------
  // Circle-based separation: any two karts closer than 2×collideRadius are
  // pushed apart and given an equal-and-opposite world-space knockback, so
  // racers bump each other instead of overlapping. O(n²) over 4 karts.
  _resolveKartCollisions() {
    const R = KART.collideRadius;
    const minDist = R * 2;
    const karts = this.karts;
    for (let i = 0; i < karts.length; i++) {
      for (let j = i + 1; j < karts.length; j++) {
        const a = karts[i], b = karts[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        let d = Math.hypot(dx, dz);
        if (d >= minDist) continue;               // not touching

        // contact normal a→b (fall back to a fixed axis if perfectly stacked)
        let nx, nz;
        if (d < 1e-4) { nx = 1; nz = 0; d = 1e-4; } else { nx = dx / d; nz = dz / d; }

        // 1. positional separation — split the overlap evenly
        const half = (minDist - d) / 2;
        a.pos.x -= nx * half; a.pos.z -= nz * half;
        b.pos.x += nx * half; b.pos.z += nz * half;
        a._syncMesh(); b._syncMesh();

        // 2. knockback impulse — harder when the pair is moving faster
        const closing = 0.5 + 0.5 * Math.min(1, (Math.abs(a.speed) + Math.abs(b.speed)) / KART.maxSpeed);
        const imp = KART.collideImpulse * closing;
        a.bump.x -= nx * imp; a.bump.z -= nz * imp;
        b.bump.x += nx * imp; b.bump.z += nz * imp;

        // 3. scrub a little forward speed on contact
        a.speed *= KART.collideSpeedKeep;
        b.speed *= KART.collideSpeedKeep;

        // feedback when the player is involved
        if (a.isPlayer || b.isPlayer) {
          Audio.sfxBump?.();
          if (closing > 0.75) this._spawnBurst(0xffffff, { count: 6, spread: 5, velY: 6, life: 0.4 });
        }
      }
    }
  }

  _updateHUD() {
    const standings = this.karts.slice().sort((a, b) => b.progress - a.progress);
    const position = standings.indexOf(this.player) + 1;

    let powerup = null;
    if (this.slowMoTimer > 0) powerup = { icon: '🌿', label: 'RELAX MODE', time: this.slowMoTimer };
    else if (this.player.boostTimer > 0) powerup = { icon: '⚡', label: 'BOOST', time: this.player.boostTimer };

    this.ui.updateHUD({
      position,
      lap: this.player.lap,
      timeLeft: this.timeLeft,
      speed: this.player.speedKmh,
      driftCharge: this.player.driftCharge,
      theme: this.theme,
      mode: this.mode,
      powerup,
    });
  }

  // ---------- camera ----------
  _updateCamera(realDt, timeScale) {
    const k = this.player;
    const back = new THREE.Vector3(-Math.sin(k.heading), 0, -Math.cos(k.heading));
    const zoom = this.slowMoTimer > 0 ? 1.7 : 1.0;  // pull back for slow-mo awareness
    const desired = k.pos.clone()
      .addScaledVector(back, 13 * zoom)
      .add(new THREE.Vector3(0, 7.5 * zoom, 0));
    const lerp = 1 - Math.pow(0.0015, realDt);
    this.camera.position.lerp(desired, lerp);
    this.cameraTarget.lerp(k.pos.clone().add(new THREE.Vector3(0, 2, 0)), lerp);
    this.camera.lookAt(this.cameraTarget);
    // subtle FOV kick on boost
    const targetFov = k.boostTimer > 0 ? 70 : 62;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, realDt * 4);
    this.camera.updateProjectionMatrix();
  }

  _positionCameraBehindPlayer(snap) {
    const k = this.player;
    const back = new THREE.Vector3(-Math.sin(k.heading), 0, -Math.cos(k.heading));
    this.camera.position.copy(k.pos).addScaledVector(back, 13).add(new THREE.Vector3(0, 7.5, 0));
    this.cameraTarget.copy(k.pos);
    this.camera.lookAt(this.cameraTarget);
  }

  _idleCamera(realDt) {
    // gentle orbit over the start line for menu / results
    const t = performance.now() * 0.0002;
    const p = this.player.pos;
    this.camera.position.set(p.x + Math.sin(t) * 22, 12, p.z + Math.cos(t) * 22);
    this.camera.lookAt(p.x, 2, p.z);
  }

  // ---------- particles ----------
  _spawnTrail() {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23f })
    );
    m.position.copy(this.player.pos).setY(0.6);
    this.scene.add(m);
    this.particles.push({ mesh: m, life: 0.5, max: 0.5 });
  }
  _spawnBurst(color, opts = {}) {
    const count = opts.count || 12;
    const velY = opts.velY || 8;
    const spread = opts.spread || 8;
    const life = opts.life || 0.6;
    const hues = opts.hues;
    const origin = opts.origin || this.player.pos;
    for (let i = 0; i < count; i++) {
      const c = hues
        ? new THREE.Color().setHSL(hues[i % hues.length] / 360, 0.9, 0.55)
        : color;
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35),
        new THREE.MeshBasicMaterial({ color: c })
      );
      m.position.copy(origin).setY(1);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(
        Math.cos(a) * Math.random() * spread,
        4 + Math.random() * (velY - 4),
        Math.sin(a) * Math.random() * spread
      );
      this.scene.add(m);
      this.particles.push({ mesh: m, life, max: life, vel: v });
    }
  }
  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      if (p.vel) { p.mesh.position.addScaledVector(p.vel, dt); p.vel.y -= 12 * dt; }
      const s = Math.max(0.01, p.life / p.max);
      p.mesh.scale.setScalar(s);
    }
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); return false; }
      return true;
    });
  }
  _clearParticles() {
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const game = new Game();
// debug/testing handle
window.CollageKart = game;
