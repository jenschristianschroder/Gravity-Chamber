/* Browser-only controller. Motion samples and records never leave this device. */
(() => {
'use strict';
const G=GravityRun,$=id=>document.getElementById(id);
let storage;try{storage=localStorage;}catch{}
const progress=new GravityProgress.Progress(storage);
const sound=new GravityAudio.Sound(storage),reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const guide=new GravityGuide.Guide(document,{reduced});
let selected=progress.selected,course=new G.Course(selected),run=new G.Run(course);
const motion=new GravityMotion.MotionInput(),STEP=1/120;
let renderer,state='menu',mode='motion',listener=false,session=0,immersive=false,displaySession=0;
let accumulator=0,lastFrame=0,lastHUD=-Infinity,waitingSince=0;
const hints=[
 'Tilt forward to roll. Lean left or right to steer.',
 'Ease into the bends. Tilt back to slow down.',
 'Small movements. Keep the robot on the bridge.',
 'Aim for the moving opening. Slow down to line it up.',
 'Build speed, then nudge upward just before the gap.',
 'Follow the spiral. The finish is just ahead.'
];
function time(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(1).padStart(4,'0');}
function soundUI(){
 const unavailable=!sound.factory,label=unavailable?'Sound unavailable':!sound.enabled?'Sound off':sound.failed?'Enable sound':'Sound on';
 $('sound-label').textContent=label;$('sound-toggle').disabled=unavailable;
 $('sound-toggle').setAttribute('aria-pressed',String(sound.enabled&&!unavailable));
 $('sound-toggle').setAttribute('aria-label',unavailable?label:sound.enabled&&!sound.failed?'Mute sound':'Enable sound');
 $('sound-toggle').setAttribute('title',label);$('sound-toggle').classList.toggle('muted',!sound.enabled||unavailable);
}
function unlockAudio(){void sound.unlock().then(soundUI);}
function feedback(events){
 sound.handle(events);if(renderer)renderer.handleEvents(events);
 if(reduced)return;
 if(events.some(event=>event.type==='cell')&&$('energy').animate)$('energy').animate([{transform:'scale(1)'},{transform:'scale(1.18)',color:'#bb7a16'},{transform:'scale(1)'}],{duration:280,easing:'ease-out'});
 if(events.some(event=>event.type==='recover')&&$('feedback-wash').animate)$('feedback-wash').animate([{opacity:.25},{opacity:0}],{duration:450,easing:'ease-out'});
}
function showBest(){const record=progress.record(selected);$('best').textContent=[record?'Your best · '+time(record.time):'',!progress.saved?'Progress is kept for this session only.':''].filter(Boolean).join(' · ');}
function trackUI(){
 const track=course.track,unlocked=progress.isUnlocked(selected);
 $('course-label').textContent='COURSE '+String(selected+1).padStart(2,'0')+' / '+track.name.toUpperCase();
 $('track-name').textContent=track.name;$('track-difficulty').textContent=track.level+' · '+(selected+1)+' / 6';
 $('track-description').textContent=track.description;
 $('campaign-count').textContent=progress.unlocked+' / 6 tracks unlocked';
 $('course-distance').textContent=Math.round(course.total)+' metres';$('course-sections').textContent=course.sections.length+' sections';$('course-cells').textContent=course.cells.length+' energy cells';
 for(let i=1;i<=3;i++){const marker=$('route-marker-'+i),cp=course.checkpoints[i];marker.hidden=!cp;if(cp)marker.style.left=cp.s/course.total*100+'%';}
 $('start').textContent=unlocked?'Play with motion ↗':'Complete '+G.TRACKS[selected-1].name+' to unlock';
 $('start').disabled=!renderer||!unlocked;$('demo').textContent=unlocked?'Watch a demo ▷':'Preview this track ▷';
 for(let i=0;i<G.TRACKS.length;i++){
  const button=$('track-'+i),record=progress.record(i),open=progress.isUnlocked(i);
  button.classList.toggle('selected',i===selected);button.classList.toggle('locked',!open);button.setAttribute('aria-pressed',String(i===selected));
  $('track-status-'+i).textContent=record?'Completed':open?'Unlocked':'Locked · preview';
  $('track-record-'+i).textContent=record?'Best '+time(record.time):open?'Ready to roll':'Finish '+G.TRACKS[i-1].name+' first';
 }
}
function selectTrack(index){
 if(!progress.select(index))return;
 selected=index;course=new G.Course(index);run=new G.Run(course);accumulator=0;lastHUD=-Infinity;
 if(renderer)renderer.setCourse(course);
 $('status').textContent=progress.isUnlocked(index)?'':'Finish the previous track to unlock motion play. You can preview this course now.';
 ui();
}
function openTracks(){trackUI();$('tracks').showModal();}
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
 $('demo').disabled=!renderer;
 display();trackUI();showBest();soundUI();hudUpdate();
}
function hudUpdate(){
 $('timer').textContent=time(run.elapsed);$('energy').textContent=run.collected+' / '+course.cells.length;
 $('section').textContent=course.track.name+' / '+course.sections[run.surface.section].name;
 const progress=Math.round(G.clamp(run.progress/course.total,0,1)*100);
 $('distance').textContent=progress+'%';$('route-fill').style.width=progress+'%';
 $('speed').textContent=Math.round(Math.hypot(run.velocity[0],run.velocity[2])*3.6)+' km/h';
 $('checkpoint').textContent='CHECKPOINT '+(run.checkpoint+1)+' / '+course.checkpoints.length;
 $('hint').textContent=(mode==='demo'?'DEMO · ':'')+(course.sections[run.surface.section].hint||hints[run.surface.section]);
 const message=run.flash>0?run.event:'';
 if($('toast').textContent!==message){$('toast').textContent=message;$('toast').setAttribute('data-kind',run.eventKind||'info');}
}
function attach(){if(!listener){window.addEventListener('devicemotion',onMotion,{passive:true});listener=true;}}
function detach(){if(listener){window.removeEventListener('devicemotion',onMotion);listener=false;}}
function menu(message=''){
 session++;detach();state='menu';accumulator=0;motion.reset();run.reset();sound.silence();if(renderer)renderer.resetEffects();leaveFullscreen();
 $('status').textContent=message;ui();
}
function begin(){
 run.reset();if(renderer)renderer.resetEffects();state='playing';accumulator=0;lastHUD=-Infinity;sound.play('start');
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
 if(!renderer||state==='waiting'||!progress.isUnlocked(selected))return;
 const eventType=window.DeviceMotionEvent;
 if(!eventType){menu('Motion sensors are unavailable in this browser. Open on a phone, or watch the demo.');return;}
 if(window.isSecureContext===false){menu('Motion controls need HTTPS. Open the published GitHub Pages link.');return;}
 mode='motion';state='waiting';motion.reset();waitingSince=performance.now();const token=++session;
 $('status').textContent='';ui();
 try{
  // Both privileged requests begin directly inside the button's click gesture.
  unlockAudio();
  const permission=typeof eventType.requestPermission==='function'?eventType.requestPermission():Promise.resolve('granted');
  void enterFullscreen();
  if(await permission!=='granted')throw Error('Motion permission was not granted. Allow Motion & Orientation Access in your browser, then try again.');
  if(token!==session)return;
  waitingSince=performance.now();attach();
 }catch(error){if(token===session)menu(error.message||'Motion access failed. Please try again.');}
}
function startDemo(){
 if(!renderer)return;
 session++;detach();motion.reset();mode='demo';unlockAudio();void enterFullscreen();begin();
}
function pause(message='The course will be right here.'){
 if(state!=='playing')return;state='paused';accumulator=0;sound.silence();$('pause-message').textContent=message;ui();
}
function resume(){
 if(state!=='paused')return;
 if(mode==='motion'&&performance.now()-motion.last>1500){
  $('pause-message').textContent='Waiting for motion readings. Keep this page visible, or restart to reconnect.';return;
 }
 motion.burst=[0,0,0];state='playing';accumulator=0;unlockAudio();void enterFullscreen();ui();
}
function finish(){
 state='finished';accumulator=0;detach();
 const result=mode==='motion'?progress.complete(selected,run):null;
 const next=mode==='motion'&&selected<G.TRACKS.length-1&&progress.isUnlocked(selected+1);
 $('finish-kicker').textContent=mode==='demo'?'DEMO COMPLETE':result&&result.campaignComplete?'ALL SIX TRACKS COMPLETE':result&&result.record?'NEW PERSONAL BEST':'COURSE COMPLETE';
 $('finish-title').textContent=mode==='demo'?'Course previewed.':course.track.name+' complete.';
 $('finish-time').textContent=time(run.elapsed);$('finish-energy').textContent=run.collected+' / '+course.cells.length;
 $('finish-falls').textContent=String(run.falls);
 $('finish-note').textContent=mode==='demo'?(progress.isUnlocked(selected)?'Ready to try it? Take control with your phone.':'Complete '+G.TRACKS[selected-1].name+' to unlock this track. Demos do not unlock tracks.'):result&&result.newUnlock?G.TRACKS[selected+1].name+' is unlocked. Ready for the next challenge?':result&&result.campaignComplete?'Every track conquered. Replay any course to improve your records.':run.collected===course.cells.length?'Every energy cell. A beautiful run.':'Try another run to collect all '+course.cells.length+' energy cells.';
 if(mode==='motion'&&!progress.saved)$('finish-note').textContent+=' Saving is unavailable; progress lasts for this session.';
 $('next-track').hidden=!next;$('next-track').textContent=next?'Next: '+G.TRACKS[selected+1].name+' ↗':'';
 $('again').hidden=mode==='demo'&&!progress.isUnlocked(selected);$('again').classList.toggle('secondary',next);$('again').classList.toggle('primary',!next);
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
   run.step(STEP,mode==='demo'?run.demoInput():motion.consume());feedback(run.events);accumulator-=STEP;
   if(run.finished)finish();
  }
 }else if(state==='menu')run.time+=dt;
 sound.update(run,state==='playing');
 if(now-lastHUD>100){hudUpdate();lastHUD=now;}
 if(renderer)renderer.render(run,dt,state!=='menu',state==='playing'||state==='finished');
 requestAnimationFrame(frame);
}
$('start').addEventListener('click',startMotion);$('demo').addEventListener('click',startDemo);
$('sound-toggle').addEventListener('click',()=>{
 sound.setEnabled(sound.failed||!sound.enabled);soundUI();
 if(sound.enabled)void sound.unlock().then(ok=>{soundUI();if(ok)sound.play('ui');});
});
$('cancel-calibration').addEventListener('click',()=>menu());
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',resume);
$('restart-pause').addEventListener('click',()=>mode==='demo'?startDemo():startMotion());
$('exit-pause').addEventListener('click',()=>menu());$('exit-finish').addEventListener('click',()=>menu());
$('again').addEventListener('click',startMotion);$('fullscreen').addEventListener('click',()=>void enterFullscreen());
$('next-track').addEventListener('click',()=>{if(selected<G.TRACKS.length-1&&progress.isUnlocked(selected+1)){selectTrack(selected+1);return startMotion();}});
$('choose-track').addEventListener('click',openTracks);$('finish-tracks').addEventListener('click',()=>{menu();openTracks();});
$('close-tracks').addEventListener('click',()=>{$('tracks').close();});
for(let i=0;i<G.TRACKS.length;i++)$('track-'+i).addEventListener('click',()=>{selectTrack(i);$('tracks').close();});
for(const id of ['how','pause-how'])$(id).addEventListener('click',()=>{$('help').showModal();guide.open();});
for(const id of ['close-help','help-done'])$(id).addEventListener('click',()=>{guide.close();$('help').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.silence();if(state==='playing')pause('Your run paused while the page was away.');else if(state==='waiting')menu('Calibration paused. Tap Play with motion when you are ready.');}lastFrame=0;});
document.addEventListener('fullscreenchange',display);window.addEventListener('resize',display);window.addEventListener('orientationchange',display);
if(window.screen.orientation&&window.screen.orientation.addEventListener)window.screen.orientation.addEventListener('change',display);
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;menu('The 3D scene was interrupted. Reload the page to reconnect.');});
$('world').addEventListener('webglcontextrestored',()=>{window.location.reload();});
try{renderer=new GravityRenderer.Renderer($('world'),course);}catch(error){$('status').textContent=error.message+' Enable WebGL or try another browser.';}
showBest();ui();requestAnimationFrame(frame);
})();
