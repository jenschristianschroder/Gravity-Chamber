const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const G=require('../run-core.js');
const M=require('../run-input.js');
const P=require('../run-progress.js');
const A=require('../run-audio.js');
const J=require('../run-journey.js');
const S=require('../run-share.js');
const {contextFixture}=require('./audio-fixture.cjs');
const source=readFileSync(__dirname+'/../game.js','utf8');
const html=readFileSync(__dirname+'/../index.html','utf8');
function fixture({permission='granted',storageFails=false,webgl=true,deferredPermission=null,saved=new Map(),tutorialDone=true,hash='',navigator={}}={}){
 const elements={},events={},frames=[];let now=1000,latestRun;
 const element=()=>({hidden:false,disabled:false,textContent:'',value:'',checked:false,classList:{toggle(k,value){this[k]=value;}},setAttribute(k,v){this[k]=v;},style:{setProperty(k,v){this[k]=v;}},handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},click(){return this.handlers.click?.();},select(){}});
 for(const m of html.matchAll(/id="([^"]+)"/g))elements[m[1]]=element();
 const document={hidden:false,fullscreenElement:null,
  body:{classList:{toggle(k,value){this[k]=value;}}},
  documentElement:{requestFullscreen:()=>Promise.reject(Error('No native fullscreen'))},
  exitFullscreen:()=>Promise.resolve(),
  getElementById(id){assert.ok(elements[id],'Missing HTML element: '+id);return elements[id];},
  addEventListener(k,fn){events['document:'+k]=fn;}
 };
 const window={
  innerWidth:390,innerHeight:844,isSecureContext:true,orientation:0,
  screen:{orientation:{angle:0,lock:()=>Promise.reject(Error('No native lock')),unlock(){},addEventListener(k,fn){events['orientation:'+k]=fn;}}},
  DeviceMotionEvent:{requestPermission:()=>deferredPermission||Promise.resolve(permission)},
  addEventListener(k,fn){events['window:'+k]=fn;},removeEventListener(k,fn){if(events['window:'+k]===fn)delete events['window:'+k];},
  navigator,history:{replaceState(){}},location:{hash,pathname:'/Gravity-Chamber/',search:'',protocol:'https:',reload(){events.reload=true;}}
 };
 const storage={getItem(k){if(storageFails)throw Error('Blocked');return saved.get(k)||null;},setItem(k,v){if(storageFails)throw Error('Blocked');saved.set(k,v);}};
 const af=contextFixture();let sound;
 const audio={Sound:class extends A.Sound{constructor(storage){super(storage,{contextFactory:()=>af.ctx});sound=this;}}};
 let guide;const guideAPI={Guide:class{constructor(){guide=this;this.opened=false;}open(){this.opened=true;}close(){this.opened=false;}}};
 const renderer={Renderer:class{constructor(){if(!webgl)throw Error('No WebGL');}setCourse(){}handleEvents(){}resetEffects(){}render(run){latestRun=run;}}};
 const profile={Progress:class extends P.Progress{constructor(storage){super(storage);this.tutorialDone=tutorialDone;}}};
 new Function('GravityJourney','GravityShare','GravityRun','GravityMotion','GravityRenderer','GravityProgress','GravityAudio','GravityGuide','window','document','performance','requestAnimationFrame','localStorage',source)(J,S,G,M,renderer,profile,audio,guideAPI,window,document,{now:()=>now},fn=>frames.push(fn),storage);
 return {elements,window,document,events,saved,sound,guide,
  get run(){return latestRun;},change:(id,value)=>{if(typeof value==='boolean')elements[id].checked=value;else elements[id].value=value;return elements[id].handlers.change?.({target:elements[id]});},
  click:id=>elements[id].handlers.click(),
  frame(dt=1000/60){now+=dt;af.advance(dt/1000);frames.shift()(now);},
  motion(g=[0,9.81,0],a=[0,0,0]){
   const fn=events['window:devicemotion'];if(fn)fn({accelerationIncludingGravity:{x:g[0]+a[0],y:g[1]+a[1],z:g[2]+a[2]},acceleration:{x:a[0],y:a[1],z:a[2]},rotationRate:{alpha:0,beta:0,gamma:0}});
  },
  calibrate(){for(let i=0;i<95;i++){this.motion();this.frame(20);}},
 };
}

module.exports={fixture};
