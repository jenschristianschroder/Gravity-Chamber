const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js'),J=require('../run-journey.js'),P=require('../run-progress.js');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
test('all 36 short courses and 36 practice sections have safe starts, real gaps, and a reachable finish',()=>{
 for(const single of [false,true])for(let index=0;index<6;index++)for(let section=0;section<6;section++){
  const c=J.sliceCourse(index,section,{single}),r=new G.Run(c);
  assert.ok(!c.at(2).gap);assert.ok(c.total>15);assert.ok(!c.at(c.total-2.2).gap);
  for(const p of c.points)assert.equal(p.gap,c.gaps.some(g=>p.s>=g.start-.0001&&p.s<g.end-.0001));
  for(let n=0;n<120*100&&!r.finished;n++)r.step(1/120,r.demoInput());
  assert.ok(r.finished,`${index}/${section} single=${single}`);assert.equal(r.falls,0);
 }
});
test('daily routes are repeatable in UTC, have an archive, and challenge links validate all fields',()=>{
 const date=new Date('2026-11-02T23:59:59Z'),day=J.dayKey(date),spec={...J.daily(day),target:32.625};
 assert.deepEqual(J.decode(J.encode(spec)),spec);assert.equal(J.recentDays(date).length,7);assert.equal(J.recentDays(date)[6],'2026-10-27');
 assert.deepEqual(J.daily(day),J.daily(day));assert.notEqual(J.key(spec),J.key(J.daily('2026-11-03')));
 assert.equal(J.decode(''),null);assert.equal(J.validDay('2026-02-30'),false);
 for(const hash of ['#oops','#c=1~0~full~n~1~','#c=2~6~full~n~1~','#c=2~0~6~n~1~','#c=2~0~1~e~1~','#c=2~0~full~n~NaN~','#c=2~0~full~n~7200001~','#c=2~0~full~n~1~2026-02-30',J.encode({...spec,track:(spec.track+1)%6})])assert.throws(()=>J.decode(hash));
 assert.notEqual(J.key({track:0,section:null,expert:false}),G.TRACKS[0].id);
});
test('flight school requires rolling, braking, both steering directions, and an actual hop',()=>{
 const r=new G.Run(J.trainingCourse()),t=new J.Training();r.place(8);t.update(r,.01);assert.equal(t.stage,1);
 r.velocity=[0,0,3];for(let n=0;n<60;n++)t.update(r,1/120);assert.equal(t.stage,1);
 r.velocity=[0,0,0];for(let n=0;n<40;n++)t.update(r,1/120);assert.equal(t.stage,2);
 r.position[0]=-1;t.update(r,.01);assert.equal(t.stage,2);r.position[0]=1;t.update(r,.01);assert.equal(t.stage,3);
 r.place(50);t.update(r,.01);assert.equal(t.complete,false);
 r.events=[{type:'jump'}];t.update(r,.01);assert.equal(t.complete,true);assert.equal(r.finished,true);
});
test('normal checkpoints reduce repetition and expert retains the original challenge',()=>{
 for(let i=0;i<6;i++){
  const normal=new G.Course(i),expert=new G.Course(i,{expert:true});assert.ok(normal.checkpoints.length>expert.checkpoints.length);
  const checkpoints=[...normal.checkpoints,{s:normal.total}];
  for(let n=1;n<checkpoints.length;n++){assert.ok(checkpoints[n].s-checkpoints[n-1].s<90);assert.ok(!normal.at(checkpoints[n].s).gap);}
 }
});
test('shortcuts support the robot and the moving platform carries it without creating phantom ground',()=>{
 for(const index of [1,4]){
  const c=new G.Course(index),route=c.routes[0],q=c.routeAt((route.start+route.end)/2,route.id),p=[q.p[0],q.p[1]+.44,q.p[2]];
  const surface=c.surfaceAt(p,q.index,0);assert.equal(surface.route,route.id);assert.equal(surface.gap,false);
  const r=new G.Run(c);r.position=p;r.hint=q.index;r.surface=surface;r.progress=q.s;
  for(let n=0;n<120;n++)r.step(1/120,{throttle:0});assert.equal(r.falls,0);assert.ok(r.grounded);
 }
 const c=new G.Course(4),q=c.platformAt(0,0),r=new G.Run(c);r.position=[q.p[0],q.p[1]+r.radius,q.p[2]];r.hint=q.index;r.surface=c.surfaceAt(r.position,q.index,0);
 assert.equal(r.surface.platformId,0);for(let n=0;n<120;n++)r.step(1/120,{});
 const after=c.platformAt(0,r.time);assert.ok(Math.hypot(r.position[0]-after.p[0],r.position[2]-after.p[2])<.02);assert.equal(r.falls,0);
 assert.ok(c.surfaceAt([after.p[0],after.p[1]-2,after.p[2]],q.index,r.time).gap);
});
test('hops tolerate a brief edge departure and a press just before landing, independently of nudges',()=>{
 const c=J.trainingCourse(),edge=new G.Run(c);edge.place(42.98);edge.velocity=[0,0,7];edge.step(1/120,{});assert.equal(edge.grounded,false);
 edge.step(1/120,{burst:[0,1,0]});assert.ok(edge.events.some(e=>e.type==='jump'));assert.ok(edge.velocity[1]>4);
 const land=new G.Run(c);land.position[1]+=.12;land.grounded=false;land.velocity[1]=-1;let jumped=false;
 for(let n=0;n<20;n++){land.step(1/120,{burst:n===0?[0,1,0]:[0,0,0]});if(land.events.some(e=>e.type==='jump'))jumped=true;}assert.ok(jumped);
 const nudge=new G.Run(c);nudge.step(1/120,{burst:[1,0,0]});nudge.step(1/120,{burst:[0,1,0]});assert.ok(nudge.events.some(e=>e.type==='jump'));
});
test('ghost samples interpolate angles safely, hide at the end, and avoid interpolating recoveries',()=>{
 const samples=[[0,0,6,2,3.1],[1,2,6,4,-3.1],[3,30,6,4,0]];
 const half=J.ghostAt(samples,.5);assert.deepEqual(half.position,[1,6,3]);assert.ok(Math.abs(half.yaw-Math.PI)<.001);
 assert.deepEqual(J.ghostAt(samples,2).position,[2,6,4]);assert.equal(J.ghostAt(samples,4),null);
 const recorder=new J.Recorder();for(let i=0;i<4000;i++)recorder.add({elapsed:i*.2,position:[0,6,i],yaw:0});assert.equal(recorder.finish(),null);assert.equal(recorder.samples.length,3000);
});
test('medals, badges, and best ghosts persist independently; challenges cannot unlock campaign',()=>{
 const storage=memory(),p=new P.Progress(storage),c=new G.Course(),run={course:c,finished:true,elapsed:130,collected:c.cells.length,falls:1,splits:[null,10],replay:[[0,0,6,2,0],[1,0,6,3,0]]};
 p.completeKey('challenge-0-n',run);assert.equal(p.unlocked,1);assert.equal(p.marks(),0);
 p.complete(0,run);assert.equal(p.unlocked,2);assert.equal(p.record(0).allCells,true);assert.equal(p.record(0).medal,0);
 p.complete(0,{...run,elapsed:70,collected:0,falls:0,replay:[[0,0,6,2,0],[1,0,6,4,0]]});
 const best=p.record(0);assert.equal(best.time,70);assert.equal(best.medal,3);assert.ok(best.clean&&best.allCells);assert.equal(p.marks(),5);assert.ok(p.appearanceUnlocked('mint'));
 p.complete(0,{...run,elapsed:100});assert.equal(p.record(0).time,70);assert.deepEqual(p.record(0).ghost,best.ghost);
 const loaded=new P.Progress(storage);assert.deepEqual(loaded.record(0),p.record(0));assert.equal(loaded.record(0,true),null);
});
test('backups merge achievements and preserve old rules without mixing old times into new records',()=>{
 const p=new P.Progress(memory());p.import(JSON.stringify({version:1,records:{skyway:{time:40,cells:1}}}));
 assert.equal(p.unlocked,2);assert.equal(p.record(0).legacy,true);assert.equal(p.marks(),0);
 const c=new G.Course();p.complete(0,{course:c,finished:true,elapsed:80,collected:0,falls:2});assert.equal(p.record(0).time,80);
 const backup=JSON.parse(p.export());backup.records.skyway={time:95,cells:15,allCells:true,clean:true,medal:1};p.import(JSON.stringify(backup));
 assert.equal(p.record(0).time,80);assert.equal(p.record(0).medal,2);assert.ok(p.record(0).clean&&p.record(0).allCells);
 const before=p.export();for(const input of ['null','{',JSON.stringify({...backup,rules:999}),JSON.stringify({...backup,records:[]})])assert.throws(()=>p.import(input));assert.equal(p.export(),before);
 const malformed=JSON.stringify({...backup,records:{'__proto__':{time:1},skyway:{time:NaN},'sprint-5-5':{time:3,ghost:[[0,1,2,3,4],[0,2,3,4,5]]}},settings:null});
 const parsed=P.parse(malformed);assert.equal(parsed.records.skyway,undefined);assert.equal(parsed.records['sprint-5-5'].ghost,undefined);assert.equal(parsed.settings.sensitivity,'balanced');
});
test('storage pressure discards optional ghosts on disk and keeps achievements playable',()=>{
 const storage=memory(),set=storage.setItem;storage.setItem=(k,v)=>{if(Object.values(JSON.parse(v).records).some(r=>r.ghost))throw Error('quota');set(k,v);};const p=new P.Progress(storage);
 p.complete(0,{course:new G.Course(),finished:true,elapsed:72,collected:0,falls:0,replay:[[0,0,6,2,0],[1,0,6,3,0]]});
 assert.ok(p.saved);assert.ok(p.record(0).ghost);const loaded=new P.Progress(storage);assert.equal(loaded.record(0).time,72);assert.equal(loaded.record(0).ghost,undefined);
});
test('adaptive rendering responds to sustained frame pressure without changing physics settings',()=>{
 const q=new J.Quality();for(let i=0;i<250;i++)q.update(.04);assert.equal(q.scale,1);
 for(let i=0;i<500;i++)q.update(1/60);assert.ok(q.scale>1);assert.equal(q.update(.1,'eco'),1);assert.equal(q.update(.1,'high'),2);
});
test('large backups remain importable and merging archives does not exceed the record limit',()=>{
 const p=new P.Progress(memory()),ghost=Array.from({length:3000},(_,i)=>[i*.15,123.4567,6.1234,234.5678,.1234]);
 for(let i=0;i<6;i++)for(let s=0;s<6;s++)p.records[`sprint-${i}-${s}`]={time:500,cells:0,medal:0,clean:false,allCells:false,plays:1,ghost};
 assert.ok(JSON.stringify(p.snapshot()).length>2500000);const backup=p.export();assert.ok(backup.length<2500000);assert.equal(Object.keys(P.parse(backup).records).length,36);
 for(let day=1;day<=28;day++)p.import(JSON.stringify({version:2,rules:2,records:{['daily-2026-02-'+String(day).padStart(2,'0')]:{time:30}}}));
 assert.equal(Object.keys(p.records).filter(k=>k.startsWith('daily-')).length,14);assert.ok(P.parse(p.export()));
});
