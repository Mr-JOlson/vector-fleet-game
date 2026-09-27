/**
 * Vector Fleet physics.
 *
 * Coordinates are meters. +x is right, +y is up, and 0° points along +x.
 * The water is the square [-50, 50] × [-50, 50].
 *
 * Each ship's displayed vector is its heading, before current.
 * Actual ship velocity = heading + current.
 * A shell's horizontal velocity = muzzle vector + the ship's actual velocity + wind.
 * The muzzle speed is 28 m/s, relative to the ship.
 * Elevation is the angle above the horizontal.
 * z = (v sin α) t − ½ g t², with g = 9.80 m/s².
 * An elevated shell returns to the water at t = 2 v sin α / g.
 * A hit is that waterline meeting within 1 m of another ship.
 * One careful pass of the class procedure usually lands inside that window.
 * A 0° elevation skims the water and can hit along its path.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.VectorFleetPhysics = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const G = 9.8;
  const MUZZLE = 28;
  const ROUND_TIME = 10;
  const HIT_RADIUS = 1;
  const FIELD = 50;
  const INSET = 4;
  const MAX_SHIP_SPEED = 3;
  const MAX_WIND = 2;
  const MAX_CURRENT = 1;
  const SEPARATION = 6.5;
  const PLAN_SEPARATION = 7;
  const STARTING_HP = 5;
  const HIT_REWARD = 0.5;
  const HIT_PENALTY = 1;

  const SHIP_STYLES = [
    { id: "red", name: "Red", color: "#e53935", ink: "#ffffff" },
    { id: "blue", name: "Blue", color: "#1e88e5", ink: "#ffffff" },
    { id: "green", name: "Green", color: "#2e7d32", ink: "#ffffff" },
    { id: "orange", name: "Orange", color: "#fb8c00", ink: "#1a1a1a" },
    { id: "purple", name: "Purple", color: "#8e24aa", ink: "#ffffff" },
    { id: "teal", name: "Teal", color: "#00897b", ink: "#ffffff" },
    { id: "magenta", name: "Magenta", color: "#d81b60", ink: "#ffffff" },
    { id: "gold", name: "Gold", color: "#f9a825", ink: "#1a1200" }
  ];

  function roundHundredth(n) {
    return Math.sign(n) * Math.round(Math.abs(n) * 100) / 100;
  }

  function randomHundredth(rng, min, max) {
    const lo = Math.round(min * 100);
    const hi = Math.round(max * 100);
    const k = lo + Math.floor(rng() * (hi - lo + 1));
    return k / 100;
  }

  function normalizeDirection(degrees) {
    let d = degrees % 360;
    if (d < 0) d += 360;
    if (d === 360) d = 0;
    return d;
  }

  function components(magnitude, directionDeg) {
    const r = (directionDeg * Math.PI) / 180;
    return {
      x: magnitude * Math.cos(r),
      y: magnitude * Math.sin(r)
    };
  }

  function insideField(p) {
    const limit = FIELD - INSET + 1e-6;
    return p.x >= -limit && p.x <= limit && p.y >= -limit && p.y <= limit;
  }

  function actualVelocity(speed, direction, current) {
    const heading = components(speed, direction);
    const drift = components(current.speed, current.direction);
    return { x: heading.x + drift.x, y: heading.y + drift.y };
  }

  function projectileVelocity(elevationDeg, directionDeg, wind, shipVelocity) {
    const elev = (elevationDeg * Math.PI) / 180;
    const dir = (directionDeg * Math.PI) / 180;
    const horizontal = MUZZLE * Math.cos(elev);
    const drift = components(wind.speed, wind.direction);
    const ship = shipVelocity || { x: 0, y: 0 };
    return {
      x: horizontal * Math.cos(dir) + drift.x + (ship.x || 0),
      y: horizontal * Math.sin(dir) + drift.y + (ship.y || 0),
      z: MUZZLE * Math.sin(elev)
    };
  }

  function projectilePosition(origin, vel, t) {
    return {
      x: origin.x + vel.x * t,
      y: origin.y + vel.y * t,
      z: vel.z * t - 0.5 * G * t * t
    };
  }

  function flightTime(elevationDeg) {
    const vz = MUZZLE * Math.sin((elevationDeg * Math.PI) / 180);
    if (vz <= 1e-9) return 0;
    return (2 * vz) / G;
  }

  function closestApproach(p1, v1, p2, v2, duration) {
    const rx = p2.x - p1.x;
    const ry = p2.y - p1.y;
    const vx = v2.x - v1.x;
    const vy = v2.y - v1.y;
    const vv = vx * vx + vy * vy;
    let t = 0;
    if (vv > 1e-12) {
      t = -((rx * vx) + (ry * vy)) / vv;
      if (t < 0) t = 0;
      else if (t > duration) t = duration;
    }
    const dx = rx + vx * t;
    const dy = ry + vy * t;
    return { t, distance: Math.hypot(dx, dy) };
  }

  function firstWithin(origin, pVel, shipPos, shipVel, radius, tMax) {
    const rx = origin.x - shipPos.x;
    const ry = origin.y - shipPos.y;
    const vx = pVel.x - shipVel.x;
    const vy = pVel.y - shipVel.y;
    const a = vx * vx + vy * vy;
    const b = 2 * (rx * vx + ry * vy);
    const c = rx * rx + ry * ry - radius * radius;
    if (a < 1e-12) {
      return c <= 0 ? null : null;
    }
    let disc = b * b - 4 * a * c;
    if (disc < -1e-6) return null;
    if (disc < 0) disc = 0;
    const root = Math.sqrt(disc);
    const t1 = (-b - root) / (2 * a);
    const t2 = (-b + root) / (2 * a);
    let best = null;
    for (const t of [t1, t2]) {
      if (t > 1e-4 && t <= tMax + 1e-9 && (best === null || t < best)) best = t;
    }
    return best;
  }

  function detectHits(ships, wind, commands) {
    const alive = ships.filter((ship) => ship.alive);
    const hits = [];
    for (const shooter of alive) {
      const command = commands[shooter.id];
      if (!command) continue;
      const vel = projectileVelocity(command.elevation, command.direction, wind, {
        x: shooter.vx,
        y: shooter.vy
      });
      const origin = { x: shooter.x, y: shooter.y };
      if (command.elevation <= 0) {
        let best = null;
        for (const target of alive) {
          if (target.id === shooter.id) continue;
          const t = firstWithin(
            origin,
            vel,
            { x: target.x, y: target.y },
            { x: target.vx, y: target.vy },
            HIT_RADIUS,
            ROUND_TIME
          );
          if (t !== null && (best === null || t < best.t)) best = { t, target };
        }
        if (best) {
          const pos = projectilePosition(origin, vel, best.t);
          hits.push({
            shooterId: shooter.id,
            targetId: best.target.id,
            t: best.t,
            x: pos.x,
            y: pos.y
          });
        }
      } else {
        const t = flightTime(command.elevation);
        if (!(t > 0) || t > ROUND_TIME) continue;
        const impact = projectilePosition(origin, vel, t);
        for (const target of alive) {
          if (target.id === shooter.id) continue;
          const tx = target.x + target.vx * t;
          const ty = target.y + target.vy * t;
          const distance = Math.hypot(impact.x - tx, impact.y - ty);
          if (distance <= HIT_RADIUS + 1e-6) {
            hits.push({
              shooterId: shooter.id,
              targetId: target.id,
              t,
              x: impact.x,
              y: impact.y
            });
          }
        }
      }
    }
    hits.sort((a, b) => a.t - b.t || a.shooterId.localeCompare(b.shooterId));
    return hits;
  }

  function applyHits(ships, hits) {
    const hp = {};
    for (const ship of ships) hp[ship.id] = ship.hp;
    for (const hit of hits) {
      if (hp[hit.shooterId] == null || hp[hit.targetId] == null) continue;
      hp[hit.shooterId] += HIT_REWARD;
      hp[hit.targetId] -= HIT_PENALTY;
    }
    return hp;
  }

  function pickVector(rng, maxSpeed) {
    const speed = randomHundredth(rng, 0, maxSpeed);
    const direction = speed === 0 ? 0 : randomHundredth(rng, 0, 359.99);
    return { speed, direction: normalizeDirection(direction) };
  }

  function pathIsLegal(candidate, accepted) {
    const end = {
      x: candidate.x + candidate.vel.x * ROUND_TIME,
      y: candidate.y + candidate.vel.y * ROUND_TIME
    };
    if (!insideField(end)) return false;
    for (const other of accepted) {
      const approach = closestApproach(
        { x: candidate.x, y: candidate.y },
        candidate.vel,
        { x: other.x, y: other.y },
        other.vel,
        ROUND_TIME
      );
      if (approach.distance < PLAN_SEPARATION) return false;
    }
    return true;
  }

  function assignMotion(ships, rng) {
    const random = rng || Math.random;
    const alive = ships.filter((ship) => ship.alive);
    for (let attempt = 0; attempt < 60; attempt++) {
      const current = pickVector(random, MAX_CURRENT);
      const wind = pickVector(random, MAX_WIND);
      const order = shuffle(alive, random);
      const accepted = [];
      let ok = true;
      for (const ship of order) {
        let placed = null;
        for (let n = 0; n < 300; n++) {
          const heading = pickVector(random, MAX_SHIP_SPEED);
          const vel = actualVelocity(heading.speed, heading.direction, current);
          const candidate = {
            id: ship.id,
            x: ship.x,
            y: ship.y,
            speed: heading.speed,
            direction: heading.direction,
            vel
          };
          if (pathIsLegal(candidate, accepted)) {
            placed = candidate;
            break;
          }
        }
        if (!placed) {
          ok = false;
          break;
        }
        accepted.push(placed);
      }
      if (ok) {
        return {
          wind,
          current,
          motion: accepted.map((item) => ({
            id: item.id,
            speed: item.speed,
            direction: item.direction,
            vel: item.vel
          })),
          fallback: false
        };
      }
    }
    return {
      wind: pickVector(random, MAX_WIND),
      current: { speed: 0, direction: 0 },
      motion: alive.map((ship) => ({
        id: ship.id,
        speed: 0,
        direction: 0,
        vel: { x: 0, y: 0 }
      })),
      fallback: true
    };
  }

  function applyField(ships, field) {
    const byId = new Map(field.motion.map((item) => [item.id, item]));
    for (const ship of ships) {
      const motion = byId.get(ship.id);
      if (!motion) continue;
      ship.speed = motion.speed;
      ship.direction = motion.direction;
      ship.vx = motion.vel.x;
      ship.vy = motion.vel.y;
    }
    return ships;
  }

  function advanceShips(ships) {
    for (const ship of ships) {
      if (!ship.alive) continue;
      ship.x = roundHundredth(ship.x + ship.vx * ROUND_TIME);
      ship.y = roundHundredth(ship.y + ship.vy * ROUND_TIME);
    }
    return ships;
  }

  function minimumSeparation(ships) {
    const alive = ships.filter((ship) => ship.alive);
    let min = Infinity;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const approach = closestApproach(
          { x: a.x, y: a.y },
          { x: a.vx, y: a.vy },
          { x: b.x, y: b.y },
          { x: b.vx, y: b.vy },
          ROUND_TIME
        );
        if (approach.distance < min) min = approach.distance;
      }
    }
    return min;
  }

  const FALLBACK_SPOTS = [
    { x: -30, y: -18 },
    { x: -10, y: -18 },
    { x: 10, y: -18 },
    { x: 30, y: -18 },
    { x: -30, y: 16 },
    { x: -10, y: 16 },
    { x: 10, y: 16 },
    { x: 30, y: 16 }
  ];

  function placeShips(rng) {
    const random = rng || Math.random;
    const limit = FIELD - INSET;
    for (let attempt = 0; attempt < 300; attempt++) {
      const spots = [];
      let ok = true;
      for (let i = 0; i < SHIP_STYLES.length; i++) {
        let placed = null;
        for (let n = 0; n < 250; n++) {
          const spot = {
            x: randomHundredth(random, -limit, limit),
            y: randomHundredth(random, -limit, limit)
          };
          if (spots.every((other) => Math.hypot(other.x - spot.x, other.y - spot.y) >= 14)) {
            placed = spot;
            break;
          }
        }
        if (!placed) {
          ok = false;
          break;
        }
        spots.push(placed);
      }
      if (ok) return spots;
    }
    return FALLBACK_SPOTS.map((spot) => ({ x: spot.x, y: spot.y }));
  }

  function createMatch(rng) {
    const random = rng || Math.random;
    const spots = placeShips(random);
    const ships = SHIP_STYLES.map((style, index) => ({
      id: style.id,
      name: style.name,
      color: style.color,
      ink: style.ink,
      hp: STARTING_HP,
      alive: true,
      x: spots[index].x,
      y: spots[index].y,
      speed: 0,
      direction: 0,
      vx: 0,
      vy: 0
    }));
    const field = assignMotion(ships, random);
    applyField(ships, field);
    return {
      ships,
      wind: field.wind,
      current: field.current,
      fallback: field.fallback
    };
  }

  function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  return {
    G,
    MUZZLE,
    ROUND_TIME,
    HIT_RADIUS,
    FIELD,
    INSET,
    MAX_SHIP_SPEED,
    MAX_WIND,
    MAX_CURRENT,
    SEPARATION,
    PLAN_SEPARATION,
    STARTING_HP,
    HIT_REWARD,
    HIT_PENALTY,
    SHIP_STYLES,
    roundHundredth,
    randomHundredth,
    normalizeDirection,
    components,
    insideField,
    actualVelocity,
    projectileVelocity,
    projectilePosition,
    flightTime,
    closestApproach,
    firstWithin,
    detectHits,
    applyHits,
    assignMotion,
    applyField,
    advanceShips,
    minimumSeparation,
    placeShips,
    createMatch
  };
});
