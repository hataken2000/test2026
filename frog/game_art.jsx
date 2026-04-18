// Original art for the frog game — all hand-built SVGs

const Frog = ({ size = 120, mouthOpen = false, eyeLook = {x:0, y:0}, hurt = false }) => {
  const pupilX = 6 * eyeLook.x;
  const pupilY = 6 * eyeLook.y;
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="bodyGrad" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#9fd66a" />
          <stop offset="55%" stopColor="#5fa83e" />
          <stop offset="100%" stopColor="#2d6b21" />
        </radialGradient>
        <radialGradient id="bellyGrad" cx="0.5" cy="0.2" r="0.8">
          <stop offset="0%" stopColor="#fff5d9" />
          <stop offset="100%" stopColor="#e8c676" />
        </radialGradient>
        <radialGradient id="eyeBallGrad" cx="0.3" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#c1ed7c" />
          <stop offset="100%" stopColor="#4e8a2a" />
        </radialGradient>
      </defs>

      {/* back feet */}
      <ellipse cx="-58" cy="40" rx="22" ry="12" fill="#3a8228" transform="rotate(-15 -58 40)" />
      <ellipse cx="58" cy="40" rx="22" ry="12" fill="#3a8228" transform="rotate(15 58 40)" />

      {/* body */}
      <ellipse cx="0" cy="12" rx="72" ry="58" fill="url(#bodyGrad)" />
      {/* belly */}
      <ellipse cx="0" cy="30" rx="46" ry="30" fill="url(#bellyGrad)" opacity="0.85" />

      {/* spots */}
      <circle cx="-42" cy="-6" r="7" fill="#2d6b21" opacity="0.45" />
      <circle cx="38" cy="-4" r="5" fill="#2d6b21" opacity="0.45" />
      <circle cx="-20" cy="-22" r="4" fill="#2d6b21" opacity="0.4" />

      {/* mouth */}
      {mouthOpen ? (
        <path d="M -30 4 Q 0 28 30 4 Q 30 22 0 24 Q -30 22 -30 4 Z" fill="#5a1a2e" stroke="#2d6b21" strokeWidth="2" />
      ) : (
        <path d="M -34 0 Q 0 12 34 0" stroke="#2d6b21" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}

      {/* eye mounds */}
      <ellipse cx="-30" cy="-48" rx="26" ry="30" fill="url(#bodyGrad)" />
      <ellipse cx="30" cy="-48" rx="26" ry="30" fill="url(#bodyGrad)" />

      {/* eyeballs */}
      <circle cx="-30" cy="-52" r="18" fill="url(#eyeBallGrad)" />
      <circle cx="30" cy="-52" r="18" fill="url(#eyeBallGrad)" />

      {/* pupils */}
      <ellipse cx={-30 + pupilX} cy={-50 + pupilY} rx="5" ry="9" fill="#0a140a" />
      <ellipse cx={30 + pupilX} cy={-50 + pupilY} rx="5" ry="9" fill="#0a140a" />
      <circle cx={-32 + pupilX} cy={-54 + pupilY} r="2.5" fill="#fff" />
      <circle cx={28 + pupilX} cy={-54 + pupilY} r="2.5" fill="#fff" />

      {/* cheek blush when hurt */}
      {hurt && (
        <>
          <circle cx="-46" cy="8" r="10" fill="#ff6b8a" opacity="0.5" />
          <circle cx="46" cy="8" r="10" fill="#ff6b8a" opacity="0.5" />
        </>
      )}
    </svg>
  );
};

// Gnat — tiniest, straight-line, 5pts
const Gnat = ({ size = 22, flap = 0 }) => {
  const wy = Math.sin(flap) * 0.4 + 0.7;
  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" style={{ overflow: 'visible' }}>
      <ellipse cx="-7" cy="-5" rx="9" ry={5 * wy} fill="rgba(230,235,245,0.6)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <ellipse cx="7" cy="-5" rx="9" ry={5 * wy} fill="rgba(230,235,245,0.6)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <ellipse cx="0" cy="3" rx="7" ry="9" fill="#2e2a28" />
      <circle cx="-2" cy="-2" r="2" fill="#7a3333" />
      <circle cx="2" cy="-2" r="2" fill="#7a3333" />
    </svg>
  );
};

