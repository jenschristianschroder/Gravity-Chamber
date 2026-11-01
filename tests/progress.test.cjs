const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js');
const {Progress,KEY}=require('../run-progress.js');
function memory(entries=[]){const data=new Map(entries);return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};}
const finished=(elapsed=70,collected=10)=>({finished:true,elapsed,collected});
test('six distinct courses progressively narrow bridges and speed up gates',()=>{
 const courses=G.TRACKS.map((_,i)=>new G.Course(i));
 assert.equal(courses.length,6);assert.equal(new Set(courses.map(c=>JSON.stringify(c.points))).size,6);
 for(let i=1;i<6;i++){
  assert.ok(courses[i].track.bridge<courses[i-1].track.bridge);
  assert.ok(courses[i].track.opening<courses[i-1].track.opening);
  assert.ok(courses[i].track.gateSpeed>courses[i-1].track.gateSpeed);
  assert.ok(courses[i].gaps.length>=courses[i-1].gaps.length);
  assert.ok(courses[i].checkpoints.length<=courses[i-1].checkpoints.length);
 }
 assert.equal(courses[5].gaps.length,4);assert.equal(courses[5].gates.length,6);assert.equal(courses[5].checkpoints.length,2);
});
for(let i=1;i<6;i++)test(G.TRACKS[i].name+' can be completed without falls and every obstacle is on the route',()=>{
 const c=new G.Course(i),r=new G.Run(c);
 for(const gap of c.gaps){assert.ok(c.at((gap.start+gap.end)/2).gap);assert.ok(!c.at(gap.start-1).gap);assert.ok(!c.at(gap.end+1).gap);}
 for(const cp of c.checkpoints)assert.ok(!c.at(cp.s).gap);
 for(const gate of c.gates){assert.ok(!c.at(gate.s).gap);assert.ok(c.at(gate.s).width>c.track.opening+.44);}
 for(let n=0;n<120*180&&!r.finished;n++)r.step(1/120,r.demoInput());
 assert.ok(r.finished);assert.equal(r.falls,0);assert.equal(r.checkpoint,c.checkpoints.length-1);
});
test('completion unlocks exactly the next course and persists separate best times',()=>{
 const storage=memory(),p=new Progress(storage);assert.equal(p.unlocked,1);
 assert.equal(p.complete(2,finished()),null);assert.equal(p.complete(0,{finished:false,elapsed:60}),null);
 const first=p.complete(0,finished(72));assert.ok(first.newUnlock);assert.equal(p.unlocked,2);
 p.complete(0,finished(80));assert.equal(p.record(0).time,72);assert.equal(p.unlocked,2);
 p.complete(0,finished(68));p.complete(1,finished(90));
 const reload=new Progress(storage);assert.equal(reload.unlocked,3);assert.equal(reload.record(0).time,68);assert.equal(reload.record(1).time,90);
 for(let i=2;i<6;i++){const result=reload.complete(i,finished(100+i));assert.equal(result.campaignComplete,i===5);}
 assert.equal(reload.unlocked,6);assert.equal(Object.keys(reload.records).length,6);
});
test('old Skyway records migrate and unlock Seabreeze',()=>{
 const p=new Progress(memory([['gravity-run-skyway-best-v1','66.5']]));
 assert.equal(p.unlocked,2);assert.equal(p.record(0).time,66.5);assert.equal(p.record(1),null);
});
test('corrupt or unavailable storage keeps the campaign playable without losing in-session progress',()=>{
 for(const raw of ['bad JSON','null','{"version":1,"records":{"skyway":{"time":-2}}}'])assert.equal(new Progress(memory([[KEY,raw]])).unlocked,1);
 const p=new Progress({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 p.complete(0,finished());assert.equal(p.unlocked,2);assert.equal(p.saved,false);assert.equal(p.record(0).time,70);
 assert.equal(p.select(100),false);assert.equal(p.select(5),true);assert.equal(p.selected,5);assert.equal(p.isUnlocked(5),false);
});
