const test=require('node:test');
const assert=require('node:assert/strict');
require('../run-core.js');
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
 const e=event([0,9.81,0],[0,0,0],{alpha:0,beta:80,gamma:0});
 m.feed(e,2200);assert.equal(m.consume().turn,.8);
 m.reset();assert.equal(m.calibration,null);assert.equal(m.last,0);
});
