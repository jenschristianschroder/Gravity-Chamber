const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js');
const P=require('../run-progress.js');
const {fixture}=require('./game-fixture.cjs');
test('demo runs from menu to results, pauses safely, and does not write a personal best',()=>{
 const f=fixture({storageFails:true});assert.equal(f.elements.menu.hidden,false);
 f.click('demo');f.frame();assert.equal(f.elements.menu.hidden,true);assert.equal(f.elements['bottom-hud'].hidden,false);
 f.click('pause');const t=f.run.elapsed;f.frame(100);assert.equal(f.run.elapsed,t);assert.equal(f.elements.paused.hidden,false);
 f.click('resume');
 for(let i=0;i<5500&&f.elements.finish.hidden;i++)f.frame();
 assert.equal(f.elements.finish.hidden,false);assert.equal(f.elements['finish-kicker'].textContent,'DEMO COMPLETE');
 assert.equal(f.saved.size,0);assert.equal(f.run.falls,0);
 f.click('exit-finish');assert.equal(f.elements.menu.hidden,false);
});
test('permission denial and cancelled permission requests return to a usable menu',async()=>{
 const denied=fixture({permission:'denied'});await denied.click('start');
 assert.equal(denied.elements.menu.hidden,false);assert.ok(denied.elements.status.textContent.includes('permission'));
 assert.ok(!denied.events['window:devicemotion']);
 let resolve;const cancelled=fixture({deferredPermission:new Promise(r=>resolve=r)});
 const pending=cancelled.click('start');cancelled.click('cancel-calibration');resolve('granted');await pending;
 assert.equal(cancelled.elements.menu.hidden,false);assert.ok(!cancelled.events['window:devicemotion']);
});
test('motion flow calibrates, advances, pauses on lost samples, and resumes only with fresh input',async()=>{
 const f=fixture();await f.click('start');assert.equal(f.elements.calibrating.hidden,false);
 f.calibrate();assert.equal(f.elements.calibrating.hidden,true);assert.equal(f.elements['bottom-hud'].hidden,false);
 for(let i=0;i<70;i++){f.motion([0,9,3]);f.frame(20);}
 assert.ok(f.run.progress>4);
 for(let i=0;i<20;i++)f.frame(100);
 assert.equal(f.elements.paused.hidden,false);f.click('resume');assert.equal(f.elements.paused.hidden,false);
 f.motion();f.click('resume');assert.equal(f.elements.paused.hidden,true);
 f.document.hidden=true;f.events['document:visibilitychange']();assert.equal(f.elements.paused.hidden,false);
 f.click('exit-pause');assert.ok(!f.events['window:devicemotion']);assert.equal(f.elements.menu.hidden,false);
});
test('CSS rotation uses physical device orientation when native orientation lock is absent',()=>{
 const f=fixture();f.click('demo');
 f.window.innerWidth=844;f.window.innerHeight=390;f.window.screen.orientation.angle=90;
 f.events['window:resize']();
 assert.equal(f.elements.app.style['--play-width'],'390px');assert.equal(f.elements.app.style['--play-height'],'844px');
 assert.equal(f.elements.app.style['--play-rotation'],'-90deg');
});
test('calibration timeout and missing 3D support produce recoverable messages',async()=>{
 const f=fixture();await f.click('start');f.frame(15000);
 assert.equal(f.elements.menu.hidden,false);assert.ok(f.elements.status.textContent.includes('steady motion'));
 const broken=fixture({webgl:false});assert.equal(broken.elements.start.disabled,true);
 assert.equal(broken.elements.demo.disabled,true);assert.ok(broken.elements.status.textContent.includes('WebGL'));
});

