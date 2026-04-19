// Main app
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const THEMES = {
  pond:      { bgA: '#2a7d55', bgB: '#0f3a24', accent: '#ffd84d', name: '沼' },
  blueprint: { bgA: '#0b2a4a', bgB: '#061629', accent: '#7dd3fc', name: '青写真' },
  sunset:    { bgA: '#e07a3f', bgB: '#5a1a3a', accent: '#ffd84d', name: '夕焼け' },
};

function TapZones({ show, activeDirs, radius }) {
  if (!show) return null;
  const slices = [];
  for (let i = 0; i < 8; i++) {
    const center = i * (Math.PI * 2 / 8);
    const a0 = center - Math.PI / 8, a1 = center + Math.PI / 8;
    const x0 = Math.cos(a0) * radius, y0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, y1 = Math.sin(a1) * radius;
    const d = `M 0 0 L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
    slices.push(
      <path key={i} d={d}
        fill={activeDirs.includes(i) ? 'rgba(255,216,77,0.22)' : 'rgba(255,255,255,0.02)'}
        stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
    );
  }
  return <g>{slices}</g>;
}

function Grid({ kind }) {
  if (kind === 'none') return null;
  if (kind === 'dots') return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none',
      backgroundImage:'radial-gradient(rgba(255,255,255,0.08) 1.2px, transparent 1.2px)',
      backgroundSize:'32px 32px' }} />
  );
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none',
      backgroundImage:'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize:'48px 48px' }} />
  );
}

// ── App ────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState('title');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [hiScore, setHiScore] = useState(() => +(localStorage.getItem('frog_hi') || 0));
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // アップグレード
  const [coins, setCoins] = useState(() => window.upgradesApi.loadWallet());
  const [levels, setLevels] = useState(() => window.upgradesApi.loadLevels());
  const values = useMemo(() => window.upgradesApi.resolve(levels), [levels]);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState('upgrade');

  // ガチャ
  const [ownedIds, setOwnedIds] = useState(() => window.gachaApi.loadOwned());
  const [selected, setSelected] = useState(() => window.gachaApi.loadSelected());
  const [gachaResult, setGachaResult] = useState(null);

  // live refs
  const valuesRef = useRef(values);
  useEffect(() => { valuesRef.current = values; }, [values]);
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);
  const lastCoinScoreRef = useRef(0);

  // スキンrefs（ゲームループで使用）
  const activeTongueSkinRef = useRef(null);
  const activeSpecialRef = useRef(null);
  useEffect(() => {
    const { TONGUE_SKINS, SPECIAL_FROGS } = window.GACHA_DATA;
    activeTongueSkinRef.current = TONGUE_SKINS.find(s => s.id === (selected.tongue || 'default')) || TONGUE_SKINS[0];
    activeSpecialRef.current = selected.special
      ? (SPECIAL_FROGS.find(s => s.id === selected.special) || null) : null;
  }, [selected]);

  const buyUpgrade = useCallback((key) => {
    const def = window.UPGRADES_DEF[key];
    const curLvl = levels[key] || 0;
    if (curLvl >= def.maxLevel || coins < def.cost) return;
    const nextLevels = { ...levels, [key]: curLvl + 1 };
    const nextCoins  = coins - def.cost;
    setLevels(nextLevels); setCoins(nextCoins);
    window.upgradesApi.saveLevels(nextLevels);
    window.upgradesApi.saveWallet(nextCoins);
  }, [levels, coins]);

  const resetUpgrades = useCallback(() => {
    const refund = window.upgradesApi.totalSpent(levels);
    const nextLevels = Object.fromEntries(Object.keys(window.UPGRADES_DEF).map(k => [k, 0]));
    const nextCoins  = coins + refund;
    setLevels(nextLevels); setCoins(nextCoins);
    window.upgradesApi.saveLevels(nextLevels);
    window.upgradesApi.saveWallet(nextCoins);
  }, [levels, coins]);

  const doPullGacha = useCallback(() => {
    const result = window.gachaApi.pullGacha(ownedIds, coins);
    if (!result) return;
    const nextCoins = coins - window.GACHA_DATA.GACHA_COST;
    setCoins(nextCoins);
    window.upgradesApi.saveWallet(nextCoins);
    if (!result.allOwned && result.item) {
      const nextOwned = [...ownedIds, result.item.id];
      setOwnedIds(nextOwned);
      window.gachaApi.saveOwned(nextOwned);
    }
    setGachaResult(result);
  }, [ownedIds, coins]);

  const selectSkin = useCallback((type, id) => {
    const nextSelected = { ...selected, [type]: id };
    setSelected(nextSelected);
    window.gachaApi.saveSelected(nextSelected);
  }, [selected]);

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
    window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, []);

  const field = useMemo(() => {
    const cx = size.w / 2, cy = size.h / 2;
    const radius = Math.min(size.w, size.h) * 0.44;
    return { cx, cy, radius, frogRadius: 56 };
  }, [size]);

  useEffect(() => {
    const onMsg = (ev) => {
      const d = ev.data; if (!d || typeof d !== 'object') return;
      if (d.type === '__activate_edit_mode')   setTweaksOpen(true);
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

  // ゲーム状態
  const enemiesRef      = useRef([]);
  const tonguesRef      = useRef([]); // 複数舌配列
  const scoreRef        = useRef(0);
  const livesRef        = useRef(3);
  const lastLifeScoreRef= useRef(0);
  const spawnAccumRef   = useRef(0);
  const lastBossScoreRef= useRef(0);
  const hurtFlashRef    = useRef(0);
  const frogShakeRef    = useRef(0);
  const eyeLookRef      = useRef({ x: 0, y: 0 });
  const floatsRef       = useRef([]);
  const [, tick] = useState(0);
  const forceRender = useCallback(() => tick(v => v + 1), []);

  // 舌発射ヘルパー
  const fireAtDir = useCallback((idx) => {
    const special = activeSpecialRef.current;
    const dirs    = special ? special.getTongueDirections(idx) : [idx];
    const maxLen  = field.radius + 80;
    tonguesRef.current = dirs.map(di => ({
      angle: di * Math.PI * 2 / 8, len: 0, maxLen, phase: 'out', t: 0, dirIdx: di,
    }));
    const snapAngle = idx * Math.PI * 2 / 8;
    eyeLookRef.current = { x: Math.cos(snapAngle) * 0.8, y: Math.sin(snapAngle) * 0.8 };
  }, [field]);

  const startGame = useCallback(() => {
    enemiesRef.current = []; tonguesRef.current = [];
    scoreRef.current = 0;
    const maxL = valuesRef.current.maxLives;
    livesRef.current = maxL;
    lastLifeScoreRef.current = 0; lastCoinScoreRef.current = 0;
    spawnAccumRef.current = 1.0; lastBossScoreRef.current = 0;
    floatsRef.current = [];
    setScore(0); setLives(maxL); setMode('play');
  }, []);

  const togglePause = useCallback(() => {
    setMode(m => m === 'play' ? 'paused' : m === 'paused' ? 'play' : m);
  }, []);

  const aimTongue = useCallback((cx, cy) => {
    if (mode !== 'play' || tonguesRef.current.length > 0) return;
    const dx = cx - field.cx, dy = cy - field.cy;
    if (Math.hypot(dx, dy) < 20) return;
    const angle = Math.atan2(dy, dx);
    const idx = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 8)) % 8;
    fireAtDir(idx);
  }, [mode, field, fireAtDir]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
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
      const dx = x - field.cx, dy = y - field.cy, d = Math.hypot(dx, dy);
      if (d > 1) eyeLookRef.current = { x: dx/d*0.8, y: dy/d*0.8 };
      if (ev.buttons && tonguesRef.current.length === 0 && mode === 'play') aimTongue(x, y);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    return () => { el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove); };
  }, [mode, aimTongue, field]);

  const fireTongueDir = useCallback((idx) => {
    if (mode !== 'play' || tonguesRef.current.length > 0) return;
    fireAtDir(idx);
  }, [mode, fireAtDir]);

  const awardProgress = useCallback(() => {
    while (scoreRef.current - lastLifeScoreRef.current >= 1000) {
      lastLifeScoreRef.current += 1000;
      const cap = valuesRef.current.maxLives;
      if (livesRef.current < cap) {
        livesRef.current += 1; setLives(livesRef.current);
        floatsRef.current.push({ id: Math.random(), x: field.cx, y: field.cy - 90, pts: '+♥', t: 0, color: '#ff4d6d' });
      }
    }
    while (scoreRef.current - lastCoinScoreRef.current >= 500) {
      lastCoinScoreRef.current += 500;
      const next = coinsRef.current + 1; coinsRef.current = next;
      setCoins(next); window.upgradesApi.saveWallet(next);
      floatsRef.current.push({ id: Math.random(), x: field.cx, y: field.cy - 120, pts: '+🪙', t: 0, color: '#ffd84d' });
    }
    setScore(scoreRef.current);
  }, [field]);

  const debugAddScore  = useCallback((n) => { if (mode !== 'play') return; scoreRef.current += n; awardProgress(); }, [mode, awardProgress]);
  const debugSpawnBoss = useCallback(() => {
    if (mode !== 'play' || enemiesRef.current.some(x => x.type === 'dragonfly' && !x.dead)) return;
    const diff = window.GAME.difficultyFromScore(scoreRef.current, tweaks.difficultyCurve, tweaks.enemySpawnRateMult);
    enemiesRef.current.push(window.GAME.makeEnemy('dragonfly', field, diff));
  }, [mode, tweaks, field]);
  const debugHeal = useCallback(() => { if (mode !== 'play') return; livesRef.current = valuesRef.current.maxLives; setLives(livesRef.current); }, [mode]);

  useEffect(() => {
    const onKey = (ev) => {
      const map = {
        '6':0,'3':1,'2':2,'1':3,'4':4,'7':5,'8':6,'9':7,
        'Numpad6':0,'Numpad3':1,'Numpad2':2,'Numpad1':3,'Numpad4':4,'Numpad7':5,'Numpad8':6,'Numpad9':7,
        'Digit6':0,'Digit3':1,'Digit2':2,'Digit1':3,'Digit4':4,'Digit7':5,'Digit8':6,'Digit9':7,
      };
      let idx = map[ev.code]; if (idx == null) idx = map[ev.key];
      if (idx != null) { ev.preventDefault(); fireTongueDir(idx); return; }
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (mode === 'title' || mode === 'over') { ev.preventDefault(); startGame(); }
        else if (mode === 'play' || mode === 'paused') { ev.preventDefault(); togglePause(); }
      }
      if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') {
        if (mode === 'play' || mode === 'paused') { ev.preventDefault(); togglePause(); }
      }
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); debugAddScore(500); }
      if (ev.key === 'b' || ev.key === 'B') { ev.preventDefault(); debugSpawnBoss(); }
      if (ev.key === 'h' || ev.key === 'H') { ev.preventDefault(); debugHeal(); }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onKey); };
  }, [fireTongueDir, mode, startGame, togglePause, debugAddScore, debugSpawnBoss, debugHeal]);

  useEffect(() => {
    const focus = () => { try { window.focus(); } catch(_) {} if (containerRef.current) containerRef.current.focus(); };
    focus(); window.addEventListener('pointerdown', focus);
    return () => window.removeEventListener('pointerdown', focus);
  }, []);

  // ゲームループ
  useEffect(() => {
    if (mode !== 'play') return;
    let raf = 0, last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const diff = window.GAME.difficultyFromScore(scoreRef.current, tweaks.difficultyCurve, tweaks.enemySpawnRateMult);

      // スポーン
      spawnAccumRef.current -= dt;
      if (spawnAccumRef.current <= 0 && enemiesRef.current.length < diff.maxOnScreen) {
        const hornetCount = enemiesRef.current.filter(x => x.type === 'hornet' && !x.dead).length;
        enemiesRef.current.push(window.GAME.spawnEnemy(field, scoreRef.current, diff, { hornetCount }));
        spawnAccumRef.current = diff.baseInterval * (0.7 + Math.random() * 0.6);
      }
      // ボス
      const bossTier = Math.floor(scoreRef.current / 2500);
      if (bossTier > lastBossScoreRef.current && !enemiesRef.current.some(x => x.type === 'dragonfly' && !x.dead)) {
        lastBossScoreRef.current = bossTier;
        enemiesRef.current.push(window.GAME.makeEnemy('dragonfly', field, diff));
      }

      // 舌の更新
      const holdTime = (valuesRef.current.tongueHold || 50) / 1000;
      const outTime = 0.12, inTime = 0.15;
      for (const t of tonguesRef.current) {
        t.t += dt;
        if (t.phase === 'out') {
          t.len = Math.min(t.maxLen, (t.t / outTime) * t.maxLen);
          if (t.t >= outTime) { t.phase = 'hold'; t.t = 0; }
        } else if (t.phase === 'hold') {
          t.len = t.maxLen;
          if (t.t >= holdTime) { t.phase = 'in'; t.t = 0; }
        } else {
          t.len = Math.max(0, t.maxLen * (1 - t.t / inTime));
          if (t.t >= inTime) t.phase = 'done';
        }
      }
      tonguesRef.current = tonguesRef.current.filter(t => t.phase !== 'done');
      const anyActive = tonguesRef.current.length > 0;

      // 敵の更新 & 衝突判定
      const survived = [];
      for (const e of enemiesRef.current) {
        if (!e.dead && anyActive && !e.hitThisTongue) {
          for (const t of tonguesRef.current) {
            if (window.GAME.tongueHitsEnemy(t, e, field)) {
              const def = window.GAME.ENEMY_TYPES[e.type];
              e.hitThisTongue = true;
              if (def.isBoss) {
                e.hp -= 1; e.hitFlash = 0.25;
                if (e.hp <= 0) {
                  e.dead = true; e.deathT = 0;
                  scoreRef.current += def.score;
                  floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y, pts: def.score, t: 0 });
                  awardProgress();
                } else {
                  floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y - 20, pts: 'HIT ' + (def.hp - e.hp) + '/' + def.hp, t: 0, color: '#ffd84d' });
                }
              } else {
                e.dead = true; e.deathT = 0;
                scoreRef.current += def.score;
                floatsRef.current.push({ id: Math.random(), x: e.x, y: e.y, pts: def.score, t: 0 });
                awardProgress();
              }
              break;
            }
          }
        }
        if (!anyActive) e.hitThisTongue = false;
        const remove = window.GAME.updateEnemy(e, dt, field, () => {
          livesRef.current -= 1; setLives(livesRef.current);
          hurtFlashRef.current = 0.5; frogShakeRef.current = 0.4;
          if (livesRef.current <= 0) {
            const hi = Math.max(hiScore, scoreRef.current);
            if (hi !== hiScore) { setHiScore(hi); localStorage.setItem('frog_hi', String(hi)); }
            setMode('over');
          }
        });
        if (!remove) survived.push(e);
      }
      enemiesRef.current = survived;

      floatsRef.current = floatsRef.current.filter(f => { f.t += dt; f.y -= 36 * dt; return f.t < 0.9; });
      if (hurtFlashRef.current > 0) hurtFlashRef.current -= dt;
      if (frogShakeRef.current > 0) frogShakeRef.current -= dt;
      forceRender();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, field, tweaks.difficultyCurve, tweaks.enemySpawnRateMult, forceRender, hiScore]);

  // レンダー
  const tongues = tonguesRef.current;
  const anyTongueActive = tongues.length > 0;
  const activeDirs = tongues.map(t => t.dirIdx);
  const shake = frogShakeRef.current;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * 10 : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * 10 : 0;

  const gd = window.GACHA_DATA || {};
  const BS = gd.BODY_SKINS || [], TS = gd.TONGUE_SKINS || [];
  const activeSkin       = BS.find(s => s.id === (selected.body   || 'default')) || BS[0] || null;
  const activeTongueSkin = TS.find(s => s.id === (selected.tongue || 'default')) || TS[0] || { fill:'#ff4d7a', stroke:'#c42e5a', tip:'#ffb0c8' };
  const FrogComp = selected.special === 'cerberus' ? CerberusFrog
                 : selected.special === 'yamata'   ? YamataFrog : Frog;

  return (
    <div ref={containerRef} style={{
      position:'absolute', inset:0,
      background:`radial-gradient(ellipse at 50% 40%, ${theme.bgA} 0%, ${theme.bgB} 75%, #050d08 100%)`,
      overflow:'hidden', cursor: mode === 'play' ? 'crosshair' : 'default',
    }}>
      <Grid kind={tweaks.grid} />

      {hurtFlashRef.current > 0 && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`rgba(255,77,109,${hurtFlashRef.current * 0.5})`, mixBlendMode:'screen' }} />
      )}

      <svg width={size.w} height={size.h} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <g transform={`translate(${field.cx} ${field.cy})`}>
          <Pond radius={field.radius} />
          <TapZones show={tweaks.showTapZones && mode === 'play'} activeDirs={activeDirs} radius={field.radius} />
          <circle r={field.radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle r={field.radius * window.GAME.ATTACK_RADIUS_RATIO} fill="none" stroke="rgba(255,77,109,0.12)" strokeWidth="1" strokeDasharray="2 8" />
        </g>
        {/* 舌（複数対応・スキン色） */}
        {tongues.map((t, i) => (
          <g key={i} transform={`translate(${field.cx} ${field.cy}) rotate(${t.angle * 180 / Math.PI})`}>
            <rect x="0" y="-7" width={t.len} height="14" rx="7" fill={activeTongueSkin.fill} stroke={activeTongueSkin.stroke} strokeWidth="2" />
            <circle cx={t.len} cy="0" r="11" fill={activeTongueSkin.fill} stroke={activeTongueSkin.stroke} strokeWidth="2" />
            <circle cx={t.len - 3} cy="-3" r="3" fill={activeTongueSkin.tip} opacity="0.8" />
          </g>
        ))}
      </svg>

      {/* 敵 */}
      {enemiesRef.current.map(e => {
        const def = window.GAME.ENEMY_TYPES[e.type];
        const Comp = window[def.Comp];
        const angle = Math.atan2(field.cy - e.y, field.cx - e.x);
        const rotDeg = angle * 180 / Math.PI + 90;
        const dying = e.dead, dyingDur = def.isBoss ? 0.5 : 0.35;
        const scale   = dying ? (1 - e.deathT / dyingDur) * 1.6 : 1;
        const opacity = dying ? (1 - e.deathT / dyingDur) : 1;
        return (
          <div key={e.id} style={{
            position:'absolute', left:e.x, top:e.y,
            transform:`translate(-50%,-50%) rotate(${rotDeg}deg) scale(${scale})`,
            opacity, pointerEvents:'none', transition:'none',
          }}>
            <Comp size={def.size} flap={e.flap} {...(def.isBoss ? { hitFlash: e.hitFlash || 0 } : {})} />
            {def.isBoss && !dying && (
              <div style={{ position:'absolute', left:'50%', top:-28, transform:`translate(-50%,0) rotate(${-rotDeg}deg)`, display:'flex', gap:4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:16, height:6, borderRadius:3,
                    background: e.hp > i ? '#ff4d6d' : 'rgba(255,255,255,0.18)',
                    border:'1px solid rgba(0,0,0,0.4)' }} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 蛙（スキン対応） */}
      {(mode === 'play' || mode === 'over') && (
        <div style={{ position:'absolute', left: field.cx + shakeX, top: field.cy + shakeY, transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
          <FrogComp size={130} mouthOpen={anyTongueActive} eyeLook={eyeLookRef.current} hurt={hurtFlashRef.current > 0} skin={activeSkin} />
        </div>
      )}

      {/* スコアポップ */}
      {floatsRef.current.map(f => (
        <div key={f.id} style={{
          position:'absolute', left:f.x, top:f.y, transform:'translate(-50%,-50%)',
          color: f.color || '#ffd84d', fontWeight:900, fontSize:22,
          textShadow:'0 2px 0 rgba(0,0,0,0.4)', opacity: 1 - f.t/0.9, pointerEvents:'none',
        }}>
          {typeof f.pts === 'number' ? `+${f.pts}` : f.pts}
        </div>
      ))}

      {(mode === 'play' || mode === 'paused') && (
        <HUD score={score} hi={hiScore} lives={lives} maxLives={values.maxLives} coins={coins}
          layout={tweaks.layout} onPause={togglePause} paused={mode === 'paused'}
          onToggleDebug={() => setShowDebug(v => !v)} debugOpen={showDebug} />
      )}

      {showDebug && (mode === 'play' || mode === 'paused') && (
        <DebugPanel score={score} lives={lives}
          onAddScore={() => debugAddScore(500)} onAddScore1k={() => debugAddScore(1000)}
          onAddScore2500={() => debugAddScore(2500)} onSpawnBoss={debugSpawnBoss}
          onHeal={debugHeal} onClose={() => setShowDebug(false)} />
      )}

      {mode === 'paused' && <PauseScreen onResume={togglePause} onHome={() => setMode('title')} />}

      {mode === 'title' && (
        <TitleScreen onStart={startGame} hi={hiScore} theme={theme} coins={coins}
          onOpenShop={() => setShopOpen(true)} />
      )}

      {mode === 'title' && shopOpen && (
        <ShopDialog
          coins={coins} levels={levels} onBuy={buyUpgrade} onReset={resetUpgrades}
          onClose={() => setShopOpen(false)}
          ownedIds={ownedIds} selected={selected}
          onPull={doPullGacha} gachaResult={gachaResult}
          onSelectSkin={selectSkin}
          shopTab={shopTab} onTabChange={setShopTab}
        />
      )}

      {mode === 'over' && <GameOverScreen score={scoreRef.current} hi={hiScore} onRetry={startGame} onHome={() => setMode('title')} />}

      {tweaksOpen && <TweaksPanel tweaks={tweaks} update={updateTweak} />}
    </div>
  );
}

// ── HUD ─────────────────────────────────────────────────────────────
function HUD({ score, hi, lives, maxLives, coins, layout, onPause, paused, onToggleDebug, debugOpen }) {
  const top = layout === 'top';
  return (
    <div style={{
      position:'absolute', left:0, right:0,
      top: top ? 0 : 'auto', bottom: top ? 'auto' : 0,
      padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center',
      pointerEvents:'none',
      background: top ? 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))'
                      : 'linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0))',
    }}>
      <div>
        <div style={{ fontSize:11, letterSpacing:2, opacity:0.7, fontFamily:'JetBrains Mono, monospace' }}>SCORE</div>
        <div style={{ fontSize:38, fontWeight:900, lineHeight:1, textShadow:'0 3px 0 rgba(0,0,0,0.35)' }}>{score.toLocaleString()}</div>
        <div style={{ fontSize:11, letterSpacing:2, opacity:0.55, fontFamily:'JetBrains Mono, monospace', marginTop:2 }}>BEST {hi.toLocaleString()}</div>
      </div>
      <div style={{ display:'flex', gap:14, alignItems:'center', pointerEvents:'auto' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:180 }}>
            {Array.from({ length: maxLives }).map((_, i) => <Heart key={i} size={28} filled={lives > i} />)}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'#ffd84d', letterSpacing:1, fontFamily:'JetBrains Mono, monospace' }}>🪙 {coins}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); onPause && onPause(); }} onPointerDown={e => e.stopPropagation()}
          style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.18)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontFamily:'inherit' }}>
          {paused ? <svg width="18" height="20" viewBox="0 0 18 20"><path d="M2 1 L17 10 L2 19 Z" fill="#fff"/></svg>
                  : <svg width="18" height="20" viewBox="0 0 18 20"><rect x="2" y="1" width="5" height="18" rx="1.5" fill="#fff"/><rect x="11" y="1" width="5" height="18" rx="1.5" fill="#fff"/></svg>}
        </button>
        <button onClick={e => { e.stopPropagation(); onToggleDebug && onToggleDebug(); }} onPointerDown={e => e.stopPropagation()}
          style={{ width:44, height:44, borderRadius:12, background: debugOpen ? 'rgba(255,216,77,0.25)' : 'rgba(255,255,255,0.12)', border:'1px solid ' + (debugOpen ? 'rgba(255,216,77,0.5)' : 'rgba(255,255,255,0.18)'), color: debugOpen ? '#ffd84d' : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontFamily:'JetBrains Mono, monospace', fontSize:14 }}>
          🐛
        </button>
      </div>
    </div>
  );
}

