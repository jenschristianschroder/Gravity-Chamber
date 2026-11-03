const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../run-core.js'),R=require('../run-renderer.js'),{fixture}=require('./game-fixture.cjs');
test('magnetic ribbon has continuous orthonormal frames through spiral, corkscrew, ceiling and loop',()=>{
 const c=new G.MagneticCourse();let last=c.at(0),inverted=0,vertical=0;
 for(let s=.25;s<c.total;s+=.25){const q=c.at(s);for(const v of [q.up,q.right,q.tangent])assert.ok(Math.abs(G.len(v)-1)<1e-6);assert.ok(Math.abs(G.dot(q.right,q.tangent))<1e-6);assert.ok(Math.abs(G.dot(q.up,q.tangent))<1e-6);assert.ok(G.dot(last.up,q.up)>.97,'no abrupt frame flips');if(q.up[1]<-.9)inverted++;if(Math.abs(q.tangent[1])>.9)vertical++;last=q;}
 assert.ok(inverted>100);assert.ok(vertical>50);assert.equal(c.sections.length,6);
});
test('magnetic demo finishes upside-down sections and loop without falling',()=>{
 const c=new G.MagneticCourse(),r=new G.Run(c);let inverted=0;for(let n=0;n<18000&&!r.finished;n++){r.step(1/120,r.demoInput());if(r.grounded&&r.surface.up[1]<-.9)inverted++;assert.ok(r.position.every(Number.isFinite));}
 assert.ok(r.finished);assert.equal(r.falls,0);assert.equal(r.collected,c.cells.length);assert.ok(inverted>500);
});
test('ceiling attracts rather than dropping the robot and open edges still cause recovery',()=>{
 const c=new G.MagneticCourse(),r=new G.Run(c);r.place(c.sections[3].s+39);assert.ok(r.surface.up[1]<-.99);const y=r.position[1];for(let i=0;i<240;i++)r.step(1/120,{});assert.equal(r.falls,0);assert.equal(r.grounded,true);assert.ok(Math.abs(r.position[1]-y)<.01);assert.ok(R.contactShadow(r));
 for(let i=0;i<900&&!r.falls;i++)r.step(1/120,{steer:1});assert.equal(r.falls,1);assert.equal(r.progress,c.checkpoints[r.checkpoint].s);
});
test('surface-local hop detaches from ceiling and magnetic attraction recaptures the robot',()=>{
 const c=new G.MagneticCourse(),r=new G.Run(c);r.place(c.sections[3].s+39);r.step(1/120,{burst:[0,1,0]});assert.equal(r.grounded,false);assert.equal(R.contactShadow(r),null);for(let i=0;i<150;i++)r.step(1/120,{});assert.equal(r.grounded,true);assert.equal(r.falls,0);
});
test('lab starts with motion, completes and retries without changing campaign progress or sharing a false course',async()=>{
 const f=fixture();f.click('open-magnetic-lab');assert.equal(f.elements['track-name'].textContent,'Magnetic Lab');assert.equal(f.elements['campaign-carousel'].hidden,true);await f.click('start');f.calibrate();assert.ok(f.run.course.magnetic);assert.equal(f.elements['open-practice'].hidden,true);f.run.place(f.run.course.total-2.1);f.motion();f.frame(20);assert.equal(f.elements['finish-kicker'].textContent,'MAGNETIC TEST COMPLETE');assert.equal(f.elements['share-result'].hidden,true);assert.equal(f.elements['next-track'].hidden,true);await f.click('again');f.calibrate();assert.ok(f.run.course.magnetic);f.click('pause');f.click('exit-pause');f.click('back-campaign');assert.equal(f.elements['track-name'].textContent,'Skyway');assert.equal(f.elements['carousel-state-1'].textContent,'Locked');
});
