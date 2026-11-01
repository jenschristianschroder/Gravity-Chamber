/* Gravity Run: deterministic course and motion-driven physics, in metres. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const len=v=>Math.hypot(v[0],v[1],v[2]);
const norm=v=>{const n=len(v)||1;return v.map(x=>x/n);};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const TRACKS=[
 {id:'skyway',name:'Skyway',level:'Easy',description:'Find your balance above the coast.',sky:[.73,.86,.90],bridge:1.35,opening:1.2,gateSpeed:.8},
 {id:'seabreeze',name:'Seabreeze',level:'Steady',description:'Long bridges and a sweeping coastal loop.',sky:[.65,.83,.85],bridge:1.2,opening:1.1,gateSpeed:.92},
 {id:'switchback',name:'Switchback',level:'Tricky',description:'Brake for hairpins. Commit to the double jump.',sky:[.87,.81,.69],bridge:1.1,opening:1.03,gateSpeed:1.04},
 {id:'cloudspire',name:'Cloudspire',level:'Hard',description:'Climb a corkscrew into the high clouds.',sky:[.77,.83,.94],bridge:1,opening:.96,gateSpeed:1.16},
 {id:'fracture',name:'Fracture',level:'Expert',description:'Broken causeways demand precise landings.',sky:[.76,.80,.83],bridge:.9,opening:.89,gateSpeed:1.28},
 {id:'eventide',name:'Eventide',level:'Master',description:'One final gauntlet. Every movement matters.',sky:[.74,.72,.85],bridge:.8,opening:.82,gateSpeed:1.4}
];
function calibrate(samples){
 if(samples.length<8)return null;
 const mean=[0,1,2].map(i=>samples.reduce((s,v)=>s+v[i],0)/samples.length);
 if(len(mean)<8||len(mean)>12||Math.abs(mean[1])<6)return null;
 if(Math.max(...samples.map(v=>len(sub(v,mean))))>.8)return null;
 const polarity=mean[1]<0?-1:1,g=mean.map(x=>x*polarity);
 return {polarity,pitch:Math.atan2(g[2],g[1]),roll:Math.atan2(g[0],g[1])};
}
function motionControls(gravity,rotation,calibration){
 const g=gravity.map(v=>v*calibration.polarity);
 return {
  throttle:clamp((Math.atan2(g[2],g[1])-calibration.pitch)*2.4,-1,1),
  steer:clamp(-(Math.atan2(g[0],g[1])-calibration.roll)*2.2,-1,1),
  turn:clamp((rotation.beta||0)/100,-1,1)
 };
}
function displayLayout(width,height,angle){
 const a=((angle%360)+360)%360,q=a===90||a===270;
 return {width:q?height:width,height:q?width:height,rotation:-a||0};
}
class Course{
 constructor(trackIndex=0){
  this.index=Number.isInteger(trackIndex)?clamp(trackIndex,0,TRACKS.length-1):0;this.track=TRACKS[this.index];
  this.points=[];this.sections=[];this.gates=[];this.gaps=[];this.checkpoints=[];this.cells=[];
  if(this.index){this.buildAdvanced();return;}
  const add=(p,width,section,gap=false)=>{const prev=this.points[this.points.length-1];this.points.push({p,width,section,gap,s:prev?prev.s+Math.hypot(p[0]-prev.p[0],p[2]-prev.p[2]):0});};
  const bezier=(a,b,c,d,width,section,gap=false)=>{
   const estimate=len(sub(a,b))+len(sub(b,c))+len(sub(c,d)),n=Math.ceil(estimate/1.1);
   if(this.points.length){const last=this.points[this.points.length-1];last.gap=gap;last.section=section;}
   for(let i=this.points.length?1:0;i<=n;i++){const t=i/n,u=1-t;add(a.map((v,k)=>u*u*u*v+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]),width,section,gap);}
  };
  const line=(a,b,width,section,gap=false)=>bezier(a,a.map((x,i)=>mix(x,b[i],1/3)),a.map((x,i)=>mix(x,b[i],2/3)),b,width,section,gap);
  const mark=(name)=>{this.sections.push({name,s:this.points.length?this.points[this.points.length-1].s:0});return this.sections.length-1;};
  let k=mark('Find your feet');
  line([0,6,0],[0,5.5,28],4.4,k);
  k=mark('Coastal curves');
  bezier([0,5.5,28],[0,5,43],[22,4.1,43],[18,3.5,62],3.6,k);
  bezier([18,3.5,62],[18,3.2,78],[-13,3,75],[-13,2.8,96],3.3,k);
  k=mark('The skybridge');const bridgeStart=this.points[this.points.length-1].s;
  line([-13,2.8,96],[-13,2.2,122],1.35,k);
  k=mark('Moving gates');const gatesStart=this.points[this.points.length-1].s;
  bezier([-13,2.2,122],[-13,2,137],[0,1.1,139],[0,.8,155],3.8,k);
  k=mark('Leap of faith');const rampStart=this.points[this.points.length-1].s;
  line([0,.8,155],[0,.9,163],3.2,k);
  line([0,.9,163],[0,3.2,171],3.2,k);
  this.gapStart=this.points[this.points.length-1].s;
  line([0,3.2,171],[0,2.7,175.5],3.2,k,true);
  this.gapEnd=this.points[this.points.length-1].s;
  this.gaps.push({start:this.gapStart,end:this.gapEnd});
  bezier([0,2.7,175.5],[0,2.4,189],[18,2.1,188],[18,1.6,199],3.6,k);
  k=mark('Spiral descent');const spiralStart=this.points[this.points.length-1].s;
  for(let i=1;i<=82;i++){const t=i/82,a=-Math.PI/2+t*Math.PI*1.5;add([18+17*Math.cos(a),mix(1.6,-4.4,t),216+17*Math.sin(a)],3.3,k);}
  line([1,-4.4,216],[1,-5,194],4.5,k);
  this.total=this.points[this.points.length-1].s;
  this.checkpoints=[{s:2,label:'Start'},{s:bridgeStart-5,label:'Skybridge'},{s:rampStart+1,label:'Launch ramp'},{s:spiralStart+2,label:'Spiral'}];
  this.gates=[{s:gatesStart+13,phase:0},{s:gatesStart+28,phase:2}];
  for(let s=14,i=0;s<this.total-8;s+=21,i++){const q=this.at(s);if(q.gap)continue;this.cells.push({s,offset:q.width<2?0:(i%2?-.7:.7),taken:false});}
 }
 buildAdvanced(){
  const level=this.index,t=this.track;let p=[0,6,0],heading=0,section=0;
  const distance=()=>this.points.length?this.points[this.points.length-1].s:0;
  const add=(position,width,gap=false)=>{const previous=this.points[this.points.length-1];this.points.push({p:position,width,section,gap,s:previous?previous.s+Math.hypot(position[0]-previous.p[0],position[2]-previous.p[2]):0});};
  const prepare=(width,gap)=>{if(!this.points.length)add(p.slice(),width,gap);else{const last=this.points[this.points.length-1];last.section=section;last.gap=gap;}};
  const line=(length,dy=0,width=2.8,gap=false)=>{
   prepare(width,gap);const start=p.slice(),n=Math.ceil(length);
   for(let i=1;i<=n;i++){const u=i/n;add([start[0]+Math.sin(heading)*length*u,start[1]+dy*u,start[2]+Math.cos(heading)*length*u],width,gap);}
   p=this.points[this.points.length-1].p.slice();
  };
  const arc=(degrees,radius,dy=0,width=2.6)=>{
   prepare(width,false);const start=p.slice(),angle=degrees*Math.PI/180,sign=Math.sign(angle),initial=heading,n=Math.ceil(Math.abs(angle)*radius);
   for(let i=1;i<=n;i++){const u=i/n,a=initial+angle*u;add([start[0]+radius*sign*(Math.cos(initial)-Math.cos(a)),start[1]+dy*u,start[2]+radius*sign*(Math.sin(a)-Math.sin(initial))],width);}
   p=this.points[this.points.length-1].p.slice();heading+=angle;
  };
  const mark=(name,hint)=>{section=this.sections.length;this.sections.push({name,hint,s:distance()});};
  const checkpoint=label=>this.checkpoints.push({s:distance()+2,label});
  const gates=(count,length=38)=>{const start=distance();line(length,-.4,3-level*.1);for(let i=0;i<count;i++)this.gates.push({s:start+8+i*(length-16)/Math.max(1,count-1),phase:i*1.7+level*.4});};
  const jump=(length=4.7+level*.3)=>{
   line(10,0,2.7-level*.12);line(9,2.8,2.7-level*.12);
   const start=distance();line(length,-.65,2.7-level*.12,true);this.gaps.push({start,end:distance()});line(13,-.6,2.7-level*.12);
  };
  const bridge=(length=28)=>line(length,-.6,t.bridge);
  this.checkpoints.push({s:2,label:'Start'});
  if(level===1){
   mark('Coastal departure','Settle into a gentle rhythm.');line(30,-.5,3.8);arc(65,25,-.5,3.3);
   mark('Long crossing','Hold your line. This bridge is longer.');checkpoint('Crossing');bridge(36);line(9,0,3);arc(-100,22,-1,3);
   mark('Tidal gates','Time your approach through three moving openings.');gates(3,48);
   mark('Across the inlet','Build speed and hop at the ramp lip.');checkpoint('Inlet');jump(5);
   mark('Far shore','Brake before the bend, then balance across.');arc(150,21,-1.5,2.8);bridge(28);line(12,0,3);
   mark('Homeward','A final sweep back toward the finish.');checkpoint('Homeward');arc(-100,25,-1.2,3);line(30,-.5,4);
  }else if(level===2){
   mark('Warm-up bend','Brake before a tight turn.');line(24,-.4,3.5);arc(75,16,-.8,2.8);
   mark('The hairpins','Lean into each hairpin. Keep your speed down.');checkpoint('Hairpins');arc(-150,12,-1,2.5);line(18,0,2.5);arc(150,12,-1,2.5);
   mark('First flight','Hop just before the first gap.');checkpoint('First flight');jump(5.3);
   mark('Narrow escape','A tight bridge leads to faster gates.');bridge(34);line(9,0,3);gates(3,44);
   mark('Second flight','Reset your balance before the next jump.');checkpoint('Second flight');arc(-90,18,-.5,2.5);jump(5.3);
   mark('The last switch','Slow down for one last hairpin.');arc(150,13,-1,2.4);line(25,-.5,4);
  }else if(level===3){
   mark('Cloud approach','Climb steadily. Keep some momentum.');line(30,2,3.3);arc(90,20,2,2.6);
   mark('The corkscrew','A rising spiral: steer smoothly, avoid the edge.');checkpoint('Corkscrew');arc(-270,17,9,2.3);
   mark('High crossing','A very narrow bridge high above the clouds.');bridge(38);line(9,0,3);gates(2,34);
   mark('Cloud leap','Jump from the ramp and settle before the turn.');checkpoint('Cloud leap');jump(5.6);arc(100,15,-2,2.4);
   mark('Thin air','Two faster gates, then another launch.');gates(2,34);jump(5.6);
   mark('Spiral home','Control your speed down the final spiral.');arc(-210,19,-9,2.2);line(26,-.5,4);
  }else if(level===4){
   mark('Broken coast','Balance early. The causeway gets narrow.');line(26,-.4,3.2);arc(-60,18,-1,2.4);bridge(30);
   mark('First fracture','Line up the landing before you jump.');jump(5.9);arc(110,14,-1,2.2);
   mark('Moving walls','Three fast gates need patient timing.');checkpoint('Moving walls');gates(3,44);bridge(32);line(9,0,2.5);
   mark('Island chain','Two gaps. Land, settle, and jump again.');jump(5.9);arc(-75,15,-1,2.2);jump(5.9);
   mark('Needle passage','The narrowest bridge so far. Gentle movements.');checkpoint('Needle passage');bridge(40);line(9,0,2.5);gates(2,34);
   mark('The broken ring','Hold your line through a long final bend.');arc(230,16,-4,2.1);line(24,-.5,4);
  }else{
   mark('The final ascent','A demanding course. Build a steady rhythm.');line(26,2,3);gates(2,34);arc(105,15,2,2.1);
   mark('Razor crossing','Stay centered on the narrowest crossing.');bridge(40);line(9,0,2.3);jump(6.2);
   mark('Eventide spiral','Climb the spiral, then align for the gate.');arc(-270,14,7,2);gates(1,24);
   mark('Last refuge','Final checkpoint. Three jumps remain.');checkpoint('Last refuge');jump(6.2);arc(125,13,-2,2);jump(6.2);
   mark('The gauntlet','Three fast gates and a long, thin crossing.');gates(3,44);bridge(44);line(10,0,2.2);
   mark('Beyond the horizon','One final jump. Bring it home.');jump(6.2);arc(-210,15,-6,1.9);line(28,-.5,4);
  }
  this.total=distance();this.gapStart=this.gaps[0].start;this.gapEnd=this.gaps[0].end;
  for(let s=14,i=0;s<this.total-8;s+=22,i++){
   const q=this.at(s);if(q.gap||this.gaps.some(g=>Math.abs(g.start-s)<4||Math.abs(g.end-s)<5))continue;
   this.cells.push({s,offset:q.width<2?0:(i%2?-.55:.55),taken:false});
  }
 }
 at(s){
  s=clamp(s,0,this.total===undefined?this.points[this.points.length-1].s:this.total);
  let lo=0,hi=this.points.length-2;
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(this.points[m].s<=s)lo=m;else hi=m-1;}
  return this.segment(lo,clamp((s-this.points[lo].s)/(this.points[lo+1].s-this.points[lo].s||1),0,1));
 }
 segment(i,t){
  const a=this.points[i],b=this.points[i+1],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],horizontal=Math.hypot(dx,dz)||1;
  const tangent=[dx/horizontal,0,dz/horizontal];
  return {p:a.p.map((v,k)=>mix(v,b.p[k],t)),width:mix(a.width,b.width,t),section:a.section,gap:a.gap,s:mix(a.s,b.s,t),index:i,tangent,right:[tangent[2],0,-tangent[0]],slope:(b.p[1]-a.p[1])/horizontal};
 }
 closest(p,hint){
  let best=null,min=Infinity;
  for(let i=Math.max(0,hint-16);i<Math.min(this.points.length-1,hint+30);i++){
   const a=this.points[i].p,b=this.points[i+1].p,dx=b[0]-a[0],dz=b[2]-a[2];
   const t=clamp(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1),0,1),x=mix(a[0],b[0],t),z=mix(a[2],b[2],t);
   const d=(p[0]-x)**2+(p[2]-z)**2;
   if(d<min){min=d;best=this.segment(i,t);}
  }
  best.offset=dot(sub(p,best.p),best.right);return best;
 }
 gateCenter(gate,time){const q=this.at(gate.s);return Math.sin(time*this.track.gateSpeed+gate.phase)*Math.max(0,q.width-this.track.opening-.45);}
 cellPosition(cell){const q=this.at(cell.s);return [q.p[0]+q.right[0]*cell.offset,q.p[1]+.8,q.p[2]+q.right[2]*cell.offset];}
}
class Run{
 constructor(course=new Course()){this.course=course;this.radius=.44;this.reset();}
 reset(){
  this.elapsed=0;this.time=0;this.falls=0;this.collected=0;this.checkpoint=0;this.maxProgress=2;this.finished=false;
  this.event='';this.eventKind='';this.events=[];this.flash=0;this.jumpCooldown=0;this.gateCooldown=0;
  this.course.cells.forEach(c=>c.taken=false);this.place(2);
 }
 place(s){const q=this.course.at(s);this.position=[q.p[0],q.p[1]+this.radius,q.p[2]];this.velocity=[0,0,0];this.hint=q.index;this.grounded=true;this.falling=false;this.progress=q.s;this.surface=q;this.yaw=Math.atan2(q.tangent[0],q.tangent[2]);}
 emit(type,details={}){this.events.push({type,position:this.position.slice(),...details});}
 announce(type,message,duration,details={}){this.event=message;this.eventKind=type;this.flash=duration;this.emit(type,details);}
 recover(){
  this.falls++;this.elapsed+=2;this.place(this.course.checkpoints[this.checkpoint].s);this.jumpCooldown=.5;
  this.announce('recover','Checkpoint recovery · +2s',1.8);
 }
 step(dt,input){
  if(!(dt>0&&dt<=1/30))throw new RangeError('Fixed physics step required.');
  this.events=[];
  if(this.finished)return;
  this.elapsed+=dt;this.time+=dt;this.flash=Math.max(0,this.flash-dt);this.jumpCooldown-=dt;this.gateCooldown-=dt;
  const q=this.course.closest(this.position,this.hint);this.hint=q.index;this.surface=q;this.progress=q.s;
  const oldY=this.position[1],wasGrounded=this.grounded,groundBefore=this.grounded&&!q.gap&&Math.abs(q.offset)<q.width;
  const along=dot(this.velocity,q.tangent),lateral=dot(this.velocity,q.right);
  const throttle=clamp(input.throttle||0,-1,1),steer=clamp(input.steer||0,-1,1),turn=clamp(input.turn||0,-1,1);
  let forward=(groundBefore?13:4)*throttle-(groundBefore?12.5*q.slope:0),side=(groundBefore?17:4)*steer+turn*5;
  const burst=input.burst||[0,0,0];
  if(this.jumpCooldown<=0&&len(burst)>0){
   this.velocity[0]+=q.right[0]*clamp(burst[0],-2,2)+q.tangent[0]*clamp(burst[2],-2,2);
   this.velocity[2]+=q.right[2]*clamp(burst[0],-2,2)+q.tangent[2]*clamp(burst[2],-2,2);
   if(!groundBefore&&burst[1]<-.5)this.velocity[1]-=1.8;
   if(groundBefore&&burst[1]>.5){this.velocity[1]=Math.max(4.9,along*q.slope+4.5);this.grounded=false;this.announce('jump','Nice lift',.8);}
   this.jumpCooldown=.65;
  }
  if(this.grounded&&groundBefore)this.velocity[1]=along*q.slope;
  const drag=Math.exp(-(groundBefore?.46:.08)*dt);
  this.velocity[0]=(this.velocity[0]+(q.tangent[0]*forward+q.right[0]*side)*dt)*drag;
  this.velocity[2]=(this.velocity[2]+(q.tangent[2]*forward+q.right[2]*side)*dt)*drag;
  const speed=Math.hypot(this.velocity[0],this.velocity[2]);if(speed>11){this.velocity[0]*=11/speed;this.velocity[2]*=11/speed;}
  this.velocity[1]-=12.5*dt;this.position=this.position.map((v,i)=>v+this.velocity[i]*dt);
  const next=this.course.closest(this.position,this.hint);this.hint=next.index;this.surface=next;this.progress=next.s;
  const floor=next.p[1]+this.radius,support=!next.gap&&Math.abs(next.offset)<next.width;
  this.grounded=false;
  if(support&&this.position[1]<=floor&&oldY>=floor-.45){
   const surfaceSpeed=dot(this.velocity,next.tangent)*next.slope,impact=surfaceSpeed-this.velocity[1];
   this.position[1]=floor;this.velocity[1]=surfaceSpeed+(impact>3?Math.min(.65,impact*.08):0);this.grounded=impact<=3;
   if(!wasGrounded&&impact>2.2)this.emit('land',{strength:clamp(impact/9,.2,1)});
   this.falling=false;
  }
  for(const gate of this.course.gates){
   const g=this.course.at(gate.s),rel=sub(this.position,g.p),a=dot(rel,g.tangent),b=dot(rel,g.right),opening=this.course.gateCenter(gate,this.time);
   if(Math.abs(a)<.28+this.radius&&Math.abs(b-opening)>this.course.track.opening-this.radius&&Math.abs(b)<g.width+.3&&this.position[1]<g.p[1]+1.9&&this.position[1]>g.p[1]-.5&&this.gateCooldown<=0){
    const sign=a<0?-1:1,push=sign*(.3+this.radius)-a;this.position[0]+=g.tangent[0]*push;this.position[2]+=g.tangent[2]*push;
    const v=dot(this.velocity,g.tangent);this.velocity[0]-=g.tangent[0]*v*1.35;this.velocity[2]-=g.tangent[2]*v*1.35;
    this.gateCooldown=.25;this.announce('gate','Find the opening',.9,{strength:clamp(Math.abs(v)/7,.2,1)});
   }
  }
  if(this.grounded){
   this.maxProgress=Math.max(this.maxProgress,this.progress);
   this.course.checkpoints.forEach((cp,i)=>{if(i>this.checkpoint&&this.progress>=cp.s){this.checkpoint=i;this.announce('checkpoint','Checkpoint secured',1.8);}});
  }
  for(const cell of this.course.cells){if(!cell.taken&&Math.abs(cell.s-this.progress)<3&&len(sub(this.position,this.course.cellPosition(cell)))<1.05){cell.taken=true;this.collected++;this.announce('cell','Energy +1',.7,{variant:this.collected,position:this.course.cellPosition(cell)});}}
  if(!this.grounded&&!this.falling&&this.position[1]<next.p[1]-.8){this.falling=true;this.announce('fall','Returning to your checkpoint',1.5);}
  if(this.position[1]<next.p[1]-9||this.position.some(v=>!Number.isFinite(v))){this.recover();return;}
  if(this.grounded&&this.progress>=this.course.total-2.2){this.finished=true;this.announce('finish','Course complete',2);}
  const planar=Math.hypot(this.velocity[0],this.velocity[2]);
  if(planar>.4){const target=Math.atan2(this.velocity[0],this.velocity[2]);this.yaw+=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw))*(1-Math.exp(-dt*7));}
 }
 demoInput(){
  const q=this.surface,s=this.progress,course=this.course;
  let speed=5.2,offset=0;
  if(q.width<2)speed=4.2;
  if(course.gaps.some(g=>s>g.start-14&&s<g.end+6))speed=7+course.index*.12;
  for(const gate of course.gates)if(gate.s-s>-1&&gate.s-s<15){speed=3.6;offset=course.gateCenter(gate,this.time+Math.max(0,gate.s-s)/speed);}
  const aim=course.at(Math.min(course.total,s+3.2)),delta=[aim.p[0]+aim.right[0]*offset-this.position[0],0,aim.p[2]+aim.right[2]*offset-this.position[2]];
  const desired=norm(delta).map(v=>v*speed),acc=desired.map((v,i)=>(v-this.velocity[i])*3.5+this.velocity[i]*.46);
  const burst=(course.gaps.some(g=>s>g.start-1.7&&s<g.start-.15)&&this.grounded&&this.jumpCooldown<=0)?[0,1,0]:[0,0,0];
  return {throttle:clamp((dot(acc,q.tangent)+12.5*q.slope)/13,-1,1),steer:clamp(dot(acc,q.right)/17,-1,1),turn:0,burst};
 }
}
const api={clamp,mix,len,norm,dot,cross,sub,calibrate,motionControls,displayLayout,TRACKS,Course,Run};
root.GravityRun=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
