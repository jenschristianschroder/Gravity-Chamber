(function(root){
'use strict';
const G=root.GravityRun;
const finite=v=>v&&['x','y','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));
class MotionInput{
 constructor(options={}){this.options=options;this.reset();}
 reset(){this.calibration=null;this.samples=[];this.first=0;this.last=0;this.gravity=null;this.controls={throttle:0,steer:0,turn:0};this.burst=[0,0,0];this.lastJump=-1000;this.lastNudge=-1000;this.gyro=false;this.readiness=0;this.reason='Hold your phone comfortably, with its top edge up.';}
 clearImpulses(){this.burst=[0,0,0];}
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
  this.gyro=typeof rate.gamma==='number'&&Number.isFinite(rate.gamma);
  if(!this.calibration){
   this.samples.push({at:now,g:rawGravity});this.samples=this.samples.filter(s=>now-s.at<=900);
   const values=this.samples.map(s=>s.g),stable=G.calibrate(values);
   this.readiness=stable?G.clamp((now-this.samples[0].at)/850,0,1):0;
   this.reason=Math.abs(rawGravity[1])<6?'Raise the phone a little; keep its top edge up.':stable?'Hold steady…':'Keep still for a moment.';
   if(stable&&now-this.samples[0].at>=850)this.calibration=stable;
   if(this.calibration)this.gravity=rawGravity.slice();
   return !!this.calibration;
  }
  this.controls=G.motionControls(this.gravity,this.gyro?rate:{},this.calibration,this.options);
  if(this.options.invertSteering){this.controls.steer=-this.controls.steer;this.controls.turn=-this.controls.turn;}
  const accel=(linear||total.map((v,i)=>v-this.gravity[i])).map(v=>v*this.calibration.polarity);
  if(now-this.lastJump>280&&(accel[1]>3.3||accel[1]<-4)){
   this.burst[1]=accel[1]>3.3?1:-1;this.lastJump=now;
  }
  if(this.options.advanced!==false&&now-this.lastNudge>350&&Math.hypot(accel[0],accel[2])>3.3){
   this.burst[0]=G.clamp(accel[0]*.2,-1.8,1.8)*(this.options.invertSteering?-1:1);this.burst[2]=G.clamp(-accel[2]*.2,-1.8,1.8);this.lastNudge=now;
  }
  return true;
 }
 consume(){const input={...this.controls,burst:this.burst.slice()};this.burst=[0,0,0];return input;}
}
root.GravityMotion={MotionInput};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityMotion;
})(globalThis);
