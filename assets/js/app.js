(function () {
  'use strict';

  let allSongs = [];
  let recentSongs = [];
  let showingAll = false;
  let fuse = null;

  const searchInput = document.getElementById('search-input');
  const songList    = document.getElementById('song-list');
  const favoritesList = document.getElementById('favorites-list');
  const favoritesSection = document.getElementById('favorites-section');
  const setlistSection = document.getElementById('setlist-section');
  const setlistList    = document.getElementById('setlist-list');
  const allSongsSection = document.getElementById('all-songs-section');
  const noResults   = document.getElementById('no-results');
  const btnShowAll  = document.getElementById('btn-show-all');

  const FAVORITES_KEY = 'chordsheets_favorites';
  const SETLIST_KEY   = 'chordsheets_setlist';
  const LIMIT_HOME = 5;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSavedFavorites() {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  function isFavorite(songFile) {
    return getSavedFavorites().includes(songFile);
  }

  function renderCard(song) {
    const url = '?file=' + encodeURIComponent(song.file);

    return '<a href="' + url + '" class="song-item">'
      +   '<div class="song-card-content">'
      +     '<h1 class="song-card-title">' + escapeHtml(song.title) + '</h1>'
      +     '<span class="song-card-artist">' + escapeHtml(song.artist) + '</span>'
      +   '</div>'
      + '</a>';
  }

  function renderSetlistCard(song) {
    // Adiciona o parâmetro origin=setlist para ativar a navegação prev/next
    const html = renderCard(song);
    return html.replace('?file=', '?origin=setlist&file=');
  }

  /* ── Drag-and-drop state ── */
  let dragSrcFile = null;

  function reorderSetlist(fromFile, toFile) {
    const saved = localStorage.getItem(SETLIST_KEY);
    const setlistData = saved ? JSON.parse(saved) : {};
    const files = Object.keys(setlistData);

    const fromIdx = files.indexOf(fromFile);
    const toIdx   = files.indexOf(toFile);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    // Reconstrói o objeto na nova ordem
    files.splice(fromIdx, 1);
    files.splice(toIdx, 0, fromFile);

    const reordered = {};
    for (const f of files) reordered[f] = setlistData[f];

    localStorage.setItem(SETLIST_KEY, JSON.stringify(reordered));
    renderSetlistSection();
    window.dispatchEvent(new CustomEvent('setlistChanged'));
  }

  function renderSetlistSection() {
    const saved = localStorage.getItem(SETLIST_KEY);
    const setlistData = saved ? JSON.parse(saved) : {};
    const files = Object.keys(setlistData);

    if (files.length === 0) {
      setlistSection.style.display = 'none';
      return;
    }

    setlistSection.style.display = 'block';

    setlistList.innerHTML = files.map(url => {
      const song = { ...setlistData[url], file: url };
      // Wrap cada card num container arrastável
      return '<div class="setlist-drag-item" draggable="true" data-file="' + escapeHtml(url) + '">'
        + '<span class="drag-handle" title="Arrastar para reordenar">'
        + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">'
        + '<path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>'
        + '</svg>'
        + '</span>'
        + renderSetlistCard(song)
        + '</div>';
    }).join('');

    // Eventos de drag nos itens recém-renderizados
    setlistList.querySelectorAll('.setlist-drag-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcFile = item.dataset.file;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        setlistList.querySelectorAll('.setlist-drag-item').forEach(i => i.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setlistList.querySelectorAll('.setlist-drag-item').forEach(i => i.classList.remove('drag-over'));
        if (item.dataset.file !== dragSrcFile) item.classList.add('drag-over');
      });

      item.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrcFile && item.dataset.file !== dragSrcFile) {
          reorderSetlist(dragSrcFile, item.dataset.file);
        }
        dragSrcFile = null;
      });
    });
  }

  function renderFavoritesSection() {
    const saved = getSavedFavorites();
    const favoriteSongs = allSongs.filter(s => saved.includes(s.file));

    if (favoriteSongs.length === 0) {
      favoritesSection.style.display = 'none';
    } else {
      favoritesSection.style.display = 'block';
      favoritesList.innerHTML = favoriteSongs.map(s => renderCard(s)).join('');
    }
  }

  function renderList(songs, showLimited = true) {
    if (songs.length === 0) {
      songList.innerHTML = '';
      noResults.style.display = 'block';
      allSongsSection.style.display = 'none';
      btnShowAll.style.display = 'none';
      return;
    }

    noResults.style.display = 'none';
    allSongsSection.style.display = 'block';

    const toShow = (showLimited && !showingAll && songs.length > LIMIT_HOME)
      ? songs.slice(0, LIMIT_HOME)
      : songs;

    songList.innerHTML = toShow.map(s => renderCard(s)).join('');

    if (showLimited && !showingAll && songs.length > LIMIT_HOME) {
      btnShowAll.style.display = 'block';
      btnShowAll.textContent = `Ver todas as ${songs.length} músicas`;
    } else {
      btnShowAll.style.display = 'none';
    }
  }

  function onSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      showingAll = false;
      renderFavoritesSection();
      renderSetlistSection();
      renderList(recentSongs, true);
      return;
    }
    showingAll = false;
    favoritesSection.style.display = 'none';
    setlistSection.style.display = 'none';
    renderList(fuse.search(query).map(function (r) { return r.item; }), false);
  }

  function onShowAll() {
    showingAll = true;
    btnShowAll.style.display = 'none';
    renderList(allSongs, false);
    window.scrollTo(0, 0);
  }

  function syncView() {
    const songCountLabel = document.getElementById('song-count');
    const songControls = document.getElementById('song-controls');
    const navbarBrand = document.getElementById('navbar-brand');
    const params = new URLSearchParams(window.location.search);

    if (params.has('file')) {
      document.getElementById('home-view').style.display = 'none';
      document.getElementById('song-view').style.display = 'block';
      if (songControls) songControls.style.display = 'flex';
      if (songCountLabel) songCountLabel.style.display = 'none';
    } else {
      document.getElementById('home-view').style.display = 'block';
      document.getElementById('song-view').style.display = 'none';
      if (songControls) songControls.style.display = 'none';
      if (songCountLabel) songCountLabel.style.display = 'inline';
      if (navbarBrand) navbarBrand.style.display = 'block';
      onSearch(); // Garante que a lista (favoritos e recentes) esteja atualizada
    }
  }

  async function init() {
    try {
      const res = await fetch('songs.json');
      const data = await res.json();

      // allSongs = ALFABÉTICA (para "ver todas")
      allSongs = data.sort(function (a, b) {
        const titleA = a.title || "";
        const titleB = b.title || "";
        return titleA.localeCompare(titleB);
      });

      // recentSongs = POR DATA (últimas adicionadas/editadas)
      recentSongs = [...data]
        .sort(function (a, b) {
          return (b.mtime || 0) - (a.mtime || 0);
        });

      const n = data.length;

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

  searchInput.addEventListener('input', onSearch);
  btnShowAll.addEventListener('click', onShowAll);
  window.addEventListener('setlistChanged', onSearch);
  window.addEventListener('favoritesChanged', onSearch);
  window.addEventListener('popstate', syncView);
  init();
})();

// Versionamento ==================================================================================
async function loadAppVersion() {
    const res = await fetch('./sw.js');
    const text = await res.text();
    const match = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
    if (match) document.getElementById('app-version').textContent = `v${match[1]}`;
}
loadAppVersion()