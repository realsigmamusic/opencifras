// Camada de armazenamento das cifras importadas/criadas pelo usuário (só neste aparelho).
// Compartilhada entre app.js (Home/busca) e song.js (visualização/edição), pra manter uma
// única fonte de verdade sobre como uma cifra local é lida, salva e transformada num item
// de catálogo (mesmo formato usado pelas músicas vindas do songs.json).
window.LocalSongs = (function () {
  const STORAGE_KEY = 'chordsheets_local_songs';
  const PREFIX       = 'local:'; // prefixo usado no "file" pra diferenciar de arquivos .cho reais

  // Lê todos os registros brutos salvos: [{ id, content, mtime }, ...]
  function readAll() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('LocalSongs: dado corrompido no localStorage, ignorando.', e);
      return [];
    }
  }

  function writeAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function notifyChanged() {
    window.dispatchEvent(new CustomEvent('localSongsChanged'));
  }

  // Remove acordes [C] e diretivas {title: ...} pra indexar só a letra na busca fuzzy
  function extractLyrics(text) {
    return String(text)
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // true se este "file" identifica uma cifra local (ao invés de um caminho .cho real)
  function isLocalFile(file) {
    return typeof file === 'string' && file.startsWith(PREFIX);
  }

  function idFromFile(file) {
    return isLocalFile(file) ? file.slice(PREFIX.length) : null;
  }

  // Busca o registro bruto (com o texto completo) pelo id
  function get(id) {
    return readAll().find(s => s.id === id) || null;
  }

  // Converte um registro bruto num item de catálogo, no mesmo formato usado pelas
  // entradas do songs.json (file, title, artist, chordCount, mtime, lyrics)
  function toCatalogEntry(raw) {
    const base = {
      file: PREFIX + raw.id,
      mtime: raw.mtime || 0,
      isLocal: true
    };
    try {
      const song = new ChordSheetJS.ChordProParser().parse(raw.content || '');
      const meta = song.metadata || {};
      return Object.assign(base, {
        title: (meta.title && String(meta.title).trim()) || 'Sem título',
        artist: (meta.artist && String(meta.artist).trim()) || '',
        time: (meta.time && String(meta.time).trim()) || '',
        chordCount: song.getChords().length,
        lyrics: extractLyrics(raw.content || '')
      });
    } catch (e) {
      // Mesmo com erro de sintaxe, a cifra continua aparecendo na lista (só sinalizada),
      // pra não "sumir" um trabalho que o usuário já tinha feito.
      return Object.assign(base, {
        title: 'Cifra com erro de formato',
        artist: '',
        chordCount: 0,
        lyrics: '',
        hasError: true
      });
    }
  }

  // Lista todas as cifras locais já no formato de catálogo, mais recentes primeiro
  function list() {
    return readAll()
      .map(toCatalogEntry)
      .sort((a, b) => b.mtime - a.mtime);
  }

  function generateId() {
    return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Cria (id vazio/null) ou atualiza (id existente) uma cifra local. Retorna o id final.
  function save(id, content) {
    const all    = readAll();
    const mtime  = Date.now();
    const finalId = id || generateId();
    const idx    = all.findIndex(s => s.id === finalId);

    if (idx > -1) {
      all[idx] = { id: finalId, content, mtime };
    } else {
      all.push({ id: finalId, content, mtime });
    }

    writeAll(all);
    notifyChanged();
    return finalId;
  }

  function remove(id) {
    writeAll(readAll().filter(s => s.id !== id));
    notifyChanged();
  }

  return { list, get, save, remove, isLocalFile, idFromFile, PREFIX };
})();