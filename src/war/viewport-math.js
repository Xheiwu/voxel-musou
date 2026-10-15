/** Logical battlefield size is always landscape width:height = 20:9. CSS pixels, not DPR. */
export const WAR_ASPECT = 20 / 9;
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
export function fitLandscape(width, height, inset = {}) {
  width = Math.max(1, finite(width, 1)); height = Math.max(1, finite(height, 1));
  const left = Math.min(width - 1, Math.max(0, finite(inset.left)));
  const right = Math.min(width - left - 1, Math.max(0, finite(inset.right)));
  const top = Math.min(height - 1, Math.max(0, finite(inset.top)));
  const bottom = Math.min(height - top - 1, Math.max(0, finite(inset.bottom)));
  const aw = width - left - right, ah = height - top - bottom;
  const w = Math.min(aw, ah * WAR_ASPECT), h = w / WAR_ASPECT;
  return { x: left + (aw - w) / 2, y: top + (ah - h) / 2, width: w, height: h };
}
