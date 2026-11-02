const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('../run-core.js'),J=require('../run-journey.js'),P=require('../run-progress.js'),R=require('../run-renderer.js');
const {fixture}=require('./game-fixture.cjs');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const bankPoint=(c,sign)=>c.points.find(q=>Math.sign(q.bank)===sign&&Math.abs(q.bank)>=Math.tan((parseInt(c.track.level)-.1)*Math.PI/180));
const hold=(c,r)=>{const f=c.surfaceFrame(r.surface);return {steer:12.5*f.bank/f.d*Math.sqrt(1+f.bank*f.bank)/17,throttle:12.5*f.slope/f.d*Math.sqrt(1+f.slope*f.slope)/13};};
test('Clockwork geometry and deterministic physics remain exactly as shipped',()=>{
 for(const b of require('./clockwork-baseline.json')){const c=new G.Course(b.index,{expert:b.expert});assert.equal(crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),b.hash);const r=new G.Run(c);let n=0;while(!r.finished&&n<24000){r.step(1/120,r.demoInput());n++;}assert.equal(n,b.ticks);assert.equal(r.falls,0);}
});
test('all six Vertigo courses have steep curves in both directions and flat recovery decks',()=>{
 const shapes=new Set();for(let i=12;i<18;i++){const c=new G.Course(i);shapes.add(JSON.stringify(c.points));assert.equal(c.sections.length,6);assert.equal(c.gates.length,0);assert.equal(c.gaps.length,0);
  for(const sign of [-1,1])assert.ok(bankPoint(c,sign),c.track.name+' bank '+sign);
  assert.ok(c.checkpoints.length>new G.Course(i,{expert:true}).checkpoints.length);for(const cp of c.checkpoints){assert.equal(c.at(cp.s).bank,0);assert.equal(c.at(cp.s+4).bank,0);}
  for(const p of c.points)assert.ok(p.p.every(Number.isFinite)&&Number.isFinite(p.bank));
 }assert.equal(shapes.size,6);
});
test('neutral input slides down either bank and falls; sustained uphill input balances gravity',()=>{
 for(let i=12;i<18;i++)for(const sign of [-1,1]){const c=new G.Course(i),s=bankPoint(c,sign).s,neutral=new G.Run(c),held=new G.Run(c);neutral.place(s);held.place(s);
  const f=c.surfaceFrame(neutral.surface),expected=-12.5*f.bank/f.d/120*Math.exp(-.46/120);neutral.step(1/120,{});assert.ok(Math.abs(G.dot(neutral.velocity,neutral.surface.right)-expected)<.002,'gravity projects down the actual plane');
  for(let n=0;n<720;n++){if(!neutral.falls)neutral.step(1/120,{});held.step(1/120,hold(c,held));}
  assert.equal(neutral.falls,1,c.track.name);assert.equal(held.falls,0);assert.ok(held.grounded);assert.ok(Math.abs(held.surface.offset)<.05);assert.ok(Math.sign(hold(c,held).steer)===sign);
 }
});
test('strong uphill steering climbs the bank and the high edge is also open',()=>{
 const c=new G.Course(17),r=new G.Run(c),q=bankPoint(c,1);r.place(q.s);const y=r.position[1];for(let n=0;n<45;n++)r.step(1/120,{steer:1});assert.ok(r.surface.offset>.1);assert.ok(r.position[1]>y+.2);
 for(let n=0;n<1000&&!r.falls;n++)r.step(1/120,{steer:1});assert.equal(r.falls,1);
});
test('steep banks support the robot above their real plane but cannot catch it from underneath',()=>{
 const c=new G.Course(17),r=new G.Run(c);r.place(bankPoint(c,-1).s);const f=c.surfaceFrame(r.surface);assert.ok(Math.abs((r.position[1]-r.surface.p[1])/Math.sqrt(f.d)-r.radius)<1e-8);assert.ok(R.contactShadow(r));
 r.position[1]-=3;r.step(1/120,{});assert.equal(r.grounded,false);assert.equal(R.contactShadow(r),null);
});
test('all Vertigo courses and their practice sections are finishable without recovery',()=>{
 for(let i=12;i<18;i++)for(const c of [new G.Course(i),...Array.from({length:6},(_,s)=>J.sliceCourse(i,s,{single:true}))]){const r=new G.Run(c);let n=0;while(n++<24000&&!r.finished)r.step(1/120,r.demoInput());assert.ok(r.finished,c.track.name);assert.equal(r.falls,0,c.track.name);}
});
test('Vertigo progression, old saves, exports and challenges keep independent identities',()=>{
 const storage=memory();storage.setItem(P.KEY,JSON.stringify({version:2,rules:2,selected:10,planetSelections:[3,10],records:{skyway:{time:40},'brass-gardens':{time:50}}}));const p=new P.Progress(storage);assert.deepEqual(p.planetSelections,[3,10,12]);assert.deepEqual(p.unlockedByPlanet,[2,2,1]);
 for(let i=12;i<18;i++){const c=new G.Course(i),run={course:c,finished:true,elapsed:130,falls:0,collected:0};const result=p.complete(i,run);assert.equal(result.campaignComplete,i===17);const spec={track:i,section:null,expert:false,target:130,day:undefined};assert.deepEqual(J.decode(J.encode(spec)),spec);p.completeKey(J.key(spec),run);}
 p.select(17);assert.deepEqual(p.unlockedByPlanet,[2,2,6]);assert.equal(p.badgeUnlocked('gear'),false,'Vertigo does not award a Clockwork badge');const imported=P.parse(p.export());assert.equal(imported.selected,17);assert.ok(imported.records['challenge-17-n']);assert.equal(imported.records.skyway.time,40);
});
test('third planet selection, course locks, picker bounds and completion integrate with the UI',async()=>{
 const f=fixture();f.click('planet-2');assert.equal(f.elements['track-name'].textContent,'High Tide');assert.equal(f.elements['carousel-track-6'].hidden,true);assert.equal(f.elements['carousel-track-12'].hidden,false);assert.equal(f.elements.start.disabled,false);f.click('carousel-next');assert.equal(f.elements.start.disabled,true);f.click('carousel-prev');await f.click('start');f.calibrate();
 for(let i=12;i<18;i++){assert.equal(f.run.course.index,i);f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);assert.equal(f.elements['next-track'].hidden,i===17);if(i<17){await f.click('next-track');f.calibrate();}}
 assert.equal(f.elements['finish-kicker'].textContent,'VERTIGO COMPLETE');
});
