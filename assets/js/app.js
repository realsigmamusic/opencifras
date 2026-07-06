(function () {
  'use strict';

  //Dados carregados do songs.json 
  let allSongs    = [];    // todas as músicas em ordem alfabética
  let recentSongs = [];    // as mesmas músicas, ordenadas pela data de edição
  let showingAll  = false; // controla se estamos mostrando todas ou só as 5 recentes
  let fuse        = null;  // motor de busca fuzzy (Fuse.js)

  //Elementos da tela inicial 
  const searchInput      = document.getElementById('search-input');
  const songList         = document.getElementById('song-list');
  const favoritesList    = document.getElementById('favorites-list');
  const favoritesSection = document.getElementById('favorites-section');
  const allSongsSection  = document.getElementById('all-songs-section');
  const noResults        = document.getElementById('no-results');
  const btnShowAll       = document.getElementById('btn-show-all');

  //Chaves do localStorage 
  const FAVORITES_KEY = 'chordsheets_favorites';

  //Configurações 
  const LIMIT_HOME = 7; // quantas músicas mostrar na aba Início antes do "ver todas"

  // UTILITÁRIOS ==================================================================================

  // Escapa caracteres especiais para evitar bugs ao inserir texto no HTML
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Lê a lista de favoritos salva no dispositivo
  function getSavedFavorites() {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  // Gera o HTML de um card de música (link clicável com título e artista)
  function renderCard(song) {
    const url = '?file=' + encodeURIComponent(song.file);
    return '<a href="' + url + '" class="song-item">'
      + '<div class="song-card-content">'
      +   '<h1 class="song-card-title">'  + escapeHtml(song.title)  + '</h1>'
      +   '<span class="song-card-artist">' + escapeHtml(song.artist) + '</span>'
      + '</div>'
      + '</a>';
  }

  // RENDERIZAÇÃO DAS SEÇÕES ======================================================================

  // Mostra as músicas favoritas na aba Favoritos
  function renderFavoritesSection() {
    const saved        = getSavedFavorites();
    const favoriteSongs = allSongs.filter(s => saved.includes(s.file));

    if (favoriteSongs.length === 0) {
      favoritesSection.style.display = 'none';
    } else {
      favoritesSection.style.display = 'block';
      favoritesList.innerHTML = favoriteSongs.map(s => renderCard(s)).join('');
    }
  }

  // Mostra a lista de músicas na aba Início (recentes ou resultado de busca)
  function renderList(songs, showLimited = true) {
    if (songs.length === 0) {
      songList.innerHTML = '';
      noResults.style.display    = 'block';
      allSongsSection.style.display = 'none';
      btnShowAll.style.display   = 'none';
      return;
    }

    noResults.style.display    = 'none';
    allSongsSection.style.display = 'block';

    // Se showLimited=true e ainda não clicamos em "ver todas", mostra só as primeiras
    const toShow = (showLimited && !showingAll && songs.length > LIMIT_HOME)
      ? songs.slice(0, LIMIT_HOME)
      : songs;

    songList.innerHTML = toShow.map(s => renderCard(s)).join('');

    // Mostra ou esconde o botão "ver todas as X músicas"
    if (showLimited && !showingAll && songs.length > LIMIT_HOME) {
      btnShowAll.style.display  = 'block';
      btnShowAll.textContent    = `Ver todas as ${songs.length} músicas`;
    } else {
      btnShowAll.style.display  = 'none';
    }
  }

  // Monta a lista de artistas (um por linha, em ordem alfabética)
  function renderArtistsSection() {
    const artistsEl = document.getElementById('artists-list');
    const artists   = {};

    // Agrupa músicas por artista. Artistas separados por vírgula contam individualmente
    allSongs.forEach(s => {
      if (!s.artist) return;
      s.artist.split(',').map(a => a.trim()).filter(Boolean).forEach(name => {
        if (!artists[name]) artists[name] = [];
        artists[name].push(s);
      });
    });

    const sorted = Object.keys(artists).sort((a, b) => a.localeCompare(b));

    artistsEl.innerHTML = sorted.map(artist => `
      <div class="artist-item" data-artist="${escapeHtml(artist)}">
        <span class="artist-name">${escapeHtml(artist)}</span>
      </div>
    `).join('');

    // Ao clicar num artista, abre a lista de músicas dele
    artistsEl.querySelectorAll('.artist-item').forEach(el => {
      el.addEventListener('click', () => renderArtistSongs(el.dataset.artist));
    });
  }

  // Mostra as músicas de um artista específico, com botão "voltar"
  function renderArtistSongs(artist) {
    const artistsEl = document.getElementById('artists-list');
    const songs     = allSongs.filter(s =>
      s.artist && s.artist.split(',').map(a => a.trim()).includes(artist)
    );

    artistsEl.innerHTML = `
      <button class="artist-back-btn" id="artist-back">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"/>
        </svg>
        Artistas
      </button>
      ${songs.map(s => renderCard(s)).join('')}
    `;

    document.getElementById('artist-back').addEventListener('click', renderArtistsSection);
  }

  // BUSCA ========================================================================================

  // Chamada toda vez que o usuário digita na barra de pesquisa
  function onSearch() {
    const query = searchInput.value.trim();
    document.getElementById('all-songs-title').textContent = query ? 'Resultados da busca' : showingAll ? 'Todas as músicas' : 'Músicas recentes';

    if (!query) {
      showingAll = false;
      renderList(recentSongs, true);
      return;
    }

    // Com texto: executa a busca fuzzy e mostra resultados
    showingAll = false;
    renderList(fuse.search(query).map(r => r.item), false);
  }

  // Chamado ao clicar em "ver todas as X músicas"
  function onShowAll() {
    showingAll = true;
    btnShowAll.style.display = 'none';
    document.getElementById('all-songs-title').textContent = 'Todas as músicas';
    renderList(allSongs, false);
    window.scrollTo(0, 0);
  }

  // NAVEGAÇÃO POR ABAS (bottom nav) ==============================================================

  const navItems = document.querySelectorAll('.bottom-nav-item');

  // Marca a aba clicada como ativa (destaca visualmente)
  function setActiveNav(id) {
    navItems.forEach(i => i.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // Mostra apenas a seção da aba selecionada, esconde todas as outras
  function showTab(tab) {
    document.getElementById('search-section').style.display    = tab === 'inicio'    ? 'block' : 'none';
    document.getElementById('all-songs-section').style.display = tab === 'inicio'    ? 'block' : 'none';
    document.getElementById('artists-section').style.display   = tab === 'artistas'  ? 'block' : 'none';
    document.getElementById('favorites-section').style.display = tab === 'favoritos' ? 'block' : 'none';
    document.getElementById('config-section').style.display    = tab === 'config'    ? 'block' : 'none';
    document.getElementById('no-results').style.display        = 'none';
  }

  // Clique em "Início"
  document.getElementById('nav-inicio').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView(); // syncView já ativa a aba início por padrão
  });

  // Clique em "Artistas"
  document.getElementById('nav-artistas').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
    setActiveNav('nav-artistas');
    showTab('artistas');
    renderArtistsSection();
  });

  // Clique em "Favoritos"
  document.getElementById('nav-favoritos').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
    setActiveNav('nav-favoritos');
    showTab('favoritos');
    renderFavoritesSection();
  });

  // Clique em "Configurações"
  document.getElementById('nav-config').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
    setActiveNav('nav-config');
    showTab('config');
  });

  // CONTROLE DE TELA (home vs. cifra aberta) =====================================================

  // Decide qual tela mostrar com base na URL:
  // - Se tem ?file=... na URL → mostra a tela da cifra
  // - Se não tem → mostra a tela inicial (home)
  function syncView() {
    const songCountLabel = document.getElementById('song-count');
    const songControls   = document.getElementById('song-controls');
    const navbarBrand    = document.getElementById('navbar-brand');
    const params         = new URLSearchParams(window.location.search);

    if (params.has('file')) {
      // Tela da cifra
      document.getElementById('home-view').style.display = 'none';
      document.getElementById('song-view').style.display = 'block';
      if (songControls)   songControls.style.display   = 'flex';
      if (songCountLabel) songCountLabel.style.display = 'none';
    } else {
      // Tela inicial
      document.getElementById('home-view').style.display = 'block';
      document.getElementById('song-view').style.display = 'none';
      if (songControls)   songControls.style.display   = 'none';
      if (songCountLabel) songCountLabel.style.display = 'inline';
      if (navbarBrand)    navbarBrand.style.display    = 'block';
      showTab('inicio');
      setActiveNav('nav-inicio');
      onSearch();
    }
  }

  // INICIALIZAÇÃO ================================================================================

  // Carrega o catálogo de músicas e configura a busca
  async function init() {
    try {
      const res  = await fetch('songs.json');
      const data = await res.json();

      // Ordem alfabética — usada na aba "ver todas"
      allSongs = data.sort((a, b) =>
        (a.title || '').localeCompare(b.title || '')
      );

      // Ordem por data de edição — usada na aba Início
      recentSongs = [...data].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

      // Configura o Fuse.js para busca por título, artista e letra
      fuse = new Fuse(allSongs, {
        keys: ['title', 'artist', 'lyrics'],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true
      });

      syncView();
    } catch (err) {
      console.error('Falha ao carregar songs.json', err);
      songList.innerHTML = '<p style="padding:1rem;color:var(--danger)">Erro ao carregar músicas.</p>';
    }
  }

  /* const selectFontUi = document.getElementById("font-ui");

  selectFontUi.addEventListener("change", () => {
      document.documentElement.style.setProperty(
          "--font-ui",
          selectFontUi.value
      );
  }); */

  // Debounce simples: só executa a busca depois que o usuário parar de digitar por 150ms
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const debouncedSearch = debounce(onSearch, 150);

  //Eventos globais 
  searchInput.addEventListener('input', debouncedSearch);
  btnShowAll.addEventListener('click', onShowAll);
  window.addEventListener('favoritesChanged', onSearch); // disparado pelo song.js ao favoritar
  window.addEventListener('popstate', syncView);         // disparado ao usar o botão voltar do browser

  init();
})();

// VERSIONAMENTO — lê a versão do sw.js e exibe na navbar =========================================

async function loadAppVersion() {
  const res   = await fetch('./sw.js');
  const text  = await res.text();
  const match = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  if (match) {
    document.getElementById('app-version').textContent = `v${match[1]}`;
    document.getElementById('opencifras-version').textContent = `v${match[1]}`;
    document.getElementById('chordsheetjs-version').textContent = `v${ChordSheetJS.version}`;
  }
}
loadAppVersion();