function PauseScreen({ onResume, onHome }) {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', zIndex:50 }}
      onPointerDown={e => e.stopPropagation()}>
      <div style={{ fontSize:16, letterSpacing:6, opacity:0.75, fontFamily:'JetBrains Mono, monospace' }}>PAUSED</div>
      <div style={{ marginTop:18, fontSize:56, fontWeight:900, lineHeight:1, textShadow:'0 6px 0 rgba(0,0,0,0.4)' }}>一時停止</div>
      <div style={{ marginTop:12, fontSize:13, opacity:0.55, fontFamily:'JetBrains Mono, monospace' }}>P · ESC · SPACE で再開</div>
      <div style={{ display:'flex', gap:14, marginTop:32 }}>
        <button onClick={onHome}   style={btnStyle(false)}>タイトル</button>
        <button onClick={onResume} style={btnStyle(true)}>再開</button>
      </div>
    </div>
  );
}

function TitleScreen({ onStart, hi, theme, coins, onOpenShop }) {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none', background:'radial-gradient(ellipse at center, rgba(0,0,0,0.1), rgba(0,0,0,0.55))' }}>
      <h1 style={{ margin:0, fontSize:64, fontWeight:900, letterSpacing:-2, textShadow:'0 6px 0 rgba(0,0,0,0.4)', color:'#fff', textAlign:'center', lineHeight:1.05 }}>
        カエル<span style={{ color: theme.accent }}>ファイト</span>
      </h1>
      <div style={{ fontSize:13, letterSpacing:4, opacity:0.7, marginTop:6, marginBottom:18, fontFamily:'JetBrains Mono, monospace' }}>FROG · FIGHT · ENDLESS</div>
      <div style={{ margin:'4px 0' }}><Frog size={180} mouthOpen={false} eyeLook={{x:0, y:0.1}} /></div>
      <button onClick={onStart} style={{ pointerEvents:'auto', marginTop:22, padding:'16px 48px', borderRadius:999, border:'none', fontSize:22, fontWeight:900, letterSpacing:2, background: theme.accent, color:'#1a1a1a', cursor:'pointer', boxShadow:'0 6px 0 rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.3)', fontFamily:'inherit' }}>スタート</button>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:16, pointerEvents:'auto' }}>
        <button onClick={onOpenShop} style={{ padding:'10px 20px', borderRadius:999, background:'rgba(255,255,255,0.1)', border:'1.5px solid rgba(255,216,77,0.6)', color:'#ffd84d', cursor:'pointer', fontSize:14, fontWeight:800, letterSpacing:1.5, fontFamily:'inherit' }}>🛒 SHOP</button>
        <div style={{ padding:'10px 18px', borderRadius:999, background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.1)', fontSize:14, fontWeight:800, color:'#ffd84d', fontFamily:'JetBrains Mono, monospace' }}>🪙 {coins}</div>
      </div>
      <div style={{ marginTop:22, fontSize:13, opacity:0.6, fontFamily:'JetBrains Mono, monospace' }}>BEST SCORE · {hi.toLocaleString()}</div>
      <div style={{ position:'absolute', bottom:24, left:0, right:0, display:'flex', justifyContent:'center', gap:22, opacity:0.85 }}>
        <LegendItem label="コバエ" pts="5"   Comp={Gnat}   size={26} />
        <LegendItem label="ハエ"   pts="10"  Comp={Fly}    size={32} />
        <LegendItem label="ハチ"   pts="50"  Comp={Bee}    size={40} />
        <LegendItem label="スズメバチ" pts="150" Comp={Hornet} size={46} />
      </div>
    </div>
  );
}

