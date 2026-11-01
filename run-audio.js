/* Small synthesized sound palette. No audio downloads or network services. */
(function(root){
'use strict';
const KEY='gravity-run-sound-v1',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Sound{
 constructor(storage,{contextFactory}={}){
  this.storage=storage;this.enabled=true;this.context=null;this.voices=new Set();this.lastCue={};this.active=false;this.failed=false;this.ready=false;
  this.factory=contextFactory||((root.AudioContext||root.webkitAudioContext)?()=>new (root.AudioContext||root.webkitAudioContext)():null);
  try{this.enabled=storage.getItem(KEY)!=='off';}catch{}
 }
 async unlock(){
  // Call only from a tap/click: browsers require a gesture to start Web Audio.
  if(!this.enabled||!this.factory)return false;
  try{
   if(!this.context){
    const c=this.context=this.factory();this.master=c.createGain();this.master.gain.value=.42;
    const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=18;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.18;
    this.master.connect(limiter);limiter.connect(c.destination);
    const buffer=c.createBuffer(1,Math.floor(c.sampleRate*.5),c.sampleRate),samples=buffer.getChannelData(0);let seed=12345;
    for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=(seed/4294967296*2-1)*.65;}
    this.rolling=c.createBufferSource();this.rolling.buffer=buffer;this.rolling.loop=true;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=450;
    this.rollGain=c.createGain();this.rollGain.gain.value=0;
    this.rolling.connect(this.filter);this.filter.connect(this.rollGain);this.rollGain.connect(this.master);this.rolling.start();this.ready=true;
   }
   if(this.context.state!=='running')await this.context.resume();
   this.failed=false;return this.context.state==='running';
  }catch{this.failed=true;if(!this.ready){try{if(this.context)Promise.resolve(this.context.close()).catch(()=>{});}catch{}this.context=null;this.master=null;this.rollGain=null;}return false;}
 }
 setEnabled(value){
  this.enabled=!!value;
  try{this.storage.setItem(KEY,this.enabled?'on':'off');}catch{}
  if(!this.enabled)this.silence();
  if(this.master){const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(this.enabled?.42:0,t,.015);}
 }
 tone(frequency,endFrequency,duration,volume=.08,delay=0,type='sine'){
  const c=this.context;
  if(!this.enabled||!c||c.state!=='running'||this.voices.size>=24)return;
  const start=c.currentTime+Math.max(0,delay),end=start+Math.max(.025,duration),osc=c.createOscillator(),gain=c.createGain();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(20,frequency),start);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),end);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(clamp(volume,.0002,.18),start+.008);gain.gain.exponentialRampToValueAtTime(.0001,end);
  osc.connect(gain);gain.connect(this.master);
  const voice={osc,gain};this.voices.add(voice);
  osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices.delete(voice);};
  osc.start(start);osc.stop(end+.015);
 }
 play(type,strength=1,variant=0){
  if(!this.enabled||!this.context||this.context.state!=='running')return;
  const now=this.context.currentTime,spacing={cell:.045,jump:.12,land:.12,gate:.18,fall:.8,recover:.4,checkpoint:.25,finish:1,start:.25,ui:.05}[type];
  if(spacing===undefined||now-(this.lastCue[type]??-Infinity)<spacing)return;
  this.lastCue[type]=now;const amount=clamp(Number.isFinite(strength)?strength:1,.15,1);
  const note=(a,b,d,v=.08,delay=0,wave='sine')=>this.tone(a,b,d,v*amount,delay,wave);
  switch(type){
   case 'ui':note(720,540,.055,.025);break;
   case 'start':note(392,392,.15,.075);note(587,587,.23,.07,.12);break;
   case 'jump':note(240,740,.20,.07,0,'triangle');break;
   case 'land':note(130,42,.17,.16);note(310,90,.06,.025);break;
   case 'gate':note(180,65,.16,.14,0,'triangle');break;
   case 'cell':{const pitch=[784,880,988,1175][Math.abs(variant)%4];note(pitch,pitch*1.025,.15,.075);note(pitch*1.5,pitch*1.5,.19,.045,.065);break;}
   case 'checkpoint':[523,659,784].forEach((pitch,i)=>note(pitch,pitch,.24,.07,i*.09));break;
   case 'fall':note(350,65,.45,.07,0,'triangle');break;
   case 'recover':note(294,392,.18,.055);note(440,440,.21,.055,.11);break;
   case 'finish':[523,659,784,1047].forEach((pitch,i)=>note(pitch,pitch,.38,.075,i*.13));break;
  }
 }
 handle(events){for(const event of events)this.play(event.type,event.strength??1,event.variant||0);}
 update(run,playing){
  this.active=!!playing;
  if(!this.context||!this.rollGain)return;
  const c=this.context,speed=Math.hypot(run.velocity[0],run.velocity[2]);
  const level=this.enabled&&playing&&run.grounded&&!run.falling?clamp((speed-.3)/10,0,1)*.1:0;
  this.rollGain.gain.setTargetAtTime(level,c.currentTime,.07);
  if(level>0){this.filter.frequency.setTargetAtTime(280+speed*55,c.currentTime,.12);this.rolling.playbackRate.setTargetAtTime(.7+speed*.055,c.currentTime,.12);}
 }
 silence(){
  this.active=false;this.lastCue={};
  if(!this.context)return;
  const t=this.context.currentTime;
  if(this.rollGain){this.rollGain.gain.cancelScheduledValues(t);this.rollGain.gain.setTargetAtTime(0,t,.01);}
  for(const voice of this.voices){try{voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(.0001,t,.008);voice.osc.stop(t+.03);}catch{}}
 }
}
root.GravityAudio={Sound,KEY};if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityAudio;
})(globalThis);
