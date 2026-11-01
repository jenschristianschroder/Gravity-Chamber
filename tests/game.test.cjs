// Headless logic tests with a small DOM/event harness. These do not claim browser QA.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function harness({permission='granted',secure=true,api=true,fullscreen=false,lockRejects=false}={}){
  let now=1000,frame,permissionCalls=0,nextTimer=0,fullscreenCalls=0,unlockCalls=0;
  const locks=[],chambers=[];
  const timers=new Map(),elements=new Map(),winEvents={},docEvents={};
  const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  class Element{
    constructor(){this.textContent='';this.hidden=false;this.disabled=false;this.clientWidth=560;this.clientHeight=570;this.style={setProperty(k,v){this[k]=v;}};this.handlers={};this.firstChild={textContent:''};this.classList={values:new Set(),toggle:(k,v)=>v?this.classList.values.add(k):this.classList.values.delete(k)};}
    addEventListener(type,fn){this.handlers[type]=fn;}
    replaceChildren(...children){this.children=children;}
    setAttribute(k,v){this[k]=v;}
    getBoundingClientRect(){return{width:560,height:570};}
    getContext(){return ctx;}
    focus(){}showModal(){this.open=true;}close(){this.open=false;}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const document={getElementById:get,createElement:()=>new Element(),createTextNode:t=>({textContent:t}),body:new Element(),documentElement:new Element(),fullscreenElement:null,hidden:false,addEventListener:(k,f)=>docEvents[k]=f};
  const window={isSecureContext:secure,orientation:0,innerWidth:390,innerHeight:844,addEventListener:(k,f)=>winEvents[k]=f,removeEventListener:k=>delete winEvents[k]};
  const orientation={angle:0,addEventListener(){},async lock(value){locks.push(value);if(lockRejects)throw Error('Unsupported');},unlock(){unlockCalls++;}};
  if(fullscreen){document.documentElement.requestFullscreen=async()=>{fullscreenCalls++;document.fullscreenElement=document.documentElement;};document.exitFullscreen=async()=>{document.fullscreenElement=null;};}
  const motion={requestPermission:()=>{permissionCalls++;return Promise.resolve(permission);}};
  if(api)window.DeviceMotionEvent=motion;
  const physics=require('../physics.js');
  class ObservedChamber extends physics.Chamber{constructor(){super();chambers.push(this);}}
  const sandbox={console,document,window,DeviceMotionEvent:api?motion:undefined,performance:{now:()=>now},matchMedia:()=>({matches:false}),screen:{orientation},devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame:f=>frame=f,setTimeout:f=>{timers.set(++nextTimer,f);return nextTimer;},clearTimeout:k=>timers.delete(k),localStorage:{getItem:()=>null,setItem(){}},GravityPhysics:{...physics,Chamber:ObservedChamber}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
  const tick=ms=>{now+=ms;const f=frame;f(now);};
  const reading=(rate={alpha:0,beta:0,gamma:0},force={x:0,y:9.81,z:0})=>{if(winEvents.devicemotion)winEvents.devicemotion({accelerationIncludingGravity:force,rotationRate:rate});};
  const click=async id=>{await get(id).handlers.click();await Promise.resolve();};
  const connect=async()=>{await click('start-button');for(let i=0;i<60;i++){tick(20);reading();}};
  return{get,document,window,tick,reading,click,connect,winEvents,docEvents,timers,orientation,locks,chambers,permissionCalls:()=>permissionCalls,fullscreenCalls:()=>fullscreenCalls,unlockCalls:()=>unlockCalls};
}
test('permission rejection gives a recoverable message without attaching a sensor listener',async()=>{
  const h=harness({permission:'denied'});await h.click('start-button');assert.equal(h.permissionCalls(),1);assert.match(h.get('status').textContent,/declined/);assert.ok(!h.get('start-button').disabled);assert.ok(!h.winEvents.devicemotion);
});
test('insecure context does not request sensors',async()=>{
  const h=harness({secure:false});await h.click('start-button');assert.match(h.get('status').textContent,/HTTPS/);assert.equal(h.permissionCalls(),0);
});
test('missing sensor API gives guidance',async()=>{
  const h=harness({api:false});await h.click('start-button');assert.match(h.get('status').textContent,/does not expose/);
});
test('null acceleration readings never start motion play',async()=>{
  const h=harness();await h.click('start-button');for(let i=0;i<70;i++){h.tick(20);h.reading(null,{x:null,y:null,z:null});}assert.equal(h.get('play-controls').hidden,true);for(const f of [...h.timers.values()])f();assert.match(h.get('status').textContent,/No usable motion/);
});
test('valid zero gyro readings calibrate, stale stream pauses, fresh stream resumes',async()=>{
  const h=harness();await h.connect();assert.equal(h.get('play-controls').hidden,false);assert.equal(h.get('pause-button').textContent,'Pause');
  h.tick(1600);assert.equal(h.get('pause-button').textContent,'Resume');assert.match(h.get('sensor-notice').textContent,/stopped/);
  await h.click('pause-button');assert.equal(h.get('pause-button').textContent,'Resume');h.reading();await h.click('pause-button');assert.equal(h.get('pause-button').textContent,'Pause');
  await h.click('exit-button');assert.ok(!h.winEvents.devicemotion);assert.equal(h.get('play-controls').hidden,true);
});
test('missing gyroscope is disclosed rather than silently presented as full motion',async()=>{
  const h=harness();await h.click('start-button');for(let i=0;i<60;i++){h.tick(20);h.reading(null);}assert.match(h.get('sensor-notice').textContent,/Rotation readings are unavailable/);
});
test('going into the background pauses play',async()=>{
  const h=harness();await h.connect();h.document.hidden=true;h.docEvents.visibilitychange();assert.equal(h.get('pause-button').textContent,'Resume');
});
test('desktop demo reaches all six beacons and can replay',async()=>{
  const h=harness();await h.click('demo-button');for(let i=0;i<5400&&!(!h.get('result-panel').hidden);i++)h.tick(1000/60);
  assert.equal(h.get('result-panel').hidden,false);assert.match(h.get('result-kicker').textContent,/SIMULATED DEMO/);assert.equal(h.get('beacons')['aria-label'],'6 of 6 beacons collected');
  await h.click('again-button');assert.equal(h.get('result-panel').hidden,true);assert.equal(h.get('beacons')['aria-label'],'0 of 6 beacons collected');
});
test('opposite phone accelerometer signs both make the orb fall to the lower wall',async()=>{
  for(const polarity of [-1,1]){
    const h=harness();await h.click('start-button');
    for(let i=0;i<200;i++){h.reading(undefined,{x:0,y:polarity*9.81,z:0});h.tick(20);}
    assert.equal(h.get('play-controls').hidden,false);
    assert.ok(h.chambers[0].position[1]<-1.6,`Expected downward gravity for accelerometer polarity ${polarity}`);
    // The calibration stays fixed when the phone is then inverted.
    for(let i=0;i<200;i++){h.reading(undefined,{x:0,y:-polarity*9.81,z:0});h.tick(20);}
    assert.ok(h.chambers[0].position[1]>1.6);
  }
});
test('calibration waits for an upright pose and recovers when the phone is raised',async()=>{
  const h=harness();await h.click('start-button');
  for(let i=0;i<70;i++){h.reading(undefined,{x:0,y:0,z:-9.81});h.tick(20);}
  assert.equal(h.get('play-controls').hidden,true);
  for(let i=0;i<70;i++){h.reading(undefined,{x:0,y:-9.81,z:0});h.tick(20);}
  assert.equal(h.get('play-controls').hidden,false);
});
test('native fullscreen and portrait lock are requested, and released on exit',async()=>{
  const h=harness({fullscreen:true});await h.click('demo-button');
  assert.equal(h.fullscreenCalls(),1);assert.deepEqual(h.locks,['portrait-primary']);assert.ok(h.document.fullscreenElement);
  await h.click('exit-button');assert.equal(h.document.fullscreenElement,null);assert.equal(h.unlockCalls(),1);
});
test('denied motion permission leaves native fullscreen',async()=>{
  const h=harness({permission:'denied',fullscreen:true});await h.click('start-button');assert.equal(h.document.fullscreenElement,null);assert.equal(h.get('play-controls').hidden,true);
});
test('unsupported native lock still allows full-viewport play with rotation compensation',async()=>{
  const h=harness({lockRejects:true});await h.click('demo-button');
  assert.ok(h.document.body.classList.values.has('playing'));
  const style=h.get('game-shell').style;
  assert.equal(style['--play-width'],'390px');assert.equal(style['--play-height'],'844px');
  for(const angle of [90,180,270,0]){
    h.orientation.angle=angle;const side=angle===90||angle===270;
    h.window.innerWidth=side?844:390;h.window.innerHeight=side?390:844;h.winEvents.orientationchange();
    assert.equal(style['--play-width'],'390px');assert.equal(style['--play-height'],'844px');assert.equal(style['--play-rotation'],`${-angle}deg`);
  }
});