test('a completed motion run saves a personal best and can restart with fresh calibration',async()=>{
 const f=fixture();await f.click('start');f.calibrate();
 f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);
 assert.equal(f.elements.finish.hidden,false);assert.equal(f.elements['finish-kicker'].textContent,'NEW PERSONAL BEST');
 assert.ok(JSON.parse(f.saved.get(P.KEY)).records.skyway.time>0);
 assert.ok(!f.events['window:devicemotion']);
 await f.click('again');assert.equal(f.elements.calibrating.hidden,false);
 f.calibrate();assert.equal(f.elements['bottom-hud'].hidden,false);assert.ok(f.run.progress<3);
});
test('locked tracks allow previews but cannot start motion play or unlock the campaign',async()=>{
 const f=fixture();f.click('choose-track');assert.ok(f.elements.tracks.open);
 f.click('track-5');assert.equal(f.elements.tracks.open,false);assert.equal(f.elements.start.disabled,true);
 await f.click('start');assert.ok(!f.events['window:devicemotion']);
 f.click('demo');for(let i=0;i<8500&&f.elements.finish.hidden;i++)f.frame();
 assert.equal(f.elements.finish.hidden,false);assert.equal(f.elements['finish-kicker'].textContent,'DEMO COMPLETE');
 assert.equal(f.elements['next-track'].hidden,true);assert.equal(f.elements.again.hidden,true);
 assert.deepEqual(JSON.parse(f.saved.get(P.KEY)).records,{});
 f.click('finish-tracks');f.click('track-0');assert.equal(f.elements.start.disabled,false);
});
test('the player advances through all six tracks and reloading preserves the campaign',async()=>{
 const saved=new Map(),f=fixture({saved});await f.click('start');f.calibrate();
 for(let i=0;i<6;i++){
  assert.equal(f.run.course.index,i);f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);
  assert.equal(f.elements.finish.hidden,false);assert.ok(JSON.parse(saved.get(P.KEY)).records[G.TRACKS[i].id]);
  assert.equal(f.elements['next-track'].hidden,i===5);
  if(i<5){await f.click('next-track');f.calibrate();}
 }
 assert.equal(f.elements['finish-kicker'].textContent,'ALL SIX TRACKS COMPLETE');
 const reload=fixture({saved});reload.frame();assert.equal(reload.run.course.index,5);
 assert.match(reload.elements['campaign-count'].textContent,/^6 \/ 6 tracks unlocked · \d+ mastery marks$/);
 reload.click('choose-track');reload.click('track-1');assert.equal(reload.elements.start.disabled,false);
 assert.equal(reload.elements['track-name'].textContent,'Seabreeze');
 assert.ok(reload.elements.best.textContent.includes('Your best'));
});
test('sound waits for a gesture, follows pause and visibility, and remembers mute',async()=>{
 const saved=new Map(),f=fixture({saved});assert.equal(f.sound.context,null);
 f.click('demo');f.frame();assert.ok(f.sound.context);assert.equal(f.sound.active,true);
 f.click('pause');assert.equal(f.sound.active,false);f.frame();assert.equal(f.sound.rollGain.gain.value,0);
 f.click('resume');f.frame();assert.equal(f.sound.active,true);
 f.document.hidden=true;f.events['document:visibilitychange']();assert.equal(f.sound.active,false);
 f.click('sound-toggle');assert.equal(f.sound.enabled,false);assert.equal(f.elements['sound-label'].textContent,'Sound off');
 const reload=fixture({saved});assert.equal(reload.sound.enabled,false);assert.equal(reload.sound.context,null);
});
test('animated instructions open without WebGL and can be viewed during a paused run',()=>{
 const basic=fixture({webgl:false});basic.click('how');assert.ok(basic.guide.opened);assert.ok(basic.elements.help.open);
 basic.click('close-help');assert.equal(basic.guide.opened,false);assert.equal(basic.elements.help.open,false);
 const f=fixture();f.click('demo');f.frame();f.click('pause');const elapsed=f.run.elapsed;
 f.click('pause-how');assert.ok(f.guide.opened);f.frame(100);assert.equal(f.run.elapsed,elapsed);
 f.click('help-done');assert.equal(f.guide.opened,false);assert.equal(f.elements.paused.hidden,false);
});
test('app navigation switches one screen at a time and settings preserve a paused attempt',()=>{
 const f=fixture();f.click('home-nav-worlds');assert.ok(f.elements.tracks.open);
 f.click('tracks-nav-challenges');assert.equal(f.elements.tracks.open,false);assert.ok(f.elements.challenges.open);
 f.click('challenges-nav-courier');assert.equal(f.elements.challenges.open,false);assert.ok(f.elements.settings.open);
 f.click('settings-nav-play');assert.equal(f.elements.settings.open,false);assert.equal(f.elements.menu.hidden,false);
 f.click('demo');f.frame();assert.equal(f.elements['app-nav'].hidden,true);assert.equal(f.document.body.classList.playing,true);
 f.click('open-settings');const elapsed=f.run.elapsed;assert.equal(f.elements.paused.hidden,false);assert.equal(f.document.body.classList.playing,false);
 f.frame(200);assert.equal(f.run.elapsed,elapsed);f.click('close-settings');assert.equal(f.elements.paused.hidden,false);f.click('resume');f.frame();assert.ok(f.run.elapsed>elapsed);
});
