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
      <rect x="11" y="14" width="10" height="2"/>
      <rect x="13" y="10" width="2"  height="4"/>
      <rect x="17" y="10" width="2"  height="4"/>
      <text x="12" y="26" font-size="7" fill="#0f380f" font-family="monospace">RIP</text>
    </g>`,
};

const els = {
  pet:    document.getElementById("pet"),
  stage:  document.getElementById("stage"),
  hudStage: document.getElementById("hud-stage"),
  hudAge:   document.getElementById("hud-age"),
  poops:  document.getElementById("poops"),
  zzz:    document.getElementById("zzz"),
  alert:  document.getElementById("alert"),
  sick:   document.getElementById("sick"),
  hunger: document.getElementById("bar-hunger"),
  happy:  document.getElementById("bar-happy"),
  weight: document.getElementById("bar-weight"),
  ticker: document.getElementById("ticker"),
};

let pollTimer = null;

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch (e) {}
}

function fmtAge(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return `${h}h${m ? m + "m" : ""}`;
  const d = Math.floor(h / 24), rh = h % 24;
  return `${d}d${rh ? rh + "h" : ""}`;
}

function render(pet, msg) {
  els.pet.innerHTML = SPRITES[pet.life_stage] || SPRITES.egg;
  els.pet.dataset.stage = pet.life_stage;
  els.pet.dataset.sleeping = pet.is_sleeping ? "1" : "0";

  els.hudStage.textContent = pet.life_stage;
  els.hudAge.textContent = fmtAge(pet.age_minutes);

  els.hunger.style.width = (100 - pet.hunger) + "%";
  els.happy.style.width  = pet.happiness + "%";
  els.weight.style.width = Math.min(100, pet.weight) + "%";

  els.poops.textContent = "💩".repeat(Math.min(pet.poop_count, 4));

  els.zzz.hidden   = !pet.is_sleeping;
  els.sick.hidden  = !pet.is_sick;
  els.alert.hidden = !pet.alive || !pet.wants_attention || pet.is_sick;

  if (msg) {
    els.ticker.textContent = msg;
  } else if (!pet.alive) {
    els.ticker.textContent = "your pet has passed away — tap reset";
  } else if (pet.is_sleeping) {
    els.ticker.textContent = "sleeping...";
  } else if (pet.is_sick) {
    els.ticker.textContent = "pet is sick — give medicine";
  } else if (pet.hunger > 70) {
    els.ticker.textContent = "pet is hungry";
  } else if (pet.happiness < 30) {
    els.ticker.textContent = "pet is sad";
  } else if (pet.poop_count > 0) {
    els.ticker.textContent = `${pet.poop_count} poop(s) — clean up`;
  } else {
    els.ticker.textContent = `${pet.name} is doing fine`;
  }

  document.querySelectorAll(".btn").forEach(b => {
    const act = b.dataset.act;
    if (act === "reset") { b.disabled = false; return; }
    b.disabled = !pet.alive;
  });
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

const playModal = document.getElementById("play-modal");

function openPlayModal() {
  return new Promise(resolve => {
    playModal.hidden = false;
    const onPick = async (e) => {
      const guess = e.currentTarget.dataset.guess;
      if (!guess) return;
      vibrate(20);
      playModal.querySelectorAll("[data-guess]").forEach(b => b.removeEventListener("click", onPick));
      playModal.hidden = true;
      try {
        const res = await api("/api/play", "POST", { guess });
        resolve(res);
      } catch (e) {
        resolve(null);
      }
    };
    playModal.querySelectorAll("[data-guess]").forEach(b => b.addEventListener("click", onPick));
  });
}

const ACTIONS = {
  "feed-meal":  () => api("/api/feed",       "POST", { kind: "meal" }),
  "feed-snack": () => api("/api/feed",       "POST", { kind: "snack" }),
  "play":       () => openPlayModal(),
  "clean":      () => api("/api/clean",      "POST"),
  "heal":       () => api("/api/heal",       "POST"),
  "discipline": () => api("/api/discipline", "POST"),
  "lights":     () => api("/api/lights",     "POST"),
  "reset":      () => {
    if (!confirm("Hatch a new egg? Current pet will be lost.")) return null;
    const name = (prompt("Name your new pet:", "Tama") || "Tama").trim().slice(0, 16) || "Tama";
    return api("/api/reset", "POST", { name });
  },
};

document.querySelectorAll(".btn").forEach(b => {
  b.addEventListener("click", async () => {
    const fn = ACTIONS[b.dataset.act];
    if (!fn) return;
    vibrate(b.classList.contains("danger") ? [40, 30, 40] : 20);
    try {
      const res = await fn();
      if (res === null) return;
      if (res.pet) render(res.pet, res.msg);
      else render(res);
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