// Fly — small, 10pts
const Fly = ({ size = 36, flap = 0 }) => {
  const wy = Math.sin(flap) * 0.5 + 0.7;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: 'visible' }}>
      {/* wings */}
      <ellipse cx="-18" cy="-12" rx="22" ry={12 * wy} fill="rgba(220,230,255,0.72)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <ellipse cx="18" cy="-12" rx="22" ry={12 * wy} fill="rgba(220,230,255,0.72)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      {/* body */}
      <ellipse cx="0" cy="6" rx="18" ry="20" fill="#1a1a20" />
      <ellipse cx="0" cy="-4" rx="14" ry="13" fill="#2a2a32" />
      {/* eyes */}
      <circle cx="-6" cy="-6" r="5" fill="#c93434" />
      <circle cx="6" cy="-6" r="5" fill="#c93434" />
      <circle cx="-4" cy="-8" r="1.6" fill="#fff" />
      <circle cx="8" cy="-8" r="1.6" fill="#fff" />
    </svg>
  );
};

// Bee — bigger, 50pts
const Bee = ({ size = 54, flap = 0 }) => {
  const wy = Math.sin(flap) * 0.5 + 0.7;
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" style={{ overflow: 'visible' }}>
      {/* wings */}
      <ellipse cx="-22" cy="-18" rx="26" ry={14 * wy} fill="rgba(255,255,255,0.78)" stroke="rgba(200,210,230,0.7)" strokeWidth="1.5" />
      <ellipse cx="22" cy="-18" rx="26" ry={14 * wy} fill="rgba(255,255,255,0.78)" stroke="rgba(200,210,230,0.7)" strokeWidth="1.5" />
      {/* body */}
      <ellipse cx="0" cy="8" rx="28" ry="30" fill="#f7c536" />
      {/* stripes */}
      <path d="M -24 -2 Q 0 8 24 -2 L 22 6 Q 0 16 -22 6 Z" fill="#2a1e0a" />
      <path d="M -22 14 Q 0 24 22 14 L 18 22 Q 0 30 -18 22 Z" fill="#2a1e0a" />
      {/* head */}
      <circle cx="0" cy="-22" r="16" fill="#2a1e0a" />
      {/* eyes */}
      <circle cx="-6" cy="-22" r="3.5" fill="#fff" />
      <circle cx="6" cy="-22" r="3.5" fill="#fff" />
      <circle cx="-6" cy="-22" r="1.6" fill="#0a0a0a" />
      <circle cx="6" cy="-22" r="1.6" fill="#0a0a0a" />
      {/* antennae */}
      <path d="M -6 -36 Q -10 -44 -14 -44" stroke="#2a1e0a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 6 -36 Q 10 -44 14 -44" stroke="#2a1e0a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="-14" cy="-44" r="2" fill="#2a1e0a" />
      <circle cx="14" cy="-44" r="2" fill="#2a1e0a" />
    </svg>
  );
};

