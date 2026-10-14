import {VERSION, MAX_LEVEL, BAG_LIMIT, ORIGINS, PALETTES, ITEMS, ITEM_BY_ID, SLOT_NAMES, RARITIES, xpNeeded, finiteNumber, cleanName} from './data.js';
export function makeRng(seed=1) {
  let state=seed>>>0;
  return ()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function createItem(def, level, rarity, roll, uid) {
  if(!Object.hasOwn(ITEM_BY_ID,def))throw new Error('Unknown item definition');
  return {uid:String(uid),def,level:Math.floor(finiteNumber(level,1,1,MAX_LEVEL)),rarity:Math.floor(finiteNumber(rarity,0,0,3)),roll:finiteNumber(roll,.5,0,1)};
}
export function itemStats(item) {
  const d=ITEM_BY_ID[item.def], k=RARITIES[item.rarity].factor*(.9+item.roll*.2)*(1+(item.level-1)*.045);
  return {atk:(d.atk||0)*k,hp:Math.round((d.hp||0)*k),def:(d.def||0)*k,reach:(d.reach||0)*k,trait:d.trait||null};
}
export function createProfile({name='无名',origin='vanguard',palette='jade'}={}) {
  origin=Object.hasOwn(ORIGINS,origin)?origin:'vanguard';palette=Object.hasOwn(PALETTES,palette)?palette:'jade';
  const starter=createItem(ORIGINS[origin].starter,1,0,.5,'item-1');
  return {version:VERSION,name:cleanName(name),origin,palette,level:1,xp:0,inventory:[starter],rewards:[],equipped:{weapon:starter.uid},scrap:0,serial:2,wins:0,totalKills:0};
}
export function validateProfile(raw) {
  if(!raw||raw.version!==VERSION||!Array.isArray(raw.inventory))return null;
  const p=createProfile(raw), seen=new Set();
  p.level=Math.floor(finiteNumber(raw.level,1,1,MAX_LEVEL));
  p.xp=p.level===MAX_LEVEL?0:Math.floor(finiteNumber(raw.xp,0,0,xpNeeded(p.level)-1));
  p.inventory=[];
  for(const item of raw.inventory.slice(0,BAG_LIMIT)){
    if(!item||!Object.hasOwn(ITEM_BY_ID,item.def)||typeof item.uid!=='string'||!/^item-\d{1,9}$/.test(item.uid)||seen.has(item.uid))continue;
    seen.add(item.uid);p.inventory.push(createItem(item.def,item.level,item.rarity,item.roll,item.uid));
  }
  if(!p.inventory.length)p.inventory=createProfile(p).inventory;
  p.rewards=[];
  for(const i of (Array.isArray(raw.rewards)?raw.rewards:[]).slice(0,8)){
    if(i&&Object.hasOwn(ITEM_BY_ID,i.def)&&typeof i.uid==='string'&&/^item-\d{1,9}$/.test(i.uid)&&!seen.has(i.uid)){seen.add(i.uid);p.rewards.push(createItem(i.def,i.level,i.rarity,i.roll,i.uid));}
  }
  p.equipped={};
  for(const slot of Object.keys(SLOT_NAMES)){
    const item=p.inventory.find(i=>i.uid===raw.equipped?.[slot]);
    if(item&&ITEM_BY_ID[item.def].slot===slot)p.equipped[slot]=item.uid;
  }
  if(!p.equipped.weapon){const w=p.inventory.find(i=>ITEM_BY_ID[i.def].slot==='weapon');if(w)p.equipped.weapon=w.uid;}
  p.serial=Math.max(2,...[...p.inventory,...p.rewards].map(i=>Number(i.uid.slice(5))+1));
  p.scrap=Math.floor(finiteNumber(raw.scrap,0,0,1e7));p.wins=Math.floor(finiteNumber(raw.wins,0,0,1e6));
  p.totalKills=Math.floor(finiteNumber(raw.totalKills,0,0,1e9));return p;
}
export function deriveStats(p) {
  const o=ORIGINS[p.origin], s={atk:.72+(p.level-1)*.17+(o.atk||0),hp:230+(p.level-1)*19+o.hp,def:1+o.def,reach:1,traits:[],rage:o.rage||0};
  for(const slot of Object.keys(SLOT_NAMES)){
    const i=p.inventory.find(i=>i.uid===p.equipped[slot]);if(!i)continue;
    const st=itemStats(i);s.atk+=st.atk;s.hp+=st.hp;s.def+=st.def;s.reach+=st.reach;
    if(st.trait&&!s.traits.includes(st.trait))s.traits.push(st.trait);
  }
  // The player eventually becomes an officer-class threat; this is not invulnerability.
  if(p.level>=10){s.atk+=.3;s.reach+=.10;}
  s.reach=Math.min(1.55,s.reach);s.def=Math.min(2.8,s.def);s.hp=Math.round(s.hp);return s;
}
export function grantXP(p,amount) {
  amount=Math.max(0,Math.floor(finiteNumber(amount,0,0,1e6)));let gained=0;
  if(p.level===MAX_LEVEL)return 0;
  p.xp+=amount;
  while(p.level<MAX_LEVEL&&p.xp>=xpNeeded(p.level)){p.xp-=xpNeeded(p.level);p.level++;gained++;}
  if(p.level===MAX_LEVEL)p.xp=0;return gained;
}
export function equipItem(p,uid){const item=p.inventory.find(i=>i.uid===uid);if(!item)return false;p.equipped[ITEM_BY_ID[item.def].slot]=uid;return true;}
export function receiveItem(p,item){
  if(p.inventory.some(i=>i.uid===item.uid))return false;
  if(p.inventory.length>=BAG_LIMIT)return false;
  p.inventory.push(item);const slot=ITEM_BY_ID[item.def].slot;if(!p.equipped[slot])p.equipped[slot]=item.uid;return true;
}
export function salvageItem(p,uid){
  if(Object.values(p.equipped).includes(uid))return false;
  const n=p.inventory.findIndex(i=>i.uid===uid);if(n<0)return false;
  const [i]=p.inventory.splice(n,1);p.scrap+=3+(i.rarity+1)*i.level;return true;
}
export function makeDrop(p,random,opts={}){
  const {elite=false,guaranteedSlot=null}=opts;
  const list=guaranteedSlot?ITEMS.filter(d=>d.slot===guaranteedSlot):ITEMS;
  const d=list[Math.min(list.length-1,Math.floor(random()*list.length))];
  const r=random(),rarity=elite?3:r<.035?3:r<.22?2:r<.62?1:0;
  return createItem(d.id,p.level,rarity,random(),`item-${p.serial++}`);
}
// Small upgrade sink; equipped effects are preserved. No paid reroll or random purchase.
export function temperItem(p,uid){
  const item=p.inventory.find(i=>i.uid===uid);if(!item||item.level>=p.level)return false;
  const cost=8+item.level*3;if(p.scrap<cost)return false;p.scrap-=cost;item.level++;return true;
}

export function claimRewards(p){let n=0;while(p.rewards.length&&p.inventory.length<BAG_LIMIT){const i=p.rewards.shift();if(receiveItem(p,i))n++;}return n;}
