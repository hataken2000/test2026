// Game core: types, spawning, movement, collision, difficulty

const ENEMY_TYPES = {
  gnat:     { score: 5,   radius: 12, baseSpeed: 50,  hitRadius: 16, Comp: 'Gnat',      size: 26 },
  fly:      { score: 10,  radius: 18, baseSpeed: 70,  hitRadius: 22, Comp: 'Fly',       size: 40 },
  bee:      { score: 50,  radius: 26, baseSpeed: 60,  hitRadius: 30, Comp: 'Bee',       size: 58 },
  hornet:   { score: 150, radius: 30, baseSpeed: 55,  hitRadius: 34, Comp: 'Hornet',    size: 68 },
  dragonfly:{ score: 500, radius: 60, baseSpeed: 240, hitRadius: 55, Comp: 'Dragonfly', size: 150, hp: 3, isBoss: true },
};

// 8 compass directions, angle measured from +x axis, CCW
const DIRS = Array.from({length: 8}, (_, i) => (i * Math.PI * 2) / 8);

const ATTACK_RADIUS_RATIO = 2 / 3;

function difficultyFromScore(score, curve, spawnMult) {
  const k = curve === 'chill' ? 0.7 : curve === 'spicy' ? 1.3 : 1.0;
  const t = score * k;
  // Gnats only early (0-50), flies start appearing 50-300, bees 300+, hornets 900+
  let pGnat, pFly, pBee, pHornet;
  if (t < 50) { pGnat = 1; pFly = 0; pBee = 0; pHornet = 0; }
  else if (t < 300) {
    const r = (t - 50) / 250;
    pGnat = 1 - 0.6 * r;   // 1.0 -> 0.4
    pFly = 0.6 * r;         // 0.0 -> 0.6
    pBee = 0; pHornet = 0;
  } else if (t < 900) {
    const r = (t - 300) / 600;
    pGnat = Math.max(0.1, 0.4 - 0.25 * r);
    pBee = 0.45 * r;
    pHornet = 0;
    pFly = 1 - pGnat - pBee;
  } else {
    const r = Math.min(1, (t - 900) / 1500);
    pGnat = Math.max(0.05, 0.15 - 0.1 * r);
    pHornet = 0.15 + 0.25 * r;
    pBee = 0.35 + 0.1 * r;
    pFly = Math.max(0.2, 1 - pGnat - pHornet - pBee);
  }
  const baseInterval = Math.max(0.32, 1.6 - t / 2000) / spawnMult;
  const maxOnScreen = Math.min(16, 3 + Math.floor(t / 220));
  const speedMult = 1 + Math.min(1.2, t / 3000);
  return { pGnat, pFly, pBee, pHornet, baseInterval, maxOnScreen, speedMult };
}

function pickEnemyType(d, ctx) {
  if (ctx && ctx.hornetCount >= 2) {
    // exclude hornet, renormalize the rest
    const total = d.pGnat + d.pFly + d.pBee;
    const r = Math.random() * total;
    if (r < d.pGnat) return 'gnat';
    if (r < d.pGnat + d.pFly) return 'fly';
    return 'bee';
  }
  const r = Math.random();
  if (r < d.pGnat) return 'gnat';
  if (r < d.pGnat + d.pFly) return 'fly';
  if (r < d.pGnat + d.pFly + d.pBee) return 'bee';
  return 'hornet';
}

function spawnEnemy(field, score, difficulty, ctx) {
  const type = pickEnemyType(difficulty, ctx);
  return makeEnemy(type, field, difficulty);
}