// Hornet — mean, 150pts
const Hornet = ({ size = 64, flap = 0 }) => {
  const wy = Math.sin(flap) * 0.5 + 0.7;
  return (
    <svg width={size} height={size} viewBox="-70 -70 140 140" style={{ overflow: 'visible' }}>
      {/* wings */}
      <ellipse cx="-26" cy="-20" rx="30" ry={16 * wy} fill="rgba(255,200,200,0.55)" stroke="rgba(255,120,120,0.6)" strokeWidth="1.5" />
      <ellipse cx="26" cy="-20" rx="30" ry={16 * wy} fill="rgba(255,200,200,0.55)" stroke="rgba(255,120,120,0.6)" strokeWidth="1.5" />
      {/* body */}
      <ellipse cx="0" cy="12" rx="32" ry="36" fill="#e87a1e" />
      {/* stripes — darker, angrier */}
      <path d="M -28 0 Q 0 12 28 0 L 26 10 Q 0 22 -26 10 Z" fill="#1a0a0a" />
      <path d="M -26 18 Q 0 30 26 18 L 22 28 Q 0 38 -22 28 Z" fill="#1a0a0a" />
      {/* stinger */}
      <path d="M -6 44 L 0 58 L 6 44 Z" fill="#1a0a0a" />
      {/* head */}
      <circle cx="0" cy="-24" r="18" fill="#1a0a0a" />
      {/* angry eyes */}
      <path d="M -12 -28 L -2 -22 L -12 -18 Z" fill="#ffd84d" />
      <path d="M 12 -28 L 2 -22 L 12 -18 Z" fill="#ffd84d" />
      <circle cx="-6" cy="-23" r="1.8" fill="#c42e00" />
      <circle cx="6" cy="-23" r="1.8" fill="#c42e00" />
      {/* antennae */}
      <path d="M -6 -38 Q -12 -48 -16 -46" stroke="#1a0a0a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 6 -38 Q 12 -48 16 -46" stroke="#1a0a0a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
};

const Heart = ({ size = 28, filled = true }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    <path d="M 0 28 C -40 4 -40 -28 -18 -28 C -6 -28 0 -18 0 -10 C 0 -18 6 -28 18 -28 C 40 -28 40 4 0 28 Z"
      fill={filled ? '#ff4d6d' : 'rgba(255,255,255,0.15)'}
      stroke={filled ? '#c42e4e' : 'rgba(255,255,255,0.3)'}
      strokeWidth="4" strokeLinejoin="round" />
  </svg>
);

// Simple lily pad decoration
const LilyPad = ({ size = 80, rot = 0 }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ transform: `rotate(${rot}deg)` }}>
    <defs>
      <radialGradient id={`lp${rot}`} cx="0.4" cy="0.4" r="0.7">
        <stop offset="0%" stopColor="#6ab84a" />
        <stop offset="100%" stopColor="#2d6b21" />
      </radialGradient>
    </defs>
    <path d="M 0 -44 A 44 44 0 1 1 -8 -44 L 0 0 Z" fill={`url(#lp${rot})`} opacity="0.8" />
  </svg>
);

// Pond water ring + lily pad under the frog
const Pond = ({ radius }) => (
  <g>
    <defs>
      <radialGradient id="pondGrad" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="rgba(90,170,220,0.55)" />
        <stop offset="60%" stopColor="rgba(50,110,170,0.45)" />
        <stop offset="100%" stopColor="rgba(20,60,110,0.0)" />
      </radialGradient>
      <radialGradient id="padGrad" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0%" stopColor="#8ed95a" />
        <stop offset="70%" stopColor="#4f9a28" />
        <stop offset="100%" stopColor="#1f5210" />
      </radialGradient>
    </defs>
    {/* pond */}
    <circle r={radius} fill="url(#pondGrad)" />
    {/* subtle water ripples */}
    <circle r={radius * 0.62} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
    <circle r={radius * 0.82} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
    {/* lily pad — centered disc with a small wedge notch */}
    <g>
      <path d={`M ${95 * Math.cos(Math.PI/12)} ${95 * Math.sin(Math.PI/12)} A 95 95 0 1 1 ${95 * Math.cos(-Math.PI/12)} ${-95 * Math.sin(Math.PI/12)} L 0 0 Z`} fill="url(#padGrad)" />
      {/* leaf veins */}
      <g stroke="rgba(30,80,20,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M 0 0 L 80 -30" />
        <path d="M 0 0 L 88 0" />
        <path d="M 0 0 L 80 30" />
        <path d="M 0 0 L 60 -65" />
        <path d="M 0 0 L 60 65" />
        <path d="M 0 0 L 30 -85" />
        <path d="M 0 0 L 30 85" />
        <path d="M 0 0 L -20 -90" />
        <path d="M 0 0 L -20 90" />
        <path d="M 0 0 L -60 -65" />
        <path d="M 0 0 L -60 65" />
        <path d="M 0 0 L -85 -30" />
        <path d="M 0 0 L -85 30" />
      </g>
      {/* highlight */}
      <ellipse cx="-30" cy="-45" rx="25" ry="10" fill="rgba(255,255,255,0.15)" transform="rotate(-30 -30 -45)" />
    </g>
  </g>
);

