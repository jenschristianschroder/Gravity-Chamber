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
 let bound,draws=0,uploads=0,viewport,frameVertices=0;const liveBuffers=new Set(),drawn=[],matrices=new Map();let currentMatrix;
 const gl={
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},
  getAttribLocation:(_,name)=>['aPosition','aNormal','aColor'].indexOf(name),getUniformLocation:(_,name)=>name,
  enable(){},blendFunc(){},clearColor(){},createBuffer(){const b={};liveBuffers.add(b);return b;},deleteBuffer(b){assert.ok(liveBuffers.has(b));liveBuffers.delete(b);},
  bindBuffer(_,buffer){bound=buffer;},bufferData(_,data){
   assert.ok(data.length>0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%30,0);
   for(let i=0;i<data.length;i+=10)assert.ok(Math.abs(Math.hypot(data[i+3],data[i+4],data[i+5])-1)<1e-5,'lighting normals must have unit length');
   bound.count=data.length/10;uploads++;
  },
  enableVertexAttribArray(){},vertexAttribPointer(){},
  uniformMatrix4fv(name,transpose,data){assert.equal(data.length,16);assert.ok(data.every(Number.isFinite));if(name==='uModel')currentMatrix=Array.from(data);},
  uniform4fv(_,data){assert.ok(data.every(Number.isFinite));},uniform3fv(_,data){assert.ok(data.every(Number.isFinite));},
  drawArrays(_,start,count){assert.ok(start>=0&&count>0&&start+count<=bound.count);assert.equal(start%3,0);assert.equal(count%3,0);draws++;frameVertices+=count;drawn.push(bound);matrices.set(bound,currentMatrix);},
  viewport(x,y,w,h){viewport=[w,h];},clear(){draws=0;frameVertices=0;},depthMask(){}
 };
 const c=new G.Course(),run=new G.Run(c),canvas={clientWidth:390,clientHeight:844,width:0,height:0,getContext:()=>gl};
 const renderer=new R.Renderer(canvas,c);renderer.render(run,1/60,false);
 assert.deepEqual(viewport,[390,844]);assert.equal(uploads,15);assert.ok(draws>8&&draws<80);
 assert.deepEqual(matrices.get(renderer.robotShell.buffer),matrices.get(renderer.robotTrim.buffer));
 assert.deepEqual(matrices.get(renderer.robotShell.buffer),matrices.get(renderer.robotLights.buffer));
 assert.ok(drawn.includes(renderer.disc.buffer));
 renderer.reduced=true;renderer.render(run,1/60,true);const stillGem=matrices.get(renderer.gem.buffer);run.time+=1;renderer.render(run,1/60,true);
 assert.deepEqual(matrices.get(renderer.gem.buffer),stillGem,'collectibles do not bob or spin with reduced motion');renderer.reduced=false;
 run.position[1]-=3;drawn.length=0;renderer.render(run,1/60,true);
 assert.ok(!drawn.includes(renderer.disc.buffer),'a robot below the track must never cast a shadow on top of it');
 run.reset();
 for(let i=0;i<2000;i++)run.step(1/120,run.demoInput());
 canvas.clientWidth=1280;canvas.clientHeight=720;renderer.render(run,1/60,true);
 assert.deepEqual(viewport,[1280,720]);assert.ok(renderer.eye.every(Number.isFinite));
 for(let i=0;i<G.TRACKS.length;i++){
  const next=new G.Course(i),player=new G.Run(next);renderer.setCourse(next);
  assert.equal(liveBuffers.size,15,'changing tracks releases the previous scene buffers');
  assert.ok([...liveBuffers].reduce((sum,b)=>sum+b.count*40,0)<12*1024*1024,'geometry must stay below the 12 MiB GPU buffer budget');
  for(let s=5;s<next.total;s+=30){
   player.place(s);renderer.cameraCut=true;renderer.render(player,1/60,true);
   assert.ok(draws<80,'normal gameplay stays below 80 draw calls');
   assert.ok(frameVertices<300000,'visible scene stays below 100,000 triangles');
  }
 }
});
test('distance culling keeps intersecting fog ranges and merges adjacent visible draws',()=>{
 const mesh={count:24,ranges:[
  {first:0,count:6,center:[0,0,0],radius:4},
  {first:6,count:6,center:[110,0,0],radius:3},
  {first:12,count:6,center:[120,0,0],radius:2},
  {first:18,count:6,center:[10,0,0],radius:4}
 ]};
 assert.deepEqual(R.visibleRanges(mesh,[0,0,0]),[{first:0,count:12},{first:18,count:6}]);
 assert.deepEqual(R.visibleRanges(mesh,[1000,0,0]),[]);
 assert.deepEqual(R.visibleRanges(mesh,[60,0,0]),[{first:0,count:24}]);
 assert.deepEqual(R.visibleRanges({count:9},[0,0,0]),[{first:0,count:9}]);
 assert.equal(mesh.ranges[0].count,6,'culling must not mutate stored geometry ranges');
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
test('shadows follow banked surfaces and remain clipped to the moving platform',()=>{
 const r=new G.Run(new G.Course(4));r.place(r.course.sections[5].s+14);const q=r.surface;
 r.position=r.position.map((v,i)=>v+q.right[i]*.5+(i===1?q.bank*.5:0));const bank=R.contactShadow(r);assert.ok(bank);assert.ok(Math.abs(bank.matrix[1])>.01);
 r.position[1]-=1;assert.equal(R.contactShadow(r),null);
 const p=r.course.platformAt(0,0);r.position=[p.p[0],p.p[1]+r.radius,p.p[2]];r.surface=r.course.surfaceAt(r.position,p.index,0);
 const platform=R.contactShadow(r);assert.ok(platform);assert.ok(Math.hypot(platform.matrix[8],platform.matrix[10])<p.length/2);
 r.position[1]-=1;assert.equal(R.contactShadow(r),null);
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
test('the complete robot leans with the phone in course coordinates, including on bends',()=>{
 const r=new G.Run();
 for(const s of [12,65,220]){
  r.place(s);r.pose={pitch:.2,roll:-.3,twist:.1};r.yaw+=.8;
  const m=R.robotModel(r),up=[m[4],m[5],m[6]];
  assert.ok(G.dot(up,r.surface.right)>0);assert.ok(G.dot(up,r.surface.tangent)>0);assert.ok(up[1]>.8);
  const center=transform(m,[0,0,0,1]);
  for(let i=0;i<3;i++)assert.ok(Math.abs(center[i]-r.position[i])<1e-5);
  r.pose={pitch:-.2,roll:.3,twist:0};const back=R.robotModel(r),backUp=[back[4],back[5],back[6]];
  assert.ok(G.dot(backUp,r.surface.right)<0);assert.ok(G.dot(backUp,r.surface.tangent)<0);
 }
});
