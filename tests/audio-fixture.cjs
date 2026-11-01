const assert=require('node:assert/strict');
function contextFixture(){
 const nodes=[],params=[];let currentTime=1,resumes=0;
 const param=(value=0)=>{const p={value,calls:[],cancelScheduledValues(t){assert.ok(Number.isFinite(t));this.calls.push(['cancel',t]);},
  setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.calls.push(['set',v,t]);},
  exponentialRampToValueAtTime(v,t){assert.ok(v>0&&Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.calls.push(['ramp',v,t]);},
  setTargetAtTime(v,t,constant){assert.ok(Number.isFinite(v)&&Number.isFinite(t)&&constant>0);this.value=v;this.calls.push(['target',v,t,constant]);}
 };params.push(p);return p;};
 const node=type=>{const n={type,connections:[],connect(target){assert.ok(target);this.connections.push(target);},disconnect(){this.disconnected=true;},
  start(t=currentTime){this.started=t;},stop(t=currentTime){this.stopped=t;},gain:param(1),frequency:param(440),playbackRate:param(1)
 };nodes.push(n);return n;};
 const ctx={
  state:'suspended',sampleRate:8000,destination:{},get currentTime(){return currentTime;},
  createGain:()=>node('gain'),createOscillator:()=>node('oscillator'),createBufferSource:()=>node('buffer'),createBiquadFilter:()=>node('filter'),
  createDynamicsCompressor(){const n=node('compressor');for(const key of ['threshold','knee','ratio','attack','release'])n[key]=param();return n;},
  createBuffer(channels,length){assert.equal(channels,1);const data=new Float32Array(length);return {getChannelData:()=>data};},
  async resume(){resumes++;if(this.rejectResume)throw Error('Blocked');this.state='running';},
  async close(){this.state='closed';},
 };
 return {ctx,nodes,params,get resumes(){return resumes;},
  advance(dt){currentTime+=dt;for(const n of nodes)if(n.stopped!==undefined&&n.stopped<=currentTime&&!n.ended){n.ended=true;if(n.onended)n.onended();}},
 };
}
module.exports={contextFixture};
