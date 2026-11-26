// input.js - Boarded Up keyboard and pointer-lock mouse input
// Author: Reachnid Group
// Centennial College - Fall 2026

// Keyboard + pointer-lock mouse input, sampled once per frame via consume().

const KEYMAP = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowLeft: 'turnL',
  ArrowRight: 'turnR',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyE: 'interact',
  KeyR: 'reload',
  KeyV: 'melee',
  KeyF: 'melee',
  KeyQ: 'swap',
  Digit1: 'slot0',
  Digit2: 'slot1',
};

export class Input {
  constructor(element) {
    this.el = element;
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.fireHeld = false;
    this.firePressed = false;
    this.aimHeld = false;
    this.wheel = 0;
    this.sensitivity = 0.0022;
    this.enabled = false;

    this.onKeyDown = (e) => {
      const a = KEYMAP[e.code];
      if (!a || !this.enabled) return;
      e.preventDefault();
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
    };
    this.onKeyUp = (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    };
    this.onMouseMove = (e) => {
      if (this.enabled && document.pointerLockElement === this.el) this.mouseDX += e.movementX || 0;
    };
    this.onMouseDown = (e) => {
      if (!this.enabled) return;
      if (e.button === 2) {
        e.preventDefault();
        this.aimHeld = true;
        return;
      }
      if (e.button !== 0) return;
      this.fireHeld = true;
      this.firePressed = true;
    };
    this.onMouseUp = (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.aimHeld = false;
    };
    this.onContextMenu = (e) => e.preventDefault();
    this.onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    };
    this.onBlur = () => this.clear();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('mousedown', this.onMouseDown);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.mouseDX = 0;
    this.fireHeld = false;
    this.firePressed = false;
    this.aimHeld = false;
    this.wheel = 0;
  }

  consume(dt) {
    const h = this.held,
      p = this.pressed;
    const keyTurn = ((h.has('turnR') ? 1 : 0) - (h.has('turnL') ? 1 : 0)) * 2.6 * dt;
    const out = {
      moveY: (h.has('fwd') ? 1 : 0) - (h.has('back') ? 1 : 0),
      moveX: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
      turn: this.mouseDX * this.sensitivity + keyTurn,
      sprint: h.has('sprint'),
      fireHeld: this.fireHeld,
      firePressed: this.firePressed,
      aimHeld: this.aimHeld,
      reloadPressed: p.has('reload'),
      interactHeld: h.has('interact'),
      interactPressed: p.has('interact'),
      meleePressed: p.has('melee'),
      swapPressed: p.has('swap') || this.wheel !== 0,
      slot: p.has('slot0') ? 0 : p.has('slot1') ? 1 : -1,
    };
    p.clear();
    this.mouseDX = 0;
    this.firePressed = false;
    this.wheel = 0;
    return out;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('mousedown', this.onMouseDown);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
  }
}
