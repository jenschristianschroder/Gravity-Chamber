/* Local campaign progress, with migration from the original Skyway record. */
(function(root){
'use strict';
const G=root.GravityRun,KEY='gravity-run-campaign-v1',LEGACY='gravity-run-skyway-best-v1';
class Progress{
 constructor(storage){
  this.storage=storage;this.records={};this.selected=0;this.saved=true;
  try{
   const data=JSON.parse(storage.getItem(KEY)||'null');
   if(data&&data.version===1&&data.records&&typeof data.records==='object'){
    for(const track of G.TRACKS){const record=data.records[track.id];if(record&&Number.isFinite(record.time)&&record.time>0)this.records[track.id]={time:record.time,cells:Number.isInteger(record.cells)&&record.cells>=0?record.cells:0};}
    if(Number.isInteger(data.selected))this.selected=G.clamp(data.selected,0,G.TRACKS.length-1);
   }
  }catch{}
  try{const legacy=Number(storage.getItem(LEGACY));if(legacy>0&&Number.isFinite(legacy)&&(!this.records.skyway||legacy<this.records.skyway.time))this.records.skyway={time:legacy,cells:0};}catch{}
  this.refreshUnlocks();
 }
 refreshUnlocks(){this.unlocked=1;while(this.unlocked<G.TRACKS.length&&this.records[G.TRACKS[this.unlocked-1].id])this.unlocked++;}
 isUnlocked(index){return Number.isInteger(index)&&index>=0&&index<this.unlocked;}
 record(index){return this.records[G.TRACKS[index].id]||null;}
 select(index){if(!Number.isInteger(index)||index<0||index>=G.TRACKS.length)return false;this.selected=index;this.save();return true;}
 complete(index,run){
  if(!this.isUnlocked(index)||!run.finished||!Number.isFinite(run.elapsed)||run.elapsed<=0)return null;
  const id=G.TRACKS[index].id,previous=this.records[id],oldUnlocked=this.unlocked;
  const record=!previous||run.elapsed<previous.time;
  this.records[id]={time:record?run.elapsed:previous.time,cells:Math.max(previous?previous.cells:0,Number.isInteger(run.collected)?run.collected:0)};
  this.refreshUnlocks();this.save();
  return {record,newUnlock:this.unlocked>oldUnlocked,campaignComplete:G.TRACKS.every(t=>!!this.records[t.id])};
 }
 save(){
  try{this.storage.setItem(KEY,JSON.stringify({version:1,selected:this.selected,records:this.records}));this.saved=true;}catch{this.saved=false;}
  return this.saved;
 }
}
root.GravityProgress={Progress,KEY};if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityProgress;
})(globalThis);
