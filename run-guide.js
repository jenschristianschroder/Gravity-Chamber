/* Animated instructions use SVG, so they also work without motion sensors or WebGL. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
const pulse=(a,b,c,d,t)=>smooth(a,b,t)-smooth(c,d,t);
const LESSONS=[
 {id:'roll',title:'Tilt forward to roll',text:'Tip the phone’s top edge away from you. The robot leans forward and picks up speed. Return toward your starting angle to ease off.',tip:'Start upright. Small tilts are enough.'},
 {id:'brake',title:'Tilt back to slow down',text:'Bring the top edge toward you to brake. Keep tilting back after the robot stops to reverse.',tip:'The robot has momentum. Brake before a tight bend.'},
 {id:'steer',title:'Lean left or right to steer',text:'Lower the side you want to move toward, like a small steering wheel. The robot banks in the same direction as it crosses the track.',tip:'Use gentle corrections, especially on the skybridge.'},
 {id:'twist',title:'Twist for an extra turn',text:'Turn the phone gently around its upright axis. The motion adds a brief steering boost. Holding a twisted position does not keep adding a boost.',tip:'Keep the phone upright as you twist.'},
 {id:'nudge',title:'Move the phone for a burst',text:'A short forward push adds speed. A brief sideways movement adds a sideways burst. Move the whole phone, then return gently.',tip:'These are small movements, not big shakes.'},
 {id:'hop',title:'Nudge upward to hop',text:'Lift the whole phone briefly to jump. A quick downward nudge while airborne brings the robot down sooner.',tip:'Hop at the coral takeoff markers. Keep hold of the phone.'}
];
function sampleFrame(id,time){
 const t=clamp(time,0,1),f={pitch:0,roll:0,yaw:0,move:[0,0,0],x:0,z:1+3.5*smooth(.15,.88,t),height:0,phase:'Start upright',arrow:'',opacity:smooth(0,.04,t)*(1-smooth(.94,1,t))};
 const right='M64 76 Q120 20 178 76',left='M178 76 Q120 20 64 76';
 if(id==='roll'){
  f.pitch=27*pulse(.13,.32,.74,.9,t);f.z=1+4*Math.pow(smooth(.17,.9,t),1.45);
  f.phase=t<.14?'Start upright':t<.75?'Top edge away → accelerate':'Ease back toward neutral';f.arrow='M184 176 Q218 125 185 75';
 }else if(id==='brake'){
  f.pitch=-25*pulse(.15,.32,.8,.92,t);
  if(t<.52){const u=t/.52;f.z=1+2.5*(2*u-u*u);}else f.z=3.5-2.3*Math.pow((t-.52)/.48,2);
  f.phase=t<.2?'The robot is already rolling':t<.52?'Top edge toward you → brake':'Keep tilting back → reverse';f.arrow='M185 75 Q218 125 184 176';
 }else if(id==='steer'){
  f.roll=23*pulse(.13,.25,.4,.49,t)-23*pulse(.51,.64,.79,.91,t);
  f.x=1.6*smooth(.17,.47,t)-2.8*smooth(.53,.88,t);
  f.phase=t<.13?'Start upright':t<.49?'Lean right → bank right':t<.91?'Lean left → bank left':'Return to your starting angle';f.arrow=t<.49?right:left;
 }else if(id==='twist'){
  f.yaw=32*smooth(.14,.3,t)-64*smooth(.51,.68,t)+32*smooth(.83,.94,t);
  f.x=1.3*smooth(.18,.43,t)-2.5*smooth(.55,.87,t);
  f.phase=t<.14?'Keep the phone upright':t<.32?'Twist right → extra turn':t<.51?'Hold still → no extra boost':t<.7?'Twist left → extra turn':'Return gently to center';
  f.arrow=t<.51?'M65 140 C42 99 198 98 175 140':'M175 140 C198 98 42 99 65 140';
 }else if(id==='nudge'){
  f.move=[29*pulse(.53,.61,.67,.86,t),0,-60*pulse(.16,.23,.29,.46,t)];
  f.z=1+2.4*smooth(.12,.88,t)+1.4*smooth(.2,.39,t);f.x=1.4*smooth(.58,.84,t);
  f.phase=t<.15?'Keep the same phone angle':t<.48?'Push forward → burst of speed':t<.88?'Move right → sideways burst':'Return gently to center';
  f.arrow=t<.48?'M172 175 L201 121':'M160 72 L209 72';
 }else if(id==='hop'){
  f.move=[0,36*pulse(.17,.24,.3,.46,t)-23*pulse(.57,.64,.7,.88,t),0];
  const u=clamp((t-.25)/.52,0,1);f.height=u>0&&u<1?2.2*Math.sin(Math.PI*u)*(t>.59?1-smooth(.59,.77,t)*.25:1):0;
  f.phase=t<.17?'Keep the phone upright':t<.54?'Nudge up → hop':t<.77?'Nudge down → land sooner':'Land and keep rolling';
  f.arrow=t<.54?'M187 181 L187 88':'M187 88 L187 181';
 }
 return f;
}
function phonePoint(point,frame){
 let [x,y,z]=point;
 const pitch=(-12-frame.pitch)*Math.PI/180,roll=-frame.roll*Math.PI/180,yaw=(-20+frame.yaw)*Math.PI/180;
 [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
 [x,z]=[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
 [x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];
 x+=frame.move[0];y+=frame.move[1];z+=frame.move[2];
 const scale=300/(300-z);return [120+x*scale,134-y*scale];
}
const path=points=>'M'+points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' L')+' Z';
function phonePath(bounds,z,frame){const [w,h]=bounds;return path([[-w,h,z],[w,h,z],[w,-h,z],[-w,-h,z]].map(p=>phonePoint(p,frame)));}
function trackPoint(x,z,height=0){const scale=1/(1+z*.1);return {x:120+x*28*scale,y:218-z*23-height*27*scale,scale};}
class Guide{
 constructor(document,{reduced=false,requestFrame=callback=>root.requestAnimationFrame(callback),cancelFrame=id=>root.cancelAnimationFrame(id)}={}){
  this.document=document;this.$=id=>document.getElementById(id);this.reduced=reduced;this.request=requestFrame;this.cancel=cancelFrame;
  this.index=0;this.time=.32;this.opened=false;this.playing=!reduced;this.frameId=null;this.last=null;
  for(const lesson of LESSONS)this.$('guide-'+lesson.id).addEventListener('click',()=>this.select(LESSONS.indexOf(lesson)));
  this.$('guide-play').addEventListener('click',()=>this.toggle());
  this.$('guide-scrub').addEventListener('input',event=>this.seek(Number(event.target.value)/100));
  this.$('help').addEventListener('close',()=>this.close());
  this.document.addEventListener('visibilitychange',()=>{if(this.document.hidden){this.stopFrame();}else if(this.opened&&this.playing)this.schedule();});
  this.tick=now=>{
   this.frameId=null;if(!this.opened||!this.playing||this.document.hidden)return;
   if(this.last!==null)this.time=(this.time+Math.min((now-this.last)/1000,.1)/6.8)%1;
   this.last=now;this.render();this.schedule();
  };
  this.select(0);
 }
 open(){this.opened=true;this.last=null;this.render();this.schedule();}
 close(){this.opened=false;this.stopFrame();}
 stopFrame(){if(this.frameId!==null)this.cancel(this.frameId);this.frameId=null;this.last=null;}
 schedule(){if(this.opened&&this.playing&&!this.document.hidden&&this.frameId===null)this.frameId=this.request(this.tick);}
 select(index){
  if(!Number.isInteger(index)||index<0||index>=LESSONS.length)return;
  this.index=index;this.time=this.playing?0:.32;this.last=null;
  for(let i=0;i<LESSONS.length;i++)this.$('guide-'+LESSONS[i].id).setAttribute('aria-pressed',String(i===index));
  this.$('guide-title').textContent=LESSONS[index].title;this.$('guide-description').textContent=LESSONS[index].text;this.$('guide-tip').textContent=LESSONS[index].tip;
  this.$('guide-phone').setAttribute('aria-label','Phone motion: '+LESSONS[index].text);
  this.$('guide-response').setAttribute('aria-label','Robot response: '+LESSONS[index].title);
  this.render();
 }
 toggle(){this.playing=!this.playing;if(this.playing)this.schedule();else this.stopFrame();this.render();}
 seek(time){this.playing=false;this.stopFrame();this.time=clamp(Number.isFinite(time)?time:0,0,1);this.render();}
 render(){
  const lesson=LESSONS[this.index],f=sampleFrame(lesson.id,this.time),neutral=sampleFrame('roll',0);
  if(!this.playing)f.opacity=1;
  const set=(id,name,value)=>this.$(id).setAttribute(name,String(value));
  set('guide-neutral','d',phonePath([34,65],0,neutral));set('guide-back','d',phonePath([35,66],-7,f));
  set('guide-edge','d',path([[35,66,-7],[35,66,3],[35,-66,3],[35,-66,-7]].map(p=>phonePoint(p,f))));
  set('guide-front','d',phonePath([34,65],3,f));set('guide-screen','d',phonePath([28,54],4,f));
  const camera=[phonePoint([-6,51,5],f),phonePoint([6,51,5],f)];set('guide-camera','d','M'+camera.map(p=>p.join(',')).join(' L'));
  const dot=phonePoint([0,0,5],f);set('guide-phone-dot','cx',dot[0]);set('guide-phone-dot','cy',dot[1]);
  const top=phonePoint([0,72,3],f);set('guide-top','x',top[0]);set('guide-top','y',top[1]-8);
  set('guide-gesture','d',f.arrow);set('guide-gesture','opacity',this.time>.1&&this.time<.92?1:.3);
  set('guide-phone-floor','cx',120+f.move[0]*.5);set('guide-phone-floor','rx',40+f.move[2]*.15);
  set('guide-axis','opacity',lesson.id==='twist'?.5:0);
  const robot=trackPoint(f.x,f.z,f.height),shadow=trackPoint(f.x,f.z),lean=f.roll*.6;
  const size=robot.scale*1.35;
  set('guide-robot','transform','translate('+robot.x+','+(robot.y-17*size)+') scale('+size+') rotate('+lean+')');
  set('guide-robot','opacity',f.opacity);set('guide-shadow','cx',shadow.x);set('guide-shadow','cy',shadow.y+1);
  set('guide-shadow','rx',(17+f.height*2)*shadow.scale);set('guide-shadow','ry',4*shadow.scale);
  set('guide-shadow','opacity',f.opacity*.22*Math.exp(-f.height*.7));
  const trail=[];for(let i=0;i<=28;i++){const s=sampleFrame(lesson.id,Math.min(this.time,i/28)),p=trackPoint(s.x,s.z);trail.push([p.x,p.y]);}
  set('guide-trail','d','M'+trail.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' L'));
  const reverse=lesson.id==='brake'&&this.time>.52,arrowA=trackPoint(f.x,f.z+(reverse?.8:.3)),arrowB=trackPoint(f.x,f.z+(reverse?-.2:1.4));
  set('guide-direction','d','M'+arrowA.x+','+arrowA.y+' L'+arrowB.x+','+arrowB.y);set('guide-direction','opacity',f.opacity*.8);
  this.$('guide-phase').textContent=f.phase;this.$('guide-play').textContent=this.playing?'Pause animation':'Play animation';
  this.$('guide-play').setAttribute('aria-pressed',String(this.playing));
  this.$('guide-scrub').value=String(Math.round(this.time*100));
  this.$('guide-scrub').setAttribute('aria-valuetext',Math.round(this.time*100)+'% — '+f.phase);
 }
}
root.GravityGuide={Guide,LESSONS,sampleFrame,phonePoint,trackPoint};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityGuide;
})(globalThis);
