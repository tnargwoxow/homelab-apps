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
  hudStars:  document.getElementById("hud-stars"),
  hudClock:  document.getElementById("hud-clock"),
  soundBtn:  document.getElementById("sound-btn"),
  confetti:  document.getElementById("confetti"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile:document.getElementById("import-file"),
  portraitBtn: document.getElementById("portrait-btn"),
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
  achModal:    document.getElementById("achievements-modal"),
  achBody:     document.getElementById("achievements-body"),
  achClose:    document.getElementById("achievements-close"),
  achToast:    document.getElementById("achievement-toast"),
  deathModal:  document.getElementById("death-modal"),
  deathBody:   document.getElementById("death-body"),
  deathClose:  document.getElementById("death-close"),
  eggModal:    document.getElementById("egg-modal"),
  eggBig:      document.getElementById("egg-big"),
  eggProgress: document.getElementById("egg-progress"),
  eggClose:    document.getElementById("egg-close"),
  eggTapArea:  document.getElementById("egg-tap-area"),
};

let pollTimer = null;
let lastState = null;
let lastSpriteHash = "";
let lastWasAlive = true;
let deathHandled = false;

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch (e) {}
}

// === Sound system (Web Audio) ===
const SoundEngine = (() => {
  let ctx = null;
  let enabled = localStorage.getItem("tamagotchi_sound") === "1";

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, durMs, type = "square", vol = 0.08) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000);
  }

  function sequence(notes) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    let when = c.currentTime;
    for (const [freq, dur, type = "square", vol = 0.08] of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      gain.gain.setValueAtTime(vol, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur / 1000);
      osc.connect(gain).connect(c.destination);
      osc.start(when);
      osc.stop(when + dur / 1000);
      when += dur / 1000;
    }
  }

  // The library — keep them short, gameboy-y, square waves.
  const sounds = {
    click:        () => tone(800, 30, "square", 0.05),
    feedMeal:     () => sequence([[600, 90], [780, 110]]),
    feedSnack:    () => tone(900, 80, "square", 0.07),
    playStart:    () => sequence([[500, 60], [700, 60]]),
    playWin:      () => sequence([[523, 90], [659, 90], [784, 140]]),  // C-E-G
    playLoss:     () => sequence([[523, 110], [415, 110], [349, 180]]),// C-Ab-F
    clean:        () => sequence([[1200, 40, "sawtooth", 0.05], [900, 40, "sawtooth", 0.05]]),
    heal:         () => sequence([[700, 80], [900, 80], [1100, 100]]),
    scoldBad:     () => tone(180, 220, "sawtooth", 0.08),
    scoldOk:      () => sequence([[400, 60], [550, 60]]),
    lights:       () => tone(420, 60, "triangle", 0.06),
    attention:    () => sequence([[880, 100], [660, 100], [880, 100]]),
    crack:        () => tone(1100, 60, "sawtooth", 0.07),
    hatch:        () => sequence([[400, 100], [550, 100], [700, 100], [900, 200]]),
    death:        () => sequence([[300, 250, "triangle", 0.08], [220, 250, "triangle", 0.08], [160, 600, "triangle", 0.08]]),
    levelUp:      () => sequence([[523, 80], [659, 80], [784, 80], [1046, 200]]),
    achievement:  () => sequence([[784, 60], [988, 60], [1318, 140]]),
  };

  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem("tamagotchi_sound", enabled ? "1" : "0");
    if (els.soundBtn) {
      els.soundBtn.textContent = enabled ? "🔊" : "🔇";
      els.soundBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
  }

  function toggle() {
    setEnabled(!enabled);
    if (enabled) tone(700, 80);
  }

  return { play: (name) => { sounds[name]?.(); }, toggle, setEnabled, isEnabled: () => enabled };
})();

