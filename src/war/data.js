// Design data, independent of Three.js. All percentages are fractions, not display strings.
export const VERSION = 1;
export const MAX_LEVEL = 20;
export const BAG_LIMIT = 48;
export const SLOT_NAMES = { weapon:'兵器', armor:'战甲', helm:'头盔', boots:'战靴', charm:'兵符', banner:'战旗' };
export const RARITIES = [
  { name:'普通', color:'#64716c', factor:1 },
  { name:'精良', color:'#347967', factor:1.2 },
  { name:'稀有', color:'#546faf', factor:1.5 },
  { name:'传奇', color:'#ae7428', factor:1.9 },
];
export const ORIGINS = {
  vanguard:{ name:'破阵先锋', seal:'锋', color:'#43877b', desc:'攻击提高 12%；用长枪正面撕开敌阵。', atk:.12, hp:0, def:0, starter:'sweep-spear' },
  guardian:{ name:'铁衣卫士', seal:'卫', color:'#627ba0', desc:'额外 70 生命、15% 防御系数；容错更高。', atk:0, hp:70, def:.15, starter:'iron-spear' },
  reaper:{ name:'追魂游将', seal:'魂', color:'#a65346', desc:'击杀额外恢复 0.3 怒气；更快释放无双。', atk:0, hp:0, def:0, rage:.3, starter:'soul-spear' },
};
export const PALETTES = { jade:'#43877b', vermilion:'#a65346', indigo:'#627ba0' };
export const TRAITS = {
  whirlwind:{ name:'旋锋', desc:'普通招式累计命中 5 次后，释放一次半径 3.8 米旋风；冷却 2 秒。' },
  thunder:{ name:'引雷', desc:'重击命中时，在命中中心落雷；冷却 2.5 秒，对首领伤害减半。' },
  blast:{ name:'燎原', desc:'直接击杀小兵时引爆附近敌人；冷却 0.5 秒，爆炸不触发新的爆炸。' },
  soul:{ name:'追魂', desc:'每次击杀额外恢复 0.7 怒气，最多每秒额外恢复 4 怒气。' },
  leech:{ name:'饮血', desc:'每次击杀恢复 5 生命，最多每秒恢复 25 生命。' },
  dashwave:{ name:'踏阵', desc:'闪避起手释放冲击波；冷却 3 秒。' },
  bulwark:{ name:'不屈', desc:'生命低于 30% 时减少所受伤害；每 20 秒触发一次 5 秒护体。' },
};
// The first slice uses one spear animation family, three origins, and six equipment slots.
// Other weapon families are NOT advertised as implemented.
export const ITEMS = [
  { id:'iron-spear', name:'折冲铁枪', slot:'weapon', atk:.10, reach:.03 },
  { id:'sweep-spear', name:'旋锋长枪', slot:'weapon', atk:.05, reach:.08, trait:'whirlwind' },
  { id:'storm-spear', name:'引雷战枪', slot:'weapon', atk:.08, trait:'thunder' },
  { id:'ember-spear', name:'燎原赤枪', slot:'weapon', atk:.10, trait:'blast' },
  { id:'soul-spear', name:'追魂铁枪', slot:'weapon', atk:.06, trait:'soul' },
  { id:'iron-armor', name:'玄铁战甲', slot:'armor', hp:50, def:.16 },
  { id:'blood-armor', name:'饮血披甲', slot:'armor', hp:25, trait:'leech' },
  { id:'guard-helm', name:'不屈铁盔', slot:'helm', hp:25, def:.06, trait:'bulwark' },
  { id:'edge-helm', name:'破军兜鍪', slot:'helm', atk:.06, hp:20 },
  { id:'dash-boots', name:'踏阵战靴', slot:'boots', def:.06, trait:'dashwave' },
  { id:'march-boots', name:'轻行战靴', slot:'boots', hp:25, reach:.06 },
  { id:'storm-charm', name:'雷公兵符', slot:'charm', atk:.04, trait:'thunder' },
  { id:'soul-charm', name:'追魂兵符', slot:'charm', hp:15, trait:'soul' },
  { id:'fire-banner', name:'燎原战旗', slot:'banner', atk:.04, trait:'blast' },
  { id:'wind-banner', name:'长风战旗', slot:'banner', reach:.09, trait:'whirlwind' },
  { id:'blood-banner', name:'血战旌旗', slot:'banner', hp:30, trait:'leech' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(d=>[d.id,d]));
export const BATTLE = { firstCaptain:45, secondCaptain:110, bossKills:180, bossLevel:8, groundLimit:64 };
export function rankName(level) { return level>=15?'战神':level>=10?'万人敌':level>=5?'悍将':'无名新卒'; }
export function xpNeeded(level) { return 26+Math.floor(8*Math.pow(Math.max(1,level),1.25)); }
export function finiteNumber(v, fallback, min, max) { return typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback; }
export function cleanName(v) { return [...String(v??'无名')].filter(c=>!/[\u0000-\u001f\u007f<>]/u.test(c)).slice(0,12).join('').trim()||'无名'; }