// Oniyanma (Dragonfly) — BOSS, 500 pts, 3 hits
const Dragonfly = ({ size = 140, flap = 0, hitFlash = 0 }) => {
  const wy = Math.sin(flap * 2) * 0.3 + 0.9;
  const tint = hitFlash > 0 ? 'brightness(2)' : 'none';
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{ overflow: 'visible', filter: tint }}>
      <defs>
        <linearGradient id="dragonBody" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor="#2eea4c" />
          <stop offset="50%" stopColor="#0a8a20" />
          <stop offset="100%" stopColor="#03380f" />
        </linearGradient>
        <radialGradient id="dragonEye" cx="0.3" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#88eaff" />
          <stop offset="70%" stopColor="#1a8fb0" />
          <stop offset="100%" stopColor="#06303a" />
        </radialGradient>
      </defs>
      {/* four wings */}
      <ellipse cx="-40" cy="-20" rx="46" ry={16 * wy} fill="rgba(220,240,255,0.55)" stroke="rgba(160,200,230,0.6)" strokeWidth="1.5" />
      <ellipse cx="40" cy="-20" rx="46" ry={16 * wy} fill="rgba(220,240,255,0.55)" stroke="rgba(160,200,230,0.6)" strokeWidth="1.5" />
      <ellipse cx="-40" cy="12" rx="40" ry={14 * wy} fill="rgba(220,240,255,0.5)" stroke="rgba(160,200,230,0.6)" strokeWidth="1.5" />
      <ellipse cx="40" cy="12" rx="40" ry={14 * wy} fill="rgba(220,240,255,0.5)" stroke="rgba(160,200,230,0.6)" strokeWidth="1.5" />
      {/* wing veins */}
      <g stroke="rgba(80,120,140,0.5)" strokeWidth="0.8" fill="none">
        <path d="M -80 -20 L 0 -20" /><path d="M 80 -20 L 0 -20" />
        <path d="M -76 12 L 0 12" /><path d="M 76 12 L 0 12" />
      </g>
      {/* long abdomen with yellow rings */}
      <rect x="-10" y="-8" width="20" height="90" rx="10" fill="url(#dragonBody)" />
      <rect x="-10" y="10" width="20" height="4" fill="#ffd84d" />
      <rect x="-10" y="22" width="20" height="4" fill="#ffd84d" />
      <rect x="-10" y="34" width="20" height="4" fill="#ffd84d" />
      <rect x="-10" y="46" width="20" height="4" fill="#ffd84d" />
      <rect x="-10" y="58" width="20" height="4" fill="#ffd84d" />
      <rect x="-10" y="70" width="20" height="4" fill="#ffd84d" />
      {/* thorax */}
      <ellipse cx="0" cy="-12" rx="18" ry="20" fill="url(#dragonBody)" />
      {/* huge compound eyes */}
      <circle cx="-16" cy="-40" r="18" fill="url(#dragonEye)" />
      <circle cx="16" cy="-40" r="18" fill="url(#dragonEye)" />
      <circle cx="-20" cy="-46" r="4" fill="#ffffff" opacity="0.8" />
      <circle cx="12" cy="-46" r="4" fill="#ffffff" opacity="0.8" />
      {/* head */}
      <ellipse cx="0" cy="-38" rx="8" ry="10" fill="#083b12" />
    </svg>
  );
};

Object.assign(window, { Frog, Gnat, Fly, Bee, Hornet, Heart, LilyPad, Pond, Dragonfly });
