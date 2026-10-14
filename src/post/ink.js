// Ink renderer with a tested policy layer, explicit capability fallback and diagnostics.
import * as THREE from 'three';
import { INK_VERTEX,INK_FRAGMENT } from './ink-shaders.js';
import { inkOptions,renderSize,createResolutionBudget } from './ink-policy.js';
import { createInkDiagnostics } from './ink-diagnostics.js';

export function createInkPost({canvas,width,height}){
  const params=new URLSearchParams(location.search), options=inkOptions(params,matchMedia('(any-pointer: coarse)').matches);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,powerPreference:'high-performance'});}
  catch(error){
    const el=document.createElement('div');el.setAttribute('role','alert');
    el.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;padding:32px;background:#eee9db;color:#252a28;font:18px/1.8 sans-serif;';
    el.textContent='无法启动 3D 画面：当前浏览器或设备未提供 WebGL2。请启用硬件加速，或换用支持 WebGL2 的浏览器。';
    document.body.append(el);throw error;
  }
  renderer.setPixelRatio(1);renderer.shadowMap.enabled=options.shadows;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.info.autoReset=false;
  const gl=renderer.getContext();
  const floatSupported=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float');
  let buffer=options.hdr&&floatSupported?'RGBA16F':'RGBA8',rw=1,rh=1,vw=width,vh=height,lost=false,notice=null;
  const makeTarget=()=>new THREE.WebGLRenderTarget(4,4,{
    type:buffer==='RGBA16F'?THREE.HalfFloatType:THREE.UnsignedByteType,
    samples:options.samples,depthTexture:new THREE.DepthTexture(4,4),
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
  });
  let target=makeTarget();
  const uniforms={tColor:{value:target.texture},tDepth:{value:target.depthTexture},
    uSize:{value:new THREE.Vector2()},uNearFar:{value:new THREE.Vector2(.1,1000)},
    uProjectionInverse:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uFlash:{value:0}};
  const material=new THREE.ShaderMaterial({vertexShader:INK_VERTEX,fragmentShader:INK_FRAGMENT,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
  const composite=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;composite.add(quad);
  const screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const budget=createResolutionBudget(options.pinned),diagnostics=createInkDiagnostics(options.debug);
  function setSize(w,h){vw=w;vh=h;[rw,rh]=renderSize(w,h,options.cap,budget.scale);
    renderer.setSize(rw,rh,false);target.setSize(rw,rh);uniforms.uSize.value.set(rw,rh);}
  setSize(width,height);
  // Probe attachment completeness, not merely texture-format support. Never probe every frame.
  function ensureTarget(){
    renderer.setRenderTarget(target);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){
      target.dispose();buffer='RGBA8';target=makeTarget();target.samples=0;target.setSize(rw,rh);
      uniforms.tColor.value=target.texture;uniforms.tDepth.value=target.depthTexture;
      renderer.setRenderTarget(target);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Ink framebuffer is incomplete, including RGBA8 fallback');
      console.warn('Ink: using non-MSAA RGBA8 framebuffer fallback.');
    }
    renderer.setRenderTarget(null);
  }
  try { ensureTarget(); }
  catch(error) {
    diagnostics.dispose();target.dispose();quad.geometry.dispose();material.dispose();renderer.dispose();
    const el=document.createElement('div');el.setAttribute('role','alert');
    el.style.cssText='position:fixed;inset:0;z-index:2147483647;padding:40px;background:#eee9db;color:#252a28;font:18px/1.8 sans-serif;';
    el.textContent='图形缓冲初始化失败，低画质兼容路径也无法启动。请刷新或更换浏览器。';document.body.append(el);throw error;
  }
  const onLost=e=>{e.preventDefault();lost=true;budget.reset();dispatchEvent(new Event('blur'));
    notice=document.createElement('div');notice.setAttribute('role','status');notice.textContent='图形上下文暂时中断，正在等待恢复…';
    notice.style.cssText='position:fixed;inset:40% 15% auto;z-index:2147483647;padding:20px;background:#eee9db;color:#252a28;font:16px sans-serif;';document.body.append(notice);};
  const onRestored=()=>{
    budget.reset();
    try{setSize(vw,vh);ensureTarget();lost=false;notice?.remove();notice=null;}
    catch(error){lost=true;if(notice)notice.textContent='图形恢复失败，请刷新页面后重试。';console.error(error);}
  };
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
  return {
    setSize,setLook(){},
    async compile(scene,camera){
      if(lost)return;
      const previous=renderer.getRenderTarget();
      try{
        renderer.setRenderTarget(target);const sceneReady=renderer.compileAsync(scene,camera);
        renderer.setRenderTarget(null);const postReady=renderer.compileAsync(composite,screenCamera);
        await Promise.all([sceneReady,postReady]);
      }finally{renderer.setRenderTarget(previous);}
    },
    render(scene,camera,time,focus,flash=0){
      if(lost||document.hidden)return;
      const now=performance.now(),active=document.getElementById('menu')?.hidden!==false;
      if(budget.sample(now,active))setSize(vw,vh);
      renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);
      uniforms.uNearFar.value.set(camera.near,camera.far);uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
      uniforms.uCameraWorld.value.copy(camera.matrixWorld);uniforms.uFlash.value=flash;
      renderer.setRenderTarget(null);renderer.render(composite,screenCamera);
      diagnostics.update(now,renderer.info,{width:rw,height:rh,quality:options.quality,buffer},active);
    },
    dispose(){canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);
      notice?.remove();diagnostics.dispose();target.dispose();quad.geometry.dispose();material.dispose();renderer.dispose();},
  };
}
