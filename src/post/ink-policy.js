// Pure rendering policy: never alters enemy counts, simulation speed or hit detection.
export function inkOptions(params,coarse=false) {
  const touch=params.get('touch');
  const mobile=touch==='1'||(touch!=='0'&&coarse);
  const requested=params.get('quality'), quality=['low','medium','high'].includes(requested)?requested:(mobile?'medium':'high');
  return { mobile,quality,cap:{low:900,medium:1100,high:1600}[quality],shadows:quality!=='low',
    samples:quality==='low'||mobile?0:2,hdr:params.get('hdr')!=='0',pinned:params.has('hq'),debug:params.get('perf')==='1' };
}
export function renderSize(w,h,cap,scale=1) {
  const width=Number.isFinite(w)?Math.max(1,w):1,height=Number.isFinite(h)?Math.max(1,h):1;
  const k=Math.min(1,cap/Math.max(width,height))*Math.max(.62,Math.min(1,scale));
  return [Math.max(1,Math.round(width*k)),Math.max(1,Math.round(height*k))];
}
export function createResolutionBudget(pinned=false) {
  let scale=1,slow=0,ema=16.7,last=null;
  return {
    get scale(){return scale;},
    reset(){slow=0;ema=16.7;last=null;},
    sample(now,active=true){
      const dt=last===null?0:now-last;last=now;
      if(pinned||!active||dt<=0||dt>200){slow=0;ema=16.7;return false;}
      ema+=(dt-ema)*.05;
      slow=ema>26?slow+dt:0;
      if(slow<3000||scale<=.62)return false;
      scale=Math.max(.62,scale*.85);slow=0;ema=16.7;return true;
    },
  };
}
export function summarizeFrames(values){
  if(!values.length)return {median:0,p95:0,fps:0};
  const a=[...values].sort((x,y)=>x-y),median=a[Math.floor(a.length/2)];
  return {median,p95:a[Math.max(0,Math.ceil(a.length*.95)-1)],fps:1000/(a.reduce((x,y)=>x+y,0)/a.length)};
}
