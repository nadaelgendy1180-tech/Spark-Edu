// SPEAK: static interface fallback. NEVER cache Firebase API responses or user data.
const CACHE='speak-shell-v2';
const SHELL=['/','/manifest.webmanifest','/app-icon-192.png','/app-icon-512.png','/center-logo.jpeg','/center-photo.jpeg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('spark-edu-shell-')||key.startsWith('speak-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin || url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>{
      const cache=await caches.open(CACHE);
      return (await cache.match('/')) || Response.error();
    }));
    return;
  }
  if(!['script','style','image','font','manifest'].includes(request.destination))return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)));}
    return response;
  }).catch(async()=> (await caches.match(request)) || Response.error()));
});
