/* All play remains controlled by device motion. Data stays in this browser. */
(() => {
'use strict';
const G=GravityRun,J=GravityJourney,S=GravityShare,$=id=>document.getElementById(id),nav=window.navigator||{};
let storage;try{storage=localStorage;}catch{}
const progress=new GravityProgress.Progress(storage),settings=progress.settings;
const sound=new GravityAudio.Sound(storage),reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const appDisplays=['standalone','fullscreen'].map(mode=>window.matchMedia?.('(display-mode: '+mode+')'));
const guide=new GravityGuide.Guide(document,{reduced}),wake=new S.Wake(nav),quality=new J.Quality(),motion=new GravityMotion.MotionInput(settings),STEP=1/120;
let selected=progress.selected,course=new G.Course(selected,{expert:settings.expert}),run=new G.Run(course);
let renderer,rendererError='',state='menu',mode='motion',activity='campaign',challenge=null,training=null,trainingReturn=null,party=null;
let listener=false,session=0,immersive=false,displaySession=0,permissionGranted=false,recentering=false,readyAt=0;
let accumulator=0,lastFrame=0,lastHUD=-Infinity,waitingSince=0,lastRender=0,baseline=null,recorder=null,nextAction=null,shareSpec=null,shareBlob=null,shareGeneration=0;
let installPrompt=null,registration=null,reloadForUpdate=false;
let carouselDrag=null,carouselDragged=false,resultPractice=null;
const quickSections=[3,2,1,3,4,4];
const hints=['Tilt forward to roll. Lean left or right to steer.','Ease into the bends. Tilt back to slow down.','Small movements. Keep the robot on the bridge.','Aim for the moving opening. Slow down to line it up.','Build speed, then nudge upward just before the gap.','Follow the spiral. The finish is just ahead.'];
const time=S.formatTime,now=()=>performance.now();
function record(){return activity==='campaign'?progress.record(selected,course.expert):activity==='challenge'?progress.records[J.key(challenge)]||null:null;}
function setURL(hash=''){try{window.history.replaceState(null,'',window.location.pathname+window.location.search+hash);}catch{}}
function soundUI(){
 const unavailable=!sound.factory,label=unavailable?'Sound unavailable':!sound.enabled?'Sound off':sound.failed?'Enable sound':'Sound on';
 $('sound-label').textContent=label;$('sound-toggle').disabled=unavailable;$('sound-toggle').setAttribute('aria-pressed',String(sound.enabled&&!unavailable));
 $('sound-toggle').setAttribute('aria-label',unavailable?label:sound.enabled&&!sound.failed?'Mute sound':'Enable sound');$('sound-toggle').classList.toggle('muted',!sound.enabled||unavailable);
}
function unlockAudio(){void sound.unlock().then(soundUI);}
function feedback(events){
 sound.handle(events);if(renderer)renderer.handleEvents(events);
 if(reduced)return;
 if(events.some(e=>e.type==='cell')&&$('energy').animate)$('energy').animate([{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:230});
 if(events.some(e=>e.type==='recover')&&$('feedback-wash').animate)$('feedback-wash').animate([{opacity:.2},{opacity:0}],{duration:280});
}
function prepare(c,type='campaign',spec=null){
 course=c;activity=type;challenge=spec;run=new G.Run(course);accumulator=0;lastHUD=-Infinity;baseline=null;
 if(renderer){renderer.setCourse(course);renderer.appearance=J.APPEARANCES.find(a=>a.id===settings.appearance)?.color||[1,1,1];}
}
function trackUI(){
 const planet=Math.floor(selected/6),planetInfo=G.PLANETS[planet];
 $('tracks-title').textContent=planetInfo.name+' worlds.';
 $('planet-picker').hidden=activity!=='campaign';$('planet-description').hidden=activity!=='campaign';$('planet-description').textContent=planetInfo.description;
 $('app').classList.toggle('clockwork',course.index>=6&&course.index<12);$('app').classList.toggle('vertigo',course.index>=12&&course.index<18);$('app').classList.toggle('flux',course.index>=18);
 for(let p=0;p<G.PLANETS.length;p++){$('planet-'+p).setAttribute('aria-pressed',String(p===planet));$('planet-progress-'+p).textContent=progress.unlockedByPlanet[p]+' / 6 worlds';}
 const open=activity!=='campaign'||progress.isUnlocked(selected),r=record(),track=course.track;
 $('course-label').textContent=activity==='campaign'?'COURSE '+String(selected%6+1).padStart(2,'0')+' / '+(course.expert?'EXPERT':'CAMPAIGN'):activity==='challenge'?(challenge.day?'DAILY FLIGHT / '+challenge.day:'FRIENDLY CHALLENGE'):activity==='party'?'PASS THE PHONE':activity==='practice'?'SECTION PRACTICE':activity==='lab'?'EXPERIMENTAL / MAGNETIC LAB':'FLIGHT SCHOOL';
 $('track-name').textContent=track.name;$('track-difficulty').textContent=activity==='campaign'?track.level+' · '+(selected%6+1)+' / 6':'Motion controls · separate results';
 $('track-description').textContent=activity==='campaign'?track.description:activity==='training'?'Four small steps. Find your balance.':activity==='lab'?course.track.description+' Cyan edges hold you to the surface. Both edges are open.':'A short flight. Everyone can take part.';
 $('campaign-count').textContent=progress.unlockedByPlanet[planet]+' / 6 tracks unlocked · '+progress.marks()+' mastery marks';
 $('course-distance').textContent=Math.round(course.total)+' metres';$('course-sections').textContent=course.sections.length+' sections';$('course-cells').textContent=course.cells.length+' energy cells';
 $('start').textContent=!open?'Locked':!progress.tutorialDone&&activity!=='party'&&activity!=='lab'?'Learn to play':activity==='challenge'?'Accept challenge':'Start run';
 $('start').disabled=!renderer||!open;$('start').classList.toggle('locked',!open);$('demo').disabled=!renderer;$('demo').textContent='Preview';
 $('course-lock-note').hidden=open;$('course-lock-note').textContent=open?'':'Finish '+G.TRACKS[Math.max(0,selected-1)].name+' to unlock.';
 $('best').textContent=[r?(r.legacy?'Previous rules · ':'Your best · ')+time(r.time)+(r.medal?' · '+J.MEDALS[r.medal]:'' ):'',!progress.saved?'Progress is kept for this session only.':''].filter(Boolean).join(' · ');
 $('challenge-invite').hidden=activity!=='challenge';$('challenge-invite').textContent=challenge?.target?'Can you beat '+time(challenge.target)+'? '+track.name+' · about '+Math.max(15,Math.round(course.total/5))+' seconds. Same course, same rules. Send a rematch when you finish.':challenge?.day?'Today’s route is the same for everyone. Your best result is saved on this device.':'A short course, open to everyone. Campaign unlocks stay separate.';
 $('back-campaign').hidden=activity==='campaign';
 const today=J.daily(),dailyRecord=progress.records[J.key(today)];
 $('daily-name').textContent=G.TRACKS[today.track].name+' · daily flight';$('daily-record').textContent=dailyRecord?J.MEDALS[dailyRecord.medal]+' · '+time(dailyRecord.time):'A short challenge, open to everyone';
 for(let i=1;i<=3;i++){const marker=$('route-marker-'+i),cp=course.checkpoints[Math.round(i*(course.checkpoints.length-1)/4)];marker.hidden=!cp||cp.s<=2;if(cp)marker.style.left=cp.s/course.total*100+'%';}
 for(let i=0;i<G.TRACKS.length;i++){
  const b=$('track-'+i),best=progress.record(i,settings.expert),unlocked=progress.isUnlocked(i);
  b.hidden=Math.floor(i/6)!==planet;b.classList.toggle('selected',activity==='campaign'&&i===selected);b.classList.toggle('locked',!unlocked);b.setAttribute('aria-pressed',String(activity==='campaign'&&i===selected));
  $('track-status-'+i).textContent=best&&!best.legacy?(J.MEDALS[best.medal]+(best.clean?' · Clean':'')+(best.allCells?' · All cells':'')):best?'Completed':unlocked?'Unlocked':'Locked · preview';
  $('track-record-'+i).textContent=best?(best.legacy?'Previous rules ':'Best ')+time(best.time):unlocked?'Ready to roll':'Finish '+G.TRACKS[Math.max(0,i-1)].name+' first';
  const card=$('carousel-track-'+i),dot=$('carousel-dot-'+i),current=i===selected;card.hidden=Math.floor(i/6)!==planet;dot.hidden=Math.floor(i/6)!==planet;
  card.classList.toggle('selected',current);card.classList.toggle('locked',!unlocked);card.setAttribute('aria-pressed',String(current));card.setAttribute('aria-hidden',String(!current));card.setAttribute('tabindex',current?'0':'-1');
  card.setAttribute('aria-label',G.TRACKS[i].name+', '+G.TRACKS[i].level+', '+(unlocked?'unlocked':'locked'));
  dot.setAttribute('aria-pressed',String(current));dot.setAttribute('aria-label','Select '+G.TRACKS[i].name+(unlocked?'':', locked'));
  $('carousel-state-'+i).textContent=!unlocked?'Locked':best&&!best.legacy&&best.medal?J.MEDALS[best.medal]:'Ready';
 }
 $('campaign-carousel').hidden=activity!=='campaign';$('special-course').hidden=activity==='campaign';
 $('track-reel').style.setProperty('--page',selected%6);$('carousel-prev').disabled=selected%6===0;$('carousel-next').disabled=selected%6===5;
 $('carousel-announcement').textContent=planetInfo.name+', '+G.TRACKS[selected].name+', track '+(selected%6+1)+' of 6';
}
function carouselSelect(index){
 if(state!=='menu'||activity!=='campaign'||index<0||index>=G.TRACKS.length||Math.floor(index/6)!==Math.floor(selected/6)||index===selected)return;
 const previous=$('carousel-track-'+selected),moveFocus=document.activeElement===previous;
 if(moveFocus)previous.blur();
 selectTrack(index);
 if(moveFocus)$('carousel-track-'+selected).focus({preventScroll:true});
}
function carouselReset(){
 carouselDrag=null;$('track-reel').classList.toggle('dragging',false);$('track-reel').style.setProperty('--drag-x','0px');
}
function carouselPointerDown(event){
 if(state!=='menu'||activity!=='campaign'||event.isPrimary===false||event.button!==undefined&&event.button!==0)return;
 carouselDragged=false;carouselDrag={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,horizontal:false,width:$('carousel-window').clientWidth||320};
}
function carouselPointerMove(event){
 const drag=carouselDrag;if(!drag||event.pointerId!==drag.id)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(!drag.horizontal){
  if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
  if(Math.abs(dy)>Math.abs(dx)){carouselReset();return;}
  drag.horizontal=true;carouselDragged=true;$('track-reel').classList.toggle('dragging',true);$('carousel-window').setPointerCapture?.(event.pointerId);
 }
 event.preventDefault();drag.dx=dx;
 const resistance=(selected%6===0&&dx>0||selected%6===5&&dx<0)?.2:1;
 $('track-reel').style.setProperty('--drag-x',Math.max(-drag.width,Math.min(drag.width,dx*resistance))+'px');
}
function carouselPointerUp(event){
 const drag=carouselDrag;if(!drag||event.pointerId!==drag.id)return;
 const next=drag.horizontal&&Math.abs(drag.dx)>Math.min(55,drag.width*.16)?selected+(drag.dx<0?1:-1):selected;
 carouselReset();carouselSelect(next);
}
function selectTrack(index){
 if(!progress.select(index))return;selected=index;party=null;training=null;trainingReturn=null;prepare(new G.Course(index,{expert:settings.expert}));state='menu';setURL();
 $('status').textContent=rendererError;ui();
}
function chooseChallenge(spec,type='challenge'){
 training=null;prepare(J.makeCourse(spec),type,spec);state='menu';$('status').textContent=rendererError;setURL(J.encode(spec));ui();
}
function inAppMode(){return !!nav.standalone||!!appDisplays[0]?.matches||!document.fullscreenElement&&!!appDisplays[1]?.matches;}
function display(){
 // Follow browser chrome/keyboard changes without turning pinch zoom into a layout resize.
 const viewport=window.visualViewport,visible=viewport&&Math.abs(viewport.scale-1)<.01;
 const width=visible&&viewport.width>0?viewport.width:window.innerWidth,height=visible&&viewport.height>0?viewport.height:window.innerHeight;
 const angle=window.screen.orientation&&window.screen.orientation.angle,layout=G.displayLayout(width,height,Number.isFinite(angle)?angle:Number(window.orientation)||0),style=$('app').style;
 style.setProperty('--viewport-width',width+'px');style.setProperty('--viewport-height',height+'px');
 style.setProperty('--play-width',layout.width+'px');style.setProperty('--play-height',layout.height+'px');style.setProperty('--play-rotation',layout.rotation+'deg');
 $('fullscreen').hidden=inAppMode()||!document.documentElement.requestFullscreen||!!document.fullscreenElement||state!=='playing';
 $('install-settings').hidden=inAppMode();if(inAppMode())$('keep-game').hidden=true;
}
async function enterFullscreen(){
 immersive=true;const token=++displaySession;
 try{if(!inAppMode()&&!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{}
 if(!immersive||token!==displaySession){if(!immersive&&document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});return;}
 try{if(window.screen.orientation?.lock)await window.screen.orientation.lock('portrait-primary');}catch{}display();
}
function leaveFullscreen(){
 immersive=false;displaySession++;try{window.screen.orientation?.unlock();}catch{}if(document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});
}
function ui(){
 document.body.classList.toggle('active',state!=='menu');
 document.body.classList.toggle('playing',state==='playing');
 $('menu').hidden=state!=='menu';$('calibrating').hidden=state!=='waiting';$('countdown').hidden=state!=='ready';$('paused').hidden=state!=='paused';$('finish').hidden=state!=='finished';
 const hud=state==='playing';$('hud-stats').hidden=!hud;$('route-hud').hidden=!hud;$('bottom-hud').hidden=state!=='playing';$('edition').hidden=state!=='menu';
 $('training-status').hidden=activity!=='training'||state!=='playing';$('recenter').hidden=mode==='demo';$('open-practice').hidden=activity==='training'||activity==='party'||activity==='lab';
 $('open-settings').hidden=state==='waiting'||state==='ready';display();trackUI();soundUI();hudUpdate();
}
function hudUpdate(){
 $('timer').textContent=time(run.elapsed);$('energy').textContent=run.collected+' / '+course.cells.length;
 $('section').textContent=activity==='training'?training?.title||'Flight school':course.track.name+' / '+course.sections[run.surface.section].name;
 const distance=Math.round(G.clamp(run.progress/course.total,0,1)*100);$('distance').textContent=distance+'%';$('route-fill').style.width=distance+'%';
 const speed=(course.magnetic?G.len(run.velocity):Math.hypot(run.velocity[0],run.velocity[2]));$('speed').textContent=Math.round(speed*3.6)+' km/h';$('checkpoint').textContent='CHECKPOINT '+(run.checkpoint+1)+' / '+course.checkpoints.length;
 let hint=course.sections[run.surface.section].hint||hints[run.surface.section]||'Find your line.';
 if(course.index>=12&&Math.abs(run.surface.bank)>.35)hint=Math.round(Math.atan(Math.abs(run.surface.bank))*180/Math.PI)+'° bank · Steer uphill toward the gold edge. Hold, then ease off.';
 for(const route of course.routes||[])if(run.progress>route.start-8&&run.progress<route.start+6)hint='Wide bend or narrow shortcut? The shortcut holds a bonus cell.';
 if(activity==='training'&&training){hint='';$('training-step').textContent=training.title;$('training-goal').textContent=(training.stage===2&&settings.invertSteering?'Steering is reversed. ':'')+training.instruction;$('tilt-dot').style.transform='translateX('+(motion.controls.steer*58)+'px)';}
 $('hint').textContent=(mode==='demo'?'DEMO · ':'')+hint;
 const gap=course.gaps.find(g=>g.start-run.progress<15&&g.end>run.progress);
 run.landingCue=gap?course.at(Math.min(course.total,gap.end+3)):null;
 let jump='Hop ready ↑',jumpState='ready';
 if(!run.grounded){jump=run.falling?'Returning to checkpoint':'Airborne · aim for the landing ring';jumpState='air';}
 else if(run.jumpCooldown>0){jump='Settling…';jumpState='build';}
 else if(gap&&gap.start>run.progress&&speed<5.5){jump='Build speed for the gap';jumpState='build';}
 else if(gap&&gap.start-run.progress<2.5){jump='Hop now ↑';}
 if(course.magnetic&&!gap)jump=run.grounded?(run.surface.up[1]<-.6?'Upside down · magnetic grip':Math.abs(run.surface.up[1])<.4?'Wall ride · magnetic grip':'Magnetic grip active'):'Contact lost · returning to ribbon';
 $('jump-status').textContent=jump;$('jump-status').setAttribute('data-state',jumpState);
 let split='';const cp=run.lastSplit;
 if(cp&&baseline?.splits?.[cp.index]!=null){const d=cp.time-baseline.splits[cp.index];split=(d<=0?'−':'+')+Math.abs(d).toFixed(2)+'s at checkpoint';}
 else if(challenge?.target)split='Target '+time(challenge.target);
 $('split-delta').textContent=split;
 $('practice-suggestion').hidden=activity==='training'||activity==='party'||activity==='lab'||mode==='demo'||!(run.sectionFalls[run.surface.section]>=2);
 const message=run.flash>0?run.event:'';if($('toast').textContent!==message){$('toast').textContent=message;$('toast').setAttribute('data-kind',run.eventKind||'info');}
 if(state==='waiting'){const p=motion.calibration?100:Math.round(motion.readiness*100);$('calibration-fill').style.width=p+'%';$('calibration-progress').setAttribute('aria-valuenow',String(p));$('calibration-status').textContent=motion.calibration?'Starting angle saved. Waiting for a fresh reading…':motion.reason;}
 if(state==='ready')$('ready-number').textContent=String(Math.max(1,Math.ceil((readyAt-now())/1000)));
}
function attach(){if(!listener){window.addEventListener('devicemotion',onMotion,{passive:true});listener=true;}}
function detach(){if(listener){window.removeEventListener('devicemotion',onMotion);listener=false;}}
function menu(message=''){
 session++;detach();state='menu';accumulator=0;motion.clearImpulses();run.reset();sound.silence();void wake.set(false);if(renderer)renderer.resetEffects();leaveFullscreen();$('status').textContent=message||rendererError;ui();
}
function begin(){
 if(!recentering){run.reset();run.externalClock=true;baseline=record();recorder=new J.Recorder();if(activity==='training')training=new J.Training();}
 recentering=false;if(renderer){renderer.resetEffects();renderer.cameraCut=true;}state='playing';accumulator=0;lastFrame=0;lastHUD=-Infinity;motion.clearImpulses();void wake.set(true);sound.play('start');
 run.event=mode==='demo'?'Demo running · your phone is not controlling this run':activity==='party'?party.players[party.turn%2].name+' · run '+(Math.floor(party.turn/2)+1)+' / 3':'Motion ready · tilt forward to roll';run.flash=3;ui();
}
function onMotion(event){
 if(!['waiting','ready','playing','paused'].includes(state))return;
 const ready=motion.feed(event,now());
 if(state==='waiting'&&ready){state='ready';readyAt=now()+700;motion.clearImpulses();ui();}
}
async function startMotion({fresh=false,recenter=false}={}){
 if(!renderer||state==='waiting'||state==='ready'||activity==='campaign'&&!progress.isUnlocked(selected))return;
 if(activity==='campaign'&&course.expert!==settings.expert)prepare(new G.Course(selected,{expert:settings.expert}));
 const eventType=window.DeviceMotionEvent;
 if(!eventType){menu('Motion sensors are unavailable here. Open this link on a phone, or watch the demo.');return;}
 if(window.isSecureContext===false){menu('Motion controls need HTTPS. Open the published GitHub Pages link.');return;}
 mode='motion';recentering=recenter;state='waiting';void wake.set(false);
 if(fresh||!motion.calibration||now()-motion.last>120000)motion.reset();else motion.clearImpulses();
 waitingSince=now();const token=++session;$('status').textContent='';ui();
 try{
  unlockAudio();const permission=permissionGranted?Promise.resolve('granted'):typeof eventType.requestPermission==='function'?eventType.requestPermission():Promise.resolve('granted');
  void enterFullscreen();if(await permission!=='granted')throw Error('Motion permission was not granted. Allow Motion & Orientation Access in your browser, then try again.');
  if(token!==session)return;permissionGranted=true;waitingSince=now();attach();
 }catch(error){if(token===session)menu(error.message||'Motion access failed. Please try again.');}
}
function launchTraining(){
 trainingReturn={activity:activity==='training'?'campaign':activity,spec:challenge,selected};training=new J.Training();prepare(J.trainingCourse(),'training');state='menu';void startMotion();
}
function returnFromTraining(play=true){
 const target=trainingReturn||{activity:'campaign',selected,spec:null};progress.tutorialDone=true;progress.save();training=null;trainingReturn=null;
 if(target.activity==='challenge'&&target.spec)chooseChallenge(target.spec);else selectTrack(target.selected);
 if(play)void startMotion();
}
function play(){if(!renderer)return;if(!progress.tutorialDone&&activity!=='training'&&activity!=='party'&&activity!=='lab')launchTraining();else void startMotion();}
function startDemo(){
 if(!renderer)return;session++;detach();motion.clearImpulses();mode='demo';recentering=false;unlockAudio();void enterFullscreen();begin();
}
function pause(message='The course will be right here.'){
 if(state!=='playing'&&state!=='ready')return;state='paused';accumulator=0;sound.silence();void wake.set(false);$('pause-message').textContent=message;ui();
}
function resume(){
 if(state!=='paused')return;
 if(mode==='motion'&&now()-motion.last>1500){$('pause-message').textContent='Waiting for motion readings. Keep this page visible, or recenter to reconnect.';return;}
 motion.clearImpulses();recentering=true;unlockAudio();void enterFullscreen();if(mode==='demo'){begin();return;}state='ready';readyAt=now()+700;ui();
}
function finish(){
 state='finished';accumulator=0;detach();sound.silence();void wake.set(false);run.ghost=null;run.replay=recorder?.finish();
 let result=null;const scored=mode==='motion'&&(activity==='campaign'||activity==='challenge');
 if(scored)result=activity==='campaign'?progress.complete(selected,run):progress.completeKey(J.key(challenge),run);
 const rank=J.medal(run.elapsed,J.targets(course)),goal=J.nextGoal(run,result?.earned||record());
 $('finish-kicker').textContent=mode==='demo'?'DEMO COMPLETE':activity==='training'?'FLIGHT SCHOOL COMPLETE':activity==='practice'?'PRACTICE COMPLETE':activity==='lab'?'MAGNETIC TEST COMPLETE':result?.campaignComplete?(course.index>=6?G.PLANETS[Math.floor(course.index/6)].name.toUpperCase()+' COMPLETE':'ALL SIX TRACKS COMPLETE'):result?.record?'NEW PERSONAL BEST':'FLIGHT COMPLETE';
 $('finish-title').textContent=activity==='training'?'You’re ready to roll.':mode==='demo'?'Course previewed.':course.track.name+' complete.';
 $('finish-time').textContent=time(run.elapsed);$('finish-energy').textContent=run.collected+' / '+course.cells.length;$('finish-falls').textContent=String(run.falls);
 $('finish-badges').textContent=scored?[J.MEDALS[rank]+(rank?' medal':''),run.falls===0?'✓ Clean run':'',course.cells.length&&run.collected===course.cells.length?'◆ All cells':''].filter(Boolean).join(' · '):'';
 $('finish-delta').textContent=baseline&&!baseline.legacy?(run.elapsed<baseline.time?'Improved by ':'Behind your best by ')+Math.abs(run.elapsed-baseline.time).toFixed(2)+'s':'';
 let note=mode==='demo'?'Take control with your phone when you are ready.':activity==='lab'?'Test complete. Try another run to compare how the spiral, corkscrew and ceiling feel. Campaign records are unchanged.':activity==='practice'?'That section is yours to practise. Campaign records are unchanged.':activity==='training'?'Roll, brake, steer, and hop. Take those four moves into your first course.':goal.detail;
 if(challenge?.target&&mode==='motion'){const delta=run.elapsed-challenge.target;note=delta<0?'You beat the challenge by '+(-delta).toFixed(2)+'s. Send a rematch!':delta===0?'A perfect tie. One more run?':delta.toFixed(2)+'s to beat your friend. Try another line.';}
 if(result?.newUnlock)note+=' '+G.TRACKS[selected+1].name+' is unlocked.';
 if(result?.newColors.length)note+=' New courier color: '+result.newColors.join(', ')+'.';
 if(scored&&!progress.saved)note+=' Saving is unavailable; export your progress before leaving.';
 $('finish-note').textContent=note;
 const advice=activity==='campaign'&&mode==='motion'?J.resultAdvice(run,baseline):null;resultPractice=advice?.section??null;
 $('finish-advice').hidden=!advice;$('practice-result').hidden=!advice;$('finish-advice').textContent=advice?.detail||'';
 $('share-result').textContent=challenge?.target?'Send a rematch':'Challenge a friend';settingsUI();
 nextAction=null;
 if(activity==='training'){nextAction=()=>returnFromTraining();$('next-track').textContent='Start the course';}
 else if(activity==='practice'){nextAction=()=>{selectTrack(selected);void startMotion();};$('next-track').textContent='Back to my campaign';}
 else if(activity==='campaign'&&mode==='motion'&&selected%6<5&&progress.isUnlocked(selected+1)){nextAction=()=>{selectTrack(selected+1);void startMotion();};$('next-track').textContent='Next: '+G.TRACKS[selected+1].name+'';}
 $('next-track').hidden=!nextAction;
 $('again').hidden=activity==='training'||activity==='party'||mode==='demo'&&activity==='campaign'&&!progress.isUnlocked(selected);
 $('again').textContent=mode==='demo'?'Play with motion':challenge?.target?'Retry the challenge':scored?goal.label+'':'Practise again';
 $('again').classList.toggle('secondary',!!nextAction);$('again').classList.toggle('primary',!nextAction);
 $('party-results').hidden=activity!=='party'||mode==='demo';$('party-next').hidden=activity!=='party'||mode==='demo';$('share-result').hidden=!scored&&!(activity==='party'&&mode==='motion');$('share-options').hidden=true;$('share-status').textContent='';
 if(activity==='party'&&party&&mode==='motion'){
  const player=party.players[party.turn%2];player.runs.push(run.elapsed);
  const standings=party.players.map(p=>({name:p.name,best:p.runs.length?Math.min(...p.runs):null})).sort((a,b)=>(a.best??Infinity)-(b.best??Infinity));
  $('party-results').textContent=standings.map((p,i)=>(i+1)+'. '+p.name+' · '+(p.best===null?'Up next':time(p.best))).join('\n');
  party.turn++;$('party-next').hidden=party.turn>=6;
  $('finish-kicker').textContent=party.turn>=6?'FRIENDLY RIVALRY COMPLETE':'PASS THE PHONE';
  $('finish-note').textContent=party.turn>=6?(standings[0].best===standings[1].best?'A tie!':standings[0].name+' takes this round.')+' Start another rivalry from the menu.':party.players[party.turn%2].name+' is next. Find a comfortable starting angle.';
  $('party-next').textContent=party.turn<6?'Next: '+party.players[party.turn%2].name+'':'';
 }
 shareSpec=scored||activity==='party'&&mode==='motion'?{...(challenge||{track:selected,section:null,expert:course.expert}),target:run.elapsed}:null;shareBlob=null;
 if(shareSpec){const generation=++shareGeneration;S.card(document,{name:course.track.name,time:run.elapsed,medal:J.MEDALS[rank],cells:run.collected,falls:run.falls}).then(blob=>{if(generation===shareGeneration)shareBlob=blob;});$('share-link').value=S.challengeURL(shareSpec);}
 $('keep-game').hidden=!scored||inAppMode();ui();
}
function openPractice(){if(state==='playing')pause();const full=new G.Course(course.index);for(let i=0;i<6;i++)$('practice-'+i).textContent=full.sections[i]?.name||'Section '+(i+1);$('practice').showModal();}
function practiceSection(section){const index=course.index;$('practice').close();training=null;party=null;prepare(J.sliceCourse(index,section,{single:true}),'practice');state='menu';void startMotion();}
function openChallenges(){
 for(let i=0;i<J.QUICK_RUNS.length;i++){const q=J.QUICK_RUNS[i],r=progress.records[J.key(q)];$('quick-'+i).textContent=q.name+' · '+(r?J.MEDALS[r.medal]+' '+time(r.time):'New')+'\n'+q.description;}
 const days=J.recentDays();for(let i=0;i<7;i++){const spec=J.daily(days[i]),r=progress.records[J.key(spec)];$('day-'+i).textContent=(i===0?'Today · ':days[i]+' · ')+G.TRACKS[spec.track].name+(r?'\n'+J.MEDALS[r.medal]+' · '+time(r.time):'\nA fresh flight');}
 for(let i=0;i<6;i++)$('challenge-'+i).textContent=G.TRACKS[i].name+' · '+new G.Course(i).sections[quickSections[i]].name;
 $('challenges').showModal();
}
function settingsUI(){
 $('learn-controls').disabled=!renderer;$('check-controls').disabled=!renderer;$('start-party').disabled=!renderer;
 $('reward-progress').textContent=progress.nextReward();
 for(const b of J.BADGES){const el=$('badge-'+b.id),open=progress.badgeUnlocked(b.id);el.disabled=!open;el.textContent=b.name+(open?'':' · Locked');el.setAttribute('aria-pressed',String(settings.badge===b.id&&open));el.setAttribute('title',open?b.name:progress.badgeProgress(b.id).need+' '+b.goal);$('app').classList.toggle('badge-'+b.id,settings.badge===b.id&&open);}
 const appearance=J.APPEARANCES.find(a=>a.id===settings.appearance)||J.APPEARANCES[0];
 $('courier-name').textContent=appearance.name+' courier';
 $('app').style.setProperty('--courier-shell',({ivory:'url(#brand-shell)',coral:'#f1c7b5',mint:'#b8ebcc',sky:'#bbdcec',gold:'#f0d992'})[appearance.id]);
 $('sensitivity').value=settings.sensitivity;$('invert-steering').checked=settings.invertSteering;$('advanced-controls').checked=settings.advanced;$('expert-mode').checked=settings.expert;$('graphics-quality').value=settings.quality;$('show-ghost').checked=settings.ghost;
 $('mastery-count').textContent=progress.marks()+' mastery marks. Medals, clean runs, and all-cells badges unlock colors.';
 for(const a of J.APPEARANCES){const b=$('color-'+a.id),open=progress.appearanceUnlocked(a.id);b.disabled=!open;b.setAttribute('aria-pressed',String(a.id===settings.appearance));b.setAttribute('title',open?a.name:a.description);b.textContent=a.name+(open?'':' · '+a.need);}
}
function changeSettings(){
 settings.sensitivity=$('sensitivity').value;settings.invertSteering=$('invert-steering').checked;settings.advanced=$('advanced-controls').checked;settings.expert=$('expert-mode').checked;settings.quality=$('graphics-quality').value;settings.ghost=$('show-ghost').checked;progress.save();
 if(state==='menu'&&activity==='campaign')prepare(new G.Course(selected,{expert:settings.expert}));settingsUI();trackUI();
}
function install(){
 if(installPrompt){void installPrompt.prompt();installPrompt=null;}
 else $('settings-status').textContent='On iPhone: open in Safari, tap Share, then Add to Home Screen. On Android: use your browser’s Install app or Add to Home Screen option. Offline play becomes ready after the first online visit finishes.';
}
async function share(){
 if(!shareSpec)return;$('share-options').hidden=false;
 const url=S.challengeURL(shareSpec),data={title:'Gravity Run · '+course.track.name,text:'I finished '+course.track.name+' in '+time(run.elapsed)+'. Can you beat me? Tilt your phone to play.',url};
 try{
  if(nav.share){if(shareBlob&&typeof File!=='undefined'&&nav.canShare){const file=new File([shareBlob],'gravity-run-result.png',{type:'image/png'});if(nav.canShare({files:[file]}))data.files=[file];}await nav.share(data);$('share-status').textContent='Challenge ready in your share sheet.';}
  else $('share-status').textContent='Copy the challenge link or save your result card.';
 }catch(error){$('share-status').textContent=error.name==='AbortError'?'Sharing cancelled. Your result is still here.':'Sharing is unavailable here. Copy the link below.';}
}
function frame(timestamp){
 const raw=lastFrame?(timestamp-lastFrame)/1000:1/60;lastFrame=timestamp;const dt=Math.max(0,Math.min(raw,.1));
 if(state==='waiting'&&timestamp-waitingSince>14000)menu('No steady motion reading yet. Keep the phone’s top edge up, hold still, and try again.');
 if(['playing','ready'].includes(state)&&mode==='motion'&&timestamp-motion.last>1500)pause('Motion readings paused. Keep the game visible, then resume.');
 if(state==='ready'&&timestamp>=readyAt)begin();
 if(state==='playing'&&raw>.25)pause('The game paused during a long interruption. Resume when your phone is ready. Battery saver graphics can help.');
 if(state==='playing'){
  // Fully simulate accepted active time. Score at each step, including the exact finish step.
  accumulator+=raw;
  while(accumulator+1e-9>=STEP&&state==='playing'){
   run.elapsed+=STEP;run.step(STEP,mode==='demo'?run.demoInput():motion.consume());if(activity==='training'&&training&&mode==='motion')training.update(run,STEP);
   feedback(run.events);accumulator-=STEP;if(run.finished)finish();
  }
  if(state==='playing'){recorder?.add(run);run.ghost=settings.ghost&&!reduced?J.ghostAt(baseline?.ghost,run.elapsed):null;}
 }else if(state==='menu')run.time+=dt;
 sound.update(run,state==='playing');
 if(timestamp-lastHUD>100){hudUpdate();lastHUD=timestamp;}
 if(renderer){
  renderer.sceneVisible=state==='playing';
  renderer.badge=progress.badgeUnlocked(settings.badge)?settings.badge:'none';
  renderer.pixelRatio=quality.update(raw,settings.quality,state==='playing');renderer.appearance=J.APPEARANCES.find(a=>a.id===settings.appearance)?.color||[1,1,1];
  run.trainingStage=activity==='training'?training?.stage:null;
  if(state!=='menu'||timestamp-lastRender>50){renderer.render(run,dt,state!=='menu',state==='playing'||state==='finished');lastRender=timestamp;}
 }
 requestAnimationFrame(frame);
}
for(let p=0;p<G.PLANETS.length;p++)$('planet-'+p).addEventListener('click',()=>{carouselReset();selectTrack(progress.planetSelections[p]);});
$('practice-result').addEventListener('click',()=>{if(resultPractice!==null)practiceSection(resultPractice);});
for(const b of J.BADGES)$('badge-'+b.id).addEventListener('click',()=>{if(progress.badgeUnlocked(b.id)){settings.badge=b.id;progress.save();settingsUI();}});
$('check-controls').addEventListener('click',()=>{$('settings').close();launchTraining();});
for(let i=0;i<J.QUICK_RUNS.length;i++)$('quick-'+i).addEventListener('click',()=>{const q=J.QUICK_RUNS[i];$('challenges').close();chooseChallenge({track:q.track,section:q.section,expert:false,target:0});play();});
$('start').addEventListener('click',play);$('demo').addEventListener('click',startDemo);
$('carousel-prev').addEventListener('click',()=>carouselSelect(selected-1));$('carousel-next').addEventListener('click',()=>carouselSelect(selected+1));
for(let i=0;i<G.TRACKS.length;i++){
 $('carousel-dot-'+i).addEventListener('click',()=>carouselSelect(i));
 $('carousel-track-'+i).addEventListener('click',()=>{if(carouselDragged){carouselDragged=false;return;}carouselSelect(i);});
}
$('campaign-carousel').addEventListener('keydown',event=>{const index=event.key==='ArrowLeft'?selected-1:event.key==='ArrowRight'?selected+1:event.key==='Home'?Math.floor(selected/6)*6:event.key==='End'?Math.floor(selected/6)*6+5:null;if(index!==null){event.preventDefault();carouselSelect(index);}});
$('carousel-window').addEventListener('pointerdown',carouselPointerDown);$('carousel-window').addEventListener('pointermove',carouselPointerMove);
$('carousel-window').addEventListener('pointerup',carouselPointerUp);$('carousel-window').addEventListener('pointercancel',carouselReset);
$('sound-toggle').addEventListener('click',()=>{sound.setEnabled(sound.failed||!sound.enabled);soundUI();if(sound.enabled)void sound.unlock().then(ok=>{soundUI();if(ok)sound.play('ui');});});
$('cancel-calibration').addEventListener('click',()=>menu());$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',resume);
$('restart-pause').addEventListener('click',()=>mode==='demo'?startDemo():startMotion());$('recenter').addEventListener('click',()=>void startMotion({fresh:true,recenter:true}));
$('exit-pause').addEventListener('click',()=>{if(activity==='training')returnFromTraining(false);menu();});$('exit-finish').addEventListener('click',()=>{if(activity==='training')returnFromTraining(false);if(activity==='party')selectTrack(selected);menu();});
$('again').addEventListener('click',()=>mode==='demo'?play():startMotion());$('fullscreen').addEventListener('click',()=>void enterFullscreen());
$('next-track').addEventListener('click',()=>nextAction&&nextAction());$('choose-track').addEventListener('click',()=>{$('tracks').showModal();trackUI();});
$('finish-tracks').addEventListener('click',()=>{menu();$('tracks').showModal();});$('close-tracks').addEventListener('click',()=>$('tracks').close());
for(let i=0;i<G.TRACKS.length;i++)$('track-'+i).addEventListener('click',()=>{selectTrack(i);$('tracks').close();});
for(const id of ['how','pause-how'])$(id).addEventListener('click',()=>{$('help').showModal();guide.open();});
for(const id of ['close-help','help-done'])$(id).addEventListener('click',()=>{guide.close();$('help').close();});
for(const id of ['open-settings','edit-robot'])$(id).addEventListener('click',()=>{if(state==='playing')pause();settingsUI();$('settings').showModal();});$('close-settings').addEventListener('click',()=>$('settings').close());
for(const id of ['sensitivity','invert-steering','advanced-controls','expert-mode','graphics-quality','show-ghost'])$(id).addEventListener('change',changeSettings);
for(const a of J.APPEARANCES)$('color-'+a.id).addEventListener('click',()=>{if(progress.appearanceUnlocked(a.id)){settings.appearance=a.id;progress.save();settingsUI();}});
$('learn-controls').addEventListener('click',()=>{$('settings').close();launchTraining();});$('skip-training').addEventListener('click',()=>returnFromTraining());
$('daily-play').addEventListener('click',()=>{chooseChallenge(J.daily());play();});$('open-challenges').addEventListener('click',openChallenges);$('close-challenges').addEventListener('click',()=>$('challenges').close());
for(let i=0;i<7;i++)$('day-'+i).addEventListener('click',()=>{$('challenges').close();chooseChallenge(J.daily(J.recentDays()[i]));play();});
for(let i=0;i<6;i++)$('challenge-'+i).addEventListener('click',()=>{$('challenges').close();chooseChallenge({track:i,section:quickSections[i],expert:false,target:0});play();});
$('open-magnetic-lab').addEventListener('click',()=>{training=null;party=null;prepare(new G.MagneticCourse(),'lab');state='menu';setURL();$('status').textContent=rendererError;ui();});
$('back-campaign').addEventListener('click',()=>selectTrack(selected));$('open-practice').addEventListener('click',openPractice);$('close-practice').addEventListener('click',()=>$('practice').close());
$('practice-suggestion').addEventListener('click',()=>{pause();practiceSection(run.surface.section);});
for(let i=0;i<6;i++)$('practice-'+i).addEventListener('click',()=>practiceSection(i));
$('open-party').addEventListener('click',()=>$('party').showModal());$('close-party').addEventListener('click',()=>$('party').close());
$('start-party').addEventListener('click',()=>{party={turn:0,players:[{name:($('player-one').value||'Player 1').trim().slice(0,18)||'Player 1',runs:[]},{name:($('player-two').value||'Player 2').trim().slice(0,18)||'Player 2',runs:[]}]};$('party').close();chooseChallenge(J.daily(),'party');void startMotion({fresh:true});});
$('party-next').addEventListener('click',()=>{if(party&&party.turn<6)void startMotion({fresh:true});});
$('share-result').addEventListener('click',()=>void share());
$('copy-challenge').addEventListener('click',async()=>{try{await nav.clipboard.writeText($('share-link').value);$('share-status').textContent='Challenge link copied.';}catch{$('share-link').select?.();$('share-status').textContent='Select and copy the link above.';}});
$('save-card').addEventListener('click',()=>{if(shareBlob)S.download(document,shareBlob,'gravity-run-result.png');else $('share-status').textContent='The card is still preparing. Try again in a moment, or copy the link.';});
$('export-progress').addEventListener('click',()=>{S.download(document,new Blob([progress.export()],{type:'application/json'}),'gravity-run-progress.json');$('settings-status').textContent='Backup exported. Keep it to restore your progress in another browser.';});
$('import-progress').addEventListener('click',()=>$('backup-file').click());
$('backup-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2500000)throw Error('Choose a backup smaller than 2.5 MB.');const result=progress.import(await file.text());$('settings-status').textContent='Backup merged. '+result.tracks+' tracks unlocked.'+(result.saved?'':' Saving is unavailable in this browser.');trackUI();settingsUI();}catch(error){$('settings-status').textContent=error.message;}event.target.value='';});
$('install-settings').addEventListener('click',install);$('install-finish').addEventListener('click',()=>{settingsUI();$('settings').showModal();install();});
$('update-game').addEventListener('click',()=>{if(!registration?.waiting)return;if(state==='playing')pause();reloadForUpdate=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.silence();void wake.set(false);if(state==='playing'||state==='ready')pause('Your run paused while the page was away.');else if(state==='waiting')menu('Calibration paused. Tap Play with motion when you are ready.');}else display();lastFrame=0;});
document.addEventListener('fullscreenchange',display);window.addEventListener('resize',display);window.addEventListener('orientationchange',display);window.screen.orientation?.addEventListener('change',display);
window.visualViewport?.addEventListener('resize',display);window.addEventListener('pageshow',()=>{lastFrame=0;display();});
for(const query of appDisplays)query?.addEventListener?.('change',display);
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;rendererError='The 3D scene was interrupted. Reload the page to reconnect.';menu(rendererError);});$('world').addEventListener('webglcontextrestored',()=>window.location.reload());
try{renderer=new GravityRenderer.Renderer($('world'),course);}catch(error){rendererError=error.message+' Enable WebGL or try another browser.';$('status').textContent=rendererError;}
try{const incoming=J.decode(window.location.hash||'');if(incoming)chooseChallenge(incoming);}catch(error){$('status').textContent=error.message;}
if(nav.serviceWorker&&window.location.protocol==='https:'){
 const updateReady=()=>{const waiting=!!registration?.waiting;$('update-game').hidden=!waiting;if(waiting)$('offline-status').textContent='An update is ready. Reload when you have finished your run.';};
 nav.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(r=>{
  registration=r;updateReady();r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')updateReady();});});
  nav.serviceWorker.ready.then(()=>{updateReady();if(!registration.waiting)$('offline-status').textContent='Ready to play offline on this device.';});
 }).catch(()=>{$('offline-status').textContent='Offline saving is unavailable here. You can still play while this page is open.';});
 nav.serviceWorker.addEventListener('controllerchange',()=>{if(reloadForUpdate)window.location.reload();else updateReady();});
}else $('offline-status').textContent='This browser does not support offline installation.';
settingsUI();ui();requestAnimationFrame(frame);
})();
