(function () {
  'use strict';

  const elLoading   = document.getElementById('loading-msg');
  const elError     = document.getElementById('error-msg');
  const elErrorText = document.getElementById('error-text');
  const elContent   = document.getElementById('song-content');
  const elToolbar   = document.getElementById('toolbar');
  const elTitle     = document.getElementById('song-title');
  const elArtist    = document.getElementById('song-artist');
  const elKeyBadge  = document.getElementById('song-key-display');
  const elSheet     = document.getElementById('chord-sheet');
  const elTransVal  = document.getElementById('transpose-value');
  const elKeyLabel  = document.getElementById('current-key-label');
  const btnUp       = document.getElementById('btn-up');
  const btnDown     = document.getElementById('btn-down');
  const btnReset    = document.getElementById('btn-reset');
  const btnShare    = document.getElementById('btn-share');
  const btnDownload = document.getElementById('btn-download');

  let song        = null;
  let transpose   = 0;
  let fileUrl     = '';
  let originalKey = '';

  const params = new URLSearchParams(location.search);
  fileUrl   = params.get('file') || '';
  transpose = parseInt(params.get('t') || '0', 10);
  if (isNaN(transpose)) transpose = 0;

  function updateUrl() {
    const p = new URLSearchParams({ file: fileUrl, t: transpose });
    history.replaceState(null, '', '?' + p.toString());
  }

  function clampTranspose(val) {
    val = ((val % 12) + 12) % 12;
    return val > 6 ? val - 12 : val;
  }

  function render() {
    if (!song) return;
    const target = transpose !== 0 ? song.transpose(transpose) : song;
    elSheet.innerHTML = new ChordSheetJS.HtmlDivFormatter().format(target);
    elTransVal.textContent = transpose > 0 ? '+' + transpose : String(transpose);
    if (originalKey) {
      const newKey = transposeKey(originalKey, transpose);
      elKeyLabel.textContent = newKey !== originalKey
        ? 'Tom: ' + originalKey + ' → ' + newKey
        : 'Tom: ' + originalKey;
    }
  }

  function transposeKey(keyStr, semitones) {
    if (!semitones) return keyStr;
    try {
      const match = keyStr.match(/^([A-G][#b]?)(.*)/);
      if (!match) return keyStr;
      const chord = ChordSheetJS.Chord.parse(match[1]);
      if (!chord) return keyStr;
      return chord.transpose(semitones).toString() + match[2];
    } catch (_) { return keyStr; }
  }

  function showError(msg) {
    elLoading.style.display = 'none';
    elError.style.display   = 'block';
    elErrorText.textContent = msg;
  }

  function showContent() {
    elLoading.style.display = 'none';
    elContent.style.display = 'block';
    elToolbar.style.display = 'flex';
  }

  async function loadSong() {
    if (!fileUrl) { showError('Nenhum arquivo especificado na URL.'); return; }
    let rawText;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rawText = await res.text();
    } catch (err) {
      showError('Não foi possível carregar: ' + fileUrl);
      return;
    }
    try {
      song = new ChordSheetJS.ChordProParser().parse(rawText);
    } catch (err) {
      showError('Erro ao interpretar: ' + (err.message || err));
      return;
    }

    const title  = song.title  || 'Sem título';
    const artist = song.artist || '';
    originalKey  = song.key    || '';

    document.title       = title + (artist ? ' — ' + artist : '');
    elTitle.textContent  = title;
    elArtist.textContent = artist;

    if (originalKey) {
      elKeyBadge.textContent   = 'Tom: ' + originalKey;
      elKeyBadge.style.display = 'inline';
    }

    btnDownload.href     = fileUrl;
    btnDownload.download = fileUrl.split('/').pop() || 'cifra.pro';

    showContent();
    render();
  }

  btnUp.addEventListener('click', function () { transpose = clampTranspose(transpose + 1); updateUrl(); render(); });
  btnDown.addEventListener('click', function () { transpose = clampTranspose(transpose - 1); updateUrl(); render(); });
  btnReset.addEventListener('click', function () { transpose = 0; updateUrl(); render(); });

  btnShare.addEventListener('click', async function () {
    if (navigator.share) {
      try { await navigator.share({ url: location.href, title: document.title }); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(location.href);
        const orig = btnShare.textContent;
        btnShare.textContent = '✓ Copiado!';
        setTimeout(function () { btnShare.textContent = orig; }, 2000);
      } catch (_) {}
    }
  });

  loadSong();
})();

