// Zhao Yun: same simulation/animation kit, opt-in procedural non-voxel render model.
import { MOVES,AIR_CHAIN_MAX } from '../../hero/moves.js';
import { ATTACK_CLIPS,MOVE_FEET } from '../../hero/anims/attacks.js';
import { LOCO_CLIPS,runPose,rollPose } from '../../hero/anims/locomotion.js';
import { createHeroModel } from '../../hero/model.js';
import { createSecondary } from '../../hero/secondary.js';
import { createMusou,MUSOU_CLIPS } from '../../musou/musou.js';
import { createMusouView } from '../../musou/view.js';
import { useInkHero,createInkHeroModel,createInkSecondary } from './ink-model.js';
export const ZHAOYUN_KIT={
  moves:MOVES,airChainMax:AIR_CHAIN_MAX,clips:{...ATTACK_CLIPS,...LOCO_CLIPS,...MUSOU_CLIPS},feet:MOVE_FEET,
  runPose,rollPose,dashPlant:MOVES.dash.lunge[1][0]+8,
  model:rig=>useInkHero()?createInkHeroModel(rig):createHeroModel(rig),
  secondary:(...args)=>useInkHero()?createInkSecondary(...args):createSecondary(...args),
  trail:{base:1.25,baseHeavy:1.05,tip:2.18},createMusou,createMusouView,
};