function LegendItem({ label, pts, Comp, size }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <Comp size={size} flap={0} />
      <div style={{ fontSize:11, letterSpacing:1, opacity:0.7 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'#ffd84d' }}>{pts}</div>
    </div>
  );
}

function GameOverScreen({ score, hi, onRetry, onHome }) {
  const isNew = score >= hi && score > 0;
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)' }}>
      <div style={{ fontSize:16, letterSpacing:6, opacity:0.75, fontFamily:'JetBrains Mono, monospace' }}>GAME OVER</div>
      {isNew && <div style={{ marginTop:10, fontSize:16, color:'#ffd84d', letterSpacing:3, fontWeight:700 }}>NEW BEST!</div>}
      <div style={{ marginTop:20, fontSize:84, fontWeight:900, lineHeight:1, textShadow:'0 6px 0 rgba(0,0,0,0.4)' }}>{score.toLocaleString()}</div>
      <div style={{ marginTop:8, fontSize:14, opacity:0.6, fontFamily:'JetBrains Mono, monospace' }}>BEST · {hi.toLocaleString()}</div>
      <div style={{ display:'flex', gap:14, marginTop:36 }}>
        <button onClick={onHome}  style={btnStyle(false)}>タイトル</button>
        <button onClick={onRetry} style={btnStyle(true)}>もう一度</button>
      </div>
    </div>
  );
}

