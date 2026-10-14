import {ORIGINS,SLOT_NAMES,RARITIES,ITEM_BY_ID,TRAITS,BAG_LIMIT,MAX_LEVEL,BATTLE,rankName,xpNeeded} from './data.js';
import {deriveStats,itemStats} from './progression.js';
export function createWarUI(handlers={}){
  const $=id=>document.getElementById(id);let profile=null,session=null,playing=false,selected=null,lastRevision=-1,toastTimer=0,returnFocus=null;
  $('origin-options').innerHTML=Object.entries(ORIGINS).map(([key,o])=>`<label class="origin-card"><input type="radio" name="origin" value="${key}" ${key==='vanguard'?'checked':''}><b>${o.name}</b><small>${o.desc}</small></label>`).join('');
  const text=(id,v)=>{$(id).textContent=v;};
  function notice(message){if(!playing&&!$('lobby').hidden)text('camp-record',message);text('toast',message);$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
  function setProfile(p,status='ok'){
    profile=p;
    if(p){$('player-name').value=p.name;$('palette').value=p.palette;document.querySelector(`[name="origin"][value="${p.origin}"]`).checked=true;}
    text('save-state',status==='unavailable'?'存储不可用':status==='corrupt'?'原存档损坏，未删除':p?'当前浏览器存档':'新建角色');
    text('camp-record',p?`Lv.${p.level} ${rankName(p.level)} · 统帅击破 ${p.wins} 次 · 装备 ${p.inventory.length}/${BAG_LIMIT}`:'初始等级 1 · 普通长枪 · 成长改变你的清兵能力');
    $('camp-bag').disabled=!p;$('new-profile').disabled=!p;
  }
  $('create-form').addEventListener('submit',e=>{
    e.preventDefault();handlers.start?.({name:$('player-name').value,origin:document.querySelector('[name="origin"]:checked').value,palette:$('palette').value,enemies:Number($('enemy-count').value),quality:$('quality').value});
  });
  $('camp-bag').addEventListener('click',()=>openMenu());$('bag-button').addEventListener('click',()=>openMenu());
  $('pause-button').addEventListener('click',()=>openMenu());$('go').addEventListener('click',()=>closeMenu());
  $('new-profile').addEventListener('click',()=>{if(confirm('重新创建会替换本游戏当前角色的等级和装备。原版游戏存档不受影响。继续吗？'))handlers.newProfile?.();});
  $('quit').addEventListener('click',()=>{if(!playing){closeMenu();return;}if(confirm('撤回营地？已拾取装备与等级保留，地面战利品将遗失。'))handlers.retreat?.();});
  $('return-camp').addEventListener('click',()=>handlers.retreat?.());$('fatal-back').addEventListener('click',()=>handlers.retreat?.());
  $('challenge-button').addEventListener('click',()=>handlers.command?.({type:'challenge'}));
  function openMenu(){
    if(!profile||!$('result').hidden||!$('fatal').hidden||!$('loading').hidden)return;
    if(!$('menu').hidden)return;
    returnFocus=document.activeElement;$('menu').hidden=false;
    text('go',playing?'返回战场':'返回营地');text('quit',playing?'撤回营地':'关闭');
    handlers.pause?.();renderInventory();$('go').focus();
  }
  function closeMenu(){if($('menu').hidden)return;$('menu').hidden=true;handlers.resume?.();returnFocus?.focus?.();}
  addEventListener('keydown',e=>{
    if(e.target.closest?.('input,textarea,select'))return;
    if(e.code==='KeyB'&&playing){e.preventDefault();$('menu').hidden?openMenu():closeMenu();}
    if(e.code==='Escape'&&playing){e.preventDefault();$('menu').hidden?openMenu():closeMenu();}
    if(e.code==='KeyE'&&playing&&$('menu').hidden)handlers.command?.({type:'challenge'});
    if(e.code==='Tab'&&!$('menu').hidden){
      const nodes=[...$('menu').querySelectorAll('button:not(:disabled),[tabindex="0"]')],i=nodes.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1)?.focus();}
      else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}
    }
  });
  const pct=n=>`${Math.round(n*100)}%`;
  function statText(st){return [['伤害系数',st.atk,pct],['生命',st.hp,n=>String(n)],['防御系数',st.def,pct],['攻击距离',st.reach,pct]].filter(([,v])=>v).map(([n,v,fmt])=>`${n} +${fmt(v)}`).join('\n');}
  function renderInventory(){
    if(!profile)return;const s=deriveStats(profile);
    text('stat-line',`Lv.${profile.level} ${rankName(profile.level)} · 伤害 ×${s.atk.toFixed(2)} · 生命 ${s.hp} · 防御 ×${s.def.toFixed(2)} · 距离 ×${s.reach.toFixed(2)}`);
    text('scrap-line',`装备 ${profile.inventory.length}/${BAG_LIMIT} · 碎铁 ${profile.scrap} · 暂存奖励 ${profile.rewards.length}`);
    $('slot-bar').innerHTML=Object.entries(SLOT_NAMES).map(([slot,name])=>`<span>${name}：${profile.equipped[slot]?'已穿戴':'空'}</span>`).join('');
    const items=[...profile.inventory].sort((a,b)=>b.rarity-a.rarity||b.level-a.level);
    if(!items.some(i=>i.uid===selected))selected=items[0]?.uid;
    $('bag-list').replaceChildren();
    for(const item of items){
      const d=ITEM_BY_ID[item.def],r=RARITIES[item.rarity],equipped=profile.equipped[d.slot]===item.uid;
      const button=document.createElement('button');button.type='button';button.className='item-row'+(selected===item.uid?' selected':'');button.style.setProperty('--rarity',r.color);button.dataset.uid=item.uid;
      button.innerHTML=`<b>${d.name}</b><small>${r.name} · Lv.${item.level} · ${SLOT_NAMES[d.slot]}</small>${equipped?'<em>穿戴中</em>':''}`;
      button.addEventListener('click',()=>{selected=item.uid;renderInventory();$('item-detail').focus();});$('bag-list').append(button);
    }
    const item=items.find(i=>i.uid===selected);$('item-detail').tabIndex=0;
    if(!item){text('item-detail','尚未取得装备。');return;}
    const d=ITEM_BY_ID[item.def],st=itemStats(item),old=profile.inventory.find(i=>i.uid===profile.equipped[d.slot]),equipped=old?.uid===item.uid;
    const os=old?itemStats(old):{atk:0,hp:0,def:0,reach:0};
    const diffs=[['伤害',st.atk-os.atk,pct],['生命',st.hp-os.hp,String],['防御',st.def-os.def,pct],['距离',st.reach-os.reach,pct]].filter(([,n])=>Math.abs(n)>.0001);
    $('item-detail').innerHTML=`<div class="detail-scroll"><h3>${d.name}</h3><small>${RARITIES[item.rarity].name} · ${SLOT_NAMES[d.slot]} · Lv.${item.level}</small><p class="stat">${statText(st)}</p>${st.trait?`<p class="trait"><b>${TRAITS[st.trait].name}</b> · ${TRAITS[st.trait].desc}<br><small>同名效果不重复叠加；追加伤害不会再次触发装备效果。</small></p>`:''}<p class="fine">${equipped?'当前穿戴':`对比：${old?ITEM_BY_ID[old.def].name:'空栏位'}`}</p><p>${equipped?'':diffs.map(([n,v,fmt])=>`<span class="${v>0?'positive':'negative'}">${n} ${v>0?'+':''}${fmt(v)}</span>`).join(' · ')}</p><p class="fine">淬炼上限为角色等级；换装保持当前生命比例。</p></div><div class="detail-buttons"><button id="equip-item" class="primary" ${equipped?'disabled':''}>${equipped?'已穿戴':'穿上装备'}</button><button id="temper-item" ${item.level>=profile.level||profile.scrap<8+item.level*3?'disabled':''}>淬炼 · ${8+item.level*3} 碎铁</button><button id="salvage-item" ${equipped?'disabled':''}>分解</button></div>`;
    for(const [id,type] of [['equip-item','equip'],['temper-item','temper'],['salvage-item','salvage']])$(id).addEventListener('click',()=>handlers.command?.({type,uid:item.uid}));
  }
  function update(game,current){
    session=current;profile=current.profile;const r=current.run,h=game.hero;
    text('hud-name',profile.name);text('hud-level',`Lv.${profile.level}`);text('hud-rank',rankName(profile.level));
    $('hp-fill').style.transform=`scaleX(${Math.max(0,h.hp/h.hpMax)})`;
    $('rage-fill').style.transform=`scaleX(${Math.max(0,Math.min(1,h.musou/h.musouMax))})`;
    $('xp-fill').style.transform=`scaleX(${profile.level===MAX_LEVEL?1:profile.xp/xpNeeded(profile.level)})`;
    text('hp-text',`${Math.ceil(h.hp)} / ${h.hpMax}`);text('hud-count',`击破 ${r.kills} · 先锋 ${r.captains}/2 · ${Math.floor(r.seconds/60)}:${String(Math.floor(r.seconds)%60).padStart(2,'0')}`);
    text('bag-count',profile.inventory.length);
    text('objective-text',r.bossSpawned?'击败赤甲统帅':r.bossReady?'前往金色战旗，挑战统帅':'击破敌军，夺取装备');
    text('objective-sub',r.bossReady?`距中阵 ${Math.round(Math.hypot(h.x-current.target[0],h.z-current.target[1]))} 米 · E / 挑战按钮`:`目标 ${Math.min(r.kills,BATTLE.bossKills)}/${BATTLE.bossKills} 击破 · 先锋 ${r.captains}/2 · Lv.${BATTLE.bossLevel}`);
    $('challenge-button').hidden=!r.bossReady||r.bossSpawned;
    const boss=game.actors.list.find(a=>game.actors.foe(a));
    const ci=Array.from({length:game.crowd.N-game.crowd.grunts},(_,i)=>i+game.crowd.grunts).find(i=>game.crowd.type[i]&&game.crowd.hp[i]>0&&!game.crowd.kod[i]&&game.crowd.st[i]!==0);
    $('boss-status').hidden=!boss&&ci===undefined;
    if(boss||ci!==undefined){text('boss-name',boss?.name.zh||game.crowd.offName[ci-game.crowd.grunts]?.zh||'敌方先锋');$('boss-fill').style.transform=`scaleX(${Math.max(0,boss?boss.hp/boss.hpMax:game.crowd.hp[ci]/game.crowd.hpMax[ci])})`;}
    if(r.revision!==lastRevision){lastRevision=r.revision;$('build-tags').innerHTML=current.stats.traits.map(t=>`<span>${TRAITS[t].name}</span>`).join('');if(!$('menu').hidden)renderInventory();}
    if(game.frame%12===0)drawMap(game,current);
  }
  function drawMap(g,s){
    const cv=$('war-map'),ctx=cv.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,120,100);
    const h=g.hero,co=Math.cos(g.cam.yaw),sn=Math.sin(g.cam.yaw),project=(x,z)=>{const dx=x-h.x,dz=z-h.z;return [60-(dx*co-dz*sn)*1.4,52-(dx*sn+dz*co)*1.4];};
    ctx.strokeStyle='#c9d0ba30';ctx.beginPath();ctx.arc(60,52,34,0,Math.PI*2);ctx.stroke();
    const dot=(x,z,color,size)=>{const p=project(x,z);ctx.fillStyle=color;ctx.fillRect(Math.max(3,Math.min(117,p[0]))-size/2,Math.max(3,Math.min(97,p[1]))-size/2,size,size);};
    const c=g.crowd;for(let i=0;i<c.T;i++){if(!c.st[i]||c.kod[i]||c.st[i]===10)continue;dot(c.x[i],c.z[i],i<c.N?'#d7836c':'#7cb9a5',c.type[i]?4:2);}
    for(const a of g.actors.list)if(g.actors.foe(a))dot(a.x,a.z,'#edb84f',5);
    dot(...s.target,'#e5c278',5);ctx.fillStyle='#fff8d7';ctx.beginPath();ctx.arc(60,52,3,0,Math.PI*2);ctx.fill();
  }
  return {setProfile,notice,openMenu,closeMenu,renderInventory,get menuOpen(){return !$('menu').hidden;},
    loading(){ $('lobby').hidden=true;$('loading').hidden=false; },
    ready(){playing=true;$('loading').hidden=true;$('war-hud').hidden=false;},
    update,
    end(run){playing=false;$('menu').hidden=true;$('result').hidden=false;
      text('result-title',run.result==='victory'?'阵前战神':'此战未竟');
      text('result-summary',`Lv.${profile.level} ${rankName(profile.level)} · 击破 ${run.kills} · 取得装备 ${run.looted} 件`);
      text('result-reward',run.reward?`统帅战利品：传奇 · ${ITEM_BY_ID[run.reward.def].name}${profile.rewards.length?'（背包满，已暂存营地）':''}`:'已拾取的装备和成长保留，回营整装再战。');$('return-camp').focus();
    },
    fatal(error){playing=false;$('loading').hidden=true;$('fatal').hidden=false;text('fatal-text',String(error?.message||error));$('fatal-back').focus();},
  };
}
