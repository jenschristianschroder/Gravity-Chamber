/* Versioned local records. Imported data is validated before state changes. */
(function(root){
'use strict';
const G=root.GravityRun,J=root.GravityJourney||(typeof require==='function'?require('./run-journey.js'):null),KEY='gravity-run-campaign-v1',LEGACY='gravity-run-skyway-best-v1';
const DEFAULTS={sensitivity:'balanced',advanced:false,invertSteering:false,quality:'auto',ghost:true,expert:false,appearance:'ivory',badge:'none'};
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function cleanRecord(r,legacy=false){
 if(!r||!finite(r.time,.001,7200))return null;
 const record={time:r.time,cells:Number.isInteger(r.cells)&&r.cells>=0&&r.cells<=100?r.cells:0,clean:r.clean===true,allCells:r.allCells===true,medal:Number.isInteger(r.medal)&&r.medal>=0&&r.medal<=3?r.medal:0,plays:Number.isInteger(r.plays)&&r.plays>=0&&r.plays<1000000?r.plays:1};
 if(legacy)record.legacy=true;
 if(Array.isArray(r.splits)&&r.splits.length<64&&r.splits.every(v=>v===null||finite(v,0,7200)))record.splits=r.splits;
 if(Array.isArray(r.ghost)&&r.ghost.length<=3000&&r.ghost.every((s,i)=>Array.isArray(s)&&s.length===5&&s.every(v=>finite(v,-10000,10000))&&s[0]>=0&&(i===0||s[0]>r.ghost[i-1][0])))record.ghost=r.ghost;
 return record;
}
function validKey(key){return G.TRACKS.some(t=>key===t.id||key===t.id+'-expert')||/^challenge-(?:[0-9]|1[0-7])-[ne]$/.test(key)||/^sprint-(?:[0-9]|1[0-7])-[0-5]$/.test(key)||/^daily-20\d{2}-\d{2}-\d{2}$/.test(key)&&J.validDay(key.slice(6));}
function settings(data={}){
 if(!data||typeof data!=='object')data={};
 const value={...DEFAULTS};
 for(const k of ['advanced','invertSteering','ghost','expert'])if(typeof data[k]==='boolean')value[k]=data[k];
 for(const [k,list] of Object.entries({sensitivity:['gentle','balanced','responsive'],quality:['auto','eco','balanced','high'],appearance:J.APPEARANCES.map(a=>a.id),badge:J.BADGES.map(a=>a.id)}))if(list.includes(data[k]))value[k]=data[k];
 return value;
}
function parse(raw){
 if(typeof raw!=='string'||raw.length>2500000)throw Error('Choose a Gravity Run backup smaller than 2.5 MB.');
 let d;try{d=JSON.parse(raw);}catch{throw Error('That backup is not valid JSON.');}
 if(!d||![1,2].includes(d.version)||!d.records||typeof d.records!=='object'||Array.isArray(d.records))throw Error('That file is not a supported Gravity Run backup.');
 if(d.version===2&&d.rules!==J.RULES)throw Error('That backup uses different course rules. Keep it for the matching game version.');
 const records={},legacy={};
 if(Object.keys(d.records).length>220)throw Error('The backup contains too many records.');
 for(const [key,r] of Object.entries(d.records)){if(!validKey(key))continue;const c=cleanRecord(r,d.version===1);if(c)(d.version===1?legacy:records)[key]=c;}
 if(d.version===2&&d.legacy&&typeof d.legacy==='object')for(const track of G.TRACKS){const c=cleanRecord(d.legacy[track.id],true);if(c)legacy[track.id]=c;}
 return {records,legacy,selected:Number.isInteger(d.selected)?G.clamp(d.selected,0,G.TRACKS.length-1):0,planetSelections:G.PLANETS.map((p,i)=>Number.isInteger(d.planetSelections?.[i])&&d.planetSelections[i]>=p.start&&d.planetSelections[i]<p.start+p.count?d.planetSelections[i]:Number.isInteger(d.selected)&&d.selected>=p.start&&d.selected<p.start+p.count?d.selected:p.start),tutorialDone:d.tutorialDone===true,settings:settings(d.settings)};
}
function mergeRecord(a,b){
 if(!a)return b;if(!b)return a;
 const fast=b.time<a.time?b:a;
 return {...fast,cells:Math.max(a.cells,b.cells),clean:a.clean||b.clean,allCells:a.allCells||b.allCells,medal:Math.max(a.medal,b.medal),plays:Math.max(a.plays,b.plays)};
}
class Progress{
 constructor(storage){
  this.storage=storage;this.records={};this.legacy={};this.selected=0;this.planetSelections=G.PLANETS.map(p=>p.start);this.saved=true;this.tutorialDone=false;this.settings={...DEFAULTS};
  try{const raw=storage.getItem(KEY);if(raw)Object.assign(this,parse(raw));}catch{}
  try{const time=Number(storage.getItem(LEGACY));if(finite(time,.001,7200)&&!this.legacy.skyway&&!this.records.skyway)this.legacy.skyway=cleanRecord({time,cells:0},true);}catch{this.saved=false;}
  this.trimDaily();this.refreshUnlocks();
 }
 hasTrack(index){const id=G.TRACKS[index].id;return !!(this.records[id]||this.records[id+'-expert']||this.legacy[id]);}
 refreshUnlocks(){this.unlockedByPlanet=G.PLANETS.map(p=>{let n=1;while(n<p.count&&this.hasTrack(p.start+n-1))n++;return n;});this.unlocked=this.unlockedByPlanet[0];}
 trimDaily(){const keys=Object.keys(this.records).filter(k=>k.startsWith('daily-')).sort().reverse();for(const key of keys.slice(14))delete this.records[key];}
 isUnlocked(index){const p=G.PLANETS.findIndex(p=>index>=p.start&&index<p.start+p.count);return Number.isInteger(index)&&p>=0&&index<G.PLANETS[p].start+this.unlockedByPlanet[p];}
 record(index,expert=false){const id=G.TRACKS[index].id;return this.records[id+(expert?'-expert':'')]||(!expert?this.legacy[id]:null)||null;}
 select(index){if(!Number.isInteger(index)||index<0||index>=G.TRACKS.length)return false;this.selected=index;this.planetSelections[Math.floor(index/6)]=index;this.save();return true;}
 marks(){return Object.entries(this.records).filter(([k])=>G.TRACKS.some(t=>k===t.id||k===t.id+'-expert')).reduce((n,[,r])=>n+r.medal+Number(r.clean)+Number(r.allCells),0);}
 badgeProgress(id){const records=G.TRACKS.map((_,i)=>this.record(i)).filter(r=>r&&!r.legacy),clean=records.filter(r=>r.clean).length,silver=records.filter(r=>r.medal>=2).length,clockwork=G.TRACKS.slice(6,12).map((_,i)=>this.record(i+6)).filter(r=>r&&!r.legacy&&r.clean).length;return id==='sprout'?{have:clean,need:1}:id==='star'?{have:silver,need:3}:id==='gear'?{have:clockwork,need:1}:{have:0,need:0};}
 badgeUnlocked(id){const p=this.badgeProgress(id);return J.BADGES.some(b=>b.id===id)&&p.have>=p.need;}
 nextReward(){const b=J.BADGES.find(b=>!this.badgeUnlocked(b.id));if(!b)return 'All antenna badges unlocked. Your collection is complete.';const p=this.badgeProgress(b.id);return b.name+' antenna · '+Math.max(0,p.need-p.have)+' '+b.goal+' to go';}
 appearanceUnlocked(id){const a=J.APPEARANCES.find(a=>a.id===id);return !!a&&this.marks()>=a.need;}
 complete(index,run){
  if(!this.isUnlocked(index))return null;
  const id=G.TRACKS[index].id+(run.course?.expert?'-expert':'');
  return this.completeKey(id,run,true);
 }
 completeKey(id,run,campaign=false){
  if(!validKey(id)||!run.finished||!finite(run.elapsed,.001,7200))return null;
  const planet=Math.floor((run.course?.index||0)/6),oldUnlocked=this.unlockedByPlanet[planet],oldMarks=this.marks(),previous=this.records[id],record=!previous||run.elapsed<previous.time;
  const maxCells=run.course?.cells.length??run.collected,rank=J.medal(run.elapsed,run.course?J.targets(run.course):J.TIMES[0]);
  const candidate={time:run.elapsed,cells:Number.isInteger(run.collected)?run.collected:0,clean:run.falls===0,allCells:maxCells>0&&run.collected===maxCells,medal:rank,plays:(previous?.plays||0)+1,splits:run.splits||[]};
  const ghost=run.replay;if(record&&ghost)candidate.ghost=ghost;
  this.records[id]=mergeRecord(previous,candidate);this.records[id].plays=candidate.plays;
  this.trimDaily();
  this.refreshUnlocks();this.save();
  return {record,previous:previous?.time,newUnlock:campaign&&this.unlockedByPlanet[planet]>oldUnlocked,campaignComplete:campaign&&G.TRACKS.slice(planet*6,planet*6+6).every((_,i)=>this.hasTrack(planet*6+i)),medal:rank,earned:this.records[id],newColors:J.APPEARANCES.filter(a=>a.need>oldMarks&&a.need<=this.marks()).map(a=>a.name)};
 }
 snapshot(){return {format:'gravity-run',version:2,rules:J.RULES,selected:this.selected,planetSelections:this.planetSelections,tutorialDone:this.tutorialDone,settings:this.settings,records:this.records,legacy:this.legacy};}
 export(){
  const data=this.snapshot();let raw=JSON.stringify(data);
  // A backup must always fit its own importer, even after many long ghost runs.
  if(raw.length>2400000){data.records=Object.fromEntries(Object.entries(this.records).map(([k,v])=>{const r={...v};delete r.ghost;return [k,r];}));raw=JSON.stringify(data);}
  return raw;
 }
 import(raw){
  const d=parse(raw);
  for(const [key,r] of Object.entries(d.records))this.records[key]=mergeRecord(this.records[key],r);
  for(const [key,r] of Object.entries(d.legacy))this.legacy[key]=mergeRecord(this.legacy[key],r);
  this.tutorialDone=this.tutorialDone||d.tutorialDone;this.trimDaily();this.refreshUnlocks();this.save();
  return {tracks:this.unlocked,records:Object.keys(this.records).length,saved:this.saved};
 }
 save(){
  try{this.storage.setItem(KEY,this.export());this.saved=true;}catch{
   try{const data=this.snapshot();data.records=Object.fromEntries(Object.entries(this.records).map(([k,v])=>{const r={...v};delete r.ghost;return [k,r];}));this.storage.setItem(KEY,JSON.stringify(data));this.saved=true;}catch{this.saved=false;}
  }
  return this.saved;
 }
}
const api={Progress,KEY,DEFAULTS,parse,cleanRecord};root.GravityProgress=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
