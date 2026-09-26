const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/physics.js");

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ship(partial) {
  return {
    id: "red",
    name: "Red",
    color: "#e53935",
    ink: "#ffffff",
    hp: 5,
    alive: true,
    x: 0,
    y: 0,
    speed: 0,
    direction: 0,
    vx: 0,
    vy: 0,
    ...partial
  };
}

test("0° is +x and 90° is +y", () => {
  const east = P.components(10, 0);
  const north = P.components(10, 90);
  const west = P.components(10, 180);
  const south = P.components(10, 270);
  assert.ok(Math.abs(east.x - 10) < 1e-12);
  assert.ok(Math.abs(east.y) < 1e-12);
  assert.ok(Math.abs(north.x) < 1e-12);
  assert.ok(Math.abs(north.y - 10) < 1e-12);
  assert.ok(Math.abs(west.x + 10) < 1e-12);
  assert.ok(Math.abs(west.y) < 1e-12);
  assert.ok(Math.abs(south.x) < 1e-12);
  assert.ok(Math.abs(south.y + 10) < 1e-12);
});

test("current adds to heading and wind adds only to the shell", () => {
  const velocity = P.actualVelocity(3, 0, { speed: 1, direction: 180 });
  assert.ok(Math.abs(velocity.x - 2) < 1e-12);
  assert.ok(Math.abs(velocity.y) < 1e-12);

  const shell = P.projectileVelocity(90, 0, { speed: 2, direction: 0 });
  const flight = P.flightTime(90);
  const impact = P.projectilePosition({ x: 4, y: 5 }, shell, flight);
  assert.ok(Math.abs(impact.z) < 1e-9);
  assert.ok(Math.abs(impact.x - (4 + 2 * flight)) < 1e-9);
  assert.ok(Math.abs(impact.y - 5) < 1e-9);
  assert.ok(Math.abs(flight - (2 * P.MUZZLE) / P.G) < 1e-12);
});

test("an equal opposite heading cancels current", () => {
  const current = { speed: 0.8, direction: 33.25 };
  const velocity = P.actualVelocity(0.8, P.normalizeDirection(33.25 + 180), current);
  assert.ok(Math.abs(velocity.x) < 1e-12);
  assert.ok(Math.abs(velocity.y) < 1e-12);
  assert.equal(P.normalizeDirection(200 + 180), 20);
  assert.equal(P.normalizeDirection(-90), 270);
});

test("a 15° or 75° shot along +x lands 40.00 m downrange", () => {
  for (const elevation of [15, 75]) {
    const velocity = P.projectileVelocity(elevation, 0, { speed: 0, direction: 0 });
    const flight = P.flightTime(elevation);
    const impact = P.projectilePosition({ x: 0, y: 0 }, velocity, flight);
    assert.ok(Math.abs(impact.x - 40) < 1e-6, `x=${impact.x} at ${elevation}°`);
    assert.ok(Math.abs(impact.y) < 1e-6);
    assert.ok(Math.abs(impact.z) < 1e-6);
    assert.ok(flight < P.ROUND_TIME);
  }
});

test("the classic 40 m shot hits Blue and a short shot misses", () => {
  const wind = { speed: 0, direction: 0 };
  const ships = [
    ship({ id: "red", name: "Red" }),
    ship({ id: "blue", name: "Blue", x: 40, y: 0, color: "#1e88e5" })
  ];
  const hit = P.detectHits(ships, wind, { red: { elevation: 15, direction: 0 } });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].targetId, "blue");
  assert.equal(hit[0].shooterId, "red");

  const high = P.detectHits(ships, wind, { red: { elevation: 75, direction: 0 } });
  assert.equal(high.length, 1);

  const miss = P.detectHits(ships, wind, { red: { elevation: 14, direction: 0 } });
  assert.equal(miss.length, 0);
});

