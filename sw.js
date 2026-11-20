// Service worker sederhana: halaman utama diambil dari jaringan (selalu terbaru), cadangan dari cache saat offline.
const C='kaskelas-v1';
self.addEventListener('install',e=>{ self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin) return;
  e.respondWith(fetch(r).then(res=>{ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)).catch(()=>{}); return res; }).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));
});
// Notifikasi pengingat (Web Push) dari Worker: isi pesan {t: judul, b: isi, g: tag}.
self.addEventListener('push',e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(x){ try{ d={b:e.data.text()}; }catch(y){} }
  e.waitUntil(self.registration.showNotification(String(d.t||'Kas Kelas').slice(0,80),{body:String(d.b||'').slice(0,300),tag:String(d.g||'kk'),icon:'icon-192.png',badge:'icon-192.png',data:{u:'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{ for(const c of l){ if('focus' in c) return c.focus(); } return clients.openWindow('./'); }));
});
