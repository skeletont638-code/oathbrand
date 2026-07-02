/**
 * First-person player controller.
 *
 * Desktop: WASD/arrows move relative to yaw; pointer-lock mouse look with
 * pitch clamped ±75°; combat (Task 9) on LMB = light, RMB = heavy,
 * Shift (held) = guard, Space = quick-step — mouse buttons only register
 * while pointer-locked; losing pointer lock while playing (Esc) auto-pauses
 * via `Game.transition('paused')`; clicking the canvas (re)locks — and
 * resumes from pause first, so the same click both unpauses and locks.
 *
 * Touch (feature-detected via 'ontouchstart'): left half of the screen is a
 * dynamic virtual stick (appears where the thumb lands), right half is
 * drag-look, plus a fixed context action button bottom-right.
 *
 * All movement routes through `GridCollider.slide` — the controller never
 * writes positions the collider hasn't approved. The per-frame hot path
 * reuses scratch vectors; it allocates nothing of its own.
 */
import { Vector3 } from 'three';
import { TUNING } from '../content/tuning';
import type { Game } from '../engine/Game';
import type { GridCollider, Vec2 } from '../world/collision';
import { clampPitch, moveVector, type InputState } from './movement';

export interface ControllerOptions {
  game: Game;
  /** The renderer's canvas: click-to-lock target and lock owner. */
  canvas: HTMLCanvasElement;
  /** Parent for the touch UI layer. Defaults to document.body. */
  touchParent?: HTMLElement;
}

/** Radians of look per pixel of mouse movement. */
const MOUSE_SENS = 0.0023;
/** Radians of look per pixel of touch drag (thumbs travel less than mice). */
const TOUCH_LOOK_SENS = 0.005;
/** Virtual stick throw radius, px. */
const STICK_RADIUS_PX = 48;

