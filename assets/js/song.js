/* ── Parâmetros da URL ── */
const params = new URLSearchParams(location.search);
const fileUrl = params.get('file');
const titleParam  = params.get('title')  || '';
const artistParam = params.get('artist') || '';
const keyParam    = params.get('key')    || '';
const transposeParam = params.get('transpose');

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
const elBtnFavorite = document.getElementById('btn-offline');
const elBtnShare  = document.getElementById('btn-share');
const elBtnDl     = document.getElementById('btn-download');
const elBtnFontDown = document.getElementById('btn-font-down');
const elBtnFontUp   = document.getElementById('btn-font-up');
const elFontDisp    = document.getElementById('font-size-display');

/* ── Estado ── */
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26];
const FONT_KEY   = 'chordsheets_fontsize';
const TRANS_KEY  = `chordsheets_transpose_${fileUrl}`;
const FAVORITES_KEY = 'chordsheets_favorites';

let song      = null;
let transpose = 0;
let fontIdx   = 3;

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

/* ── Gerenciar Favoritos ── */
function getSavedFavorites() {
  const saved = localStorage.getItem(FAVORITES_KEY);
  return saved ? JSON.parse(saved) : [];
}

function isFavorite() {
  return getSavedFavorites().includes(fileUrl);
}

function toggleFavorite() {
  const saved = getSavedFavorites();
  const index = saved.indexOf(fileUrl);
  
  if (index > -1) {
    saved.splice(index, 1);
    elBtnFavorite.textContent = 'Favoritar';
  } else {
    saved.push(fileUrl);
    elBtnFavorite.textContent = 'Desfavoritar';
  }
  
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(saved));
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
}

elBtnUp.addEventListener('click',    () => { transpose++; saveTransposePref(); updateUrlParams(); renderSheet(); });
elBtnDown.addEventListener('click',  () => { transpose--; saveTransposePref(); updateUrlParams(); renderSheet(); });
elTransVal.addEventListener('click', () => { transpose = 0; saveTransposePref(); updateUrlParams(); renderSheet(); });

/* ── Favoritar ── */
elBtnFavorite.addEventListener('click', toggleFavorite);

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

if (!fileUrl) {
  showError('Nenhuma música especificada.');
} else {
  document.title = titleParam + '';
  loadFontPref();
  loadTransposePref();

  fetch(fileUrl)
    .then(r => {
      if (!r.ok) throw new Error(`Arquivo não encontrado: ${fileUrl}`);
      return r.text();
    })
    .then(text => {
      const parser = new ChordSheetJS.ChordProParser();
      song = parser.parse(text);

      renderMetadata(song);

      const blob = new Blob([text], { type: 'text/plain' });
      elBtnDl.href     = URL.createObjectURL(blob);
      elBtnDl.download = fileUrl.split('/').pop() || 'cifra.cho';

      renderSheet();
      showContent();
      
      // Atualiza estado do botão
      if (isFavorite()) {
        elBtnFavorite.textContent = 'Desfavoritar';
      } else {
        elBtnFavorite.textContent = 'Favoritar';
      }
    })
    .catch(err => showError(err.message));
}