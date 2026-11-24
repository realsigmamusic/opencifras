// Rótulos de mudança de tom no meio da música (independente da análise harmônica).
// O ChordSheetJS guarda todos os {key: X} na árvore, já transpostos, mas o formatador de
// HTML os descarta. Este módulo descobre ONDE cada mudança de tom acontece e COMO escrevê-la;
// o desenho na tela fica em song.js. UMD: funciona no navegador e no Node (testes).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeyLabels = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Tom reconhecível: nota A-G, acidente opcional, "m" para menor (ex.: E, Bb, F#m)
  const KEY_RE = /^([A-G])([#b]?)(m)?$/;

  // Percorre a música (já transposta) e devolve as mudanças de tom:
  //   [{ pairIndex, key }]  → o rótulo vai antes do par acorde/letra de número pairIndex
  // Regras: o 1º {key} é o tom inicial (mesmo que venha depois de acordes) e não gera rótulo;
  // {key} igual ao tom vigente é ignorado; {key} vazio é ignorado; {key} sem acorde depois
  // dele (fim da música) não tem onde aparecer.
  function compute(song) {
    const labels = [];
    let current = null;
    let pairs = 0;

    (song.lines || []).forEach(line => (line.items || []).forEach(item => {
      if ('chords' in item) { pairs++; return; }
      if (item.name !== 'key') return;

      const value = String(item.value == null ? '' : item.value).trim();
      if (!value) return;
      if (current === null) { current = value; return; }
      if (value === current) return;

      current = value;
      const last = labels[labels.length - 1];
      if (last && last.pairIndex === pairs) last.key = value; // dois {key} seguidos: vale o último
      else labels.push({ pairIndex: pairs, key: value });
    }));

    return labels;
  }

  // Texto do rótulo: sempre "C:" / "Am:" / "Bb:" / "F#m:" (o tom como foi escrito, "m" = menor,
  // sem a palavra "Tom" e igual em qualquer modo de visualização).
  // Valor que não é um tom reconhecível não gera rótulo (retorna null).
  function format(key) {
    const m = KEY_RE.exec(String(key).trim());
    return m ? m[0] + ':' : null;
  }

  return { compute, format };
});
