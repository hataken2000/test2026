// Persistent upgrade system
// Stored keys:
//   frog_coins       -> number (coin wallet balance)
//   frog_upgrades    -> JSON: { maxLives: level, tongueHold: level, ... }
// Level 0 is default (free). Each additional level costs UPGRADES[key].cost.

const UPGRADES = {
  maxLives: {
    label: 'ライフ上限',
    description: 'ハートの最大数を増やす',
    icon: '♥',
    base: 3,
    step: 1,
    maxLevel: 3,       // 3..6
    cost: 3,
    format: (v) => `${v} ハート`,
  },
  tongueHold: {
    label: '舌の停滞時間',
    description: '舌が伸びきった状態を長くキープ',
    icon: '👅',
    base: 0,           // ms (Lv0 = ゲームコードの50msフォールバック)
    step: 100,         // 0.1秒 / level
    maxLevel: 5,       // 最大0.5秒追加
    cost: 1,
    format: (v) => v === 0 ? 'デフォルト' : `+${(v / 1000).toFixed(1)}秒`,
  },
  // Future upgrades plug in here
};

function loadWallet() {
  const raw = +(localStorage.getItem('frog_coins') || 0);
  return isFinite(raw) ? raw : 0;
}
function saveWallet(n) { localStorage.setItem('frog_coins', String(Math.max(0, Math.floor(n)))); }

function loadLevels() {
  try {
    const raw = JSON.parse(localStorage.getItem('frog_upgrades') || '{}');
    const out = {};
    for (const k of Object.keys(UPGRADES)) out[k] = Math.max(0, Math.min(UPGRADES[k].maxLevel, +raw[k] || 0));
    return out;
  } catch { return Object.fromEntries(Object.keys(UPGRADES).map(k => [k, 0])); }
}
function saveLevels(levels) { localStorage.setItem('frog_upgrades', JSON.stringify(levels)); }

// Given levels, compute the live value for each upgrade key.
function resolve(levels) {
  const out = {};
  for (const k of Object.keys(UPGRADES)) {
    const u = UPGRADES[k];
    out[k] = u.base + u.step * (levels[k] || 0);
  }
  return out;
}

// Total coins ever spent given current levels (used for reset refund).
function totalSpent(levels) {
  let sum = 0;
  for (const k of Object.keys(UPGRADES)) {
    const u = UPGRADES[k];
    sum += u.cost * (levels[k] || 0);
  }
  return sum;
}

window.UPGRADES_DEF = UPGRADES;
window.upgradesApi = { loadWallet, saveWallet, loadLevels, saveLevels, resolve, totalSpent };