function btnStyle(primary) {
  return {
    padding:'14px 34px', borderRadius:999, border:'none',
    fontSize:17, fontWeight:800, letterSpacing:1, cursor:'pointer',
    background: primary ? '#ffd84d' : 'rgba(255,255,255,0.12)',
    color: primary ? '#1a1a1a' : '#fff',
    boxShadow: primary ? '0 5px 0 rgba(0,0,0,0.35)' : '0 3px 0 rgba(0,0,0,0.3)',
    fontFamily:'inherit',
  };
}

// ── ShopDialog（タブ付き） ─────────────────────────────────────────
function ShopDialog({ coins, levels, onBuy, onReset, onClose, ownedIds, selected, onPull, gachaResult, onSelectSkin, shopTab, onTabChange }) {
  const tabBtn = (t, label) => ({
    flex:1, padding:'9px 4px', border:'none',
    background: shopTab === t ? 'rgba(255,216,77,0.15)' : 'transparent',
    color: shopTab === t ? '#ffd84d' : 'rgba(255,255,255,0.55)',
    fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'inherit', letterSpacing:0.8,
    borderBottom: `2px solid ${shopTab === t ? '#ffd84d' : 'transparent'}`,
  });
  return (
    <div onPointerDown={e => e.stopPropagation()}
      style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:80 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width:340, maxHeight:'88vh', display:'flex', flexDirection:'column', background:'rgba(12,22,15,0.97)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:18, overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,0.55)', color:'#fff' }}>
        {/* ヘッダー */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 18px 0' }}>
          <div style={{ fontWeight:900, fontSize:17, letterSpacing:2 }}>🛒 SHOP</div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, color:'#ffd84d', fontSize:14 }}>🪙 {coins}</div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:22, opacity:0.6, lineHeight:1 }}>×</button>
          </div>
        </div>
        {/* タブ */}
        <div style={{ display:'flex', padding:'8px 10px 0', gap:1 }}>
          <button style={tabBtn('upgrade', 'アップグレード')} onClick={() => onTabChange('upgrade')}>アップグレード</button>
          <button style={tabBtn('gacha',   'ガチャ')}         onClick={() => onTabChange('gacha')}>ガチャ</button>
          <button style={tabBtn('skin',    'スキン')}          onClick={() => onTabChange('skin')}>スキン</button>
        </div>
        {/* コンテンツ */}
        <div style={{ overflowY:'auto', padding:'12px 14px 16px', flex:1 }}>
          {shopTab === 'upgrade' && <UpgradeTab coins={coins} levels={levels} onBuy={onBuy} onReset={onReset} />}
          {shopTab === 'gacha'   && <GachaTab   coins={coins} ownedIds={ownedIds} onPull={onPull} gachaResult={gachaResult} />}
          {shopTab === 'skin'    && <SkinTab    ownedIds={ownedIds} selected={selected} onSelectSkin={onSelectSkin} />}
        </div>
      </div>
    </div>
  );
}

