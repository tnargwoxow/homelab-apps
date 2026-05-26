const STORAGE_KEY = 'wedding-wordle-player-id';

const KEY_PRIORITY = { absent: 0, present: 1, correct: 2 };
const KB_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

const cfg = { wordLen: 5, wordCount: 10, maxGuesses: 6 };

const game = {
  playerId: null,
  name: '',
  currentWord: 0,
  points: 0,
  solvedCount: 0,
  finished: false,
  submitted: [], // [{ guess, result }] for the CURRENT word
  typed: '',
  keyState: {},
  busy: false,
};

// --- DOM refs ---------------------------------------------------------------
const el = (id) => document.getElementById(id);
const joinScreen = el('join-screen');
const gameScreen = el('game-screen');
const finishScreen = el('finish-screen');
const boardEl = el('board');
const keyboardEl = el('keyboard');
const messageEl = el('message');
const progressEl = el('word-progress');
const pointsEl = el('points-display');
const lbEl = el('leaderboard');
const lbList = el('leaderboard-list');
const lbBackdrop = el('lb-backdrop');

// --- API --------------------------------------------------------------------
async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- Screens ----------------------------------------------------------------
function show(screen) {
  joinScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  finishScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

function fmtTime(ms) {
  if (ms == null) return '';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// --- Board / keyboard rendering --------------------------------------------
function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < cfg.maxGuesses; r++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.style.gridTemplateColumns = `repeat(${cfg.wordLen}, 1fr)`;
    row.dataset.row = String(r);
    for (let c = 0; c < cfg.wordLen; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  for (const keys of KB_ROWS) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    for (const k of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key' + (k === 'ENTER' || k === 'BACK' ? ' wide' : '');
      btn.textContent = k === 'BACK' ? '⌫' : k === 'ENTER' ? 'Enter' : k;
      btn.dataset.key = k;
      btn.addEventListener('click', () => handleKey(k));
      row.appendChild(btn);
    }
    keyboardEl.appendChild(row);
  }
}

function renderBoard() {
  const rows = boardEl.querySelectorAll('.board-row');
  rows.forEach((row, r) => {
    const tiles = row.querySelectorAll('.tile');
    tiles.forEach((tile, c) => {
      tile.className = 'tile';
      tile.textContent = '';
      if (r < game.submitted.length) {
        const { guess, result } = game.submitted[r];
        tile.textContent = guess[c];
        tile.classList.add(result[c]);
      } else if (r === game.submitted.length && !game.finished && game.submitted.length < cfg.maxGuesses) {
        if (c < game.typed.length) {
          tile.textContent = game.typed[c];
          tile.classList.add('filled');
        }
      }
    });
  });
}

function renderKeyboard() {
  keyboardEl.querySelectorAll('.key').forEach((btn) => {
    const k = btn.dataset.key;
    btn.classList.remove('correct', 'present', 'absent');
    if (game.keyState[k]) btn.classList.add(game.keyState[k]);
  });
}

function renderProgress() {
  const n = Math.min(game.currentWord + 1, cfg.wordCount);
  progressEl.textContent = `Word ${n} / ${cfg.wordCount}`;
  pointsEl.textContent = `${game.points} pts`;
}

function setMessage(text, kind) {
  messageEl.textContent = text || '';
  messageEl.className = 'message' + (kind ? ' ' + kind : '');
}

// --- Input ------------------------------------------------------------------
function inputAllowed() {
  return !game.busy && !game.finished && game.submitted.length < cfg.maxGuesses;
}

function handleKey(k) {
  if (!inputAllowed()) return;
  if (k === 'ENTER') {
    submitGuess();
  } else if (k === 'BACK') {
    if (game.typed.length > 0) {
      game.typed = game.typed.slice(0, -1);
      renderBoard();
    }
  } else if (/^[A-Z]$/.test(k) && game.typed.length < cfg.wordLen) {
    game.typed += k;
    renderBoard();
  }
}

function shakeActiveRow() {
  const row = boardEl.querySelector(`.board-row[data-row="${game.submitted.length}"]`);
  if (!row) return;
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 420);
}

function popRow(rowIndex) {
  const row = boardEl.querySelector(`.board-row[data-row="${rowIndex}"]`);
  if (!row) return;
  row.querySelectorAll('.tile').forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('pop');
      setTimeout(() => tile.classList.remove('pop'), 130);
    }, i * 90);
  });
}

function updateKeyState(guess, result) {
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const next = result[i];
    const cur = game.keyState[ch];
    if (!cur || KEY_PRIORITY[next] > KEY_PRIORITY[cur]) game.keyState[ch] = next;
  }
}

async function submitGuess() {
  if (game.typed.length !== cfg.wordLen) {
    setMessage(`Need ${cfg.wordLen} letters`, 'bad');
    shakeActiveRow();
    return;
  }
  const guess = game.typed;
  game.busy = true;
  try {
    const res = await api('/api/guess', { method: 'POST', body: { playerId: game.playerId, guess } });
    const rowIndex = game.submitted.length;
    game.submitted.push({ guess, result: res.result });
    game.typed = '';
    updateKeyState(guess, res.result);
    game.points = res.totalPoints;
    game.solvedCount = res.solvedCount;
    renderBoard();
    renderKeyboard();
    popRow(rowIndex);

    if (res.solved) {
      setMessage(`Solved! +${res.pointsEarned} pts`, 'good');
    } else if (res.gameOverForWord) {
      setMessage(`Out of guesses — the word was ${res.answer}`, 'bad');
    } else {
      setMessage('');
    }

    if (res.gameOverForWord) {
      game.busy = true; // keep locked during the transition beat
      if (res.finished) {
        game.finished = true;
        game.currentWord = res.currentWord;
        renderProgress();
        setTimeout(() => finish(res), 1100);
      } else {
        setTimeout(() => startWord(res.currentWord), 1300);
      }
      return;
    }
    renderProgress();
  } catch (err) {
    setMessage(err.message, 'bad');
    shakeActiveRow();
  } finally {
    if (!game.finished && game.submitted.length < cfg.maxGuesses) game.busy = false;
  }
}

