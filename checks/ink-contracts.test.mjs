// Contract mocks only. These tests do NOT compile GLSL or measure GPU performance.
// Run: node --experimental-vm-modules --test checks/ink-contracts.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
class V{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z=0){Object.assign(this,{x,y,z});return this;}copy(v){return this.set(v.x,v.y,v.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){return this.addScaledVector(v,-1);}multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}addScaledVector(v,k){this.x+=v.x*k;this.y+=v.y*k;this.z+=v.z*k;return this;}lerp(v,k){this.x+=(v.x-this.x)*k;this.y+=(v.y-this.y)*k;this.z+=(v.z-this.z)*k;return this;}}
class Obj{constructor(){this.children=[];this.position=new V();this.rotation=new V();}add(o){this.children.push(o);o.parent=this;return this;}lookAt(){}updateProjectionMatrix(){}updateMatrixWorld(){}}
class Attr{constructor(a,n){this.array=new Float32Array(a);this.itemSize=n;this.count=this.array.length/n;}}
class Geo{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;return this;}computeBoundingSphere(){}dispose(){this.disposed=true;}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}
class Mat{constructor(o){Object.assign(this,o);}dispose(){this.disposed=true;}}
async function setup(search='',float=true,statuses=[1]){
 let lastRenderer;const elements=[],listeners=new Map(),events=[];
 const document={hidden:false,body:{append(el){elements.push(el);}},createElement(){return{style:{},setAttribute(){},append(){},remove(){this.removed=true;}};},getElementById(){return{hidden:true};}};
 const canvas={addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};
 class Renderer{
  constructor(){lastRenderer=this;this.shadowMap={};this.extensions={has:()=>float};this.info={render:{calls:0,triangles:0},memory:{geometries:2,textures:2},reset(){this.render.calls=0;this.render.triangles=0;}};this.target=null;this.compiled=[];this.targets=[];}
  setPixelRatio(){}setSize(w,h){this.size=[w,h];}getContext(){return{FRAMEBUFFER:1,FRAMEBUFFER_COMPLETE:1,checkFramebufferStatus(){return statuses.length>1?statuses.shift():statuses[0];}};}
  setRenderTarget(t){this.target=t;if(t&&!this.targets.includes(t))this.targets.push(t);}getRenderTarget(){return this.target;}
  compileAsync(scene,camera){this.compiled.push({scene,camera,target:this.target});return Promise.resolve();}
  render(){this.info.render.calls++;this.info.render.triangles+=12;}dispose(){this.disposed=true;}
 }
 class Target{constructor(w,h,o){Object.assign(this,o);this.texture={type:o.type};}setSize(w,h){this.size=[w,h];}dispose(){this.disposed=true;}}
 const three={WebGLRenderer:Renderer,WebGLRenderTarget:Target,DepthTexture:class{},Vector2:V,Vector3:V,Matrix4:V,
  ShaderMaterial:Mat,MeshStandardMaterial:Mat,Scene:Obj,Object3D:Obj,Mesh,PlaneGeometry:Geo,BufferGeometry:Geo,Float32BufferAttribute:Attr,
  OrthographicCamera:Obj,HalfFloatType:'half',UnsignedByteType:'byte',LinearFilter:1,PCFShadowMap:2,
  MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),damp:(a,b,l,dt)=>a+(b-a)*(1-Math.exp(-l*dt))}};
 const context=vm.createContext({console,URLSearchParams,document,window:{},location:{search},matchMedia:()=>({matches:false}),
  performance:{now:()=>1000},Event:class{constructor(type){this.type=type;}},dispatchEvent:e=>events.push(e.type),Float32Array,Math});
 const cache=new Map();
 const mock=(key,obj)=>{const m=new vm.SyntheticModule(Object.keys(obj),function(){for(const[k,v]of Object.entries(obj))this.setExport(k,v);},{context,identifier:key});cache.set(key,m);return m;};
 mock('three',three);
 const classic={camera:new Obj(),focus:new V(),resize(w,h){this.camera.aspect=w/h;},update(){this.focus.set(0,1,0);this.camera.position.set(0,4,-6);this.camera.fov=48;}};
 mock(path.join(ROOT,'src/camera/classic.js'),{createCameraRig:()=>classic,createCamSim:()=>({})});
 mock(path.join(ROOT,'src/world/map.js'),{ground:()=>0});mock(path.join(ROOT,'src/camera/occlusion.js'),{clearance:()=>1});
 // Shader source not needed for API contracts; GLSL validation is explicitly outside scope.
 mock(path.join(ROOT,'src/post/ink-shaders.js'),{INK_VERTEX:'',INK_FRAGMENT:''});
 async function load(key){
  if(cache.has(key))return cache.get(key);
  const m=new vm.SourceTextModule(await readFile(key,'utf8'),{context,identifier:key});cache.set(key,m);
  await m.link((s,from)=>load(s==='three'?'three':path.resolve(path.dirname(from.identifier),s)));return m;
 }
 async function module(file){const m=await load(path.join(ROOT,file));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
 return {module,canvas,elements,listeners,events,classic,three,get renderer(){return lastRenderer;}};
}
test('HDR fallback when floating-point color attachment unavailable',async()=>{
 const s=await setup('',false),{createInkPost}=await s.module('src/post/ink.js');const p=createInkPost({canvas:s.canvas,width:800,height:400});
 assert.equal(s.renderer.targets[0].type,'byte');p.dispose();
});
test('incomplete HDR target is replaced by a non-MSAA byte target',async()=>{
 const s=await setup('',true,[0,1]),{createInkPost}=await s.module('src/post/ink.js');const p=createInkPost({canvas:s.canvas,width:800,height:400});
 assert.equal(s.renderer.targets.length,2);assert.equal(s.renderer.targets[1].type,'byte');assert.equal(s.renderer.targets[1].samples,0);assert.equal(s.renderer.targets[0].disposed,true);p.dispose();
});
test('unsupported byte fallback fails explicitly instead of silently black',async()=>{
 const s=await setup('',false,[0,0]),{createInkPost}=await s.module('src/post/ink.js');
 assert.throws(()=>createInkPost({canvas:s.canvas,width:800,height:400}),/incomplete/);
});
test('warmup compiles scene AND final ink composition, restoring target',async()=>{
 const s=await setup(),{createInkPost}=await s.module('src/post/ink.js');const p=createInkPost({canvas:s.canvas,width:800,height:400});
 await p.compile({},{});assert.equal(s.renderer.compiled.length,2);assert.ok(s.renderer.compiled[0].target);assert.equal(s.renderer.compiled[1].target,null);assert.equal(s.renderer.target,null);p.dispose();
});
test('whole-frame counters include scene and composite and reset each frame',async()=>{
 const s=await setup(),{createInkPost}=await s.module('src/post/ink.js');const p=createInkPost({canvas:s.canvas,width:800,height:400});
 const cam={near:.1,far:100,projectionMatrixInverse:new V(),matrixWorld:new V()};p.render({},cam,0,{});assert.equal(s.renderer.info.render.calls,2);
 p.render({},cam,0,{});assert.equal(s.renderer.info.render.calls,2);p.dispose();
});
test('context loss pauses and skips draws until restore; dispose removes listeners',async()=>{
 const s=await setup(),{createInkPost}=await s.module('src/post/ink.js');const p=createInkPost({canvas:s.canvas,width:800,height:400});
 s.listeners.get('webglcontextlost')({preventDefault(){}});p.render({},{},0,{});assert.equal(s.renderer.info.render.calls,0);assert.ok(s.events.includes('blur'));
 s.listeners.get('webglcontextrestored')();assert.equal(s.elements.at(-1).removed,true);p.dispose();assert.equal(s.listeners.size,0);
});
test('camera=classic preserves the original view adapter unchanged',async()=>{
 const s=await setup('?style=ink&camera=classic'),{createCameraRig}=await s.module('src/camera/camera.js');
 assert.equal(createCameraRig({},800,400),s.classic);
});
test('battle view converges above the ground and releases during musou',async()=>{
 const s=await setup('?camera=battle'),{createCameraRig}=await s.module('src/camera/camera.js'),bus=await s.module('src/core/events.js');
 const game={hero:{x:0,y:0,z:0,state:'idle'},cam:{yaw:0,tilt:0},musou:{}};const r=createCameraRig(game,800,400);bus.emit('flow',{state:'battle'});
 for(let i=0;i<120;i++)r.update(1/60);assert.ok(r.camera.position.y>5);assert.ok(r.camera.position.z<-7);
 game.hero.state='musou';for(let i=0;i<120;i++)r.update(1/60);assert.ok(Math.abs(r.camera.position.z+6)<.01);
 bus.emit('flow',{state:'title'});r.update(1/60);assert.equal(r.camera.position.z,-6);
});
test('ink hero attaches one merged mesh per part and preserves weapon parent',async()=>{
 const s=await setup('?models=ink'),{createInkHeroModel}=await s.module('src/chars/zhaoyun/ink-model.js');
 const joints={};for(const k of ['hips','spine','chest','neck','head','weapon',...['L','R'].flatMap(s=>['shoulder','upperArm','foreArm','hand','thigh','shin','foot'].map(x=>x+s))])joints[k]=new Obj();
 const m=createInkHeroModel({joints});assert.equal(Object.keys(m.meshes).length,22);assert.equal(m.meshes.blade.parent,joints.weapon);
 assert.ok(Object.values(m.meshes).every(x=>x.material===m.material));assert.ok(joints.pauldronL);
});
