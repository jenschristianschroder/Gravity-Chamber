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
// Skyway starts at half its old pace; .8 (the old Skyway rate) is the new cap.
// Its wider sweep needs a lower rate so lateral gate speed also rises by course.
const TRACKS=[
 {id:'skyway',name:'Skyway',level:'Easy',description:'Find your balance above the coast.',sky:[.73,.86,.90],bridge:1.35,opening:1.2,gateSpeed:.4},
 {id:'seabreeze',name:'Seabreeze',level:'Steady',description:'Long bridges and a sweeping coastal loop.',sky:[.65,.83,.85],bridge:1.2,opening:1.1,gateSpeed:.64},
 {id:'switchback',name:'Switchback',level:'Tricky',description:'Brake for hairpins. Commit to the double jump.',sky:[.87,.81,.69],bridge:1.1,opening:1.03,gateSpeed:.68},
 {id:'cloudspire',name:'Cloudspire',level:'Hard',description:'Climb a corkscrew into the high clouds.',sky:[.77,.83,.94],bridge:1,opening:.96,gateSpeed:.72},
 {id:'fracture',name:'Fracture',level:'Expert',description:'Broken causeways demand precise landings.',sky:[.76,.80,.83],bridge:.9,opening:.89,gateSpeed:.76},
 {id:'eventide',name:'Eventide',level:'Master',description:'One final gauntlet. Every movement matters.',sky:[.74,.72,.85],bridge:.8,opening:.82,gateSpeed:.8},
 {id:'brass-gardens',name:'Brass Gardens',level:'Easy',description:'Find a gentle rhythm among copper arches.',sky:[.85,.86,.74],bridge:2,opening:1.5,gateSpeed:.42},
 {id:'pendulum-park',name:'Pendulum Park',level:'Steady',description:'Read the arrows. Follow the rhythm.',sky:[.73,.86,.81],bridge:2,opening:1.4,gateSpeed:.48},
 {id:'ribbon-foundry',name:'Ribbon Foundry',level:'Tricky',description:'Bank through ribbons. Discover the gold route.',sky:[.88,.79,.68],bridge:2,opening:1.35,gateSpeed:.52},
 {id:'springworks',name:'Springworks',level:'Hard',description:'Climb, launch, and settle onto broad landings.',sky:[.75,.84,.89],bridge:2,opening:1.35,gateSpeed:.56},
 {id:'drift-docks',name:'Drift Docks',level:'Expert',description:'Moving landings reward a patient approach.',sky:[.72,.83,.81],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'grand-mechanism',name:'Grand Mechanism',level:'Master',description:'Bring rhythm, balance, and flight together.',sky:[.83,.76,.82],bridge:2,opening:1.25,gateSpeed:.64},
 {id:'high-tide',name:'High Tide',level:'45° banks',description:'Find the high edge. Hold your tilt against gravity.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'violet-bowl',name:'Violet Bowl',level:'50° banks',description:'Stay high through long, sweeping bowls.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'ridge-rider',name:'Ridge Rider',level:'55° banks',description:'Switch your uphill lean as the bank changes sides.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'cloud-wall',name:'Cloud Wall',level:'60° banks',description:'Ride steep walls above the clouds.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'gravity-weave',name:'Gravity Weave',level:'62° banks',description:'Link opposing banks with smooth transitions.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'zenith',name:'Zenith',level:'65° banks',description:'Master the high line on the steepest ribbons.',sky:[.75,.78,.9],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'ion-gardens',name:'Ion Gardens',level:'Easy',description:'Wide spirals and a first taste of magnetic flight.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'helix-harbour',name:'Helix Harbour',level:'Tricky',description:'Climb the helix. Balance through opposing corkscrews.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'night-ribbon',name:'Night Ribbon',level:'Hard',description:'Steer through slaloms while hanging beneath the track.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'orbit-forge',name:'Orbit Forge',level:'Expert',description:'Vertical loops and narrow exits demand speed control.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'broken-circuit',name:'Broken Circuit',level:'Extreme',description:'Time your hops between disconnected magnetic ribbons.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6},
 {id:'singularity',name:'Singularity',level:'Master',description:'Tight coils, ceiling turns and precision landings combined.',sky:[.65,.78,.85],bridge:2,opening:1.3,gateSpeed:.6}
];
const PLANETS=[{id:'sky-isles',name:'Sky Isles',start:0,count:6,description:'Your original floating adventure'},{id:'clockwork',name:'Clockwork',start:6,count:6,description:'Mechanical gardens. A new rhythm.'},{id:'vertigo',name:'Vertigo',start:12,count:6,description:'Steep banks. Lean uphill. Hold your line.'},{id:'flux',name:'Flux',start:18,count:6,description:'Magnetic worlds. Every direction is a new challenge.'}];
function calibrate(samples){
 if(samples.length<8)return null;
 const mean=[0,1,2].map(i=>samples.reduce((s,v)=>s+v[i],0)/samples.length);
 if(len(mean)<8||len(mean)>12||Math.abs(mean[1])<6)return null;
 if(Math.max(...samples.map(v=>len(sub(v,mean))))>.8)return null;
 const polarity=mean[1]<0?-1:1,g=mean.map(x=>x*polarity);
 return {polarity,pitch:Math.atan2(g[2],g[1]),roll:Math.atan2(g[0],g[1])};
}
function motionControls(gravity,rotation,calibration,options={}){
 const g=gravity.map(v=>v*calibration.polarity);
 const sensitivity=({gentle:.75,balanced:1,responsive:1.25})[options.sensitivity]||1;
 const dead=.022,axis=(angle,gain)=>Math.sign(angle)*clamp((Math.max(0,Math.abs(angle)-dead))*gain*sensitivity,-1,1);
 return {
  throttle:axis(Math.atan2(g[2],g[1])-calibration.pitch,2.55),
  steer:axis(-(Math.atan2(g[0],g[1])-calibration.roll),2.35),
  // gamma is rotation about the phone's bottom-to-top (Y) axis.
  turn:options.advanced===false?0:clamp((rotation.gamma||0)/100*sensitivity,-1,1)
 };
}
function displayLayout(width,height,angle){
 const a=((angle%360)+360)%360,q=a===90||a===270;
 return {width:q?height:width,height:q?width:height,rotation:-a||0};
}
class Course{
 constructor(trackIndex=0,options={}){
  this.index=Number.isInteger(trackIndex)?clamp(trackIndex,0,TRACKS.length-1):0;this.track=TRACKS[this.index];
  if(this.index>=18)return new MagneticCourse(this.index-18,options);
  this.points=[];this.sections=[];this.gates=[];this.gaps=[];this.checkpoints=[];this.cells=[];
  this.expert=!!options.expert;this.routes=[];this.platforms=[];
  if(this.index>=12)this.buildVertigo();else if(this.index>=6)this.buildClockwork();else if(this.index)this.buildAdvanced();else this.buildSkyway();
  this.expertCheckpoints=this.checkpoints.map(cp=>({...cp}));
  if(!this.expert)this.addCheckpoints();
  this.addVariety();
 }
 addCheckpoints(){
  if(this.index>=12){this.checkpoints=this.sections.map(s=>({s:s.s+2,label:s.name}));return;}
  const candidates=[...this.checkpoints,...this.sections.slice(1).map(section=>({s:section.s+2,label:section.name}))];
  for(let s=60;s<this.total-12;s+=60){const gap=this.gaps.find(g=>s>g.start-10&&s<g.end+5);candidates.push({s:gap?gap.end+6:s,label:'Rest point'});}
  this.checkpoints=[];
  for(const cp of candidates.sort((a,b)=>a.s-b.s))if(!this.at(cp.s).gap&&(!this.checkpoints.length||cp.s-this.checkpoints[this.checkpoints.length-1].s>10))this.checkpoints.push(cp);
 }
 addVariety(){
  if(this.index===1||this.index===4){
   const start=this.sections[this.index===1?4:5].s+1,end=start+(this.index===1?52:43),a=this.at(start),b=this.at(end),n=Math.ceil(len(sub(b.p,a.p))/.85),points=[];
   for(let i=0;i<=n;i++){const t=i/n;points.push({p:a.p.map((v,k)=>mix(v,b.p[k],t)),s:mix(start,end,t),width:i<3||i>n-3?mix(1.1,2,Math.max(0,1-Math.min(i,n-i)/3)):1.1,section:a.section,gap:false,bank:0});}
   this.routes.push({id:'shortcut',start,end,points,first:a.index,last:b.index});
   this.sections[a.section].hint='Gold edges mark a narrow shortcut. The wide route is safer.';
   const cell=this.cells.find(c=>c.s>start+10&&c.s<end-8);if(cell){cell.route='shortcut';cell.offset=0;}
  }
  if(this.index===4){this.platforms.push({gap:1,width:1.3,length:2.4,amplitude:.9,speed:.75,phase:.6});this.sections[3].hint='A drifting platform can break up the first gap. Watch its timing.';}
  if(this.index===5&&!this.expert)this.sections[3].hint='A new rest point. Settle your balance before the next jumps.';
 }
 buildVertigo(){
  const level=this.index-12,angle=[45,50,55,60,62,65][level],width=[3.2,3.1,3,2.9,2.8,2.7][level];
  let p=[0,12,0],heading=0,section=0;
  const distance=()=>this.points.at(-1)?.s||0;
  const add=(v,w,bank=0)=>{const prev=this.points.at(-1);this.points.push({p:v,width:w,bank,section,gap:false,s:prev?prev.s+Math.hypot(v[0]-prev.p[0],v[2]-prev.p[2]):0});};
  const line=(length,w=width)=>{if(!this.points.length)add(p.slice(),w);const start=p.slice();for(let i=1;i<=Math.ceil(length);i++){const d=length*i/Math.ceil(length);add([start[0]+Math.sin(heading)*d,start[1],start[2]+Math.cos(heading)*d],w);}p=this.points.at(-1).p.slice();};
  const mark=(name,hint)=>{section=this.sections.length;this.sections.push({s:distance(),name,hint});this.checkpoints.push({s:distance()+2,label:name});};
  const arc=(degrees,radius,peak=angle)=>{
   const start=p.slice(),initial=heading,turn=degrees*Math.PI/180,sign=Math.sign(turn),length=Math.abs(turn)*radius,n=Math.ceil(length/.65);
   for(let i=1;i<=n;i++){
    const u=i/n,a=initial+turn*u,edge=Math.min(u*length,(1-u)*length),t=clamp(edge/14,0,1),ease=t*t*(3-2*t);
    // The outside edge is the top of the bank; a long, smooth roll-in avoids a lip.
    add([start[0]+radius*sign*(Math.cos(initial)-Math.cos(a)),start[1],start[2]+radius*sign*(Math.sin(a)-Math.sin(initial))],width,-sign*Math.tan(peak*Math.PI/180*ease));
   }
   p=this.points.at(-1).p.slice();heading+=turn;
  };
  const turns=[[100,-110,120,-90],[155,-140,160,-115],[115,-135,145,-125],[170,-150,190,-130],[110,-160,120,-180],[180,-200,210,-170]][level];
  mark('Balance deck','The gold edge is uphill. Lean toward it to resist the slide.');line(26,4.3);
  const names=['First wall','Opposite edge','High line','Final bank'];
  for(let k=0;k<4;k++){
   mark(names[k],(turns[k]>0?'Left':'Right')+' edge high: lean '+(turns[k]>0?'left':'right')+' toward gold to counter gravity. Ease off as the track flattens.');
   line(10);arc(turns[k],26+level*2+(k%2)*3,Math.max(45,angle-(k===0?3:0)));line(14,3.8);
  }
  mark('Summit home','Release your uphill lean on the flat finish.');line(26,4.4);
  this.total=distance();this.gapStart=Infinity;this.gapEnd=Infinity;
  // Recovery decks are flat; normal mode must not create mid-wall spawn points.
  this.checkpoints=this.sections.filter((_,i)=>i%2===0).map(s=>({s:s.s+2,label:s.name}));
  for(let d=14,i=0;d<this.total-8;d+=19,i++){const q=this.at(d);this.cells.push({s:d,offset:Math.abs(q.bank)>.3?Math.sign(q.bank)*.4:0,taken:false});}
 }
 // Surface y = centre height + bank * lateral offset. Include changing bank and
 // curve radius in its longitudinal derivative, then project gravity onto it.
 surfaceFrame(q,offset=q.offset||0){
  const a=this.at(q.s-.65),b=this.at(q.s+.65),ds=Math.max(.001,b.s-a.s);
  const curvature=Math.atan2(a.tangent[2]*b.tangent[0]-a.tangent[0]*b.tangent[2],dot(a.tangent,b.tangent))/ds;
  const slope=(q.slope+offset*(b.bank-a.bank)/ds)/Math.max(.3,1-offset*curvature),bank=q.bank||0,d=1+slope*slope+bank*bank;
  return {slope,bank,d,normal:norm([-q.tangent[0]*slope-q.right[0]*bank,1,-q.tangent[2]*slope-q.right[2]*bank])};
 }
 buildClockwork(){
  const level=this.index-6;let p=[0,6,0],heading=0,section=0;
  const distance=()=>this.points.at(-1)?.s||0;
  const add=(v,width,gap=false,bank=0)=>{const prev=this.points.at(-1);this.points.push({p:v,width,gap,bank,section,s:prev?prev.s+Math.hypot(v[0]-prev.p[0],v[2]-prev.p[2]):0});};
  const prepare=(w,gap)=>{if(!this.points.length)add(p.slice(),w,gap);else{this.points.at(-1).gap=gap;this.points.at(-1).section=section;}};
  const line=(length,dy=0,width=3.6,gap=false)=>{prepare(width,gap);const start=p.slice(),n=Math.ceil(length);for(let i=1;i<=n;i++){const t=i/n;add([start[0]+Math.sin(heading)*length*t,start[1]+dy*t,start[2]+Math.cos(heading)*length*t],width,gap);}p=this.points.at(-1).p.slice();};
  const arc=(degrees,radius=20,dy=0,width=3.2)=>{prepare(width,false);const start=p.slice(),angle=degrees*Math.PI/180,sign=Math.sign(angle),initial=heading,n=Math.ceil(Math.abs(angle)*radius);for(let i=1;i<=n;i++){const u=i/n,a=initial+angle*u;add([start[0]+radius*sign*(Math.cos(initial)-Math.cos(a)),start[1]+dy*u,start[2]+radius*sign*(Math.sin(a)-Math.sin(initial))],width,false,level>=2?-sign*Math.sin(Math.PI*u)*.09:0);}p=this.points.at(-1).p.slice();heading+=angle;};
  const mark=(name,hint)=>{section=this.sections.length;this.sections.push({name,hint,s:distance()});if(section%2===0)this.checkpoints.push({s:distance()+2,label:name});};
  const gates=(count=1)=>{line(12,0,4.2);const start=distance();line(16*count+12,-.3,3.8);for(let i=0;i<count;i++)this.gates.push({s:start+10+i*16,phase:i*1.4,rhythm:true});line(8,0,4.2);};
  const jump=(moving=false)=>{line(10,0,3.5);line(8,2,3.5);const start=distance();line(moving?5.4:4.6,-.5,3.5,true);this.gaps.push({start,end:distance()});if(moving)this.platforms.push({gap:this.gaps.length-1,width:1.8,length:3,amplitude:1.05,speed:.65,phase:.2});line(18,-.4,4);};
  const branch=()=>{const start=distance();arc(90,22,-.4,3.4);const end=distance(),a=this.at(start),b=this.at(end),n=Math.ceil(len(sub(b.p,a.p))),points=[];for(let i=0;i<=n;i++){const t=i/n;points.push({p:a.p.map((v,k)=>mix(v,b.p[k],t)),s:mix(start,end,t),width:1.65,section:a.section,gap:false,bank:0});}this.routes.push({id:'copper-cut',start,end,points,first:a.index,last:b.index});};
  if(level===0){
   mark('Welcome garden','Find your neutral angle on the wide deck.');line(28,-.2,4.4);
   mark('Copper sweep','Lean gently through the open bend.');arc(65,24,-.5,3.8);
   mark('First rhythm','Arrows show the opening direction. Wait on the wide approach.');gates();
   mark('Garden ribbons','Relax your tilt between the bends.');arc(-70,22,-.4,3.6);line(10);arc(55,22,-.4,3.6);
   mark('Second rhythm','Read the opening, then roll through.');gates();
   mark('Garden home','A broad final turn. Bring it home.');arc(-50,24,-.4,3.8);line(24,0,4.4);
  }else if(level===1){
   mark('Park approach','Use the broad deck to settle your balance.');line(24,0,4.2);
   mark('Single pendulum','Follow the opening arrow. The lights brighten before reversal.');gates();
   mark('Between the clocks','Brake before the bend.');arc(80,20,-.6,3.4);
   mark('Gate dance','Two openings, two beats. Settle between them.');gates(2);
   mark('Quiet bend','Take a breath on the wide curve.');arc(-90,22,-.6,3.5);
   mark('Final rhythm','A final pair. Patience makes a clean run.');gates(2);line(18,0,4.2);
  }else if(level===2){
   mark('Foundry entry','Smooth steering carries your speed.');line(26,-.3,4);
   mark('Banked ribbon','Follow the bank. Ease off before the exit.');arc(100,20,-1,3.3);
   mark('Gold choice','Gold edges mark a shorter, narrower route.');branch();
   mark('Reverse ribbon','Settle before changing direction.');arc(-120,24,-1,3.2);
   mark('Foundry gate','Line up from the broad approach.');gates();
   mark('Ribbon home','One last banked sweep.');arc(75,22,-.7,3.5);line(26,0,4.3);
  }else if(level===3){
   mark('Spring deck','Build a steady approach on the wide deck.');line(26,.4,4);
   mark('First launch','Lift briefly at the chevrons. Aim for the landing ring.');jump();
   mark('High garden','Climb smoothly around the bank.');arc(100,22,3,3.4);
   mark('Perfect landing','Land, relax your tilt, and let the robot settle.');jump();
   mark('Upper ribbon','Control your descent through the bend.');arc(-110,22,-3,3.4);
   mark('Last spring','A final flight into a broad finish.');jump();line(20,0,4.3);
  }else if(level===4){
   mark('Dock approach','Start on the solid deck.');line(26,0,4);
   mark('First moving dock','The copper platform moves sideways. It can support your landing.');jump(true);
   mark('Dockside bend','Brake and line up for the next landing.');arc(95,23,-.6,3.3);
   mark('Drifting landing','Watch the platform before committing.');jump(true);
   mark('Harbour rhythm','A broad approach to two moving gates.');gates(2);
   mark('Home dock','Combine the bank and the last moving landing.');arc(-85,23,-1,3.3);jump(true);line(20,0,4.2);
  }else{
   mark('Mechanism entry','Find your rhythm before the first pair.');line(22,0,4);gates(2);
   mark('Copper choice','Choose the wide ribbon or the golden shortcut.');branch();
   mark('Rising spring','Keep your approach straight and lift at the chevrons.');jump();arc(-80,22,2,3.2);
   mark('Moving heart','Settle your tilt on the moving landing.');jump(true);
   mark('Clockwork rhythm','Two readable beats. Brake to line up.');gates(2);arc(75,20,-2,3.2);
   mark('Grand finale','A last moving landing, then a wide finish.');jump(true);arc(-60,24,-1,3.5);line(24,0,4.5);
  }
  this.total=distance();this.gapStart=this.gaps[0]?.start??Infinity;this.gapEnd=this.gaps[0]?.end??Infinity;
  for(let s=14,i=0;s<this.total-8;s+=21,i++){const q=this.at(s);if(q.gap||this.gaps.some(g=>Math.abs(s-g.start)<5||Math.abs(s-g.end)<5))continue;this.cells.push({s,offset:i%2?.6:-.6,taken:false});}
  for(const route of this.routes){const c=this.cells.find(c=>c.s>route.start+8&&c.s<route.end-8);if(c){c.route=route.id;c.offset=0;}}
 }
 buildSkyway(){
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
  const add=(position,width,gap=false,bank=0)=>{const previous=this.points[this.points.length-1];this.points.push({p:position,width,section,gap,bank,s:previous?previous.s+Math.hypot(position[0]-previous.p[0],position[2]-previous.p[2]):0});};
  const prepare=(width,gap)=>{if(!this.points.length)add(p.slice(),width,gap);else{const last=this.points[this.points.length-1];last.section=section;last.gap=gap;}};
  const line=(length,dy=0,width=2.8,gap=false)=>{
   prepare(width,gap);const start=p.slice(),n=Math.ceil(length);
   for(let i=1;i<=n;i++){const u=i/n;add([start[0]+Math.sin(heading)*length*u,start[1]+dy*u,start[2]+Math.cos(heading)*length*u],width,gap);}
   p=this.points[this.points.length-1].p.slice();
  };
  const arc=(degrees,radius,dy=0,width=2.6)=>{
   prepare(width,false);const start=p.slice(),angle=degrees*Math.PI/180,sign=Math.sign(angle),initial=heading,n=Math.ceil(Math.abs(angle)*radius);
   for(let i=1;i<=n;i++){const u=i/n,a=initial+angle*u;add([start[0]+radius*sign*(Math.cos(initial)-Math.cos(a)),start[1]+dy*u,start[2]+radius*sign*(Math.sin(a)-Math.sin(initial))],width,false,level>=3?-sign*Math.sin(Math.PI*u)*.07:0);}
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
 segment(i,t,points=this.points){
  const a=points[i],b=points[i+1],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],horizontal=Math.hypot(dx,dz)||1;
  const tangent=[dx/horizontal,0,dz/horizontal];
  return {p:a.p.map((v,k)=>mix(v,b.p[k],t)),width:mix(a.width,b.width,t),bank:mix(a.bank||0,b.bank||0,t),section:a.section,gap:a.gap,s:mix(a.s,b.s,t),index:i,tangent,right:[tangent[2],0,-tangent[0]],slope:(b.p[1]-a.p[1])/horizontal};
 }
 routeAt(s,id){
  const route=this.routes?.find(r=>r.id===id&&s>=r.start&&s<=r.end);if(!route)return this.at(s);
  const points=route.points;let i=0;while(i<points.length-2&&points[i+1].s<s)i++;
  const q=this.segment(i,clamp((s-points[i].s)/(points[i+1].s-points[i].s),0,1),points);q.index=this.at(q.s).index;q.route=id;return q;
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
 surfaceAt(p,hint,time=0){
  let best=this.closest(p,hint),distance=len(sub([p[0],0,p[2]],[best.p[0],0,best.p[2]]));
  for(const route of this.routes||[]){
   if(hint<route.first-8||hint>route.last+8)continue;
   for(let i=0;i<route.points.length-1;i++){
    const a=route.points[i],b=route.points[i+1],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],t=clamp(((p[0]-a.p[0])*dx+(p[2]-a.p[2])*dz)/(dx*dx+dz*dz||1),0,1),q=this.segment(i,t,route.points);
    const rel=sub(p,q.p),d=Math.hypot(rel[0],rel[2]);q.offset=dot(rel,q.right);
    const inside=Math.abs(q.offset)<q.width&&Math.abs(dot(rel,q.tangent))<.6,bestInside=!best.gap&&Math.abs(best.offset)<best.width;
    if((inside&&!bestInside)||(inside===bestInside&&d<distance)){q.index=this.at(q.s).index;q.route=route.id;best=q;distance=d;}
   }
  }
  for(let i=0;i<(this.platforms||[]).length;i++){
   const platform=this.platformAt(i,time),rel=sub(p,platform.p),along=dot(rel,platform.tangent),offset=dot(rel,platform.right);
   if(Math.abs(along)<=platform.length/2&&Math.abs(offset)<platform.width&&p[1]>platform.p[1]-.5&&best.gap){
    return {...platform,p:platform.p.map((v,k)=>v+platform.tangent[k]*along),s:platform.s+along,offset,platformAlong:along,platformId:i};
   }
  }
  return best;
 }
 platformAt(index,time){
  const platform=this.platforms[index],gap=this.gaps[platform.gap],q=this.at((gap.start+gap.end)/2),offset=Math.sin(time*platform.speed+platform.phase)*platform.amplitude;
  return {...q,p:q.p.map((v,k)=>v+q.right[k]*offset+(k===1?-.15:0)),width:platform.width,length:platform.length,slope:0,bank:0,gap:false,platform:true};
 }
 gateCenter(gate,time){const q=this.at(gate.s);return (gate.rhythm?clamp(Math.sin(time*this.track.gateSpeed+gate.phase)*1.2,-1,1):Math.sin(time*this.track.gateSpeed+gate.phase))*Math.max(0,q.width-this.track.opening-.45);}
 cellPosition(cell){const q=this.routeAt(cell.s,cell.route);return [q.p[0]+q.right[0]*cell.offset,q.p[1]+.8+cell.offset*q.bank,q.p[2]+q.right[2]*cell.offset];}
}
// Isolated prototype: oriented ribbons, including surfaces above the robot.
class MagneticCourse{
 constructor(level=null,options={}){
  if(level!==null){this.buildFlux(clamp(level,0,5),options);return;}
  this.magnetic=true;this.index=0;this.kind='lab';this.expert=false;this.targets=[85,115,160];
  this.track={id:'magnetic-lab',name:'Magnetic Lab',level:'Experimental',description:'A spiral, corkscrew, ceiling ride and vertical loop.',sky:[.7,.78,.88]};
  this.points=[];this.sections=[];this.checkpoints=[];this.cells=[];this.routes=[];this.platforms=[];this.gaps=[];this.gates=[];this.gapStart=Infinity;this.gapEnd=Infinity;
  let origin=[0,8,0],section=0;
  const add=(p,right,up,width=3)=>{const prev=this.points.at(-1);this.points.push({p,right,up,width,section,bank:0,slope:0,gap:false,s:prev?prev.s+len(sub(p,prev.p)):0});};
  const mark=(name,hint)=>{section=this.sections.length;const d=this.points.at(-1)?.s||0;this.sections.push({s:d,name,hint});this.checkpoints.push({s:d+2,label:name});};
  const part=(n,fn)=>{const base=origin.slice();for(let i=this.points.length?1:0;i<=n;i++){const q=fn(i/n);add(q.p.map((v,k)=>v+base[k]),q.right,q.up,q.width);}origin=this.points.at(-1).p.slice();};
  const line=(length,roll=0)=>part(Math.ceil(length*2),u=>({p:[0,0,u*length],right:[Math.cos(roll),Math.sin(roll),0],up:[-Math.sin(roll),Math.cos(roll),0],width:3.4}));
  const twist=(length,from,to)=>part(Math.ceil(length*2),u=>{const t=u*u*(3-2*u),a=mix(from,to,t);return {p:[0,0,u*length],right:[Math.cos(a),Math.sin(a),0],up:[-Math.sin(a),Math.cos(a),0],width:2.8};});
  mark('Magnetic deck','Cyan edges mean magnetic grip. Tilt forward to roll; steer across the ribbon.');line(22);
  mark('Rising spiral','Keep a steady pace around the tower. Both edges remain open.');
  part(220,u=>{const a=u*Math.PI*2,t=norm([15*Math.sin(a),12/(Math.PI*2),15*Math.cos(a)]),right=[Math.cos(a),0,-Math.sin(a)];return {p:[15*(1-Math.cos(a)),12*u,15*Math.sin(a)],right,up:norm(cross(t,right)),width:3.1};});line(14);
  mark('Corkscrew','Let the camera turn with the track. Left and right follow your view.');twist(64,0,Math.PI*2);line(14);
  mark('Ceiling ride','Magnetic grip holds you underneath. Keep your steering gentle.');twist(25,0,Math.PI);line(28,Math.PI);twist(25,Math.PI,Math.PI*2);line(14);
  mark('Vertical loop','Keep rolling through the loop. The cyan ribbon stays beneath your wheels.');
  part(220,u=>{const a=u*Math.PI*2,t=norm([10/(Math.PI*2),14*Math.sin(a),14*Math.cos(a)]),up=[0,Math.cos(a),-Math.sin(a)];return {p:[10*u,14*(1-Math.cos(a)),14*Math.sin(a)],right:norm(cross(up,t)),up,width:3.2};});line(14);
  mark('Return deck','Test complete. Your campaign records are untouched.');line(24);
  this.total=this.points.at(-1).s;this.expertCheckpoints=this.checkpoints.map(q=>({...q}));
  for(let d=12;d<this.total-6;d+=18)this.cells.push({s:d,offset:0,taken:false});
 }
 buildFlux(level,options){
  this.magnetic=true;this.flux=true;this.index=18+level;this.track=TRACKS[this.index];this.expert=!!options.expert;
  this.points=[];this.sections=[];this.checkpoints=[];this.cells=[];this.routes=[];this.platforms=[];this.gaps=[];this.gates=[];this.gapStart=Infinity;this.gapEnd=Infinity;
  let origin=[0,10,0],section=0,defaultWidth=[3.7,2.9,2.5,2.1,1.9,1.55][level];
  const distance=()=>this.points.at(-1)?.s||0;
  const part=(n,fn,gap=false)=>{const base=origin.slice();if(this.points.length){this.points.at(-1).gap=gap;this.points.at(-1).section=section;}for(let i=this.points.length?1:0;i<=n;i++){const q=fn(i/n),p=q.p.map((v,k)=>v+base[k]),prev=this.points.at(-1);this.points.push({p,right:q.right,up:q.up,width:q.width??defaultWidth,section,bank:0,slope:0,gap,s:prev?prev.s+len(sub(p,prev.p)):0});}origin=this.points.at(-1).p.slice();};
  const line=(length,width=defaultWidth,roll=0,gap=false)=>part(Math.ceil(length*2),u=>({p:[0,0,length*u],right:[Math.cos(roll),Math.sin(roll),0],up:[-Math.sin(roll),Math.cos(roll),0],width}),gap);
  const twist=(length,from=0,to=Math.PI*2,width=defaultWidth)=>part(Math.ceil(length*3),u=>{const a=mix(from,to,u*u*(3-2*u));return {p:[0,0,length*u],right:[Math.cos(a),Math.sin(a),0],up:[-Math.sin(a),Math.cos(a),0],width};});
  const spiral=(radius,rise,sign=1)=>part(Math.ceil(radius*2*Math.PI*2),u=>{const a=u*Math.PI*2,t=norm([sign*radius*Math.sin(a),rise/(Math.PI*2),radius*Math.cos(a)]),right=[Math.cos(a),0,-sign*Math.sin(a)];return {p:[sign*radius*(1-Math.cos(a)),rise*u,radius*Math.sin(a)],right,up:norm(cross(t,right))};});
  const slalom=(length,amplitude,roll=0,width=defaultWidth)=>part(Math.ceil(length*3),u=>{const a=u*2*Math.PI,dx=amplitude*2*Math.PI*Math.sin(a),t=norm([dx,0,length]),r=norm([length,0,-dx]),up=[0,1,0];return {p:[amplitude*(1-Math.cos(a)),0,length*u],right:r.map((v,k)=>v*Math.cos(roll)+up[k]*Math.sin(roll)),up:up.map((v,k)=>v*Math.cos(roll)-r[k]*Math.sin(roll)),width};});
  const loop=(radius,width=defaultWidth)=>part(Math.ceil(radius*Math.PI*6),u=>{const a=u*Math.PI*2,t=norm([10/(Math.PI*2),radius*Math.sin(a),radius*Math.cos(a)]),up=[0,Math.cos(a),-Math.sin(a)];return {p:[10*u,radius*(1-Math.cos(a)),radius*Math.sin(a)],right:norm(cross(up,t)),up,width};});
  const deck=(name,hint,length=12)=>{section=this.sections.length;this.sections.push({s:distance(),name,hint});this.checkpoints.push({s:distance()+2,label:name});line(length,Math.max(3,defaultWidth));};
  const ceiling=(length,amplitude=0)=>{twist(level<3?26:20,0,Math.PI);slalom(length,amplitude,Math.PI);twist(level<3?26:20,Math.PI,Math.PI*2);};
  const jump=(gap,width=defaultWidth)=>{line(14,width);const start=distance();line(gap,width,0,true);this.gaps.push({start,end:distance()});line(15,Math.max(2.3,width));};
  if(level===0){
   deck('Magnetic garden','Cyan edges hold you against the track. Both edges stay open.',22);slalom(28,3);
   deck('Gentle orbit','Brake if the curve pushes you toward the outside.');spiral(18,10);
   deck('First wall','Counter-steer as gravity pulls across the ribbon.');twist(32,0,Math.PI/2);line(12,3.7,Math.PI/2);twist(32,Math.PI/2,0);
   deck('Garden weave','A broad slalom. Relax your tilt between turns.');slalom(40,6);
   deck('First inversion','Keep your line while the world turns.');ceiling(14);
   deck('Garden home','You have learned magnetic grip. Bring it home.');line(22,4);
  }else if(level===1){
   deck('Harbour launch','The ribbon is narrower now. Settle before the helix.',20);
   deck('Tower ascent','Climb around the tower. Ease off before each bend.');spiral(15,20);
   deck('First corkscrew','Steer against the changing pull of gravity.');twist(50);
   deck('Reverse screw','The next rotation runs the other way.');twist(44,0,-Math.PI*2);
   deck('Descending coil','Control your speed as the helix descends.');spiral(13,-16,-1);
   deck('Harbour home','Find the centre through the final weave.');slalom(32,5);line(18,3.5);
  }else if(level===2){
   deck('Night approach','Overhead curves need active steering, not just balance.',20);slalom(26,5);
   deck('Ceiling slalom','Steer through the bends while hanging beneath the ribbon.');ceiling(48,8);
   deck('Thin ribbon','Settle onto the narrow crossing.');line(26,1.5);slalom(30,6);
   deck('Reverse ceiling','Switch your steering smoothly through the overhead weave.');ceiling(40,-7);
   deck('Night roll','A shorter corkscrew leaves less time to react.');twist(38);
   deck('Dawn deck','Keep a steady line to the finish.');slalom(34,6);line(16,3);
  }else if(level===3){
   deck('Forge entry','Build speed for the loop. Brake before its narrow exit.',20);
   deck('Outer loop','Keep forward pressure through the climb.');loop(15);
   deck('Needle exit','A narrow weave follows the loop.');slalom(36,7,0,1.4);twist(38);
   deck('Inner loop','A tighter loop, followed immediately by a thin ribbon.');loop(10,1.8);line(18,1.35);
   deck('Hanging forge','Keep your line through the overhead bend.');ceiling(32,6);
   deck('Forge home','Slow for the last weave.');slalom(28,6);line(16,3);
  }else if(level===4){
   deck('Circuit entry','Cyan ends at real gaps. Lift the phone to hop.',20);
   deck('First disconnect','Build speed, then hop just before the broken edge.');jump(3.2,2.3);
   deck('Rolling circuit','A corkscrew sets up the next landing.');twist(36);jump(3.6);
   deck('Overhead circuit','Steer through the ceiling bend.');ceiling(34,7);
   deck('Final disconnect','Settle after the loop, then commit to the gap.');loop(11);jump(4);
   deck('Circuit home','Keep your line after the last landing.');slalom(32,7,0,1.65);line(18,3);
  }else{
   deck('Singularity entry','Every skill, less room. Brake early and keep your line.',20);twist(34);
   deck('Tight coil','A tight rising spiral leads into a narrow reverse roll.');spiral(11,18);twist(32,0,-Math.PI*2);
   deck('Dark matter','A narrow ceiling slalom. Stay patient.');ceiling(38,8);
   deck('Event loop','Control the loop, then line up for the landing.');loop(9,1.5);jump(4.2,1.6);
   deck('Double disconnect','Land, settle, and hop again.');jump(3.6,1.6);twist(32);jump(4.2,1.5);
   deck('Last light','One final weave on the narrow ribbon.');slalom(34,8,0,1.3);line(20,3.5);
  }
  this.total=distance();this.gapStart=this.gaps[0]?.start??Infinity;this.gapEnd=this.gaps[0]?.end??Infinity;
  this.expertCheckpoints=this.checkpoints.filter((_,i)=>i%2===0).map(q=>({...q}));if(this.expert)this.checkpoints=this.expertCheckpoints.map(q=>({...q}));
  for(let d=12,i=0;d<this.total-6;d+=19,i++){const q=this.at(d);if(this.gaps.some(g=>d>g.start-4&&d<g.end+4))continue;this.cells.push({s:d,offset:q.width<1.7?0:(i%2?.35:-.35),taken:false});}
 }
 at(s){
  s=clamp(s,0,this.total??this.points.at(-1).s);let i=0,hi=this.points.length-2;while(i<hi){const m=Math.ceil((i+hi)/2);if(this.points[m].s<=s)i=m;else hi=m-1;}
  const a=this.points[i],b=this.points[i+1],u=clamp((s-a.s)/(b.s-a.s||1),0,1),tangent=norm(sub(b.p,a.p)),r=a.right.map((v,k)=>mix(v,b.right[k],u));
  const right=norm(r.map((v,k)=>v-tangent[k]*dot(r,tangent))),up=norm(cross(tangent,right));
  return {p:a.p.map((v,k)=>mix(v,b.p[k],u)),tangent,right,up,width:mix(a.width,b.width,u),s,section:a.section,index:i,bank:0,slope:0,gap:!!a.gap};
 }
 routeAt(s){return this.at(s);}
 cellPosition(c){const q=this.at(c.s);return q.p.map((v,k)=>v+q.right[k]*c.offset+q.up[k]*.8);}
}
class Run{
 constructor(course=new Course()){this.course=course;this.radius=.44;this.reset();}
 reset(){
  this.elapsed=0;this.time=0;this.falls=0;this.collected=0;this.checkpoint=0;this.maxProgress=2;this.finished=false;
  this.event='';this.eventKind='';this.events=[];this.flash=0;this.jumpCooldown=0;this.nudgeCooldown=0;this.jumpBuffer=0;this.coyote=0;this.gateCooldown=0;
  this.splits=[];this.lastSplit=null;this.sectionFalls={};this.recording=[];this.ghost=null;this.platformId=null;
  this.course.cells.forEach(c=>c.taken=false);this.place(2);
 }
 place(s){if(this.course.magnetic){const q=this.course.at(s);this.position=q.p.map((v,k)=>v+q.up[k]*this.radius);this.velocity=[0,0,0];this.hint=q.index;this.grounded=true;this.falling=false;this.progress=q.s;this.surface=q;this.yaw=0;this.pose={pitch:0,roll:0,twist:0};this.labS=q.s;this.labU=0;this.labForward=0;this.labSide=0;this.labAir=0;return;}const q=this.course.at(s);this.position=[q.p[0],q.p[1]+this.radius*(this.course.index>=12?Math.sqrt(this.course.surfaceFrame(q).d):1),q.p[2]];this.velocity=[0,0,0];this.hint=q.index;this.grounded=true;this.falling=false;this.progress=q.s;this.surface=q;this.yaw=Math.atan2(q.tangent[0],q.tangent[2]);this.pose={pitch:0,roll:0,twist:0};}
 emit(type,details={}){this.events.push({type,position:this.position.slice(),...details});}
 announce(type,message,duration,details={}){this.event=message;this.eventKind=type;this.flash=duration;this.emit(type,details);}
 recover(){
  const section=this.surface.section;this.sectionFalls[section]=(this.sectionFalls[section]||0)+1;
  this.falls++;this.elapsed+=2;this.place(this.course.checkpoints[this.checkpoint].s);this.jumpCooldown=.18;this.jumpBuffer=0;this.coyote=0;
  this.announce('recover','Checkpoint recovery · +2s',1.8);
 }
 stepMagnetic(dt,input){
  if(this.finished)return;this.events=[];if(!this.externalClock)this.elapsed+=dt;this.time+=dt;this.flash=Math.max(0,this.flash-dt);this.jumpCooldown-=dt;
  const c=this.course,q=c.at(this.labS),blend=1-Math.exp(-dt*10),steer=clamp(input.steer||0,-1,1),throttle=clamp(input.throttle||0,-1,1);
  this.pose.pitch=mix(this.pose.pitch,throttle*.28,blend);this.pose.roll=mix(this.pose.roll,-steer*.35,blend);
  if(c.flux){this.nudgeCooldown-=dt;this.pose.twist=mix(this.pose.twist,clamp(input.turn||0,-1,1)*.22,blend);const burst=input.burst||[0,0,0];if(this.grounded&&this.nudgeCooldown<=0&&(burst[0]||burst[2])){this.labSide+=clamp(burst[0],-2,2);this.labForward+=clamp(burst[2],-2,2);this.nudgeCooldown=.3;}}
  if(this.grounded){
   // Gravity acts along the ribbon; 32 m/s² of normal magnetic attraction holds
   // against gravity on ceilings and through the loop at the 9 m/s speed cap.
   this.labForward=clamp((this.labForward+(18*throttle-12.5*q.tangent[1])*dt)*Math.exp(-.46*dt),-4,9);
   const qa=c.at(Math.max(0,this.labS-.3)),qb=c.at(Math.min(c.total,this.labS+.3)),curve=sub(qb.tangent,qa.tangent).map(v=>v/Math.max(.001,qb.s-qa.s)),outward=c.flux?-(this.labForward**2)*dot(curve,q.right):0;
   this.labSide=(this.labSide+(17*steer+(c.flux?clamp(input.turn||0,-1,1)*5:0)-12.5*q.right[1]+outward)*dt)*Math.exp(-1.2*dt);
   this.labS=clamp(this.labS+this.labForward*dt,0,c.total);this.labU+=this.labSide*dt;
   const next=c.at(this.labS),previous=this.position;this.surface={...next,offset:this.labU};this.progress=this.labS;this.hint=next.index;
   this.position=next.p.map((v,k)=>v+next.right[k]*this.labU+next.up[k]*this.radius);this.velocity=this.position.map((v,k)=>(v-previous[k])/dt);
   const ahead=c.at(Math.min(c.total,this.labS+.2)),behind=c.at(Math.max(0,this.labS-.2)),ds=Math.max(.001,ahead.s-behind.s),curvature=sub(ahead.tangent,behind.tangent).map(v=>v/ds),reaction=32+12.5*next.up[1]+this.labForward**2*dot(curvature,next.up);
   if(next.gap||Math.abs(this.labU)>next.width||reaction<0||input.burst?.[1]>.5&&this.jumpCooldown<=0){
    this.grounded=false;this.labAir=0;this.jumpCooldown=.5;
    if(next.gap||reaction<0||Math.abs(this.labU)>next.width){this.falling=true;this.announce('fall','Magnetic contact lost',1.5);}else{this.velocity=this.velocity.map((v,k)=>v+next.up[k]*(c.flux?6.2:4.5));this.announce('jump','Magnetic hop',.8);}
   }
  }else{
   this.labAir+=dt;this.velocity[1]-=12.5*dt;
   // Attraction works only near the last ribbon, never across the open edges.
   let nearest=null,dist=Infinity;
   for(let d=Math.max(0,this.labS-7);d<=Math.min(c.total,this.labS+12);d+=.5){const t=c.at(d),rel=sub(this.position,t.p),u=dot(rel,t.right),h=dot(rel,t.up),along=dot(rel,t.tangent),v=along*along+(h-this.radius)**2;if(v<dist){dist=v;nearest={q:t,u,h,along};}}
   if(nearest){const {q:t,u,h,along}=nearest;if(!t.gap&&(!c.flux||dot(this.velocity,t.up)<=0)&&Math.abs(u)<t.width&&h>0&&h<3&&Math.abs(along)<1){
    this.velocity=this.velocity.map((v,k)=>v-t.up[k]*32*dt);
    if(h<=this.radius+.06&&dot(this.velocity,t.up)<0){this.labS=t.s;this.labU=u;this.labForward=dot(this.velocity,t.tangent);this.labSide=dot(this.velocity,t.right);this.grounded=true;this.falling=false;this.surface={...t,offset:u};this.emit('land',{strength:.4});}
   }}
   this.position=this.position.map((v,k)=>v+this.velocity[k]*dt);
   if(this.labAir>1.8){this.recover();return;}
  }
  if(this.grounded){this.maxProgress=Math.max(this.maxProgress,this.progress);c.checkpoints.forEach((cp,i)=>{if(i>this.checkpoint&&this.progress>=cp.s){this.checkpoint=i;this.splits[i]=this.elapsed;this.lastSplit={index:i,time:this.elapsed};this.announce('checkpoint','Magnetic checkpoint secured',1.5);}});}
  for(const cell of c.cells)if(!cell.taken&&len(sub(this.position,c.cellPosition(cell)))<1.05){cell.taken=true;this.collected++;this.announce('cell','Energy +1',.6,{variant:this.collected,position:c.cellPosition(cell)});}
  if(this.grounded&&this.progress>=c.total-2.2){this.finished=true;this.announce('finish',c.flux?'Course complete':'Magnetic test complete',2);}
 }
 step(dt,input){
  if(!(dt>0&&dt<=1/30))throw new RangeError('Fixed physics step required.');
  if(this.course.magnetic){this.stepMagnetic(dt,input);return;}
  this.events=[];
  if(this.finished)return;
  if(!this.externalClock)this.elapsed+=dt;
  this.time+=dt;this.flash=Math.max(0,this.flash-dt);this.jumpCooldown-=dt;this.nudgeCooldown-=dt;this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.gateCooldown-=dt;
  if(this.grounded&&this.surface.platformId!==undefined){const a=this.course.platformAt(this.surface.platformId,this.time-dt),b=this.course.platformAt(this.surface.platformId,this.time);this.position=this.position.map((v,i)=>v+b.p[i]-a.p[i]);}
  const q=this.course.surfaceAt(this.position,this.hint,this.time);this.hint=q.index;this.surface=q;this.progress=q.s;
  const oldY=this.position[1],wasGrounded=this.grounded,groundBefore=this.grounded&&!q.gap&&Math.abs(q.offset)<q.width&&(this.course.index<12||Math.abs(this.position[1]-q.p[1]-q.offset*q.bank-this.radius*Math.sqrt(this.course.surfaceFrame(q).d))<.3);
  const along=dot(this.velocity,q.tangent),lateral=dot(this.velocity,q.right);
  const throttle=clamp(input.throttle||0,-1,1),steer=clamp(input.steer||0,-1,1),turn=clamp(input.turn||0,-1,1);
  // A separate visual pose mirrors calibrated phone inputs without changing forces.
  const poseBlend=1-Math.exp(-dt*10);
  this.pose.pitch=mix(this.pose.pitch,throttle*.28,poseBlend);
  this.pose.roll=mix(this.pose.roll,-steer*.35,poseBlend);
  this.pose.twist=mix(this.pose.twist,turn*.22,poseBlend);
  let forward=(groundBefore?13:4)*throttle-(groundBefore?12.5*q.slope:0),side=(groundBefore?17:4)*steer+turn*5-(groundBefore?12.5*q.bank:0);
  const steep=this.course.index>=12,frame=steep?this.course.surfaceFrame(q):null;
  // Inputs are forces along the surface tangents, gravity is projected into
  // the support plane. Unlike a slope multiplier, this stays bounded at 65°.
  if(steep&&groundBefore){
   forward=13*throttle/Math.sqrt(1+frame.slope**2)-12.5*frame.slope/frame.d;
   side=(17*steer+5*turn)/Math.sqrt(1+frame.bank**2)-12.5*frame.bank/frame.d;
  }
  const burst=input.burst||[0,0,0];
  if(groundBefore)this.coyote=.085;else this.coyote=Math.max(0,this.coyote-dt);
  if(burst[1]>.5)this.jumpBuffer=.14;
  if(this.nudgeCooldown<=0&&(burst[0]||burst[2])){
   this.velocity[0]+=q.right[0]*clamp(burst[0],-2,2)+q.tangent[0]*clamp(burst[2],-2,2);
   this.velocity[2]+=q.right[2]*clamp(burst[0],-2,2)+q.tangent[2]*clamp(burst[2],-2,2);
   this.nudgeCooldown=.3;
  }
  if(!groundBefore&&burst[1]<-.5)this.velocity[1]-=1.8;
  if(this.jumpBuffer>0&&this.jumpCooldown<=0&&(groundBefore||this.coyote>0)){
   this.velocity[1]=Math.max(4.9,along*q.slope+4.5);this.grounded=false;this.jumpBuffer=0;this.coyote=0;this.jumpCooldown=.42;this.announce('jump','Nice lift',.8);
  }
  if(this.grounded&&groundBefore)this.velocity[1]=along*(steep?frame.slope:q.slope)+lateral*q.bank;
  const drag=Math.exp(-(groundBefore?.46:.08)*dt);
  this.velocity[0]=(this.velocity[0]+(q.tangent[0]*forward+q.right[0]*side)*dt)*drag;
  this.velocity[2]=(this.velocity[2]+(q.tangent[2]*forward+q.right[2]*side)*dt)*drag;
  const speed=Math.hypot(this.velocity[0],this.velocity[2]);if(speed>11){this.velocity[0]*=11/speed;this.velocity[2]*=11/speed;}
  if(steep&&groundBefore&&this.grounded)this.velocity[1]=dot(this.velocity,q.tangent)*frame.slope+dot(this.velocity,q.right)*frame.bank;
  else this.velocity[1]-=12.5*dt;
  this.position=this.position.map((v,i)=>v+this.velocity[i]*dt);
  const next=this.course.surfaceAt(this.position,this.hint,this.time);this.hint=next.index;this.surface=next;this.progress=next.s;
  const nextFrame=steep?this.course.surfaceFrame(next):null;
  const floor=next.p[1]+this.radius*(steep?Math.sqrt(nextFrame.d):1)+next.offset*next.bank,support=!next.gap&&Math.abs(next.offset)<next.width;
  const attached=steep&&groundBefore&&this.grounded;
  this.grounded=false;
  if(support&&(attached||this.position[1]<=floor&&oldY>=floor-.45)){
   const surfaceSpeed=dot(this.velocity,next.tangent)*(steep?nextFrame.slope:next.slope)+dot(this.velocity,next.right)*next.bank,impact=surfaceSpeed-this.velocity[1];
   this.position[1]=floor;this.velocity[1]=surfaceSpeed+(!attached&&impact>3?Math.min(.65,impact*.08):0);this.grounded=attached||impact<=3;
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
   this.course.checkpoints.forEach((cp,i)=>{if(i>this.checkpoint&&this.progress>=cp.s){this.checkpoint=i;if(this.splits[i]===undefined){this.splits[i]=this.elapsed;this.lastSplit={index:i,time:this.elapsed};}this.announce('checkpoint','Checkpoint secured',1.8);}});
  }
  for(const cell of this.course.cells){if(!cell.taken&&Math.abs(cell.s-this.progress)<3&&len(sub(this.position,this.course.cellPosition(cell)))<1.05){cell.taken=true;this.collected++;this.announce('cell','Energy +1',.7,{variant:this.collected,position:this.course.cellPosition(cell)});}}
  const recoveryFloor=steep?next.p[1]-Math.abs(next.bank)*next.width:next.p[1];
  if(!this.grounded&&!this.falling&&this.position[1]<recoveryFloor-.8){this.falling=true;this.announce('fall','Returning to your checkpoint',1.5);}
  if(this.position[1]<recoveryFloor-4.5||this.position.some(v=>!Number.isFinite(v))){this.recover();return;}
  if(this.grounded&&this.progress>=this.course.total-2.2){this.finished=true;this.announce('finish','Course complete',2);}
  const planar=Math.hypot(this.velocity[0],this.velocity[2]);
  if(planar>.4){const target=Math.atan2(this.velocity[0],this.velocity[2]);this.yaw+=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw))*(1-Math.exp(-dt*7));}
 }
 demoInput(){
  if(this.course.magnetic){const c=this.course,q=c.at(this.labS),a=c.at(Math.max(0,this.labS-.3)),b=c.at(Math.min(c.total,this.labS+.3)),curve=sub(b.tangent,a.tangent).map(v=>v/Math.max(.001,b.s-a.s)),outward=c.flux?-(this.labForward**2)*dot(curve,q.right):0,near=c.gaps.some(g=>this.labS>g.start-15&&this.labS<g.end+5),speed=near?8:5.5;return {throttle:clamp(((speed-this.labForward)*3+.46*this.labForward+12.5*q.tangent[1])/18,-1,1),steer:clamp((-this.labU*5-this.labSide*3+12.5*q.right[1]-outward)/17,-1,1),burst:c.gaps.some(g=>this.labS>g.start-.8&&this.labS<g.start-.15)&&this.grounded&&this.jumpCooldown<=0?[0,1,0]:[0,0,0]};}
  const q=this.surface,s=this.progress,course=this.course;
  let speed=5.2,offset=0;
  if(q.width<2)speed=4.2;
  if(course.gaps.some(g=>s>g.start-14&&s<g.end+6))speed=7+(course.index>=6?course.index-6:course.index)*.12;
  for(const gate of course.gates)if(gate.s-s>-1&&gate.s-s<15){speed=3.6;offset=course.gateCenter(gate,this.time+Math.max(0,gate.s-s)/speed);}
  const aim=course.at(Math.min(course.total,s+3.2)),delta=[aim.p[0]+aim.right[0]*offset-this.position[0],0,aim.p[2]+aim.right[2]*offset-this.position[2]];
  const desired=norm(delta).map(v=>v*speed),acc=desired.map((v,i)=>(v-this.velocity[i])*3.5+this.velocity[i]*.46);
  const burst=(course.gaps.some(g=>s>g.start-1.7&&s<g.start-.15)&&this.grounded&&this.jumpCooldown<=0)?[0,1,0]:[0,0,0];
  if(course.index>=12){const f=course.surfaceFrame(q);return {throttle:clamp((dot(acc,q.tangent)+12.5*f.slope/f.d)*Math.sqrt(1+f.slope*f.slope)/13,-1,1),steer:clamp((dot(acc,q.right)+12.5*f.bank/f.d)*Math.sqrt(1+f.bank*f.bank)/17,-1,1),turn:0,burst};}
  return {throttle:clamp((dot(acc,q.tangent)+12.5*q.slope)/13,-1,1),steer:clamp((dot(acc,q.right)+12.5*q.bank)/17,-1,1),turn:0,burst};
 }
}
const api={clamp,mix,len,norm,dot,cross,sub,calibrate,motionControls,displayLayout,TRACKS,PLANETS,Course,MagneticCourse,Run};
root.GravityRun=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
