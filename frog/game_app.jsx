// Main app

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const THEMES = {
  pond:    { bgA: '#2a7d55', bgB: '#0f3a24', accent: '#ffd84d', name: '沼' },
  blueprint: { bgA: '#0b2a4a', bgB: '#061629', accent: '#7dd3fc', name: '青写真' },
  sunset:  { bgA: '#e07a3f', bgB: '#5a1a3a', accent: '#ffd84d', name: '夕焼け' },
};

// --- Tap-zone overlay (8 slices) ---------------------------------
function TapZones({ show, active, radius }) {
  if (!show) return null;
  const slices = [];
  for (let i = 0; i < 8; i++) {
    // slice i is centered on angle i * π/4 (matches dirIdx: 0=right, CCW)
    const center = i * (Math.PI * 2 / 8);
    const a0 = center - Math.PI / 8;
    const a1 = center + Math.PI / 8;
    const x0 = Math.cos(a0) * radius, y0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, y1 = Math.sin(a1) * radius;
    const d = `M 0 0 L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
    slices.push(
      <path key={i} d={d}
        fill={active === i ? 'rgba(255,216,77,0.22)' : 'rgba(255,255,255,0.02)'}
        stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
    );
  }
  return <g>{slices}</g>;
}

// --- Grid background ---------------------------------------------
function Grid({ kind, w, h }) {
  if (kind === 'none') return null;
  if (kind === 'dots') {
    return (
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1.2px, transparent 1.2px)',
        backgroundSize: '32px 32px',
      }} />
    );
  }
  // lines
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }} />
  );
}

// --- Main game ---------------------------------------------------
function App() {
  const [mode, setMode] = useState('title'); // title | play | paused | over
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [hiScore, setHiScore] = useState(() => +(localStorage.getItem('frog_hi') || 0));
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // --- Persistent upgrade system ---
  const [coins, setCoins] = useState(() => window.upgradesApi.loadWallet());
  const [levels, setLevels] = useState(() => window.upgradesApi.loadLevels());
  const values = useMemo(() => window.upgradesApi.resolve(levels), [levels]);
  const [shopOpen, setShopOpen] = useState(false);

  // live refs for values used inside the RAF loop
  const valuesRef = useRef(values);
  useEffect(() => { valuesRef.current = values; }, [values]);
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);
  const lastCoinScoreRef = useRef(0);

  const buyUpgrade = useCallback((key) => {
    const def = window.UPGRADES_DEF[key];
    const curLvl = levels[key] || 0;
    if (curLvl >= def.maxLevel) return;
    if (coins < def.cost) return;
    const nextLevels = { ...levels, [key]: curLvl + 1 };
    const nextCoins = coins - def.cost;
    setLevels(nextLevels); setCoins(nextCoins);
    window.upgradesApi.saveLevels(nextLevels);
    window.upgradesApi.saveWallet(nextCoins);
  }, [levels, coins]);

  const resetUpgrades = useCallback(() => {
    const refund = window.upgradesApi.totalSpent(levels);
    const nextLevels = Object.fromEntries(Object.keys(window.UPGRADES_DEF).map(k => [k, 0]));
    const nextCoins = coins + refund;
    setLevels(nextLevels); setCoins(nextCoins);
    window.upgradesApi.saveLevels(nextLevels);
    window.upgradesApi.saveWallet(nextCoins);
  }, [levels, coins]);
  const [tweaks, setTweaks] = useState(() => ({
    theme: (window.TWEAKS && window.TWEAKS.theme) || 'pond',
    grid: (window.TWEAKS && window.TWEAKS.grid) || 'dots',
    difficultyCurve: (window.TWEAKS && window.TWEAKS.difficultyCurve) || 'normal',
    enemySpawnRateMult: (window.TWEAKS && window.TWEAKS.enemySpawnRateMult) || 1,
    showTapZones: (window.TWEAKS && window.TWEAKS.showTapZones) !== false,
    layout: (window.TWEAKS && window.TWEAKS.layout) || 'top',
  }));

  const theme = THEMES[tweaks.theme] || THEMES.pond;

  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // Debug panel visible
  const [showDebug, setShowDebug] = useState(false);

  // Play field: circle centered on screen
  const field = useMemo(() => {
    const cx = size.w / 2;
    const cy = size.h / 2;
    const radius = Math.min(size.w, size.h) * 0.44;
    return { cx, cy, radius, frogRadius: 56 };
  }, [size]);

  // ---- Tweaks bridge (host toolbar) ----
  useEffect(() => {
    const onMsg = (ev) => {
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === '__activate_edit_mode') setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (k, v) => {
    setTweaks(t => {
      const n = { ...t, [k]: v };
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
      return n;
    });
  };

  // ---- Game state refs (avoid re-render on every frame) ----
  const enemiesRef = useRef([]);
  const tongueRef = useRef({ active: false, angle: 0, len: 0, maxLen: 0, phase: 'out', t: 0, dirIdx: -1 });
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const lastLifeScoreRef = useRef(0);
  const spawnAccumRef = useRef(0);
  const lastBossScoreRef = useRef(0);
  const hurtFlashRef = useRef(0);
  const frogShakeRef = useRef(0);
  const eyeLookRef = useRef({ x: 0, y: 0 });
  const floatsRef = useRef([]); // score pop-ups
  const [, tick] = useState(0);
  const forceRender = useCallback(() => tick(v => v + 1), []);

  // ---- Start / reset ----
  const startGame = useCallback(() => {
    enemiesRef.current = [];
    tongueRef.current = { active: false, angle: 0, len: 0, maxLen: 0, phase: 'out', t: 0, dirIdx: -1 };
    scoreRef.current = 0;
    const maxL = valuesRef.current.maxLives;
    livesRef.current = maxL;
    lastLifeScoreRef.current = 0;
    lastCoinScoreRef.current = 0;
    spawnAccumRef.current = 1.0;
    lastBossScoreRef.current = 0;
    floatsRef.current = [];
    setScore(0); setLives(maxL);
    setMode('play');
  }, []);

  const togglePause = useCallback(() => {
    setMode(m => m === 'play' ? 'paused' : m === 'paused' ? 'play' : m);
  }, []);

  // ---- Input: compute direction from tap ----
  const aimTongue = useCallback((cx, cy) => {
    if (mode !== 'play') return;
    if (tongueRef.current.active) return;
    const dx = cx - field.cx;
    const dy = cy - field.cy;
    if (Math.hypot(dx, dy) < 20) return; // dead zone
    const angle = Math.atan2(dy, dx);
    // snap to one of 8 directions: index 0 = right (+x), CCW
    let idx = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 8)) % 8;
    const snapAngle = idx * (Math.PI * 2 / 8);
    const maxLen = field.radius + 80;
    tongueRef.current = { active: true, angle: snapAngle, len: 0, maxLen, phase: 'out', t: 0, dirIdx: idx };
  }, [mode, field]);

  // Pointer handlers (mouse + touch unified via pointer events)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (mode === 'title' || mode === 'over') return;
      aimTongue(x, y);
    };
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const dx = x - field.cx, dy = y - field.cy;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        eyeLookRef.current = { x: dx / d * 0.8, y: dy / d * 0.8 };
      }
      // allow drag to re-aim if tongue not active
      if (ev.buttons && !tongueRef.current.active && mode === 'play') {
        aimTongue(x, y);
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
    };
  }, [mode, aimTongue, field]);

  // Numpad / keyboard controls — fire tongue in 8 directions
  const fireTongueDir = useCallback((idx) => {
    if (mode !== 'play') return;
    if (tongueRef.current.active) return;
    const snapAngle = idx * (Math.PI * 2 / 8);
    const maxLen = field.radius + 80;
    // eye look in that direction for feedback
    eyeLookRef.current = { x: Math.cos(snapAngle) * 0.8, y: Math.sin(snapAngle) * 0.8 };
    tongueRef.current = { active: true, angle: snapAngle, len: 0, maxLen, phase: 'out', t: 0, dirIdx: idx };
  }, [mode, field]);

  // Awards life-bonus + coin-bonus based on scoreRef.current. Call after mutating score.
  const awardProgress = useCallback(() => {
    // +1 life per 1000 score (cap = current maxLives upgrade)
    while (scoreRef.current - lastLifeScoreRef.current >= 1000) {
      lastLifeScoreRef.current += 1000;
      const cap = valuesRef.current.maxLives;
      if (livesRef.current < cap) {
        livesRef.current += 1;
        setLives(livesRef.current);
        floatsRef.current.push({ id: Math.random(), x: field.cx, y: field.cy - 90, pts: '+♥', t: 0, color: '#ff4d6d' });
      }
    }
    // +1 coin per 500 score
    while (scoreRef.current - lastCoinScoreRef.current >= 500) {
      lastCoinScoreRef.current += 500;
      const next = coinsRef.current + 1;
      coinsRef.current = next;
      setCoins(next);
      window.upgradesApi.saveWallet(next);
      floatsRef.current.push({ id: Math.random(), x: field.cx, y: field.cy - 120, pts: '+🪙', t: 0, color: '#ffd84d' });
    }
    setScore(scoreRef.current);
  }, [field]);

  // ---- Debug helpers ----
  const debugAddScore = useCallback((n) => {
    if (mode !== 'play') return;
    scoreRef.current += n;
    awardProgress();
  }, [mode, awardProgress]);
  const debugSpawnBoss = useCallback(() => {
    if (mode !== 'play') return;
    const bossAlive = enemiesRef.current.some(x => x.type === 'dragonfly' && !x.dead);
    if (bossAlive) return;
    const diff = window.GAME.difficultyFromScore(scoreRef.current, tweaks.difficultyCurve, tweaks.enemySpawnRateMult);
    enemiesRef.current.push(window.GAME.makeEnemy('dragonfly', field, diff));
  }, [mode, tweaks, field]);
  const debugHeal = useCallback(() => {
    if (mode !== 'play') return;
    const cap = valuesRef.current.maxLives;
    livesRef.current = cap;
    setLives(cap);
  }, [mode]);

  useEffect(() => {
    const onKey = (ev) => {
      const map = {
        '6': 0, '3': 1, '2': 2, '1': 3, '4': 4, '7': 5, '8': 6, '9': 7,
        'Numpad6': 0, 'Numpad3': 1, 'Numpad2': 2, 'Numpad1': 3,
        'Numpad4': 4, 'Numpad7': 5, 'Numpad8': 6, 'Numpad9': 7,
        'Digit6': 0, 'Digit3': 1, 'Digit2': 2, 'Digit1': 3,
        'Digit4': 4, 'Digit7': 5, 'Digit8': 6, 'Digit9': 7,
      };
      let idx = map[ev.code];
      if (idx == null) idx = map[ev.key];
      if (idx != null) {
        ev.preventDefault();
        fireTongueDir(idx);
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (mode === 'title' || mode === 'over') { ev.preventDefault(); startGame(); }
        else if (mode === 'play' || mode === 'paused') { ev.preventDefault(); togglePause(); }
      }
      if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') {
        if (mode === 'play' || mode === 'paused') { ev.preventDefault(); togglePause(); }
      }
      // DEBUG hotkeys
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); debugAddScore(500); }
      if (ev.key === 'b' || ev.key === 'B') { ev.preventDefault(); debugSpawnBoss(); }
      if (ev.key === 'h' || ev.key === 'H') { ev.preventDefault(); debugHeal(); }
    };
    // Attach to both window AND document AND the container to maximize chance of capture across iframe focus states.
    window.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onKey);
    };
  }, [fireTongueDir, mode, startGame, togglePause, debugAddScore, debugSpawnBoss, debugHeal]);

  // Auto-focus the game container so the iframe receives keyboard events
  useEffect(() => {
    const focus = () => {
      try { window.focus(); } catch(_) {}
      if (containerRef.current) containerRef.current.focus();
    };
    focus();
    const onClick = () => focus();
    window.addEventListener('pointerdown', onClick);
    return () => window.removeEventListener('pointerdown', onClick);
  }, []);

  // ---- Game loop ----
  useEffect(() => {
    if (mode !== 'play') return;
    let raf = 0;
    let last = performance.now();
    // reset timing baseline so unpausing doesn't cause a huge dt jump
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Difficulty
      const diff = window.GAME.difficultyFromScore(scoreRef.current, tweaks.difficultyCurve, tweaks.enemySpawnRateMult);

      // Spawn regular enemies
      spawnAccumRef.current -= dt;
      if (spawnAccumRef.current <= 0 && enemiesRef.current.length < diff.maxOnScreen) {
        const hornetCount = enemiesRef.current.filter(x => x.type === 'hornet' && !x.dead).length;
        enemiesRef.current.push(window.GAME.spawnEnemy(field, scoreRef.current, diff, { hornetCount }));
        spawnAccumRef.current = diff.baseInterval * (0.7 + Math.random() * 0.6);
      }

      // Boss spawn every 2500 points
      const bossTier = Math.floor(scoreRef.current / 2500);
      const bossAlive = enemiesRef.current.some(x => x.type === 'dragonfly' && !x.dead);
      if (bossTier > lastBossScoreRef.current && !bossAlive) {
        lastBossScoreRef.current = bossTier;
        enemiesRef.current.push(window.GAME.makeEnemy('dragonfly', field, diff));
      }

      // Update tongue
      const t = tongueRef.current;
      if (t.active) {
        t.t += dt;
        const outTime = 0.12;
        const holdTime = (valuesRef.current.tongueHold || 50) / 1000; // upgrade: 50..290ms
        const inTime = 0.15;
        if (t.phase === 'out') {
          t.len = Math.min(t.maxLen, (t.t / outTime) * t.maxLen);
          if (t.t >= outTime) { t.phase = 'hold'; t.t = 0; }
        } else if (t.phase === 'hold') {
          t.len = t.maxLen;
          if (t.t >= holdTime) { t.phase = 'in'; t.t = 0; }
        } else {
          t.len = Math.max(0, t.maxLen * (1 - t.t / inTime));
          if (t.t >= inTime) { t.active = false; t.len = 0; t.dirIdx = -1; }
        }
      }

      // Update enemies & collision with tongue
      const survived = [];
      for (const e of enemiesRef.current) {
        if (!e.dead && t.active && window.GAME.tongueHitsEnemy(t, e, field)) {
          const def = window.GAME.ENEMY_TYPES[e.type];
          if (def.isBoss) {
            // multi-HP hit — only one hit per tongue activation
            if (!e.hitThisTongue) {
              e.hitThisTongue = true;
              e.hp -= 1;
              e.hitFlash = 0.25;
              if (e.hp <= 0) {
                e.dead = true; e.deathT = 0;
                scoreRef.current += def.score;
                floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y, pts: def.score, t: 0 });
                awardProgress();
              } else {
                floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y - 20, pts: 'HIT ' + (def.hp - e.hp) + '/' + def.hp, t: 0, color: '#ffd84d' });
              }
            }
          } else {
            e.dead = true; e.deathT = 0;
            const pts = def.score;
            scoreRef.current += pts;
            floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y, pts, t: 0 });
            awardProgress();
          }
        }
        // reset per-tongue flag when tongue inactive
        if (!t.active) e.hitThisTongue = false;
        const remove = window.GAME.updateEnemy(e, dt, field, (hitter) => {
          livesRef.current -= 1;
          setLives(livesRef.current);
          hurtFlashRef.current = 0.5;
          frogShakeRef.current = 0.4;
          if (livesRef.current <= 0) {
            const hi = Math.max(hiScore, scoreRef.current);
            if (hi !== hiScore) { setHiScore(hi); localStorage.setItem('frog_hi', String(hi)); }
            setMode('over');
          }
        });
        if (!remove) survived.push(e);
      }
      enemiesRef.current = survived;

      // update floats
      floatsRef.current = floatsRef.current.filter(f => {
        f.t += dt;
        f.y -= 36 * dt;
        return f.t < 0.9;
      });

      if (hurtFlashRef.current > 0) hurtFlashRef.current -= dt;
      if (frogShakeRef.current > 0) frogShakeRef.current -= dt;

      forceRender();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, field, tweaks.difficultyCurve, tweaks.enemySpawnRateMult, forceRender, hiScore]);

  // ---- Render ----
  const tongue = tongueRef.current;
  const shake = frogShakeRef.current;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * 10 : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * 10 : 0;

  return (
    <div ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${theme.bgA} 0%, ${theme.bgB} 75%, #050d08 100%)`,
        overflow: 'hidden', cursor: mode === 'play' ? 'crosshair' : 'default',
      }}>

      <Grid kind={tweaks.grid} w={size.w} h={size.h} />

      {/* hurt flash */}
      {hurtFlashRef.current > 0 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'rgba(255,77,109,' + (hurtFlashRef.current * 0.5) + ')',
          mixBlendMode: 'screen',
        }} />
      )}

      {/* SVG play field */}
      <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <g transform={`translate(${field.cx} ${field.cy})`}>
          <Pond radius={field.radius} />
          <TapZones show={tweaks.showTapZones && mode === 'play'} active={tongue.active ? tongue.dirIdx : -1} radius={field.radius} />
          {/* play field ring */}
          <circle r={field.radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 6" />
          {/* 2/3 attack radius (subtle) */}
          <circle r={field.radius * window.GAME.ATTACK_RADIUS_RATIO} fill="none" stroke="rgba(255,77,109,0.12)" strokeWidth="1" strokeDasharray="2 8" />
        </g>

        {/* tongue */}
        {tongue.active && (
          <g transform={`translate(${field.cx} ${field.cy}) rotate(${tongue.angle * 180 / Math.PI})`}>
            <rect x="0" y="-7" width={tongue.len} height="14" rx="7" fill="#ff4d7a" stroke="#c42e5a" strokeWidth="2" />
            <circle cx={tongue.len} cy="0" r="11" fill="#ff4d7a" stroke="#c42e5a" strokeWidth="2" />
            <circle cx={tongue.len - 3} cy="-3" r="3" fill="#ffb0c8" opacity="0.8" />
          </g>
        )}
      </svg>

      {/* Enemies (absolutely positioned divs) */}
      {enemiesRef.current.map(e => {
        const def = window.GAME.ENEMY_TYPES[e.type];
        const Comp = window[def.Comp];
        const flap = e.flap;
        const angle = Math.atan2(field.cy - e.y, field.cx - e.x);
        const rotDeg = angle * 180 / Math.PI + 90;
        const dying = e.dead;
        const dyingDur = def.isBoss ? 0.5 : 0.35;
        const scale = dying ? (1 - e.deathT / dyingDur) * 1.6 : 1;
        const opacity = dying ? (1 - e.deathT / dyingDur) : 1;
        const extraProps = def.isBoss ? { hitFlash: e.hitFlash || 0 } : {};
        return (
          <div key={e.id} style={{
            position: 'absolute', left: e.x, top: e.y,
            transform: `translate(-50%, -50%) rotate(${rotDeg}deg) scale(${scale})`,
            opacity,
            pointerEvents: 'none',
            transition: 'none',
          }}>
            <Comp size={def.size} flap={flap} {...extraProps} />
            {def.isBoss && !dying && (
              <div style={{
                position: 'absolute', left: '50%', top: -28,
                transform: `translate(-50%, 0) rotate(${-rotDeg}deg)`,
                display: 'flex', gap: 4,
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 16, height: 6, borderRadius: 3,
                    background: e.hp > i ? '#ff4d6d' : 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(0,0,0,0.4)',
                  }} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Frog */}
      {(mode === 'play' || mode === 'over') && (
        <div style={{
          position: 'absolute', left: field.cx + shakeX, top: field.cy + shakeY,
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}>
          <Frog size={130} mouthOpen={tongue.active} eyeLook={eyeLookRef.current} hurt={hurtFlashRef.current > 0} />
        </div>
      )}

      {/* Score floats */}
      {floatsRef.current.map(f => (
        <div key={f.id} style={{
          position: 'absolute', left: f.x, top: f.y,
          transform: 'translate(-50%, -50%)',
          color: f.color || '#ffd84d',
          fontWeight: 900, fontSize: 22,
          textShadow: '0 2px 0 rgba(0,0,0,0.4)',
          opacity: 1 - f.t / 0.9,
          pointerEvents: 'none',
        }}>
          {typeof f.pts === 'number' ? `+${f.pts}` : f.pts}
        </div>
      ))}

      {/* HUD */}
      {(mode === 'play' || mode === 'paused') && <HUD score={score} hi={hiScore} lives={lives} maxLives={values.maxLives} coins={coins} layout={tweaks.layout} onPause={togglePause} paused={mode === 'paused'} onToggleDebug={() => setShowDebug(v => !v)} debugOpen={showDebug} />}

      {showDebug && (mode === 'play' || mode === 'paused') && (
        <DebugPanel
          score={score} lives={lives}
          onAddScore={() => debugAddScore(500)}
          onAddScore1k={() => debugAddScore(1000)}
          onAddScore2500={() => debugAddScore(2500)}
          onSpawnBoss={debugSpawnBoss}
          onHeal={debugHeal}
          onClose={() => setShowDebug(false)}
        />
      )}

      {mode === 'paused' && <PauseScreen onResume={togglePause} onHome={() => setMode('title')} />}

      {/* Title screen */}
      {mode === 'title' && (
        <TitleScreen
          onStart={startGame}
          hi={hiScore}
          theme={theme}
          coins={coins}
          onOpenShop={() => setShopOpen(true)}
        />
      )}

      {/* Shop dialog */}
      {mode === 'title' && shopOpen && (
        <ShopDialog
          coins={coins}
          levels={levels}
          onBuy={buyUpgrade}
          onReset={resetUpgrades}
          onClose={() => setShopOpen(false)}
        />
      )}

      {/* Game over */}
      {mode === 'over' && <GameOverScreen score={scoreRef.current} hi={hiScore} onRetry={startGame} onHome={() => setMode('title')} />}

      {/* Tweaks panel */}
      {tweaksOpen && <TweaksPanel tweaks={tweaks} update={updateTweak} />}
    </div>
  );
}

// --- HUD ----------------------------------------------------------
function HUD({ score, hi, lives, maxLives, coins, layout, onPause, paused, onToggleDebug, debugOpen }) {
  const top = layout === 'top';
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      top: top ? 0 : 'auto', bottom: top ? 'auto' : 0,
      padding: '18px 22px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      pointerEvents: 'none',
      background: top
        ? 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))'
        : 'linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0))',
    }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, fontFamily: 'JetBrains Mono, monospace' }}>SCORE</div>
        <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, textShadow: '0 3px 0 rgba(0,0,0,0.35)' }}>{score.toLocaleString()}</div>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.55, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>BEST {hi.toLocaleString()}</div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 180 }}>
            {Array.from({ length: maxLives }).map((_, i) => <Heart key={i} size={28} filled={lives > i} />)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffd84d', letterSpacing: 1, fontFamily: 'JetBrains Mono, monospace' }}>
            🪙 {coins}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPause && onPause(); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={paused ? 'Resume' : 'Pause'}
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, fontFamily: 'inherit',
          }}>
          {paused ? (
            <svg width="18" height="20" viewBox="0 0 18 20"><path d="M2 1 L17 10 L2 19 Z" fill="#fff" /></svg>
          ) : (
            <svg width="18" height="20" viewBox="0 0 18 20"><rect x="2" y="1" width="5" height="18" rx="1.5" fill="#fff" /><rect x="11" y="1" width="5" height="18" rx="1.5" fill="#fff" /></svg>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDebug && onToggleDebug(); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Debug"
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: debugOpen ? 'rgba(255,216,77,0.25)' : 'rgba(255,255,255,0.12)',
            border: '1px solid ' + (debugOpen ? 'rgba(255,216,77,0.5)' : 'rgba(255,255,255,0.18)'),
            color: debugOpen ? '#ffd84d' : '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 800,
            letterSpacing: 0.5,
          }}>
          🐛
        </button>
      </div>
    </div>
  );
}

