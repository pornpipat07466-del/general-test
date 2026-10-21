/* General Test — ใช้งานแบบออฟไลน์ได้หลังเปิดครั้งแรก (หน้าเว็บ: ดึงใหม่ก่อน ถ้าไม่มีเน็ตใช้ฉบับที่เก็บไว้) */
const V = 'gt-v1.0.1';
const CORE = ['./', 'index.html', 'criteria.html', 'properties.html', 'quality.html', 'standards.html', 'submit/index.html',
  'css/style.css', 'js/photos.js', 'img/sampling-stockpile.jpg', 'img/quartering-field.jpg', 'icons/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (/script\.google|googleusercontent|drive\.google|docs\.google|tisi\.go\.th/.test(u.host)) return;   // ข้อมูลสด ไม่เก็บ
  const lib = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (u.origin === location.origin && (r.mode === 'navigate' || /\.html$/.test(u.pathname))) {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
    return;
  }
  if (u.origin === location.origin || lib) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })));
  }
});
