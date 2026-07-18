(function () {
  'use strict';

  //Dados carregados do songs.json 
  let officialSongs    = [];    // só o que veio do songs.json (sem as cifras locais)
  let allSongs         = [];    // acervo oficial + cifras locais, em ordem alfabética
  let recentSongs      = [];    // as mesmas músicas, ordenadas pela data de edição
  let showingAll       = false; // controla se estamos mostrando todas ou só as 5 recentes
  let chordFilterValue = '';    // '' = sem filtro; caso contrário, número de acordes selecionado
  let fuse             = null;  // motor de busca fuzzy (Fuse.js)

  //Elementos da tela inicial 
  const searchInput      = document.getElementById('search-input');
  const songList         = document.getElementById('song-list');
  const favoritesList    = document.getElementById('favorites-list');
  const favoritesSection = document.getElementById('favorites-section');
  const allSongsSection  = document.getElementById('all-songs-section');
  const noResults        = document.getElementById('no-results');
  const btnShowAll       = document.getElementById('btn-show-all');
  const chordFilterBtns  = document.querySelectorAll('.btn-filter');
  const chordFilterMenus = document.querySelectorAll('.chord-filter-menu');

  //Chaves do localStorage 
  const FAVORITES_KEY = 'chordsheets_favorites';
  const THEME_KEY      = 'chordsheets_theme';
  const FONT_KEY       = 'chordsheets_font';
  const CHORD_COLOR_KEY = 'chordsheets_chord_color';

  // Cada opção tem um tom pra tema claro (mais escuro/saturado, legível no branco) e outro
  // pra tema escuro (mais claro/pastel, legível no fundo escuro) — mesmo padrão que o app já
  // usa em --info-text-emphasis (#055160 no claro / #6edff6 no escuro).
  const CHORD_COLOR_PRESETS = {
    blue:   { light: '#0d6efd', dark: '#6ea8fe' },
    green:  { light: '#198754', dark: '#4ade80' },
    orange: { light: '#b45309', dark: '#fbbf24' },
    red:    { light: '#dc3545', dark: '#f87171' },
    purple: { light: '#7c3aed', dark: '#c084fc' }
  };

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

  // RENDERIZAÇÃO DAS SEÇÕES ======================================================================

  // Mostra as músicas favoritas na aba Favoritos
  function renderFavoritesSection() {
    const saved            = getSavedFavorites();
    const allFavoriteSongs = allSongs.filter(s => saved.includes(s.file));

    if (allFavoriteSongs.length === 0) {
      favoritesSection.style.display = 'none';
      return;
    }

    favoritesSection.style.display = 'block';
    populateFavoritesChordFilterMenu();
    const filtered = applyChordFilter(allFavoriteSongs);

    favoritesList.innerHTML = filtered.length
      ? filtered.map(s => renderCard(s)).join('')
      : '<p style="padding:1rem;color:var(--tertiary-color);text-align:center;">Nenhum favorito com esse filtro.</p>';
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

  // Aplica o filtro por quantidade de acordes sobre uma lista de músicas
  function applyChordFilter(songs) {
    if (chordFilterValue === '') return songs;
    const n = Number(chordFilterValue);
    return songs.filter(s => s.chordCount === n);
  }

  // Lê os valores reais de chordCount existentes no acervo e popula o <select>
  // Monta o HTML de um menu de filtro a partir de uma lista de músicas
  function buildChordFilterHtml(songs) {
    const counts = [...new Set(songs.map(s => s.chordCount).filter(c => c !== undefined))]
      .sort((a, b) => a - b);

    return '<button class="dropdown-item chord-filter-item active" data-value="">Todas as músicas</button>'
      + counts.map(c => `<button class="dropdown-item chord-filter-item" data-value="${c}">${c} acorde${c === 1 ? '' : 's'}</button>`).join('');
  }

  // Liga os cliques de um menu já preenchido
  function bindChordFilterMenu(menu) {
    menu.querySelectorAll('.chord-filter-item').forEach(btn => {
      btn.addEventListener('click', () => {
        chordFilterValue = btn.dataset.value;
        updateChordFilterUI();
        closeAllChordFilterMenus();
        refreshVisibleFilteredSection();
      });
    });
  }

  // Popula o menu da Início com os valores de TODO o acervo
  function populateHomeChordFilterMenu() {
    const menu = document.getElementById('home-chord-filter-menu');
    if (!menu) return;
    menu.innerHTML = buildChordFilterHtml(allSongs);
    bindChordFilterMenu(menu);
    updateChordFilterUI();
  }

  // Popula o menu de Favoritos só com os valores presentes ENTRE os favoritos
  function populateFavoritesChordFilterMenu() {
    const menu = document.getElementById('favorites-chord-filter-menu');
    if (!menu) return;
    const saved  = getSavedFavorites();
    const favSongs = allSongs.filter(s => saved.includes(s.file));
    menu.innerHTML = buildChordFilterHtml(favSongs);
    bindChordFilterMenu(menu);
    updateChordFilterUI();
  }

  // Atualiza o destaque visual do item selecionado e do botão de funil
  function updateChordFilterUI() {
    chordFilterMenus.forEach(menu => {
      menu.querySelectorAll('.chord-filter-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === chordFilterValue);
      });
    });
    chordFilterBtns.forEach(btn => btn.classList.toggle('active', chordFilterValue !== ''));
  }

  function closeAllChordFilterMenus() {
    chordFilterMenus.forEach(menu => menu.classList.remove('open'));
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

  // Abre/fecha o menu de filtro ao clicar no botão de funil
  chordFilterBtns.forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu    = chordFilterMenus[i];
      const wasOpen = menu.classList.contains('open');
      closeAllChordFilterMenus();
      if (!wasOpen) menu.classList.add('open');
    });
  });

  document.addEventListener('click', closeAllChordFilterMenus);

  // BUSCA ========================================================================================

  // Chamada toda vez que o usuário digita na barra de pesquisa
  function onSearch() {
    const query = searchInput.value.trim();
    document.getElementById('all-songs-title').textContent = query ? 'Resultados da busca' : showingAll ? 'Todas as músicas' : 'Músicas recentes';

    if (!query) {
      showingAll = false;
      renderList(applyChordFilter(recentSongs), true);
      return;
    }

    // Com texto: executa a busca fuzzy e mostra resultados
    showingAll = false;
    renderList(applyChordFilter(fuse.search(query).map(r => r.item)), false);
  }

  // Chamado ao clicar em "ver todas as X músicas"
  function onShowAll() {
    showingAll = true;
    btnShowAll.style.display = 'none';
    document.getElementById('all-songs-title').textContent = 'Todas as músicas';
    renderList(applyChordFilter(allSongs), false);
    window.scrollTo(0, 0);
  }

  // MINHAS CIFRAS (importar/criar/editar cifras locais) =========================================

  const elBtnAddSong       = document.getElementById('nav-add');
  const elBtnBannerClose   = document.getElementById('home-banner-close');
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

  let editingId = null; // id da cifra local em edição; null = criando uma nova

  // Abre o editor. id = null → cifra nova; id existente → edita o conteúdo salvo
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

  // Selecionar um arquivo .cho do aparelho só joga o texto dele no campo — não salva sozinho
  elEditorPickFile.addEventListener('click', () => elEditorFileInput.click());
  elEditorFileInput.addEventListener('change', () => {
    const file = elEditorFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { elEditorTextarea.value = String(reader.result || ''); };
    reader.onerror = () => { elEditorError.textContent = 'Não foi possível ler esse arquivo.'; elEditorError.style.display = 'block'; };
    reader.readAsText(file);
    elEditorFileInput.value = ''; // permite selecionar o mesmo arquivo de novo depois
  });

  elEditorSave.addEventListener('click', () => {
    const text = elEditorTextarea.value;

    if (!text.trim()) {
      elEditorError.textContent   = 'Cole ou digite o conteúdo da cifra antes de salvar.';
      elEditorError.style.display = 'block';
      return;
    }

    // Valida que pelo menos dá pra fazer o parse ChordPro antes de salvar
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

  // Exposto globalmente para o song.js poder abrir o editor a partir da tela da cifra
  window.openChoEditor = openEditor;

  // Sempre que uma cifra local muda (criada/editada/excluída), refaz o catálogo e a busca
  window.addEventListener('localSongsChanged', () => {
    rebuildCatalog();
    refreshVisibleFilteredSection();
  });

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

  // Clique em "Configurações": abre por cima da tela atual (Home ou música), sem navegar
  // pra Home — assim, ao fechar, você continua exatamente onde estava.
  const elSettingsOverlay = document.getElementById('settings-overlay');
  const elSettingsClose   = document.getElementById('settings-close');

  function openSettingsModal() { elSettingsOverlay.style.display = 'flex'; }
  function closeSettingsModal() { elSettingsOverlay.style.display = 'none'; }

  document.getElementById('nav-config').addEventListener('click', openSettingsModal);
  elSettingsClose.addEventListener('click', closeSettingsModal);
  elSettingsOverlay.addEventListener('click', (e) => { if (e.target === elSettingsOverlay) closeSettingsModal(); });

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

  // Junta o acervo oficial com as cifras locais e reconstrói ordenação/índice de busca.
  // Chamada no carregamento inicial e sempre que uma cifra local é criada/editada/excluída.
  function rebuildCatalog() {
    const merged = officialSongs.concat(window.LocalSongs.list());

    // Ordem alfabética — usada na aba "ver todas"
    allSongs = merged.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    // Ordem por data de edição — usada na aba Início
    recentSongs = [...merged].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    // Configura o Fuse.js para busca por título, artista e letra
    fuse = new Fuse(allSongs, {
      keys: ['title', 'artist', 'lyrics'],
      threshold: 0.35,
      minMatchCharLength: 2,
      ignoreLocation: true
    });

    populateHomeChordFilterMenu();
  }

  // INICIALIZAÇÃO ================================================================================

  // Carrega o catálogo de músicas e configura a busca
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

  // Fecha o banner só nesta sessão — nada é salvo, então ele volta ao recarregar a página
  if (elBtnBannerClose) {
    elBtnBannerClose.addEventListener('click', () => {
      elBtnBannerClose.closest('.home-banner-section').style.display = 'none';
    });
  }

  // ---------- Tema manual (Configurações > Aparência) ----------
  const THEME_LIGHT_BG = '#e9ecef';
  const THEME_DARK_BG  = '#343a40';
  const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // value: 'auto' | 'light' | 'dark' — retorna se o resultado final é escuro
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
      applyChordColor(getSavedChordColor()); // a cor pode depender do tema (claro/escuro)
    });
  }

  // Em modo "Automático", se o sistema trocar de tema com o app aberto, atualiza a cor da barra de status
  if (systemDarkQuery) {
    systemDarkQuery.addEventListener('change', () => {
      if (getSavedTheme() === 'auto') {
        applyTheme('auto');
        applyChordColor(getSavedChordColor());
      }
    });
  }

  // ---------- Fonte (Configurações > Fonte) ----------
  // Uma única escolha do usuário controla a fonte da interface (--font-ui) e das
  // cifras (--font-song) ao mesmo tempo, já que ele quer as duas iguais.
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

  // ---------- Cor do acorde (Configurações > Aparência) ----------
  // "default" remove o override e deixa a cor voltar a seguir o tema (var(--info-text-emphasis));
  // qualquer outro valor é uma chave de CHORD_COLOR_PRESETS, resolvida pro tom certo (claro/escuro)
  // conforme o tema efetivo atual — por isso salvamos a CHAVE, não o hex, e reaplicamos sempre
  // que o tema mudar (inclusive quando "Sistema" muda sozinho com o app aberto).
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