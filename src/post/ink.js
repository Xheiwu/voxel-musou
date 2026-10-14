// Lightweight alternative to the upstream cinematic post chain.
// Same public interface: compile / setSize / setLook / render.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { INK_VERTEX, INK_FRAGMENT } from './ink-shaders.js';

export function createInkPost({ canvas, width, height }) {
  const params = new URLSearchParams(location.search);
  const mobile = params.get('touch') === '1' || matchMedia('(any-pointer: coarse)').matches;
  const quality = params.get('quality') || (mobile ? 'medium' : 'high');
  const low = quality === 'low';
  const cap = low ? 900 : quality === 'high' ? 1600 : 1100;
  let scale = 1, viewportWidth = width, viewportHeight = height;
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); // Do not multiply a dense phone display by devicePixelRatio again.
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const target = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType, samples: low || mobile ? 0 : 2,
    depthTexture: new THREE.DepthTexture(4, 4),
  });
  const uniforms = {
    tColor: { value: target.texture }, tDepth: { value: target.depthTexture },
    uSize: { value: new THREE.Vector2() }, uNearFar: { value: new THREE.Vector2(0.1, 1000) },
    uProjectionInverse: { value: new THREE.Matrix4() }, uCameraWorld: { value: new THREE.Matrix4() },
    uFlash: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: INK_VERTEX, fragmentShader: INK_FRAGMENT, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const quad = new FullScreenQuad(material);
  function setSize(w, h) {
    viewportWidth = Math.max(1, w); viewportHeight = Math.max(1, h);
    const k = Math.min(1, cap / Math.max(viewportWidth, viewportHeight)) * scale;
    const rw = Math.max(1, Math.round(viewportWidth * k)), rh = Math.max(1, Math.round(viewportHeight * k));
    renderer.setSize(rw, rh, false); target.setSize(rw, rh); uniforms.uSize.value.set(rw, rh);
  }
  setSize(width, height);
  let last = 0, ema = 16.7, slow = 0;
  function autoQuality(now) {
    const dt = last ? now - last : 16.7; last = now;
    if (params.has('hq') || dt > 200) { slow = 0; return; }
    ema += (dt - ema) * 0.04;
    slow = ema > 26 ? slow + 1 : 0;
    if (slow >= 180 && scale > 0.62) {
      scale = Math.max(0.62, scale * 0.85); slow = 0; ema = 16.7;
      setSize(viewportWidth, viewportHeight);
    }
  }
  return {
    setSize,
    // Deliberately keep one coherent ink palette across maps; simulation/map lighting is untouched.
    setLook() {},
    compile(scene, camera) {
      renderer.setRenderTarget(target);
      try { return renderer.compileAsync(scene, camera); }
      finally { renderer.setRenderTarget(null); }
    },
    render(scene, camera, time, focus, flash = 0) {
      autoQuality(performance.now());
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      uniforms.uNearFar.value.set(camera.near, camera.far);
      uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
      uniforms.uCameraWorld.value.copy(camera.matrixWorld);
      uniforms.uFlash.value = flash;
      renderer.setRenderTarget(null); quad.render(renderer);
    },
  };
}
