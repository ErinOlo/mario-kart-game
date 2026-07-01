// ============================================================
//  Keyboard input — WASD + arrows, Shift to drift, Space to shoot.
// ============================================================
export class Input {
  constructor() {
    this.state = { up: false, down: false, left: false, right: false, drift: false, shoot: false };
    this._onKey = this._onKey.bind(this);
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    // release everything if the tab loses focus
    window.addEventListener('blur', () => {
      for (const k in this.state) this.state[k] = false;
    });
  }

  _onKey(e, down) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.up = down; break;
      case 'KeyS': case 'ArrowDown': this.state.down = down; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = down; break;
      case 'KeyD': case 'ArrowRight': this.state.right = down; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.drift = down; break;
      case 'Space': this.state.shoot = down; break;
      default: return;
    }
    // stop the page from scrolling on arrows/space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
}
