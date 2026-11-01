const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const G=require('../run-guide.js');
const html=readFileSync(__dirname+'/../index.html','utf8');
function fixture(reduced=false){
 const elements={},listeners={},frames=new Map();let next=0,now=0;
 for(const match of html.matchAll(/id="([^"]+)"/g))elements[match[1]]={attributes:{},handlers:{},value:'',textContent:'',setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;}};
 const document={hidden:false,getElementById(id){assert.ok(elements[id],id);return elements[id];},addEventListener(k,fn){listeners[k]=fn;}};
 const guide=new G.Guide(document,{reduced,requestFrame:fn=>{frames.set(++next,fn);return next;},cancelFrame:id=>frames.delete(id)});
 return {guide,elements,document,listeners,frames,advance(){now+=50;const entries=[...frames];frames.clear();for(const [,fn]of entries)fn(now);}};
}
test('all six lessons have finite bounded phone and robot poses throughout the loop',()=>{
 assert.equal(G.LESSONS.length,6);
 for(const lesson of G.LESSONS)for(let i=0;i<=100;i++){
  const f=G.sampleFrame(lesson.id,i/100);
  assert.ok([f.pitch,f.roll,f.yaw,...f.move,f.x,f.z,f.height,f.opacity].every(Number.isFinite));
  assert.ok(f.height>=0&&f.height<2.3);assert.ok(Math.abs(f.x)<2);assert.ok(f.z>=1&&f.z<6);
  for(const p of [[-35,66,3],[35,66,3],[35,-66,3],[-35,-66,3]]){
   const [x,y]=G.phonePoint(p,f);assert.ok(x>0&&x<240);assert.ok(y>0&&y<250);
  }
 }
});
test('phone directions explain forward, reverse, banking, nudges and hopping correctly',()=>{
 assert.ok(G.sampleFrame('roll',.4).pitch>0);assert.ok(G.sampleFrame('roll',.7).z>G.sampleFrame('roll',.4).z);
 assert.ok(G.sampleFrame('brake',.4).pitch<0);assert.ok(G.sampleFrame('brake',.8).z<G.sampleFrame('brake',.6).z);
 const right=G.sampleFrame('steer',.3),left=G.sampleFrame('steer',.7);
 assert.ok(right.roll>0&&left.roll<0);assert.ok(G.phonePoint([0,65,3],right)[0]>120);
 assert.ok(G.sampleFrame('twist',.4).phase.includes('no extra boost'));
 assert.ok(G.sampleFrame('nudge',.25).move[2]<0);assert.ok(G.sampleFrame('nudge',.64).move[0]>0);
 assert.ok(G.sampleFrame('hop',.26).move[1]>0);assert.ok(G.sampleFrame('hop',.64).move[1]<0);
 assert.ok(G.sampleFrame('hop',.45).height>1);assert.equal(G.sampleFrame('hop',.85).height,0);
});
test('the guide runs only while open, can pause and scrub, and cancels on close',()=>{
 const f=fixture();assert.equal(f.frames.size,0);
 f.guide.open();assert.equal(f.frames.size,1);f.advance();f.advance();assert.ok(f.guide.time>0);
 f.elements['guide-play'].handlers.click();assert.equal(f.frames.size,0);assert.equal(f.guide.playing,false);
 f.elements['guide-scrub'].handlers.input({target:{value:'67'}});assert.equal(f.guide.time,.67);
 f.elements['guide-hop'].handlers.click();assert.equal(f.guide.index,5);assert.ok(f.elements['guide-description'].textContent.includes('Lift'));
 f.guide.toggle();assert.equal(f.frames.size,1);f.elements.help.handlers.close();assert.equal(f.frames.size,0);assert.equal(f.guide.opened,false);
});
test('reduced-motion users start paused and can explore the guide without animation',()=>{
 const f=fixture(true);f.guide.open();assert.equal(f.guide.playing,false);assert.equal(f.frames.size,0);
 assert.equal(f.elements['guide-play'].textContent,'Play animation');
 f.guide.seek(1);assert.equal(f.elements['guide-robot'].attributes.opacity,'1');
 f.guide.toggle();assert.equal(f.frames.size,1);
 f.document.hidden=true;f.listeners.visibilitychange();assert.equal(f.frames.size,0);
 f.document.hidden=false;f.listeners.visibilitychange();assert.equal(f.frames.size,1);
 f.guide.close();assert.equal(f.frames.size,0);
});
