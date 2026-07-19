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
const elBtnDlCho      = document.getElementById('btn-download-cho');
const elBtnDlTxt      = document.getElementById('btn-download-txt');
const elBtnDlPdf      = document.getElementById('btn-download-pdf');
const elBtnEditLocal  = document.getElementById('btn-edit-local');
const elBtnFontDown   = document.getElementById('btn-font-down');
const elBtnFontUp     = document.getElementById('btn-font-up');
const elFontDisp      = document.getElementById('font-size-display');

// Configurações de fonte 
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26]; // tamanhos disponíveis em px
const FONT_KEY   = 'chordsheets_fontsize'; // chave no localStorage

// Chave dos favoritos no localStorage 
const FAVORITES_KEY = 'chordsheets_favorites';

// Número de WhatsApp que recebe os relatos de erro na cifra (mesmo número do banner da home)
const REPORT_WHATSAPP_NUMBER = '5575999674176';

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

let song              = null; // objeto da música parseado pelo ChordSheetJS
let currentSongText   = null; // texto ChordPro bruto da cifra atual (usado ao criar cópia local de músicas oficiais)
let currentChoBlobUrl = null; // URL do blob do .cho original, para revogar antes de criar um novo
let currentTxtBlobUrl = null; // URL do blob do .txt gerado, para revogar antes de criar um novo
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

// Nome-base usado nos três downloads (.cho/.txt/.pdf): mesmo nome do arquivo original,
// ou (pra cifras locais, que não têm um arquivo real) o título salvo na própria cifra
function baseFilename() {
  if (window.LocalSongs.isLocalFile(fileUrl)) {
    const title = (song && song.metadata && song.metadata.title) || titleParam || 'cifra';
    return String(title)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'cifra';
  }
  return (fileUrl || 'cifra').split('/').pop().replace(/\.cho$/i, '');
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
      .replace(/ma7/gi, '7M'); // C7M em vez de Cma7
      //.replace(/dim/gi,  '°'); // C° em vez de Cdim
  });

  // Atualiza o contador de semitons (+2, -1 etc.)
  elTransVal.textContent = (transpose >= 0 ? '+' : '') + transpose;

  // Gera o .txt (acordes sobre a letra, em texto puro) no tom atual, para download
  const txtFormatter = new ChordSheetJS.ChordsOverWordsFormatter();
  const txtContent   = txtFormatter.format(transposed);

  if (currentTxtBlobUrl) {
    URL.revokeObjectURL(currentTxtBlobUrl); // libera o blob do .txt anterior
  }
  const txtBlob     = new Blob([txtContent], { type: 'text/plain' });
  currentTxtBlobUrl = URL.createObjectURL(txtBlob);
  elBtnDlTxt.href   = currentTxtBlobUrl;

  const baseName    = baseFilename();
  const transSuffix = transpose !== 0 ? `_${transpose >= 0 ? '+' : ''}${transpose}` : '';
  elBtnDlTxt.download = `${baseName}${transSuffix}.txt`;

  // Link para reportar cifra/letra errada, com os dados da música já preenchidos no WhatsApp
  elSheet.appendChild(buildReportErrorLink());

  // Rodapé discreto com a versão da biblioteca
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top:2rem; padding-top:0.75rem; border-top:1px solid var(--border-color); font-size:0.75rem; color:var(--tertiary-color); text-align:center; margin-bottom:1.25rem;';
  footer.textContent   = `ChordSheetJS v${ChordSheetJS.version}`;
  elSheet.appendChild(footer);
}

// Monta o link "Cifra ou letra errada? Clique aqui para reportar", que abre o WhatsApp
// já com uma mensagem pronta (título, artista, tom atual e link da cifra). O usuário só
// precisa completar descrevendo o erro e apertar enviar — não é possível enviar sozinho
// sem essa confirmação do usuário, por restrição do próprio navegador/WhatsApp.
function buildReportErrorLink() {
  const wrap = document.createElement('div');
  wrap.className = 'report-error-wrap';

  const link = document.createElement('a');
  link.className   = 'report-error-link';
  link.target      = '_blank';
  link.rel         = 'noopener';
  link.textContent = 'Cifra ou letra errada? Clique aqui para reportar';
  link.href        = buildReportErrorUrl();

  wrap.appendChild(link);
  return wrap;
}

