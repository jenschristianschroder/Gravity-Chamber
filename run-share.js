/* Optional browser integrations never prevent a run from starting. */
(function(root){
'use strict';
const PUBLIC_URL='https://jenschristianschroder.github.io/Gravity-Chamber/';
function formatTime(t){const cents=Math.max(0,Math.round(t*100));return String(Math.floor(cents/6000)).padStart(2,'0')+':'+(cents%6000/100).toFixed(2).padStart(5,'0');}
function challengeURL(spec,base=PUBLIC_URL){return base.split('#')[0].split('?')[0]+root.GravityJourney.encode(spec);}
function card(document,result){
 return new Promise(resolve=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const c=canvas.getContext('2d');if(!c)return resolve(null);
   const rect=(x,y,w,h,r,color)=>{c.fillStyle=color;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill();};
   const circle=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
   const gradient=c.createLinearGradient(0,0,1200,630);gradient.addColorStop(0,'#f7faef');gradient.addColorStop(1,'#b5dcd5');c.fillStyle=gradient;c.fillRect(0,0,1200,630);
   c.fillStyle='#183d43';c.font='bold 30px sans-serif';c.fillText('gravity run',64,69);
   c.fillStyle='#527278';c.font='18px monospace';c.fillText('YOUR PHONE IS THE CONTROLLER',64,107);
   c.fillStyle='#183d43';c.font='bold 35px sans-serif';c.fillText(result.name.slice(0,42),64,191);
   c.font='bold 100px monospace';c.fillText(formatTime(result.time),58,314);
   rect(64,350,480,56,18,'#183d43');c.fillStyle='#f7faef';c.font='bold 22px sans-serif';c.fillText(result.medal+'  ·  '+(result.falls===0?'CLEAN RUN':result.falls+' RECOVERIES'),86,386);
   c.fillStyle='#527278';c.font='22px sans-serif';c.fillText(result.cells+' energy cells collected',64,446);
   c.fillStyle='#183d43';c.font='bold 32px sans-serif';c.fillText('Your turn. Can you beat it?',64,542);c.font='19px sans-serif';c.fillText('Tilt. Race. Challenge a friend.  •  No account needed.',64,582);
   c.save();c.translate(910,322);c.rotate(-.12);
   c.fillStyle='#315d5b20';c.beginPath();c.ellipse(0,135,121,26,0,0,Math.PI*2);c.fill();
   circle(0,0,123,'#f9fbed');c.save();c.beginPath();c.arc(0,0,122,0,Math.PI*2);c.clip();rect(-135,-45,270,97,30,'#183d43');c.restore();
   circle(-43,-8,10,'#9ce6ca');circle(43,-8,10,'#9ce6ca');rect(-8,-167,16,49,6,'#183d43');circle(0,-178,21,'#f77655');circle(-126,0,17,'#f77655');circle(126,0,17,'#f77655');
   c.strokeStyle='#759a90';c.lineWidth=3;c.beginPath();c.arc(0,0,122,0,Math.PI*2);c.stroke();c.restore();
   canvas.toBlob(blob=>resolve(blob),'image/png');
  }catch{resolve(null);}
 });
}
function download(document,blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
class Wake{
 constructor(navigator){this.navigator=navigator;this.lock=null;this.wanted=false;this.token=0;}
 async set(active){
  this.wanted=active;const token=++this.token;
  if(!active){const old=this.lock;this.lock=null;if(old)try{await old.release();}catch{}return;}
  if(this.lock||!this.navigator.wakeLock)return;
  try{const lock=await this.navigator.wakeLock.request('screen');if(!this.wanted||token!==this.token){await lock.release();return;}this.lock=lock;lock.addEventListener('release',()=>{if(this.lock===lock)this.lock=null;});}catch{}
 }
}
const api={PUBLIC_URL,formatTime,challengeURL,card,download,Wake};root.GravityShare=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
