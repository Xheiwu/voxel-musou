// Queued effects, not recursive event listeners. Gear damage never triggers new gear damage.
export function createProcs(){
  const cooldown=new Map();let contacts=0,second=-1,healed=0,rage=0;
  const ready=(id,frame,cd)=>{if(frame<(cooldown.get(id)||0))return false;cooldown.set(id,frame+cd);return true;};
  return {
    reset(){cooldown.clear();contacts=0;second=-1;healed=rage=0;},
    resolve(event,stats,frame){
      const effects=[];
      if(typeof event.move==='string'&&event.move.startsWith('gear:'))return effects;
      const traits=stats.traits;
      const pulse=(kind,range,dmg,at,heavy=false)=>effects.push({type:'pulse',kind,range,dmg,x:at.x,z:at.z,heavy});
      if(event.type==='hits'&&event.count>0){
        if(traits.includes('whirlwind')&&++contacts>=5&&ready('whirlwind',frame,120)){contacts=0;pulse('whirlwind',3.8,13,event,true);}
        if(event.heavy&&traits.includes('thunder')&&ready('thunder',frame,150))pulse('thunder',2.8,32,event,true);
      }
      if(event.type==='ko'){
        if(Math.floor(frame/60)!==second){second=Math.floor(frame/60);healed=rage=0;}
        if(traits.includes('leech')){const n=Math.min(5,25-healed);if(n>0){effects.push({type:'heal',value:n});healed+=n;}}
        const want=stats.rage+(traits.includes('soul')?.7:0),n=Math.min(want,4-rage);
        if(n>0){effects.push({type:'rage',value:n});rage+=n;}
        if(traits.includes('blast')&&ready('blast',frame,30))pulse('blast',3.2,18,event);
      }
      if(event.type==='dodge'&&traits.includes('dashwave')&&ready('dashwave',frame,180))pulse('dashwave',3.1,16,event,true);
      if(event.type==='hurt'&&event.fraction<.3&&traits.includes('bulwark')&&ready('bulwark',frame,1200))effects.push({type:'guard',until:frame+300});
      return effects;
    },
  };
}
