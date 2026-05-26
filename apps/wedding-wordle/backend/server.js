import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { loadWords } from './words.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Game configuration (tweak the feel here) -------------------------------
const CFG = {
  WORD_LEN: 5,
  WORD_COUNT: 10,
  MAX_GUESSES: 6,
  POINTS_PER_GUESS_STEP: 100, // solving in g guesses = (MAX_GUESSES + 1 - g) * step
  SPEED_BONUS_CAP_SEC: 1800, // finish-time bonus = max(0, cap - elapsedSeconds)
};

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// Load + validate the secret words up front. A bad config aborts boot loudly.
let WORDS;
try {
  WORDS = loadWords({ wordLen: CFG.WORD_LEN, wordCount: CFG.WORD_COUNT });
} catch (err) {
  console.error('\n[wedding-wordle] FATAL: invalid words config\n  ' + err.message + '\n');
  process.exit(1);
}

const db = openDb();

// --- Wordle evaluation with correct duplicate-letter handling ---------------
function evaluate(guess, answer) {
  const n = guess.length;
  const result = new Array(n).fill('absent');
  const remaining = {};
  for (const ch of answer) remaining[ch] = (remaining[ch] || 0) + 1;
  // Pass 1: exact matches consume a letter.
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
      remaining[guess[i]]--;
    }
  }
  // Pass 2: present-but-misplaced, only while letters remain.
  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch]--;
    }
  }
  return result;
}

function pointsForSolve(attempts) {
  return (CFG.MAX_GUESSES + 1 - attempts) * CFG.POINTS_PER_GUESS_STEP;
}

// --- Prepared statements -----------------------------------------------------
const q = {
  insertPlayer: db.prepare(
    'INSERT INTO players (id, name, created_at, current_word) VALUES (?, ?, ?, 0)'
  ),
  getPlayer: db.prepare('SELECT * FROM players WHERE id = ?'),
  setStarted: db.prepare('UPDATE players SET started_at = ? WHERE id = ? AND started_at IS NULL'),
  guessCount: db.prepare(
    'SELECT COUNT(*) AS c FROM guesses WHERE player_id = ? AND word_index = ?'
  ),
  guessesForWord: db.prepare(
    'SELECT guess, result FROM guesses WHERE player_id = ? AND word_index = ? ORDER BY id ASC'
  ),
  insertGuess: db.prepare(
    'INSERT INTO guesses (player_id, word_index, guess, result, created_at) VALUES (?, ?, ?, ?, ?)'
  ),
  updateAfterGuess: db.prepare(
    'UPDATE players SET current_word = ?, total_points = ?, solved_count = ?, finished_at = ? WHERE id = ?'
  ),
  leaderboard: db.prepare(`
    SELECT name, solved_count, total_points, started_at, finished_at, current_word
    FROM players
    WHERE started_at IS NOT NULL
    ORDER BY total_points DESC,
             solved_count DESC,
             (finished_at IS NULL) ASC,
             (finished_at - started_at) ASC
    LIMIT 200
  `),
  clearGuesses: db.prepare('DELETE FROM guesses'),
  clearPlayers: db.prepare('DELETE FROM players'),
};

function buildState(player) {
  const finished = player.current_word >= CFG.WORD_COUNT;
  let current = null;
  if (!finished) {
    const rows = q.guessesForWord.all(player.id, player.current_word);
    current = {
      index: player.current_word,
      guesses: rows.map((r) => ({ guess: r.guess, result: JSON.parse(r.result) })),
    };
  }
  return {
    name: player.name,
    currentWord: player.current_word,
    solvedCount: player.solved_count,
    points: player.total_points,
    finished,
    startedAt: player.started_at,
    finishedAt: player.finished_at,
    elapsedMs:
      player.finished_at && player.started_at ? player.finished_at - player.started_at : null,
    cfg: { wordLen: CFG.WORD_LEN, wordCount: CFG.WORD_COUNT, maxGuesses: CFG.MAX_GUESSES },
    current,
  };
}

// --- Server ------------------------------------------------------------------
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
});

app.get('/healthz', async () => ({ ok: true, words: WORDS.length }));

