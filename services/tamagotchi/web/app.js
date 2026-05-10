// === play-mode sprites ===
// Two explicit side-profile sprites. No CSS mirror — keeps the orientation
// reading correct regardless of any other transform.
//
// Looking LEFT: snout sticks out on the left, single eye on left half,
// mouth on left half, tail-bump on right.
const PLAY_SPRITE_LEFT = `
  <g fill="#0f380f">
    <rect x="6"  y="8"  width="20" height="16"/>
    <rect x="8"  y="6"  width="16" height="2"/>
    <rect x="8"  y="24" width="16" height="2"/>
    <rect x="4"  y="10" width="2"  height="12"/>
    <rect x="26" y="10" width="2"  height="12"/>
    <rect x="2"  y="13" width="2"  height="6"/>
    <rect x="0"  y="15" width="2"  height="2"/>
    <rect x="28" y="14" width="2"  height="4"/>
    <rect x="9"  y="3"  width="2"  height="3"/>
    <rect x="13" y="4"  width="2"  height="2"/>
    <rect x="8"  y="26" width="3"  height="3"/>
    <rect x="14" y="26" width="3"  height="3"/>
    <rect x="20" y="26" width="3"  height="3"/>
  </g>
  <g fill="#9bbc0f">
    <rect x="6"  y="10" width="20" height="14"/>
    <rect x="8"  y="8"  width="16" height="2"/>
  </g>
  <g fill="#0f380f">
    <rect x="7"  y="12" width="3"  height="4"/>
    <rect x="5"  y="19" width="5"  height="1"/>
    <rect x="6"  y="20" width="3"  height="1"/>
  </g>`;

// Looking RIGHT: hand-mirrored coordinates — snout on the right, single
// eye on the right half, mouth on the right, tail-bump on the left.
const PLAY_SPRITE_RIGHT = `
  <g fill="#0f380f">
    <rect x="6"  y="8"  width="20" height="16"/>
    <rect x="8"  y="6"  width="16" height="2"/>
    <rect x="8"  y="24" width="16" height="2"/>
    <rect x="4"  y="10" width="2"  height="12"/>
    <rect x="26" y="10" width="2"  height="12"/>
    <rect x="28" y="13" width="2"  height="6"/>
    <rect x="30" y="15" width="2"  height="2"/>
    <rect x="2"  y="14" width="2"  height="4"/>
    <rect x="19" y="3"  width="2"  height="3"/>
    <rect x="15" y="4"  width="2"  height="2"/>
    <rect x="9"  y="26" width="3"  height="3"/>
    <rect x="15" y="26" width="3"  height="3"/>
    <rect x="21" y="26" width="3"  height="3"/>
  </g>
  <g fill="#9bbc0f">
    <rect x="6"  y="10" width="20" height="14"/>
    <rect x="8"  y="8"  width="16" height="2"/>
  </g>
  <g fill="#0f380f">
    <rect x="22" y="12" width="3"  height="4"/>
    <rect x="22" y="19" width="5"  height="1"/>
    <rect x="23" y="20" width="3"  height="1"/>
  </g>`;

// Neutral: symmetric, both eyes centered, no snout/tail. Shown before
// the user has guessed for the round.
const PLAY_SPRITE_NEUTRAL = `
  <g fill="#0f380f">
    <rect x="7"  y="7"  width="18" height="18"/>
    <rect x="5"  y="9"  width="2"  height="14"/>
    <rect x="25" y="9"  width="2"  height="14"/>
    <rect x="9"  y="5"  width="2"  height="2"/>
    <rect x="21" y="5"  width="2"  height="2"/>
    <rect x="9"  y="25" width="3"  height="3"/>
    <rect x="20" y="25" width="3"  height="3"/>
  </g>
  <g fill="#9bbc0f">
    <rect x="9"  y="9"  width="14" height="14"/>
  </g>
  <g fill="#0f380f">
    <rect x="12" y="13" width="2"  height="3"/>
    <rect x="18" y="13" width="2"  height="3"/>
    <rect x="13" y="19" width="6"  height="1"/>
  </g>`;