// --- Pause screen -------------------------------------------------
function PauseScreen({ onResume, onHome }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 50,
    }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 16, letterSpacing: 6, opacity: 0.75, fontFamily: 'JetBrains Mono, monospace' }}>PAUSED</div>
      <div style={{ marginTop: 18, fontSize: 56, fontWeight: 900, lineHeight: 1, textShadow: '0 6px 0 rgba(0,0,0,0.4)' }}>
        一時停止
      </div>
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.55, fontFamily: 'JetBrains Mono, monospace' }}>
        P · ESC · SPACE で再開
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 32 }}>
        <button onClick={onHome} style={btnStyle(false)}>タイトル</button>
        <button onClick={onResume} style={btnStyle(true)}>再開</button>
      </div>
    </div>
  );
}

// --- Title screen -------------------------------------------------
function TitleScreen({ onStart, hi, theme, coins, onOpenShop }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1), rgba(0,0,0,0.55))',
    }}>
      {/* Title (above frog) */}
      <h1 style={{
        margin: 0, fontSize: 64, fontWeight: 900, letterSpacing: -2,
        textShadow: '0 6px 0 rgba(0,0,0,0.4)', color: '#fff',
        textAlign: 'center', lineHeight: 1.05,
      }}>
        カエル<span style={{ color: theme.accent }}>ファイト</span>
      </h1>
      <div style={{ fontSize: 13, letterSpacing: 4, opacity: 0.7, marginTop: 6, marginBottom: 18, fontFamily: 'JetBrains Mono, monospace' }}>
        FROG · FIGHT · ENDLESS
      </div>

      {/* Frog centered */}
      <div style={{ margin: '4px 0' }}>
        <Frog size={180} mouthOpen={false} eyeLook={{x: 0, y: 0.1}} />
      </div>

      {/* Start button */}
      <button onClick={onStart}
        style={{
          pointerEvents: 'auto', marginTop: 22, padding: '16px 48px', borderRadius: 999,
          border: 'none', fontSize: 22, fontWeight: 900, letterSpacing: 2,
          background: theme.accent, color: '#1a1a1a', cursor: 'pointer',
          boxShadow: '0 6px 0 rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.3)',
          fontFamily: 'inherit',
        }}>
        スタート
      </button>

      {/* Shop button + coins */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, pointerEvents: 'auto' }}>
        <button onClick={onOpenShop}
          style={{
            padding: '10px 20px', borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            border: '1.5px solid rgba(255,216,77,0.6)',
            color: '#ffd84d', cursor: 'pointer',
            fontSize: 14, fontWeight: 800, letterSpacing: 1.5,
            fontFamily: 'inherit',
          }}>
            🛒 SHOP
          </button>
        <div style={{
          padding: '10px 18px', borderRadius: 999,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 14, fontWeight: 800, letterSpacing: 1,
          color: '#ffd84d', fontFamily: 'JetBrains Mono, monospace',
        }}>
          🪙 {coins}
        </div>
      </div>

      <div style={{ marginTop: 22, fontSize: 13, opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>
        BEST SCORE · {hi.toLocaleString()}
      </div>

      {/* legend */}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 22, opacity: 0.85 }}>
        <LegendItem label="コバエ" pts="5" Comp={Gnat} size={26} />
        <LegendItem label="ハエ" pts="10" Comp={Fly} size={32} />
        <LegendItem label="ハチ" pts="50" Comp={Bee} size={40} />
        <LegendItem label="スズメバチ" pts="150" Comp={Hornet} size={46} />
      </div>
    </div>
  );
}
function LegendItem({ label, pts, Comp, size }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Comp size={size} flap={0} />
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#ffd84d' }}>{pts}</div>
    </div>
  );
}