app.get('/api/config', async () => ({
  wordLen: CFG.WORD_LEN,
  wordCount: CFG.WORD_COUNT,
  maxGuesses: CFG.MAX_GUESSES,
}));

app.post('/api/join', async (req, reply) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return reply.code(400).send({ error: 'Please enter a name.' });
  if (name.length > 40) return reply.code(400).send({ error: 'Name is too long (max 40).' });

  const id = randomUUID();
  q.insertPlayer.run(id, name, Date.now());
  return { playerId: id, name };
});

app.get('/api/state', async (req, reply) => {
  const player = q.getPlayer.get(req.query?.playerId || '');
  if (!player) return reply.code(404).send({ error: 'Player not found.' });
  return buildState(player);
});

app.post('/api/guess', async (req, reply) => {
  const playerId = req.body?.playerId;
  const player = q.getPlayer.get(playerId || '');
  if (!player) return reply.code(404).send({ error: 'Player not found. Re-join the game.' });
  if (player.current_word >= CFG.WORD_COUNT) {
    return reply.code(400).send({ error: 'You have already finished all words.' });
  }

  const guess = typeof req.body?.guess === 'string' ? req.body.guess.trim().toUpperCase() : '';
  if (!new RegExp(`^[A-Z]{${CFG.WORD_LEN}}$`).test(guess)) {
    return reply.code(400).send({ error: `Guess must be ${CFG.WORD_LEN} letters.` });
  }

  const wordIndex = player.current_word;
  const priorCount = q.guessCount.get(playerId, wordIndex).c;
  if (priorCount >= CFG.MAX_GUESSES) {
    return reply.code(400).send({ error: 'No guesses left for this word.' });
  }

  const now = Date.now();
  q.setStarted.run(now, playerId); // no-op after the first guess

  const answer = WORDS[wordIndex];
  const result = evaluate(guess, answer);
  q.insertGuess.run(playerId, wordIndex, guess, JSON.stringify(result), now);

  const attempts = priorCount + 1;
  const solved = guess === answer;
  const gameOverForWord = solved || attempts >= CFG.MAX_GUESSES;

  let totalPoints = player.total_points;
  let solvedCount = player.solved_count;
  let pointsEarned = 0;
  if (solved) {
    pointsEarned = pointsForSolve(attempts);
    totalPoints += pointsEarned;
    solvedCount += 1;
  }

  let nextWord = player.current_word;
  let finishedAt = player.finished_at;
  let finished = false;
  if (gameOverForWord) {
    nextWord += 1;
    if (nextWord >= CFG.WORD_COUNT) {
      finished = true;
      finishedAt = now;
      const startedAt = player.started_at || now;
      const elapsedSec = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
      const speedBonus = Math.max(0, CFG.SPEED_BONUS_CAP_SEC - elapsedSec);
      totalPoints += speedBonus;
      pointsEarned += speedBonus;
    }
  }

  q.updateAfterGuess.run(nextWord, totalPoints, solvedCount, finishedAt, playerId);

  return {
    result,
    solved,
    gameOverForWord,
    answer: gameOverForWord ? answer : null,
    attempts,
    maxGuesses: CFG.MAX_GUESSES,
    pointsEarned,
    totalPoints,
    solvedCount,
    currentWord: nextWord,
    finished,
  };
});

app.get('/api/leaderboard', async () => {
  const rows = q.leaderboard.all();
  return rows.map((r) => ({
    name: r.name,
    solvedCount: r.solved_count,
    points: r.total_points,
    finished: r.current_word >= CFG.WORD_COUNT,
    totalMs: r.finished_at && r.started_at ? r.finished_at - r.started_at : null,
  }));
});

app.post('/api/admin/reset', async (req, reply) => {
  if (!ADMIN_TOKEN) return reply.code(403).send({ error: 'Admin reset is disabled (no ADMIN_TOKEN set).' });
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: 'Bad admin token.' });
  }
  const tx = db.transaction(() => {
    q.clearGuesses.run();
    q.clearPlayers.run();
  });
  tx();
  return { ok: true };
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
try {
  await app.listen({ port, host });
  app.log.info(`wedding-wordle ready on http://${host}:${port} (${WORDS.length} words)`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
