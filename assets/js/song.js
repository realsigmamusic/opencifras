// Elementos da tela da cifra 
const elSongHeader    = document.getElementById('song-header');
const elTransVal      = document.getElementById('transpose-value');
const elSheet         = document.getElementById('chord-sheet');
const elContent       = document.getElementById('song-content');
const elLoading       = document.getElementById('loading-msg');
const elError         = document.getElementById('error-msg');
const elErrorText     = document.getElementById('error-text');
const elBtnDown       = document.getElementById('btn-down');
const elBtnUp         = document.getElementById('btn-up');
const elBtnFavorite   = document.getElementById('btn-favorite');
const elBtnShare      = document.getElementById('btn-share');
const elBtnMenu       = document.getElementById('btn-menu');
const elDropdownMenu  = document.getElementById('dropdown-menu');
const elBtnAutoscroll = document.getElementById('btn-autoscroll');
const elBtnDl         = document.getElementById('btn-download');
const elBtnFontDown   = document.getElementById('btn-font-down');
const elBtnFontUp     = document.getElementById('btn-font-up');
const elFontDisp      = document.getElementById('font-size-display');

// Configurações de fonte 
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26]; // tamanhos disponíveis em px
const FONT_KEY   = 'chordsheets_fontsize'; // chave no localStorage

// Chave dos favoritos no localStorage 
const FAVORITES_KEY = 'chordsheets_favorites';

// Ícones de coração (favorito vazio e favorito preenchido) 
const ICON_HEART      = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/></svg>`;
const ICON_HEART_FILL = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`;

// Estado atual da cifra 
let fileUrl;        // caminho do arquivo .cho (vem da URL)
let titleParam;     // título da música (vem da URL)
let artistParam;    // artista (vem da URL)
let keyParam;       // tom original (vem da URL)
let chordsParam;    // quantidade de acordes distintos (vem da URL)
let transposeParam; // transposição inicial (vem da URL, se compartilhada com tom)
let TRANS_KEY;      // chave no localStorage para salvar a transposição desta música

let song           = null; // objeto da música parseado pelo ChordSheetJS
let currentBlobUrl = null; // URL do blob de download atual, para revogar antes de criar um novo
let transpose      = 0;    // quantos semitons estamos transpondo (0 = tom original)
let fontIdx        = 3;    // índice no array FONT_SIZES (3 = 16px, o padrão)

// Escapa caracteres especiais para evitar bugs ao inserir texto no HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lê os parâmetros da URL e atualiza as variáveis de estado
function updateStateFromUrl() {
  const params    = new URLSearchParams(location.search);
  fileUrl         = params.get('file');
  titleParam      = params.get('title')     || '';
  artistParam     = params.get('artist')    || '';
  keyParam        = params.get('key')       || '';
  chordsParam     = params.get('chords')    || '';
  transposeParam  = params.get('transpose');
  TRANS_KEY       = `chordsheets_transpose_${fileUrl}`;
}

// Atualiza o parâmetro ?transpose= na URL sem recarregar a página (permite compartilhar a cifra já no tom transposto)
function updateUrlParams() {
  const url = new URL(window.location.href);
  if (transpose !== 0) {
    url.searchParams.set('transpose', transpose);
  } else {
    url.searchParams.delete('transpose');
  }
  window.history.replaceState({}, '', url.toString());
}

// TAMANHO DE FONTE ===============================================================================

// Carrega a preferência de fonte salva no dispositivo
function loadFontPref() {
  const saved = localStorage.getItem(FONT_KEY);
  if (saved !== null) {
    const idx = FONT_SIZES.indexOf(Number(saved));
    if (idx !== -1) fontIdx = idx;
  }
  applyFont();
}

// Aplica o tamanho de fonte atual e salva a preferência
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

// TRANSPOSIÇÃO ===================================================================================

// Carrega a transposição salva (ou usa a que veio na URL)
function loadTransposePref() {
  if (transposeParam !== null) {
    // Se a URL já tem um tom (link compartilhado), usa ele
    transpose = Number(transposeParam) || 0;
    saveTransposePref();
  } else {
    // Senão, lê o que estava salvo para esta música
    const saved = localStorage.getItem(TRANS_KEY);
    if (saved !== null) transpose = Number(saved) || 0;
  }
}

// Salva a transposição atual no dispositivo
function saveTransposePref() {
  localStorage.setItem(TRANS_KEY, transpose);
}