if (els.soundBtn) {
  SoundEngine.setEnabled(SoundEngine.isEnabled());
  els.soundBtn.addEventListener("click", () => {
    SoundEngine.toggle();
  });
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

function renderStars(pet) {
  // 5 stars; one drops per ~3 stage-mistakes, never below 1 unless dead.
  const m = pet.stage_care_mistakes || 0;
  let n = 5;
  if (m >= 1) n = 4;
  if (m >= 3) n = 3;
  if (m >= 6) n = 2;
  if (m >= 10) n = 1;
  if (!pet.alive) n = 0;
  els.hudStars.textContent = "★".repeat(n) + "☆".repeat(5 - n);
}

function showAchievementToast(label) {
  els.achToast.textContent = "🏆 " + label;
  els.achToast.hidden = false;
  // Force reflow then add the show class.
  void els.achToast.offsetWidth;
  els.achToast.classList.add("show");
  SoundEngine.play("achievement");
  setTimeout(() => {
    els.achToast.classList.remove("show");
    setTimeout(() => { els.achToast.hidden = true; }, 400);
  }, 2400);
}

const ACH_LABELS = {
  first_feed:   "First bite",
  first_play:   "First win",
  first_clean:  "Tidy",
  first_heal:   "Doctor",
  first_scold:  "Strict",
  reach_child:  "Toddler",
  reach_teen:   "Teenage years",
  reach_adult:  "Adulthood",
  reach_senior: "Long life",
  gen_3:        "Generations",
  perfect_baby: "Spotless start",
  perfect_teen: "Model child",
};

function handleAchievements(ids) {
  if (!ids || !ids.length) return;
  // Show one at a time, queued.
  let i = 0;
  const next = () => {
    if (i >= ids.length) return;
    showAchievementToast(ACH_LABELS[ids[i]] || ids[i]);
    i++;
    setTimeout(next, 2600);
  };
  next();
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

function triggerLevelUp() {
  pulse("levelup");
  // Confetti burst.
  const emoji = ["✨", "🎉", "⭐", "🌟", "💫"];
  els.confetti.hidden = false;
  els.confetti.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.textContent = emoji[i % emoji.length];
    s.style.left = (10 + Math.random() * 80) + "%";
    s.style.top = (20 + Math.random() * 30) + "%";
    s.style.animationDelay = (Math.random() * 0.3) + "s";
    els.confetti.appendChild(s);
  }
  setTimeout(() => { els.confetti.hidden = true; els.confetti.innerHTML = ""; }, 1700);
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
  renderStars(pet);

  // Stage transition: hatch (egg→baby) or level-up (anything else).
  if (lastState && pet.life_stage !== lastState.life_stage && pet.alive && pet.life_stage !== "dead") {
    if (lastState.life_stage === "egg") {
      SoundEngine.play("hatch");
      triggerLevelUp();
    } else {
      SoundEngine.play("levelUp");
      triggerLevelUp();
    }
  }

  // Death detection — fire once per death.
  if (lastWasAlive && !pet.alive && !deathHandled) {
    deathHandled = true;
    SoundEngine.play("death");
    setTimeout(() => openDeathModal(pet), 600);
  }
  if (pet.alive) deathHandled = false;
  lastWasAlive = pet.alive;

  // Attention call — beep once on transition false→true.
  if (lastState && !lastState.wants_attention && pet.wants_attention && !pet.is_sleeping) {
    SoundEngine.play("attention");
  }

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
  if (lastState.life_stage === "egg") return openEggModal();

  els.playModal.hidden = false;
  SoundEngine.play("playStart");
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
    SoundEngine.play(won ? "playWin" : "playLoss");
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
  if (wins >= 3) { pulse("celebrate"); SoundEngine.play("playWin"); }
  else { pulse("shake"); SoundEngine.play("playLoss"); }
  if (res?.achievements) handleAchievements(res.achievements);
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
  SoundEngine.play("click");
  els.statusModal.hidden = true;
});

// === Achievements modal ===
async function openAchievementsModal() {
  els.achModal.hidden = false;
  els.achBody.textContent = "loading...";
  try {
    const data = await api("/api/achievements");
    els.achBody.innerHTML = "";
    const header = document.createElement("div");
    header.className = "modal-title";
    header.style.fontSize = "11px";
    header.style.opacity = "0.7";
    header.textContent = `${data.earned} / ${data.total} unlocked`;
    els.achBody.appendChild(header);
    for (const a of data.achievements) {
      const row = document.createElement("div");
      row.className = "ach" + (a.earned ? "" : " locked");
      row.innerHTML = `
        <span class="icon">${a.earned ? "🏆" : "🔒"}</span>
        <div>
          <div class="label">${a.label}</div>
          <div class="desc">${a.description}</div>
        </div>`;
      els.achBody.appendChild(row);
    }
  } catch (e) {
    els.achBody.textContent = "couldn't load";
  }
}
els.achClose.addEventListener("click", () => {
  vibrate(10); SoundEngine.play("click");
  els.achModal.hidden = true;
});

