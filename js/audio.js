// ============================================================
//  Audio — fully synthesized via Web Audio API (no asset files).
//  Graceful degradation: if AudioContext is unavailable, every
//  method is a no-op so the game still runs silently.
// ============================================================

class AudioEngine {
  constructor() {
    this.ok = false;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.musicTimer = null;
    this.step = 0;
    this.mode = 'good';      // 'good' | 'bad' | 'slowmo'
    this.tempoMs = 250;
  }

  init() {
    if (this.ok) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);

      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
  }

  resume() {
    if (this.ok && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---- one-shot tone helper ----
  _tone(freq, dur, type = 'square', vol = 0.25, when = 0, target = null) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(target || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ============ ENGINE HUM ============
  startEngine() {
    if (!this.ok || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain.gain.value = 0.0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    this.engineOsc.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speed01) {
    if (!this.ok || !this.engineOsc) return;
    const f = 55 + speed01 * 150;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.06 + speed01 * 0.08, this.ctx.currentTime, 0.1);
  }
  stopEngine() {
    if (!this.ok || !this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) {}
    this.engineOsc = null;
  }

  // ============ MUSIC (chiptune player) ============
  startMusic() {
    if (this.musicTimer) return;   // already playing
    this.musicTimer = true;        // sentinel so we don't double-start
    if (window.Chiptune) {
      window.Chiptune.play({ loop: true, volume: 0.7 });
    }
  }
  stopMusic() {
    if (!this.musicTimer) return;
    this.musicTimer = null;
    if (window.Chiptune) window.Chiptune.stop();
  }
  setMusicMode(mode) {
    this.mode = mode;   // retained for future use; chiptune plays the fixed melody
  }
  _musicStep() { /* replaced by chiptune player */ }

  // ============ SOUND EFFECTS ============
  sfxBoost() {            // bright rising chime
    if (!this.ok) return;
    this._tone(660, 0.12, 'square', 0.3);
    this._tone(880, 0.12, 'square', 0.3, 0.08);
    this._tone(1320, 0.18, 'square', 0.28, 0.16);
  }
  sfxWhoosh() {           // theme warp
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.55);
  }
  sfxModeGood() { this._tone(523, 0.12, 'sine', 0.3); this._tone(784, 0.2, 'sine', 0.3, 0.1); }
  sfxModeBad()  { this._tone(196, 0.18, 'sawtooth', 0.3); this._tone(147, 0.28, 'sawtooth', 0.3, 0.12); }
  sfxSlowmo() {           // ethereal descending
    if (!this.ok) return;
    this._tone(880, 0.6, 'sine', 0.22);
    this._tone(587, 0.7, 'sine', 0.22, 0.15);
    this._tone(440, 0.9, 'sine', 0.22, 0.3);
  }
  sfxHit() {              // got attacked
    if (!this.ok) return;
    this._tone(160, 0.18, 'square', 0.3);
    this._tone(110, 0.24, 'square', 0.3, 0.06);
  }
  sfxBump() {             // low, short thud when karts bump
    if (!this.ok) return;
    this._tone(120, 0.08, 'square', 0.22);
    this._tone(90, 0.1, 'square', 0.2, 0.03);
  }
  sfxDriftBoost() { this._tone(440, 0.08, 'square', 0.25); this._tone(990, 0.16, 'square', 0.28, 0.06); }
  sfxCountdown(go = false) {
    if (go) { this._tone(880, 0.4, 'square', 0.35); }
    else { this._tone(440, 0.18, 'square', 0.3); }
  }
  sfxFinish() {
    if (!this.ok) return;
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.3, 'square', 0.3, i * 0.12));
  }
}

export const Audio = new AudioEngine();
