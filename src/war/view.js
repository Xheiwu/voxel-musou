import * as THREE from 'three';
import {ground} from '../world/map.js';
import {RARITIES} from './data.js';
// Visual-only pools: dropping/equipping/damage are owned by session.js.
export function createWarView(scene,game,session){
  const root=new THREE.Group();scene.add(root);
  const gemGeo=new THREE.OctahedronGeometry(.25,0),gemMat=new THREE.MeshBasicMaterial();
  const gems=new THREE.InstancedMesh(gemGeo,gemMat,64);gems.frustumCulled=false;root.add(gems);
  const ringGeo=new THREE.RingGeometry(.86,1,40).rotateX(-Math.PI/2);
  const ringMat=new THREE.MeshBasicMaterial({transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
  const pulses=new THREE.InstancedMesh(ringGeo,ringMat,32);pulses.frustumCulled=false;root.add(pulses);
  const auraMat=new THREE.MeshBasicMaterial({color:0xd4b26c,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
  const aura=new THREE.Mesh(ringGeo,auraMat);root.add(aura);
  const standard=new THREE.Group();root.add(standard);
  const poleGeo=new THREE.CylinderGeometry(.055,.075,3.8,6),poleMat=new THREE.MeshBasicMaterial({color:0x505b51});
  const pole=new THREE.Mesh(poleGeo,poleMat);pole.position.y=1.9;standard.add(pole);
  const clothGeo=new THREE.PlaneGeometry(1.2,1.65,1,1),clothMat=new THREE.MeshBasicMaterial({color:0xb39855,side:THREE.DoubleSide});
  const cloth=new THREE.Mesh(clothGeo,clothMat);cloth.position.set(.57,2.8,0);standard.add(cloth);
  const marker=new THREE.Mesh(ringGeo,auraMat);marker.scale.setScalar(8.7);standard.add(marker);marker.position.y=.05;
  const obj=new THREE.Object3D(),color=new THREE.Color();
  const hues={whirlwind:'#86bba5',thunder:'#7baacb',blast:'#b95a43',dashwave:'#bfa36d'};
  return {
    update(){
      const r=session.run,t=game.frame/60;gems.count=r.drops.length;
      for(let i=0;i<r.drops.length;i++){
        const d=r.drops[i];obj.position.set(d.x,ground(d.x,d.z)+.48+Math.sin(t*2+i)*.09,d.z);obj.rotation.set(0,t*.7+i,0);obj.scale.setScalar(1+d.item.rarity*.18);obj.updateMatrix();gems.setMatrixAt(i,obj.matrix);gems.setColorAt(i,color.set(RARITIES[d.item.rarity].color));
      }
      gems.instanceMatrix.needsUpdate=true;if(gems.instanceColor)gems.instanceColor.needsUpdate=true;
      pulses.count=Math.min(32,r.fx.length);
      for(let i=0;i<pulses.count;i++){
        const f=r.fx[i],k=Math.min(1,(game.frame-f.start)/24);
        obj.position.set(f.x,ground(f.x,f.z)+.07,f.z);obj.rotation.set(0,0,0);obj.scale.setScalar(f.range*(.3+.7*k));obj.updateMatrix();pulses.setMatrixAt(i,obj.matrix);pulses.setColorAt(i,color.set(hues[f.kind]||'#d9d2b7'));
      }
      pulses.instanceMatrix.needsUpdate=true;if(pulses.instanceColor)pulses.instanceColor.needsUpdate=true;
      const h=game.hero;aura.visible=session.profile.level>=10&&!h.dead;aura.position.set(h.x,ground(h.x,h.z)+.035,h.z);aura.scale.setScalar(1.7+Math.sin(t*2)*.1);
      const target=session.target;standard.position.set(target[0],ground(...target),target[1]);standard.visible=!r.ended;
      cloth.rotation.y=Math.sin(t*1.3)*.12;clothMat.color.set(r.bossReady?0xcda64d:0x839180);marker.visible=r.bossReady&&!r.bossSpawned;
    },
    dispose(){scene.remove(root);for(const g of new Set([gemGeo,ringGeo,poleGeo,clothGeo]))g.dispose();for(const m of [gemMat,ringMat,auraMat,poleMat,clothMat])m.dispose();gems.dispose();pulses.dispose();},
  };
}
