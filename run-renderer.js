/* Small dependency-free WebGL renderer for Gravity Run. */
(function(root){
'use strict';
const G=root.GravityRun,SKY=[.73,.86,.9],WHITE=[.93,.96,.92],TEAL=[.13,.39,.43],CORAL=[1,.39,.26],MINT=[.43,.86,.73],INK=[.075,.21,.25],GOLD=[1,.75,.3];
const MATTE=[.04,18,0],CERAMIC=[.32,48,0],METAL=[.42,38,0],LIT=[.15,24,.65];
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,n)=>a.map(v=>v*n);
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function model(p,s=[1,1,1],yaw=0){const c=Math.cos(yaw),n=Math.sin(yaw);return[c*s[0],0,-n*s[0],0,0,s[1],0,0,n*s[2],0,c*s[2],0,p[0],p[1],p[2],1];}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];out[c*4+r]=v;}return out;}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,target,up=[0,1,0]){const z=G.norm(G.sub(eye,target)),x=G.norm(G.cross(up,z)),y=G.cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-G.dot(x,eye),-G.dot(y,eye),-G.dot(z,eye),1];}
function robotModel(run){
 if(run.course.magnetic){const q=run.surface,pose=run.pose||{pitch:0,roll:0},a=pose.roll,b=pose.pitch,c=Math.cos(a),s=Math.sin(a),cp=Math.cos(b),sp=Math.sin(b),frame=[...q.right,0,...q.up,0,...q.tangent,0,...run.position,1];return multiply(frame,multiply([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1],[1,0,0,0,0,cp,sp,0,0,-sp,cp,0,0,0,0,1]));}
 const pose=run.pose||{pitch:0,roll:0,twist:0},banked=run.course.index>=12&&run.grounded,frame=banked?run.course.surfaceFrame(run.surface):null,tilt=pose.pitch-(frame?Math.atan(frame.slope):0),lean=pose.roll+(frame?Math.atan(frame.bank):0),c=Math.cos(tilt),s=Math.sin(tilt),a=Math.cos(lean),b=Math.sin(lean);
 const pitch=[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1],roll=[a,b,0,0,-b,a,0,0,0,0,1,0,0,0,0,1];
 const courseYaw=Math.atan2(run.surface.tangent[0],run.surface.tangent[2]);
 // Lean in the same course frame as steering, while the face follows travel.
 return multiply(model(run.position,[1,1,1],courseYaw),multiply(pitch,multiply(roll,model([0,0,0],[1,1,1],run.yaw-courseYaw+pose.twist))));
}
function contactShadow(run){
 if(run.course.magnetic){if(!run.grounded)return null;const q=run.surface,u=run.labU||0,radius=Math.min(.55,(q.width-Math.abs(u))*.9);if(radius<=0)return null;const p=q.p.map((v,k)=>v+q.right[k]*u+q.up[k]*.02);return {height:0,alpha:.3,radius,matrix:[...q.right.map(v=>v*radius),0,...q.up,0,...q.tangent.map(v=>v*radius),0,...p,1]};}
 const q=run.surface,p=run.position,relative=G.sub(p,q.p),along=G.dot(relative,q.tangent);
 const floor=q.p[1]+along*q.slope+G.dot(relative,q.right)*(q.bank||0),height=p[1]-run.radius*(run.course.index>=12?Math.sqrt(run.course.surfaceFrame(q).d):1)-floor,clearance=q.width-Math.abs(G.dot(relative,q.right));
 // A surface must be underneath the robot, never above it or beyond an edge.
 if(q.gap||height<-.015||height>6||clearance<=.025||Math.abs(along)>.35)return null;
 const radius=Math.min(.58+Math.max(0,height)*.08,clearance*.96);
 let length=radius;
 if(q.platform)length=Math.min(length,q.length/2-Math.abs(q.platformAlong||0));
 else for(const gap of run.course.gaps)if(q.s<=gap.start)length=Math.min(length,gap.start-q.s);else if(q.s>=gap.end)length=Math.min(length,q.s-gap.end);
 length=Math.min(length,q.s,run.course.total-q.s);
 if(radius<=.025||length<=.025)return null;
 const tangent=[q.tangent[0],q.slope,q.tangent[2]],right=[q.right[0],q.bank||0,q.right[2]],normal=G.norm(G.cross(tangent,right));
 const alpha=.34*Math.exp(-Math.max(0,height)*.6)*G.clamp(clearance/.65,0,1);
 return {height,alpha,radius,matrix:[
  right[0]*radius,right[1]*radius,right[2]*radius,0,
  normal[0],normal[1],normal[2],0,
  tangent[0]*length,tangent[1]*length,tangent[2]*length,0,
  p[0]+normal[0]*.025,floor+normal[1]*.025,p[2]+normal[2]*.025,1
 ]};
}
function vertex(out,p,n,color){out.push(...p,...n,color[0],color[1],color[2],color[3]===undefined?1:color[3]);}
function tri(out,a,b,c,color,normal){const n=normal||G.norm(G.cross(G.sub(b,a),G.sub(c,a)));vertex(out,a,n,color);vertex(out,b,n,color);vertex(out,c,n,color);}
function quad(out,a,b,c,d,color,normal){tri(out,a,b,c,color,normal);tri(out,a,c,d,color,normal);}
function box(out,p,size,color,yaw=0){
 const m=model(p,size,yaw),transform=v=>[m[0]*v[0]+m[8]*v[2]+p[0],v[1]*size[1]+p[1],m[2]*v[0]+m[10]*v[2]+p[2]];
 const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(transform);
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(out,...f.map(i=>v[i]),color);
}
function sphere(out,p,size,color,lat=8,lon=12){
 const get=(i,j)=>{const a=i*Math.PI/lat,b=j*2*Math.PI/lon,n=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];return {p:n.map((v,k)=>p[k]+v*size[k]),n:G.norm(n.map((v,k)=>v/size[k]))};};
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=get(i,j),b=get(i+1,j),c=get(i+1,j+1),d=get(i,j+1);for(const v of [a,b,c,a,c,d])vertex(out,v.p,v.n,color);}
}
function sphereBand(out,r,yLow,yHigh,color){
 const get=(i,j)=>{const y=G.mix(yLow,yHigh,i/4),a=j*Math.PI/24,ring=Math.sqrt(r*r-y*y),p=[Math.cos(a)*ring,y,Math.sin(a)*ring];return {p,n:G.norm(p)};};
 for(let i=0;i<4;i++)for(let j=0;j<48;j++)for(const v of [get(i,j),get(i+1,j),get(i+1,j+1),get(i,j),get(i+1,j+1),get(i,j+1)])vertex(out,v.p,v.n,color);
}
function axial(v,axis){return axis==='x'?[v[1],v[0],v[2]]:axis==='z'?[v[0],v[2],v[1]]:v;}
function cylinder(out,p,r,h,color,segments=12,axis='y'){
 const at=(angle,y)=>add(p,axial([Math.cos(angle)*r,y,Math.sin(angle)*r],axis));
 const top=add(p,axial([0,h/2,0],axis)),bottom=add(p,axial([0,-h/2,0],axis));
 for(let i=0;i<segments;i++){
  const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,n=axial([Math.cos((a+b)/2),0,Math.sin((a+b)/2)],axis);
  quad(out,at(a,-h/2),at(b,-h/2),at(b,h/2),at(a,h/2),color,n);
  tri(out,top,at(a,h/2),at(b,h/2),color,axial([0,1,0],axis));
  tri(out,bottom,at(b,-h/2),at(a,-h/2),color,axial([0,-1,0],axis));
 }
}
function torus(out,p,r,tube,color,axis='y',segments=24,sides=6){
 const get=(i,j)=>{const a=i*2*Math.PI/segments,b=j*2*Math.PI/sides,n=axial([Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)],axis),v=axial([Math.cos(a)*(r+tube*Math.cos(b)),tube*Math.sin(b),Math.sin(a)*(r+tube*Math.cos(b))],axis);return {p:add(p,v),n};};
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++)for(const v of [get(i,j),get(i+1,j),get(i+1,j+1),get(i,j),get(i+1,j+1),get(i,j+1)])vertex(out,v.p,v.n,color);
}
function beam(out,a,b,width,color){
 const direction=G.norm(G.sub(b,a)),right=mul(G.norm(G.cross(direction,Math.abs(direction[1])>.9?[0,0,1]:[0,1,0])),width/2),up=mul(G.norm(G.cross(direction,right)),width/2);
 const corners=p=>[add(add(p,right),up),add(G.sub(p,right),up),G.sub(G.sub(p,right),up),G.sub(add(p,right),up)],v=[...corners(a),...corners(b)];
 for(const f of [[3,2,1,0],[4,5,6,7],[1,5,4,0],[2,6,5,1],[3,7,6,2],[0,4,7,3]])quad(out,...f.map(i=>v[i]),color);
}
// Keep detail in shared GPU buffers; ranges let completely fogged geometry be skipped.
function batch(parts){
 const vertices=[],ranges=[];
 parts.sort((a,b)=>a.s-b.s);
 for(let i=0;i<parts.length;){
  const group=Math.floor(parts[i].s/24),first=vertices.length/10,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  do{const data=parts[i++].vertices;for(let j=0;j<data.length;j++){vertices.push(data[j]);const k=j%10;if(k<3){min[k]=Math.min(min[k],data[j]);max[k]=Math.max(max[k],data[j]);}}}while(i<parts.length&&Math.floor(parts[i].s/24)===group);
  const count=vertices.length/10-first;if(!count)continue;
  const center=min.map((v,k)=>(v+max[k])/2),radius=Math.hypot(...max.map((v,k)=>v-center[k]));
  ranges.push({first,count,center,radius});
 }
 return {vertices,ranges};
}
function visibleRanges(mesh,eye){
 if(!mesh.ranges)return [{first:0,count:mesh.count}];
 const visible=[];
 for(const range of mesh.ranges){
  if(Math.hypot(...G.sub(range.center,eye))>108+range.radius)continue;
  const last=visible[visible.length-1];
  if(last&&last.first+last.count===range.first)last.count+=range.count;else visible.push({first:range.first,count:range.count});
 }
 return visible;
}
function crystal(out){
 const top=[0,1,0],bottom=[0,-1,0],ring=[[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];
 for(let i=0;i<4;i++){tri(out,top,ring[i],ring[(i+1)%4],[1,1,1]);tri(out,bottom,ring[(i+1)%4],ring[i],[1,1,1]);}
}
class Renderer{
 constructor(canvas,course){
  this.canvas=canvas;this.course=course;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!this.gl)throw Error('This browser could not start the 3D scene.');
  this.eye=[-7,11,-9];this.target=[0,5,7];
  this.reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);this.init();
 }
 init(){
  const gl=this.gl;
  const vs=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;
   uniform mat4 uModel;uniform mat4 uVP;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;
   void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;mat3 basis=mat3(uModel);
    vec3 scale2=vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]));
    vNormal=normalize(basis*(aNormal/max(scale2,vec3(0.000001))));vColor=aColor;gl_Position=uVP*w;}`;
  const fs=`precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;
   uniform vec3 uEye;uniform vec3 uSky;uniform vec4 uTint;uniform vec3 uMaterial;
   void main(){vec3 n=normalize(vNormal),sun=normalize(vec3(-0.45,0.8,-0.35)),view=normalize(uEye-vWorld);
    float diffuse=max(dot(n,sun),0.0),hemi=n.y*0.5+0.5;
    vec3 ambient=mix(vec3(0.30,0.39,0.39),vec3(0.63,0.70,0.71),hemi);
    vec3 base=vColor.rgb*uTint.rgb,color=base*(ambient+vec3(0.42,0.39,0.32)*diffuse);
    float specular=pow(max(dot(n,normalize(sun+view)),0.0),uMaterial.y)*uMaterial.x*diffuse;
    float rim=pow(1.0-max(dot(n,view),0.0),3.0)*uMaterial.x*0.18;
    color+=vec3(1.0,0.95,0.84)*specular+uSky*rim;color=mix(color,base,uMaterial.z);
    float fog=smoothstep(34.0,108.0,distance(vWorld,uEye));color=mix(color,uSky,fog);
    gl_FragColor=vec4(color,vColor.a*uTint.a);}`;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Could not link the 3D renderer.');
  gl.useProgram(this.program);this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(this.program,n));this.uniforms={};for(const n of ['uModel','uVP','uEye','uTint','uSky','uMaterial'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(...SKY,1);
  const gem=[];crystal(gem);this.gem=this.mesh(gem);
  const disc=[];for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
   vertex(disc,[0,0,0],[0,1,0],[.06,.24,.29,1]);
   vertex(disc,[Math.cos(a),0,Math.sin(a)],[0,1,0],[.06,.24,.29,0]);
   vertex(disc,[Math.cos(b),0,Math.sin(b)],[0,1,0],[.06,.24,.29,0]);
  }this.disc=this.mesh(disc);
  const halo=[];torus(halo,[0,0,0],1,.045,[1,1,1],'y',24,5);this.halo=this.mesh(halo);
  this.gatePanel=this.mesh(this.buildGatePanel());
  const arrow=[];box(arrow,[-.15,0,0],[.38,.09,.05],[1,1,1]);for(const z of [-.03,.03])tri(arrow,[.35,0,z],[-.03,.22,z],[-.03,-.22,z],[1,1,1]);this.gateArrow=this.mesh(arrow);
  const sprout=[],star=[],gear=[];
  cylinder(sprout,[0,.8,0],.018,.24,[.22,.5,.31],8);for(const side of [-1,1])sphere(sprout,[side*.09,.89,0],[.13,.07,.045],[.46,.78,.46],5,8);
  for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5,r=i%2?.08:.17,r2=i%2?.17:.08;for(const z of [-.035,.035])tri(star,[0,.85,z],[Math.sin(a)*r,.85+Math.cos(a)*r,z],[Math.sin(b)*r2,.85+Math.cos(b)*r2,z],GOLD);}
  torus(gear,[0,.85,0],.12,.045,[.75,.5,.29],'z',12,5);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(gear,[Math.cos(a)*.15,.85+Math.sin(a)*.15,0],[.07,.07,.07],[.75,.5,.29]);}
  this.badges={sprout:this.mesh(sprout),star:this.mesh(star),gear:this.mesh(gear)};
  const platform=[];box(platform,[0,-.2,0],[2,.4,1],TEAL);box(platform,[0,.009,0],[1.94,.018,.96],WHITE);
  for(const side of [-1,1])box(platform,[side*.94,.025,0],[.09,.02,.98],GOLD);
  for(const z of [-.46,.46])box(platform,[0,.025,z],[1.95,.02,.06],CORAL);
  cylinder(platform,[0,-.45,0],.22,.2,INK,12);torus(platform,[0,-.55,0],.19,.03,MINT);
  this.platform=this.mesh(platform);
  const robot=this.buildRobot();this.robotShell=this.mesh(robot.shell);this.robotTrim=this.mesh(robot.trim);this.robotLights=this.mesh(robot.lights);
  this.setCourse(this.course);
 }
 setCourse(course){
  for(const key of ['track','scenery','landmarks'])if(this[key])this.gl.deleteBuffer(this[key].buffer);
  this.course=course;this.cameraUp=[0,1,0];this.eye=[-7,11,-9];this.target=[0,5,7];this.resetEffects();
  this.track=this.mesh(this.buildTrack());this.scenery=this.mesh(this.buildScenery());this.landmarks=this.mesh(this.buildLandmarks());
  this.gl.clearColor(...course.track.sky,1);
 }
 resetEffects(){this.particles=[];this.squash=0;this.cameraCut=false;}
 handleEvents(events){
  for(const event of events){
   if(event.type==='recover'){this.particles=[];this.cameraCut=true;}
   if(this.reduced)continue;
   if(event.type==='land')this.squash=Math.min(.18,(event.strength||.5)*.18);
   if(event.type==='jump')this.squash=-.1;
   const count={cell:8,checkpoint:14,finish:32,recover:8,gate:5}[event.type]||0;
   const color=event.type==='cell'?[1,.73,.25]:event.type==='gate'?CORAL:MINT;
   for(let i=0;i<count&&this.particles.length<64;i++){
    const angle=i*2.39996,spread=event.type==='finish'?3.3:1.5,life=event.type==='finish'?1.8:.7+i%3*.13;
    this.particles.push({p:event.position.slice(),v:[Math.cos(angle)*spread,1.4+i%4*.45,Math.sin(angle)*spread],life,total:life,color});
   }
  }
 }
 mesh(geometry){const vertices=geometry.vertices||geometry,gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return {buffer:b,count:vertices.length/10,ranges:geometry.ranges};}
 draw(mesh,m=identity(),tint=[1,1,1,1],material=MATTE,range){
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],i===2?4:3,gl.FLOAT,false,40,i===0?0:i===1?12:24);}
  gl.uniformMatrix4fv(this.uniforms.uModel,false,new Float32Array(m));gl.uniform4fv(this.uniforms.uTint,tint);gl.uniform3fv(this.uniforms.uMaterial,material);gl.drawArrays(gl.TRIANGLES,range?range.first:0,range?range.count:mesh.count);
 }
 drawVisible(mesh){for(const range of visibleRanges(mesh,this.eye))this.draw(mesh,identity(),[1,1,1,1],MATTE,range);}
 buildRobot(){
  const shell=[],trim=[],lights=[];
  sphere(shell,[0,0,0],[.44,.44,.44],WHITE,20,28);
  sphereBand(trim,.448,-.165,.165,INK);
  for(const y of [-.165,.165])torus(trim,[0,y,0],.416,.012,TEAL);
  cylinder(shell,[0,.337,0],.255,.035,[.83,.9,.86],24);
  torus(trim,[0,.36,0],.235,.008,TEAL);
  cylinder(trim,[0,-.325,0],.245,.12,TEAL,20);
  torus(trim,[0,-.387,0],.205,.026,INK);
  torus(lights,[0,-.399,0],.18,.012,MINT);
  for(const side of [-1,1]){
   cylinder(trim,[side*.421,0,0],.115,.11,TEAL,16,'x');
   cylinder(shell,[side*.482,0,0],.086,.026,CORAL,16,'x');
   cylinder(trim,[side*.499,0,0],.033,.01,INK,12,'x');
   sphere(trim,[side*.145,.09,.37],[.078,.105,.076],INK,10,12);
   sphere(lights,[side*.145,.105,.425],[.032,.048,.023],[.6,1,.86],10,12);
   box(shell,[side*.085,.412,-.015],[.035,.018,.19],CORAL);
  }
  // The rear battery panel is visible from the chase camera.
  sphere(trim,[0,.01,-.408],[.185,.15,.065],TEAL,10,14);
  for(let i=0;i<3;i++)box(lights,[(i-1)*.083,.04,-.472],[.047,.075,.008],i===2?GOLD:MINT);
  for(let i=0;i<3;i++)box(trim,[(i-1)*.072,-.235,-.355],[.036,.06,.02],INK);
  cylinder(trim,[0,.432,0],.075,.055,TEAL,16);
  cylinder(trim,[0,.55,0],.02,.24,INK,10);
  sphere(shell,[0,.68,0],[.086,.08,.086],CORAL,10,14);
  sphere(lights,[0,.707,-.025],[.043,.028,.043],GOLD,8,12);
  return {shell,trim,lights};
 }
 buildGatePanel(){
  const out=[];box(out,[0,0,0],[1,1,1],INK);box(out,[0,.015,0],[.96,.89,1.025],CORAL);
  for(const side of [-1,1]){
   for(let i=0;i<4;i++)box(out,[-.36+i*.24,.04,side*.521],[.014,.66,.016],[.81,.25,.18]);
   box(out,[0,.43,side*.527],[.95,.035,.025],GOLD);
   box(out,[0,-.40,side*.527],[.96,.1,.025],INK);
   for(let i=0;i<7;i++)quad(out,[-.46+i*.132,-.45,side*.544],[-.40+i*.132,-.45,side*.544],[-.34+i*.132,-.35,side*.544],[-.40+i*.132,-.35,side*.544],GOLD,[0,0,side]);
   for(const x of [-.474,.474])box(out,[x,.02,side*.53],[.018,.75,.025],WHITE);
  }
  return out;
 }
 buildMagneticTrack(){
  const parts=[];const point=(q,x,y=0)=>q.p.map((v,k)=>v+q.right[k]*x+q.up[k]*y);
  for(let i=0;i<this.course.points.length-1;i++){
   const a=this.course.at(this.course.points[i].s),b=this.course.at(this.course.points[i+1].s),out=[];if(a.gap)continue;
   quad(out,point(a,-a.width),point(b,-b.width),point(b,b.width),point(a,a.width),i%16<8?[.82,.88,.96]:[.7,.78,.9]);
   quad(out,point(a,a.width,-.3),point(b,b.width,-.3),point(b,-b.width,-.3),point(a,-a.width,-.3),INK);
   for(const side of [-1,1]){quad(out,point(a,side*a.width),point(b,side*b.width),point(b,side*b.width,-.3),point(a,side*a.width,-.3),TEAL);quad(out,point(a,side*a.width,.02),point(b,side*b.width,.02),point(b,side*(b.width-.14),.02),point(a,side*(a.width-.14),.02),[.3,1,.92]);}
   if(i%8<4)quad(out,point(a,-.035,.025),point(b,-.035,.025),point(b,.035,.025),point(a,.035,.025),GOLD);
   if(a.s>this.course.total-5&&i%2===0)quad(out,point(a,-a.width,.03),point(b,-b.width,.03),point(b,b.width,.03),point(a,a.width,.03),WHITE);
   parts.push({s:a.s,vertices:out});
  }
  for(const gap of this.course.gaps)for(let i=0;i<3;i++){const q=this.course.at(gap.start-1.5-i*1.1),out=[],at=(x,z)=>q.p.map((v,k)=>v+q.right[k]*x+q.tangent[k]*z+q.up[k]*.04);for(const side of [-1,1])quad(out,at(0,.35),at(side*.7,-.15),at(side*.7,-.35),at(0,.15),CORAL,q.up);parts.push({s:q.s,vertices:out});}
  return batch(parts);
 }
 buildTrack(){
  if(this.course.magnetic)return this.buildMagneticTrack();
  const parts=[],vertigo=this.course.index>=12,clockwork=this.course.index>=6&&this.course.index<12;
  for(const path of [{points:this.course.points},...(this.course.routes||[])]){
  const points=path.points,at=s=>this.course.routeAt(s,path.id);
  for(let i=0;i<points.length-1;i++){
   const a=at(points[i].s),b=at(points[i+1].s);if(a.gap)continue;
   const out=[],normal=G.norm(G.cross([a.tangent[0],a.slope,a.tangent[2]],[a.right[0],a.bank,a.right[2]])),yaw=Math.atan2(a.tangent[0],a.tangent[2]);
   const edge=(q,side,y=0,inset=0)=>[q.p[0]+q.right[0]*(q.width-inset)*side,q.p[1]+y+(q.bank||0)*(q.width-inset)*side,q.p[2]+q.right[2]*(q.width-inset)*side];
   const al=edge(a,-1),ar=edge(a,1),bl=edge(b,-1),br=edge(b,1);
   const color=vertigo?(i%12<6?[.94,.92,.99]:[.83,.82,.93]):clockwork?(i%12<6?[.97,.94,.8]:[.9,.85,.7]):i%12<6?WHITE:[.87,.92,.89];quad(out,al,bl,br,ar,color,normal);
   quad(out,edge(a,1,-.55),edge(b,1,-.55),edge(b,-1,-.55),edge(a,-1,-.55),INK,[0,-1,0]);
   for(const side of [-1,1]){
    quad(out,edge(a,side),edge(b,side),edge(b,side,-.55),edge(a,side,-.55),clockwork?[.64,.43,.27]:TEAL,mul(a.right,side));
    quad(out,edge(a,side,-.37,-.003),edge(b,side,-.37,-.003),edge(b,side,-.44,-.003),edge(a,side,-.44,-.003),[.25,.55,.54],mul(a.right,side));
    quad(out,edge(a,side,.018),edge(b,side,.018),edge(b,side,.018,.13),edge(a,side,.018,.13),vertigo&&Math.abs(a.bank)>.15?(side*a.bank>0?GOLD:CORAL):path.id?GOLD:a.width<2?CORAL:MINT,normal);
    quad(out,edge(a,side,.02,.17),edge(b,side,.02,.17),edge(b,side,.02,.19),edge(a,side,.02,.19),[.58,.73,.7],normal);
    if(i%4===0){
     const lamp=edge(a,side,-.18,-.012);box(out,lamp,[.035,.085,.48],a.width<2?GOLD:[.68,1,.88],yaw);
    }
    if(i%12===3){
     const plate=edge(a,side,.022,.36);
     // Flush hardware stays out of the robot's path and follows the ramp plane.
     const point=(x,z,lift=0)=>[plate[0]+a.right[0]*x+a.tangent[0]*z,plate[1]+a.slope*z+a.bank*x+lift,plate[2]+a.right[2]*x+a.tangent[2]*z];
     quad(out,point(-.11,-.25),point(-.11,.25),point(.11,.25),point(.11,-.25),[.67,.78,.74],normal);
     for(const z of [-.17,.17])quad(out,point(-.035,z-.025,.003),point(-.035,z+.025,.003),point(.035,z+.025,.003),point(.035,z-.025,.003),TEAL,normal);
    }
   }
   if(i%6===0){
    const seam=at(Math.min(a.s+.035,b.s));
    quad(out,edge(a,-1,.024,.2),edge(seam,-1,.024,.2),edge(seam,1,.024,.2),edge(a,1,.024,.2),[.64,.76,.72],normal);
    if(a.width>2){const center=q=>q.p.map((v,k)=>v+(k===1?.026:0));const p=center(a),q=center(b),r=a.right;quad(out,[p[0]-r[0]*.035,p[1],p[2]-r[2]*.035],[q[0]-r[0]*.035,q[1],q[2]-r[2]*.035],[q[0]+r[0]*.035,q[1],q[2]+r[2]*.035],[p[0]+r[0]*.035,p[1],p[2]+r[2]*.035],[.65,.78,.73],normal);}
   }
   if(vertigo&&i%12===0&&Math.abs(a.bank)>.35){
    const sign=Math.sign(a.bank),x=sign*a.width*.55,point=(u,v)=>[a.p[0]+a.right[0]*u+a.tangent[0]*v,a.p[1]+a.bank*u+.04,a.p[2]+a.right[2]*u+a.tangent[2]*v];
    tri(out,point(x+sign*.45,0),point(x-sign*.25,-.32),point(x-sign*.25,.32),GOLD,normal);
   }
   if(i%8===0){
    const keel=[a.p[0],a.p[1]-1.25-(vertigo?Math.abs(a.bank)*a.width:0),a.p[2]];
    for(const side of [-1,1])beam(out,edge(a,side,-.47,.1),keel,.13,[.23,.49,.49]);
    if(vertigo)beam(out,edge(a,-1,-.6),edge(a,1,-.6),.16,INK);else box(out,[a.p[0],a.p[1]-.6,a.p[2]],[a.width*2,.16,.22],INK,yaw);
    cylinder(out,keel,.21,.16,TEAL,10);cylinder(out,[keel[0],keel[1]-.09,keel[2]],.15,.035,MINT,10);
   }
   // Cap the exposed slab at each gap and both ends of the course.
   if(i===0||at(Math.max(0,a.s-.05)).gap)quad(out,al,ar,edge(a,1,-.55),edge(a,-1,-.55),TEAL);
   if(b.gap||i===points.length-2)quad(out,br,bl,edge(b,-1,-.55),edge(b,1,-.55),TEAL);
   parts.push({s:a.s,vertices:out});
  }
  }
  // Finish line tiles sit on the actual collidable course surface.
  const out=[];
  for(let row=0;row<4;row++)for(let col=0;col<8;col++){
   const q=this.course.at(this.course.total-4+row*.55),p=q.p.map((v,i)=>v+q.right[i]*(col-3.5)*.65);
   box(out,[p[0],p[1]+.025,p[2]],[.64,.025,.54],(row+col)%2?TEAL:WHITE,Math.atan2(q.tangent[0],q.tangent[2]));
  }
  parts.push({s:this.course.total-4,vertices:out});
  // Repeating chevrons mark each takeoff, matching the actual jump gaps.
  for(const gap of this.course.gaps)for(let i=0;i<3;i++){
   const out=[],q=this.course.at(gap.start-2.2-i*1.1);
   const point=(side,along)=>[q.p[0]+q.right[0]*side+q.tangent[0]*along,q.p[1]+.04+q.slope*along,q.p[2]+q.right[2]*side+q.tangent[2]*along];
   for(const side of [-1,1])quad(out,point(0,.38),point(side*.65,-.15),point(side*.65,-.35),point(0,.18),CORAL,[0,1,0]);
   parts.push({s:q.s,vertices:out});
  }
  return batch(parts);
 }
 buildLandmarks(){
  if(this.course.magnetic){const parts=[];for(const cp of this.course.checkpoints){const q=this.course.at(cp.s),out=[],p=(x,y)=>q.p.map((v,k)=>v+q.right[k]*x+q.up[k]*y);for(const side of [-1,1])beam(out,p(side*q.width,0),p(side*q.width,2),.09,MINT);parts.push({s:cp.s,vertices:out});}return batch(parts);}
  const parts=[],portals=[...this.course.checkpoints.slice(1).map(cp=>({s:cp.s,type:'checkpoint'})),...this.course.gates.map(g=>({s:g.s,type:'gate'})),{s:this.course.total-2,type:'finish'}];
  for(const portal of portals){
   const out=[],q=this.course.at(portal.s),yaw=Math.atan2(q.tangent[0],q.tangent[2]),gate=portal.type==='gate',finish=portal.type==='finish',height=finish?4.7:gate?3.6:3.8,color=finish?CORAL:gate?TEAL:MINT;
   const at=(x,y,z=0)=>[q.p[0]+q.right[0]*x+q.tangent[0]*z,q.p[1]+y+q.bank*x,q.p[2]+q.right[2]*x+q.tangent[2]*z];
   for(const sign of [-1,1]){
    const x=(q.width+.12)*sign;
    box(out,at(x,.14),[.5,.28,.58],INK,yaw);
    box(out,at(x,height/2),[.25,height,.32],color,yaw);
    for(const z of [-.18,.18]){
     box(out,at(x,height*.5,z),[.08,height*.65,.04],gate?[.41,.66,.62]:WHITE,yaw);
     box(out,at(x,height-.38,z),[.16,.18,.08],gate?GOLD:MINT,yaw);
    }
    box(out,at(x,.54),[.34,.45,.41],TEAL,yaw);
    for(const z of [-.23,.23])for(const dx of [-.1,.1])sphere(out,at(x+dx,.58,z),[.027,.027,.027],[.69,.83,.78],4,6);
    if(gate){box(out,at(x,height-.5),[.51,.46,.48],INK,yaw);box(out,at(x,height-.5,-.255),[.31,.22,.045],CORAL,yaw);}
   }
   box(out,at(0,height),[q.width*2+.5,finish?.48:.27,.36],color,yaw);
   box(out,at(0,height+.18),[q.width*2+.12,.07,.2],INK,yaw);
   for(const z of [-.205,.205]){
    box(out,at(0,height,z),[finish?1.6:1.1,.32,.065],INK,yaw);
    for(let i=0;i<(finish?5:3);i++)box(out,at((i-(finish?2:1))*.23,height,z*1.2),[.12,.1,.02],finish?GOLD:gate?CORAL:MINT,yaw);
   }
   parts.push({s:portal.s,vertices:out});
  }
  return batch(parts);
 }
 buildScenery(){
  if(this.course.magnetic){const out=[];for(const s of [0,this.course.total]){const q=this.course.at(s);sphere(out,[q.p[0],q.p[1]-7,q.p[2]],[6,3,6],[.38,.5,.61],8,12);}return batch([{s:0,vertices:out}]);}
  const parts=[],season=this.course.index,foliage=season>=12?[.52,.44,.66]:season>=6?[.38,.59,.48]:[[.25,.59,.44],[.24,.57,.48],[.62,.61,.31],[.37,.57,.64],[.36,.55,.49],[.53,.47,.65]][season];
  const count=Math.ceil(this.course.total/15);
  for(let i=0;i<count;i++){
   const out=[],s=i/count*this.course.total,q=this.course.at(s),side=i%2?-1:1,d=16+(i%4)*6;
   const p=[q.p[0]+q.right[0]*d*side,q.p[1]-6-(i%3)*3,q.p[2]+q.right[2]*d*side],r=3+i%3;
   const ring=(j,scale,y)=>{const a=j*Math.PI/5,w=r*scale*(1+Math.sin(j*7+i)*.13);return [p[0]+Math.cos(a)*w,p[1]+y,p[2]+Math.sin(a)*w];};
   for(let j=0;j<10;j++){
    const a=ring(j,1,0),b=ring((j+1)%10,1,0),c=ring(j,.88,-.7),e=ring((j+1)%10,.88,-.7),lower=ring(j,.55,-r*.9),next=ring((j+1)%10,.55,-r*.9);
    tri(out,p,b,a,foliage.map(v=>Math.min(1,v+.14)),[0,1,0]);
    quad(out,a,b,e,c,[.38,.56,.44]);quad(out,c,e,next,lower,j%2?[.37,.51,.5]:[.3,.44,.45]);
    tri(out,lower,next,[p[0]+.4,p[1]-r*1.8,p[2]-.3],[.23,.38,.4]);
   }
   if(season>=6&&season<12){
    cylinder(out,[p[0],p[1]+.12,p[2]],r*.8,.24,[.64,.44,.28],12);
    torus(out,[p[0],p[1]+.3,p[2]],r*.7,.12,[.84,.66,.4],'y',16,5);
    for(let tooth=0;tooth<8;tooth++){const a=tooth*Math.PI/4;box(out,[p[0]+Math.cos(a)*r*.8,p[1]+.25,p[2]+Math.sin(a)*r*.8],[.5,.25,.5],[.76,.53,.31],a);}
   }
   for(let tree=0;tree<3;tree++){
    const a=tree*2.3+i,tx=p[0]+Math.cos(a)*r*.44,tz=p[2]+Math.sin(a)*r*.44,h=1.35+(i+tree)%3*.35;
    cylinder(out,[tx,p[1]+h*.45,tz],.1,h*.9,[.32,.4,.33],7);
    sphere(out,[tx,p[1]+h,tz],[.85,h*.72,.85],foliage,6,9);
    sphere(out,[tx-.32,p[1]+h*1.25,tz-.2],[.58,h*.45,.58],foliage.map(v=>Math.min(1,v+.07)),5,8);
   }
   for(let rock=0;rock<3;rock++){const a=rock*2.2+i; sphere(out,[p[0]+Math.cos(a)*r*.7,p[1]+.18,p[2]+Math.sin(a)*r*.7],[.5,.32,.36],[.61,.69,.59],3,5);}
   // Small hanging mineral veins and grass tufts break up the island silhouette.
   for(let j=0;j<3;j++){
    const a=i+j*1.9,x=p[0]+Math.cos(a)*r*.75,z=p[2]+Math.sin(a)*r*.75;
    beam(out,[x,p[1]-.5,z],[x+.15,p[1]-1.7-j*.3,z],.08,foliage);
    for(const side of [-1,1])tri(out,[x-.08,p[1]+.015,z],[x+side*.23,p[1]+.48,z+.08],[x+.08,p[1]+.015,z],foliage,[0,1,0]);
   }
   if(i%2===0){const cloud=[p[0]+side*7,p[1]+9,p[2]+5];for(let j=0;j<4;j++)sphere(out,[cloud[0]+j*1.8,cloud[1]+(j===1?1:0),cloud[2]],[2.8,1.15+j%2*.4,1.8],[.96,.98,.95],7,12);}
   parts.push({s,vertices:out});
  }
  return batch(parts);
 }
 render(run,dt,active,animate=active){
  if(this.sceneVisible===false)return;
  const gl=this.gl,canvas=this.canvas,dpr=Math.min(root.devicePixelRatio||1,this.pixelRatio||2),width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const speed=Math.hypot(run.velocity[0],run.velocity[2]);
  const ahead=this.course.routeAt(Math.min(this.course.total,run.progress+(this.course.index>=6?8+speed*.3:5)),run.surface.route),dir=ahead.tangent,p=run.position;
  const narrow=width/height<.8,back=narrow?10.8:7.8,raise=narrow?5.5:4.1;
  let desired=active?[p[0]-dir[0]*back,p[1]+raise+(this.course.index>=12?Math.abs(run.surface.bank)*1.4:0),p[2]-dir[2]*back]:[-6.5,10.5,-8];
  const look=this.course.index>=6?6:3.8;
  let target=active?[p[0]+dir[0]*look,p[1]+.4,p[2]+dir[2]*look]:[1,5.4,8];
  if(this.course.magnetic){const q=run.surface;desired=p.map((v,k)=>v-q.tangent[k]*back+q.up[k]*raise);target=p.map((v,k)=>v+q.tangent[k]*5+q.up[k]*.4);const t=this.cameraCut?1:1-Math.exp(-Math.min(dt,.1)*7);this.cameraUp=G.norm(this.cameraUp.map((v,k)=>G.mix(v,q.up[k],t)));}
  const blend=this.cameraCut?1:1-Math.exp(-Math.min(dt,.1)*5);this.cameraCut=false;
  this.eye=this.eye.map((v,i)=>G.mix(v,desired[i],blend));this.target=this.target.map((v,i)=>G.mix(v,target[i],blend));
  const fov=Math.PI/3+(active&&!this.reduced?G.clamp(speed/11,0,1)*.045:0);
  const vp=multiply(perspective(fov,width/height,.12,140),lookAt(this.eye,this.target,this.course.magnetic?this.cameraUp:undefined));
  gl.uniformMatrix4fv(this.uniforms.uVP,false,vp);gl.uniform3fv(this.uniforms.uEye,this.eye);gl.uniform3fv(this.uniforms.uSky,this.course.track.sky);
  this.drawVisible(this.scenery);this.drawVisible(this.track);this.drawVisible(this.landmarks);
  for(let i=0;i<(this.course.platforms||[]).length;i++){
   const q=this.course.platformAt(i,run.time);if(Math.hypot(...G.sub(q.p,this.eye))>112)continue;
   this.draw(this.platform,model(q.p,[q.width,1,q.length],Math.atan2(q.tangent[0],q.tangent[2])),[1,1,1,1],METAL);
  }
  for(const gate of this.course.gates){
   const q=this.course.at(gate.s),c=this.course.gateCenter(gate,run.time),yaw=Math.atan2(q.tangent[0],q.tangent[2]);
   if(Math.hypot(...G.sub(q.p,this.eye))>112)continue;
   if(gate.rhythm){const phase=run.time*this.course.track.gateSpeed+gate.phase,direction=Math.cos(phase)>=0?1:-1,reversing=Math.abs(Math.cos(phase))<.55;
    this.draw(this.gateArrow,model([q.p[0]+q.right[0]*c,q.p[1]+2.4,q.p[2]+q.right[2]*c],[direction*.9,.9,1],yaw),reversing?[1,.7,.25,1]:[.5,1,.8,1],LIT);
    for(const side of [-1,1])this.draw(this.gem,model([q.p[0]+q.right[0]*(c+side*this.course.track.opening),q.p[1]+.9,q.p[2]+q.right[2]*(c+side*this.course.track.opening)],[.045,.85,.045]),[.5,1,.8,1],LIT);
   }
   for(const range of [[-q.width,c-this.course.track.opening],[c+this.course.track.opening,q.width]]){
    const length=range[1]-range[0];if(length<=0)continue;const mid=(range[0]+range[1])/2;
    this.draw(this.gatePanel,model([q.p[0]+q.right[0]*mid,q.p[1]+.85,q.p[2]+q.right[2]*mid],[length,1.7,.5],yaw),[1,1,1,1],METAL);
   }
  }
  for(const cell of this.course.cells){
   if(cell.taken||Math.abs(cell.s-run.progress)>60)continue;
   const p=this.course.cellPosition(cell),phase=this.reduced?cell.s:run.time+cell.s;
   if(!this.reduced)p[1]+=Math.sin(run.time*2+cell.s)*.12;
   this.draw(this.gem,model(p,[.23,.36,.23],phase),[...GOLD,1],CERAMIC);
   this.draw(this.halo,model(p,[.33,.33,.33],phase),[1,.86,.5,1],LIT);
  }
  if(run.landingCue){const q=run.landingCue;this.draw(this.halo,model([q.p[0],q.p[1]+.045,q.p[2]],[Math.min(1.1,q.width*.6),.2,1.3]),[.22,.7,.53,.8],LIT);}
  if(run.trainingStage===0){const q=this.course.at(8);this.draw(this.halo,model([q.p[0],q.p[1]+.045,q.p[2]],[1,.12,1]),[1,.63,.34,1],LIT);}
  if(run.trainingStage===2){const q=this.course.at(16);for(const side of [-1,1])this.draw(this.halo,model([q.p[0]+side*1.1,q.p[1]+.045,q.p[2]],[.45,.12,.7]),[.3,.8,.62,1],LIT);}
  const shadow=contactShadow(run);
  if(shadow){
   gl.depthMask(false);this.draw(this.disc,shadow.matrix,[1,1,1,shadow.alpha]);gl.depthMask(true);
  }
  if(animate){this.squash*=Math.exp(-Math.min(dt,.1)*9);for(const particle of this.particles){particle.life-=dt;particle.v[1]-=3*dt;particle.p=particle.p.map((v,i)=>v+particle.v[i]*dt);}this.particles=this.particles.filter(particle=>particle.life>0);}
  gl.depthMask(false);
  for(const particle of this.particles){const size=.055+.025*particle.life/particle.total;this.draw(this.gem,model(particle.p,[size,size,size],particle.life*4),[...particle.color,Math.min(1,particle.life/.25)]);}
  gl.depthMask(true);
  if(run.ghost){
   let ghost=model(run.ghost.position,[1,1,1],run.ghost.yaw);
   if(this.course.magnetic){let closest=0,distance=Infinity;for(let i=0;i<this.course.points.length;i+=4){const d=G.len(G.sub(run.ghost.position,this.course.points[i].p));if(d<distance){closest=i;distance=d;}}const q=this.course.at(this.course.points[closest].s);ghost=robotModel({course:this.course,surface:q,position:run.ghost.position,pose:{pitch:0,roll:0}});}
   gl.depthMask(false);
   this.draw(this.robotShell,ghost,[.35,.8,.9,.23],LIT);this.draw(this.robotTrim,ghost,[.4,.95,1,.2],LIT);gl.depthMask(true);
  }
  // Three batched materials share the full phone-controlled pose.
  const sy=1-this.squash,sx=1+this.squash*.5,bodyY=.44*(sy-1),pose=multiply(robotModel(run),model([0,bodyY,0],[sx,sy,sx]));
  this.draw(this.robotShell,pose,[...(this.appearance||[1,1,1]),1],CERAMIC);
  this.draw(this.robotTrim,pose,[1,1,1,1],METAL);
  this.draw(this.robotLights,pose,[1,1,1,1],LIT);
  if(this.badges[this.badge])this.draw(this.badges[this.badge],pose,[1,1,1,1],CERAMIC);
 }
}
root.GravityRenderer={Renderer,model,multiply,perspective,lookAt,contactShadow,robotModel,visibleRanges};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityRenderer;
})(globalThis);
