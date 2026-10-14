import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,INTENT_STEPS,createAttackRepeater,prioritizeActions} from '../src/core/action-intent.js';
import {inkOptions,renderSize,createResolutionBudget,summarizeFrames} from '../src/post/ink-policy.js';
import {battleDistance,boomOffset,BATTLE_CAMERA} from '../src/camera/battle-math.js';
import {meshData,inkHeroParts} from '../src/chars/zhaoyun/ink-geometry.js';

test('explicit heavy/dodge/musou beats same-step ordinary input',()=>{
 for(const a of ['charge','dodge','musou']){const p={attack:true,[a]:true};prioritizeActions(p);assert.equal(p.attack,false);assert.equal(p[a],true);}
 assert.equal(prioritizeActions({attack:true,jump:true}).attack,true);
});
test('held attack repeats after twelve fixed samples, no wall-clock dependency',()=>{
 const r=createAttackRepeater();r.press('attack');for(let i=0;i<11;i++)assert.equal(r.sample({attack:true},{}),false);
 assert.equal(r.sample({attack:true},{}),true);
});
test('quick heavy tap protects the whole queued combo branch',()=>{
 const r=createAttackRepeater();r.press('attack');for(let i=0;i<11;i++)r.sample({attack:true},{});
 r.press('charge');assert.equal(r.sample({attack:true},{charge:true}),false);
 for(let i=1;i<INTENT_STEPS;i++)assert.equal(r.sample({attack:true},{}),false);
 for(let i=0;i<11;i++)assert.equal(r.sample({attack:true},{}),false);
 assert.equal(r.sample({attack:true},{}),true);
});
test('a deliberate new ordinary press cancels automatic repeat guard',()=>{
 const r=createAttackRepeater();r.press('charge');r.press('attack');for(let i=0;i<11;i++)r.sample({attack:true},{});
 assert.equal(r.sample({attack:true},{}),true);
});
test('paused/reset controller never carries a stale repeat',()=>{
 const r=createAttackRepeater();r.press('charge');r.reset();for(let i=0;i<11;i++)r.sample({attack:true},{});
 assert.equal(r.sample({attack:true},{}),true);
});
test('held heavy cannot auto-repeat ordinary attacks',()=>{
 const r=createAttackRepeater();for(let i=0;i<200;i++)assert.equal(r.sample({attack:true,charge:true},{}),false);
});
test('quality validation and touch override agree',()=>{
 assert.equal(inkOptions(new URLSearchParams('quality=typo'),true).quality,'medium');
 assert.equal(inkOptions(new URLSearchParams('touch=0'),true).mobile,false);
 assert.equal(inkOptions(new URLSearchParams('touch=1'),false).mobile,true);
 assert.equal(inkOptions(new URLSearchParams('hdr=0')).hdr,false);
 assert.equal(inkOptions(new URLSearchParams('hq')).pinned,true);
});
test('render size caps resolution and handles invalid viewport dimensions',()=>{
 assert.deepEqual(renderSize(3840,2160,1600),[1600,900]);
 assert.deepEqual(renderSize(0,0,900),[1,1]);
 assert.deepEqual(renderSize(NaN,Infinity,900),[1,1]);
 assert.deepEqual(renderSize(1000,500,1600,.5),[620,310]);
});
test('sustained slowness reduces rendering only after timed threshold',()=>{
 const q=createResolutionBudget();let now=0;for(let i=0;i<60;i++){now+=40;q.sample(now);}assert.equal(q.scale,1);
 for(let i=0;i<50;i++){now+=40;q.sample(now);}assert.ok(q.scale<1);
});
test('hidden/stalled frames do not cause quality collapse',()=>{
 const q=createResolutionBudget();for(let i=0;i<1000;i++)q.sample(i*1000,false);assert.equal(q.scale,1);
 for(let i=1000;i<1100;i++)q.sample(i*1000);assert.equal(q.scale,1);
});
test('quality floor and pinned mode hold',()=>{
 const q=createResolutionBudget(),pin=createResolutionBudget(true);for(let i=0;i<10000;i++){q.sample(i*40);pin.sample(i*40);}
 assert.equal(q.scale,.62);assert.equal(pin.scale,1);
});
test('frame statistics use an upper percentile, not maximum',()=>{
 const s=summarizeFrames(Array.from({length:100},(_,i)=>i+1));assert.equal(s.p95,95);assert.equal(s.median,51);
 assert.deepEqual(summarizeFrames([]),{median:0,p95:0,fps:0});
});
test('battle camera pitch/distance stay bounded across orientations',()=>{
 assert.equal(BATTLE_CAMERA.pitch,35*Math.PI/180);assert.equal(battleDistance(16/9),9.6);
 assert.ok(battleDistance(.1)<=9.6*1.45);assert.equal(battleDistance(NaN),9.6);
 for(const tilt of [-1,0,1])for(const yaw of [-Math.PI,0,Math.PI/2]){
  const p=boomOffset(yaw,tilt,9.6);assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...p)-9.6)<1e-8);assert.ok(p[1]>0);
 }
});
test('hero uses only existing joints plus pauldron helper joints and weapon meshes',()=>{
 const valid=['hips','spine','chest','neck','head','spear','collar','blade',...['L','R'].flatMap(s=>['upperArm','foreArm','hand','thigh','shin','foot','pauldron'].map(x=>x+s))];
 assert.deepEqual(Object.keys(inkHeroParts()).sort(),valid.sort());
});
test('hero geometry has finite unit normals and bounded triangle budget',()=>{
 let triangles=0;
 for(const [name,parts] of Object.entries(inkHeroParts())){
  const g=meshData(parts);assert.ok(g.position.length>0,name);assert.equal(g.position.length%9,0);
  assert.equal(g.position.length,g.normal.length);assert.equal(g.color.length,g.position.length);
  assert.ok(g.position.every(Number.isFinite));assert.ok(g.color.every(v=>v>=0&&v<=1));
  for(let i=0;i<g.normal.length;i+=3)assert.ok(Math.abs(Math.hypot(...g.normal.slice(i,i+3))-1)<1e-6);
  triangles+=g.position.length/9;
 }
 assert.ok(triangles<3000,`body triangles ${triangles}`);
});
test('new spear tip exactly matches existing 2.18 trail endpoint',()=>{
 const g=meshData(inkHeroParts().blade),z=g.position.filter((_,i)=>i%3===2);
 assert.equal(Math.max(...z),2.18);assert.ok(Math.min(...z)>=1.78);
});
test('tapered mesh side normals point outward and cap normals point up/down',()=>{
 const g=meshData([{rings:[[0,1,1],[1,1,1]],c:0xffffff}],8);
 for(let i=0;i<g.position.length;i+=9){
  const p=g.position.slice(i,i+3),n=g.normal.slice(i,i+3);
  if(Math.abs(n[1])<.5)assert.ok(p[0]*n[0]+p[2]*n[2]>0);
  else assert.ok(p[1]===0?n[1]<0:n[1]>0);
 }
});
test('original six action names remain compatible',()=>assert.deepEqual(ACTIONS,['attack','charge','jump','dodge','musou','target']));