export class Controller {
  /** Player feet position (y stays at floor height; camera adds eye offset). */
  readonly pos = new Vector3();
  /** Radians around +y; 0 faces -z (three.js 'YXZ' euler convention). */
  yaw = 0;
  /** Radians; clamped to ±75°. */
  pitch = 0;
  /** Look sensitivity multiplier over the base radians/px (settings; 1 = default). */
  lookSensitivity = 1;
  /** Invert the vertical look axis (settings). */
  invertY = false;
  readonly input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    stickX: 0,
    stickY: 0,
    interact: false,
    light: false,
    heavy: false,
    guardHeld: false,
    step: false,
  };

  private readonly game: Game;
  private readonly canvas: HTMLCanvasElement;
  // Scratch vectors reused every frame — no per-frame allocations here.
  private readonly dir: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(opts: ControllerOptions) {
    this.game = opts.game;
    this.canvas = opts.canvas;
    this.bindKeyboard();
    this.bindPointerLock();
    this.bindCombatMouse();
    if ('ontouchstart' in window) {
      this.buildTouchUi(opts.touchParent ?? document.body);
    }
  }

  /**
   * Advance one frame (dt in ms, matching Game.update). Movement is
   * resolved against the collider (slide along walls, never through).
   * No-ops unless the game is in the 'playing' state.
   */
  update(dt: number, collider: GridCollider): void {
    if (this.game.state !== 'playing') return;
    moveVector(this.input, this.yaw, this.dir);
    if (this.dir.x === 0 && this.dir.z === 0) return;
    const step = TUNING.player.walkSpeed * (dt / 1000);
    this.dir.x *= step;
    this.dir.z *= step;
    this.from.x = this.pos.x;
    this.from.z = this.pos.z;
    const out = collider.slide(this.from, this.dir, TUNING.player.radius);
    this.pos.x = out.x;
    this.pos.z = out.z;
  }

  /** True if the E key / action button was pressed since last consume. */
  consumeAction(): boolean {
    const pressed = this.input.interact;
    this.input.interact = false;
    return pressed;
  }

  /** True if LMB (light attack) was pressed since last consume. */
  consumeLight(): boolean {
    const pressed = this.input.light;
    this.input.light = false;
    return pressed;
  }

  /** True if RMB (heavy attack) was pressed since last consume. */
  consumeHeavy(): boolean {
    const pressed = this.input.heavy;
    this.input.heavy = false;
    return pressed;
  }

  /** True if Space (quick-step) was pressed since last consume. */
  consumeStep(): boolean {
    const pressed = this.input.step;
    this.input.step = false;
    return pressed;
  }

  // --- desktop input ---------------------------------------------------

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = down;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.back = down;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = down;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = down;
        break;
      case 'KeyE':
        if (down) this.input.interact = true;
        break;
      case 'Space':
        if (down && !e.repeat && this.game.state === 'playing') this.input.step = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.guardHeld = down && this.game.state === 'playing';
        break;
      default:
        return; // unhandled key: leave default behavior alone
    }
    e.preventDefault(); // arrows would scroll the page
  }

  private bindPointerLock(): void {
    this.canvas.addEventListener('click', () => {
      // One click both resumes from pause and (re)acquires the lock.
      if (this.game.state === 'paused') this.game.transition('playing');
      if (this.game.state !== 'playing') return;
      if (document.pointerLockElement === this.canvas) return;
      try {
        // Chrome rejects if re-locking too soon after Esc — the user just
        // clicks again; nothing to do but swallow the error.
        void Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined);
      } catch {
        /* older browsers throw synchronously; same story */
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.game.state === 'playing') {
        this.game.transition('paused');
        this.resetInput(); // no keys stuck down across the pause
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      if (this.game.state !== 'playing') return;
      const s = MOUSE_SENS * this.lookSensitivity;
      this.yaw -= e.movementX * s;
      this.pitch = clampPitch(this.pitch - e.movementY * s * (this.invertY ? -1 : 1));
    });
  }

  /** Combat mouse buttons (Task 9): LMB = light, RMB = heavy. Only while
   * pointer-locked and playing, so the click that (re)locks never swings. */
  private bindCombatMouse(): void {
    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      if (this.game.state !== 'playing') return;
      if (e.button === 0) this.input.light = true;
      else if (e.button === 2) this.input.heavy = true;
    });
    // RMB is an attack, not a browser menu.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private resetInput(): void {
    this.input.forward = false;
    this.input.back = false;
    this.input.left = false;
    this.input.right = false;
    this.input.stickX = 0;
    this.input.stickY = 0;
    this.input.interact = false;
    this.input.light = false;
    this.input.heavy = false;
    this.input.guardHeld = false;
    this.input.step = false;
  }

  // --- touch input -------------------------------------------------------

  private buildTouchUi(parent: HTMLElement): void {
    const base = document.createElement('div');
    base.style.cssText = [
      'position:fixed',
      `width:${STICK_RADIUS_PX * 2}px`,
      `height:${STICK_RADIUS_PX * 2}px`,
      'margin:0',
      'border:2px solid rgba(216,211,196,0.4)',
      'border-radius:50%',
      'background:rgba(20,18,16,0.25)',
      'transform:translate(-50%,-50%)',
      'pointer-events:none',
      'z-index:900',
      'display:none',
    ].join(';');
    const nub = document.createElement('div');
    nub.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'width:38px',
      'height:38px',
      'margin:-19px 0 0 -19px',
      'border-radius:50%',
      'background:rgba(216,211,196,0.55)',
    ].join(';');
    base.appendChild(nub);

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'ACT';
    action.setAttribute('aria-label', 'context action');
    action.style.cssText = [
      'position:fixed',
      'right:26px',
      'bottom:96px',
      'width:74px',
      'height:74px',
      'border-radius:50%',
      'border:2px solid rgba(216,211,196,0.5)',
      'background:rgba(20,18,16,0.45)',
      'color:#d8d3c4',
      'font:700 14px/1 ui-monospace,Menlo,monospace',
      'letter-spacing:0.08em',
      'z-index:900',
      'touch-action:none',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');
    action.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        if (this.game.state === 'playing') this.input.interact = true;
      },
      { passive: false },
    );

    parent.appendChild(base);
    parent.appendChild(action);

    let stickId: number | null = null;
    let stickX0 = 0;
    let stickY0 = 0;
    let lookId: number | null = null;
    let lookX = 0;
    let lookY = 0;

    const endStick = (): void => {
      stickId = null;
      this.input.stickX = 0;
      this.input.stickY = 0;
      base.style.display = 'none';
    };

    window.addEventListener(
      'touchstart',
      (e) => {
        if (e.target === action) return; // button handles itself
        for (const t of Array.from(e.changedTouches)) {
          // Only claim (and SHOW) the virtual stick while actually playing —
          // otherwise the stick base lingers on screen over a pause/menu (T18).
          if (t.clientX < window.innerWidth / 2 && stickId === null && this.game.state === 'playing') {
            stickId = t.identifier;
            stickX0 = t.clientX;
            stickY0 = t.clientY;
            base.style.left = `${t.clientX}px`;
            base.style.top = `${t.clientY}px`;
            base.style.display = 'block';
            nub.style.transform = 'translate(0,0)';
          } else if (t.clientX >= window.innerWidth / 2 && lookId === null) {
            lookId = t.identifier;
            lookX = t.clientX;
            lookY = t.clientY;
          }
        }
        if (stickId !== null || lookId !== null) e.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === stickId) {
            let dx = t.clientX - stickX0;
            let dy = t.clientY - stickY0;
            const len = Math.hypot(dx, dy);
            if (len > STICK_RADIUS_PX) {
              dx = (dx / len) * STICK_RADIUS_PX;
              dy = (dy / len) * STICK_RADIUS_PX;
            }
            nub.style.transform = `translate(${dx}px,${dy}px)`;
            if (this.game.state === 'playing') {
              this.input.stickX = dx / STICK_RADIUS_PX;
              this.input.stickY = dy / STICK_RADIUS_PX;
            }
          } else if (t.identifier === lookId && this.game.state === 'playing') {
            const s = TOUCH_LOOK_SENS * this.lookSensitivity;
            this.yaw -= (t.clientX - lookX) * s;
            this.pitch = clampPitch(this.pitch - (t.clientY - lookY) * s * (this.invertY ? -1 : 1));
            lookX = t.clientX;
            lookY = t.clientY;
          }
        }
        if (stickId !== null || lookId !== null) e.preventDefault();
      },
      { passive: false },
    );

    const onTouchEnd = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) endStick();
        else if (t.identifier === lookId) lookId = null;
      }
    };
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }
}
