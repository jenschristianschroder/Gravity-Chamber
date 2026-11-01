const test=require('node:test');
const assert=require('node:assert/strict');
const {Chamber,apparentAcceleration,rotationVector}=require('../physics.js');
const near=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test('resting screen-up accelerometer produces gravity into the screen',()=>{
  assert.deepEqual(apparentAcceleration([0,0,9.81],[0,0,0],[0,0,0],[0,0,0],[0,0,0]).map(x=>x||0),[0,0,-9.81]);
});
test('linear acceleration causes opposite relative motion on every axis',()=>{
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const c=new Chamber();c.position=[0,0,0];const force=[0,0,0];force[axis]=sign*3;
    for(let i=0;i<30;i++)c.step(1/120,force);
    assert.ok(c.position[axis]*sign<0);
    for(let j=0;j<3;j++)if(j!==axis)near(c.position[j],0);
  }
});
test('motion rotation rates map alpha/beta/gamma to X/Y/Z radians',()=>{
  const v=rotationVector({alpha:180,beta:90,gamma:-90});near(v[0],Math.PI);near(v[1],Math.PI/2);near(v[2],-Math.PI/2);
});
test('rotating-frame forces have the expected physical directions',()=>{
  const zero=[0,0,0];
  let a=apparentAcceleration(zero,[0,0,2],zero,[1,0,0],zero);near(a[0],4);near(a[1],0);
  a=apparentAcceleration(zero,[0,0,2],zero,zero,[1,0,0]);near(a[1],-4);
  a=apparentAcceleration(zero,zero,[0,0,2],[1,0,0],zero);near(a[1],-2);
});
test('sphere settles against all six walls under sustained gravity',()=>{
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const c=new Chamber();const f=[0,0,0];f[axis]=-sign*9.81;
    for(let i=0;i<2400;i++)c.step(1/120,f);
    near(c.position[axis],sign*(c.bounds[axis]-c.radius),.002);
    near(c.velocity[axis],0,.1);
    for(let j=0;j<3;j++)assert.ok(Math.abs(c.position[j])<=c.bounds[j]-c.radius+1e-10);
  }
});
test('wall collision dissipates energy and preserves bounds',()=>{
  const c=new Chamber();c.position=[1.265,0,0];c.velocity=[4,1,0];const before=c.velocity.reduce((s,v)=>s+v*v,0);
  c.step(1/120,[0,0,0]);assert.ok(c.velocity[0]<0);assert.ok(c.velocity.reduce((s,v)=>s+v*v,0)<before);near(c.position[0],c.bounds[0]-c.radius);
});
test('combined rapid rotation and movement remain finite and inside the chamber',()=>{
  const c=new Chamber();for(let i=0;i<6000;i++){
    const t=i/120;c.step(1/120,[Math.sin(t)*35,Math.cos(t*.7)*35,Math.sin(t*.3)*35],[5*Math.sin(t),4*Math.cos(t),3],[15,-10,12]);
    c.position.forEach((p,j)=>assert.ok(Number.isFinite(p)&&Math.abs(p)<=c.bounds[j]-c.radius+1e-9));c.velocity.forEach(v=>assert.ok(Number.isFinite(v)));
  }
});
test('zero specific force permits free inertial motion without invented gravity',()=>{
  const c=new Chamber();c.position=[0,0,0];for(let i=0;i<120;i++)c.step(1/120,[0,0,0]);assert.deepEqual(c.position,[0,0,0]);
});