// === Death modal ===
function openDeathModal(pet) {
  const lifetime = pet.age_minutes;
  const lifetimeText = lifetime < 60
    ? `${lifetime} min`
    : `${Math.floor(lifetime / 60)}h ${lifetime % 60}m`;
  els.deathBody.textContent = [
    `${pet.name}`,
    `gen ${pet.generation}, ${pet.character}`,
    `lived ${lifetimeText}`,
    `peaked at ${pet.life_stage}`,
    `care mistakes: ${pet.care_mistakes}`,
    ``,
    pet.care_mistakes < 3 ? `a life well lived.` : `you'll do better next time.`,
  ].join("\n");
  els.deathModal.hidden = false;
}
els.deathClose.addEventListener("click", async () => {
  vibrate(20);
  els.deathModal.hidden = true;
  const name = (prompt("Name the next pet:", "Tama") || "Tama").trim().slice(0, 16) || "Tama";
  deathHandled = false;
  try {
    const res = await api("/api/reset", "POST", { name });
    SoundEngine.play("hatch");
    if (res?.pet) render(res.pet, res.msg);
  } catch (e) {}
});

// === Egg-hatch tap mini-game ===
const EGG_SPRITE = SPRITES.egg;
const EGG_CRACK_OVERLAYS = [
  // 0 cracks
  ``,
  // 1 crack
  `<g fill="#9bbc0f">
    <rect x="11" y="12" width="2" height="2"/>
    <rect x="13" y="14" width="2" height="2"/>
  </g>`,
  // 2 cracks
  `<g fill="#9bbc0f">
    <rect x="11" y="12" width="2" height="2"/>
    <rect x="13" y="14" width="2" height="2"/>
    <rect x="15" y="12" width="2" height="2"/>
    <rect x="17" y="14" width="2" height="2"/>
    <rect x="14" y="16" width="2" height="2"/>
  </g>`,
  // hatched (full open)
  `<g fill="#9bbc0f">
    <rect x="9" y="11" width="14" height="10"/>
  </g>`,
];

let eggTaps = 0;

function renderEgg(taps) {
  const overlay = EGG_CRACK_OVERLAYS[Math.min(taps, EGG_CRACK_OVERLAYS.length - 1)];
  els.eggBig.innerHTML = SPRITES.egg + overlay;
  els.eggProgress.textContent = `${Math.min(taps, 3)} / 3`;
}

function openEggModal() {
  if (lastState?.life_stage !== "egg" || !lastState?.alive) return null;
  eggTaps = 0;
  renderEgg(0);
  els.eggModal.hidden = false;
  return null;
}

async function tapEgg() {
  vibrate(20);
  els.eggBig.classList.remove("shake");
  void els.eggBig.offsetWidth;
  els.eggBig.classList.add("shake");
  SoundEngine.play("crack");
  try {
    const res = await api("/api/tap-egg", "POST");
    if (res?.result?.taps) eggTaps = res.result.taps;
    renderEgg(eggTaps);
    if (res?.result?.hatched) {
      SoundEngine.play("hatch");
      els.eggProgress.textContent = "hatching!";
      setTimeout(() => {
        els.eggModal.hidden = false; // keep visible briefly
        els.eggModal.hidden = true;
        if (res?.pet) render(res.pet, res.msg);
      }, 1200);
    } else if (res?.pet) {
      // Don't auto-render the main view; keep focus on the egg modal.
      lastState = res.pet;
    }
  } catch (e) {}
}

els.eggTapArea.addEventListener("click", tapEgg);
els.eggClose.addEventListener("click", () => {
  vibrate(10); SoundEngine.play("click");
  els.eggModal.hidden = true;
});

