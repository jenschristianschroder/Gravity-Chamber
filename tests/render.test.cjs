const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../run-core.js');
const R=require('../run-renderer.js');
const transform=(m,v)=>[0,1,2,3].map(row=>v.reduce((sum,x,col)=>sum+m[col*4+row]*x,0));
test('camera projection puts its target in the center and points ahead at positive clip depth',()=>{
 const eye=[2,8,-6],target=[2,3,9],view=R.lookAt(eye,target);
 const origin=transform(view,[...eye,1]);assert.ok(origin.slice(0,3).every(v=>Math.abs(v)<1e-6));
 const vp=R.multiply(R.perspective(Math.PI/3,.5,.12,140),view),p=transform(vp,[...target,1]);
 assert.ok(Math.abs(p[0]/p[3])<1e-6);assert.ok(Math.abs(p[1]/p[3])<1e-6);
 assert.ok(p[3]>0);assert.ok(p[2]/p[3]>-1&&p[2]/p[3]<1);
 const vertex=transform(R.model([3,4,5],[2,3,4]),[1,1,1,1]);
 assert.deepEqual(vertex,[5,7,9,1]);
});
test('renderer uploads finite geometry and draws the course at phone and desktop sizes',()=>{
 let bound,draws=0,uploads=0,viewport;
 const gl={
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},
  getAttribLocation:(_,name)=>['aPosition','aNormal','aColor'].indexOf(name),getUniformLocation:(_,name)=>name,
  enable(){},blendFunc(){},clearColor(){},createBuffer:()=>({}),
  bindBuffer(_,buffer){bound=buffer;},bufferData(_,data){assert.ok(data.length>0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%30,0);bound.count=data.length/10;uploads++;},
  enableVertexAttribArray(){},vertexAttribPointer(){},
  uniformMatrix4fv(_,transpose,data){assert.equal(data.length,16);assert.ok(data.every(Number.isFinite));},
  uniform4fv(_,data){assert.ok(data.every(Number.isFinite));},uniform3fv(_,data){assert.ok(data.every(Number.isFinite));},
  drawArrays(_,start,count){assert.ok(count>0&&count<=bound.count);assert.equal(count%3,0);draws++;},
  viewport(x,y,w,h){viewport=[w,h];},clear(){},depthMask(){}
 };
 const c=new G.Course(),run=new G.Run(c),canvas={clientWidth:390,clientHeight:844,width:0,height:0,getContext:()=>gl};
 const renderer=new R.Renderer(canvas,c);renderer.render(run,1/60,false);
 assert.deepEqual(viewport,[390,844]);assert.equal(uploads,7);assert.ok(draws>15&&draws<100);
 for(let i=0;i<2000;i++)run.step(1/120,run.demoInput());
 canvas.clientWidth=1280;canvas.clientHeight=720;renderer.render(run,1/60,true);
 assert.deepEqual(viewport,[1280,720]);assert.ok(renderer.eye.every(Number.isFinite));
});
test('unsupported WebGL reports a useful startup error',()=>{
 assert.throws(()=>new R.Renderer({getContext:()=>null},new G.Course()),Error);
});
