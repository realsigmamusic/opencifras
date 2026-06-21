/* ── Elementos ── */
const elSongHeader = document.getElementById('song-header');
const elKeyLabel  = document.getElementById('current-key-label');
const elTransVal  = document.getElementById('transpose-value');
const elSheet     = document.getElementById('chord-sheet');
const elContent   = document.getElementById('song-content');
const elLoading   = document.getElementById('loading-msg');
const elError     = document.getElementById('error-msg');
const elErrorText = document.getElementById('error-text');
const elToolbar   = document.getElementById('toolbar');
const elBtnDown   = document.getElementById('btn-down');
const elBtnUp     = document.getElementById('btn-up');
const elBtnSetlist  = document.getElementById('btn-setlist');
const elBtnFavorite = document.getElementById('btn-favorite');
const elBtnShare  = document.getElementById('btn-share');
const elBtnDl     = document.getElementById('btn-download');
const elBtnFontDown = document.getElementById('btn-font-down');
const elBtnFontUp   = document.getElementById('btn-font-up');
const elFontDisp    = document.getElementById('font-size-display');
const elNavSection  = document.getElementById('setlist-navigation');
const elNavPrev     = document.getElementById('nav-prev-song');
const elNavNext     = document.getElementById('nav-next-song');

/* ── Estado ── */
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26];
const FONT_KEY   = 'chordsheets_fontsize';
const SETLIST_KEY   = 'chordsheets_setlist';
const FAVORITES_KEY = 'chordsheets_favorites';

/* ── Ícones SVG (Bootstrap) ── */
const ICON_HEART = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/></svg>`;
const ICON_HEART_FILL = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`;

let fileUrl, titleParam, artistParam, keyParam, transposeParam, originParam, TRANS_KEY;
let song      = null;
let transpose = 0;
let fontIdx   = 3;

function updateStateFromUrl() {
  const params = new URLSearchParams(location.search);
  fileUrl = params.get('file');
  titleParam  = params.get('title')  || '';
  artistParam = params.get('artist') || '';
  keyParam    = params.get('key')    || '';
  transposeParam = params.get('transpose');
  originParam = params.get('origin');
  TRANS_KEY = `chordsheets_transpose_${fileUrl}`;
}

/* ── Tamanho de fonte ── */
function loadFontPref() {
  const saved = localStorage.getItem(FONT_KEY);
  if (saved !== null) {
    const idx = FONT_SIZES.indexOf(Number(saved));
    if (idx !== -1) fontIdx = idx;
  }
  applyFont();
}

function applyFont() {
  const size = FONT_SIZES[fontIdx];
  if (elSheet) elSheet.style.fontSize = size + 'px';
  elFontDisp.textContent = size;
  localStorage.setItem(FONT_KEY, size);
}

elBtnFontDown.addEventListener('click', () => {
  if (fontIdx > 0) { fontIdx--; applyFont(); }
});
elBtnFontUp.addEventListener('click', () => {
  if (fontIdx < FONT_SIZES.length - 1) { fontIdx++; applyFont(); }
});

/* ── Transpose ── */
function loadTransposePref() {
  if (transposeParam !== null) {
    transpose = Number(transposeParam) || 0;
    saveTransposePref();
  } else {
    const saved = localStorage.getItem(TRANS_KEY);
    if (saved !== null) transpose = Number(saved) || 0;
  }
}

function saveTransposePref() {
  localStorage.setItem(TRANS_KEY, transpose);
}

/* ── Gerenciar Setlist (Offline Total) ── */
function getSetlist() {
  const saved = localStorage.getItem(SETLIST_KEY);
  return saved ? JSON.parse(saved) : {};
}

function isInSetlist() {
  return !!getSetlist()[fileUrl];
}

/* ── Gerenciar Favoritos Clássicos ── */
function getFavorites() {
  const saved = localStorage.getItem(FAVORITES_KEY);
  return saved ? JSON.parse(saved) : [];
}

function updateFavoriteUI() {
  const isFav = getFavorites().includes(fileUrl);
  elBtnFavorite.innerHTML = isFav ? ICON_HEART_FILL : ICON_HEART;
}

