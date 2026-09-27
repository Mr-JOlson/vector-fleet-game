(function () {
  const P = window.VectorFleetPhysics;
  const Draw = window.VectorFleetDraw;
  const Audio = window.VectorFleetAudio;

  const canvas = document.getElementById("sea");
  const ctx = canvas.getContext("2d");
  const statsBody = document.getElementById("stats-body");
  const dock = document.getElementById("dock");
  const startBtn = document.getElementById("start");
  const soundBtn = document.getElementById("sound");
  const stage = document.getElementById("stage");

  const state = {
    ships: [],
    wind: null,
    current: null,
    round: 1,
    running: false,
    over: false,
    simTime: 0,
    t0: 0,
    hits: [],
    shots: [],
    splashes: [],
    effects: [],
    log: [],
    announced: new Set()
  };

  function formatVector(speed, direction) {
    return `${speed.toFixed(2)}@${direction.toFixed(2)}°`;
  }

  function formatPoint(x, y) {
    return `(${P.roundHundredth(x).toFixed(2)}, ${P.roundHundredth(y).toFixed(2)}) m`;
  }

  function fitStage() {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 1000);
    stage.style.transform = `scale(${scale})`;
  }

  function resizeCanvas() {
    const field = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, field.clientWidth);
    const height = Math.max(1, field.clientHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.dataset.cssWidth = String(width);
    canvas.dataset.cssHeight = String(height);
  }

  function scoreAt(time) {
    const due = state.hits.filter((hit) => hit.t <= time + 1e-9);
    return P.applyHits(state.ships, due);
  }

  function shownHp(ship) {
    if (!state.running) return ship.hp;
    const scores = scoreAt(state.simTime);
    return scores[ship.id];
  }

  function iconText(ship) {
    if (!ship.alive) return "—";
    return Math.max(0, shownHp(ship)).toFixed(1);
  }

  function renderStats() {
    const alive = state.ships.filter((ship) => ship.alive);
    const banner = state.over
      ? (state.winner
        ? `<p class="banner">${state.winner.name} wins.</p>`
        : `<p class="banner">Every ship is sunk.</p>`)
      : "";
    const log = state.log.length
      ? `<p class="hit-line">${state.log.join(" · ")}</p>`
      : "";
    const rows = alive.map((ship) => `
      <section class="ship-stat">
        <div class="ship-stat-top">
          <span class="swatch" style="background:${ship.color}"></span>
          <span class="ship-name">${ship.name}</span>
          <span class="ship-hp" id="hp-${ship.id}">HP ${Math.max(0, ship.hp).toFixed(2)}</span>
        </div>
        <div class="ship-pos">${formatPoint(ship.x, ship.y)}</div>
        <div class="ship-vec">${formatVector(ship.speed, ship.direction)} m/s</div>
      </section>
    `).join("");

    statsBody.innerHTML = `
      <h1>Vector Fleet!</h1>
      <p class="round-line">Round ${state.round} · t = <span id="clock">${state.simTime.toFixed(2)}</span> s</p>
      ${banner}
      <p class="constants-line"><b>g</b> 9.80 m/s² · <b>Muzzle</b> 28.00 m/s</p>
      <p class="angles">0° = +x (right), 90° = +y (up)</p>
      <div class="vector-block">
        <span>Wind</span>
        <strong>${formatVector(state.wind.speed, state.wind.direction)} m/s</strong>
      </div>
      <div class="vector-block">
        <span>Current</span>
        <strong>${formatVector(state.current.speed, state.current.direction)} m/s</strong>
      </div>
      <p class="notes">Path = heading + current. Shell = muzzle + that velocity + wind. Hit within 1 m. Blank boxes do not fire.</p>
      ${log}
      ${rows}
    `;
  }

  function renderDock() {
    dock.innerHTML = state.ships.map((ship) => `
      <article class="card${ship.alive ? "" : " sunk"}" data-id="${ship.id}">
        <div class="badge" style="background:${ship.alive ? ship.color : "#7d858f"}; color:${ship.alive ? ship.ink : "#ffffff"}">
          <span id="badge-${ship.id}">${iconText(ship)}</span>
        </div>
        <div class="card-main">
          <div class="card-name">${ship.name}</div>
          <label>Elev °
            <input data-field="elev" inputmode="decimal" spellcheck="false" autocomplete="off" ${ship.alive ? "" : "disabled"} />
          </label>
          <label>Dir °
            <input data-field="dir" inputmode="decimal" spellcheck="false" autocomplete="off" ${ship.alive ? "" : "disabled"} />
          </label>
        </div>
      </article>
    `).join("");
    dock.querySelectorAll("input").forEach((input) => {
      input.addEventListener("focus", () => input.select());
    });
  }

  function updateSoundButton() {
    const muted = Audio.isMuted();
    soundBtn.textContent = muted ? "Sound off" : "Sound on";
    soundBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  function refreshScores() {
    const scores = scoreAt(state.simTime);
    for (const ship of state.ships) {
      if (!ship.alive) continue;
      const shown = Math.max(0, scores[ship.id]);
      const stat = document.getElementById(`hp-${ship.id}`);
      if (stat) stat.textContent = `HP ${shown.toFixed(2)}`;
      const badge = document.getElementById(`badge-${ship.id}`);
      if (badge) badge.textContent = shown.toFixed(1);
    }
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = state.simTime.toFixed(2);
  }

  function readCommand(ship) {
    const card = dock.querySelector(`[data-id="${ship.id}"]`);
    const elevInput = card.querySelector('[data-field="elev"]');
    const dirInput = card.querySelector('[data-field="dir"]');
    elevInput.classList.remove("invalid");
    dirInput.classList.remove("invalid");
    if (!ship.alive) return null;
    const elevRaw = elevInput.value.trim();
    const dirRaw = dirInput.value.trim();
    if (elevRaw === "" && dirRaw === "") return null;
    const elevation = Number(elevRaw);
    const direction = Number(dirRaw);
    const elevOk = elevRaw !== "" && Number.isFinite(elevation) && elevation >= 0 && elevation <= 90;
    const dirOk = dirRaw !== "" && Number.isFinite(direction);
    if (!elevOk || !dirOk) {
      if (!elevOk) elevInput.classList.add("invalid");
      if (!dirOk) dirInput.classList.add("invalid");
      return "invalid";
    }
    return {
      elevation,
      direction: P.normalizeDirection(direction)
    };
  }

  function setInputsDisabled(disabled) {
    dock.querySelectorAll("input").forEach((input) => {
      const card = input.closest(".card");
      const sunk = card.classList.contains("sunk");
      input.disabled = disabled || sunk;
    });
  }

  function clearInputs() {
    dock.querySelectorAll("input").forEach((input) => {
      input.value = "";
      input.classList.remove("invalid");
    });
  }

  function makeSparks(color) {
    const sparks = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 6 + Math.random() * 14;
      sparks.push({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? "#ffe082" : color
      });
    }
    return sparks;
  }

  function buildShots(commands) {
    return state.ships.filter((ship) => ship.alive && commands[ship.id]).map((ship) => {
      const command = commands[ship.id];
      const vel = P.projectileVelocity(command.elevation, command.direction, state.wind, {
        x: ship.vx,
        y: ship.vy
      });
      const ownHits = state.hits.filter((hit) => hit.shooterId === ship.id);
      let endTime;
      if (command.elevation <= 0) endTime = ownHits.length ? ownHits[0].t : P.ROUND_TIME;
      else endTime = P.flightTime(command.elevation);
      const origin = { x: ship.x, y: ship.y };
      const start = P.projectilePosition(origin, vel, 0);
      return {
        shipId: ship.id,
        color: ship.color,
        origin,
        vel,
        endTime,
        splashed: false,
        trail: [{ t: 0, x: start.x, y: start.y, z: 0 }]
      };
    });
  }

  function sampleTrails() {
    for (const shot of state.shots) {
      const t = Math.min(state.simTime, shot.endTime);
      const last = shot.trail[shot.trail.length - 1];
      if (last && t < last.t + 0.025 && t < shot.endTime - 1e-9) continue;
      const point = P.projectilePosition(shot.origin, shot.vel, t);
      shot.trail.push({
        t,
        x: point.x,
        y: point.y,
        z: Math.max(0, point.z)
      });
    }
  }

  function triggerHits() {
    for (const hit of state.hits) {
      if (hit.t > state.simTime + 1e-9) continue;
      const key = `${hit.shooterId}:${hit.targetId}:${hit.t}`;
      if (state.announced.has(key)) continue;
      state.announced.add(key);
      const shooter = state.ships.find((ship) => ship.id === hit.shooterId);
      const target = state.ships.find((ship) => ship.id === hit.targetId);
      state.log.push(`${shooter.name} → ${target.name}`);
      state.effects.push({
        x: hit.x,
        y: hit.y,
        t: hit.t,
        targetId: hit.targetId,
        sparks: makeSparks(target.color)
      });
      Audio.playExplosion();
      renderStats();
    }
  }

  function triggerSplashes() {
    for (const shot of state.shots) {
      if (shot.splashed || state.simTime + 1e-9 < shot.endTime) continue;
      shot.splashed = true;
      const point = P.projectilePosition(shot.origin, shot.vel, shot.endTime);
      state.splashes.push({ x: point.x, y: point.y, color: shot.color });
    }
  }

  function loadMatch(match) {
    state.ships = match.ships;
    state.wind = match.wind;
    state.current = match.current;
    state.round = 1;
    state.running = false;
    state.over = false;
    state.winner = null;
    state.simTime = 0;
    state.hits = [];
    state.shots = [];
    state.splashes = [];
    state.effects = [];
    state.log = [];
    state.announced = new Set();
    startBtn.textContent = "Start";
    startBtn.disabled = false;
    renderDock();
    renderStats();
  }

  function finishRound() {
    state.running = false;
    const finalHp = P.applyHits(state.ships, state.hits);
    for (const ship of state.ships) {
      if (!ship.alive) continue;
      ship.x = P.roundHundredth(ship.x + ship.vx * P.ROUND_TIME);
      ship.y = P.roundHundredth(ship.y + ship.vy * P.ROUND_TIME);
      ship.hp = finalHp[ship.id];
      if (ship.hp <= 0) {
        ship.alive = false;
        ship.hp = 0;
      }
    }
    if (state.log.length === 0) state.log.push("No hits.");
    state.shots = [];
    state.splashes = [];
    state.effects = [];
    state.hits = [];
    state.announced = new Set();
    state.simTime = 0;

    const alive = state.ships.filter((ship) => ship.alive);
    renderDock();
    if (alive.length <= 1) {
      state.over = true;
      state.winner = alive[0] || null;
      startBtn.textContent = "New Fleet";
      startBtn.disabled = false;
      renderStats();
      return;
    }

    const field = P.assignMotion(alive, Math.random);
    P.applyField(alive, field);
    state.wind = field.wind;
    state.current = field.current;
    state.round += 1;
    startBtn.disabled = false;
    renderStats();
  }

  function beginRound() {
    if (state.running) return;
    const commands = {};
    for (const ship of state.ships) {
      const command = readCommand(ship);
      if (command === "invalid") return;
      commands[ship.id] = command;
    }
    Audio.ensureAudio();
    state.log = [];
    state.announced = new Set();
    state.effects = [];
    state.splashes = [];
    state.hits = P.detectHits(state.ships, state.wind, commands);
    state.shots = buildShots(commands);
    state.running = true;
    state.t0 = performance.now();
    state.simTime = 0;
    startBtn.disabled = true;
    setInputsDisabled(true);
    renderStats();
  }

  function frame(now) {
    if (state.running) {
      state.simTime = Math.min(P.ROUND_TIME, (now - state.t0) / 1000);
      sampleTrails();
      triggerHits();
      triggerSplashes();
      refreshScores();
      if (state.simTime >= P.ROUND_TIME) finishRound();
    }
    Draw.drawFrame(
      ctx,
      Number(canvas.dataset.cssWidth),
      Number(canvas.dataset.cssHeight),
      state,
      (ship) => Math.max(0, shownHp(ship))
    );
    requestAnimationFrame(frame);
  }

  function layout() {
    fitStage();
    resizeCanvas();
  }

  startBtn.addEventListener("click", () => {
    if (state.over) {
      loadMatch(P.createMatch(Math.random));
      return;
    }
    beginRound();
  });

  soundBtn.addEventListener("click", () => {
    Audio.setMuted(!Audio.isMuted());
    updateSoundButton();
  });

  dock.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      startBtn.click();
    }
  });

  window.addEventListener("resize", layout);
  updateSoundButton();
  loadMatch(P.createMatch(Math.random));
  layout();
  requestAnimationFrame(frame);
})();