// === sprite definitions ===
const SPRITES = {
  egg: `
    <g fill="#0f380f">
      <rect x="13" y="6"  width="6"  height="2"/>
      <rect x="11" y="8"  width="10" height="2"/>
      <rect x="9"  y="10" width="14" height="2"/>
      <rect x="8"  y="12" width="16" height="8"/>
      <rect x="9"  y="20" width="14" height="2"/>
      <rect x="11" y="22" width="10" height="2"/>
      <rect x="13" y="24" width="6"  height="2"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="11" y="14" width="2" height="2"/>
      <rect x="19" y="14" width="2" height="2"/>
    </g>`,
  baby: `
    <g fill="#0f380f">
      <rect x="12" y="10" width="8"  height="2"/>
      <rect x="10" y="12" width="12" height="2"/>
      <rect x="9"  y="14" width="14" height="6"/>
      <rect x="10" y="20" width="12" height="2"/>
      <rect x="12" y="22" width="2"  height="2"/>
      <rect x="18" y="22" width="2"  height="2"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="12" y="14" width="2" height="2"/>
      <rect x="18" y="14" width="2" height="2"/>
      <rect x="14" y="17" width="4" height="1"/>
    </g>`,
  child: `
    <g fill="#0f380f">
      <rect x="11" y="6"  width="10" height="2"/>
      <rect x="9"  y="8"  width="14" height="2"/>
      <rect x="8"  y="10" width="16" height="10"/>
      <rect x="9"  y="20" width="14" height="2"/>
      <rect x="10" y="22" width="4"  height="3"/>
      <rect x="18" y="22" width="4"  height="3"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="12" y="12" width="2" height="3"/>
      <rect x="18" y="12" width="2" height="3"/>
      <rect x="13" y="17" width="6" height="1"/>
    </g>`,
  teen: `
    <g fill="#0f380f">
      <rect x="10" y="4"  width="12" height="2"/>
      <rect x="8"  y="6"  width="16" height="2"/>
      <rect x="7"  y="8"  width="18" height="14"/>
      <rect x="9"  y="22" width="14" height="2"/>
      <rect x="9"  y="24" width="3"  height="3"/>
      <rect x="20" y="24" width="3"  height="3"/>
      <rect x="4"  y="14" width="3"  height="3"/>
      <rect x="25" y="14" width="3"  height="3"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="11" y="12" width="3" height="3"/>
      <rect x="18" y="12" width="3" height="3"/>
      <rect x="13" y="18" width="6" height="2"/>
    </g>`,
  adult: `
    <g fill="#0f380f">
      <rect x="9"  y="3"  width="14" height="2"/>
      <rect x="7"  y="5"  width="18" height="2"/>
      <rect x="6"  y="7"  width="20" height="16"/>
      <rect x="8"  y="23" width="16" height="2"/>
      <rect x="8"  y="25" width="4"  height="3"/>
      <rect x="20" y="25" width="4"  height="3"/>
      <rect x="3"  y="13" width="3"  height="4"/>
      <rect x="26" y="13" width="3"  height="4"/>
      <rect x="9"  y="1"  width="3"  height="3"/>
      <rect x="20" y="1"  width="3"  height="3"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="10" y="11" width="3" height="4"/>
      <rect x="19" y="11" width="3" height="4"/>
      <rect x="12" y="18" width="8" height="2"/>
      <rect x="13" y="20" width="6" height="1"/>
    </g>`,
  senior: `
    <g fill="#0f380f">
      <rect x="9"  y="5"  width="14" height="2"/>
      <rect x="7"  y="7"  width="18" height="2"/>
      <rect x="6"  y="9"  width="20" height="14"/>
      <rect x="8"  y="23" width="16" height="2"/>
      <rect x="9"  y="25" width="3"  height="3"/>
      <rect x="20" y="25" width="3"  height="3"/>
      <rect x="3"  y="14" width="3"  height="3"/>
      <rect x="26" y="14" width="3"  height="3"/>
    </g>
    <g fill="#9bbc0f">
      <rect x="11" y="12" width="2" height="2"/>
      <rect x="19" y="12" width="2" height="2"/>
      <rect x="13" y="18" width="6" height="1"/>
      <rect x="9"  y="11" width="14" height="1"/>
    </g>`,
  dead: `
    <g fill="#0f380f">
      <rect x="9"  y="6"  width="14" height="2"/>
      <rect x="7"  y="8"  width="18" height="2"/>
      <rect x="7"  y="10" width="2"  height="14"/>
      <rect x="23" y="10" width="2"  height="14"/>
      <rect x="9"  y="24" width="14" height="2"/>
      <rect x="11" y="14" width="3"  height="3"/>
      <rect x="18" y="14" width="3"  height="3"/>
      <rect x="11" y="20" width="10" height="1"/>
    </g>`,
};