// --- Shop dialog --------------------------------------------------
function ShopDialog({ coins, levels, onBuy, onReset, onClose }) {
  const defs = window.UPGRADES_DEF;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320, background: 'rgba(12,22,15,0.97)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 18, padding: 22,
          boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          color: '#fff',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 3 }}>🛒 SHOP</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#ffd84d', fontSize: 15 }}>
              🪙 {coins}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1, opacity: 0.6 }}>×</button>
          </div>
        </div>

        {/* アップグレード一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(defs).map(([key, def]) => {
            const lvl = levels[key] || 0;
            const maxed = lvl >= def.maxLevel;
            const canBuy = !maxed && coins >= def.cost;
            const currentVal = def.base + def.step * lvl;
            const nextVal = def.base + def.step * (lvl + 1);
            return (
              <div key={key} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                {/* タイトル行 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{def.icon} {def.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{def.description}</div>
                  </div>
                  {/* レベルインジケーター */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {Array.from({ length: def.maxLevel }).map((_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: 3,
                        background: i < lvl ? '#ffd84d' : 'rgba(255,255,255,0.15)',
                        border: '1px solid rgba(0,0,0,0.3)',
                      }} />
                    ))}
                  </div>
                </div>

                {/* 現在値 / 次の値 */}
                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', opacity: 0.75, marginBottom: 8 }}>
                  {maxed
                    ? <span style={{ color: '#ffd84d' }}>MAX: {def.format(currentVal)}</span>
                    : <span>現在: {def.format(currentVal)} → <span style={{ color: '#7dd3fc' }}>{def.format(nextVal)}</span></span>
                  }
                </div>

                {/* 購入ボタン */}
                {!maxed && (
                  <button
                    onClick={() => onBuy(key)}
                    disabled={!canBuy}
                    style={{
                      width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
                      background: canBuy ? '#ffd84d' : 'rgba(255,255,255,0.08)',
                      color: canBuy ? '#1a1a1a' : 'rgba(255,255,255,0.35)',
                      fontWeight: 800, fontSize: 13, cursor: canBuy ? 'pointer' : 'default',
                      fontFamily: 'inherit', letterSpacing: 1,
                    }}
                  >
                    🪙 {def.cost} で強化
                  </button>
                )}
                {maxed && (
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#ffd84d', opacity: 0.85, letterSpacing: 2 }}>
                    MAX LEVEL
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* リセットボタン */}
        <button
          onClick={onReset}
          style={{
            width: '100%', marginTop: 14, padding: '9px 0', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(255,100,100,0.4)',
            color: 'rgba(255,150,150,0.8)', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, fontFamily: 'inherit', letterSpacing: 1,
          }}
        >
          リセット（コイン全額返金）
        </button>
      </div>
    </div>
  );
}

