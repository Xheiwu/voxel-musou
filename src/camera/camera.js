// The original rig is preserved byte-for-byte in classic.js. Only the view changes;
// camera-relative movement, target/recenter and all combat simulation stay upstream.
import * as THREE from 'three';
import { createCameraRig as createClassicRig } from './classic.js';
import { on } from '../core/events.js';
import { ground } from '../world/map.js';
import { clearance } from './occlusion.js';
import { BATTLE_CAMERA, battleDistance, boomOffset } from './battle-math.js';
export { createCamSim } from './classic.js';

export function createCameraRig(game, width, height) {
  const classic = createClassicRig(game, width, height), params = new URLSearchParams(location.search);
  const mode = params.get('camera');
  const touch = params.get('touch') === '1' || (params.get('touch') !== '0' && matchMedia('(any-pointer: coarse)').matches);
  const enabled = mode === 'battle' || mode === 'tactical' || (mode !== 'classic' && (touch || params.get('style') === 'ink'));
  if (!enabled) return classic;
  const camera = classic.camera, focus = new THREE.Vector3(), position = new THREE.Vector3();
  const want = new THREE.Vector3(), aim = new THREE.Vector3(), offset = new THREE.Vector3();
  let active = false, reset = true, mix = 0, aspect = width/height, x = 0, z = 0;
  on('flow', e => { active = e.state === 'battle'; if (!active) { mix = 0; reset = true; } });
  on('scenario', () => { reset = true; mix = 0; });
  return {
    camera, focus: classic.focus,
    resize(w,h) { aspect = w/Math.max(1,h); classic.resize(w,h); reset = true; },
    update(dt) {
      classic.update(dt);
      if (!active) return;
      const h = game.hero, step = Math.min(.1, Math.max(0,dt));
      if (Math.hypot(h.x-x,h.z-z)>Math.max(2,40*step)) reset = true;
      x=h.x; z=h.z;
      aim.set(h.x, ground(h.x,h.z)+BATTLE_CAMERA.height+Math.max(0,h.y-.6)*.45, h.z);
      const k = reset ? 1 : 1-Math.exp(-9*step);
      focus.lerp(aim,k);
      const distance=battleDistance(aspect), off=boomOffset(game.cam.yaw,game.cam.tilt,distance);
      offset.set(...off); want.copy(offset).add(focus);
      const c=THREE.MathUtils.clamp(clearance(focus.x,focus.y,focus.z,want.x,want.y,want.z),0,1);
      if(c<1) want.copy(focus).addScaledVector(offset,Math.max(.12,c));
      want.y=Math.max(want.y,ground(want.x,want.z)+.35);
      // Occlusion pulls IN immediately; easing only outward avoids clipping through a wall.
      position.lerp(want,reset || c<1 ? 1 : 1-Math.exp(-7*step));
      reset=false;
      const special=h.state==='musou' || !!game.musou.aimShot?.();
      mix=THREE.MathUtils.damp(mix,special ? 0 : 1,special ? 18 : 7,step);
      if (mix<.001) return;
      camera.position.lerp(position,mix); classic.focus.lerp(focus,mix);
      camera.fov+=(BATTLE_CAMERA.fov-camera.fov)*mix;
      const safe = THREE.MathUtils.clamp(clearance(classic.focus.x,classic.focus.y,classic.focus.z,camera.position.x,camera.position.y,camera.position.z),0,1);
      if(safe<1) camera.position.sub(classic.focus).multiplyScalar(safe).add(classic.focus);
      camera.position.y=Math.max(camera.position.y,ground(camera.position.x,camera.position.z)+.35);
      camera.lookAt(classic.focus); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    },
  };
}
