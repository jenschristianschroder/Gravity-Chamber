/* Small dependency-free WebGL renderer for Gravity Run. */
(function(root){
'use strict';
const G=root.GravityRun,SKY=[.73,.86,.9],WHITE=[.93,.96,.92],TEAL=[.13,.39,.43],CORAL=[1,.39,.26],MINT=[.43,.86,.73];
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function model(p,s=[1,1,1],yaw=0){const c=Math.cos(yaw),n=Math.sin(yaw);return[c*s[0],0,-n*s[0],0,0,s[1],0,0,n*s[2],0,c*s[2],0,p[0],p[1],p[2],1];}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];out[c*4+r]=v;}return out;}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,target){const z=G.norm(G.sub(eye,target)),x=G.norm(G.cross([0,1,0],z)),y=G.cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-G.dot(x,eye),-G.dot(y,eye),-G.dot(z,eye),1];}
function vertex(out,p,n,color){out.push(...p,...n,color[0],color[1],color[2],color[3]===undefined?1:color[3]);}
function tri(out,a,b,c,color,normal){const n=normal||G.norm(G.cross(G.sub(b,a),G.sub(c,a)));vertex(out,a,n,color);vertex(out,b,n,color);vertex(out,c,n,color);}
function quad(out,a,b,c,d,color,normal){tri(out,a,b,c,color,normal);tri(out,a,c,d,color,normal);}
function box(out,p,size,color,yaw=0){
 const m=model(p,size,yaw),transform=v=>[m[0]*v[0]+m[8]*v[2]+p[0],v[1]*size[1]+p[1],m[2]*v[0]+m[10]*v[2]+p[2]];
 const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(transform);
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(out,...f.map(i=>v[i]),color);
}
function sphere(out,p,size,color,lat=8,lon=12){
 const get=(i,j)=>{const a=i*Math.PI/lat,b=j*2*Math.PI/lon,n=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];return {p:n.map((v,k)=>p[k]+v*size[k]),n};};
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=get(i,j),b=get(i+1,j),c=get(i+1,j+1),d=get(i,j+1);for(const v of [a,b,c,a,c,d])vertex(out,v.p,v.n,color);}
}
function crystal(out){
 const top=[0,1,0],bottom=[0,-1,0],ring=[[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];
 for(let i=0;i<4;i++){tri(out,top,ring[i],ring[(i+1)%4],[1,1,1]);tri(out,bottom,ring[(i+1)%4],ring[i],[1,1,1]);}
}
class Renderer{
 constructor(canvas,course){
  this.canvas=canvas;this.course=course;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!this.gl)throw Error('This browser could not start the 3D scene.');
  this.eye=[-7,11,-9];this.target=[0,5,7];this.init();
 }
 init(){
  const gl=this.gl;
  const vs='attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;uniform mat4 uModel;uniform mat4 uVP;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;gl_Position=uVP*w;}';
  const fs='precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;uniform vec3 uEye;uniform vec4 uTint;void main(){float light=0.53+0.47*max(dot(normalize(vNormal),normalize(vec3(-0.4,0.85,-0.3))),0.0);vec3 color=vColor.rgb*uTint.rgb*light;float fog=smoothstep(34.0,108.0,distance(vWorld,uEye));color=mix(color,vec3(0.73,0.86,0.90),fog);gl_FragColor=vec4(color,vColor.a*uTint.a);}';
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Could not link the 3D renderer.');
  gl.useProgram(this.program);this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(this.program,n));this.uniforms={};for(const n of ['uModel','uVP','uEye','uTint'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(...SKY,1);
  const cube=[];box(cube,[0,0,0],[1,1,1],[1,1,1]);this.cube=this.mesh(cube);
  const orb=[];sphere(orb,[0,0,0],[1,1,1],[1,1,1],12,18);this.orb=this.mesh(orb);
  const gem=[];crystal(gem);this.gem=this.mesh(gem);
  const disc=[];for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;tri(disc,[0,0,0],[Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)],[.06,.24,.29,.24],[0,1,0]);}this.disc=this.mesh(disc);
  this.track=this.mesh(this.buildTrack());this.scenery=this.mesh(this.buildScenery());this.landmarks=this.mesh(this.buildLandmarks());
 }
 mesh(vertices){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return {buffer:b,count:vertices.length/10};}
 draw(mesh,m=identity(),tint=[1,1,1,1]){
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],i===2?4:3,gl.FLOAT,false,40,i===0?0:i===1?12:24);}
  gl.uniformMatrix4fv(this.uniforms.uModel,false,new Float32Array(m));gl.uniform4fv(this.uniforms.uTint,tint);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
 }
 buildTrack(){
  const out=[],points=this.course.points;
  for(let i=0;i<points.length-1;i++){
   const a=this.course.at(points[i].s),b=this.course.at(points[i+1].s);if(a.gap)continue;
   const edge=(q,side,y=0,inset=0)=>[q.p[0]+q.right[0]*(q.width-inset)*side,q.p[1]+y,q.p[2]+q.right[2]*(q.width-inset)*side];
   const al=edge(a,-1),ar=edge(a,1),bl=edge(b,-1),br=edge(b,1);
   const color=i%12<6?WHITE:[.9,.94,.91];quad(out,al,bl,br,ar,color,[0,1,0]);
   for(const side of [-1,1]){
    quad(out,edge(a,side),edge(b,side),edge(b,side,-.55),edge(a,side,-.55),TEAL);
    quad(out,edge(a,side,.018),edge(b,side,.018),edge(b,side,.018,.1),edge(a,side,.018,.1),a.width<2?CORAL:MINT,[0,1,0]);
   }
   if(i%6===0&&a.width>2){const center=q=>q.p.map((v,k)=>v+(k===1?.022:0));const p=center(a),q=center(b),r=a.right;quad(out,[p[0]-r[0]*.035,p[1],p[2]-r[2]*.035],[q[0]-r[0]*.035,q[1],q[2]-r[2]*.035],[q[0]+r[0]*.035,q[1],q[2]+r[2]*.035],[p[0]+r[0]*.035,p[1],p[2]+r[2]*.035],[.7,.82,.79],[0,1,0]);}
  }
  // Finish line tiles sit on the actual collidable course surface.
  for(let row=0;row<4;row++)for(let col=0;col<8;col++){
   const q=this.course.at(this.course.total-4+row*.55),p=q.p.map((v,i)=>v+q.right[i]*(col-3.5)*.65);
   box(out,[p[0],p[1]+.025,p[2]],[.64,.025,.54],(row+col)%2?TEAL:WHITE,Math.atan2(q.tangent[0],q.tangent[2]));
  }
  return out;
 }
 buildLandmarks(){
  const out=[];
  for(const cp of this.course.checkpoints.slice(1)){
   const q=this.course.at(cp.s),yaw=Math.atan2(q.tangent[0],q.tangent[2]);
   for(const sign of [-1,1])box(out,[q.p[0]+q.right[0]*q.width*sign,q.p[1]+1.9,q.p[2]+q.right[2]*q.width*sign],[.17,3.8,.17],MINT,yaw);
   box(out,[q.p[0],q.p[1]+3.8,q.p[2]],[q.width*2+.25,.17,.17],MINT,yaw);
  }
  for(const gate of this.course.gates){
   const q=this.course.at(gate.s),yaw=Math.atan2(q.tangent[0],q.tangent[2]);
   for(const sign of [-1,1])box(out,[q.p[0]+q.right[0]*q.width*sign,q.p[1]+1.8,q.p[2]+q.right[2]*q.width*sign],[.18,3.6,.3],TEAL,yaw);
   box(out,[q.p[0],q.p[1]+3.6,q.p[2]],[q.width*2+.2,.22,.3],TEAL,yaw);
  }
  const q=this.course.at(this.course.total-2),yaw=Math.atan2(q.tangent[0],q.tangent[2]);
  for(const side of [-1,1])box(out,[q.p[0]+q.right[0]*q.width*side,q.p[1]+2.4,q.p[2]+q.right[2]*q.width*side],[.25,4.8,.25],CORAL,yaw);
  box(out,[q.p[0],q.p[1]+4.7,q.p[2]],[q.width*2,.5,.25],CORAL,yaw);
  return out;
 }
 buildScenery(){
  const out=[];
  for(let i=0;i<24;i++){
   const q=this.course.at(i/24*this.course.total),side=i%2?-1:1,d=18+(i%4)*6;
   const p=[q.p[0]+q.right[0]*d*side,q.p[1]-8-(i%3)*3,q.p[2]+q.right[2]*d*side];
   const r=3+i%3;
   for(let j=0;j<7;j++){const a=j*Math.PI*2/7,b=(j+1)*Math.PI*2/7,pa=[p[0]+Math.cos(a)*r,p[1],p[2]+Math.sin(a)*r],pb=[p[0]+Math.cos(b)*r,p[1],p[2]+Math.sin(b)*r];tri(out,p,pa,pb,[.5,.74,.62],[0,1,0]);tri(out,pa,[p[0],p[1]-r*1.5,p[2]],pb,[.35,.55,.54]);}
   sphere(out,[p[0],p[1]+1.1,p[2]],[1.1,1.7,1.1],[.23,.57,.48],6,8);
   if(i%2===0){const cloud=[p[0]-side*7,p[1]+10,p[2]+5];for(let j=0;j<3;j++)sphere(out,[cloud[0]+j*2,cloud[1]+(j===1?1:0),cloud[2]],[3.1,1.3,1.9],[.95,.98,.96],6,10);}
  }
  return out;
 }
 render(run,dt,active){
  const gl=this.gl,canvas=this.canvas,dpr=Math.min(root.devicePixelRatio||1,2),width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const ahead=this.course.at(Math.min(this.course.total,run.progress+5)),dir=ahead.tangent,p=run.position;
  const narrow=width/height<.8,back=narrow?10.8:7.8,raise=narrow?5.5:4.1;
  const desired=active?[p[0]-dir[0]*back,p[1]+raise,p[2]-dir[2]*back]:[-6.5,10.5,-8];
  const target=active?[p[0]+dir[0]*3.8,p[1]+.4,p[2]+dir[2]*3.8]:[1,5.4,8];
  const blend=1-Math.exp(-Math.min(dt,.1)*5);
  this.eye=this.eye.map((v,i)=>G.mix(v,desired[i],blend));this.target=this.target.map((v,i)=>G.mix(v,target[i],blend));
  const vp=multiply(perspective(Math.PI/3,width/height,.12,140),lookAt(this.eye,this.target));
  gl.uniformMatrix4fv(this.uniforms.uVP,false,vp);gl.uniform3fv(this.uniforms.uEye,this.eye);
  this.draw(this.scenery);this.draw(this.track);this.draw(this.landmarks);
  for(const gate of this.course.gates){
   const q=this.course.at(gate.s),c=this.course.gateCenter(gate,run.time),yaw=Math.atan2(q.tangent[0],q.tangent[2]);
   for(const range of [[-q.width,c-1.2],[c+1.2,q.width]]){
    const length=range[1]-range[0];if(length<=0)continue;const mid=(range[0]+range[1])/2;
    this.draw(this.cube,model([q.p[0]+q.right[0]*mid,q.p[1]+.85,q.p[2]+q.right[2]*mid],[length,1.7,.5],yaw),[...CORAL,1]);
   }
  }
  for(const cell of this.course.cells){if(cell.taken||Math.abs(cell.s-run.progress)>60)continue;const p=this.course.cellPosition(cell);p[1]+=Math.sin(run.time*2+cell.s)*.12;this.draw(this.gem,model(p,[.23,.36,.23],run.time+cell.s),[1,.75,.26,1]);}
  const surface=run.surface;
  if(!surface.gap&&Math.abs(surface.offset||0)<surface.width){
   gl.depthMask(false);this.draw(this.disc,model([p[0],surface.p[1]+.035,p[2]],[.65,1,.65]));gl.depthMask(true);
  }
  // A round courier robot with a contrasting band, eyes, and a lit antenna.
  this.draw(this.orb,model(p,[.44,.44,.44]),[.94,.97,.92,1]);
  this.draw(this.orb,model(p,[.449,.19,.449]),[.12,.42,.46,1]);
  const yaw=run.yaw,forward=[Math.sin(yaw),0,Math.cos(yaw)],right=[Math.cos(yaw),0,-Math.sin(yaw)];
  for(const side of [-1,1]){
   const eye=[p[0]+forward[0]*.37+right[0]*side*.145,p[1]+.09,p[2]+forward[2]*.37+right[2]*side*.145];
   this.draw(this.orb,model(eye,[.075,.105,.075],yaw),[.05,.2,.24,1]);
   this.draw(this.orb,model([eye[0]+forward[0]*.045,eye[1]+.02,eye[2]+forward[2]*.045],[.035,.045,.035]),[.6,1,.86,1]);
  }
  this.draw(this.cube,model([p[0],p[1]+.55,p[2]],[.045,.24,.045]),[.1,.33,.37,1]);
  this.draw(this.orb,model([p[0],p[1]+.71,p[2]],[.085,.085,.085]),[1,.47,.3,1]);
 }
}
root.GravityRenderer={Renderer,model,multiply,perspective,lookAt};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GravityRenderer;
})(globalThis);