// --- Game over ----------------------------------------------------
function GameOverScreen({ score, hi, onRetry, onHome }) {
  const isNew = score >= hi && score > 0;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    }}>
      <div style={{ fontSize: 16, letterSpacing: 6, opacity: 0.75, fontFamily: 'JetBrains Mono, monospace' }}>GAME OVER</div>
      {isNew && <div style={{ marginTop: 10, fontSize: 16, color: '#ffd84d', letterSpacing: 3, fontWeight: 700 }}>NEW BEST!</div>}
      <div style={{ marginTop: 20, fontSize: 84, fontWeight: 900, lineHeight: 1, textShadow: '0 6px 0 rgba(0,0,0,0.4)' }}>
        {score.toLocaleString()}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>BEST · {hi.toLocaleString()}</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
        <button onClick={onHome} style={btnStyle(false)}>タイトル</button>
        <button onClick={onRetry} style={btnStyle(true)}>もう一度</button>
      </div>
    </div>
  );
}
function btnStyle(primary) {
  return {
    padding: '14px 34px', borderRadius: 999, border: 'none',
    fontSize: 17, fontWeight: 800, letterSpacing: 1, cursor: 'pointer',
    background: primary ? '#ffd84d' : 'rgba(255,255,255,0.12)',
    color: primary ? '#1a1a1a' : '#fff',
    boxShadow: primary ? '0 5px 0 rgba(0,0,0,0.35)' : '0 3px 0 rgba(0,0,0,0.3)',
    fontFamily: 'inherit',
  };
}