// === DOM === //
const els = {
  screen:    document.getElementById("screen"),
  pet:       document.getElementById("pet"),
  hudName:   document.getElementById("hud-name"),
  hudStage:  document.getElementById("hud-stage"),
  hudAge:    document.getElementById("hud-age"),
  poops:     document.getElementById("poops"),
  alert:     document.getElementById("alert"),
  sick:      document.getElementById("sick-cross"),
  floaty:    document.getElementById("floaty"),
  hungerHearts:    document.getElementById("hearts-hunger"),
  happyHearts:     document.getElementById("hearts-happy"),
  disciplinePips:  document.getElementById("discipline-pips"),
  ticker:    document.getElementById("ticker"),
  playModal: document.getElementById("play-modal"),
  playTitle: document.getElementById("play-title"),
  playPet:   document.getElementById("play-pet"),
  playTrack: document.getElementById("play-track"),
  lookArrow: document.getElementById("look-arrow"),
  playFeedback: document.getElementById("play-feedback"),
  statusModal: document.getElementById("status-modal"),
  statusBody:  document.getElementById("status-body"),
  statusClose: document.getElementById("status-close"),
};

let pollTimer = null;
let lastState = null;
let lastSpriteHash = "";

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch (e) {}
}

function fmtAge(years, minutes) {
  // Show pet years primarily; show real-time min for the freshly hatched.
  if (minutes < 60) return `${minutes}m`;
  return `${years}y`;
}

function renderHearts(container, n, max=4) {
  container.innerHTML = "";
  for (let i = 0; i < max; i++) {
    const span = document.createElement("span");
    span.className = "heart" + (i < n ? "" : " empty");
    span.textContent = i < n ? "♥" : "♡";
    container.appendChild(span);
  }
}

function renderDiscipline(container, pct) {
  container.innerHTML = "";
  const filled = Math.round(pct / 25);
  for (let i = 0; i < 4; i++) {
    const pip = document.createElement("span");
    pip.className = "pip" + (i < filled ? " filled" : "");
    container.appendChild(pip);
  }
}

function spriteHash(pet) {
  return [pet.life_stage, pet.is_sleeping ? 1 : 0, pet.is_sick ? 1 : 0, pet.alive ? 1 : 0].join("/");
}

function showFloaty(text) {
  els.floaty.textContent = text;
  els.floaty.classList.remove("show");
  // Force reflow to restart animation.
  void els.floaty.offsetWidth;
  els.floaty.classList.add("show");
}

function pulse(cls) {
  els.pet.classList.remove(cls);
  void els.pet.offsetWidth;
  els.pet.classList.add(cls);
  setTimeout(() => els.pet.classList.remove(cls), 800);
}

