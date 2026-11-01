/* No requests, dependencies, accounts, or server code. */
(() => {
  'use strict';
  const P=GravityPhysics, $=id=>document.getElementById(id);
  const canvas=$('chamber'), ctx=canvas.getContext('2d');
  const ball=new P.Chamber(), STEP=1/120, HOLD=.38;
  const targets=[[-1.25,-1.65,-.95],[1.25,-1.65,-.95],[1.25,-1.65,.95],[-1.25,-1.65,.95],[-1.25,1.65,.95],[1.25,1.65,-.95]];
  const targetHints=['Back left. Find the first glow.','Back right. Follow the lower edge.','Front right. Bring the orb toward you.','Front left. Keep your movements gentle.','Upper left. Turn the chamber upside down.','Upper back right. One last turn.'];
  let state='ready',source='none',index=0,elapsed=0,capture=0,accumulator=0,lastFrame=0,lastHUD=0;
  let w=1,h=1,pixelRatio=1,trail=[],particles=[],listenerAttached=false,permissionBusy=false,waitingTimer;
  let best=null,immersiveWanted=false,displaySession=0;
  try {const b=Number(localStorage.getItem('gravity-chamber-best-v1'));if(b>0&&Number.isFinite(b))best=b;} catch{}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sensor={force:[0,9.81,0],omega:[0,0,0],alpha:[0,0,0],bias:[0,0,0],last:0,first:0,count:0,biasSamples:[],gravitySamples:[],polarity:1,gyro:false};
  const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;
  const finiteVector=v=>v&&['x','y','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));
  const validRate=r=>r&&['alpha','beta','gamma'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]));
  const lerp=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);
  const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const normalize=a=>a.map(x=>x/P.length(a));
  function resetSensor(){Object.assign(sensor,{force:[0,9.81,0],omega:[0,0,0],alpha:[0,0,0],bias:[0,0,0],last:0,first:0,count:0,biasSamples:[],gravitySamples:[],polarity:1,gyro:false});}
  function updateDisplay(){
    // Counter the operating system's rotation of the whole page; never rotate
    // the chamber or sensor frame. The fallback works without orientation.lock.
    const modern=screen.orientation&&screen.orientation.angle;
    const angle=((Number.isFinite(modern)?modern:Number(window.orientation)||0)%360+360)%360;
    const quarter=angle===90||angle===270;
    const width=window.innerWidth,height=window.innerHeight;
    const style=$('game-shell').style;
    style.setProperty('--play-width',`${quarter?height:width}px`);
    style.setProperty('--play-height',`${quarter?width:height}px`);
    style.setProperty('--play-rotation',`${-angle}deg`);
    $('fullscreen-button').hidden=!document.documentElement.requestFullscreen||!!document.fullscreenElement||state==='complete';
  }
  async function enterImmersive(){
    immersiveWanted=true;const session=++displaySession;
    try{
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen({navigationUI:'hide'});
    }catch{/* Full-viewport play still works when native fullscreen is unavailable. */}
    if(!immersiveWanted||session!==displaySession){
      if(!immersiveWanted&&document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});
      return;
    }
    try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('portrait-primary');}catch{/* CSS keeps the game fixed to the phone. */}
    updateDisplay();
  }
  function leaveImmersive(){
    immersiveWanted=false;displaySession++;
    try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}catch{}
    if(document.fullscreenElement&&document.exitFullscreen)Promise.resolve(document.exitFullscreen()).catch(()=>{});
  }
  function setStatus(message){$('status').textContent=message;}
  function updateBest(){ $('best-label').textContent=best?`Personal best · ${formatTime(best)}`:'Six beacons · three dimensions'; }
  function updateBeacons(){
    $('beacons').replaceChildren(...targets.map((_,i)=>{const n=document.createElement('span');n.className=`beacon-dot${i<index?' done':i===index?' current':''}`;return n;}));
    $('beacons').setAttribute('aria-label',`${index} of 6 beacons collected`);
  }
  function updateUI(){
    const active=['running','paused','complete'].includes(state);
    document.body.classList.toggle('playing',active);
    $('play-controls').hidden=!active;
    $('pause-button').hidden=state==='complete';
    $('pause-button').textContent=state==='paused'?'Resume':'Pause';
    $('result-panel').hidden=state!=='complete';
    $('start-button').disabled=permissionBusy||state==='waiting';
    $('demo-button').disabled=permissionBusy||state==='waiting';
    const label=state==='paused'?'PAUSED':source==='demo'&&active?'SIMULATED DEMO':state==='running'?'MOTION LIVE':state==='complete'?'COMPLETE':state==='waiting'?'CONNECTING':'READY';
    $('mode-badge').replaceChildren(document.createElement('span'),document.createTextNode(label));
    $('mode-badge').classList.toggle('live',state==='running'&&source==='motion');
    $('stage-label').textContent=active?`BEACON ${String(Math.min(index+1,6)).padStart(2,'0')} / 06`:'THE CHAMBER';
    $('objective').textContent=state==='paused'?'Take a breath.':active?'Follow the glow.':'Follow the glow.';
    $('play-hint').textContent=source==='demo'?'Simulated movement · try motion play on your phone.':targetHints[Math.min(index,5)];
    updateBeacons();updateBest();updateDisplay();
  }
  function attachMotion(){if(!listenerAttached){window.addEventListener('devicemotion',onMotion);listenerAttached=true;}}
  function detachMotion(){if(listenerAttached){window.removeEventListener('devicemotion',onMotion);listenerAttached=false;}clearTimeout(waitingTimer);}
  function failMotion(message){detachMotion();leaveImmersive();permissionBusy=false;source='none';state='ready';setStatus(message);updateUI();}
  async function enableMotion(){
    if(permissionBusy||state==='waiting')return;
    permissionBusy=true;setStatus('');updateUI();
    if(!window.isSecureContext){failMotion('Motion needs HTTPS. Open the published GitHub Pages address on your phone.');return;}
    if(typeof window.DeviceMotionEvent==='undefined'){failMotion('This browser does not expose motion sensors. Open the game on a compatible phone, or watch the demo.');return;}
    try {
      // Launch both gesture-gated requests synchronously from the Start tap.
      const permissionRequest=typeof DeviceMotionEvent.requestPermission==='function'?DeviceMotionEvent.requestPermission():Promise.resolve('granted');
      void enterImmersive();
      const permission=await permissionRequest;
      if(permission!=='granted'){failMotion('Motion access was declined. Allow motion for this site in your browser settings, then try again. The demo is still available.');return;}
      resetSensor();state='waiting';source='motion';permissionBusy=false;
      setStatus('Hold your phone upright and still, with its top edge up…');updateUI();attachMotion();
      waitingTimer=setTimeout(()=>{if(state==='waiting')failMotion(sensor.count?'Calibration needs a steady, upright phone with its top edge up. Try starting again in that position.':'No usable motion readings arrived. Open this HTTPS page directly in Safari or Chrome on your phone and check motion permissions.');},12000);
    } catch {failMotion('Motion access could not start. Open the game directly in your phone browser and allow motion, then try again.');}
  }
  function onMotion(event){
    if(!finiteVector(event.accelerationIncludingGravity))return;
    const now=performance.now(),first=!sensor.last,dt=first?1/60:Math.max(.002,Math.min(.15,(now-sensor.last)/1000));
    if(first)sensor.first=now;
    sensor.last=now;sensor.count++;
    const unnormalized=[event.accelerationIncludingGravity.x,event.accelerationIncludingGravity.y,event.accelerationIncludingGravity.z];
    if(state==='waiting'){
      sensor.gravitySamples.push({at:now,value:unnormalized});
      sensor.gravitySamples=sensor.gravitySamples.filter(s=>now-s.at<=850);
    }
    const f=P.limit(unnormalized.map(v=>v*sensor.polarity),35);
    sensor.force=first?f:lerp(sensor.force,f,1-Math.exp(-dt/.035));
    sensor.gyro=validRate(event.rotationRate);
    const raw=sensor.gyro?P.rotationVector(event.rotationRate):[0,0,0];
    if(state==='waiting'&&sensor.gyro){sensor.biasSamples.push(raw);if(sensor.biasSamples.length>60)sensor.biasSamples.shift();}
    const old=sensor.omega;
    const omega=P.limit(subtract(raw,sensor.bias),6);
    sensor.omega=first?omega:lerp(old,omega,1-Math.exp(-dt/.045));
    const derivative=first?[0,0,0]:P.limit(subtract(sensor.omega,old).map(v=>v/dt),20);
    sensor.alpha=lerp(sensor.alpha,derivative,1-Math.exp(-dt/.1));
    if(state==='waiting'&&sensor.count>=8&&now-sensor.first>=850){
      const calibration=P.calibrateAccelerometer(sensor.gravitySamples.map(s=>s.value));
      if(!calibration)return;
      sensor.polarity=calibration.polarity;sensor.force=calibration.force;
      const samples=sensor.biasSamples;
      if(samples.length){const mean=[0,1,2].map(i=>samples.reduce((s,v)=>s+v[i],0)/samples.length);const spread=Math.max(...samples.map(v=>P.length(subtract(v,mean))));if(P.length(mean)<.12&&spread<.15)sensor.bias=mean;}
      sensor.omega=[0,0,0];sensor.alpha=[0,0,0];clearTimeout(waitingTimer);setStatus('');beginRun('motion');
    }
    if(source==='motion'&&state==='running') $('sensor-notice').textContent=sensor.gyro?'':'Rotation readings are unavailable on this device. Gravity and movement still work; full rotation effects need a gyroscope.';
  }
  function beginRun(nextSource){
    source=nextSource;state='running';index=0;elapsed=0;capture=0;accumulator=0;trail=[];particles=[];ball.reset();
    $('capture-fill').style.width='0%';$('time').textContent=formatTime(0);$('sensor-notice').textContent='';setStatus('');
    updateUI();
  }
  function startDemo(){detachMotion();beginRun('demo');void enterImmersive();}
  function pause(message=''){
    if(state!=='running')return;state='paused';accumulator=0;capture=0;$('capture-fill').style.width='0%';
    if(message)$('sensor-notice').textContent=message;updateUI();
  }
  function resume(){
    if(state!=='paused')return;
    if(source==='motion'&&performance.now()-sensor.last>1000){$('sensor-notice').textContent='Waiting for motion readings. Keep this page open, then tap Resume.';return;}
    state='running';accumulator=0;sensor.alpha=[0,0,0];$('sensor-notice').textContent='';updateUI();
  }
  function restart(){
    if(source==='motion'&&performance.now()-sensor.last>1000){pause('Motion readings have stopped. Wait for them to return, or exit and enable motion again.');return;}
    beginRun(source==='motion'?'motion':'demo');
  }
  function exitGame(){detachMotion();leaveImmersive();state='ready';source='none';index=0;elapsed=0;capture=0;trail=[];particles=[];ball.reset();$('time').textContent='00:00.0';$('capture-fill').style.width='0%';$('sensor-notice').textContent='';updateUI();}
  function complete(){
    state='complete';capture=0;$('capture-fill').style.width='0%';
    const demo=source==='demo';
    $('result-kicker').textContent=demo?'SIMULATED DEMO COMPLETE':'ALL SIX BEACONS';
    $('result-title').textContent=demo?'Now it’s in your hands.':'Beautifully balanced.';
    $('result-detail').textContent=demo?'Open on your phone to play with real movement.':`Six beacons in ${formatTime(elapsed)}. Your hands did all of that.`;
    $('again-button').firstChild.textContent=demo?'Replay demo ':'Play again ';
    if(!demo&&(!best||elapsed<best)){best=elapsed;try{localStorage.setItem('gravity-chamber-best-v1',String(best));}catch{}}
    updateUI();$('result-title').setAttribute('tabindex','-1');$('result-title').focus({preventScroll:true});
  }
  function collect(){
    const point=targets[index];
    for(let i=0;i<20;i++){const az=i*2.39996,u=(i+.5)/20*2-1,r=Math.sqrt(1-u*u);particles.push({p:point.slice(),v:[r*Math.cos(az)*1.2,u*1.2,r*Math.sin(az)*1.2],life:1});}
    index++;capture=0;
    if(index===targets.length)complete();else{updateUI();$('sensor-notice').textContent=`Beacon ${index} collected.`;}
  }
  function simulate(dt,t){
    let f,omega=[0,0,0],alpha=[0,0,0];
    if(state==='running'&&source==='motion'){f=sensor.force;omega=sensor.omega;alpha=sensor.alpha;}
    else if(state==='running'&&source==='demo'){
      const target=targets[index];f=target.map((v,i)=>-(v-ball.position[i])*5+ball.velocity[i]*4);
      omega=[Math.sin(t*.7)*.12,Math.cos(t*.4)*.12,Math.sin(t*.3)*.1];
    }else if(state==='ready'){
      if(reduced)return;
      f=[Math.sin(t*.6)*1.8,9.81,Math.cos(t*.45)*1.4];
    }else return;
    ball.step(dt,f,omega,alpha);
    if(state==='running'){
      elapsed+=dt;
      const distance=P.length(subtract(ball.position,targets[index]));
      capture=distance<.5&&P.length(ball.velocity)<2.2?capture+dt:0;
      if(capture>=HOLD)collect();
    }
  }
  // Both physics and the camera stay in the phone's fixed coordinate frame.
  const view=normalize([4,3.1,7]),right=normalize(P.cross([0,1,0],view)),up=P.cross(view,right);
  function project(p){
    const active=['running','paused','complete'].includes(state);
    const depth=dot(p,view),perspective=9/(9-depth),scale=Math.min(w/(active?4.8:5.6),h/(active?6:6.5))*perspective;
    return {x:w*.5+dot(p,right)*scale,y:h*(active?.48:.53)-dot(p,up)*scale,scale,depth};
  }
  function line(a,b,color='#b8c2a9',width=1){const p=project(a),q=project(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
  function polygon(points,fill){ctx.beginPath();points.forEach((v,i)=>{const p=project(v);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function sphere(p,r){
    const q=project(p),radius=r*q.scale;
    ctx.save();ctx.shadowColor='#28412b30';ctx.shadowBlur=radius*.65;
    const g=ctx.createRadialGradient(q.x-radius*.36,q.y-radius*.4,radius*.04,q.x+radius*.18,q.y+radius*.1,radius*1.1);
    g.addColorStop(0,'#cad6b9');g.addColorStop(.22,'#8b9d79');g.addColorStop(.49,'#405943');g.addColorStop(.8,'#263c2d');g.addColorStop(1,'#14281e');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle='#e5f3d165';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(q.x,q.y,radius*.91,Math.PI*1.1,Math.PI*1.7);ctx.stroke();
  }
  function beacon(i,t){
    const q=project(targets[i]),current=i===index,done=i<index;
    if(done){ctx.fillStyle='#6e8a50';ctx.beginPath();ctx.arc(q.x,q.y,3,0,Math.PI*2);ctx.fill();return;}
    if(!current){ctx.strokeStyle='#9caa8b88';ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x,q.y,2.6,0,Math.PI*2);ctx.stroke();return;}
    const pulse=reduced?1:1+Math.sin(t*3)*.07,r=.35*q.scale*pulse;
    const halo=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r*1.8);halo.addColorStop(0,'#e9ad4d28');halo.addColorStop(.6,'#e9ad4d16');halo.addColorStop(1,'#e9ad4d00');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(q.x,q.y,r*1.8,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d58742';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#d5874266';ctx.beginPath();ctx.ellipse(q.x,q.y,r*.44,r,-.5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ac622d';ctx.font='9px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(String(i+1).padStart(2,'0'),q.x,q.y-r-9);
  }
  function render(t,dt){
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,w,h);
    const [x,y,z]=ball.bounds;
    polygon([[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]],'#d7e2b526');
    polygon([[-x,-y,-z],[-x,y,-z],[x,y,-z],[x,-y,-z]],'#e0e6ce1f');
    for(let i=0;i<=8;i++){
      const u=i/8;line([-x+2*x*u,-y,-z],[-x+2*x*u,-y,z],'#aab99726');line([-x,-y,-z+2*z*u],[x,-y,-z+2*z*u],'#aab99726');
      line([-x+2*x*u,-y,-z],[-x+2*x*u,y,-z],'#aab99720');line([-x,-y+2*y*u,-z],[x,-y+2*y*u,-z],'#aab99720');
    }
    const edges=[];
    for(const a of [-1,1])for(const b of [-1,1]){edges.push([[-x,a*y,b*z],[x,a*y,b*z]]);edges.push([[a*x,-y,b*z],[a*x,y,b*z]]);edges.push([[a*x,b*y,-z],[a*x,b*y,z]]);}
    for(const edge of edges)line(...edge,'#8c9e7859',1);
    // Projection to the chamber floor gives a stable depth cue.
    const bp=ball.position,shadow=[];
    for(let i=0;i<32;i++){const a=i*Math.PI/16;shadow.push([bp[0]+Math.cos(a)*.25,-y+.005,bp[2]+Math.sin(a)*.25]);}
    polygon(shadow,`rgba(62,87,42,${Math.max(.025,.17-(bp[1]+y)*.035)})`);
    if(trail.length>1){for(let i=1;i<trail.length;i++)line(trail[i-1],trail[i],`rgba(118,145,86,${i/trail.length*.22})`,1.5);}
    const objects=targets.map((p,i)=>({depth:project(p).depth,draw:()=>beacon(i,t)}));
    objects.push({depth:project(bp).depth,draw:()=>sphere(bp,ball.radius)});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    for(const part of particles){part.life-=dt;part.p=part.p.map((v,i)=>v+part.v[i]*dt);const q=project(part.p);ctx.fillStyle=`rgba(132,154,75,${Math.max(0,part.life)*.8})`;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(.1,part.life*2),0,Math.PI*2);ctx.fill();}particles=particles.filter(p=>p.life>0);
    // A compact three-axis guide makes the depth direction visible.
    const origin=[-x,-y,z],q=project(origin);
    for(const [label,dir] of [['x',[.45,0,0]],['y',[0,.45,0]],['z',[0,0,.45]]]){const tip=origin.map((v,i)=>v+dir[i]);line(origin,tip,'#697f5680',1);const p=project(tip);ctx.fillStyle='#68775c';ctx.font='8px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(label,p.x+(p.x-q.x)*.15,p.y+(p.y-q.y)*.15+3);}
    if(state==='paused'){ctx.fillStyle='#f4f3ecaa';ctx.fillRect(0,90,w,h-155);ctx.fillStyle='#3f533b';ctx.font='italic 30px Georgia, serif';ctx.textAlign='center';ctx.fillText('A moment of stillness.',w/2,h*.5);}
  }
  function resize(){w=canvas.clientWidth;h=canvas.clientHeight;pixelRatio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*pixelRatio);canvas.height=Math.round(h*pixelRatio);}
  function frame(now){
    const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
    if(!document.hidden){
      if(state==='running'&&source==='motion'&&now-sensor.last>1500)pause('Motion readings stopped. Return to this page and tap Resume once the sensors respond.');
      accumulator+=dt;while(accumulator>=STEP){simulate(STEP,now/1000);accumulator-=STEP;}
      if(['ready','running'].includes(state)){trail.push(ball.position.slice());if(trail.length>28)trail.shift();}
      if(now-lastHUD>100){$('time').textContent=formatTime(elapsed);$('capture-fill').style.width=`${Math.min(100,capture/HOLD*100)}%`;lastHUD=now;}
      render(now/1000,dt);
    }
    requestAnimationFrame(frame);
  }
  $('start-button').addEventListener('click',enableMotion);
  $('demo-button').addEventListener('click',startDemo);
  $('fullscreen-button').addEventListener('click',()=>{void enterImmersive();});
  $('pause-button').addEventListener('click',()=>state==='paused'?resume():pause());
  $('reset-button').addEventListener('click',restart);$('again-button').addEventListener('click',restart);$('exit-button').addEventListener('click',exitGame);
  $('help-button').addEventListener('click',()=>{pause();$('help-dialog').showModal();});
  for(const id of ['close-help','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Paused while the page was in the background.');lastFrame=0;accumulator=0;});
  window.addEventListener('resize',updateDisplay);
  window.addEventListener('orientationchange',updateDisplay);
  if(screen.orientation&&screen.orientation.addEventListener)screen.orientation.addEventListener('change',updateDisplay);
  document.addEventListener('fullscreenchange',updateDisplay);
  new ResizeObserver(resize).observe(canvas);
  resize();updateUI();requestAnimationFrame(frame);
})();
