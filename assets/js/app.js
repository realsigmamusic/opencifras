(function () {
  'use strict';

  // Dados carregados do songs.json 
  let officialSongs    = [];    // só o que veio do songs.json (sem as cifras locais)
  let allSongs         = [];    // acervo oficial + cifras locais, em ordem alfabética
  let recentSongs      = [];    // as mesmas músicas, ordenadas pela data de edição
  let showingAll       = false; // controla se estamos mostrando todas ou só as 5 recentes
  let fuse             = null;  // motor de busca fuzzy (Fuse.js)

  // Estado dos filtros combinados
  let activeFilters = {
    chords: '',
    time: ''
  };

  // ===============================================================================================
  // BANNERS DA HOME (carrossel)
  // ===============================================================================================
  const HOME_BANNERS = [
    {
      image: 'assets/banner1.webp',
      link:  'https://wa.me/5575999674176',
      alt:   'Anúncio: Escola de Música Real Sigma Música - fale conosco pelo WhatsApp'
    },
    {
      image: 'assets/banner2.webp',
      link:  'https://wa.me/5575999674176',
      alt:   'Anúncio: Anuncie aqui! - fale conosco pelo WhatsApp'
    }
  ];
  const BANNER_AUTOPLAY_MS = 6000;

  // Elementos da tela inicial 
  const searchInput      = document.getElementById('search-input');
  const songList         = document.getElementById('song-list');
  const favoritesList    = document.getElementById('favorites-list');
  const favoritesSection = document.getElementById('favorites-section');
  const allSongsSection  = document.getElementById('all-songs-section');
  const noResults        = document.getElementById('no-results');
  const btnShowAll       = document.getElementById('btn-show-all');
  
  // Elementos do Modal de Filtros
  const btnsOpenFilter       = document.querySelectorAll('.btn-filter');
  const elFilterOverlay      = document.getElementById('filter-overlay');
  const elFilterSelectChords = document.getElementById('filter-select-chords');
  const elFilterSelectTime   = document.getElementById('filter-select-time');
  const elFilterClose        = document.getElementById('filter-close');
  const elFilterClear        = document.getElementById('filter-clear');
  const elFilterApply        = document.getElementById('filter-apply');

  // Chaves do localStorage 
  const FAVORITES_KEY = 'chordsheets_favorites';
  const THEME_KEY      = 'chordsheets_theme';
  const FONT_KEY       = 'chordsheets_font';
  const CHORD_COLOR_KEY = 'chordsheets_chord_color';

  const CHORD_COLOR_PRESETS = {
    blue:   { light: '#0d6efd', dark: '#6ea8fe' },
    green:  { light: '#198754', dark: '#4ade80' },
    orange: { light: '#b45309', dark: '#fbbf24' },
    red:    { light: '#dc3545', dark: '#f87171' },
    purple: { light: '#7c3aed', dark: '#c084fc' }
  };

  const LIMIT_HOME = 7;

  // UTILITÁRIOS ==================================================================================

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

  function renderCard(song) {
    const url = '?file=' + encodeURIComponent(song.file)
      + (song.chordCount !== undefined ? '&chords=' + song.chordCount : '');
    return '<a href="' + url + '" class="song-item">'
      + '<div class="song-card-content">'
      +   '<h1 class="song-card-title">'  + escapeHtml(song.title)
      +     (song.isLocal ? ' <span class="song-card-badge" title="Cifra importada/criada por você, salva só neste aparelho">Local</span>' : '')
      +   '</h1>'
      +   '<span class="song-card-artist">' + escapeHtml(song.artist) + '</span>'
      + '</div>'
      + '</a>';
  }

  // FILTROS AVANÇADOS ============================================================================

  // Aplica todos os filtros ativos combinados sobre uma lista de músicas
  function applyFilters(songs) {
    return songs.filter(s => {
      let matchChords = true;
      let matchTime = true;

      if (activeFilters.chords !== '') {
        matchChords = s.chordCount === Number(activeFilters.chords);
      }
      if (activeFilters.time !== '') {
        matchTime = s.time === activeFilters.time;
      }

      return matchChords && matchTime;
    });
  }

  // Preenche os selects do modal apenas com os valores existentes no acervo atual
  function populateFilterModal(songs) {
    const uniqueChords = [...new Set(songs.map(s => s.chordCount).filter(c => c !== undefined))].sort((a, b) => a - b);
    const uniqueTimes = [...new Set(songs.map(s => s.time).filter(t => t))].sort((a, b) => a.localeCompare(b));

    if(elFilterSelectChords) {
      elFilterSelectChords.innerHTML = '<option value="">Todos</option>' + 
        uniqueChords.map(c => `<option value="${c}">${c} acorde${c === 1 ? '' : 's'}</option>`).join('');
      elFilterSelectChords.value = activeFilters.chords;
    }
      
    if(elFilterSelectTime) {
      elFilterSelectTime.innerHTML = '<option value="">Todas</option>' + 
        uniqueTimes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      elFilterSelectTime.value = activeFilters.time;
    }
  }

  // Controles do Modal de Filtros
  btnsOpenFilter.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Verifica se estamos na aba de favoritos ou na home para popular o modal apenas com as opções disponíveis
      const isFavorites = document.getElementById('favorites-section').style.display !== 'none';
      const baseSongs = isFavorites ? allSongs.filter(s => getSavedFavorites().includes(s.file)) : allSongs;
      
      populateFilterModal(baseSongs);
      if(elFilterOverlay) elFilterOverlay.style.display = 'flex';
    });
  });

  if(elFilterClose) {
    elFilterClose.addEventListener('click', () => { elFilterOverlay.style.display = 'none'; });
  }

  if(elFilterOverlay) {
    elFilterOverlay.addEventListener('click', (e) => { 
      if (e.target === elFilterOverlay) elFilterOverlay.style.display = 'none'; 
    });
  }

  if(elFilterClear) {
    elFilterClear.addEventListener('click', () => {
      activeFilters = { chords: '', time: '' };
      elFilterSelectChords.value = '';
      elFilterSelectTime.value = '';
    });
  }

  if(elFilterApply) {
    elFilterApply.addEventListener('click', () => {
      activeFilters.chords = elFilterSelectChords.value;
      activeFilters.time = elFilterSelectTime.value;
      elFilterOverlay.style.display = 'none';
      
      // Atualiza o destaque do botão de filtro se houver algum ativo
      const hasActiveFilters = activeFilters.chords !== '' || activeFilters.time !== '';
      btnsOpenFilter.forEach(btn => btn.classList.toggle('active', hasActiveFilters));

      refreshVisibleFilteredSection();
    });
  }

  // Reaplica a busca/lista certa dependendo de qual aba está visível no momento
  function refreshVisibleFilteredSection() {
    const isFavoritesTabOpen = document.getElementById('favorites-section').style.display !== 'none';

    if (isFavoritesTabOpen) {
      renderFavoritesSection();
    } else {
      onSearch();
    }
  }

  // RENDERIZAÇÃO DAS SEÇÕES ======================================================================

  function renderFavoritesSection() {
    const saved            = getSavedFavorites();
    const allFavoriteSongs = allSongs.filter(s => saved.includes(s.file));

    if (allFavoriteSongs.length === 0) {
      favoritesSection.style.display = 'none';
      return;
    }

    favoritesSection.style.display = 'block';
    
    // Aplica os filtros combinados antes de renderizar
    const filtered = applyFilters(allFavoriteSongs);

    favoritesList.innerHTML = filtered.length
      ? filtered.map(s => renderCard(s)).join('')
      : '<p style="padding:1rem;color:var(--tertiary-color);text-align:center;">Nenhum favorito com esse filtro.</p>';
  }

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

    const toShow = (showLimited && !showingAll && songs.length > LIMIT_HOME)
      ? songs.slice(0, LIMIT_HOME)
      : songs;

    songList.innerHTML = toShow.map(s => renderCard(s)).join('');

    if (showLimited && !showingAll && songs.length > LIMIT_HOME) {
      btnShowAll.style.display  = 'block';
      btnShowAll.textContent    = `Ver todas as ${songs.length} músicas`;
    } else {
      btnShowAll.style.display  = 'none';
    }
  }

  function renderArtistsSection() {
    const artistsEl = document.getElementById('artists-list');
    const artists   = {};

    allSongs.forEach(s => {
      if (!s.artist) return;
      s.artist.split(',').map(a => a.trim()).filter(Boolean).forEach(name => {
        if (!artists[name]) artists[name] = [];
        artists[name].push(s);
      });
    });

    const sorted = Object.keys(artists).sort((a, b) => a.localeCompare(b));

    artistsEl.innerHTML = sorted.map(artist => {
      const count = artists[artist].length;
      return `
        <div class="artist-item" data-artist="${escapeHtml(artist)}">
          <span class="artist-name">${escapeHtml(artist)}</span>
          <sup class="artist-song-count">${count}</sup>
        </div>
      `;
    }).join('');

    artistsEl.querySelectorAll('.artist-item').forEach(el => {
      el.addEventListener('click', () => renderArtistSongs(el.dataset.artist));
    });
  }

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

  function onSearch() {
    const query = searchInput.value.trim();
    document.getElementById('all-songs-title').textContent = query ? 'Resultados da busca' : showingAll ? 'Todas as músicas' : 'Músicas recentes';

    if (!query) {
      showingAll = false;
      renderList(applyFilters(recentSongs), true);
      return;
    }

    showingAll = false;
    renderList(applyFilters(fuse.search(query).map(r => r.item)), false);
  }

  function onShowAll() {
    showingAll = true;
    btnShowAll.style.display = 'none';
    document.getElementById('all-songs-title').textContent = 'Todas as músicas';
    renderList(applyFilters(allSongs), false);
    window.scrollTo(0, 0);
  }

  // MINHAS CIFRAS (importar/criar/editar cifras locais) =========================================

  const elBtnAddSong       = document.getElementById('nav-add');
  const elBtnBannerClose   = document.getElementById('home-banner-close');
  const elBannerSection    = document.getElementById('home-banner-section');
  const elBannerTrack      = document.getElementById('home-banner-track');
  const elBannerDots       = document.getElementById('home-banner-dots');
  const elThemeSelect      = document.getElementById('theme-select');
  const elFontSelect       = document.getElementById('font-select');
  const elChordColorSelect = document.getElementById('chord-color-select');
  const elMetaThemeColor   = document.getElementById('meta-theme-color');

  const elEditorOverlay    = document.getElementById('cho-editor-overlay');
  const elEditorTitle      = document.getElementById('cho-editor-title');
  const elEditorTextarea   = document.getElementById('cho-editor-textarea');
  const elEditorError      = document.getElementById('cho-editor-error');
  const elEditorFileInput  = document.getElementById('cho-editor-file-input');
  const elEditorPickFile   = document.getElementById('cho-editor-pick-file');
  const elEditorSave       = document.getElementById('cho-editor-save');
  const elEditorCancel     = document.getElementById('cho-editor-cancel');
  const elEditorClose      = document.getElementById('cho-editor-close');
  const elEditorDelete     = document.getElementById('cho-editor-delete');

  let editingId = null;

  function openEditor(id) {
    editingId = id || null;
    elEditorError.style.display = 'none';
    elEditorError.textContent   = '';

    if (editingId) {
      const raw = window.LocalSongs.get(editingId);
      elEditorTitle.textContent  = 'Editar cifra';
      elEditorTextarea.value     = raw ? raw.content : '';
      elEditorDelete.style.display = 'inline-block';
    } else {
      elEditorTitle.textContent  = 'Nova cifra';
      elEditorTextarea.value     = '';
      elEditorDelete.style.display = 'none';
    }

    elEditorOverlay.style.display = 'flex';
    elEditorTextarea.focus();
  }

  function closeEditor() {
    elEditorOverlay.style.display = 'none';
    editingId = null;
  }

  elEditorPickFile.addEventListener('click', () => elEditorFileInput.click());
  elEditorFileInput.addEventListener('change', () => {
    const file = elEditorFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { elEditorTextarea.value = String(reader.result || ''); };
    reader.onerror = () => { elEditorError.textContent = 'Não foi possível ler esse arquivo.'; elEditorError.style.display = 'block'; };
    reader.readAsText(file);
    elEditorFileInput.value = ''; 
  });

  elEditorSave.addEventListener('click', () => {
    const text = elEditorTextarea.value;

    if (!text.trim()) {
      elEditorError.textContent   = 'Cole ou digite o conteúdo da cifra antes de salvar.';
      elEditorError.style.display = 'block';
      return;
    }

    try {
      new ChordSheetJS.ChordProParser().parse(text);
    } catch (e) {
      elEditorError.textContent   = 'Não consegui interpretar esse texto como ChordPro. Confira a formatação (acordes entre colchetes, ex: [C]) e tente de novo.';
      elEditorError.style.display = 'block';
      return;
    }

    window.LocalSongs.save(editingId, text);
    closeEditor();
  });

  elEditorDelete.addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('Excluir esta cifra local? Essa ação não pode ser desfeita.')) {
      window.LocalSongs.remove(editingId);
      closeEditor();
    }
  });

  elEditorCancel.addEventListener('click', closeEditor);
  elEditorClose.addEventListener('click', closeEditor);
  elEditorOverlay.addEventListener('click', (e) => { if (e.target === elEditorOverlay) closeEditor(); });

  elBtnAddSong.addEventListener('click', () => openEditor(null));

  window.openChoEditor = openEditor;

  window.addEventListener('localSongsChanged', () => {
    rebuildCatalog();
    refreshVisibleFilteredSection();
  });

  // NAVEGAÇÃO POR ABAS (bottom nav) ==============================================================

  const navItems = document.querySelectorAll('.bottom-nav-item');

  function setActiveNav(id) {
    navItems.forEach(i => i.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function showTab(tab) {
    document.getElementById('search-section').style.display    = tab === 'inicio'    ? 'block' : 'none';
    document.getElementById('all-songs-section').style.display = tab === 'inicio'    ? 'block' : 'none';
    document.getElementById('artists-section').style.display   = tab === 'artistas'  ? 'block' : 'none';
    document.getElementById('favorites-section').style.display = tab === 'favoritos' ? 'block' : 'none';
    document.getElementById('no-results').style.display        = 'none';
  }

  document.getElementById('nav-inicio').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
  });

  document.getElementById('nav-artistas').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
    setActiveNav('nav-artistas');
    showTab('artistas');
    renderArtistsSection();
  });

  document.getElementById('nav-favoritos').addEventListener('click', () => {
    window.history.pushState({}, '', '?');
    syncView();
    setActiveNav('nav-favoritos');
    showTab('favoritos');
    renderFavoritesSection();
  });

  const elSettingsOverlay = document.getElementById('settings-overlay');
  const elSettingsClose   = document.getElementById('settings-close');

  function openSettingsModal() { elSettingsOverlay.style.display = 'flex'; }
  function closeSettingsModal() { elSettingsOverlay.style.display = 'none'; }

  document.getElementById('nav-config').addEventListener('click', openSettingsModal);
  elSettingsClose.addEventListener('click', closeSettingsModal);
  elSettingsOverlay.addEventListener('click', (e) => { if (e.target === elSettingsOverlay) closeSettingsModal(); });

  // CONTROLE DE TELA (home vs. cifra aberta) =====================================================

  function syncView() {
    const songCountLabel = document.getElementById('song-count');
    const songControls   = document.getElementById('song-controls');
    const navbarBrand    = document.getElementById('navbar-brand');
    const params         = new URLSearchParams(window.location.search);

    if (params.has('file')) {
      document.getElementById('home-view').style.display = 'none';
      document.getElementById('song-view').style.display = 'block';
      if (songControls)   songControls.style.display   = 'flex';
      if (songCountLabel) songCountLabel.style.display = 'none';
    } else {
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

  function rebuildCatalog() {
    const merged = officialSongs.concat(window.LocalSongs.list());

    allSongs = merged.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    recentSongs = [...merged].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    fuse = new Fuse(allSongs, {
      keys: ['title', 'artist', 'lyrics'],
      threshold: 0.35,
      minMatchCharLength: 2,
      ignoreLocation: true
    });
  }

  // INICIALIZAÇÃO ================================================================================

  async function init() {
    try {
      const res  = await fetch('songs.json');
      officialSongs = await res.json();

      rebuildCatalog();
      syncView();
    } catch (err) {
      console.error('Falha ao carregar songs.json', err);
      songList.innerHTML = '<p style="padding:1rem;color:var(--danger)">Erro ao carregar músicas.</p>';
    }
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const debouncedSearch = debounce(onSearch, 150);

  searchInput.addEventListener('input', debouncedSearch);
  btnShowAll.addEventListener('click', onShowAll);
  window.addEventListener('favoritesChanged', () => {
    // Se estivemos na aba favoritos, renderiza novamente lá. Se não, faz a busca
    refreshVisibleFilteredSection();
  });
  window.addEventListener('popstate', syncView);

  // ---------- Tema manual ----------
  const THEME_LIGHT_BG = '#e9ecef';
  const THEME_DARK_BG  = '#343a40';
  const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function isEffectivelyDark(value) {
    if (value === 'dark') return true;
    if (value === 'light') return false;
    return !!(systemDarkQuery && systemDarkQuery.matches);
  }

  function applyTheme(value) {
    if (value === 'light' || value === 'dark') {
      document.documentElement.setAttribute('data-theme', value);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (elMetaThemeColor) {
      elMetaThemeColor.setAttribute('content', isEffectivelyDark(value) ? THEME_DARK_BG : THEME_LIGHT_BG);
    }
  }

  function getSavedTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
  }

  const initialTheme = getSavedTheme();
  if (elThemeSelect) elThemeSelect.value = initialTheme;
  applyTheme(initialTheme);

  if (elThemeSelect) {
    elThemeSelect.addEventListener('change', () => {
      const value = elThemeSelect.value;
      try { localStorage.setItem(THEME_KEY, value); } catch (e) {}
      applyTheme(value);
      applyChordColor(getSavedChordColor());
    });
  }

  if (systemDarkQuery) {
    systemDarkQuery.addEventListener('change', () => {
      if (getSavedTheme() === 'auto') {
        applyTheme('auto');
        applyChordColor(getSavedChordColor());
      }
    });
  }

  // ---------- Fonte ----------
  function applyFont(value) {
    document.documentElement.style.setProperty('--font-ui', value);
    document.documentElement.style.setProperty('--font-song', value);
  }

  function getSavedFont() {
    try { return localStorage.getItem(FONT_KEY) || 'sans-serif'; } catch (e) { return 'sans-serif'; }
  }

  const initialFont = getSavedFont();
  if (elFontSelect) elFontSelect.value = initialFont;
  applyFont(initialFont);

  if (elFontSelect) {
    elFontSelect.addEventListener('change', () => {
      const value = elFontSelect.value;
      try { localStorage.setItem(FONT_KEY, value); } catch (e) {}
      applyFont(value);
    });
  }

  // ---------- Cor do acorde ----------
  function applyChordColor(key) {
    const preset = CHORD_COLOR_PRESETS[key];
    if (!preset) {
      document.documentElement.style.removeProperty('--chord-color');
      return;
    }
    const value = isEffectivelyDark(getSavedTheme()) ? preset.dark : preset.light;
    document.documentElement.style.setProperty('--chord-color', value);
  }

  function getSavedChordColor() {
    try { return localStorage.getItem(CHORD_COLOR_KEY) || 'default'; } catch (e) { return 'default'; }
  }

  const initialChordColor = getSavedChordColor();
  if (elChordColorSelect) elChordColorSelect.value = initialChordColor;
  applyChordColor(initialChordColor);

  if (elChordColorSelect) {
    elChordColorSelect.addEventListener('change', () => {
      const value = elChordColorSelect.value;
      try { localStorage.setItem(CHORD_COLOR_KEY, value); } catch (e) {}
      applyChordColor(value);
    });
  }

  // ---------- Carrossel de banners ----------
  function initBannerCarousel() {
    if (!elBannerSection || !elBannerTrack || !HOME_BANNERS.length) {
      if (elBannerSection) elBannerSection.style.display = 'none';
      return;
    }

    let current      = 0;
    let autoplayTimer = null;

    elBannerTrack.innerHTML = HOME_BANNERS.map(b => `
      <a href="${b.link}" class="home-banner-slide" target="_blank" rel="noopener">
        <img src="${b.image}" alt="${escapeHtml(b.alt || '')}" class="home-banner-photo" loading="lazy">
      </a>
    `).join('');

    const showDots = HOME_BANNERS.length > 1;
    if (elBannerDots) {
      elBannerDots.style.display = showDots ? 'flex' : 'none';
      if (showDots) {
        elBannerDots.innerHTML = HOME_BANNERS.map((_, i) =>
          `<button class="home-banner-dot" data-index="${i}" aria-label="Ver anúncio ${i + 1}"></button>`
        ).join('');
      }
    }
    const dotEls = elBannerDots ? Array.from(elBannerDots.querySelectorAll('.home-banner-dot')) : [];

    function goTo(index) {
      current = (index + HOME_BANNERS.length) % HOME_BANNERS.length;
      elBannerTrack.style.transform = `translateX(-${current * 100}%)`;
      dotEls.forEach((dot, i) => dot.classList.toggle('active', i === current));
    }

    function startAutoplay() {
      if (!showDots) return;
      stopAutoplay();
      autoplayTimer = setInterval(() => goTo(current + 1), BANNER_AUTOPLAY_MS);
    }
    function stopAutoplay() {
      if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
    }

    dotEls.forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(Number(dot.dataset.index));
        startAutoplay(); 
      });
    });

    let touchStartX = null;
    elBannerTrack.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      stopAutoplay();
    }, { passive: true });
    elBannerTrack.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 40) goTo(current + (deltaX < 0 ? 1 : -1));
      touchStartX = null;
      startAutoplay();
    });

    elBannerSection.addEventListener('mouseenter', stopAutoplay);
    elBannerSection.addEventListener('mouseleave', startAutoplay);

    if (elBtnBannerClose) {
      elBtnBannerClose.addEventListener('click', () => {
        stopAutoplay();
        elBannerSection.style.display = 'none';
      });
    }

    goTo(0);
    startAutoplay();
  }

  initBannerCarousel();
  init();
})();

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