function startWord(index, existingGuesses = []) {
  game.currentWord = index;
  game.submitted = existingGuesses.map((g) => ({ guess: g.guess, result: g.result }));
  game.typed = '';
  game.keyState = {};
  for (const g of game.submitted) updateKeyState(g.guess, g.result);
  game.busy = false;
  setMessage('');
  renderProgress();
  renderBoard();
  renderKeyboard();
}

function finish(info) {
  game.finished = true;
  const ptsLine = `Final score: ${(info && info.totalPoints) || game.points} pts`;
  const solved = (info && info.solvedCount != null) ? info.solvedCount : game.solvedCount;
  el('finish-summary').textContent = `${ptsLine} • ${solved}/${cfg.wordCount} solved`;
  show(finishScreen);
  openLeaderboard();
  refreshLeaderboard();
}

// --- Leaderboard ------------------------------------------------------------
function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
}

async function refreshLeaderboard() {
  let rows;
  try { rows = await api('/api/leaderboard'); } catch { return; }
  lbList.innerHTML = '';
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = 'No players yet — be the first!';
    lbList.appendChild(li);
    return;
  }
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'lb-item' + (game.name && r.name === game.name ? ' me' : '');
    const rank = i + 1;
    const sub = r.finished
      ? `Finished${r.totalMs != null ? ' • ' + fmtTime(r.totalMs) : ''}`
      : `${r.solvedCount}/${cfg.wordCount} solved`;
    li.innerHTML =
      `<span class="lb-rank${rank <= 3 ? ' medal' : ''}">${medal(rank)}</span>` +
      `<span class="lb-name">${escapeHtml(r.name)}` +
      `${r.finished ? ' <span class="flag">🎉</span>' : ''}` +
      `<br/><span class="lb-sub">${sub}</span></span>` +
      `<span class="lb-pts"><b>${r.points}</b><br/><span class="lb-sub">pts</span></span>`;
    lbList.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openLeaderboard() {
  lbEl.classList.remove('hidden');
  lbBackdrop.classList.remove('hidden');
}
function closeLeaderboard() {
  lbEl.classList.add('hidden');
  lbBackdrop.classList.add('hidden');
}

// --- Boot -------------------------------------------------------------------
async function enterGameFromState(state) {
  cfg.wordLen = state.cfg.wordLen;
  cfg.wordCount = state.cfg.wordCount;
  cfg.maxGuesses = state.cfg.maxGuesses;
  game.name = state.name;
  game.points = state.points;
  game.solvedCount = state.solvedCount;
  game.currentWord = state.currentWord;

  buildBoard();
  buildKeyboard();

  if (state.finished) {
    finish({ totalPoints: state.points, solvedCount: state.solvedCount });
    return;
  }
  show(gameScreen);
  game.finished = false;
  startWord(state.currentWord, state.current ? state.current.guesses : []);
}

async function tryResume() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return false;
  try {
    game.playerId = id;
    const state = await api(`/api/state?playerId=${encodeURIComponent(id)}`);
    await enterGameFromState(state);
    return true;
  } catch (err) {
    if (err.status === 404) localStorage.removeItem(STORAGE_KEY);
    game.playerId = null;
    return false;
  }
}

async function handleJoin(e) {
  e.preventDefault();
  const input = el('name-input');
  const name = input.value.trim();
  el('join-error').textContent = '';
  if (!name) { el('join-error').textContent = 'Please enter your name.'; return; }
  try {
    const res = await api('/api/join', { method: 'POST', body: { name } });
    game.playerId = res.playerId;
    localStorage.setItem(STORAGE_KEY, res.playerId);
    const state = await api(`/api/state?playerId=${encodeURIComponent(res.playerId)}`);
    await enterGameFromState(state);
    refreshLeaderboard();
  } catch (err) {
    el('join-error').textContent = err.message;
  }
}

function wireEvents() {
  el('join-form').addEventListener('submit', handleJoin);
  el('leaderboard-toggle').addEventListener('click', () => {
    if (lbEl.classList.contains('hidden')) { openLeaderboard(); refreshLeaderboard(); }
    else closeLeaderboard();
  });
  el('leaderboard-close').addEventListener('click', closeLeaderboard);
  lbBackdrop.addEventListener('click', closeLeaderboard);

  window.addEventListener('keydown', (e) => {
    if (gameScreen.classList.contains('hidden')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') { handleKey('ENTER'); }
    else if (e.key === 'Backspace') { handleKey('BACK'); }
    else if (/^[a-zA-Z]$/.test(e.key)) { handleKey(e.key.toUpperCase()); }
  });
}

async function init() {
  wireEvents();
  try {
    const c = await api('/api/config');
    cfg.wordLen = c.wordLen; cfg.wordCount = c.wordCount; cfg.maxGuesses = c.maxGuesses;
    el('join-count').textContent = String(c.wordCount);
  } catch { /* keep defaults */ }

  const resumed = await tryResume();
  if (!resumed) show(joinScreen);

  refreshLeaderboard();
  setInterval(refreshLeaderboard, 2500);
}

init();
