// Keyboard / mouse / gamepad / touch -> the existing fixed-step action contract.
// No simulation state is changed here. Completed taps stay latched until sample().
import { on } from './events.js';
import { createTouchControls } from '../ui/touch.js';

const ACTIONS = ['attack', 'charge', 'jump', 'dodge', 'musou', 'target'];
const KEYMAP = { KeyJ: 'attack', KeyK: 'charge', Space: 'jump', KeyL: 'dodge',
  ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyI: 'musou', KeyR: 'target' };
const MOVEKEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const PADMAP = { 0: 'jump', 2: 'attack', 3: 'charge', 1: 'musou', 5: 'dodge', 7: 'dodge', 4: 'target', 6: 'target' };
const LOOK = { mouseYaw: 0.0024, mousePitch: 0.0018, keyRate: [0.9, 2.6], keyRamp: 21,
  padYaw: 2.8, padPitch: 1.3, padEase: 0.3, padDead: 0.18 };

export function createInput() {
  const canvas = document.getElementById('c'), menu = document.getElementById('menu');
  const touch = createTouchControls(canvas, menu);
  const dev = { mouse: {}, latch: {}, keys: new Set(), lookX: 0, lookY: 0, pad: {}, keyT: 0, padYaw: 0, padPitch: 0 };
  const out = { mx: 0, my: 0, orbit: 0, tilt: 0, pressed: {}, held: {} };
  let battle = false, unlockT = -1e9, noLock = false, clickLock = false;
  const locked = () => document.pointerLockElement === canvas;
  const live = () => battle && !!menu?.hidden && !document.hidden;
  const ui = e => e.target?.closest?.('button,a,input,textarea,select,[contenteditable="true"],.musou-touch');
  function reset() {
    dev.keys.clear(); dev.lookX = dev.lookY = dev.keyT = dev.padYaw = dev.padPitch = 0;
    for (const a of ACTIONS) { dev.mouse[a] = false; dev.latch[a] = false; }
    touch.reset();
  }
  function lock(click = false) {
    clickLock = click;
    if (touch.enabled || !live() || locked() || noLock || !canvas.requestPointerLock) return;
    try { const p = canvas.requestPointerLock(); p?.catch?.(() => { if (click) noLock = true; }); }
    catch { noLock = true; }
  }
  on('flow', e => {
    battle = e.state === 'battle'; reset();
    if (battle) { noLock = false; lock(); }
    else if (locked()) document.exitPointerLock();
  });
  document.addEventListener('pointerlockerror', () => { if (clickLock) noLock = true; });
  document.addEventListener('pointerlockchange', () => {
    if (locked() || !live()) return;
    unlockT = performance.now(); dispatchEvent(new Event('blur'));
  });
  document.getElementById('go')?.addEventListener('click', () => { noLock = false; setTimeout(() => lock()); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && performance.now() - unlockT < 300) e.stopImmediatePropagation();
  }, true);
  addEventListener('keydown', e => {
    if (e.target?.closest?.('input,textarea,select,[contenteditable="true"]') || !live()) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    dev.keys.add(e.code);
    if (KEYMAP[e.code] && !e.repeat) dev.latch[KEYMAP[e.code]] = true;
  });
  addEventListener('keyup', e => dev.keys.delete(e.code));
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { reset(); if (battle) dispatchEvent(new Event('blur')); }
  });
  if (menu) new MutationObserver(() => { if (!menu.hidden) reset(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || ui(e) || !live()) return;
    if (!touch.enabled && !locked() && !noLock) { lock(true); return; }
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) { dev.mouse[a] = true; dev.latch[a] = true; }
  });
  addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') return;
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) dev.mouse[a] = false;
  });
  addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') reset(); });
  addEventListener('pointermove', e => { if (locked() && live()) { dev.lookX += e.movementX; dev.lookY += e.movementY; } });

  function pollPad(active) {
    let p = null;
    try { p = navigator.getGamepads?.()?.[0] || null; } catch { /* restricted iframe */ }
    const held = {};
    for (const [btn, a] of Object.entries(PADMAP)) {
      const down = !!p?.buttons[btn]?.pressed;
      if (active && down && !dev.pad[btn]) dev.latch[a] = true;
      dev.pad[btn] = down;
      held[a] = !!held[a] || (active && down);
    }
    return { p: active ? p : null, held };
  }
  return {
    sample() {
      const active = live();
      if (!active) reset();
      const { p: pad, held: padHeld } = pollPad(active), t = touch.sample();
      let mx = t.mx, my = t.my, orbit = t.orbit, tilt = t.tilt;
      const keyHeld = {};
      for (const k of dev.keys) {
        const m = MOVEKEYS[k]; if (m) { mx += m[0]; my += m[1]; }
        if (KEYMAP[k]) keyHeld[KEYMAP[k]] = true;
      }
      let wantYaw = 0, wantPitch = 0;
      if (pad) {
        const dz = v => Math.abs(v) < LOOK.padDead ? 0 : v;
        mx += dz(pad.axes[0] || 0); my -= dz(pad.axes[1] || 0);
        const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0, r = Math.hypot(rx, ry);
        if (r > LOOK.padDead) {
          const k = Math.min(1, (r - LOOK.padDead) / (1 - LOOK.padDead)) ** 3 / r;
          wantYaw = -rx * k * LOOK.padYaw; wantPitch = ry * k * LOOK.padPitch;
        }
      }
      dev.padYaw += (wantYaw - dev.padYaw) * LOOK.padEase;
      dev.padPitch += (wantPitch - dev.padPitch) * LOOK.padEase;
      if (!wantYaw && Math.abs(dev.padYaw) < 0.02) dev.padYaw = 0;
      if (!wantPitch && Math.abs(dev.padPitch) < 0.02) dev.padPitch = 0;
      orbit += dev.padYaw / 60; tilt += dev.padPitch / 60;
      const q = Number(dev.keys.has('KeyQ')) - Number(dev.keys.has('KeyE'));
      dev.keyT = q ? dev.keyT + 1 : 0;
      orbit += q * (LOOK.keyRate[0] + (LOOK.keyRate[1] - LOOK.keyRate[0]) * Math.min(1, dev.keyT / LOOK.keyRamp)) / 60;
      orbit -= dev.lookX * LOOK.mouseYaw; tilt += dev.lookY * LOOK.mousePitch; dev.lookX = dev.lookY = 0;
      for (const a of ACTIONS) {
        out.pressed[a] = active && (!!dev.latch[a] || !!t.pressed[a]);
        out.held[a] = active && (!!keyHeld[a] || !!dev.mouse[a] || !!padHeld[a] || !!t.held[a]);
        dev.latch[a] = false;
      }
      const length = Math.hypot(mx, my);
      if (length > 1) { mx /= length; my /= length; }
      out.mx = mx; out.my = my; out.orbit = orbit; out.tilt = tilt;
      return out;
    },
  };
}
