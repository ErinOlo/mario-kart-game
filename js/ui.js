import { THEMES, THEME_ORDER, RACE } from './config.js';

// ============================================================
//  UI — start screen, HUD, countdown, results. DOM-driven.
// ============================================================
export class UI {
  constructor() {
    this.el = {
      startScreen: document.getElementById('start-screen'),
      themePicker: document.getElementById('theme-picker'),
      startBtn: document.getElementById('start-btn'),
      countdown: document.getElementById('countdown'),
      countdownNum: document.getElementById('countdown-num'),
      hud: document.getElementById('hud'),
      posOrd: document.getElementById('position-ord'),
      lapNum: document.getElementById('lap-num'),
      lapTotal: document.getElementById('lap-total'),
      timer: document.getElementById('timer-display'),
      speedNum: document.getElementById('speed-num'),
      driftFill: document.getElementById('drift-fill'),
      themeDisplay: document.getElementById('theme-display'),
      modeDisplay: document.getElementById('mode-display'),
      powerup: document.getElementById('powerup-display'),
      powerupIcon: document.getElementById('powerup-icon'),
      powerupLabel: document.getElementById('powerup-label'),
      powerupTime: document.getElementById('powerup-time'),
      banner: document.getElementById('center-banner'),
      results: document.getElementById('results-screen'),
      resultsTitle: document.getElementById('results-title'),
      winnerBanner: document.getElementById('winner-banner'),
      resultsBody: document.getElementById('results-body'),
      cumulativeList: document.getElementById('cumulative-list'),
      againBtn: document.getElementById('again-btn'),
      changeThemeBtn: document.getElementById('change-theme-btn'),
      muteMusicBtn: document.getElementById('mute-music-btn'),
      muteSfxBtn: document.getElementById('mute-sfx-btn'),
    };
    this.selectedTheme = 'berlin';
    this.el.lapTotal.textContent = RACE.totalLaps;
    this._buildThemePicker();
    this._bannerTimer = 0;
  }

  _buildThemePicker() {
    this.el.themePicker.innerHTML = '';
    for (const key of THEME_ORDER) {
      const th = THEMES[key];
      const card = document.createElement('div');
      card.className = 'theme-card' + (key === this.selectedTheme ? ' selected' : '');
      card.innerHTML = `${th.name}<small>${th.blurb}</small>`;
      card.onclick = () => {
        this.selectedTheme = key;
        this._buildThemePicker();
      };
      this.el.themePicker.appendChild(card);
    }
  }

  onStart(cb) { this.el.startBtn.onclick = cb; }
  onAgain(cb) { this.el.againBtn.onclick = cb; }
  onChangeTheme(cb) { this.el.changeThemeBtn.onclick = cb; }
  onToggleMusic(cb) { this.el.muteMusicBtn.onclick = cb; }
  onToggleSfx(cb) { this.el.muteSfxBtn.onclick = cb; }

  // render the mute buttons to reflect current state (icon + label + colour)
  setMusicButton(muted) {
    const b = this.el.muteMusicBtn;
    b.textContent = muted ? '🔇 Music: Off' : '🎵 Music: On';
    b.classList.toggle('muted', muted);
    b.setAttribute('aria-pressed', String(muted));
  }
  setSfxButton(muted) {
    const b = this.el.muteSfxBtn;
    b.textContent = muted ? '🔇 SFX: Off' : '🔊 SFX: On';
    b.classList.toggle('muted', muted);
    b.setAttribute('aria-pressed', String(muted));
  }
  setAudioState(musicMuted, sfxMuted) {
    this.setMusicButton(musicMuted);
    this.setSfxButton(sfxMuted);
  }

  showStart() {
    this.el.startScreen.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.results.classList.add('hidden');
    this.el.countdown.classList.add('hidden');
  }

  // hide every menu/overlay so a fresh race can begin (Start AND Play Again paths)
  hideStart() {
    this.el.startScreen.classList.add('hidden');
    this.el.results.classList.add('hidden');
  }

  async countdown(audio) {
    this.el.countdown.classList.remove('hidden');
    for (const n of ['3', '2', '1', 'GO!']) {
      this.el.countdownNum.textContent = n;
      // retrigger pop animation
      const node = this.el.countdownNum;
      node.style.animation = 'none'; node.offsetHeight; node.style.animation = '';
      audio.sfxCountdown(n === 'GO!');
      await wait(n === 'GO!' ? 600 : 800);
    }
    this.el.countdown.classList.add('hidden');
  }

  showHUD() { this.el.hud.classList.remove('hidden'); }

  updateHUD(state) {
    this.el.posOrd.textContent = ordinal(state.position);
    this.el.lapNum.textContent = Math.min(RACE.totalLaps, state.lap + 1);
    this.el.timer.textContent = formatTime(state.timeLeft);
    this.el.timer.classList.toggle('urgent', state.timeLeft <= 15);
    this.el.speedNum.textContent = state.speed;
    this.el.driftFill.style.width = Math.min(100, state.driftCharge * 70) + '%';
    this.el.themeDisplay.firstChild.textContent = THEMES[state.theme].name + ' · ';
    this.el.modeDisplay.textContent = state.mode.toUpperCase();

    if (state.powerup) {
      this.el.powerup.classList.remove('hidden');
      this.el.powerupIcon.textContent = state.powerup.icon;
      this.el.powerupLabel.textContent = state.powerup.label;
      this.el.powerupTime.textContent = state.powerup.time.toFixed(1);
    } else {
      this.el.powerup.classList.add('hidden');
    }
  }

  banner(text, ms = 1500) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('hidden');
    this.el.banner.style.animation = 'none'; this.el.banner.offsetHeight; this.el.banner.style.animation = '';
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.el.banner.classList.add('hidden'), ms);
  }

  showResults(results, cumulative) {
    this.el.hud.classList.add('hidden');
    this.el.results.classList.remove('hidden');
    const winner = results[0];
    this.el.winnerBanner.textContent = winner.player
      ? `🏆 YOU WIN! +${winner.points} pts`
      : `🏁 ${winner.name} takes the win`;

    this.el.resultsBody.innerHTML = '';
    results.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.player) tr.className = 'you';
      const timeOrLaps = r.finishTime != null
        ? formatTime(r.finishTime)
        : `${r.laps} laps`;
      tr.innerHTML = `
        <td class="rank">${medal(i + 1)}</td>
        <td>${r.name}</td>
        <td>${timeOrLaps}</td>
        <td>${r.points}</td>`;
      this.el.resultsBody.appendChild(tr);
    });

    this.el.cumulativeList.innerHTML = cumulative
      .map((c) => `${c.name}: ${c.total} pts`).join(' &nbsp;·&nbsp; ');
  }
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ordinal(n) { return ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th'; }
function medal(n) { return ['🥇', '🥈', '🥉', '4'][n - 1] || n; }
function formatTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