function buildReportErrorUrl() {
  const titulo  = (song && song.metadata && song.metadata.title)  || titleParam  || 'Sem título';
  const artista = (song && song.metadata && song.metadata.artist) || artistParam || '';
  const tomTxt  = (transpose !== 0) ? ` (transposta ${transpose >= 0 ? '+' : ''}${transpose})` : '';

  let mensagem = `Olá! Encontrei um possível erro na cifra de "${titulo}"`;
  if (artista) mensagem += ` - ${artista}`;
  mensagem += `${tomTxt}.\nLink: ${window.location.href}\n\nO erro é: `;

  return `https://wa.me/${REPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
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

// BAIXAR PDF ======================================================================================

// Os vendors do PDF (jsPDF + ChordSheetJS/pdf) são grandes (~1.1MB juntos), então só
// carregamos sob demanda, no primeiro clique em "Baixar .pdf" — não no carregamento da página.
let pdfLibPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

function loadPdfLib() {
  if (window.ChordSheetJSPdf) return Promise.resolve();
  if (!pdfLibPromise) {
    // jsPDF precisa vir primeiro: o bundle do ChordSheetJS/pdf espera window.jspdf.jsPDF já disponível
    pdfLibPromise = loadScript('./assets/vendor/jspdf.umd.min.js')
      .then(() => loadScript('./assets/vendor/chordsheetjs-pdf.min.js'))
      .catch(err => {
        pdfLibPromise = null; // permite tentar de novo em caso de falha (ex: sem internet na 1ª vez)
        throw err;
      });
  }
  return pdfLibPromise;
}

elBtnDlPdf.addEventListener('click', async () => {
  if (!song) return;

  const label = elBtnDlPdf.querySelector('span');
  const originalLabel = label.textContent;
  label.textContent = 'Gerando PDF…';
  elBtnDlPdf.disabled = true;

  try {
    await loadPdfLib();

    const transposed = song.transpose(transpose);
    const formatter  = new ChordSheetJSPdf.PdfFormatter({
      layout: { chordDiagrams: { enabled: false } } // app é "universal" (não só violão/guitarra), sem diagramas
    });
    formatter.format(transposed);

    const baseName    = baseFilename();
    const transSuffix = transpose !== 0 ? `_${transpose >= 0 ? '+' : ''}${transpose}` : '';
    formatter.getDocumentWrapper().save(`${baseName}${transSuffix}.pdf`);
  } catch (e) {
    console.warn('Falha ao gerar PDF', e);
    alert('Não foi possível gerar o PDF. Verifique sua conexão e tente novamente.');
  } finally {
    label.textContent  = originalLabel;
    elBtnDlPdf.disabled = false;
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

// Busca o texto ChordPro da cifra atual — da rede (arquivo .cho real) ou do
// localStorage (cifra local do usuário), dependendo do que fileUrl representa
function fetchSongText(url) {
  if (window.LocalSongs.isLocalFile(url)) {
    const raw = window.LocalSongs.get(window.LocalSongs.idFromFile(url));
    if (!raw) return Promise.reject(new Error('Esta cifra local não foi encontrada. Ela pode ter sido excluída neste aparelho.'));
    return Promise.resolve(raw.content);
  }
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('Música não encontrada. Verifique sua conexão.');
    return r.text();
  });
}

// Carrega e renderiza a cifra indicada na URL (?file=...)
function initSong() {
  updateStateFromUrl();
  if (!fileUrl) return; // se não tem ?file= na URL, não faz nada

  document.title = titleParam;
  loadFontPref();
  loadTransposePref();
  updateFavoriteUI();

  fetchSongText(fileUrl)
    .then(text => {
      if (!text) throw new Error('Conteúdo vazio.');
      currentSongText = text;

      // Faz o parse do formato ChordPro (.cho) para um objeto JS
      const parser = new ChordSheetJS.ChordProParser();
      song = parser.parse(text);

      renderMetadata(song);

      // Prepara o botão de download com o arquivo original (.cho)
      if (currentChoBlobUrl) {
        URL.revokeObjectURL(currentChoBlobUrl); // libera o blob da música anterior
      }
      const blob          = new Blob([text], { type: 'text/plain' });
      currentChoBlobUrl   = URL.createObjectURL(blob);
      elBtnDlCho.href     = currentChoBlobUrl;
      elBtnDlCho.download = `${baseFilename()}.cho`;

      renderSheet();
      showContent();
    })
    .catch(err => showError(err.message));
}

elBtnEditLocal.addEventListener('click', () => {
  // Cifra já é local → edita direto o conteúdo salvo
  if (window.LocalSongs.isLocalFile(fileUrl)) {
    window.openChoEditor(window.LocalSongs.idFromFile(fileUrl));
    return;
  }

  // Cifra oficial → cria uma cópia local editável com o conteúdo atual e passa
  // a apontar a tela para essa cópia, sem afetar o arquivo oficial original
  if (!currentSongText) return;

  const newId   = window.LocalSongs.save(null, currentSongText);
  const newFile = window.LocalSongs.PREFIX + newId;

  const url = new URL(window.location.href);
  url.searchParams.set('file', newFile);
  url.searchParams.delete('transpose');
  window.history.pushState({}, '', url.toString());

  initSong();
  window.openChoEditor(newId);
});

// Se a cifra local aberta agora for editada ou excluída (pela aba Configurações,
// por exemplo), recarrega a tela pra refletir a mudança na hora
window.addEventListener('localSongsChanged', () => {
  if (fileUrl && window.LocalSongs.isLocalFile(fileUrl)) initSong();
});

// Recarrega a cifra ao usar o botão "voltar" do browser
window.addEventListener('popstate', initSong);
initSong();