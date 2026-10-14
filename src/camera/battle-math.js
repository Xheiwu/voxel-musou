// Pure numerical helpers. Angles are radians; no renderer/simulation dependency.
export const BATTLE_CAMERA = Object.freeze({ pitch:35*Math.PI/180, distance:9.6, height:1.0, fov:46 });
export function battleDistance(aspect) {
  // Portrait is a fallback: pull back a little, never zoom infinitely at a narrow resize.
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16/9;
  return BATTLE_CAMERA.distance * Math.max(1, Math.min(1.45, 1.25/a));
}
export function boomOffset(yaw, tilt, distance) {
  const pitch = Math.max(24*Math.PI/180, Math.min(48*Math.PI/180, BATTLE_CAMERA.pitch+(tilt||0)*0.6));
  return [-Math.sin(yaw)*Math.cos(pitch)*distance, Math.sin(pitch)*distance, -Math.cos(yaw)*Math.cos(pitch)*distance];
}