function render(pet, msg) {
  const hash = spriteHash(pet);
  if (hash !== lastSpriteHash) {
    els.pet.innerHTML = SPRITES[pet.life_stage] || SPRITES.egg;
    lastSpriteHash = hash;
  }
  els.pet.dataset.stage = pet.life_stage;
  els.pet.dataset.sleeping = pet.is_sleeping ? "1" : "0";
  els.pet.dataset.sick = pet.is_sick ? "1" : "0";

  els.hudName.textContent = pet.name + " · gen " + pet.generation;
  els.hudStage.textContent = pet.life_stage;
  els.hudAge.textContent = fmtAge(pet.age_years, pet.age_minutes);

  renderHearts(els.hungerHearts, pet.hunger_hearts);
  renderHearts(els.happyHearts,  pet.happiness_hearts);
  renderDiscipline(els.disciplinePips, pet.discipline);

  els.poops.textContent = "💩".repeat(Math.min(pet.poop_count, 4));

  els.alert.dataset.show = (pet.alive && pet.wants_attention && !pet.is_sleeping) ? "1" : "0";
  // Sickness IS visible to the player despite the pet being silent.
  els.sick.dataset.show = (pet.alive && pet.is_sick && !pet.is_sleeping) ? "1" : "0";

  // Lights-out class — only when actually sleeping with lights off.
  if (pet.is_sleeping && pet.lights_off) {
    els.screen.classList.add("dark");
  } else {
    els.screen.classList.remove("dark");
  }

  if (msg) {
    els.ticker.textContent = msg;
  } else if (!pet.alive) {
    els.ticker.textContent = "your pet has passed away — tap reset";
  } else if (pet.is_sleeping) {
    els.ticker.textContent = pet.lights_off ? "good night..." : "turn off the lights!";
  } else if (pet.is_sick) {
    els.ticker.textContent = "pet looks unwell — give medicine";
  } else if (pet.hunger_hearts === 0) {
    els.ticker.textContent = "pet is starving!";
  } else if (pet.happiness_hearts === 0) {
    els.ticker.textContent = "pet is miserable";
  } else if (pet.poop_count > 0) {
    els.ticker.textContent = `${pet.poop_count} poop(s) — clean up`;
  } else if (pet.wants_attention) {
    els.ticker.textContent = "pet wants attention";
  } else {
    els.ticker.textContent = `${pet.name} is doing fine`;
  }

  document.querySelectorAll(".pad .btn, .pad-2 .btn").forEach(b => {
    const act = b.dataset.act;
    if (act === "reset" || act === "status" || act === "lights") { b.disabled = false; return; }
    b.disabled = !pet.alive;
  });

  lastState = pet;
}

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "content-type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
  return r.json();
}

async function refresh() {
  try {
    const pet = await api("/api/pet");
    render(pet);
  } catch (e) {
    els.ticker.textContent = "offline — retrying...";
  }
}

// === Play mini-game (5 rounds, per-round reveal) ===
function setPlayPetNeutral() {
  els.playPet.innerHTML = PLAY_SPRITE_NEUTRAL;
  els.playPet.removeAttribute("data-look");
}

function setPlayPetLooking(direction) {
  els.playPet.innerHTML = direction === "left" ? PLAY_SPRITE_LEFT : PLAY_SPRITE_RIGHT;
  els.playPet.dataset.look = direction;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function openPlayModal() {
  if (!lastState || !lastState.alive || lastState.is_sleeping) return null;

  els.playModal.hidden = false;
  setPlayPetNeutral();
  els.lookArrow.textContent = "?";
  els.playFeedback.textContent = "";
  els.playFeedback.className = "play-feedback";
  els.playTitle.textContent = "round 1 of 5";
  els.playTrack.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    els.playTrack.appendChild(pip);
  }

  const setBtns = (disabled) => {
    els.playModal.querySelectorAll("[data-guess]").forEach(b => b.disabled = disabled);
  };

  let wins = 0;

  for (let round = 0; round < 5; round++) {
    els.playTitle.textContent = `round ${round + 1} of 5`;
    els.lookArrow.textContent = "?";
    els.playFeedback.textContent = "";
    els.playFeedback.className = "play-feedback";
    setPlayPetNeutral();
    setBtns(false);

    // Wait for guess.
    const guess = await new Promise(resolve => {
      const handler = (e) => {
        const g = e.currentTarget.dataset.guess;
        if (!g) return;
        vibrate(15);
        els.playModal.querySelectorAll("[data-guess]").forEach(b => b.removeEventListener("click", handler));
        resolve(g);
      };
      els.playModal.querySelectorAll("[data-guess]").forEach(b => b.addEventListener("click", handler));
    });

    setBtns(true);

    // Brief "thinking" beat — pet bobs in place.
    els.playPet.classList.add("thinking");
    await sleep(380);
    els.playPet.classList.remove("thinking");

    // Ask the server which way the pet looked this round.
    let result;
    try {
      result = await api("/api/play/round", "POST", { guess });
    } catch (e) {
      els.playModal.hidden = true;
      return null;
    }

    // Reveal: arrow + sprite flip.
    setPlayPetLooking(result.direction);
    els.lookArrow.textContent = result.direction === "left" ? "←" : "→";

    // Show win/loss feedback.
    const won = result.won;
    if (won) wins++;
    els.playFeedback.textContent = won ? "yes!" : "missed";
    els.playFeedback.className = "play-feedback " + (won ? "win" : "loss");
    const pip = els.playTrack.children[round];
    pip.classList.add(won ? "win" : "loss");

    await sleep(1100);
  }

  // Finish — apply the outcome on the server.
  els.playTitle.textContent = `${wins} / 5`;
  setBtns(true);
  let res = null;
  try {
    res = await api("/api/play/finish", "POST", { wins });
  } catch (e) {}

  await sleep(900);
  els.playModal.hidden = true;
  if (wins >= 3) pulse("celebrate");
  else pulse("shake");
  return res;
}

