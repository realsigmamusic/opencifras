/* ── Parâmetros da URL ── */
const params = new URLSearchParams(location.search);
const fileUrl = params.get('file');
const titleParam  = params.get('title')  || '';
const artistParam = params.get('artist') || '';
const keyParam    = params.get('key')    || '';

/* ── Elementos ── */
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
const elBtnReset  = document.getElementById('btn-reset');
const elBtnShare  = document.getElementById('btn-share');
const elBtnDl     = document.getElementById('btn-download');
const elBtnFontDown = document.getElementById('btn-font-down');
const elBtnFontUp   = document.getElementById('btn-font-up');
const elFontDisp    = document.getElementById('font-size-display');

/* ── Estado ── */
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26];
const FONT_KEY   = 'chordsheets_fontsize';
const TRANS_KEY  = `chordsheets_transpose_${fileUrl}`;

let song      = null;   // ChordSheetJS Song object
let transpose = 0;
let fontIdx   = 4;      // índice padrão = 16px

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
  document.documentElement.style.setProperty('--chord-size', size + 'px');
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
  const saved = localStorage.getItem(TRANS_KEY);
  if (saved !== null) transpose = Number(saved) || 0;
}

function saveTransposePref() {
  localStorage.setItem(TRANS_KEY, transpose);
}

function renderSheet() {
  if (!song) return;

  const transposed = song.transpose(transpose);
  const formatter  = new ChordSheetJS.HtmlDivFormatter();
  elSheet.innerHTML = formatter.format(transposed);

  elTransVal.textContent = (transpose >= 0 ? '+' : '') + transpose;

  // Calcula tom atual a partir do keyParam
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

elBtnUp.addEventListener('click',    () => { transpose++; saveTransposePref(); renderSheet(); });
elBtnDown.addEventListener('click',  () => { transpose--; saveTransposePref(); renderSheet(); });
elBtnReset.addEventListener('click', () => { transpose = 0; saveTransposePref(); renderSheet(); });

/* ── Compartilhar ── */
elBtnShare.addEventListener('click', async () => {
  const shareData = {
    title: titleParam,
    text:  `${titleParam}${artistParam ? ' - ' + artistParam : ''}`,
    url:   location.href,
  };
  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(location.href);
      elBtnShare.textContent = 'Link copiado!';
      setTimeout(() => elBtnShare.textContent = '⬆ Compartilhar', 2000);
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

      // Download do arquivo original
      const blob = new Blob([text], { type: 'text/plain' });
      elBtnDl.href     = URL.createObjectURL(blob);
      elBtnDl.download = fileUrl.split('/').pop() || 'cifra.cho';

      renderSheet();
      showContent();
    })
    .catch(err => showError(err.message));
}
