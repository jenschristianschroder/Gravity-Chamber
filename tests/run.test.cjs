const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js');
const close=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,a+' should equal '+b);
test('upright calibration gives identical tilt controls for opposite sensor conventions',()=>{
 const positive=Array.from({length:20},()=>[0,9.81,0]),negative=positive.map(v=>v.map(x=>-x));
 const a=G.calibrate(positive),b=G.calibrate(negative);
 assert.equal(a.polarity,1);assert.equal(b.polarity,-1);
 const gravity=[-2,9,2];
 const x=G.motionControls(gravity,{gamma:25},a),y=G.motionControls(gravity.map(v=>-v),{gamma:25},b);
 assert.deepEqual(x,y);assert.ok(x.throttle>0);assert.ok(x.steer>0);assert.equal(x.turn,.25);
 assert.equal(G.motionControls([0,9.81,0],{},a).throttle,0);
 assert.equal(G.calibrate(Array.from({length:20},()=>[0,0,9.81])),null);
 assert.equal(G.calibrate(positive.map((v,i)=>i%2?[3,9.81,0]:v)),null);
});
test('course contains distinct obstacles, checkpoints, and one real gap',()=>{
 const c=new G.Course();
 assert.equal(c.sections.length,6);assert.ok(c.checkpoints.length>=4);assert.equal(c.cells.length,15);
 assert.ok(c.total>330&&c.total<340);assert.ok(c.gapEnd-c.gapStart>4);
 assert.ok(c.at((c.gapStart+c.gapEnd)/2).gap);
 assert.ok(!c.at(c.gapStart-1).gap);assert.ok(!c.at(c.gapEnd+1).gap);
 assert.ok(c.at(c.sections[2].s+10).width<1.5);
 for(let i=1;i<c.points.length;i++)assert.ok(c.points[i].s>c.points[i-1].s);
});
test('fixed-step simulation accelerates, brakes, and steers with momentum',()=>{
 const r=new G.Run();
 for(let i=0;i<120;i++)r.step(1/120,{throttle:.6});
 assert.ok(r.velocity[2]>5);
 for(let i=0;i<120;i++)r.step(1/120,{throttle:-.8});
 assert.ok(r.velocity[2]<0);
 r.reset();for(let i=0;i<50;i++)r.step(1/120,{steer:.3});
 assert.ok(r.position[0]>.3);
 assert.throws(()=>r.step(.1,{}),RangeError);
});
test('upward impulse jumps, the gap has no floor, and downward impulse shortens airtime',()=>{
 const r=new G.Run();r.step(1/120,{burst:[0,1,0]});
 assert.ok(!r.grounded);assert.ok(r.velocity[1]>4);
 r.jumpCooldown=0;const before=r.velocity[1];r.step(1/120,{burst:[0,-1,0]});
 assert.ok(r.velocity[1]<before-1.8);
 r.place((r.course.gapStart+r.course.gapEnd)/2);const y=r.position[1];
 for(let i=0;i<60;i++)r.step(1/120,{});
 assert.ok(!r.grounded);assert.ok(r.position[1]<y-1);
});
test('moving gates block the solid part and let the robot pass through the opening',()=>{
 for(const blocked of [false,true]){
  const r=new G.Run(),gate=r.course.gates[0],g=r.course.at(gate.s);
  r.place(gate.s-.4);
  const offset=blocked?-g.width+.5:r.course.gateCenter(gate,1/120);
  r.position[0]+=g.right[0]*offset;r.position[2]+=g.right[2]*offset;
  r.velocity=g.tangent.map(v=>v*4);r.step(1/120,{});
  const forward=G.dot(r.velocity,g.tangent);
  assert.ok(blocked?forward<0:forward>3);
 }
});
test('fall recovery returns to the latest checkpoint with a two-second penalty',()=>{
 const r=new G.Run();r.place(r.course.checkpoints[1].s+.2);r.step(1/120,{});
 assert.equal(r.checkpoint,1);
 const before=r.elapsed;r.position[1]-=12;r.step(1/120,{});
 assert.equal(r.falls,1);close(r.elapsed-before,2+1/120);
 close(r.progress,r.course.checkpoints[1].s);assert.ok(r.grounded);
});
test('the complete demo traverses all obstacles, collects every cell, and finishes without falling',()=>{
 const r=new G.Run();
 for(let i=0;i<120*110&&!r.finished;i++)r.step(1/120,r.demoInput());
 assert.ok(r.finished);assert.equal(r.falls,0);assert.equal(r.collected,r.course.cells.length);
 assert.ok(r.elapsed>60&&r.elapsed<90);assert.equal(r.checkpoint,r.course.checkpoints.length-1);
 const t=r.elapsed;r.step(1/120,{});assert.equal(r.elapsed,t);
 r.reset();assert.ok(!r.finished);assert.equal(r.collected,0);assert.equal(r.checkpoint,0);
});
test('whole-page counterrotation preserves the physical phone orientation',()=>{
 assert.deepEqual(G.displayLayout(390,844,0),{width:390,height:844,rotation:0});
 assert.deepEqual(G.displayLayout(844,390,90),{width:390,height:844,rotation:-90});
 assert.deepEqual(G.displayLayout(844,390,-90),{width:390,height:844,rotation:-270});
 assert.deepEqual(G.displayLayout(390,844,180),{width:390,height:844,rotation:-180});
});
test('each pickup, checkpoint, jump, landing, and finish emits discrete feedback',()=>{
 const r=new G.Run(),counts={};
 for(let n=0;n<120*100&&!r.finished;n++){
  r.step(1/120,r.demoInput());
  for(const event of r.events){counts[event.type]=(counts[event.type]||0)+1;assert.ok(event.position.every(Number.isFinite));}
 }
 assert.equal(counts.cell,r.collected);assert.equal(counts.checkpoint,r.course.checkpoints.length-1);
 assert.equal(counts.finish,1);assert.ok(counts.jump>=1);assert.ok(counts.land>=1);
 r.step(1/120,{});assert.equal(r.events.length,0);
});
test('fall feedback fires once per fall and recovery supplies the checkpoint position',()=>{
 const r=new G.Run();r.position[0]=r.surface.width+1;r.position[1]=r.surface.p[1]-1;
 r.step(1/120,{});assert.equal(r.events.filter(e=>e.type==='fall').length,1);
 r.step(1/120,{});assert.ok(!r.events.some(e=>e.type==='fall'));
 r.position[1]-=12;r.step(1/120,{});
 const event=r.events.find(e=>e.type==='recover');assert.ok(event);assert.deepEqual(event.position,r.position);assert.equal(r.falling,false);
});
test('robot lean follows calibrated control directions and settles smoothly at neutral',()=>{
 const r=new G.Run();r.step(1/120,{throttle:1,steer:1,turn:1});
 assert.ok(r.pose.pitch>0&&r.pose.pitch<.28);assert.ok(r.pose.roll<0&&r.pose.roll>-.35);assert.ok(r.pose.twist>0&&r.pose.twist<.22);
 for(let i=0;i<180;i++)r.step(1/120,{});
 assert.ok(Object.values(r.pose).every(v=>Math.abs(v)<1e-6));
 r.step(1/120,{throttle:-1,steer:-1,turn:-1});assert.ok(r.pose.pitch<0&&r.pose.roll>0&&r.pose.twist<0);
 r.recover();assert.deepEqual(r.pose,{pitch:0,roll:0,twist:0});
});
test('visual tilt never changes the course physics',()=>{
 const normal=new G.Run(),changed=new G.Run();
 for(let i=0;i<300;i++){
  const input={throttle:.2,steer:Math.sin(i*.03)*.04,turn:0};
  changed.pose={pitch:2,roll:-2,twist:3};normal.step(1/120,input);changed.step(1/120,input);
  assert.deepEqual(normal.position,changed.position);assert.deepEqual(normal.velocity,changed.velocity);
 }
});
