const CACHE_NAME = '2.5.35';
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
  './songs.json'
];

// INSTALAÇÃO: cacheia assets estáticos e faz o pré-cache de todas as músicas
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Salva os arquivos estáticos da UI
      await cache.addAll(ASSETS);

      // 2. Busca o songs.json para descobrir quais são os arquivos .cho
      try {
        const response = await fetch('./songs.json', { cache: 'no-store' });
        if (response.ok) {
          const songs = await response.json();

          const choUrls = songs
            .map(song => song.file)
            .filter(url => url);

          // Cacheia cada música individualmente — se uma falhar, as outras continuam
          const results = await Promise.allSettled(
            choUrls.map(async (url) => {
              const res = await fetch(url, { cache: 'no-store' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              await cache.put(url, res);
            })
          );

          const failed = results.filter(r => r.status === 'rejected');
          console.log(`SW: ${choUrls.length - failed.length}/${choUrls.length} músicas cacheadas para uso offline.`);
          if (failed.length) {
            console.warn('SW: falha ao cachear algumas músicas:', failed.map(f => f.reason));
          }
        }
      } catch (err) {
        console.warn('SW: Não foi possível pré-cachear as músicas:', err);
      }
    })
  );
  self.skipWaiting();
});

// ATIVAÇÃO: limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Estratégia: network-first para dados dinâmicos, cache-first para assets estáticos
function isDataRequest(url) {
  // songs.json e arquivos .cho são dinâmicos
  return url.pathname.endsWith('songs.json') || url.pathname.endsWith('.cho');
}

function isStaticAsset(url) {
  return (
    url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) ||
    url.pathname.endsWith('manifest.json')
  );
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // Navegação SPA → sempre entrega o index.html do cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(r => r || fetch(e.request))
    );
    return;
  }

  // DADOS DINÂMICOS (songs.json, .cho): network-first, cache como fallback
  if (isDataRequest(url)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(networkResponse => {
          // Atualiza o cache com a versão mais recente
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Sem internet → usa o que está no cache
          return caches.match(e.request).then(r => {
            if (r) return r;
            console.warn('SW: sem cache para', url.pathname);
          });
        })
    );
    return;
  }

  // ASSETS ESTÁTICOS (js, css, imagens): cache-first, atualiza em background
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return networkResponse;
        });
        // Entrega o cache imediatamente, mas já atualiza em background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Qualquer outro recurso: tenta rede, cai no cache
  e.respondWith(
    fetch(e.request)
      .then(r => r)
      .catch(() => caches.match(e.request))
  );
});