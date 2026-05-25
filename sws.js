const CACHE_NAME = 'v26.05.25.09';
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
          const fileUrl = './' + encodeURI(song.file);
          
          try {
            const songResponse = await fetch(fileUrl);
            if (songResponse.ok) {
              await cache.put(fileUrl, songResponse);
            }
          } catch (fetchErr) {
            // Se UMA música falhar, ele apenas avisa no console e continua baixando o resto!
            console.warn(`PWA: Não foi possível pré-cachear ${fileUrl}`, fetchErr);
          }
        }));

        console.log('PWA: O catálogo completo foi salvo para uso offline!');
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

// FETCH: Estratégia Stale-While-Revalidate (Abre o cache instantâneo e atualiza de fundo se houver internet)
self.addEventListener('fetch', (e) => {
  // Ignora requisições que não sejam GET locais (extensões do navegador, etc)
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Se falhar (offline), silencia o erro porque o cache resolveu
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});