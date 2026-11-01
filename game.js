/* Browser-only controller. Motion samples and records never leave this device. */
(() => {
'use strict';
const G=GravityRun,$=id=>document.getElementById(id),course=new G.Course(),run=new G.Run(course);
const motion=new GravityMotion.MotionInput(),STEP=1/120;
let renderer,state='menu',mode='motion',listener=false,session=0,immersive=false,displaySession=0;
let accumulator=0,lastFrame=0,lastHUD=-Infinity,waitingSince=0,best=null;
const hints=[
 'Tilt forward to roll. Lean left or right to steer.',
 'Ease into the bends. Tilt back to slow down.',
 'Small movements. Keep the robot on the bridge.',
 'Aim for the moving opening. Slow down to line it up.',
 'Build speed, then nudge upward just before the gap.',
 'Follow the spiral. The finish is just ahead.'
];
function time(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(1).padStart(4,'0');}
try{const value=Number(localStorage.getItem('gravity-run-skyway-best-v1'));if(value>0&&Number.isFinite(value))best=value;}catch{}
function showBest(){$('best').textContent=best?'Your best · '+time(best):'';}
function display(){
 const angle=window.screen.orientation&&window.screen.orientation.angle;
 const layout=G.displayLayout(window.innerWidth,window.innerHeight,Number.isFinite(angle)?angle:Number(window.orientation)||0);
 const style=$('app').style;
 style.setProperty('--play-width',layout.width+'px');style.setProperty('--play-height',layout.height+'px');style.setProperty('--play-rotation',layout.rotation+'deg');
 $('fullscreen').hidden=!document.documentElement.requestFullscreen||!!document.fullscreenElement||state!=='playing';
}
async function enterFullscreen(){
 immersive=true;const token=++displaySession;
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{}
 if(!immersive||token!==displaySession){
  if(!immersive&&document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});
  return;
 }
 try{if(window.screen.orientation&&window.screen.orientation.lock)await window.screen.orientation.lock('portrait-primary');}catch{}
 display();
}
function leaveFullscreen(){
 immersive=false;displaySession++;
 try{if(window.screen.orientation&&window.screen.orientation.unlock)window.screen.orientation.unlock();}catch{}
 if(document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});
}
function ui(){
 const active=state!=='menu',hud=['playing','paused','finished'].includes(state);
 document.body.classList.toggle('active',active);
 $('menu').hidden=state!=='menu';$('calibrating').hidden=state!=='waiting';
 $('paused').hidden=state!=='paused';$('finish').hidden=state!=='finished';
 $('hud-stats').hidden=!hud;$('route-hud').hidden=!hud;$('bottom-hud').hidden=state!=='playing';$('edition').hidden=active;
 $('start').disabled=!renderer;$('demo').disabled=!renderer;
 display();showBest();hudUpdate();
}
function hudUpdate(){
 $('timer').textContent=time(run.elapsed);$('energy').textContent=run.collected+' / '+course.cells.length;
 $('section').textContent=course.sections[run.surface.section].name;
 const progress=Math.round(G.clamp(run.progress/course.total,0,1)*100);
 $('distance').textContent=progress+'%';$('route-fill').style.width=progress+'%';
 $('speed').textContent=Math.round(Math.hypot(run.velocity[0],run.velocity[2])*3.6)+' km/h';
 $('checkpoint').textContent='CHECKPOINT '+(run.checkpoint+1)+' / '+course.checkpoints.length;
 $('hint').textContent=(mode==='demo'?'DEMO · ':motion.gyro?'':'')+hints[run.surface.section];
 const message=run.flash>0?run.event:'';
 if($('toast').textContent!==message)$('toast').textContent=message;
}
function attach(){if(!listener){window.addEventListener('devicemotion',onMotion,{passive:true});listener=true;}}
function detach(){if(listener){window.removeEventListener('devicemotion',onMotion);listener=false;}}
function menu(message=''){
 session++;detach();state='menu';accumulator=0;motion.reset();run.reset();leaveFullscreen();
 $('status').textContent=message;ui();
}
function begin(){
 run.reset();state='playing';accumulator=0;lastHUD=-Infinity;
 if(mode==='demo'){run.event='Demo running · your phone is not controlling this run';run.flash=4;}
 else{run.event='Motion ready · tilt forward to roll';run.flash=3;}
 ui();
}
function onMotion(event){
 if(!['waiting','playing','paused'].includes(state))return;
 const ready=motion.feed(event,performance.now());
 if(state==='waiting'&&ready)begin();
}
async function startMotion(){
 if(!renderer||state==='waiting')return;
 const eventType=window.DeviceMotionEvent;
 if(!eventType){menu('Motion sensors are unavailable in this browser. Open on a phone, or watch the demo.');return;}
 if(window.isSecureContext===false){menu('Motion controls need HTTPS. Open the published GitHub Pages link.');return;}
 mode='motion';state='waiting';motion.reset();waitingSince=performance.now();const token=++session;
 $('status').textContent='';ui();
 try{
  // Both privileged requests begin directly inside the button's click gesture.
  const permission=typeof eventType.requestPermission==='function'?eventType.requestPermission():Promise.resolve('granted');
  void enterFullscreen();
  if(await permission!=='granted')throw Error('Motion permission was not granted. Allow Motion & Orientation Access in your browser, then try again.');
  if(token!==session)return;
  waitingSince=performance.now();attach();
 }catch(error){if(token===session)menu(error.message||'Motion access failed. Please try again.');}
}
function startDemo(){
 if(!renderer)return;
 session++;detach();motion.reset();mode='demo';void enterFullscreen();begin();
}
function pause(message='The course will be right here.'){
 if(state!=='playing')return;state='paused';accumulator=0;$('pause-message').textContent=message;ui();
}
function resume(){
 if(state!=='paused')return;
 if(mode==='motion'&&performance.now()-motion.last>1500){
  $('pause-message').textContent='Waiting for motion readings. Keep this page visible, or restart to reconnect.';return;
 }
 motion.burst=[0,0,0];state='playing';accumulator=0;void enterFullscreen();ui();
}
function finish(){
 state='finished';accumulator=0;detach();
 let record=false;
 if(mode==='motion'&&(!best||run.elapsed<best)){
  best=run.elapsed;record=true;try{localStorage.setItem('gravity-run-skyway-best-v1',String(best));}catch{}
 }
 $('finish-kicker').textContent=mode==='demo'?'DEMO COMPLETE':record?'NEW PERSONAL BEST':'COURSE COMPLETE';
 $('finish-title').textContent=mode==='demo'?'Now it’s your turn.':'You found your flow.';
 $('finish-time').textContent=time(run.elapsed);$('finish-energy').textContent=run.collected+' / '+course.cells.length;
 $('finish-falls').textContent=String(run.falls);
 $('finish-note').textContent=mode==='demo'?'Take the wheel with your phone. Your motion controls every move.':run.collected===course.cells.length?'Every energy cell. A beautiful run.':'Try another run to collect all '+course.cells.length+' energy cells.';
 $('again').textContent=mode==='demo'?'Play with motion ↗':'Roll again ↻';
 ui();
}
function frame(now){
 const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):1/60;lastFrame=now;
 if(state==='waiting'&&now-waitingSince>14000)menu('No steady motion reading yet. Hold your phone upright and still, with its top edge up, then try again.');
 if(state==='playing'&&mode==='motion'&&now-motion.last>1500)pause('Motion readings paused. Keep the game visible, then tap Keep rolling.');
 if(state==='playing'){
  accumulator=Math.min(accumulator+dt,.12);
  while(accumulator>=STEP&&state==='playing'){
   run.step(STEP,mode==='demo'?run.demoInput():motion.consume());accumulator-=STEP;
   if(run.finished)finish();
  }
 }else if(state==='menu')run.time+=dt;
 if(now-lastHUD>100){hudUpdate();lastHUD=now;}
 if(renderer)renderer.render(run,dt,state!=='menu');
 requestAnimationFrame(frame);
}
$('start').addEventListener('click',startMotion);$('demo').addEventListener('click',startDemo);
$('cancel-calibration').addEventListener('click',()=>menu());
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',resume);
$('restart-pause').addEventListener('click',()=>mode==='demo'?startDemo():startMotion());
$('exit-pause').addEventListener('click',()=>menu());$('exit-finish').addEventListener('click',()=>menu());
$('again').addEventListener('click',startMotion);$('fullscreen').addEventListener('click',()=>void enterFullscreen());
$('how').addEventListener('click',()=>{$('help').showModal();});
for(const id of ['close-help','help-done'])$(id).addEventListener('click',()=>{$('help').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state==='playing')pause('Your run paused while the page was away.');else if(state==='waiting')menu('Calibration paused. Tap Play with motion when you are ready.');}lastFrame=0;});
document.addEventListener('fullscreenchange',display);window.addEventListener('resize',display);window.addEventListener('orientationchange',display);
if(window.screen.orientation&&window.screen.orientation.addEventListener)window.screen.orientation.addEventListener('change',display);
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;menu('The 3D scene was interrupted. Reload the page to reconnect.');});
$('world').addEventListener('webglcontextrestored',()=>{window.location.reload();});
try{renderer=new GravityRenderer.Renderer($('world'),course);}catch(error){$('status').textContent=error.message+' Enable WebGL or try another browser.';}
showBest();ui();requestAnimationFrame(frame);
})();