test("the hit window is 0.01 m and a shell does not hit its own ship", () => {
  const wind = { speed: 0, direction: 0 };
  const velocity = P.projectileVelocity(15, 0, wind);
  const flight = P.flightTime(15);
  const impact = P.projectilePosition({ x: 0, y: 0 }, velocity, flight);
  const onEdge = [
    ship({ id: "red" }),
    ship({ id: "blue", x: impact.x + 0.01, y: impact.y })
  ];
  const edgeHits = P.detectHits(onEdge, wind, { red: { elevation: 15, direction: 0 } });
  assert.equal(edgeHits.length, 1);

  const outside = [
    ship({ id: "red" }),
    ship({ id: "blue", x: impact.x + 0.02, y: impact.y })
  ];
  assert.equal(
    P.detectHits(outside, wind, { red: { elevation: 15, direction: 0 } }).length,
    0
  );

  const alone = [ship({ id: "red", speed: 0, vx: 0, vy: 0 })];
  const self = P.detectHits(alone, wind, { red: { elevation: 90, direction: 0 } });
  assert.equal(self.length, 0);
});

test("ship motion does not move the shell, and a surface shot can hit", () => {
  const wind = { speed: 0, direction: 0 };
  const ships = [
    ship({ id: "red", vx: 3, vy: 0, speed: 3, direction: 0 }),
    ship({ id: "blue", x: 0, y: 0.0, vx: 0, vy: 0 })
  ];
  ships[1].x = 0;
  const vertical = P.detectHits(ships, wind, { red: { elevation: 90, direction: 45 } });
  assert.equal(vertical.length, 1);
  assert.ok(Math.abs(vertical[0].x) < 1e-6);
  assert.ok(Math.abs(vertical[0].y) < 1e-6);

  const skimming = [
    ship({ id: "red" }),
    ship({ id: "blue", x: 20, y: 0 })
  ];
  const hits = P.detectHits(skimming, wind, { red: { elevation: 0, direction: 0 } });
  assert.equal(hits.length, 1);
  assert.ok(Math.abs(hits[0].t - (20 - P.HIT_RADIUS) / P.MUZZLE) < 1e-6);

  const wide = [
    ship({ id: "red" }),
    ship({ id: "blue", x: 20, y: 5 })
  ];
  assert.equal(P.detectHits(wide, wind, { red: { elevation: 0, direction: 0 } }).length, 0);
});

test("scoring gives the shooter 0.5 and the target −1, and stacks", () => {
  const ships = [
    ship({ id: "red", hp: 1 }),
    ship({ id: "blue", hp: 5 }),
    ship({ id: "green", hp: 5, color: "#2e7d32" })
  ];
  const hits = [
    { shooterId: "red", targetId: "blue", t: 1 },
    { shooterId: "blue", targetId: "red", t: 2 },
    { shooterId: "green", targetId: "blue", t: 3 }
  ];
  const hp = P.applyHits(ships, hits);
  assert.equal(hp.red, 0.5);
  assert.equal(hp.blue, 5 - 1 - 1 + 0.5);
  assert.equal(hp.green, 5.5);
  assert.equal(P.applyHits(ships, []).red, 1);
});

test("blank commands do not fire", () => {
  const ships = [
    ship({ id: "red" }),
    ship({ id: "blue", x: 40, y: 0 })
  ];
  assert.equal(P.detectHits(ships, { speed: 0, direction: 0 }, { red: null }).length, 0);
});