function toggleFavorite() {
  const favs = getFavorites();
  const index = favs.indexOf(fileUrl);
  if (index > -1) {
    favs.splice(index, 1);
  } else {
    favs.push(fileUrl);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  updateFavoriteUI();
  window.dispatchEvent(new CustomEvent('favoritesChanged'));
}

async function toggleSetlist() {
  const setlist = getSetlist();

  if (setlist[fileUrl]) {
    delete setlist[fileUrl];
    elBtnSetlist.textContent = 'Setlist';
  } else {
    elBtnSetlist.textContent = 'Salvando...';
    try {
      // Quando salva, garante que temos o conteúdo textual
      const response = await fetch(fileUrl);
      const text = await response.text();
      
      setlist[fileUrl] = {
        title: song?.metadata?.title || titleParam,
        artist: song?.metadata?.artist || artistParam,
        key: song?.metadata?.key || keyParam,
        content: text,
        updatedAt: Date.now()
      };
      elBtnSetlist.textContent = 'Remover';
    } catch (err) {
      alert('Erro ao baixar música para uso offline. Verifique sua conexão.');
      elBtnSetlist.textContent = 'Setlist';
      return;
    }
  }

  localStorage.setItem(SETLIST_KEY, JSON.stringify(setlist));
  window.dispatchEvent(new CustomEvent('setlistChanged'));
}

function setupSetlistNavigation() {
  if (originParam !== 'setlist') {
    elNavSection.style.display = 'none';
    return;
  }

  const setlist = getSetlist();
  const files = Object.keys(setlist);
  const currentIndex = files.indexOf(fileUrl);

  if (currentIndex === -1) {
    elNavSection.style.display = 'none';
    return;
  }

  elNavSection.style.display = 'flex';

  // Botão Anterior
  if (currentIndex > 0) {
    const prevFile = files[currentIndex - 1];
    elNavPrev.href = `?origin=setlist&file=${encodeURIComponent(prevFile)}&title=${encodeURIComponent(setlist[prevFile].title)}&artist=${encodeURIComponent(setlist[prevFile].artist)}`;
    elNavPrev.style.visibility = 'visible';
  } else {
    elNavPrev.style.visibility = 'hidden';
  }

  // Botão Próximo
  if (currentIndex < files.length - 1) {
    const nextFile = files[currentIndex + 1];
    elNavNext.href = `?origin=setlist&file=${encodeURIComponent(nextFile)}&title=${encodeURIComponent(setlist[nextFile].title)}&artist=${encodeURIComponent(setlist[nextFile].artist)}`;
    elNavNext.style.visibility = 'visible';
  } else {
    elNavNext.style.visibility = 'hidden';
  }
}

/* ── Renderiza metadados do ChordPro ── */
function renderMetadata(song) {
  if (!song || !song.metadata) return;

  const meta = song.metadata;
  let html = '';

  if (meta.artist) {
    html += `<span class="song-meta-item"><strong>Artista:</strong> ${escapeHtml(meta.artist)}</span>`;
  }

  if (meta.composer) {
    html += `<span class="song-meta-item"><strong>Compositor:</strong> ${escapeHtml(meta.composer)}</span>`;
  }

  if (meta.album) {
    html += `<span class="song-meta-item"><strong>Álbum:</strong> ${escapeHtml(meta.album)}</span>`;
  }

  if (meta.year) {
    html += `<span class="song-meta-item"><strong>Ano:</strong> ${escapeHtml(meta.year)}</span>`;
  }

  if (meta.copyright) {
    html += `<span class="song-meta-item"><strong>Copyright:</strong> ${escapeHtml(meta.copyright)}</span>`;
  }

  if (meta.key) {
    html += `<span class="song-meta-item"><strong>Tom:</strong> ${escapeHtml(meta.key)}</span>`;
  }
  
  if (meta.time) {
    html += `<span class="song-meta-item"><strong>Compasso:</strong> ${escapeHtml(meta.time)}</span>`;
  }
  
  if (meta.tempo) {
    html += `<span class="song-meta-item"><strong>bpm:</strong> ${escapeHtml(meta.tempo)}</span>`;
  }
  
  elSongHeader.innerHTML = html;
}

/* ── Utilitário ── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateUrlParams() {
  const url = new URL(window.location.href);
  if (transpose !== 0) {
    url.searchParams.set('transpose', transpose);
  } else {
    url.searchParams.delete('transpose');
  }
  window.history.replaceState({}, '', url.toString());
}

function renderSheet() {
  if (!song) return;

  const transposed = song.transpose(transpose);
  const formatter  = new ChordSheetJS.HtmlDivFormatter();
  elSheet.innerHTML = formatter.format(transposed);

  elTransVal.textContent = (transpose >= 0 ? '+' : '') + transpose;

  if (keyParam) {
    try {
      const key = ChordSheetJS.Chord.parse(keyParam);
      if (key) {
        const currentKey = key.transpose(transpose);
        elKeyLabel.textContent = currentKey.toString();
      }
    } catch (_) {
      elKeyLabel.textContent = '';
    }
  }

  // Adiciona a versão do ChordSheetJS como um rodapé
  const footer = document.createElement('div');
  footer.style.marginTop = '2rem';
  footer.style.paddingTop = '0.75rem';
  footer.style.borderTop = '1px solid var(--border-color)';
  footer.style.fontSize = '0.75rem';
  footer.style.color = 'var(--tertiary-color)';
  footer.style.textAlign = 'center';
  footer.style.marginBottom = '1.25rem';
  
  footer.textContent = `ChordSheetJS v${ChordSheetJS.version}`;
  elSheet.appendChild(footer);
}

elBtnUp.addEventListener('click',    () => { transpose++; saveTransposePref(); updateUrlParams(); renderSheet(); });
elBtnDown.addEventListener('click',  () => { transpose--; saveTransposePref(); updateUrlParams(); renderSheet(); });
elTransVal.addEventListener('click', () => { transpose = 0; saveTransposePref(); updateUrlParams(); renderSheet(); });
elBtnFavorite.addEventListener('click', toggleFavorite);

/* ── Favoritar ── */
elBtnSetlist.addEventListener('click', toggleSetlist);

/* ── Compartilhar ── */
elBtnShare.addEventListener('click', async () => {
  // URL injetando o transpose
  const urlObj = new URL(location.href);
  if (transpose !== 0) {
    urlObj.searchParams.set('transpose', transpose);
  } else {
    urlObj.searchParams.delete('transpose'); // Se for o tom original, limpa a URL
  }
  const shareUrl = urlObj.toString();

  // texto da mensagem com Título e Artista
  const titulo = song && song.metadata && song.metadata.title ? song.metadata.title : titleParam;
  const artista = song && song.metadata && song.metadata.artist ? song.metadata.artist : artistParam;
  
  const textoMensagem = `Cifra de ${titulo} - ${artista}`.trim();

  // dados para o compartilhador
  const shareData = {
    title: titulo,
    text: textoMensagem,
    url: shareUrl,
  };

  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${textoMensagem}\n${shareUrl}`);
      elBtnShare.textContent = 'Copiado!';
      setTimeout(() => elBtnShare.textContent = 'Compartilhar', 2000);
    }
  } catch (e) {
    console.warn('share failed', e);
  }
});

/* ── Inicialização ── */
function showError(msg) {
  elLoading.style.display  = 'none';
  elContent.style.display  = 'none';
  elToolbar.style.display  = 'none';
  elError.style.display    = 'block';
  elErrorText.textContent  = msg;
}

function showContent() {
  elLoading.style.display = 'none';
  elError.style.display   = 'none';
  elContent.style.display = 'block';
  elToolbar.style.display = 'block';
}

function initSong() {
  updateStateFromUrl();
  if (!fileUrl) return;

  document.title = titleParam + '';
  loadFontPref();
  loadTransposePref();
  setupSetlistNavigation();
  updateFavoriteUI();

  fetch(fileUrl)
    .then(r => r.text())
    .catch(() => {
      // Fallback para localStorage se a rede falhar
      const setlist = getSetlist();
      if (setlist[fileUrl]) return setlist[fileUrl].content;
      throw new Error(`Música não encontrada offline. Salve-a no repertório enquanto estiver online.`);
    })
    .then(text => {
      if (!text) throw new Error("Conteúdo vazio");
      const parser = new ChordSheetJS.ChordProParser();
      song = parser.parse(text);

      renderMetadata(song);

      const blob = new Blob([text], { type: 'text/plain' });
      elBtnDl.href     = URL.createObjectURL(blob);
      elBtnDl.download = fileUrl.split('/').pop() || 'cifra.cho';

      renderSheet();
      showContent();
      
      // Atualiza estado do botão
      if (isInSetlist()) {
        elBtnSetlist.textContent = 'Remover'; // remover
      } else {
        elBtnSetlist.textContent = 'Setlist'; // salvar
      }
    })
    .catch(err => showError(err.message));
}

window.addEventListener('popstate', initSong);
initSong();