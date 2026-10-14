import {validateProfile} from './progression.js';
export const SAVE_KEY='nameless-war-god.profile.v1';
export function loadProfile(storage){
  let raw;try{raw=storage.getItem(SAVE_KEY);}catch{return {profile:null,status:'unavailable'};}
  if(!raw)return {profile:null,status:'empty'};
  try{const profile=validateProfile(JSON.parse(raw));return profile?{profile,status:'ok'}:{profile:null,status:'corrupt'};}
  catch{return {profile:null,status:'corrupt'};}
}
export function saveProfile(storage,profile){try{storage.setItem(SAVE_KEY,JSON.stringify(profile));return true;}catch{return false;}}
export function browserStorage(){try{return window.localStorage;}catch{return {getItem(){throw Error('storage unavailable');},setItem(){throw Error('storage unavailable');}};}}