// --- Tweaks panel -------------------------------------------------
function TweaksPanel({ tweaks, update }) {
  return (
    <div style={{
      position: 'absolute', right: 18, bottom: 18, width: 260,
      background: 'rgba(12,18,14,0.92)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14, padding: 16,
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      fontSize: 13, zIndex: 100,
    }}>
      <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 12, opacity: 0.7, marginBottom: 14, fontFamily: 'JetBrains Mono, monospace' }}>
        TWEAKS
      </div>
      <Row label="テーマ">
        <Seg opts={[['pond','沼'],['blueprint','青写真'],['sunset','夕焼け']]} v={tweaks.theme} on={v => update('theme', v)} />
      </Row>
      <Row label="背景">
        <Seg opts={[['dots','dots'],['lines','lines'],['none','none']]} v={tweaks.grid} on={v => update('grid', v)} />
      </Row>
      <Row label="HUD位置">
        <Seg opts={[['top','上'],['bottom','下']]} v={tweaks.layout} on={v => update('layout', v)} />
      </Row>
      <Row label="難度">
        <Seg opts={[['chill','易'],['normal','普'],['spicy','辛']]} v={tweaks.difficultyCurve} on={v => update('difficultyCurve', v)} />
      </Row>
      <Row label="出現倍率">
        <input type="range" min="0.5" max="2" step="0.1"
          value={tweaks.enemySpawnRateMult}
          onChange={e => update('enemySpawnRateMult', +e.target.value)}
          style={{ width: '100%' }} />
        <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, opacity: 0.7 }}>
          ×{tweaks.enemySpawnRateMult.toFixed(1)}
        </div>
      </Row>
      <Row label="タップ領域">
        <Seg opts={[[true, 'show'], [false, 'hide']]} v={tweaks.showTapZones} on={v => update('showTapZones', v)} />
      </Row>
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.65, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Seg({ opts, v, on }) {
  return (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
      {opts.map(([val, lbl]) => (
        <button key={String(val)} onClick={() => on(val)}
          style={{
            flex: 1, padding: '7px 8px', border: 'none',
            background: v === val ? 'rgba(255,216,77,0.22)' : 'transparent',
            color: v === val ? '#ffd84d' : '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>{lbl}</button>
      ))}
    </div>
  );
}

function DebugPanel({ score, lives, onAddScore, onAddScore1k, onAddScore2500, onSpawnBoss, onHeal, onClose }) {
  const btn = {
    padding: '9px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
    fontFamily: 'JetBrains Mono, monospace',
    textAlign: 'left',
  };
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left: 18, bottom: 18, width: 220,
        background: 'rgba(12,18,14,0.92)',
        border: '1px solid rgba(255,216,77,0.35)',
        borderRadius: 14, padding: 14, zIndex: 60,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 3, opacity: 0.8 }}>🐛 DEBUG</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.6, fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <button style={btn} onClick={onAddScore}>+500 スコア <span style={{opacity:0.5}}> (+/=)</span></button>
        <button style={btn} onClick={onAddScore1k}>+1000 スコア</button>
        <button style={btn} onClick={onAddScore2500}>+2500 スコア</button>
        <button style={btn} onClick={onSpawnBoss}>ボス召喚 <span style={{opacity:0.5}}> (B)</span></button>
        <button style={btn} onClick={onHeal}>ライフ全快 <span style={{opacity:0.5}}> (H)</span></button>
      </div>
      <div style={{ marginTop: 10, fontSize: 10, opacity: 0.55, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>
        score {score} · lives {lives}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
