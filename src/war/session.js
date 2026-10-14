import {BATTLE,ITEM_BY_ID,rankName} from './data.js';
import {makeRng,deriveStats,grantXP,makeDrop,receiveItem,equipItem,salvageItem,temperItem,claimRewards} from './progression.js';
import {createProcs} from './procs.js';
// Owns progression/loot/encounters. The adapter is explicitly invoked from fixed simulation steps.
// UI commands are consumed at a simulation boundary even when the menu has paused time.
export function createSession(game,profile,{on,point,applyStats,save,notify,seed=1}){
  const random=makeRng(seed),procs=createProcs(),events=[],commands=[],seen=new Set();
  const run={kills:0,captains:0,seconds:0,drops:[],fx:[],stage:'battle',bossReady:false,bossSpawned:false,ended:false,result:null,revision:0,looted:0,guardUntil:0};
  const caps=new Set(),spawned=new Set();let stats=deriveStats(profile),gearDepth=0,key=1100000000,lastSave=0,lastFullBag=-180;
  const initial={x:game.hero.x,z:game.hero.z,yaw:game.hero.yaw};
  const at=(x,z)=>point(initial.x+Math.cos(initial.yaw)*x+Math.sin(initial.yaw)*z,initial.z-Math.sin(initial.yaw)*x+Math.cos(initial.yaw)*z);
  const notice=(text)=>{notify?.(text);};
  function refresh(heal=0){stats=deriveStats(profile);run.revision++;applyStats(game.hero,stats,profile,run.revision);if(heal&&!game.hero.dead)game.hero.hp=Math.min(game.hero.hpMax,game.hero.hp+game.hero.hpMax*heal);}
  function safeSave(){const ok=save(profile);if(!ok)notice('浏览器无法保存：本次进度仅保留到关闭页面。');return ok;}
  const capture=(type,e)=>{
    if(run.ended)return;
    const v={...e,type}; // Upstream events reuse their payload object.
    if(gearDepth)v.move='gear:secondary';
    if(type==='ko'){
      const token=`${e.i}:${game.frame}`;if(seen.has(token))return;seen.add(token);
      if(seen.size>4096)seen.clear();
    }
    if(events.length<2048)events.push(v);
  };
  on('ko',e=>capture('ko',e));on('hits',e=>capture('hits',e));on('dodge',e=>capture('dodge',e));
  on('hero:hurt',e=>capture('hurt',{...e,fraction:game.hero.hp/game.hero.hpMax}));
  on('hero:down',e=>capture('down',e));on('actor:down',e=>capture('actorDown',e));
  function loot(x,z,elite=false,slot=null){
    if(run.drops.length>=BATTLE.groundLimit){notice('地面战利品已满，请先靠近拾取。');return;}
    const item=makeDrop(profile,random,{elite,guaranteedSlot:slot});
    const p=point(x,z);run.drops.push({id:item.uid,item,x:p[0],z:p[1]});
    if(elite)notice(`传奇战利品：${ITEM_BY_ID[item.def].name}`);
  }
  let dryKills=0;
  function creditedKill(e,elite=false){
    run.kills++;profile.totalKills++;
    const gained=grantXP(profile,elite?70:6);if(gained){refresh(Math.min(.24,.08*gained));notice(`Lv.${profile.level} · ${rankName(profile.level)}！`);}
    if(caps.delete(e.i)){run.captains++;elite=true;notice(`敌方先锋已击破 ${run.captains}/2，友军增援抵达。`);const p=at(-8,-8);game.crowd.spawnAllies({x:p[0],z:p[1],n:8,face:initial.yaw});}
    const tutorial={3:'armor',9:'boots',18:'charm'}[run.kills];
    if(elite||tutorial||++dryKills>=12||random()<.12){loot(e.x,e.z,elite,tutorial||null);dryKills=0;}
  }
  function finish(win){
    if(run.ended)return;
    run.ended=true;run.result=win?'victory':'defeat';run.stage='result';
    game.crowd.setWaves(false);game.crowd.setAllies(false);
    if(win){
      profile.wins++;grantXP(profile,150);const reward=makeDrop(profile,random,{elite:true});
      if(!receiveItem(profile,reward))profile.rewards.push(reward);
      run.reward=reward;notice(`击破统帅！获得 ${ITEM_BY_ID[reward.def].name}`);
    }
    refresh();safeSave();
  }
  function captain(which){
    const p=at(which===1?-12:12,which===1?12:20);
    const i=game.crowd.spawnOfficer({x:p[0],z:p[1],name:{zh:which===1?'铁壁先锋':'血刃先锋',en:'CAPTAIN'},hp:which===1?480:780,engaged:false,boss:true});
    if(i>=0){spawned.add(which);caps.add(i);notice(`${which===1?'铁壁':'血刃'}先锋出现，击败他必掉传奇装备。`);}
  }
  function challenge(){
    if(run.ended||run.bossSpawned||!run.bossReady)return false;
    const p=at(0,26);if(Math.hypot(game.hero.x-p[0],game.hero.z-p[1])>9){notice('先前往金色战旗，再发起挑战。');return false;}
    game.actors.spawn('war-chief',{kit:'lubu',role:'boss',at:p,hp:2600+Math.min(profile.wins,10)*300,poise:260,scale:1.2,name:{zh:'赤甲统帅',en:'WARLORD'},seal:'统帅',intro:{zh:'无名之辈，也敢闯我中军？',en:''}});
    run.bossSpawned=true;run.stage='chief';notice('赤甲统帅应战！留意地面预警，重击可打破架势。');return true;
  }
  function resolveFx(fx){
    const h=game.hero;
    if(fx.type==='heal')h.hp=Math.min(h.hpMax,h.hp+fx.value);
    else if(fx.type==='rage')h.musou=Math.min(h.musouMax,h.musou+fx.value);
    else if(fx.type==='guard'){run.guardUntil=fx.until;notice('不屈护体触发！');}
    else if(fx.type==='pulse'){
      // strike() re-enters the synchronous event bus. Mark these events and drain them next step.
      const spec={shape:'circle',range:fx.range,dmg:fx.dmg,kb:fx.heavy?'launch':'push',force:3,lift:fx.heavy?4:0,heavy:fx.heavy,hitstop:0,yMax:4};
      gearDepth++;
      // Only gear procs have reduced boss damage; base moves and Musou remain unchanged.
      const hurt=game.actors.hurt;
      game.actors.hurt=(a,dmg,heavy,musou)=>hurt(a,dmg*.5,heavy,musou);
      try{game.combat.strike(spec,fx.x,fx.z,h.yaw,key++,false,`gear:${fx.kind}`);}
      finally{gearDepth--;game.actors.hurt=hurt;}
      if(run.fx.length<32)run.fx.push({...fx,start:game.frame});
    }
  }
  function processCommands(){
    for(const c of commands.splice(0)){
      if(run.ended)continue;
      let changed=false;
      if(c.type==='equip')changed=equipItem(profile,c.uid);
      if(c.type==='salvage')changed=salvageItem(profile,c.uid);
      if(c.type==='temper')changed=temperItem(profile,c.uid);
      if(c.type==='challenge')challenge();
      if(changed){claimRewards(profile);refresh();safeSave();}
    }
  }
  refresh();
  return {
    run,profile,get stats(){return stats;},get target(){return at(0,26);},
    queue(c){if(commands.length<32)commands.push({...c});},processCommands,
    save:safeSave,
    step(){
      if(run.ended)return;processCommands();run.seconds=game.frame/60;
      const batch=events.splice(0); // Effects may generate another batch; never recurse.
      if(game.hero.dead||batch.some(e=>e.type==='down')){finish(false);return;}
      let pulses=0;
      for(const e of batch){
        if(e.type==='ko')creditedKill(e,!!e.officer);
        if(e.type==='actorDown'&&e.key==='war-chief'){finish(true);return;}
        for(const fx of procs.resolve(e,stats,game.frame)){
          if(fx.type==='pulse'&&++pulses>4)continue;resolveFx(fx);
        }
      }
      if(!spawned.has(1)&&run.kills>=BATTLE.firstCaptain)captain(1);
      if(!spawned.has(2)&&run.kills>=BATTLE.secondCaptain)captain(2);
      run.bossReady=run.kills>=BATTLE.bossKills&&run.captains>=2&&profile.level>=BATTLE.bossLevel;
      if(run.bossReady&&!run.bossSpawned&&run.stage!=='ready'){run.stage='ready';notice('敌军中阵已暴露！前往金色战旗挑战统帅，或继续刷装备。');}
      game.hero.defK=stats.def*(game.frame<run.guardUntil?1.65:1);
      let got=0;
      run.drops=run.drops.filter(d=>{
        if(Math.hypot(game.hero.x-d.x,game.hero.z-d.z)>2.8)return true;
        if(!receiveItem(profile,d.item)){if(game.frame-lastFullBag>=180){lastFullBag=game.frame;notice('行囊已满：暂停整理后再拾取，战利品仍留在地上。');}return true;}
        run.looted++;got++;notice(`拾取 ${ITEM_BY_ID[d.item.def].name} · 打开行囊比较装备`);return false;
      });
      if(got){refresh();safeSave();}
      run.fx=run.fx.filter(f=>game.frame-f.start<32);
      if(game.frame-lastSave>=300){lastSave=game.frame;safeSave();}
    },
  };
}
