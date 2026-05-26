import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loads and validates the secret wedding words. Throws (and the server refuses
// to boot) if the config is malformed, so a typo can't silently break the game.
export function loadWords({ wordLen, wordCount }) {
  const file = process.env.WORDS_FILE || path.join(__dirname, 'config', 'words.json');
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read words config at ${file}: ${err.message}`);
  }

  const words = Array.isArray(raw) ? raw : raw.words;
  if (!Array.isArray(words)) {
    throw new Error(`words config must be an array, or an object with a "words" array (file: ${file})`);
  }
  if (words.length !== wordCount) {
    throw new Error(`Expected exactly ${wordCount} words, got ${words.length} (file: ${file})`);
  }

  const cleaned = words.map((w, i) => {
    if (typeof w !== 'string') {
      throw new Error(`Word #${i + 1} is not a string (file: ${file})`);
    }
    const up = w.trim().toUpperCase();
    if (!new RegExp(`^[A-Z]{${wordLen}}$`).test(up)) {
      throw new Error(`Word #${i + 1} ("${w}") must be exactly ${wordLen} letters A-Z (file: ${file})`);
    }
    return up;
  });

  return cleaned;
}
