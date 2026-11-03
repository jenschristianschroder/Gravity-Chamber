const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('../run-core.js'),J=require('../run-journey.js'),P=require('../run-progress.js'),{fixture}=require('./game-fixture.cjs');
const memory=()=>{const d=new Map();return {getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,v)};};
const finished=i=>({course:new G.Course(i),finished:true,elapsed:100,collected:0,falls:0,splits:[]});
test('Vertigo geometry and exact demo finish times remain unchanged in both checkpoint modes',()=>{
 for(const b of require('./vertigo-baseline.json')){const c=new G.Course(b.index,{expert:b.expert});assert.equal(crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),b.hash);const r=new G.Run(c);let n=0;while(n<24000&&!r.finished){r.step(1/120,r.demoInput());n++;}assert.equal(n,b.ticks);assert.equal(r.falls,0);}
});
test('Flux adds six distinct skill combinations, narrower tracks and gap landings in the final two worlds',()=>{
 const names=new Set(),shapes=new Set();for(let i=18;i<24;i++){const c=new G.Course(i),r=new G.Run(c);names.add(c.track.id);shapes.add(JSON.stringify(c.points));assert.ok(c.magnetic&&c.flux);assert.equal(c.sections.length,6);assert.equal(c.checkpoints.length,6);assert.equal(new G.Course(i,{expert:true}).checkpoints.length,3);
  for(const cp of c.checkpoints)assert.ok(!c.at(cp.s).gap&&c.at(cp.s).up[1]>.99);
  for(let n=0;n<24000&&!r.finished;n++)r.step(1/120,r.demoInput());assert.ok(r.finished,c.track.name);assert.equal(r.falls,0,c.track.name);assert.equal(r.collected,c.cells.length);
  assert.equal(c.gaps.length,i>=22?3:0);
 }assert.equal(names.size,6);assert.equal(shapes.size,6);assert.ok(Math.min(...new G.Course(23).points.map(p=>p.width))<Math.min(...new G.Course(18).points.map(p=>p.width))/2);
});
test('inverted slalom and loop frames stay orthonormal with no sudden frame reversals',()=>{
 for(let i=18;i<24;i++){const c=new G.Course(i);let prior=c.at(0),upside=0;for(let d=.3;d<c.total;d+=.3){const q=c.at(d);assert.ok(q.p.every(Number.isFinite));assert.ok(Math.abs(G.dot(q.right,q.tangent))<1e-6);assert.ok(Math.abs(G.dot(q.up,q.tangent))<1e-6);assert.ok(Math.abs(G.len(q.up)-1)<1e-6);assert.ok(G.dot(prior.up,q.up)>.8,c.track.name+' frame jump');if(q.up[1]<-.8)upside++;prior=q;}assert.ok(upside>20);}
});
test('Flux bends exert stronger outward drift at higher speeds, without changing Magnetic Lab',()=>{
 const c=new G.Course(18),s=c.sections[1].s+36,slow=new G.Run(c),fast=new G.Run(c);slow.place(s);fast.place(s);slow.labForward=2;fast.labForward=8;slow.step(1/120,{});fast.step(1/120,{});assert.ok(Math.abs(fast.labSide)>Math.abs(slow.labSide)*8);
 const lab=new G.MagneticCourse(),q=new G.Run(lab),v=new G.Run(lab);for(const r of [q,v])r.place(lab.sections[1].s+36);q.labForward=8;v.labForward=2;q.step(1/120,{});v.step(1/120,{});assert.equal(q.labSide,v.labSide);
});
test('broken circuit gaps are unsupported, an unprepared crossing falls and a timed hop lands',()=>{
 const c=new G.Course(22),g=c.gaps[0],bad=new G.Run(c);assert.ok(c.at((g.start+g.end)/2).gap);bad.place(g.start-.2);bad.labForward=3;for(let n=0;n<350&&!bad.falls;n++)bad.step(1/120,{throttle:.1});assert.equal(bad.falls,1);
 const good=new G.Run(c);good.place(g.start-10);let airborne=false;for(let n=0;n<900&&good.progress<g.end+8;n++){good.step(1/120,good.demoInput());airborne||=!good.grounded;}assert.ok(airborne);assert.equal(good.falls,0);assert.ok(good.grounded&&good.progress>g.end+7);
});
test('Flux records and selection migrate independently; friend and section keys round-trip through backups',()=>{
 const storage=memory();storage.setItem(P.KEY,JSON.stringify({version:2,rules:2,selected:17,planetSelections:[4,10,17],records:{skyway:{time:40},zenith:{time:110}}}));const p=new P.Progress(storage);assert.deepEqual(p.planetSelections,[4,10,17,18]);assert.deepEqual(p.unlockedByPlanet,[2,1,1,1]);assert.ok(p.isUnlocked(18));assert.ok(!p.isUnlocked(19));
 for(let i=18;i<24;i++){const result=p.complete(i,finished(i));assert.equal(result.campaignComplete,i===23);for(const section of [null,0,5]){const spec={track:i,section,expert:false,target:55,day:undefined};assert.deepEqual(J.decode(J.encode(spec)),spec);p.completeKey(J.key(spec),finished(i));}}
 p.select(22);const imported=P.parse(p.export());assert.equal(imported.selected,22);assert.deepEqual(imported.planetSelections,[4,10,17,22]);assert.ok(imported.records['sprint-23-5']);assert.equal(imported.records.zenith.time,110);assert.deepEqual(p.unlockedByPlanet,[2,1,1,6]);
});
test('Flux UI advances through its six courses, supports targeted practice, and keeps the lab separate',async()=>{
 const f=fixture();f.click('planet-3');assert.equal(f.elements['track-name'].textContent,'Ion Gardens');assert.equal(f.elements['carousel-track-12'].hidden,true);assert.equal(f.elements['carousel-track-18'].hidden,false);await f.click('start');f.calibrate();
 for(let i=18;i<24;i++){assert.equal(f.run.course.index,i);f.run.sectionFalls={2:2};f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);assert.equal(f.elements['next-track'].hidden,i===23);if(i<23){await f.click('next-track');f.calibrate();}}
 assert.equal(f.elements['finish-kicker'].textContent,'FLUX COMPLETE');f.click('practice-result');await Promise.resolve();f.calibrate();assert.equal(f.run.course.index,23);assert.ok(f.run.course.magnetic);assert.equal(f.run.course.sourceSection,2);f.click('pause');f.click('exit-pause');f.click('open-magnetic-lab');assert.equal(f.elements['track-name'].textContent,'Magnetic Lab');
});
