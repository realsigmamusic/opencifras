// Análise harmônica: pré-processador do ChordPro.
// O autor escreve [G7*V7]; esta função separa o acorde (G7) da análise (V7) ANTES do
// ChordSheetJS ver o texto. A mesma função é usada em song.js, local-songs.js e build.js
// (por isso o módulo é UMD: funciona no navegador e no Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChordAnalysis = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Mesma ideia do CHORD_PATTERN do build.js: o acorde precisa começar com nota de A a G.
  // (Maiúscula: assim [bar*x] ou [a*I] não são tomados por acorde.)
  const CHORD_START = /^[A-G]/;

  // Gramática: acidente? numeral qualidade? figurado? (/alvo)?
  const NUMERAL  = '(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)';
  const ANALYSIS = new RegExp(
    '^(?:b|#)?' + NUMERAL +      // acidente + numeral (caixa significativa)
    '(?:o|h|\\+)?' +             // qualidade (uma só)
    '(?:7|6|M7|6,4|6,5|4,3|4,2)?' + // figurado (lista fechada)
    '(?:/(?:b|#)?' + NUMERAL + ')?$' // alvo: só numeral, uma barra
  );

  function isValidAnalysis(text) {
    return ANALYSIS.test(text);
  }

  // Linhas que não carregam acordes (diretivas e comentários) não entram na contagem.
  function isNonChordLine(line) {
    const t = line.trim();
    return t.startsWith('{') || t.startsWith('#');
  }

  // Retorna:
  //  text      → texto sem as análises (o que o ChordSheetJS deve parsear)
  //  analyses  → um item por colchete, na ordem do texto:
  //              null (sem análise / marcador / vazia) ou { raw, valid }
  //  brackets  → número de colchetes encontrados
  function split(source) {
    const analyses = [];
    const lines = String(source == null ? '' : source).split('\n');

    const out = lines.map(line => {
      if (isNonChordLine(line)) return line;
      return line.replace(/\[([^\]]*)\]/g, (whole, inner) => {
        const star = inner.indexOf('*');
        if (star === -1) { analyses.push(null); return whole; }

        const chord = inner.slice(0, star).trim();
        if (!CHORD_START.test(chord)) { analyses.push(null); return whole; } // [|*I], [%*I], [*I]...

        const raw = inner.slice(star + 1).trim();
        if (raw === '') { analyses.push(null); return '[' + chord + ']'; }   // [C*] ignorada

        analyses.push({ raw, valid: isValidAnalysis(raw) });
        return '[' + chord + ']';
      });
    });

    return { text: out.join('\n'), analyses, brackets: analyses.length };
  }

  // Confere se o número de colchetes bate com o de pares com acorde do song já parseado.
  // Se não bater, o modo de análise deve ficar desligado para a música.
  function countChordPairs(song) {
    let n = 0;
    (song.lines || []).forEach(l => (l.items || []).forEach(it => {
      if ('chords' in it && it.chords && String(it.chords).trim() !== '') n++;
    }));
    return n;
  }

  function matches(parsedSong, result) {
    return countChordPairs(parsedSong) === result.brackets;
  }

  // ---- Fase 2: leitura e desenho dos símbolos -------------------------------------------
  // Tudo sai como caracteres de texto reais (♭ ♯ ° ø ⁺ ⁷ ⁶ ᴹ), nunca CSS/SVG, para o PNG funcionar.
  const PARSE = new RegExp(
    '^(b|#)?(' + NUMERAL.slice(3, -1) + ')(o|h|\\+)?(7|6|M7|6,4|6,5|4,3|4,2)?(?:/(b|#)?(' + NUMERAL.slice(3, -1) + '))?$'
  );
  const ACC  = { b: '♭', '#': '♯' };
  const QUAL = { o: '°', h: 'ø', '+': '⁺' };
  const QUALCLASS = { o: 'dim', h: 'half', '+': 'aug' };
  const FIG1 = { '7': '⁷', '6': '⁶', 'M7': 'Δ⁷' }; // 'ᴹ⁷' };

  // Devolve { acc, numeral, quality, figured, target:{acc,numeral}|null } ou null se inválida
  function parse(raw) {
    const m = PARSE.exec(raw);
    if (!m) return null;
    return {
      acc: m[1] || '', numeral: m[2], quality: m[3] || '', figured: m[4] || '',
      target: m[6] ? { acc: m[5] || '', numeral: m[6] } : null
    };
  }

  function esc(x) {
    return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // HTML de uma análise. Inválida: texto cru com classe de aviso, sem estilo de numeral.
  function toHtml(raw) {
    const a = parse(raw);
    if (!a) return '<span class="an an-invalid" title="Análise inválida">' + esc(raw) + '</span>';

    let h = '<span class="an">';
    if (a.acc) h += '<span class="an-acc">' + ACC[a.acc] + '</span>';
    h += '<span class="an-num">' + a.numeral + '</span>';
    if (a.quality) h += '<span class="an-q an-q-' + QUALCLASS[a.quality] + '">' + QUAL[a.quality] + '</span>';
    if (a.figured) {
      if (FIG1[a.figured]) h += '<span class="an-fig">' + FIG1[a.figured] + '</span>';
      else {
        const [top, bottom] = a.figured.split(',');
        h += '<span class="an-stack"><span>' + top + '</span><span>' + bottom + '</span></span>';
      }
    }
    if (a.target) {
      h += '<span class="an-slash">/</span>';
      if (a.target.acc) h += '<span class="an-acc">' + ACC[a.target.acc] + '</span>';
      h += '<span class="an-num">' + a.target.numeral + '</span>';
    }
    return h + '</span>';
  }

  return { split, isValidAnalysis, countChordPairs, matches, parse, toHtml };
});