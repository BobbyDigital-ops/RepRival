const CACHE='reprival-v13';const ASSETS=['./','./index.html','./styles.css','./program.js','./plan-library.js','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',ev=>ev.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',ev=>ev.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',ev=>{if(ev.request.method==='GET'&&new URL(ev.request.url).origin===self.location.origin){ev.respondWith(fetch(ev.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(ev.request,copy));return r;}).catch(()=>caches.match(ev.request)))}});
