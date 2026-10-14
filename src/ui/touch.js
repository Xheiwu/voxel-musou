// Touch is an input adapter; multiple pointer IDs support movement + combat + look.
import { on } from '../core/events.js';
import { ACTIONS, createAttackRepeater, prioritizeActions } from '../core/action-intent.js';

export function createTouchControls(canvas, menu) {
  const params = new URLSearchParams(location.search);
  const enabled = params.get('touch') === '1' ||
    (params.get('touch') !== '0' && matchMedia('(any-pointer: coarse)').matches);
  const out = { mx: 0, my: 0, orbit: 0, tilt: 0, held: {}, pressed: {} };
  if (!enabled) return { enabled, sample: () => out, reset() {} };
  document.documentElement.classList.add('musou-touch-device');
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./touch.css', import.meta.url).href;
  document.head.append(css);
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ', viewport-fit=cover';
  const root = document.createElement('div');
  root.className = 'musou-touch'; root.hidden = true;
  root.setAttribute('aria-label', '战斗触屏控制');
  root.innerHTML = `<div class="mt-stick" aria-label="移动摇杆"><i></i></div>
    <div class="mt-actions">
      <button type="button" data-action="jump" aria-label="跳跃">跃</button>
      <button type="button" data-action="musou" aria-label="释放无双">无双</button>
      <button type="button" data-action="charge" aria-label="重击，衔接普攻可派生招式">重击</button>
      <button type="button" data-action="target" aria-label="镜头回正或锁定敌将">回正</button>
      <button type="button" data-action="dodge" aria-label="闪避">闪避</button>
      <button type="button" data-action="attack" aria-label="普通攻击，按住连击">攻击</button>
    </div>
    <button class="mt-pause" type="button" aria-label="暂停战斗">暂停</button>
    <span class="mt-rotate">横屏体验更佳</span>`;
  document.body.append(root);
  const stick = root.querySelector('.mt-stick'), thumb = stick.querySelector('i');
  const actions = new Map(), held = {}, latch = {}, repeater = createAttackRepeater();
  let battle = false, moveId = null, lookId = null;
  let mx = 0, my = 0, lookX = 0, lookY = 0, lastX = 0, lastY = 0;
  const live = () => battle && !!menu?.hidden && !document.hidden;
  const capture = (el, id) => { try { el.setPointerCapture(id); } catch { /* cancelled pointer */ } };
  function reset() {
    actions.clear(); moveId = lookId = null; mx = my = lookX = lookY = 0;
    repeater.reset();
    for (const a of ACTIONS) { held[a] = false; latch[a] = false; }
    root.querySelectorAll('.down').forEach(el => el.classList.remove('down'));
    thumb.style.transform = 'translate(0px, 0px)';
  }
  function sync() { root.hidden = !live(); if (!live()) reset(); }
  on('flow', e => { battle = e.state === 'battle'; sync(); });
  if (menu) new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', sync);
  addEventListener('resize', reset);
  root.querySelector('.mt-pause').addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); reset(); dispatchEvent(new Event('blur'));
  });
  function move(e) {
    const r = stick.getBoundingClientRect(), radius = r.width * 0.35;
    const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const length = Math.hypot(dx, dy), distance = Math.min(1, length / radius);
    const strength = Math.max(0, (distance - 0.13) / 0.87);
    mx = length ? dx / length * strength : 0; my = length ? -dy / length * strength : 0;
    const k = length ? Math.min(1, radius / length) : 0;
    thumb.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  stick.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!live() || moveId !== null) return;
    moveId = e.pointerId; capture(stick, moveId); move(e);
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId === moveId && live()) { e.preventDefault(); move(e); }
  });
  const releaseMove = e => {
    if (e.pointerId !== moveId) return;
    moveId = null; mx = my = 0; thumb.style.transform = 'translate(0px, 0px)';
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, releaseMove);
  for (const button of root.querySelectorAll('[data-action]')) {
    const a = button.dataset.action;
    button.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (!live()) return;
      actions.set(e.pointerId, a); held[a] = true; latch[a] = true; repeater.press(a);
      // A completed earlier ordinary tap must not overwrite a new explicit heavy input.
      prioritizeActions(latch);
      button.classList.add('down'); capture(button, e.pointerId);
    });
    const release = e => {
      if (!actions.has(e.pointerId)) return;
      actions.delete(e.pointerId);
      held[a] = [...actions.values()].includes(a);
      button.classList.toggle('down', held[a]);
      if (e.type === 'pointercancel') latch[a] = false;
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !live() || lookId !== null) return;
    e.preventDefault(); lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
    capture(canvas, lookId);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId || !live()) return;
    e.preventDefault(); lookX += e.clientX - lastX; lookY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  const releaseLook = e => {
    if (e.pointerId !== lookId) return;
    lookId = null; if (e.type === 'pointercancel') lookX = lookY = 0;
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, releaseLook);
  return {
    enabled, reset,
    sample() {
      if (!live()) reset();
      out.mx = mx; out.my = my;
      out.orbit = Math.max(-0.18, Math.min(0.18, -lookX * 0.004));
      out.tilt = Math.max(-0.12, Math.min(0.12, lookY * 0.003)); lookX = lookY = 0;
      if (repeater.sample(held, latch)) latch.attack = true;
      prioritizeActions(latch);
      for (const a of ACTIONS) { out.held[a] = !!held[a]; out.pressed[a] = !!latch[a]; latch[a] = false; }
      return out;
    },
  };
}
