// New entry point; the old main.js and its historical campaign are deliberately untouched.
import * as THREE from 'three';
import {rng,vrng} from '../core/rng.js';
import {on,emit} from '../core/events.js';
import {DIFFS} from '../core/difficulty.js';
import {createPost} from '../post/post.js';
import {createWorld} from '../world/world.js';
import {spawnPoint,clampWalk,MAP} from '../world/map.js';
import {createHero,createHeroView} from '../hero/hero.js';
import {createInput} from '../core/input.js';
import {createCrowd} from '../crowd/crowd.js';
import {createCrowdView} from '../crowd/view.js';
import {armyPair,FREE_ARMY} from '../crowd/armies.js';
import {createCombat} from '../combat/combat.js';
import {createActors} from '../actors/actors.js';
import {createActorsView} from '../actors/view.js';
import {createPickups,createPickupsView} from '../actors/pickups.js';
import {createCamSim,createCameraRig} from '../camera/camera.js';
import {createVfx} from '../vfx/vfx.js';
import {createAudio} from '../audio/audio.js';
import {createPlayerCharacter,applyPlayerStats} from './character.js';
import {createSession} from './session.js';
import {createWarView} from './view.js';
import {installActorDamageScaling} from './engine-adapter.js';
import {getWarViewport,bindWarViewport} from './viewport.js';
export async function startWar({profile,options,ui,save}){
  const canvas=document.getElementById('c'),viewport=getWarViewport();
  viewport.refresh();
  const post=createPost({canvas,width:viewport.width,height:viewport.height});
  const scene=new THREE.Scene(),world=createWorld(scene,post);
  const p=spawnPoint('free'),seed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
  rng.seed(seed||1);vrng.seed(7936);
  const game={frame:0,hitstop:0,freeze:0,timeScale:1,mode:'war',diff:{...DIFFS[1],gruntHp:1.25},army:armyPair(FREE_ARMY),
    story:{morale:undefined,target:null,hq:null,timer:null,defend:null}};
  game.cam=createCamSim();game.cam.reset(p.yaw||0);
  game.hero=createHero(game);game.hero.reset({...p,char:createPlayerCharacter(profile)});
  game.hero.atkK=game.hero.defK=1;
  const n=[80,160,300].includes(options.enemies)?options.enemies:160;
  game.crowd=createCrowd(game,n);game.combat=createCombat(game);game.actors=createActors(game);game.pickups=createPickups(game);
  installActorDamageScaling(game);
  game.musou=game.hero.kit.createMusou(game);
  game.crowd.reset();game.combat.reset();game.actors.reset();game.pickups.reset();game.musou.reset();
  const input=createInput(),cameraRig=createCameraRig(game,viewport.width,viewport.height);
  const crowdView=createCrowdView(scene,game),heroView=createHeroView(scene,game.hero);
  const actorsView=createActorsView(scene,game,()=>post.compile(scene,cameraRig.camera));
  const pickupView=createPickupsView(scene,game),vfx=createVfx(scene,game,world),musouView=game.hero.kit.createMusouView(scene,game,cameraRig.camera);
  createAudio(game);
  const session=createSession(game,profile,{on,point:clampWalk,applyStats:applyPlayerStats,save,notify:ui.notice,seed});
  const warView=createWarView(scene,game,session);
  for(const [dx,dz,count] of [[-13,16,24],[13,21,30],[0,31,Math.max(16,n-54)]]){
    const x=p.x+Math.cos(p.yaw||0)*dx+Math.sin(p.yaw||0)*dz,z=p.z-Math.sin(p.yaw||0)*dx+Math.cos(p.yaw||0)*dz;
    game.crowd.spawnSquad({x,z,n:count,cols:6});
  }
  game.crowd.spawnAllies({x:p.x-7,z:p.z-8,n:20,face:p.yaw||0});game.crowd.setWaves(true);game.crowd.setAllies(true);
  emit('scenario',{mode:'war',char:'nameless',map:MAP.id});
  let paused=true,alive=true,started=false,lastFrame=0,acc=0,last=performance.now(),resultShown=false;
  function render(){
    const dt=Math.max(0,Math.min(.1,(game.frame-lastFrame)/60));lastFrame=game.frame;
    heroView.update(dt);crowdView.update(dt,cameraRig.camera);actorsView.update(dt);pickupView.update();vfx.update(dt);cameraRig.update(dt);
    world.update(dt,cameraRig.focus,game);musouView.update(dt);warView.update();
    post.render(scene,cameraRig.camera,game.frame/60,cameraRig.focus,vfx.flash);ui.update(game,session);
  }
  function pause(){if(paused)return;paused=true;acc=0;emit('flow',{state:'pause',ctx:{mode:'war'}});if(document.pointerLockElement)document.exitPointerLock();}
  function resume(){if(session.run.ended||document.hidden||viewport.portrait)return;paused=false;acc=0;last=performance.now();emit('flow',{state:'battle',ctx:{mode:'war'}});}
  function step(){
    session.processCommands();const inp=input.sample();game.cam.step(game,inp);game.hero.step(inp);game.combat.step();game.crowd.step();game.actors.step();game.pickups.step();game.musou.step();
    session.step();game.frame++;vfx.afterStep();
  }
  function frame(now){
    if(!alive)return;
    try{
      const delta=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
      if(paused)session.processCommands();
      if(!paused&&!viewport.portrait&&!session.run.ended){acc+=delta;let steps=0;while(acc>=1/60&&steps<4&&!session.run.ended){step();acc-=1/60;steps++;}if(steps===4)acc=0;}
      else {acc=0;input.sample();}
      if(session.run.ended&&!resultShown){resultShown=true;pause();ui.update(game,session);ui.end(session.run);emit('flow',{state:'result',ctx:{mode:'war'}});}
      if(!document.hidden&&!viewport.portrait)render();
      requestAnimationFrame(frame);
    }catch(error){alive=false;pause();session.save();console.error(error);ui.fatal(error);}
  }
  bindWarViewport({
    resize(w,h){post.setSize(w,h);cameraRig.resize(w,h);},
    resetInput(){emit('flow',{state:paused?'pause':'battle',ctx:{mode:'war'}});},
    pause(){pause();if(started&&!session.run.ended)ui.openMenu();}
  });
  addEventListener('blur',()=>{if(started&&!paused&&!session.run.ended)ui.openMenu();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&started){ui.openMenu();pause();session.save();}});
  addEventListener('pagehide',()=>session.save());
  canvas.addEventListener('webglcontextlost',()=>{ui.openMenu();pause();});
  // First update submits the initial soldier/loot matrices before warming their shaders.
  render();await post.compile(scene,cameraRig.camera);
  ui.ready();started=true;
  if(viewport.portrait){pause();ui.openMenu();}else resume();
  requestAnimationFrame(frame);
  ui.notice('普通小兵也会爆装备；靠近拾取，B / 行囊比较与穿戴。');
  return {pause,resume,save:session.save,command(c){session.queue(c);if(paused){session.processCommands();ui.update(game,session);if(ui.menuOpen)ui.renderInventory();}}};
}
