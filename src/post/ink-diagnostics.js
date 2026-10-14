import { summarizeFrames } from './ink-policy.js';
// Frame interval statistics are NOT GPU execution-time measurements.
export function createInkDiagnostics(enabled){
  let last=null,next=0,samples=[],panel,text;
  if(enabled){
    panel=document.createElement('details');panel.className='ink-perf';
    panel.style.cssText='position:fixed;z-index:100;left:50%;top:8px;transform:translateX(-50%);max-width:270px;color:#f5edda;background:#182720ed;padding:7px 10px;border-radius:6px;font:12px/1.5 monospace;';
    const summary=document.createElement('summary');summary.textContent='性能检测';
    text=document.createElement('pre');text.style.cssText='margin:6px 0 0;white-space:pre-wrap;font:inherit;';
    panel.append(summary,text);document.body.append(panel);
  }
  return {
    update(now,info,extra,active=true){
      const dt=last===null?0:now-last;last=now;
      if(!enabled)return;
      if(!active||dt>200){samples=[];return;}
      if(dt>0){samples.push(dt);if(samples.length>180)samples.shift();}
      if(now<next)return;next=now+500;
      const s=summarizeFrames(samples);
      const snapshot={...s,calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,...extra};
      window.__inkPerf=Object.freeze(snapshot);
      text.textContent=`帧率 ${s.fps.toFixed(1)} FPS\n帧间隔 中位 ${s.median.toFixed(1)} / P95 ${s.p95.toFixed(1)} ms\n绘制 ${snapshot.calls} 次 / 三角形 ${snapshot.triangles}\n几何 ${snapshot.geometries} / 纹理 ${snapshot.textures}\n${extra.width} × ${extra.height} · ${extra.quality} · ${extra.buffer}\n帧间隔不是 GPU 计时；不代表真机成绩`;
    },
    dispose(){panel?.remove();if(enabled)delete window.__inkPerf;},
  };
}