test("generated rounds stay on the field, apart, and inside the speed limits", () => {
  let fallbacks = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const rng = mulberry32(seed);
    const match = P.createMatch(rng);
    let { ships } = match;
    for (let round = 0; round < 10; round++) {
      const field = round === 0
        ? { wind: match.wind, current: match.current, motion: ships.map((s) => ({
          id: s.id, speed: s.speed, direction: s.direction, vel: { x: s.vx, y: s.vy }
        })), fallback: match.fallback }
        : P.assignMotion(ships, rng);
      if (round > 0) P.applyField(ships, field);
      if (field.fallback) fallbacks += 1;
      assert.ok(field.wind.speed >= 0 && field.wind.speed <= P.MAX_WIND);
      assert.ok(field.current.speed >= 0 && field.current.speed <= P.MAX_CURRENT);
      for (const ship of ships) {
        assert.ok(ship.speed >= 0 && ship.speed <= P.MAX_SHIP_SPEED + 1e-9);
        assert.ok(isHundredth(ship.speed));
        assert.ok(isHundredth(ship.x));
        assert.ok(isHundredth(ship.y));
        const end = { x: ship.x + ship.vx * P.ROUND_TIME, y: ship.y + ship.vy * P.ROUND_TIME };
        assert.ok(P.insideField(end), `seed ${seed} round ${round} ${ship.id} exits`);
        const rebuilt = P.actualVelocity(ship.speed, ship.direction, field.current);
        assert.ok(Math.abs(rebuilt.x - ship.vx) < 1e-9);
        assert.ok(Math.abs(rebuilt.y - ship.vy) < 1e-9);
      }
      assert.ok(
        P.minimumSeparation(ships) >= P.SEPARATION - 1e-6,
        `seed ${seed} round ${round} separation ${P.minimumSeparation(ships)}`
      );
      P.advanceShips(ships);
      for (const ship of ships) {
        assert.ok(P.insideField(ship), `seed ${seed} snapped ${ship.id} left the field`);
        assert.ok(isHundredth(ship.x) && isHundredth(ship.y));
      }
      assert.ok(staticSeparation(ships) >= P.SEPARATION - 0.05);
    }
  }
  assert.ok(fallbacks < 15, `fallback rounds: ${fallbacks}`);
});

function isHundredth(n) {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

function staticSeparation(ships) {
  let min = Infinity;
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const d = Math.hypot(ships[i].x - ships[j].x, ships[i].y - ships[j].y);
      if (d < min) min = d;
    }
  }
  return min;
}

test("a solved moving-target shot lands inside the hit window", () => {
  const solved = solveShot(
    { x: -12.5, y: 4.25 },
    { x: 18.4, y: -6.1 },
    { x: 0.85, y: 0.4 },
    { speed: 1.2, direction: 250 }
  );
  assert.ok(solved.length >= 1);
  const wind = { speed: 1.2, direction: 250 };
  const ships = [
    ship({ id: "red", x: -12.5, y: 4.25 }),
    ship({ id: "blue", x: 18.4, y: -6.1, vx: 0.85, vy: 0.4 })
  ];
  for (const shot of solved) {
    const hits = P.detectHits(ships, wind, {
      red: { elevation: shot.elevation, direction: shot.direction }
    });
    assert.equal(hits.length, 1, JSON.stringify(shot));
    assert.ok(hits[0].t <= P.ROUND_TIME);
  }
});

function solveShot(origin, targetPos, targetVel, wind) {
  const windV = P.components(wind.speed, wind.direction);
  const dx = targetPos.x - origin.x;
  const dy = targetPos.y - origin.y;
  const ux = targetVel.x - windV.x;
  const uy = targetVel.y - windV.y;
  const tMax = (2 * P.MUZZLE) / P.G;

  function residual(t) {
    const sinA = (t * P.G) / (2 * P.MUZZLE);
    if (sinA <= 0 || sinA > 1) return NaN;
    const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
    const rx = dx + ux * t;
    const ry = dy + uy * t;
    return Math.hypot(rx, ry) - P.MUZZLE * cosA * t;
  }

  const found = [];
  const steps = 4000;
  let prevT = 0.002;
  let prev = residual(prevT);
  for (let i = 1; i <= steps; i++) {
    const t = 0.002 + ((tMax - 0.002) * i) / steps;
    const value = residual(t);
    if (Number.isFinite(prev) && Number.isFinite(value) && prev * value <= 0) {
      let a = prevT;
      let b = t;
      let fa = prev;
      for (let k = 0; k < 60; k++) {
        const mid = (a + b) / 2;
        const fm = residual(mid);
        if (fa * fm <= 0) b = mid;
        else {
          a = mid;
          fa = fm;
        }
      }
      const time = (a + b) / 2;
      const sinA = (time * P.G) / (2 * P.MUZZLE);
      const rx = dx + ux * time;
      const ry = dy + uy * time;
      let direction = (Math.atan2(ry, rx) * 180) / Math.PI;
      if (direction < 0) direction += 360;
      if (Math.hypot(rx, ry) < 1e-8) direction = 0;
      found.push({
        elevation: (Math.asin(sinA) * 180) / Math.PI,
        direction,
        time
      });
    }
    prevT = t;
    prev = value;
  }
  return found;
}