// Botões de transpor (subir/descer tom) e resetar
elBtnUp.addEventListener('click', () => {
  transpose++;
  saveTransposePref();
  updateUrlParams();
  renderSheet();
});
elBtnDown.addEventListener('click', () => {
  transpose--;
  saveTransposePref();
  updateUrlParams();
  renderSheet();
});
elTransVal.addEventListener('click', () => {
  // Clique no número do tom = resetar para o original
  transpose = 0;
  saveTransposePref();
  updateUrlParams();
  renderSheet();
});

// FAVORITOS ======================================================================================

// Lê a lista de favoritos do dispositivo
function getFavorites() {
  const saved = localStorage.getItem(FAVORITES_KEY);
  return saved ? JSON.parse(saved) : [];
}

// Atualiza o ícone do botão de favorito (coração vazio ou preenchido)
function updateFavoriteUI() {
  const isFav = getFavorites().includes(fileUrl);
  elBtnFavorite.innerHTML = isFav ? ICON_HEART_FILL : ICON_HEART;
}

// Adiciona ou remove esta música dos favoritos
function toggleFavorite() {
  const favs  = getFavorites();
  const index = favs.indexOf(fileUrl);

  if (index > -1) {
    favs.splice(index, 1); // já era favorito → remove
  } else {
    favs.push(fileUrl);    // não era favorito → adiciona
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  updateFavoriteUI();
  window.dispatchEvent(new CustomEvent('favoritesChanged')); // avisa o app.js para atualizar a aba Favoritos
}

elBtnFavorite.addEventListener('click', toggleFavorite);

// RENDERIZAÇÃO DA CIFRA ==========================================================================

// Exibe os metadados da música (artista, tom, bpm etc.) no cabeçalho
function renderMetadata(song) {
  if (!song || !song.metadata) return;

  const meta = song.metadata;
  let html   = '';

  if (meta.artist)    html += `<span class="song-meta-item"><strong>Artista:</strong> ${escapeHtml(meta.artist)}</span>`;
  if (meta.composer)  html += `<span class="song-meta-item"><strong>Compositor:</strong> ${escapeHtml(meta.composer)}</span>`;
  if (meta.album)     html += `<span class="song-meta-item"><strong>Álbum:</strong> ${escapeHtml(meta.album)}</span>`;
  if (meta.year)      html += `<span class="song-meta-item"><strong>Ano:</strong> ${escapeHtml(meta.year)}</span>`;
  if (meta.copyright) html += `<span class="song-meta-item"><strong>Copyright:</strong> ${escapeHtml(meta.copyright)}</span>`;
  if (meta.key)       html += `<span class="song-meta-item"><strong>Tom:</strong> ${escapeHtml(meta.key)}</span>`;
  if (meta.time)      html += `<span class="song-meta-item"><strong>Compasso:</strong> ${escapeHtml(meta.time)}</span>`;
  if (meta.tempo)     html += `<span class="song-meta-item"><strong>bpm:</strong> ${escapeHtml(meta.tempo)}</span>`;
  if (chordsParam)    html += `<span class="song-meta-item"><strong>Acordes:</strong> ${escapeHtml(chordsParam)}</span>`;

  elSongHeader.innerHTML = html;
}

// Renderiza a cifra com os acordes no tom atual
function renderSheet() {
  if (!song) return;

  // Transpõe e converte para HTML usando o ChordSheetJS
  const transposed  = song.transpose(transpose);
  const formatter   = new ChordSheetJS.HtmlDivFormatter();
  elSheet.innerHTML = formatter.format(transposed);

  // Ajustes visuais nos acordes
  elSheet.innerHTML = elSheet.innerHTML.replace(/\.\.\./g, '…'); // reticências tipográficas
  elSheet.querySelectorAll('.chord').forEach(el => {
    el.innerHTML = el.innerHTML
      .replace(/ma7/gi, '7M') // C7M em vez de Cma7
      .replace(/dim/gi,  '°'); // C° em vez de Cdim
  });

  // Atualiza o contador de semitons (+2, -1 etc.)
  elTransVal.textContent = (transpose >= 0 ? '+' : '') + transpose;

  // Rodapé discreto com a versão da biblioteca
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top:2rem; padding-top:0.75rem; border-top:1px solid var(--border-color); font-size:0.75rem; color:var(--tertiary-color); text-align:center; margin-bottom:1.25rem;';
  footer.textContent   = `ChordSheetJS v${ChordSheetJS.version}`;
  elSheet.appendChild(footer);
}

// COMPARTILHAR ===================================================================================

elBtnShare.addEventListener('click', async () => {
  // Monta a URL com o tom atual embutido (para quem receber já ver no tom certo)
  const urlObj = new URL(location.href);
  if (transpose !== 0) {
    urlObj.searchParams.set('transpose', transpose);
  } else {
    urlObj.searchParams.delete('transpose');
  }
  const shareUrl = urlObj.toString();

  const titulo  = song?.metadata?.title  || titleParam;
  const artista = song?.metadata?.artist || artistParam;
  const texto   = `Cifra de ${titulo} - ${artista}`.trim();

  const shareData = { title: titulo, text: texto, url: shareUrl };

  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      // Usa o compartilhamento nativo do celular (WhatsApp, etc.)
      await navigator.share(shareData);
    } else {
      // Fallback: copia para a área de transferência
      await navigator.clipboard.writeText(`${texto}\n${shareUrl}`);
      elBtnShare.textContent = 'Copiado!';
      setTimeout(() => elBtnShare.textContent = 'Compartilhar', 2000);
    }
  } catch (e) {
    console.warn('Compartilhamento falhou', e);
  }
});

