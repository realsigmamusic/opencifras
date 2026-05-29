const CACHE_NAME = 'v26.05.29';
const ASSETS = [
  './index.html',
  './manifest.json',
  './maskable_icon_x512.png',
  './assets/css/song.css',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/song.js',
  './assets/vendor/fuse.min.js',
  './assets/vendor/chordsheetjs.min.js',
  './songs.json'
];

// INSTALAÇÃO
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cacheia os arquivos base da aplicação
      await cache.addAll(ASSETS);

      // Pré-carrega o catálogo inteiro de músicas (.cho)
      try {
        const response = await fetch('./songs.json');
        const songs = await response.json();
        for (const song of songs) {
          const safePath = song.file.split('/').map(encodeURIComponent).join('/');
          const fileUrl = './' + safePath;
          try {
            await cache.add(fileUrl);
          } catch (err) {
            console.warn(`PWA: Erro ao pré-cachear música: ${fileUrl}`);
          }
        }
      } catch (err) {
        console.warn('PWA: Falha ao ler songs.json durante a instalação');
      }
    })()
  );
  self.skipWaiting();
});

// ATIVAÇÃO: Limpa versões antigas do cache automaticamente
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// FETCH: funcionamento Offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // ESTRATÉGIA PARA NAVEGAÇÃO (SPA): 
  // Se o usuário carregar index.html?qualquer-coisa, entrega o index.html fixo do cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((response) => response || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      // Se não estiver no cache, busca na rede e salva para a próxima vez
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;

        // Não salvamos no cache se a URL tiver parâmetros de busca (para não duplicar o index.html)
        if (!url.search || !url.pathname.endsWith('index.html')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Falha total (offline e sem cache)
        console.log('PWA: Recurso não encontrado na rede nem no cache.');
      });
    })
  );
});