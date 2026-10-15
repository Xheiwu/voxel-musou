import {createProfile,equipItem,salvageItem,temperItem,claimRewards} from './progression.js';
import {cleanName,ORIGINS,PALETTES} from './data.js';
import {loadProfile,saveProfile,browserStorage} from './store.js';
import {createWarUI} from './ui.js';
import {initWarViewport} from './viewport.js';
const viewport=initWarViewport();
const storage=browserStorage(),loaded=loadProfile(storage);let profile=loaded.profile,engine=null,busy=false;
const ui=createWarUI({
  async start(options){
    if(busy)return;
    if(viewport.refresh().portrait){ui.notice('请先横屏，再持枪出征。');return;}
    if(profile?.rewards.length>=8){ui.notice('先整理行囊领取暂存奖励。');return;}
    busy=true;
    if(!profile)profile=createProfile(options);
    else {profile.name=cleanName(options.name);profile.origin=Object.hasOwn(ORIGINS,options.origin)?options.origin:profile.origin;profile.palette=Object.hasOwn(PALETTES,options.palette)?options.palette:profile.palette;}
    claimRewards(profile);const stored=saveProfile(storage,profile);ui.setProfile(profile,stored?'ok':'unavailable');ui.loading();
    // Every module sees the same configuration before dynamic engine imports evaluate.
    const url=new URL(location.href);url.searchParams.set('style','ink');url.searchParams.set('camera','battle');url.searchParams.set('models','ink');url.searchParams.set('quality',options.quality);
    try{history.replaceState(null,'',url);}catch{}
    try{const {startWar}=await import('./app.js');engine=await startWar({profile,options,ui,save:p=>saveProfile(storage,p)});}
    catch(error){console.error(error);ui.fatal(error);}finally{busy=false;}
  },
  command(command){
    if(engine){engine.command(command);return;}
    if(!profile)return;
    const changed=command.type==='equip'?equipItem(profile,command.uid):command.type==='salvage'?salvageItem(profile,command.uid):command.type==='temper'?temperItem(profile,command.uid):false;
    if(changed){claimRewards(profile);saveProfile(storage,profile);ui.setProfile(profile);ui.renderInventory();}
  },
  pause(){engine?.pause();},resume(){engine?.resume();},
  retreat(){engine?.save();location.assign(new URL('./war.html',location.href));},
  newProfile(){profile=createProfile();saveProfile(storage,profile);ui.setProfile(profile);},
});
ui.setProfile(profile,loaded.status);