// MENU DROPDOWN (⋮) ==============================================================================

elBtnMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  elDropdownMenu.classList.toggle('open');
});

// Fecha o menu ao clicar em qualquer item dele, ou fora dele
elDropdownMenu.addEventListener('click', () => elDropdownMenu.classList.remove('open'));
document.addEventListener('click', () => elDropdownMenu.classList.remove('open'));

// AUTOSCROLL =====================================================================================

let autoscrollInterval = null;
const AUTOSCROLL_STEP_MS = 50;   // intervalo entre cada "passinho" de rolagem
const AUTOSCROLL_STEP_PX = 1;    // quantos pixels rola a cada passinho

function stopAutoscroll() {
  if (autoscrollInterval) {
    clearInterval(autoscrollInterval);
    autoscrollInterval = null;
  }
  elBtnAutoscroll.classList.remove('active');
}

function startAutoscroll() {
  autoscrollInterval = setInterval(() => {
    window.scrollBy(0, AUTOSCROLL_STEP_PX);
    // Chegou ao fim da página → para sozinho
    if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
      stopAutoscroll();
    }
  }, AUTOSCROLL_STEP_MS);
  elBtnAutoscroll.classList.add('active');
}

elBtnAutoscroll.addEventListener('click', () => {
  if (autoscrollInterval) {
    stopAutoscroll();
  } else {
    startAutoscroll();
  }
});

// Se o usuário rolar manualmente enquanto o autoscroll está ativo, ele para (evita "briga" entre os dois)
// window.addEventListener('wheel', () => { if (autoscrollInterval) stopAutoscroll(); });
// window.addEventListener('touchmove', () => { if (autoscrollInterval) stopAutoscroll(); }, { passive: true });

// CONTROLE DE TELA (loading / erro / conteúdo) ===================================================

// Mostra a mensagem de erro e esconde o resto
function showError(msg) {
  elLoading.style.display = 'none';
  elContent.style.display = 'none';
  elError.style.display   = 'block';
  elErrorText.textContent = msg;
}

// Esconde o loading e mostra a cifra
function showContent() {
  elLoading.style.display = 'none';
  elError.style.display   = 'none';
  elContent.style.display = 'block';
}

// INICIALIZAÇÃO DA CIFRA =========================================================================

// Carrega e renderiza a cifra indicada na URL (?file=...)
function initSong() {
  updateStateFromUrl();
  if (!fileUrl) return; // se não tem ?file= na URL, não faz nada

  document.title = titleParam;
  loadFontPref();
  loadTransposePref();
  updateFavoriteUI();

  fetch(fileUrl)
    .then(r => r.text())
    .catch(() => {
      throw new Error('Música não encontrada. Verifique sua conexão.');
    })
    .then(text => {
      if (!text) throw new Error('Conteúdo vazio.');

      // Faz o parse do formato ChordPro (.cho) para um objeto JS
      const parser = new ChordSheetJS.ChordProParser();
      song = parser.parse(text);

      renderMetadata(song);

      // Prepara o botão de download com o arquivo original
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl); // libera o blob da música anterior
      }
      const blob        = new Blob([text], { type: 'text/plain' });
      currentBlobUrl    = URL.createObjectURL(blob);
      elBtnDl.href      = currentBlobUrl;
      elBtnDl.download  = fileUrl.split('/').pop() || 'cifra.cho';

      renderSheet();
      showContent();
    })
    .catch(err => showError(err.message));
}

// Recarrega a cifra ao usar o botão "voltar" do browser
window.addEventListener('popstate', initSong);
initSong();