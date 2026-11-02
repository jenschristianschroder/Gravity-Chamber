/* Install a complete release before offering it. No network is needed to play. */
'use strict';
const PREFIX='gravity-run-',CACHE=PREFIX+'gates-1';
const FILES=['./','index.html','styles.css?v=journey21','app-shell.css?v=native3','run-core.js?v=gates1','run-input.js?v=journey21','run-journey.js?v=journey21','run-progress.js?v=journey21','run-share.js?v=journey21','run-audio.js?v=journey21','run-renderer.js?v=native1','run-guide.js?v=journey21','game.js?v=native1','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','social-card.png'];
const base=self.registration.scope,urls=new Set(FILES.map(path=>new URL(path,base).href));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...urls].map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==new URL(base).origin||!url.href.startsWith(base))return;
 const navigation=request.mode==='navigate'&&(url.pathname===new URL(base).pathname||url.pathname===new URL('index.html',base).pathname);
 if(!navigation&&!urls.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(navigation?new URL('index.html',base).href:request);
  return cached||fetch(request);
 }));
});
