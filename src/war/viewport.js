import { fitLandscape } from './viewport-math.js';

let current = null;
/** One rectangle for canvas, camera and all DOM overlays. Original game entries are untouched. */
export function initWarViewport() {
  if (current) return current;
  const root = document.documentElement;
  root.dataset.warLayout = 'landscape';
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const overlay = document.createElement('section');
  overlay.id = 'war-rotate'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'war-rotate-title');
  overlay.innerHTML = '<div class="rotate-card"><span class="rotate-phone" aria-hidden="true"></span><h2 id="war-rotate-title">请横屏进入战场</h2><p>横屏比例 20∶9 · 保持画面与操作比例</p><p>战斗中转回竖屏会暂停，不会继续受伤。</p><button type="button" id="war-rotate-fullscreen">尝试全屏横屏</button><small id="war-rotate-note">也可以关闭手机方向锁定，然后将手机横过来。</small></div>';
  document.body.append(overlay);
  let previousPortrait = false, focusBefore = null, scheduled = 0, suspended = new Map();
  const inertTargets = () => [...document.querySelectorAll('#lobby,#menu,#result,#fatal,#loading,#war-hud,.musou-touch')];
  function syncInert() {
    if (!current?.portrait) return;
    for (const el of inertTargets()) if (!suspended.has(el)) { suspended.set(el, el.inert); el.inert = true; }
  }
  const observer = new MutationObserver(syncInert);
  observer.observe(document.body, { childList: true });
  current = { ...fitLandscape(innerWidth, innerHeight), portrait: false, refresh, fullscreen };
  function refresh() {
    scheduled = 0;
    const vv = window.visualViewport;
    const w = vv?.width || innerWidth, h = vv?.height || innerHeight;
    const style = getComputedStyle(probe), p = key => parseFloat(style[key]) || 0;
    const box = fitLandscape(w, h, { top: p('paddingTop'), right: p('paddingRight'), bottom: p('paddingBottom'), left: p('paddingLeft') });
    box.x += vv?.offsetLeft || 0; box.y += vv?.offsetTop || 0;
    // Layout viewport avoids confusing the on-screen keyboard with a physical rotation.
    const portrait = innerHeight > innerWidth;
    const changed = ['x', 'y', 'width', 'height'].some(k => Math.abs(current[k] - box[k]) > .05) || portrait !== current.portrait;
    Object.assign(current, box, { portrait });
    for (const [key, value] of Object.entries(box)) root.style.setProperty(`--war-${key}`, `${value}px`);
    root.style.setProperty('--war-unit', `${Math.max(.72, Math.min(1.45, box.height / 480))}px`);
    for (const [key, value] of Object.entries({ x: vv?.offsetLeft || 0, y: vv?.offsetTop || 0, width: w, height: h })) root.style.setProperty(`--war-visual-${key}`, `${value}px`);
    root.dataset.warCompact = String(box.height < 520);
    root.dataset.warMicro = String(box.height < 280);
    root.dataset.warTiny = String(box.height < 330);
    root.dataset.warPortrait = String(portrait);
    overlay.hidden = !portrait;
    if (portrait && !previousPortrait) { focusBefore = document.activeElement; syncInert(); overlay.querySelector('button').focus({ preventScroll: true }); }
    if (!portrait && previousPortrait) { for (const [el, was] of suspended) el.inert = was; suspended.clear(); focusBefore?.focus?.({ preventScroll: true }); }
    previousPortrait = portrait;
    if (changed) dispatchEvent(new CustomEvent('war:viewportchange', { detail: { ...box, portrait } }));
    return current;
  }
  function schedule() { if (!scheduled) scheduled = requestAnimationFrame(refresh); }
  async function fullscreen() {
    const note = document.getElementById('war-rotate-note');
    try { if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen(); } catch { /* Browser/embedded WebView may refuse. */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* Manual rotation remains available. */ }
    refresh();
    note.textContent = current.portrait ? '此浏览器未自动横屏，请手动旋转手机；不影响存档。' : '横屏就绪。';
  }
  document.getElementById('war-rotate-fullscreen').addEventListener('click', fullscreen);
  for (const selector of ['#lobby>footer', '.battle-tools']) {
    const host = document.querySelector(selector); if (!host) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'war-fullscreen'; button.textContent = '全屏';
    button.setAttribute('aria-label', '尝试全屏横屏'); button.addEventListener('click', fullscreen); host.append(button);
  }
  addEventListener('resize', schedule); addEventListener('orientationchange', schedule);
  document.addEventListener('fullscreenchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  refresh(); return current;
}
export function getWarViewport() { return current || initWarViewport(); }
/** Pause on rotation, never auto-resume. Clear input on every resize, including browser chrome changes. */
export function bindWarViewport({ resize, pause, resetInput = () => {} }) {
  const update = () => { const v = getWarViewport(); resetInput(); resize(v.width, v.height); if (v.portrait) pause(); };
  addEventListener('war:viewportchange', update); update();
  return () => removeEventListener('war:viewportchange', update);
}