function UpgradeTab({ coins, levels, onBuy, onReset }) {
  const defs = window.UPGRADES_DEF;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {Object.entries(defs).map(([key, def]) => {
        const lvl = levels[key] || 0, maxed = lvl >= def.maxLevel;
        const canBuy = !maxed && coins >= def.cost;
        const cur = def.base + def.step * lvl, nxt = def.base + def.step * (lvl + 1);
        return (
          <div key={key} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'10px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{def.icon} {def.label}</div>
                <div style={{ fontSize:11, opacity:0.55, marginTop:2 }}>{def.description}</div>
              </div>
              <div style={{ display:'flex', gap:3, marginTop:2 }}>
                {Array.from({ length: def.maxLevel }).map((_, i) => (
                  <div key={i} style={{ width:10, height:10, borderRadius:3, background: i < lvl ? '#ffd84d' : 'rgba(255,255,255,0.15)', border:'1px solid rgba(0,0,0,0.3)' }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize:11, fontFamily:'JetBrains Mono, monospace', opacity:0.7, marginBottom:6 }}>
              {maxed ? <span style={{ color:'#ffd84d' }}>MAX: {def.format(cur)}</span>
                     : <span>現在: {def.format(cur)} → <span style={{ color:'#7dd3fc' }}>{def.format(nxt)}</span></span>}
            </div>
            {!maxed && <button onClick={() => onBuy(key)} disabled={!canBuy} style={{ width:'100%', padding:'7px 0', borderRadius:7, border:'none', background: canBuy ? '#ffd84d' : 'rgba(255,255,255,0.08)', color: canBuy ? '#1a1a1a' : 'rgba(255,255,255,0.3)', fontWeight:800, fontSize:12, cursor: canBuy ? 'pointer' : 'default', fontFamily:'inherit' }}>🪙 {def.cost} で強化</button>}
            {maxed && <div style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#ffd84d', letterSpacing:2 }}>MAX LEVEL</div>}
          </div>
        );
      })}
      <button onClick={onReset} style={{ width:'100%', marginTop:4, padding:'8px 0', borderRadius:8, background:'transparent', border:'1px solid rgba(255,100,100,0.4)', color:'rgba(255,150,150,0.8)', cursor:'pointer', fontWeight:700, fontSize:11, fontFamily:'inherit' }}>リセット（コイン全額返金）</button>
    </div>
  );
}

function GachaTab({ coins, ownedIds, onPull, gachaResult }) {
  const { GACHA_POOL, GACHA_COST } = window.GACHA_DATA;
  const total     = GACHA_POOL.length;
  const collected = ownedIds.filter(id => GACHA_POOL.some(p => p.id === id)).length;
  const allOwned  = collected >= total;
  const canPull   = coins >= GACHA_COST && !allOwned;
  const typeLabel = { body:'蛙スキン', tongue:'舌スキン', special:'特殊蛙' };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 14px' }}>
        <div style={{ fontSize:11, opacity:0.6, letterSpacing:1, marginBottom:6 }}>コレクション</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.12)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${(collected/total)*100}%`, height:'100%', background:'#ffd84d', borderRadius:3 }} />
          </div>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:700, color:'#ffd84d' }}>{collected}/{total}</div>
        </div>
      </div>
      <button onClick={onPull} disabled={!canPull} style={{
        width:'100%', padding:'14px 0', borderRadius:12, border:'none',
        background: canPull ? 'linear-gradient(135deg, #ffd84d, #ff9a3c)' : 'rgba(255,255,255,0.08)',
        color: canPull ? '#1a1a1a' : 'rgba(255,255,255,0.3)',
        fontWeight:900, fontSize:16, cursor: canPull ? 'pointer' : 'default',
        fontFamily:'inherit', letterSpacing:1,
        boxShadow: canPull ? '0 4px 16px rgba(255,216,77,0.3)' : 'none',
      }}>
        {allOwned ? '🎉 全部ゲット済み！' : `🎰 ガチャを引く（🪙 ${GACHA_COST}）`}
      </button>
      {gachaResult && (
        <div style={{ background: gachaResult.allOwned ? 'rgba(255,255,255,0.06)' : 'rgba(255,216,77,0.1)', border:`1px solid ${gachaResult.allOwned ? 'rgba(255,255,255,0.1)' : 'rgba(255,216,77,0.4)'}`, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
          {gachaResult.allOwned ? (
            <div style={{ fontSize:13, opacity:0.7 }}>全アイテム取得済み！</div>
          ) : (
            <>
              <div style={{ fontSize:10, letterSpacing:2, opacity:0.6, marginBottom:4 }}>{typeLabel[gachaResult.item.type]} GET!</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#ffd84d' }}>{gachaResult.item.icon || '✨'} {gachaResult.item.name}</div>
              {gachaResult.item.desc && <div style={{ fontSize:11, opacity:0.6, marginTop:4 }}>{gachaResult.item.desc}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SkinTab({ ownedIds, selected, onSelectSkin }) {
  const { BODY_SKINS, TONGUE_SKINS, SPECIAL_FROGS } = window.GACHA_DATA;
  const isOwned = (id) => id === 'default' || ownedIds.includes(id);

  const SkinGrid = ({ items, type, colorKey }) => (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
      {items.map(item => {
        const owned  = isOwned(item.id);
        const active = selected[type] === item.id || (!selected[type] && item.id === 'default');
        return (
          <button key={item.id} onClick={() => owned && onSelectSkin(type, item.id)} title={item.name}
            style={{ padding:'6px 4px', borderRadius:8, border:`2px solid ${active ? '#ffd84d' : owned ? 'rgba(255,255,255,0.15)' : 'transparent'}`, background: active ? 'rgba(255,216,77,0.15)' : 'rgba(255,255,255,0.04)', cursor: owned ? 'pointer' : 'default', display:'flex', flexDirection:'column', alignItems:'center', gap:3, opacity: owned ? 1 : 0.35 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background: item[colorKey] || item.fill, border:'2px solid rgba(255,255,255,0.25)' }} />
            <div style={{ fontSize:9, opacity:0.75, textAlign:'center', lineHeight:1.2 }}>{item.name}</div>
            {!owned && <div style={{ fontSize:9, opacity:0.6 }}>🔒</div>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:11, letterSpacing:1, opacity:0.65, marginBottom:8 }}>🐸 蛙カラー</div>
        <SkinGrid items={BODY_SKINS} type="body" colorKey="body2" />
      </div>
      <div>
        <div style={{ fontSize:11, letterSpacing:1, opacity:0.65, marginBottom:8 }}>👅 舌カラー</div>
        <SkinGrid items={TONGUE_SKINS} type="tongue" colorKey="fill" />
      </div>
      <div>
        <div style={{ fontSize:11, letterSpacing:1, opacity:0.65, marginBottom:8 }}>⭐ 特殊蛙</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => onSelectSkin('special', null)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1.5px solid ${!selected.special ? '#ffd84d' : 'rgba(255,255,255,0.15)'}`, background: !selected.special ? 'rgba(255,216,77,0.12)' : 'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:13, fontWeight:700 }}>
            🐸 通常蛙 <span style={{ fontSize:11, opacity:0.55, fontWeight:400 }}>（デフォルト）</span>
          </button>
          {SPECIAL_FROGS.map(sf => {
            const owned = ownedIds.includes(sf.id), active = selected.special === sf.id;
            return (
              <button key={sf.id} onClick={() => owned && onSelectSkin('special', sf.id)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1.5px solid ${active ? '#ffd84d' : owned ? 'rgba(255,255,255,0.15)' : 'transparent'}`, background: active ? 'rgba(255,216,77,0.12)' : 'rgba(255,255,255,0.04)', color: owned ? '#fff' : 'rgba(255,255,255,0.35)', cursor: owned ? 'pointer' : 'default', fontFamily:'inherit', textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{sf.icon} {sf.name} {!owned && '🔒'}</div>
                <div style={{ fontSize:10, opacity:0.6, marginTop:2 }}>{sf.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TweaksPanel ──────────────────────────────────────────────────────
function TweaksPanel({ tweaks, update }) {
  return (
    <div style={{ position:'absolute', right:18, bottom:18, width:260, background:'rgba(12,18,14,0.92)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', borderRadius:14, padding:16, boxShadow:'0 10px 30px rgba(0,0,0,0.4)', fontSize:13, zIndex:100 }}>
      <div style={{ fontWeight:900, letterSpacing:3, fontSize:12, opacity:0.7, marginBottom:14, fontFamily:'JetBrains Mono, monospace' }}>TWEAKS</div>
      <Row label="テーマ"><Seg opts={[['pond','沼'],['blueprint','青写真'],['sunset','夕焼け']]} v={tweaks.theme} on={v => update('theme', v)} /></Row>
      <Row label="背景"><Seg opts={[['dots','dots'],['lines','lines'],['none','none']]} v={tweaks.grid} on={v => update('grid', v)} /></Row>
      <Row label="HUD位置"><Seg opts={[['top','上'],['bottom','下']]} v={tweaks.layout} on={v => update('layout', v)} /></Row>
      <Row label="難度"><Seg opts={[['chill','易'],['normal','普'],['spicy','辛']]} v={tweaks.difficultyCurve} on={v => update('difficultyCurve', v)} /></Row>
      <Row label="出現倍率">
        <input type="range" min="0.5" max="2" step="0.1" value={tweaks.enemySpawnRateMult} onChange={e => update('enemySpawnRateMult', +e.target.value)} style={{ width:'100%' }} />
        <div style={{ textAlign:'right', fontFamily:'JetBrains Mono, monospace', fontSize:11, opacity:0.7 }}>×{tweaks.enemySpawnRateMult.toFixed(1)}</div>
      </Row>
      <Row label="タップ領域"><Seg opts={[[true,'show'],[false,'hide']]} v={tweaks.showTapZones} on={v => update('showTapZones', v)} /></Row>
    </div>
  );
}
function Row({ label, children }) {
  return <div style={{ marginBottom:12 }}><div style={{ fontSize:11, letterSpacing:1, opacity:0.65, marginBottom:6 }}>{label}</div>{children}</div>;
}
function Seg({ opts, v, on }) {
  return (
    <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)' }}>
      {opts.map(([val, lbl]) => (
        <button key={String(val)} onClick={() => on(val)} style={{ flex:1, padding:'7px 8px', border:'none', background: v === val ? 'rgba(255,216,77,0.22)' : 'transparent', color: v === val ? '#ffd84d' : '#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{lbl}</button>
      ))}
    </div>
  );
}

function DebugPanel({ score, lives, onAddScore, onAddScore1k, onAddScore2500, onSpawnBoss, onHeal, onClose }) {
  const btn = { padding:'9px 12px', borderRadius:8, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, letterSpacing:0.5, fontFamily:'JetBrains Mono, monospace', textAlign:'left' };
  return (
    <div onPointerDown={e => e.stopPropagation()}
      style={{ position:'absolute', left:18, bottom:18, width:220, background:'rgba(12,18,14,0.92)', border:'1px solid rgba(255,216,77,0.35)', borderRadius:14, padding:14, zIndex:60, boxShadow:'0 10px 30px rgba(0,0,0,0.4)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:3, opacity:0.8 }}>🐛 DEBUG</div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', opacity:0.6, fontSize:18, lineHeight:1 }}>×</button>
      </div>
      <div style={{ display:'grid', gap:6 }}>
        <button style={btn} onClick={onAddScore}>+500 スコア</button>
        <button style={btn} onClick={onAddScore1k}>+1000 スコア</button>
        <button style={btn} onClick={onAddScore2500}>+2500 スコア</button>
        <button style={btn} onClick={onSpawnBoss}>ボス召喚</button>
        <button style={btn} onClick={onHeal}>ライフ全快</button>
      </div>
      <div style={{ marginTop:10, fontSize:10, opacity:0.55, fontFamily:'JetBrains Mono, monospace', lineHeight:1.5 }}>score {score} · lives {lives}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
