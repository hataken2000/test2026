// Persistent upgrade & gacha system

// ── アップグレード ────────────────────────────────────────────────
const UPGRADES = {
  maxLives: {
    label: 'ライフ上限', description: 'ハートの最大数を増やす', icon: '♥',
    base: 3, step: 1, maxLevel: 3, cost: 3,
    format: (v) => `${v} ハート`,
  },
  tongueHold: {
    label: '舌の停滞時間', description: '舌が伸びきった状態を長くキープ', icon: '👅',
    base: 0, step: 100, maxLevel: 5, cost: 1,
    format: (v) => v === 0 ? 'デフォルト' : `+${(v / 1000).toFixed(1)}秒`,
  },
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
function saveLevels(ls) { localStorage.setItem('frog_upgrades', JSON.stringify(ls)); }

function resolve(levels) {
  const out = {};
  for (const k of Object.keys(UPGRADES)) out[k] = UPGRADES[k].base + UPGRADES[k].step * (levels[k] || 0);
  return out;
}
function totalSpent(levels) {
  let s = 0;
  for (const k of Object.keys(UPGRADES)) s += UPGRADES[k].cost * (levels[k] || 0);
  return s;
}

// ── ガチャ：ボディスキン 10種 ──────────────────────────────────────
const BODY_SKINS = [
  { id: 'default',  name: 'ノーマル',   body1:'#9fd66a', body2:'#5fa83e', body3:'#2d6b21', belly1:'#fff5d9', belly2:'#e8c676', eye1:'#c1ed7c', eye2:'#4e8a2a', accent:'#3a8228' },
  { id: 'ocean',    name: 'オーシャン', body1:'#6ab4d6', body2:'#3a84a6', body3:'#1a5478', belly1:'#d9f5ff', belly2:'#76c6e8', eye1:'#7cedc1', eye2:'#2a7a6e', accent:'#2a7090' },
  { id: 'grape',    name: 'グレープ',   body1:'#b484e8', body2:'#8044b8', body3:'#4a1878', belly1:'#f0d9ff', belly2:'#c876e8', eye1:'#e0b0ff', eye2:'#7a3aaa', accent:'#6a2a9a' },
  { id: 'crimson',  name: 'クリムゾン', body1:'#e87a6a', body2:'#b84040', body3:'#781820', belly1:'#ffe0d9', belly2:'#e89080', eye1:'#ffb0a0', eye2:'#882828', accent:'#902028' },
  { id: 'sakura',   name: 'サクラ',     body1:'#f0a4c8', body2:'#c8609a', body3:'#882060', belly1:'#fff0f5', belly2:'#f0b0d0', eye1:'#ffd0e8', eye2:'#a04080', accent:'#b84080' },
  { id: 'sunny',    name: 'サニー',     body1:'#f0d84a', body2:'#c0a020', body3:'#806010', belly1:'#fffcd9', belly2:'#f0e076', eye1:'#fff0a0', eye2:'#a08010', accent:'#b09010' },
  { id: 'shadow',   name: 'シャドウ',   body1:'#505060', body2:'#28283a', body3:'#101018', belly1:'#c0c0d0', belly2:'#808098', eye1:'#9090b0', eye2:'#404060', accent:'#202030' },
  { id: 'silver',   name: 'シルバー',   body1:'#d8e0f0', body2:'#a0b0c8', body3:'#6070a0', belly1:'#f8f8ff', belly2:'#c8d8e8', eye1:'#e0eeff', eye2:'#6080a0', accent:'#8090b8' },
  { id: 'golden',   name: 'ゴールド',   body1:'#f0c840', body2:'#c09010', body3:'#806000', belly1:'#fffae0', belly2:'#f0d870', eye1:'#ffe080', eye2:'#a07000', accent:'#c0a000' },
  { id: 'coral',    name: 'コーラル',   body1:'#f0906a', body2:'#c05030', body3:'#801810', belly1:'#ffe8d9', belly2:'#f0b090', eye1:'#ffc0a0', eye2:'#a03820', accent:'#d06040' },
];

// ── ガチャ：舌スキン 10種 ────────────────────────────────────────
const TONGUE_SKINS = [
  { id: 'default', name: 'ノーマル',   fill:'#ff4d7a', stroke:'#c42e5a', tip:'#ffb0c8' },
  { id: 'blood',   name: 'ブラッド',   fill:'#cc1010', stroke:'#880000', tip:'#ff6060' },
  { id: 'aqua',    name: 'アクア',     fill:'#40aaee', stroke:'#1066bb', tip:'#a0d8ff' },
  { id: 'forest',  name: 'フォレスト', fill:'#40cc70', stroke:'#108840', tip:'#a0ffc0' },
  { id: 'magic',   name: 'マジック',   fill:'#9944ee', stroke:'#5510aa', tip:'#cc88ff' },
  { id: 'flame',   name: 'フレイム',   fill:'#ff7020', stroke:'#cc3c00', tip:'#ffc080' },
  { id: 'gold',    name: 'ゴールド',   fill:'#ffd700', stroke:'#c0900a', tip:'#fff0a0' },
  { id: 'white',   name: 'ホワイト',   fill:'#f0f0ff', stroke:'#8888c0', tip:'#ffffff' },
  { id: 'dark',    name: 'ダーク',     fill:'#303040', stroke:'#080810', tip:'#707088' },
  { id: 'sky',     name: 'スカイ',     fill:'#88d8ff', stroke:'#3090cc', tip:'#d0f0ff' },
];

// ── ガチャ：特殊蛙 2種 ──────────────────────────────────────────
const SPECIAL_FROGS = [
  {
    id: 'cerberus', name: 'ケルベロロ蛙', icon: '🐸🐸🐸',
    desc: '狙った方向と左右45°に舌を同時に3本放つ',
    getTongueDirections: (dirIdx) => [(dirIdx + 7) % 8, dirIdx, (dirIdx + 1) % 8],
  },
  {
    id: 'yamata', name: 'ヤマタノオロオロ蛙', icon: '🐸×8',
    desc: '全方向に舌を同時に8本放つ',
    getTongueDirections: (_) => [0, 1, 2, 3, 4, 5, 6, 7],
  },
];

const GACHA_COST = 3;
const GACHA_POOL = [
  ...BODY_SKINS.slice(1).map(s => ({ ...s, type: 'body' })),
  ...TONGUE_SKINS.slice(1).map(s => ({ ...s, type: 'tongue' })),
  ...SPECIAL_FROGS.map(s => ({ ...s, type: 'special' })),
];

// ── ガチャ永続化 ───────────────────────────────────────────────
function loadOwned() {
  try { const r = JSON.parse(localStorage.getItem('frog_gacha_owned') || '[]'); return Array.isArray(r) ? r : []; }
  catch { return []; }
}
function saveOwned(arr) { localStorage.setItem('frog_gacha_owned', JSON.stringify(arr)); }

function loadSelected() {
  try { return JSON.parse(localStorage.getItem('frog_gacha_selected') || '{}'); }
  catch { return {}; }
}
function saveSelected(sel) { localStorage.setItem('frog_gacha_selected', JSON.stringify(sel)); }

function pullGacha(ownedIds, coins) {
  if (coins < GACHA_COST) return null;
  const unowned = GACHA_POOL.filter(item => !ownedIds.includes(item.id));
  if (unowned.length === 0) return { allOwned: true, item: null };
  const item = unowned[Math.floor(Math.random() * unowned.length)];
  return { allOwned: false, item };
}

window.UPGRADES_DEF = UPGRADES;
window.upgradesApi = { loadWallet, saveWallet, loadLevels, saveLevels, resolve, totalSpent };
window.GACHA_DATA = { BODY_SKINS, TONGUE_SKINS, SPECIAL_FROGS, GACHA_POOL, GACHA_COST };
window.gachaApi = { loadOwned, saveOwned, loadSelected, saveSelected, pullGacha };
