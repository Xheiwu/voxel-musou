import * as THREE from 'three';
import { meshData,inkHeroParts } from './ink-geometry.js';
export function useInkHero(){return new URLSearchParams(location.search).get('models')==='ink';}
export function createInkHeroModel(rig){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,flatShading:true});
  const meshes={};
  for(const [part,spec] of Object.entries(inkHeroParts())){
    let joint=rig.joints[part];
    if(['spear','collar','blade'].includes(part))joint=rig.joints.weapon;
    if(part.startsWith('pauldron')){
      joint=new THREE.Object3D();joint.name=part;
      rig.joints['shoulder'+part.slice(-1)].add(joint);rig.joints[part]=joint;
    }
    if(!joint)throw new Error(`Ink hero: missing rig joint ${part}`);
    const data=meshData(spec),geo=new THREE.BufferGeometry();
    for(const key of ['position','normal','color'])geo.setAttribute(key,new THREE.Float32BufferAttribute(data[key],3));
    geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.name='ink-'+part;mesh.castShadow=mesh.receiveShadow=true;
    joint.add(mesh);meshes[part]=mesh;
  }
  return {meshes,material};
}
// Lightweight cloth animation: no spring-chain simulation or image assets.
export function createInkSecondary(root,rig,material,hero){
  const geo=new THREE.PlaneGeometry(.48,.66,4,6);geo.translate(0,-.24,-.155);
  const positions=geo.attributes.position,base=positions.array.slice();
  const colors=new Float32Array(positions.count*3),color=new THREE.Color(0xbac5bd);
  for(let i=0;i<positions.count;i++)color.toArray(colors,i*3);
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const clothMat=material.clone();clothMat.side=THREE.DoubleSide;
  const cape=new THREE.Mesh(geo,clothMat);cape.name='ink-cape';cape.castShadow=true;rig.joints.chest.add(cape);
  let t=0;
  return {
    reset(){t=0;positions.array.set(base);positions.needsUpdate=true;},
    update(dt){
      t+=Math.min(.1,Math.max(0,dt));
      for(let i=0;i<positions.count;i++){
        const j=i*3,k=THREE.MathUtils.clamp((.09-base[j+1])/.66,0,1);
        positions.array[j+2]=base[j+2]-(.09+Math.min(.10,(hero.speed||0)*.015))*k+Math.sin(t*3+base[j]*5+k*2)*.04*k;
      }
      positions.needsUpdate=true;geo.computeVertexNormals();
      for(const s of ['L','R']){
        const pd=rig.joints['pauldron'+s],arm=rig.joints['upperArm'+s];
        if(pd&&arm){pd.rotation.x=arm.rotation.x*.35;pd.rotation.z=arm.rotation.z*.35;}
      }
    },
  };
}
