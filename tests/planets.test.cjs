const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('../run-core.js'),J=require('../run-journey.js'),P=require('../run-progress.js');
const {fixture}=require('./game-fixture.cjs');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
const finished=(i,time=70)=>({course:new G.Course(i),finished:true,elapsed:time,collected:0,falls:0,splits:[]});
test('Sky Isles geometry, obstacles and both checkpoint modes match the shipped original courses exactly',()=>{
 for(const b of require('./sky-isles-baseline.json'))assert.equal(crypto.createHash('sha256').update(JSON.stringify(new G.Course(b.index,{expert:b.expert}))).digest('hex'),b.hash,'Original course '+b.index+' expert='+b.expert);
 const ticks=[7920,9769,8902,10912,12107,14464];
 for(let i=0;i<6;i++){const r=new G.Run(new G.Course(i));let n=0;while(n<24000&&!r.finished){r.step(1/120,r.demoInput());n++;}assert.equal(n,ticks[i]);assert.equal(r.falls,0);}
});
test('six Clockwork courses have distinct geometry, safe checkpoints and achievable finishes',()=>{
 const shapes=new Set();for(let i=6;i<12;i++){
  const c=new G.Course(i),r=new G.Run(c);shapes.add(JSON.stringify(c.points));assert.equal(c.sections.length,6);
  for(const cp of c.checkpoints)assert.ok(!c.at(cp.s).gap);
  for(const gate of c.gates){assert.ok(gate.rhythm);assert.ok(c.at(gate.s).width>3.5);for(let t=0;t<25;t+=.1)assert.ok(Math.abs(c.gateCenter(gate,t))+c.track.opening<c.at(gate.s).width);}
  for(let n=0;n<24000&&!r.finished;n++)r.step(1/120,r.demoInput());assert.ok(r.finished,c.track.name);assert.equal(r.falls,0,c.track.name);
 }assert.equal(shapes.size,6);
 assert.ok(new G.Course(8).routes.length);assert.ok(new G.Course(9).gaps.length);assert.ok(new G.Course(10).platforms.length);
});
test('planet unlocks, records and remembered selections remain independent and survive reloads',()=>{
 const storage=memory(),p=new P.Progress(storage);assert.deepEqual(p.unlockedByPlanet,[1,1]);assert.ok(p.isUnlocked(0)&&p.isUnlocked(6));assert.equal(p.complete(7,finished(7)),null);
 for(let i=0;i<6;i++)p.complete(i,finished(i));assert.deepEqual(p.unlockedByPlanet,[6,1]);assert.equal(p.isUnlocked(7),false);
 p.select(3);p.select(6);assert.deepEqual(p.planetSelections,[3,6]);assert.ok(p.complete(6,finished(6)).newUnlock);assert.deepEqual(p.unlockedByPlanet,[6,2]);
 for(let i=7;i<12;i++){const r=p.complete(i,finished(i));assert.equal(r.campaignComplete,i===11);}p.select(10);
 const reload=new P.Progress(storage);assert.deepEqual(reload.unlockedByPlanet,[6,6]);assert.equal(reload.selected,10);assert.deepEqual(reload.planetSelections,[3,10]);assert.equal(reload.record(0).time,70);assert.equal(reload.record(6).time,70);
 assert.ok(P.parse(reload.export()).records['brass-gardens']);
});
test('old backups open Clockwork at its first world without changing Sky Isles records or selected course',()=>{
 const storage=memory();storage.setItem(P.KEY,JSON.stringify({version:2,rules:2,selected:4,tutorialDone:true,settings:{invertSteering:true},records:{skyway:{time:36.84,medal:3,clean:true}}}));
 const p=new P.Progress(storage);assert.equal(p.record(0).time,36.84);assert.equal(p.selected,4);assert.deepEqual(p.planetSelections,[4,6]);assert.deepEqual(p.unlockedByPlanet,[2,1]);assert.ok(p.settings.invertSteering);
});
test('Clockwork challenge URLs round-trip and cannot unlock either campaign',()=>{
 const p=new P.Progress(memory());for(let i=6;i<12;i++)for(const section of [null,0,5]){
  const spec={track:i,section,expert:false,target:28.41,day:undefined};assert.deepEqual(J.decode(J.encode(spec)),spec);
  const c=J.makeCourse(spec);assert.equal(c.index,i);p.completeKey(J.key(spec),{...finished(i),course:c});
 }assert.deepEqual(p.unlockedByPlanet,[1,1]);assert.ok(P.parse(p.export()));
});
test('curated quick runs preserve platform support, have separate records, and finish in short sessions',()=>{
 for(const q of J.QUICK_RUNS){const spec={...q,expert:false,target:0},c=J.makeCourse(spec),r=new G.Run(c);
  assert.equal(c.track.name,q.name);for(let n=0;n<120*80&&!r.finished;n++)r.step(1/120,r.demoInput());assert.ok(r.finished,q.name);assert.equal(r.falls,0,q.name);assert.ok(r.elapsed>15&&r.elapsed<45,q.name+' duration '+r.elapsed);
  assert.ok(J.key(spec).startsWith('sprint-'));if(q.track===10)assert.ok(c.platforms.length);
 }
});
test('planet selector scopes the carousel and track picker, remembers each course and protects locks',()=>{
 const saved=new Map(),f=fixture({saved});f.click('carousel-dot-2');f.click('planet-1');assert.equal(f.elements['track-name'].textContent,'Brass Gardens');assert.equal(f.elements.start.disabled,false);
 assert.equal(f.elements['carousel-track-0'].hidden,true);assert.equal(f.elements['carousel-track-6'].hidden,false);assert.equal(f.elements['track-reel'].style['--page'],0);
 f.click('carousel-next');assert.equal(f.elements['track-name'].textContent,'Pendulum Park');assert.equal(f.elements.start.disabled,true);assert.equal(f.elements['track-1'].hidden,true);assert.equal(f.elements['track-7'].hidden,false);
 f.click('planet-0');assert.equal(f.elements['track-name'].textContent,'Switchback');f.click('planet-1');assert.equal(f.elements['track-name'].textContent,'Pendulum Park');
 f.elements['campaign-carousel'].handlers.keydown({key:'End',preventDefault(){}});assert.equal(f.elements['track-name'].textContent,'Grand Mechanism');assert.equal(f.elements['carousel-next'].disabled,true);
 f.click('carousel-next');assert.equal(f.elements['track-name'].textContent,'Grand Mechanism');
 const reload=fixture({saved});assert.equal(reload.elements['track-name'].textContent,'Grand Mechanism');assert.equal(reload.elements['planet-1']['aria-pressed'],'true');
});
test('Clockwork campaign finishes at its own last course, with direct result practice and earned antenna rewards',async()=>{
 const f=fixture();f.click('planet-1');await f.click('start');f.calibrate();
 for(let i=6;i<12;i++){
  assert.equal(f.run.course.index,i);f.run.sectionFalls={1:2};f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);
  assert.equal(f.elements.finish.hidden,false);assert.equal(f.elements['practice-result'].hidden,false);assert.match(f.elements['finish-advice'].textContent,/2 recoveries/);assert.equal(f.elements['next-track'].hidden,i===11);
  if(i<11){await f.click('next-track');f.calibrate();}
 }
 assert.equal(f.elements['finish-kicker'].textContent,'CLOCKWORK COMPLETE');assert.equal(f.elements['badge-gear'].disabled,false);
 f.click('badge-gear');assert.ok(f.document.getElementById('app').classList['badge-gear']);
 f.click('practice-result');await Promise.resolve();f.calibrate();assert.equal(f.run.course.kind,'sprint');assert.equal(f.run.course.sourceSection,1);
});
test('result advice compares checkpoint intervals and falls back to the section with most recoveries',()=>{
 const c=new G.Course(6),run={course:c,splits:[null,10,28],sectionFalls:{}};
 const advice=J.resultAdvice(run,{splits:[null,12,25]});assert.match(advice.detail,/5.00s lost/);assert.equal(advice.section,c.at(c.checkpoints[1].s).section);
 assert.equal(J.resultAdvice({...run,splits:[],sectionFalls:{2:3,1:1}},null).section,2);
 assert.equal(J.resultAdvice({...run,splits:[],sectionFalls:{}},null),null);
});
test('control check uses saved inversion and restores the selected planet after training',async()=>{
 const f=fixture();f.click('planet-1');f.click('edit-robot');f.change('invert-steering',true);f.click('check-controls');await Promise.resolve();await Promise.resolve();f.calibrate();assert.equal(f.run.course.kind,'training');
 f.click('pause');f.click('exit-pause');assert.equal(f.elements['track-name'].textContent,'Brass Gardens');assert.equal(f.elements['invert-steering'].checked,true);
});