// === Status panel ===
function fmtRealMs(ms) {
  const d = new Date(ms);
  return d.toLocaleString();
}

function openStatusModal() {
  const p = lastState;
  if (!p) return;
  const lines = [
    `name        ${p.name}`,
    `gen         ${p.generation}`,
    `stage       ${p.life_stage}`,
    `age         ${p.age_years}y (${p.age_minutes}m sim)`,
    `weight      ${p.weight} oz`,
    `hunger      ${p.hunger_hearts}/4 hearts (${p.hunger.toFixed(2)})`,
    `happy       ${p.happiness_hearts}/4 hearts (${p.happiness.toFixed(2)})`,
    `discipline  ${Math.round(p.discipline)}%`,
    `poops       ${p.poop_count}`,
    `sick        ${p.is_sick ? `yes (${p.sick_doses_needed} dose(s) left)` : "no"}`,
    `sleeping    ${p.is_sleeping ? `yes (lights ${p.lights_off ? "off" : "ON"})` : "no"}`,
    `mistakes    ${p.care_mistakes} (this stage: ${p.stage_care_mistakes})`,
    `wants attn  ${p.wants_attention ? (p.attention_real ? "yes (real)" : "yes (false alarm)") : "no"}`,
    `born        ${fmtRealMs(p.born_at)}`,
  ];
  els.statusBody.textContent = lines.join("\n");
  els.statusModal.hidden = false;
}

els.statusClose.addEventListener("click", () => {
  vibrate(10);
  els.statusModal.hidden = true;
});

// === Action handlers ===
const ACTIONS = {
  "feed-meal":  async () => {
    pulse("eat"); showFloaty("🍚");
    return api("/api/feed", "POST", { kind: "meal" });
  },
  "feed-snack": async () => {
    pulse("eat"); showFloaty("🍬");
    return api("/api/feed", "POST", { kind: "snack" });
  },
  "play":       () => openPlayModal(),
  "clean":      async () => { showFloaty("✨"); return api("/api/clean", "POST"); },
  "heal":       async () => { showFloaty("💊"); return api("/api/heal", "POST"); },
  "discipline": async () => {
    pulse("shake");
    return api("/api/discipline", "POST");
  },
  "lights":     () => api("/api/lights", "POST"),
  "status":     () => { openStatusModal(); return null; },
  "reset":      () => {
    if (!confirm("Hatch a new egg? Current pet will be lost.")) return null;
    const name = (prompt("Name your new pet:", "Tama") || "Tama").trim().slice(0, 16) || "Tama";
    return api("/api/reset", "POST", { name });
  },
};

document.querySelectorAll(".pad .btn, .pad-2 .btn").forEach(b => {
  b.addEventListener("click", async () => {
    const fn = ACTIONS[b.dataset.act];
    if (!fn) return;
    vibrate(b.classList.contains("danger") ? [40, 30, 40] : 18);
    try {
      const res = await fn();
      if (res === null) return;
      if (res.pet) render(res.pet, res.msg);
      else if (res.id !== undefined) render(res);
    } catch (e) {
      els.ticker.textContent = "action failed";
    }
  });
});

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refresh, 3000);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refresh();
    startPolling();
  } else {
    stopPolling();
  }
});

async function setupDevPanel() {
  try {
    const s = await api("/api/dev/status");
    if (!s?.enabled) return;
    const pad = document.getElementById("dev-pad");
    pad.hidden = false;
    pad.querySelectorAll("[data-ff]").forEach(b => {
      b.addEventListener("click", async () => {
        const minutes = parseInt(b.dataset.ff, 10);
        vibrate(15);
        try {
          const res = await api("/api/dev/advance", "POST", { minutes });
          render(res.pet, res.msg);
        } catch (e) {
          els.ticker.textContent = "advance failed";
        }
      });
    });
  } catch (e) {}
}

setupDevPanel();
refresh();
startPolling();
