const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
require('../run-core.js');require('../run-journey.js');const S=require('../run-share.js');
test('wake lock denial and late requests never block play or keep the screen awake after pausing',async()=>{
 let resolve,releases=0;const late=new Promise(r=>resolve=r),wake=new S.Wake({wakeLock:{request:()=>late}});
 const active=wake.set(true);await wake.set(false);resolve({release:async()=>releases++,addEventListener(){}});await active;assert.equal(wake.lock,null);assert.equal(releases,1);
 const denied=new S.Wake({wakeLock:{request:async()=>{throw Error('not allowed');}}});await denied.set(true);assert.equal(denied.lock,null);
 let releaseEvent;const okay=new S.Wake({wakeLock:{request:async()=>({release:async()=>releases++,addEventListener(_,fn){releaseEvent=fn;}})}});
 await okay.set(true);assert.ok(okay.lock);releaseEvent();assert.equal(okay.lock,null);await okay.set(true);await okay.set(false);assert.equal(releases,2);
});
test('result cards fail gracefully without Canvas, and formatted times carry rounded minutes',async()=>{
 assert.equal(await S.card({createElement(){throw Error('No canvas');}},{}),null);
 assert.equal(S.formatTime(59.999),'01:00.00');assert.equal(S.formatTime(0),'00:00.00');
 assert.match(S.challengeURL({track:0,section:null,expert:false,target:60},'https://example.com/game/?x=1#old'),/^https:\/\/example.com\/game\/#c=2~/);
});
function workerFixture(){
 const handlers={},stored=new Map(),scope='https://example.com/Gravity-Chamber/',deleted=[],requests=[],messages=[];let claimed=0,skipped=0,network=0;
 const cache={addAll:async items=>{for(const request of items){requests.push(request);stored.set(request.url,{body:'release '+new URL(request.url).pathname});}},match:async req=>stored.get(typeof req==='string'?req:req.url)};
 const caches={open:async()=>cache,keys:async()=>['gravity-run-old','gravity-run-gates-2','other-project'],delete:async name=>deleted.push(name)};
 const self={registration:{scope},clients:{claim:async()=>claimed++},skipWaiting:()=>skipped++,addEventListener:(type,fn)=>handlers[type]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,URL,Request,fetch:async req=>{network++;throw Error('Offline');}});
 const wait=type=>{let work;handlers[type]({waitUntil:p=>work=p});return work;};
 const fetch=(url,mode='cors',method='GET')=>{let response;handlers.fetch({request:{url,mode,method},respondWith:p=>response=p});return response;};
 return {scope,stored,requests,deleted,wait,fetch,handlers,get claimed(){return claimed;},get skipped(){return skipped;},get network(){return network;}};
}
test('a complete install caches every shipped HTML dependency and loads challenge URLs offline',async()=>{
 const f=workerFixture();await f.wait('install');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=match[1];if(url.startsWith('https:'))continue;
  assert.ok(f.stored.has(new URL(url,f.scope).href),'Uncached dependency '+url);
  assert.ok(fs.existsSync(path.join(__dirname,'..',url.split('?')[0])),'Missing shipped file '+url);
 }
 assert.ok(f.requests.every(request=>request.cache==='reload'));
 const response=await f.fetch(f.scope+'?friend=1','navigate');assert.equal(response.body,'release /Gravity-Chamber/index.html');assert.equal(f.network,0);
 assert.equal((await f.fetch(f.scope+'game.js?v=native1')).body,'release /Gravity-Chamber/game.js');
 assert.equal(f.fetch('https://example.com/other/','navigate'),undefined);assert.equal(f.fetch('https://different.example/Gravity-Chamber/game.js'),undefined);assert.equal(f.fetch(f.scope+'game.js','cors','POST'),undefined);
});
test('updates wait for the explicit message and remove only old game caches on activation',async()=>{
 const f=workerFixture();await f.wait('install');assert.equal(f.skipped,0);
 f.handlers.message({data:{type:'unknown'}});assert.equal(f.skipped,0);f.handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(f.skipped,1);
 await f.wait('activate');assert.deepEqual(f.deleted,['gravity-run-old']);assert.equal(f.claimed,1);
});
