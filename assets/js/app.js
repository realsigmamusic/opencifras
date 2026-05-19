/* ─────────────────────────────────────────────
   app.js — Index page
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  let allSongs = [];
  let fuse = null;

  const searchInput = document.getElementById('search-input');
  const songList    = document.getElementById('song-list');
  const noResults   = document.getElementById('no-results');
  const songCount   = document.getElementById('song-count');

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderList(songs) {
    if (songs.length === 0) {
      songList.innerHTML = '';
      noResults.style.display = 'block';
      return;
    }

    noResults.style.display = 'none';

    songList.innerHTML = songs.map(function (song) {
      const url      = 'song.html?file=' + encodeURIComponent(song.file);
      const keyBadge = song.key
        ? '<span class="song-key">' + escapeHtml(song.key) + '</span>'
        : '';

      return '<a href="' + url + '" class="song-item">'
        + '<div>'
        +   '<div class="song-title">' + escapeHtml(song.title) + '</div>'
        +   '<div class="song-artist">' + escapeHtml(song.artist) + '</div>'
        + '</div>'
        + keyBadge
        + '</a>';
    }).join('');
  }

  function onSearch() {
    const query = searchInput.value.trim();
    if (!query) { renderList(allSongs); return; }
    renderList(fuse.search(query).map(function (r) { return r.item; }));
  }

  async function init() {
    try {
      const res = await fetch('songs.json');
      allSongs  = await res.json();

      const n = allSongs.length;
      songCount.textContent = n + ' música' + (n !== 1 ? 's' : '');

      fuse = new Fuse(allSongs, {
        keys: ['title', 'artist'],
        threshold: 0.35,
        minMatchCharLength: 2,
      });

      renderList(allSongs);
    } catch (err) {
      console.error('Falha ao carregar songs.json', err);
      songList.innerHTML = '<p style="padding:1rem;color:var(--danger)">Erro ao carregar músicas.</p>';
    }
  }

  searchInput.addEventListener('input', onSearch);
  init();
})();
