const test=require('node:test');
const assert=require('node:assert/strict');
const {Sound,KEY}=require('../run-audio.js');
const {contextFixture}=require('./audio-fixture.cjs');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
test('audio is lazy, unlocks once, and reuses its context',async()=>{
 const f=contextFixture();let created=0;
 const s=new Sound(memory(),{contextFactory:()=>{created++;return f.ctx;}});
 s.play('cell');assert.equal(created,0);assert.equal(s.context,null);
 assert.ok(await s.unlock());assert.ok(await s.unlock());assert.equal(created,1);assert.equal(f.resumes,1);
 for(const type of ['ui','start','jump','land','gate','cell','checkpoint','fall','recover','finish']){
  const before=f.nodes.filter(n=>n.started!==undefined&&n.stopped!==undefined).length;
  s.play(type);assert.ok(f.nodes.filter(n=>n.started!==undefined&&n.stopped!==undefined).length>before,type+' should make a sound');
  f.advance(2);
 }
 assert.equal(s.voices.size,0);assert.ok(f.nodes.filter(n=>n.stopped!==undefined).every(n=>n.disconnected));
});
test('mute persists, cancels sounds, and does not replay stale events on unmute',async()=>{
 const storage=memory(),f=contextFixture(),s=new Sound(storage,{contextFactory:()=>f.ctx});await s.unlock();
 s.play('finish');assert.equal(s.voices.size,4);
 s.setEnabled(false);assert.equal(storage.data.get(KEY),'off');assert.equal(s.master.gain.value,0);
 const count=f.nodes.length;s.play('cell');assert.equal(f.nodes.length,count);
 f.advance(.04);assert.equal(s.voices.size,0);
 s.setEnabled(true);assert.equal(s.voices.size,0);assert.equal(s.master.gain.value,.42);
 s.setEnabled(false);const reload=new Sound(storage,{contextFactory:()=>{throw Error('Muted audio must stay uninitialized');}});
 assert.equal(reload.enabled,false);assert.equal(await reload.unlock(),false);
});
test('rolling sound tracks grounded speed and stops during jumps, falls, and pauses',async()=>{
 const f=contextFixture(),s=new Sound(memory(),{contextFactory:()=>f.ctx});await s.unlock();
 const run={velocity:[0,0,7],grounded:true,falling:false};
 s.update(run,true);assert.ok(s.rollGain.gain.value>0&&s.rollGain.gain.value<=.1);
 run.grounded=false;s.update(run,true);assert.equal(s.rollGain.gain.value,0);
 run.grounded=true;run.falling=true;s.update(run,true);assert.equal(s.rollGain.gain.value,0);
 run.falling=false;s.update(run,false);assert.equal(s.rollGain.gain.value,0);
 s.update(run,true);s.play('checkpoint');s.silence();assert.equal(s.rollGain.gain.value,0);f.advance(.04);assert.equal(s.voices.size,0);
});
test('voice limits and repeated-impact throttling keep feedback bounded',async()=>{
 const f=contextFixture(),s=new Sound(memory(),{contextFactory:()=>f.ctx});await s.unlock();
 s.handle([{type:'gate'},{type:'gate'},{type:'gate'}]);assert.equal(s.voices.size,1);
 for(let i=0;i<50;i++)s.tone(500,800,.2);
 assert.equal(s.voices.size,24);f.advance(1);assert.equal(s.voices.size,0);
});
test('blocked or missing audio never prevents gameplay and can be retried',async()=>{
 const f=contextFixture();f.ctx.rejectResume=true;
 const s=new Sound({getItem(){throw Error('no storage');},setItem(){throw Error('no storage');}},{contextFactory:()=>f.ctx});
 assert.equal(await s.unlock(),false);assert.equal(s.failed,true);
 assert.doesNotThrow(()=>s.play('cell'));f.ctx.rejectResume=false;assert.ok(await s.unlock());assert.equal(s.failed,false);
 const bad=new Sound(memory(),{contextFactory:()=>{throw Error('audio unavailable');}});
 assert.equal(await bad.unlock(),false);assert.equal(bad.context,null);assert.doesNotThrow(()=>bad.update({velocity:[0,0,1],grounded:true},true));
});
