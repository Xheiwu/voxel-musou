import * as THREE from 'three';
import {CHARS} from '../chars/index.js';
import {createInkHeroModel,createInkSecondary} from '../chars/zhaoyun/ink-model.js';
import {ORIGINS,PALETTES,RARITIES} from './data.js';
// New identity + private moves + new procedural body; historical hero metadata is not exposed.
export function createPlayerCharacter(profile){
  const base=CHARS.zhaoyun.kit;
  const moves=Object.fromEntries(Object.entries(base.moves).map(([id,m])=>[id,{...m,hits:m.hits.map(h=>({...h}))}]));
  const color=PALETTES[profile.palette];
  const kit={...base,moves,trail:{...base.trail},reach:{tip:2,butt:.8},
    model(rig){
      const model=createInkHeroModel(rig);
      model.colors={};
      for(const [name,mesh] of Object.entries(model.meshes)){
        if(['chest','head','spear','blade','collar'].includes(name)){
          mesh.material=model.material.clone();model.colors[name]=mesh;
        }
      }
      // Recolor teal cloth vertices, not the face or the white armor.
      const pigment=new THREE.Color(color);
      for(const mesh of Object.values(model.meshes)){
        const a=mesh.geometry.getAttribute('color');
        for(let i=0;i<a.count;i++)if(a.getY(i)>a.getX(i)*1.18&&a.getZ(i)>a.getX(i)*1.05)a.setXYZ(i,pigment.r,pigment.g,pigment.b);
        a.needsUpdate=true;
      }
      return model;
    },secondary:createInkSecondary,
    view(model,hero){
      const s=hero.warAppearance;if(!s||model.revision===s.revision)return;model.revision=s.revision;
      for(const key of ['spear','blade','collar'])if(model.colors[key]){
        model.colors[key].material.color.set(RARITIES[s.weaponRarity].color);
        model.colors[key].scale.z=s.reach;
      }
      if(model.colors.chest)model.colors.chest.material.color.set(s.armorRarity>=2?'#bdc7bf':'#ffffff');
      if(model.colors.head)model.colors.head.material.color.set(s.helmRarity>=2?'#e1cfab':'#ffffff');
    },
  };
  const name={zh:profile.name,en:'NAMELESS'};
  return {...CHARS.zhaoyun,id:'nameless',name,courtesy:name,seal:ORIGINS[profile.origin].seal,
    title:{zh:'无名战神',en:'NAMELESS WAR GOD'},motto:'从无名新卒，到阵前战神。',accent:color,
    lines:{intro:{zh:'今日一战，替自己立名。',en:''},musouEnd:{zh:'谁敢挡我！',en:''},copy:['一枪破阵','此战留名']},kit};
}
export function applyPlayerStats(hero,stats,profile,revision){
  const fraction=hero.hpMax>0?hero.hp/hero.hpMax:1;
  hero.hpMax=stats.hp;hero.hp=Math.min(stats.hp,Math.max(0,fraction*stats.hp));
  hero.atkK=stats.atk;hero.defK=stats.def;
  const source=CHARS.zhaoyun.kit;
  for(const [id,m] of Object.entries(hero.kit.moves))for(let i=0;i<m.hits.length;i++){
    const h=m.hits[i],original=source.moves[id].hits[i];
    for(const key of ['range','len','width'])if(original[key]!=null)h[key]=original[key]*stats.reach;
  }
  hero.kit.trail={...source.trail,base:source.trail.base*stats.reach,baseHeavy:source.trail.baseHeavy*stats.reach,tip:source.trail.tip*stats.reach};
  hero.kit.reach={tip:2*stats.reach,butt:.8*stats.reach};
  const rarity=slot=>profile.inventory.find(i=>i.uid===profile.equipped[slot])?.rarity||0;
  hero.warAppearance={revision,reach:stats.reach,weaponRarity:rarity('weapon'),armorRarity:rarity('armor'),helmRarity:rarity('helm')};
}
