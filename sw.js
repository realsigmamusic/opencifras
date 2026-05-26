const CACHE_NAME = 'v26.05.26';
const ASSETS = [
  './',
  './index.html', 
  './song.html',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Baixa primeiro a estrutura essencial
      await cache.addAll(ASSETS);

      // 2. Lê o songs.json para descobrir as cifras
      try {
        const response = await fetch('./songs.json');
        const songs = await response.json();
        
        // 3. Baixa música por música
        await Promise.all(songs.map(async (song) => {
          const safePath = song.file.split('/').map(encodeURIComponent).join('/');
          const fileUrl = './' + safePath;
          
          try {
            const songResponse = await fetch(fileUrl);
            if (songResponse.ok) {
              await cache.put(fileUrl, songResponse);
              console.log(`PWA: Salvo offline -> ${song.title}`); 
            }
          } catch (fetchErr) {
            console.warn(`PWA: Falha ao baixar ${fileUrl}`, fetchErr);
          }
        }));

        console.log('🎉 PWA: O catálogo completo foi salvo e está pronto para uso offline!');
      } catch (err) {
        console.error('PWA: Erro geral ao processar o songs.json', err);
      }
    })
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

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      
      // Isso manda ele ignorar o "?file=..." e carregar o song.html puro da gaveta!
      return cache.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
        
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Se for o song.html, não precisa salvar de novo para não inchar o celular
            const urlObj = new URL(e.request.url);
            if (!urlObj.pathname.endsWith('song.html')) {
              cache.put(e.request, networkResponse.clone());
            }
          }
          return networkResponse;
        }).catch(() => {
          // Se cair aqui, é porque está 100% offline. O cache.match já segurou a barra.
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});