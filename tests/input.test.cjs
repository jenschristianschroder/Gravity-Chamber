const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js');
const {MotionInput}=require('../run-input.js');
const event=(g=[0,9.81,0],a=[0,0,0],rate={alpha:0,beta:0,gamma:0})=>({
 accelerationIncludingGravity:{x:g[0]+a[0],y:g[1]+a[1],z:g[2]+a[2]},
 acceleration:{x:a[0],y:a[1],z:a[2]},rotationRate:rate
});
function ready(polarity=1){
 const m=new MotionInput();
 for(let t=1000;t<=2000;t+=20)m.feed(event([0,9.81*polarity,0]),t);
 assert.ok(m.calibration);return m;
}
test('missing and non-finite sensor data cannot complete calibration',()=>{
 const m=new MotionInput();
 assert.equal(m.feed({},1000),false);
 assert.equal(m.feed({accelerationIncludingGravity:{x:NaN,y:9.81,z:0}},2000),false);
 assert.equal(m.last,0);
 for(let i=0;i<60;i++)m.feed(event([0,0,9.81]),3000+i*20);
 assert.equal(m.calibration,null);
});
test('upright input calibrates both conventions and maps forward and sideways tilt consistently',()=>{
 for(const sign of [1,-1]){
  const m=ready(sign);assert.equal(m.calibration.polarity,sign);
  for(let t=2100;t<2700;t+=20)m.feed(event([-2*sign,9*sign,2*sign]),t);
  const controls=m.consume();assert.ok(controls.throttle>.4);assert.ok(controls.steer>.4);
  assert.deepEqual(controls.burst,[0,0,0]);
 }
});
test('physical nudges create bounded one-shot impulses on all translation axes',()=>{
 for(const sign of [1,-1]){
  const m=ready(sign);m.feed(event([0,9.81*sign,0],[5*sign,5*sign,-5*sign]),2800);
  assert.deepEqual(m.consume().burst,[1,1,1]);assert.deepEqual(m.consume().burst,[0,0,0]);
  m.feed(event([0,9.81*sign,0],[-5*sign,-5*sign,5*sign]),2820);
  assert.deepEqual(m.consume().burst,[0,0,0]);
  m.feed(event([0,9.81*sign,0],[-5*sign,-5*sign,5*sign]),3600);
  assert.deepEqual(m.consume().burst,[-1,-1,-1]);
 }
});
test('gravity-only sensors remain playable and gyro twist is optional',()=>{
 const m=new MotionInput();
 for(let t=1000;t<2100;t+=20){const e=event();e.acceleration=null;e.rotationRate=null;m.feed(e,t);}
 assert.ok(m.calibration);assert.equal(m.gyro,false);
 const e=event([0,9.81,0],[0,0,0],{alpha:0,beta:0,gamma:80});
 m.feed(e,2200);assert.equal(m.consume().turn,.8);
 m.reset();assert.equal(m.calibration,null);assert.equal(m.last,0);
});
test('a half-degree sensor offset stays neutral and sensitivity changes the response',()=>{
 const calibration=G.calibrate(Array(50).fill([0,9.81,0])),a=.5*Math.PI/180;
 const neutral=G.motionControls([Math.sin(a)*9.81,Math.cos(a)*9.81,0],{},calibration);assert.equal(Math.abs(neutral.steer),0);
 const gentle=G.motionControls([-2,9,2],{},calibration,{sensitivity:'gentle'}),responsive=G.motionControls([-2,9,2],{},calibration,{sensitivity:'responsive'});
 assert.ok(gentle.steer<responsive.steer&&gentle.throttle<responsive.throttle);
});
test('upright twisting uses the Y axis, pitch rotation is ignored, and hopping remains available in basic mode',()=>{
 const m=ready();m.feed(event(undefined,undefined,{alpha:0,beta:90,gamma:0}),2200);assert.equal(m.consume().turn,0);
 m.feed(event(undefined,undefined,{alpha:null,beta:null,gamma:75}),2220);assert.equal(m.consume().turn,.75);
 m.options.advanced=false;m.feed(event(undefined,[5,5,-5],{gamma:75}),2700);const input=m.consume();assert.equal(input.turn,0);assert.deepEqual(input.burst,[0,1,0]);
});
test('a directional nudge does not consume the next hop and calibration measures actual stability',()=>{
 const m=ready();m.feed(event(undefined,[5,0,0]),2200);assert.equal(m.consume().burst[0],1);m.feed(event(undefined,[0,5,0]),2300);assert.equal(m.consume().burst[1],1);
 const noisy=new MotionInput();for(let t=1000;t<2200;t+=20)noisy.feed(event([t%40?2:-2,9,0]),t);assert.equal(noisy.calibration,null);assert.equal(noisy.readiness,0);
 for(let t=2200;t<2600;t+=20)noisy.feed(event(),t);assert.equal(noisy.calibration,null);
 for(let t=2600;t<3300;t+=20)noisy.feed(event(),t);assert.ok(noisy.calibration);
});
