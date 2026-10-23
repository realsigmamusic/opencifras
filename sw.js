const CACHE_NAME = '2.8.0';
const STATIC_CACHE = `opencifras-static-${CACHE_NAME}`;
const SONGS_CACHE = 'opencifras-songs';
const NETWORK_TIMEOUT = 4000;

const ASSETS = [
  './index.html',
  './manifest.json',
  './assets/maskable_icon_x512.png',
  './assets/banner1.webp',
  './assets/banner2.webp',
  './assets/css/song.css',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/song.js',
  './assets/js/local-songs.js',
  './assets/vendor/fuse.min.js',
  './assets/vendor/chordsheetjs.min.js',
  './assets/vendor/jspdf.umd.min.js',
  './assets/vendor/chordsheetjs-pdf.min.js',
  './songs.json'
];

// helpers
function isDataRequest(url) {
  return url.pathname.endsWith('songs.json') || url.pathname.endsWith('.cho');
}

// Network-first com timeout: cai no cache se a rede FALHAR ou DEMORAR demais
async function networkFirst(request) {
  const cache = await caches.open(SONGS_CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT);
  try {
    const res = await fetch(request, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    clearTimeout(timer);
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || new Response('Offline e sem cópia salva.', { status: 503 });
  }
}

// Stale-while-revalidate: entrega o cache na hora e atualiza em segundo plano
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request)
    .then(res => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null); // offline: ignora em silêncio
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) || new Response('', { status: 504 });
}

// Baixa as músicas que AINDA NÃO estão no cache. Roda na instalação e também
// toda vez que o app abre online, então cifras novas ficam offline sem precisar
// subir a versão do SW. Falhas individuais não derrubam nada.
async function syncSongs() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch('./songs.json', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;

    const cache = await caches.open(SONGS_CACHE);
    await cache.put('./songs.json', res.clone());
    const songs = await res.json();

    const urls = songs.map(s => s.file).filter(Boolean);
    const missing = [];
    for (const u of urls) {
      if (!(await cache.match(u))) missing.push(u);
    }

    let ok = 0;
    for (let i = 0; i < missing.length; i += 6) {
      const batch = missing.slice(i, i + 6);
      const results = await Promise.allSettled(batch.map(async u => {
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status} em ${u}`);
        await cache.put(u, r);
      }));
      ok += results.filter(r => r.status === 'fulfilled').length;
    }
    console.log(`SW: ${urls.length - missing.length + ok}/${urls.length} músicas disponíveis offline.`);
  } catch (err) {
    console.warn('SW: não foi possível sincronizar as músicas:', err);
  }
}

// ciclo de vida
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // addAll é tudo-ou-nada: um único erro derrubaria a instalação inteira
    const results = await Promise.allSettled(
      ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn('SW: falhou ao cachear', ASSETS[i], r.reason);
    });
    await syncSongs();
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== SONGS_CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// fetch
let songsTopUpStarted = false; // uma sincronização por "vida" do SW

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const url = new URL(req.url);

  // Navegação (start_url, ?file=..., etc.): sempre o index.html do cache
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match('./index.html', { ignoreSearch: true });
      if (cached) return cached;
      try { return await fetch(req); }
      catch { return new Response('Offline', { status: 503 }); }
    })());
    return;
  }

  // songs.json e .cho
  if (isDataRequest(url)) {
    if (!songsTopUpStarted && url.pathname.endsWith('songs.json')) {
      songsTopUpStarted = true;
      e.waitUntil(syncSongs()); // completa o que faltar, em segundo plano
    }
    e.respondWith(networkFirst(req));
    return;
  }

  // Todo o resto (js, css, imagens, webp...): stale-while-revalidate
  e.respondWith(staleWhileRevalidate(req, e));
});