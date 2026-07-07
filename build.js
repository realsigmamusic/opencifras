#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'songs');
const OUTPUT_FILE = path.join(__dirname, 'songs.json');

// Parse ChordPro metadata e letra
function parseChordProFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const metadata = {};
  let lyricsLines = [];
  const chordSet = new Set(); // acordes únicos encontrados na música

  for (const line of lines) {
    const trimmed = line.trim();

    // Metadata em ChordPro
    const metaMatch = trimmed.match(/^\{([^:]+):\s*(.+?)\}$/);
    if (metaMatch) {
      const key = metaMatch[1].trim().toLowerCase();
      const value = metaMatch[2].trim();
      metadata[key] = value;
      continue;
    }

    // Extrai os acordes da linha (ex: [C], [G/B], [Am7]) antes de descartá-los
    const chordMatches = trimmed.match(/\[([^\]]+)\]/g);
    if (chordMatches) {
      chordMatches.forEach(m => {
        const chord = m.slice(1, -1).trim();
        if (chord) chordSet.add(chord);
      });
    }

    // Letra pura
    const withoutChords = trimmed.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').trim();
    if (withoutChords) {
      lyricsLines.push(withoutChords);
    }
  }

  const lyrics = lyricsLines.join(' ').replace(/\s+/g, ' ').trim();

  return { metadata, lyrics, chordCount: chordSet.size };
}

// Recursivamente encontra todos os .cho em songs/
function findChoFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(findChoFiles(fullPath));
    } else if (item.name.endsWith('.cho')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Converte caminho absoluto para caminho relativo ao root
function getRelativePath(absolutePath) {
  return path.relative(__dirname, absolutePath).replace(/\\/g, '/');
}

// Main
async function main() {
  if (!fs.existsSync(SONGS_DIR)) {
    console.error(`Diretório ${SONGS_DIR} não encontrado.`);
    process.exit(1);
  }

  const choFiles = findChoFiles(SONGS_DIR);

  if (choFiles.length === 0) {
    console.warn('Nenhum arquivo .cho encontrado.');
    fs.writeFileSync(OUTPUT_FILE, '[]', 'utf-8');
    console.log(`✓ ${OUTPUT_FILE} criado (vazio)`);
    return;
  }

  const songs = [];

  for (const filePath of choFiles) {
    try {
      const stat = fs.statSync(filePath);
      const { metadata, lyrics, chordCount } = parseChordProFile(filePath);
      const relativePath = getRelativePath(filePath);

      const song = {
        title: metadata.title || path.basename(filePath, '.cho'),
        artist: metadata.artist || '',
        file: relativePath,
        lyrics: lyrics,
        chordCount: chordCount,
        mtime: stat.mtimeMs,
      };

      songs.push(song);
      console.log(`✓ ${relativePath}`);
    } catch (err) {
      console.error(`✗ Erro ao processar ${filePath}:`, err.message);
    }
  }

  // Ordena por título
  songs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  // Escreve songs.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(songs, null, 2), 'utf-8');
  console.log(`\n✓ ${OUTPUT_FILE} gerado (${songs.length} música${songs.length !== 1 ? 's' : ''})`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});