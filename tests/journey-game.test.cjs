const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js'),J=require('../run-journey.js'),P=require('../run-progress.js');
const {fixture}=require('./game-fixture.cjs');
const finish=f=>{f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);assert.equal(f.elements.finish.hidden,false);};
const freshReady=f=>{f.motion();f.frame(20);for(let i=0;i<36;i++){f.motion();f.frame(20);}};
test('first play starts flight school, and skipping keeps an incoming friend challenge',async()=>{
 const spec={track:5,section:null,expert:true,target:160},f=fixture({tutorialDone:false,hash:J.encode(spec)});
 await f.click('start');f.calibrate();assert.equal(f.run.course.kind,'training');assert.equal(f.elements['training-status'].hidden,false);
 await f.click('skip-training');freshReady(f);assert.equal(f.run.course.index,5);assert.equal(f.run.course.expert,true);assert.equal(f.elements['training-status'].hidden,true);
 finish(f);const saved=JSON.parse(f.saved.get(P.KEY));assert.ok(saved.tutorialDone);assert.ok(saved.records['challenge-5-e']);assert.equal(saved.records.eventide,undefined);assert.match(f.elements['campaign-count'].textContent,/^1 \/ 6/);
 assert.equal(J.decode(new URL(f.elements['share-link'].value).hash).track,5);
});
test('quick retry reuses calibration after a fresh reading; recenter preserves the current attempt',async()=>{
 const f=fixture();await f.click('start');f.calibrate();finish(f);await f.click('again');
 assert.equal(f.elements.calibrating.hidden,false);freshReady(f);assert.equal(f.elements['bottom-hud'].hidden,false);assert.ok(f.run.elapsed<.1);
 for(let n=0;n<60;n++){f.motion([0,9,2]);f.frame(20);}const position=f.run.position.slice(),elapsed=f.run.elapsed;
 f.click('pause');await f.click('recenter');for(let n=0;n<30;n++){f.motion();f.frame(20);}assert.equal(f.elements.calibrating.hidden,false);
 for(let n=0;n<100&&f.elements['bottom-hud'].hidden;n++){assert.equal(f.run.elapsed,elapsed);assert.deepEqual(f.run.position,position);f.motion();f.frame(20);}
 assert.equal(f.elements['bottom-hud'].hidden,false);assert.ok(f.run.elapsed>=elapsed&&f.run.elapsed<elapsed+.03);assert.ok(f.run.progress>2);
});
test('slow accepted frames score all simulated time and long interruptions pause without advancing',async()=>{
 const f=fixture();await f.click('start');f.calibrate();const initial=f.run.elapsed;
 for(let n=0;n<50;n++){f.motion();f.frame(200);}assert.ok(Math.abs(f.run.elapsed-initial-10)<.01);
 const time=f.run.elapsed;f.motion();f.frame(300);assert.equal(f.run.elapsed,time);assert.equal(f.elements.paused.hidden,false);
});
test('section practice saves no campaign records and motion settings persist',async()=>{
 const saved=new Map(),f=fixture({saved});f.click('open-settings');f.change('sensitivity','gentle');f.change('advanced-controls',true);f.change('graphics-quality','eco');f.click('close-settings');
 await f.click('start');f.calibrate();f.click('pause');f.click('open-practice');await f.click('practice-2');freshReady(f);
 assert.equal(f.run.course.kind,'sprint');finish(f);assert.deepEqual(JSON.parse(saved.get(P.KEY)).records,{});assert.equal(f.elements['share-result'].hidden,true);
 const reload=fixture({saved});assert.equal(reload.elements.sensitivity.value,'gentle');assert.equal(reload.elements['advanced-controls'].checked,true);assert.equal(reload.elements['graphics-quality'].value,'eco');
});
test('a saved best produces a ghost and checkpoint differences in the next attempt',async()=>{
 const f=fixture();await f.click('start');f.calibrate();
 for(let n=0;n<120;n++){f.motion([0,9,2]);f.frame(20);}f.run.place(f.run.course.checkpoints[1].s+.1);f.motion();f.frame(20);finish(f);
 const record=JSON.parse(f.saved.get(P.KEY)).records.skyway;assert.ok(record.ghost.length>10);assert.ok(record.splits[1]);
 await f.click('again');freshReady(f);f.motion();f.frame(150);assert.ok(f.run.ghost);f.run.place(f.run.course.checkpoints[1].s+.1);f.motion();f.frame(150);
 assert.match(f.elements['split-delta'].textContent,/s at checkpoint/);
});
test('pass-the-phone gives both players three attempts, recalibrates each, and keeps personal records untouched',async()=>{
 const f=fixture();f.elements['player-one'].value='Ada';f.elements['player-two'].value='Kai';await f.click('start-party');f.calibrate();const course=f.run.course.track.name;
 for(let i=0;i<6;i++){
  assert.equal(f.run.course.track.name,course);finish(f);
  assert.match(f.elements['party-results'].textContent,/Ada/);assert.match(f.elements['party-results'].textContent,/Kai/);
  if(i<5){await f.click('party-next');for(let n=0;n<20;n++){f.motion();f.frame(20);}assert.equal(f.elements.calibrating.hidden,false);f.calibrate();}
 }
 assert.equal(f.elements['party-next'].hidden,true);assert.equal(f.elements['finish-kicker'].textContent,'FRIENDLY RIVALRY COMPLETE');
 assert.ok(!f.saved.get(P.KEY)||Object.keys(JSON.parse(f.saved.get(P.KEY)).records).length===0);
});
test('unavailable native sharing leaves a usable challenge link',async()=>{
 const f=fixture();await f.click('start');f.calibrate();finish(f);await f.click('share-result');assert.equal(f.elements['share-options'].hidden,false);
 await f.click('copy-challenge');assert.match(f.elements['share-status'].textContent,/copy the link/);
 assert.ok(f.elements['share-link'].value.startsWith('https://jenschristianschroder.github.io/Gravity-Chamber/#c=2~'));
});
test('offline installation clears the initial update button and updates reload only after selection',async()=>{
 const events={},worker={state:'installing',addEventListener:(k,fn)=>events[k]=fn},registration={waiting:null,installing:worker,addEventListener:(k,fn)=>events[k]=fn};
 let ready;const serviceWorker={register:async()=>registration,ready:new Promise(r=>ready=r),addEventListener:(k,fn)=>events[k]=fn};
 const f=fixture({navigator:{serviceWorker}});await Promise.resolve();await Promise.resolve();assert.equal(f.elements['update-game'].hidden,true);
 registration.waiting={postMessage:message=>events.sent=message};events.updatefound();worker.state='installed';events.statechange();assert.equal(f.elements['update-game'].hidden,false);
 registration.waiting=null;ready(registration);await Promise.resolve();assert.equal(f.elements['update-game'].hidden,true);assert.match(f.elements['offline-status'].textContent,/Ready to play offline/);
 registration.waiting={postMessage:message=>events.sent=message};events.updatefound();events.statechange();assert.equal(f.events.reload,undefined);
 f.click('update-game');assert.equal(events.sent.type,'ACTIVATE_UPDATE');assert.equal(f.events.reload,undefined);events.controllerchange();assert.ok(f.events.reload);
});