// === Action handlers ===
const ACTIONS = {
  "feed-meal":  async () => {
    if (lastState?.life_stage === "egg") return openEggModal();
    pulse("eat"); showFloaty("🍚"); SoundEngine.play("feedMeal");
    return api("/api/feed", "POST", { kind: "meal" });
  },
  "feed-snack": async () => {
    if (lastState?.life_stage === "egg") return openEggModal();
    pulse("eat"); showFloaty("🍬"); SoundEngine.play("feedSnack");
    return api("/api/feed", "POST", { kind: "snack" });
  },
  "play": () => {
    if (lastState?.life_stage === "egg") return openEggModal();
    return openPlayModal();
  },
  "clean":      async () => { showFloaty("✨"); SoundEngine.play("clean"); return api("/api/clean", "POST"); },
  "heal":       async () => { showFloaty("💊"); SoundEngine.play("heal"); return api("/api/heal", "POST"); },
  "discipline": async () => {
    pulse("shake");
    const res = await api("/api/discipline", "POST");
    if (res?.msg?.includes("false alarm")) SoundEngine.play("scoldOk");
    else SoundEngine.play("scoldBad");
    return res;
  },
  "lights": async () => {
    SoundEngine.play("lights");
    return api("/api/lights", "POST");
  },
  "status":     () => { SoundEngine.play("click"); openStatusModal(); return null; },
  "achievements": () => { SoundEngine.play("click"); openAchievementsModal(); return null; },
  "reset":      () => {
    if (!confirm("Hatch a new egg? Current pet will be lost.")) return null;
    const name = (prompt("Name your new pet:", "Tama") || "Tama").trim().slice(0, 16) || "Tama";
    deathHandled = false;
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
      if (res.pet) {
        render(res.pet, res.msg);
        handleAchievements(res.achievements);
      }
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

// === Clock display in HUD ===
async function refreshClock() {
  try {
    const c = await api("/api/clock");
    if (!c) return;
    const hh = String(c.hour).padStart(2, "0");
    const mm = String(c.minute).padStart(2, "0");
    els.hudClock.textContent = `${hh}:${mm}`;
    els.hudClock.classList.toggle("dev-offset", (c.offset_minutes || 0) !== 0);
    els.hudClock.title = c.offset_minutes
      ? `dev offset +${c.offset_minutes}m | sleep ${c.schedule.start}→${c.schedule.end}`
      : `sleep ${c.schedule.start}→${c.schedule.end}`;
  } catch (e) {}
}

// === Save / Load / Portrait ===
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

async function exportSave() {
  vibrate(10); SoundEngine.play("click");
  try {
    const data = await api("/api/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `tamagotchi-${data.pet?.name || "save"}-${date}.json`);
  } catch (e) {
    els.ticker.textContent = "save failed";
  }
}

function importSave() {
  vibrate(10); SoundEngine.play("click");
  els.importFile.value = "";
  els.importFile.click();
}

els.importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!confirm("Replace your current pet with this save?")) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const res = await api("/api/import", "POST", { pet: data.pet });
    if (res?.pet) {
      render(res.pet, "imported");
      els.achModal.hidden = true;
    }
  } catch (err) {
    alert("Couldn't load that file.");
  }
});

function exportPortrait() {
  vibrate(10); SoundEngine.play("click");
  // Render the current SVG to a 256×256 canvas and download.
  const svg = els.pet.outerHTML;
  const blob = new Blob([
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256" style="image-rendering:pixelated">
      <rect width="32" height="32" fill="#9bbc0f"/>
      ${els.pet.innerHTML}
    </svg>`
  ], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 256, 256);
    canvas.toBlob((b) => {
      URL.revokeObjectURL(url);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(b, `${(lastState?.name || "tama")}-${lastState?.life_stage || "pet"}-${date}.png`);
    }, "image/png");
  };
  img.src = url;
}

els.exportBtn.addEventListener("click", exportSave);
els.importBtn.addEventListener("click", importSave);
els.portraitBtn.addEventListener("click", exportPortrait);

// === Keyboard shortcuts ===
const KEYBOARD_MAP = {
  "1": "feed-meal", "2": "feed-snack", "3": "play",       "4": "clean",
  "5": "heal",      "6": "discipline", "7": "lights",     "8": "status",
  "9": "achievements",
  "f": "feed-meal", "p": "play", "c": "clean", "h": "heal", "s": "scold",
  "l": "lights",
};

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  // Play modal: arrow keys for guesses
  if (!els.playModal.hidden) {
    if (e.key === "ArrowLeft" || e.key === "a") {
      const b = els.playModal.querySelector('[data-guess="left"]');
      if (b && !b.disabled) b.click();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "d") {
      const b = els.playModal.querySelector('[data-guess="right"]');
      if (b && !b.disabled) b.click();
      return;
    }
    if (e.key === "Escape") { els.playModal.hidden = true; return; }
  }
  // Egg modal: spacebar to tap
  if (!els.eggModal.hidden) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapEgg(); return; }
    if (e.key === "Escape") { els.eggModal.hidden = true; return; }
  }
  // Status / achievements modal: Esc to close
  if (e.key === "Escape") {
    els.statusModal.hidden = true;
    els.achModal.hidden = true;
    return;
  }
  // Map number/letter to action
  const act = KEYBOARD_MAP[e.key.toLowerCase()];
  if (act) {
    const btn = document.querySelector(`.pad .btn[data-act="${act}"], .pad-2 .btn[data-act="${act}"]`);
    if (btn && !btn.disabled) btn.click();
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
refreshClock();
startPolling();
setInterval(refreshClock, 30_000);