function makeEnemy(type, field, difficulty) {
  const def = ENEMY_TYPES[type];
  const spawnR = field.radius + 60;
  const dirIdx = Math.floor(Math.random() * 8);
  // Gnat: no jitter — must sit exactly on a tongue axis so player can hit it.
  // Others: slight jitter for variety.
  const jitter = type === 'gnat' ? 0 : (Math.random() - 0.5) * (Math.PI / 8) * 0.35;
  const angle = DIRS[dirIdx] + jitter;
  const x = field.cx + Math.cos(angle) * spawnR;
  const y = field.cy + Math.sin(angle) * spawnR;
  return {
    id: Math.random().toString(36).slice(2),
    type, x, y,
    spawnAngle: angle, spawnR,
    phase: Math.random() * Math.PI * 2,
    rot: 0,
    speed: def.baseSpeed * (difficulty ? difficulty.speedMult : 1),
    orbitAngle: Math.random() * Math.PI * 2,
    mode: 'approach',
    attackVX: 0, attackVY: 0,
    flap: Math.random() * Math.PI * 2,
    dead: false, deathT: 0,
    // boss state
    hp: def.hp || 1,
    hitFlash: 0,
    bossSlotIdx: dirIdx,
    bossNextSlotIdx: dirIdx,
    bossMoveCount: 0, // number of slot changes completed in current cycle; on 3rd attack
    bossT: 0,
  };
}

function updateEnemy(e, dt, field, onHitFrog) {
  e.flap += dt * 22;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  const def = ENEMY_TYPES[e.type];

  if (e.dead) {
    e.deathT += dt;
    return e.deathT > 0.5;
  }

  const dx = field.cx - e.x;
  const dy = field.cy - e.y;
  const distToFrog = Math.hypot(dx, dy);

  // Boss (dragonfly) AI
  if (e.type === 'dragonfly') {
    // slot radius: just outside attack ring
    const slotR = field.radius * (ATTACK_RADIUS_RATIO + 0.12) + 10;

    if (e.mode === 'approach') {
      // fly in to the initial slot
      const target = slotPos(field, e.bossSlotIdx, slotR);
      if (moveToward(e, target, e.speed * 0.9, dt) < 12) {
        e.mode = 'hover';
        e.bossT = 0.5 + Math.random() * 0.3;
      }
    } else if (e.mode === 'hover') {
      // gentle bob at current slot
      const target = slotPos(field, e.bossSlotIdx, slotR);
      const bobY = Math.sin(e.flap * 0.5) * 8;
      e.x += (target.x - e.x) * Math.min(1, dt * 6);
      e.y += (target.y + bobY - e.y) * Math.min(1, dt * 6);
      e.bossT -= dt;
      if (e.bossT <= 0) {
        // decide: 3rd move of cycle → attack; otherwise move to new slot
        e.bossMoveCount += 1;
        if (e.bossMoveCount >= 3) {
          e.mode = 'attack';
          const ndx = field.cx - e.x, ndy = field.cy - e.y;
          const len = Math.hypot(ndx, ndy) || 1;
          const lunge = def.baseSpeed * 1.4;
          e.attackVX = (ndx / len) * lunge;
          e.attackVY = (ndy / len) * lunge;
          e.didHit = false;
        } else {
          // pick a different slot
          let next;
          do { next = Math.floor(Math.random() * 8); } while (next === e.bossSlotIdx);
          e.bossNextSlotIdx = next;
          e.mode = 'reposition';
        }
      }
    } else if (e.mode === 'reposition') {
      const target = slotPos(field, e.bossNextSlotIdx, slotR);
      if (moveToward(e, target, e.speed, dt) < 14) {
        e.bossSlotIdx = e.bossNextSlotIdx;
        e.mode = 'hover';
        e.bossT = 0.45 + Math.random() * 0.25;
      }
    } else if (e.mode === 'attack') {
      e.x += e.attackVX * dt;
      e.y += e.attackVY * dt;
      if (!e.didHit && distToFrog < field.frogRadius + def.hitRadius * 0.6) {
        e.didHit = true;
        onHitFrog(e);
      }
      const distFromCenter = Math.hypot(e.x - field.cx, e.y - field.cy);
      if (distFromCenter > field.radius + 120) {
        // loop: re-enter from a random direction, restart cycle
        const angle = Math.random() * Math.PI * 2;
        const spawnR = field.radius + 80;
        e.x = field.cx + Math.cos(angle) * spawnR;
        e.y = field.cy + Math.sin(angle) * spawnR;
        e.bossSlotIdx = Math.floor(Math.random() * 8);
        e.bossMoveCount = 0;
        e.mode = 'approach';
      }
    }
    return false;
  }

  // Regular enemies
  if (e.mode === 'approach') {
    const attackAt = field.radius * ATTACK_RADIUS_RATIO;
    if (distToFrog <= attackAt) {
      e.mode = 'attack';
      const nx = dx / distToFrog;
      const ny = dy / distToFrog;
      const lunge = e.speed * 3.2;
      e.attackVX = nx * lunge;
      e.attackVY = ny * lunge;
      return false;
    }

    const nx = dx / distToFrog;
    const ny = dy / distToFrog;

    if (e.type === 'gnat') {
      // Straight-line, no wobble
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    } else if (e.type === 'fly' || e.type === 'bee') {
      // Advance along approach axis, then offset perpendicular with a sin wave
      // so the bug visibly crosses back and forth across the tongue path.
      const px = -ny, py = nx;
      const amp = e.type === 'fly' ? 70 : 220;
      const freq = e.type === 'fly' ? 3.0 : 2.2;
      // previous perpendicular offset
      if (e.wobPhase == null) { e.wobPhase = Math.random() * Math.PI * 2; e.wobPrev = 0; }
      e.wobPhase += dt * freq;
      const newOff = Math.sin(e.wobPhase) * amp;
      const dOff = newOff - e.wobPrev;
      e.wobPrev = newOff;
      e.x += nx * e.speed * dt + px * dOff;
      e.y += ny * e.speed * dt + py * dOff;
    } else if (e.type === 'hornet') {
      e.orbitAngle += dt * 3.2;
      const curR = distToFrog;
      const targetR = Math.max(attackAt, curR - e.speed * dt);
      const baseAngle = Math.atan2(e.y - field.cy, e.x - field.cx);
      const newAngle = baseAngle + dt * 2.2;
      e.x = field.cx + Math.cos(newAngle) * targetR;
      e.y = field.cy + Math.sin(newAngle) * targetR;
      e.rot += dt * 360;
    }
  } else if (e.mode === 'attack') {
    e.x += e.attackVX * dt;
    e.y += e.attackVY * dt;
    if (!e.didHit && distToFrog < field.frogRadius + def.hitRadius * 0.6) {
      e.didHit = true;
      onHitFrog(e);
    }
    const distFromCenter = Math.hypot(e.x - field.cx, e.y - field.cy);
    if (distFromCenter > field.radius + 100) return true;
  }

  return false;
}

