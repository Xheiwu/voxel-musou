// Upstream crowd damage multiplies hero.atkK; its actor damage path does not.
// Adapt only this entry point so equipment also strengthens hits on the final chief.
// Allied chip damage still goes through actors.chip and is deliberately unaffected.
export function installActorDamageScaling(game){
  const original=game.actors.hurt;
  game.actors.hurt=(actor,damage,heavy,musou)=>original(actor,damage*(Number.isFinite(game.hero.atkK)?game.hero.atkK:1),heavy,musou);
  return ()=>{game.actors.hurt=original;};
}
