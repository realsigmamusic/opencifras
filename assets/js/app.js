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
  const allSongsSection = document.getElementById('all-songs-section');
  const noResults   = document.getElementById('no-results');
  const songCount   = document.getElementById('song-count');
  const btnShowAll  = document.getElementById('btn-show-all');

  const FAVORITES_KEY = 'chordsheets_favorites';
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
    const url = 'song.html?file=' + encodeURIComponent(song.file);
    const keyBadge = song.key
      ? '<span class="song-card-key">' + escapeHtml(song.key) + '</span>'
      : '';

    return '<a href="' + url + '" class="song-item">'
      +   '<div class="song-card-content">'
      +     '<h1 class="song-card-title">' + escapeHtml(song.title) + '</h1>'
      +     '<span class="song-card-artist">' + escapeHtml(song.artist) + '</span>'
      +   '</div>'
      +   '<div class="song-card-meta">'
      +     keyBadge
      +   '</div>'
      + '</a>';
  }

  function renderFavoritesSection() {
    const saved = getSavedFavorites();
    const favoriteSongs = allSongs.filter(s => saved.includes(s.file));

    if (favoriteSongs.length === 0) {
      favoritesSection.style.display = 'none';
    } else {
      favoritesSection.style.display = 'block';
      favoritesList.innerHTML = favoriteSongs.map(s => renderCard(s, true)).join('');
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

    songList.innerHTML = toShow.map(s => renderCard(s, isFavorite(s.file))).join('');

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
      renderList(recentSongs, true);
      return;
    }
    showingAll = false;
    favoritesSection.style.display = 'none';
    renderList(fuse.search(query).map(function (r) { return r.item; }), false);
  }

  function onShowAll() {
    showingAll = true;
    btnShowAll.style.display = 'none';
    renderList(allSongs, false);
    window.scrollTo(0, 0);
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
      songCount.textContent = n + ' música' + (n !== 1 ? 's' : '');

      fuse = new Fuse(allSongs, {
        keys: ['title', 'artist', 'lyrics'],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true
      });

      renderFavoritesSection();
      renderList(recentSongs, true);
    } catch (err) {
      console.error('Falha ao carregar songs.json', err);
      songList.innerHTML = '<p style="padding:1rem;color:var(--danger)">Erro ao carregar músicas.</p>';
    }
  }

  searchInput.addEventListener('input', onSearch);
  btnShowAll.addEventListener('click', onShowAll);
  init();
})();