function slotPos(field, idx, r) {
  const a = DIRS[idx];
  return { x: field.cx + Math.cos(a) * r, y: field.cy + Math.sin(a) * r };
}
function moveToward(e, target, speed, dt) {
  const dx = target.x - e.x, dy = target.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return 0;
  const step = Math.min(d, speed * dt);
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  return d - step;
}

function tongueHitsEnemy(tongue, e, field) {
  if (e.dead) return false;
  if (!tongue.active) return false;
  const def = ENEMY_TYPES[e.type];
  const x0 = field.cx, y0 = field.cy;
  const L = tongue.len;
  const x1 = x0 + Math.cos(tongue.angle) * L;
  const y1 = y0 + Math.sin(tongue.angle) * L;
  const vx = x1 - x0, vy = y1 - y0;
  const wx = e.x - x0, wy = e.y - y0;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return false;
  const c2 = vx * vx + vy * vy;
  const t = Math.min(1, c1 / c2);
  const px = x0 + t * vx, py = y0 + t * vy;
  const d = Math.hypot(e.x - px, e.y - py);
  return d < def.hitRadius + 6;
}

window.GAME = { ENEMY_TYPES, DIRS, difficultyFromScore, spawnEnemy, makeEnemy, updateEnemy, tongueHitsEnemy, ATTACK_RADIUS_RATIO };
