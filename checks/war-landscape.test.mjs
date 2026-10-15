import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitLandscape, WAR_ASPECT } from '../src/war/viewport-math.js';
const cases = [[2000,900],[1000,450],[844,390],[667,375],[568,320],[1280,720],[1024,768],[2560,1080],[390,844],[1,1]];
for (const [w,h] of cases) test(`20:9 contained in ${w}x${h}`, () => {
  const r=fitLandscape(w,h); assert.ok(Math.abs(r.width/r.height-WAR_ASPECT)<1e-9);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=w+1e-8&&r.y+r.height<=h+1e-8);
  assert.ok(Math.abs(r.width-w)<1e-8||Math.abs(r.height-h)<1e-8);
});
test('safe area is applied once, before centering',()=>{const r=fitLandscape(844,390,{left:44,right:44,top:0,bottom:21});assert.equal(r.width,756);assert.equal(r.x,44);assert.ok(r.y+r.height<=369);});
test('extreme/invalid input stays finite and positive',()=>{for(const [w,h] of [[0,0],[-4,-3],[NaN,Infinity]]){const r=fitLandscape(w,h,{left:999,right:NaN,top:-10,bottom:Infinity});assert.ok(Object.values(r).every(Number.isFinite));assert.ok(r.width>0&&r.height>0);}});
test('DPR is not part of logical frame geometry',()=>{const a=fitLandscape(1000,450),b=fitLandscape(2000,900);assert.equal(b.width,a.width*2);assert.equal(b.height,a.height*2);});
test('war integration uses frame dimensions and portrait simulation gate',()=>{const app=readFileSync(new URL('../src/war/app.js',import.meta.url),'utf8');assert.match(app,/width:viewport.width,height:viewport.height/);assert.match(app,/createCameraRig\(game,viewport.width,viewport.height\)/);assert.match(app,/!paused&&!viewport.portrait&&!session.run.ended/);assert.doesNotMatch(app,/setSize\(innerWidth/);});
test('layout is opt-in to war entry; no global orientation lock',()=>{const html=readFileSync(new URL('../war.html',import.meta.url),'utf8');assert.match(html,/landscape.css/);const js=readFileSync(new URL('../src/war/viewport.js',import.meta.url),'utf8');assert.match(js,/async function fullscreen/);assert.match(js,/catch/);});
