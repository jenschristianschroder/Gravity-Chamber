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
 let bound,draws=0,uploads=0,viewport;const liveBuffers=new Set(),drawn=[];
 const gl={
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},
  getAttribLocation:(_,name)=>['aPosition','aNormal','aColor'].indexOf(name),getUniformLocation:(_,name)=>name,
  enable(){},blendFunc(){},clearColor(){},createBuffer(){const b={};liveBuffers.add(b);return b;},deleteBuffer(b){assert.ok(liveBuffers.has(b));liveBuffers.delete(b);},
  bindBuffer(_,buffer){bound=buffer;},bufferData(_,data){assert.ok(data.length>0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%30,0);bound.count=data.length/10;uploads++;},
  enableVertexAttribArray(){},vertexAttribPointer(){},
  uniformMatrix4fv(_,transpose,data){assert.equal(data.length,16);assert.ok(data.every(Number.isFinite));},
  uniform4fv(_,data){assert.ok(data.every(Number.isFinite));},uniform3fv(_,data){assert.ok(data.every(Number.isFinite));},
  drawArrays(_,start,count){assert.ok(count>0&&count<=bound.count);assert.equal(count%3,0);draws++;drawn.push(bound);},
  viewport(x,y,w,h){viewport=[w,h];},clear(){},depthMask(){}
 };
 const c=new G.Course(),run=new G.Run(c),canvas={clientWidth:390,clientHeight:844,width:0,height:0,getContext:()=>gl};
 const renderer=new R.Renderer(canvas,c);renderer.render(run,1/60,false);
 assert.deepEqual(viewport,[390,844]);assert.equal(uploads,7);assert.ok(draws>15&&draws<100);
 assert.ok(drawn.includes(renderer.disc.buffer));
 run.position[1]-=3;drawn.length=0;renderer.render(run,1/60,true);
 assert.ok(!drawn.includes(renderer.disc.buffer),'a robot below the track must never cast a shadow on top of it');
 run.reset();
 for(let i=0;i<2000;i++)run.step(1/120,run.demoInput());
 canvas.clientWidth=1280;canvas.clientHeight=720;renderer.render(run,1/60,true);
 assert.deepEqual(viewport,[1280,720]);assert.ok(renderer.eye.every(Number.isFinite));
 for(let i=1;i<6;i++){const next=new G.Course(i);renderer.setCourse(next);renderer.render(new G.Run(next),1/60,false);assert.equal(liveBuffers.size,7);}
});
test('contact shadows disappear below the surface, over gaps, and beyond track edges',()=>{
 const r=new G.Run(),contact=R.contactShadow(r);assert.ok(contact);assert.ok(contact.alpha>0);
 r.position[1]-=.05;assert.equal(R.contactShadow(r),null);
 r.position[1]-=4;assert.equal(R.contactShadow(r),null);
 r.place((r.course.gapStart+r.course.gapEnd)/2);r.position[1]+=2;assert.equal(R.contactShadow(r),null);
 r.place(20);r.position[0]+=r.surface.width+.1;assert.equal(R.contactShadow(r),null);
 r.place(0);r.position[2]-=1;assert.equal(R.contactShadow(r),null);
});
test('jump shadows soften with height and stay within narrow edges',()=>{
 const r=new G.Run(),ground=R.contactShadow(r);r.position[1]+=2;const air=R.contactShadow(r);
 assert.ok(air.alpha<ground.alpha);assert.ok(air.radius>ground.radius);
 r.place(r.course.sections[2].s+10);const q=r.surface;
 r.position=r.position.map((v,i)=>v+q.right[i]*(q.width-.12));
 const edge=R.contactShadow(r);assert.ok(edge);assert.ok(edge.radius<.12);assert.ok(edge.alpha<ground.alpha);
 r.position[1]+=7;assert.equal(R.contactShadow(r),null);
});
test('the shadow follows ramp slope and stops before the launch gap',()=>{
 const r=new G.Run();r.place(r.course.gapStart-4);const shadow=R.contactShadow(r),q=r.surface;
 assert.ok(shadow);assert.ok(Math.abs(shadow.matrix[9])>.1);
 for(const local of [[1,0,0,1],[-1,0,0,1],[0,0,1,1],[0,0,-1,1]]){
  const v=transform(shadow.matrix,local),along=G.dot(G.sub(v,q.p),q.tangent),floor=q.p[1]+along*q.slope;
  assert.ok(v[1]>floor&&v[1]-floor<.04);
 }
 r.place(r.course.gapStart-.1);const lip=R.contactShadow(r);assert.ok(lip);
 assert.ok(Math.hypot(lip.matrix[8],lip.matrix[10])<=.101);
});
test('visual feedback is bounded, clears on reset, and respects reduced motion',()=>{
 const renderer=Object.create(R.Renderer.prototype);renderer.resetEffects();
 for(let i=0;i<20;i++)renderer.handleEvents([{type:'finish',position:[0,6,2]}]);
 assert.equal(renderer.particles.length,64);
 renderer.handleEvents([{type:'recover',position:[0,6,2]}]);assert.equal(renderer.particles.length,8);assert.equal(renderer.cameraCut,true);
 renderer.resetEffects();assert.equal(renderer.particles.length,0);
 renderer.reduced=true;renderer.handleEvents([{type:'finish',position:[0,6,2]},{type:'land',position:[0,6,2],strength:1}]);
 assert.equal(renderer.particles.length,0);assert.equal(renderer.squash,0);
});
test('unsupported WebGL reports a useful startup error',()=>{
 assert.throws(()=>new R.Renderer({getContext:()=>null},new G.Course()),Error);
});
