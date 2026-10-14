// Deterministic, non-voxel mesh data. +Z faces forward; units match the existing rig.
// Faceted ellipsoids / tapered rings, merged per joint. No texture or model downloads.
const C={ivory:0xcacbbf,light:0xe5e2d5,ink:0x252e30,teal:0x397f79,skin:0xd6bfa3,steel:0xb8c9c6,gold:0xb99b5f};
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const rgb=c=>[linear(((c>>16)&255)/255),linear(((c>>8)&255)/255),linear((c&255)/255)];
export function meshData(parts,segments=10){
  const position=[],normal=[],color=[];
  function tri(a,b,c,col){
    const u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);
    if(len<1e-12)return;
    for(const p of [a,b,c]){position.push(...p);normal.push(...n.map(x=>x/len));color.push(...col);}
  }
  for(const {rings,c,at=[0,0,0],axis='y'} of parts){
    const col=rgb(c),point=(r,i)=>{
      const a=i/segments*Math.PI*2,x=Math.cos(a)*r[1],z=Math.sin(a)*r[2];
      const p=axis==='z'?[x,-z,r[0]]:[x,r[0],z];return p.map((v,k)=>v+at[k]);
    };
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      const a=point(rings[j],i),b=point(rings[j+1],i),d=point(rings[j],i+1),e=point(rings[j+1],i+1);
      tri(a,b,d,col);tri(b,e,d,col);
    }
    for(const [idx,reverse] of [[0,true],[rings.length-1,false]]){
      const ring=rings[idx],center=axis==='z'?[0,0,ring[0]]:[0,ring[0],0],p=center.map((v,k)=>v+at[k]);
      for(let i=0;i<segments;i++){
        const a=point(ring,i),b=point(ring,i+1);
        reverse?tri(p,a,b,col):tri(p,b,a,col);
      }
    }
  }
  return {position,normal,color};
}
const shape=(rings,c,at,axis)=>({rings,c,at,axis});
const oval=(lo,hi,rx,rz,c,at)=>shape([[lo,rx*.5,rz*.5],[lo+(hi-lo)*.23,rx,rz],[lo+(hi-lo)*.76,rx*.94,rz*.94],[hi,rx*.5,rz*.5]],c,at);
export function inkHeroParts(){
  const p={
    hips:[oval(-.13,.075,.165,.115,C.ink),shape([[-.03,.18,.13],[.035,.18,.13]],C.teal)],
    spine:[oval(-.07,.16,.14,.105,C.ivory)],
    chest:[shape([[-.045,.145,.105],[.07,.19,.125],[.21,.205,.13],[.27,.15,.11]],C.ivory),
      oval(.07,.19,.065,.025,C.gold,[0,0,.12]),oval(.095,.17,.042,.025,C.teal,[0,0,.148])],
    neck:[oval(-.015,.075,.055,.05,C.skin)],
    head:[oval(.0,.235,.125,.108,C.skin),shape([[.17,.135,.12],[.24,.14,.12],[.29,.09,.09],[.32,.025,.02]],C.ink),
      shape([[.185,.14,.123],[.215,.14,.123]],C.teal),oval(.12,.142,.025,.013,C.ink,[-.048,0,.098]),oval(.12,.142,.025,.013,C.ink,[.048,0,.098])],
    spear:[shape([[-.72,.017,.017],[1.8,.017,.017]],C.ink,undefined,'z'),shape([[-.02,.024,.024],[.58,.024,.024]],C.teal,undefined,'z')],
    collar:[shape([[1.68,.032,.032],[1.79,.027,.027]],C.gold,undefined,'z')],
    blade:[shape([[1.78,.015,.01],[1.91,.062,.017],[2.03,.04,.011],[2.18,0,0]],C.steel,undefined,'z')],
  };
  for(const s of ['L','R']){
    p['upperArm'+s]=[oval(-.29,.015,.069,.07,C.ink),oval(-.21,-.025,.079,.078,C.ivory)];
    p['foreArm'+s]=[oval(-.27,.01,.067,.065,C.ivory),shape([[-.245,.068,.065],[-.21,.068,.065]],C.teal)];
    p['hand'+s]=[oval(-.047,.047,.045,.05,C.ink)];
    p['thigh'+s]=[oval(-.44,.02,.088,.09,C.ink),oval(-.23,.015,.105,.1,C.ivory)];
    p['shin'+s]=[oval(-.44,.01,.065,.07,C.ink),oval(-.36,-.03,.077,.078,C.ivory)];
    p['foot'+s]=[oval(-.06,.05,.071,.135,C.ink,[0,0,.055])];
    p['pauldron'+s]=[shape([[-.10,.145,.15],[.02,.16,.15],[.09,.08,.1]],C.light),shape([[-.105,.15,.15],[-.07,.15,.15]],C.teal)];
  }
  return p;
}
