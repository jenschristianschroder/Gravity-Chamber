(function(root){
'use strict';
const G=root.GravityRun;
const finite=v=>v&&['x','y','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));
class MotionInput{
 constructor(){this.reset();}
 reset(){this.calibration=null;this.samples=[];this.first=0;this.last=0;this.gravity=null;this.controls={throttle:0,steer:0,turn:0};this.burst=[0,0,0];this.lastBurst=-1000;this.gyro=false;}
 feed(event,now){
  if(!finite(event.accelerationIncludingGravity))return false;
  const total=['x','y','z'].map(k=>event.accelerationIncludingGravity[k]);
  if(G.len(total)>40)return false;
  const dt=this.last?G.clamp((now-this.last)/1000,.002,.15):1/60;
  if(!this.first)this.first=now;this.last=now;
  const linear=finite(event.acceleration)?['x','y','z'].map(k=>event.acceleration[k]):null;
  const rawGravity=linear?total.map((v,i)=>v-linear[i]):total;
  const old=this.gravity||rawGravity;
  this.gravity=old.map((v,i)=>G.mix(v,rawGravity[i],1-Math.exp(-dt/.15)));
  const rate=event.rotationRate||{};
  this.gyro=['alpha','beta','gamma'].every(k=>typeof rate[k]==='number'&&Number.isFinite(rate[k]));
  if(!this.calibration){
   this.samples.push({at:now,g:rawGravity});this.samples=this.samples.filter(s=>now-s.at<=900);
   if(now-this.first>=850)this.calibration=G.calibrate(this.samples.map(s=>s.g));
   if(this.calibration)this.gravity=rawGravity.slice();
   return !!this.calibration;
  }
  this.controls=G.motionControls(this.gravity,this.gyro?rate:{},this.calibration);
  const accel=(linear||total.map((v,i)=>v-this.gravity[i])).map(v=>v*this.calibration.polarity);
  if(now-this.lastBurst>700&&G.len(accel)>3.3){
   this.burst=[G.clamp(accel[0]*.2,-1.8,1.8),accel[1]>3.3?1:accel[1]<-4?-1:0,G.clamp(-accel[2]*.2,-1.8,1.8)];
   this.lastBurst=now;
  }
  return true;
 }
 consume(){const input={...this.controls,burst:this.burst.slice()};this.burst=[0,0,0];return input;}
}
root.GravityMotion={MotionInput};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityMotion;
})(globalThis);
