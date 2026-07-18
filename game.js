'use strict';

// ═══════════════════════════════════════════════════════════════════
// SCREEN & VIRTUAL RESOLUTION
// Canvas fills the window. Everything is drawn in design-space
// (450 units tall), scaled up by S. VW = visible design width.
// ═══════════════════════════════════════════════════════════════════
const W  = window.innerWidth;
const H  = window.innerHeight;
const S  = H / 450;
const VW = Math.round(W / S);

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS  (all in design units, 450 = full height)
// ═══════════════════════════════════════════════════════════════════
const GROUND_TOP  = 394;
const GRAVITY     = 0.38;
const MAX_FALL    = 15;
const JUMP_VEL    = -9.5;
const SPD         = 3.5;
const PL_W        = 28;
const PL_H        = 46;
const PL_CROUCH_H = 26;
const PIPE_W      = 52;
const COIN_R      = 10;
const BIRD_W      = 38;
const BIRD_H      = 26;
const PLAT_H      = 14;
const CHUNK       = 680;
const MIN_PLAT_GAP = 80;

// 4 fixed coin levels (design y, lower y = higher on screen)
const COIN_LEVELS = [
  GROUND_TOP - 55,   // 339 — near ground
  GROUND_TOP - 115,  // 279 — medium low
  GROUND_TOP - 185,  // 209 — medium high
  GROUND_TOP - 255,  // 139 — high
];

// ═══════════════════════════════════════════════════════════════════
// CANVAS
// ═══════════════════════════════════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// Mobile detection
const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Touch control constants (design coords)
const JOY_R    = 50;   // joystick outer radius
const JOY_DEAD = 14;   // dead zone
const JOY_ZONE = VW * 0.44; // left portion = joystick area
const BTN_J    = { x: VW - 65, y: 390, r: 36 }; // jump button
const BTN_D    = { x: VW - 65, y: 437, r: 24 }; // down button

// Touch control state
const CTRL = {
  joyId:    null,
  joyCX:    80,
  joyCY:    412,
  joyDx:    0,
  joyOn:    false,
  jumpId:   null,
  downId:   null,
};

// Stars cover the virtual width
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 137 + 23) % VW,
  y: (i * 97  + 11) % (GROUND_TOP - 30),
  r: i % 3 === 0 ? 1.5 : 1,
}));

// ═══════════════════════════════════════════════════════════════════
// SEEDED RNG
// ═══════════════════════════════════════════════════════════════════
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// ═══════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════
let phase;        // 'start' | 'play' | 'dead'
let score;
let bestScore = parseInt(localStorage.getItem('pumpkin_best') || '0');
let camX;
let worldSeed;
let warpFlash = 0;     // frames remaining for warp flash
let warpDir   = 0;     // +1 forward, -1 backward (for flash color)

let pl;
let pipes, platforms, birds, coins;
let generatedChunks;

// ═══════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════
const K = {};
window.addEventListener('keydown', e => {
  if (K[e.key]) return;
  K[e.key] = true;
  if (phase === 'play') {
    if (e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') tryJump();
  } else {
    if (e.key === ' ' || e.key === 'Enter') startGame();
  }
});
window.addEventListener('keyup', e => { K[e.key] = false; });

function isLeft()  { return K['a'] || K['A'] || K['ArrowLeft']  || CTRL.joyDx < -JOY_DEAD; }
function isRight() { return K['d'] || K['D'] || K['ArrowRight'] || CTRL.joyDx >  JOY_DEAD; }
function isDown()  { return K['s'] || K['S'] || K['ArrowDown']  || CTRL.downId !== null; }

// ── Touch controls ─────────────────────────────────────────────────
function td(t) { return { x: t.clientX / S, y: t.clientY / S }; }
function inC(px, py, cx, cy, r) { return (px-cx)**2 + (py-cy)**2 <= r*r; }

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const d = td(t);
    if (phase !== 'play') { startGame(); break; }
    // Joystick zone (left side)
    if (d.x < JOY_ZONE && CTRL.joyId === null) {
      CTRL.joyId = t.identifier;
      CTRL.joyCX = d.x; CTRL.joyCY = d.y;
      CTRL.joyDx = 0;   CTRL.joyOn = true;
      continue;
    }
    // Jump button
    if (inC(d.x, d.y, BTN_J.x, BTN_J.y, BTN_J.r * 1.4) && CTRL.jumpId === null) {
      CTRL.jumpId = t.identifier;
      tryJump(); continue;
    }
    // Down button
    if (inC(d.x, d.y, BTN_D.x, BTN_D.y, BTN_D.r * 1.4) && CTRL.downId === null) {
      CTRL.downId = t.identifier; continue;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === CTRL.joyId) {
      CTRL.joyDx = td(t).x - CTRL.joyCX;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === CTRL.joyId)  { CTRL.joyId = null; CTRL.joyDx = 0; CTRL.joyOn = false; }
    if (t.identifier === CTRL.jumpId) { CTRL.jumpId = null; }
    if (t.identifier === CTRL.downId) { CTRL.downId = null; }
  }
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  CTRL.joyId = null; CTRL.joyDx = 0; CTRL.joyOn = false;
  CTRL.jumpId = null; CTRL.downId = null;
}, { passive: false });

window.addEventListener('orientationchange', () => setTimeout(() => location.reload(), 150));

function tryJump() {
  if (pl.jumpsLeft > 0) {
    pl.vy = JUMP_VEL;
    pl.onGround = false;
    pl.jumpsLeft--;
  }
}

// ═══════════════════════════════════════════════════════════════════
// START / RESET
// ═══════════════════════════════════════════════════════════════════
function startGame() {
  worldSeed       = (Math.random() * 1e9) | 0;
  score           = 0;
  camX            = 0;
  warpFlash       = 0;
  pipes           = [];
  platforms       = [];
  birds           = [];
  coins           = [];
  generatedChunks = new Set();

  pl = {
    x:          150,
    py:         GROUND_TOP,
    vy:         0,
    onGround:   true,
    crouching:  false,
    facing:     1,
    legPhase:   0,
    jumpsLeft:  2,
    onWarpPipe: null,
    coinCombo:  0,
    comboTimer: 0,
    comboPopup: null, // { text, x, y, life }
  };

  phase = 'play';
}

function die() {
  phase = 'dead';
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('pumpkin_best', bestScore);
  }
}

// ═══════════════════════════════════════════════════════════════════
// WORLD GENERATION HELPERS
// ═══════════════════════════════════════════════════════════════════

// Returns true if a platform at (px, pw) doesn't overlap pipes or other platforms
function platformFits(px, pw, py) {
  // Check against existing platforms (with horizontal gap)
  for (const p of platforms) {
    const xOverlap = px < p.x + p.w + MIN_PLAT_GAP && px + pw > p.x - MIN_PLAT_GAP;
    if (xOverlap) return false;
  }
  // Check against pipes: platform must not overlap any pipe x-range
  for (const pipe of pipes) {
    const xOverlap = px < pipe.x + PIPE_W + 10 && px + pw > pipe.x - 10;
    if (xOverlap) return false;
  }
  return true;
}

// Returns y coord from COIN_LEVELS that is above the given pipeTop (with clearance)
function coinLevelAbovePipe(pipeTop) {
  const valid = COIN_LEVELS.filter(ly => ly < pipeTop - 20);
  if (!valid.length) return null;
  return Math.max(...valid); // closest level above the pipe
}

// Returns true if a coin at (cx, cy) is not inside any pipe
function coinFits(cx, cy) {
  for (const pipe of pipes) {
    const pipeTop = GROUND_TOP - pipe.h;
    if (cx + COIN_R > pipe.x - 4 && cx - COIN_R < pipe.x + PIPE_W + 4 &&
        cy + COIN_R > pipeTop && cy - COIN_R < GROUND_TOP) {
      return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// WORLD GENERATION
// ═══════════════════════════════════════════════════════════════════
function genChunk(ci) {
  if (generatedChunks.has(ci)) return;
  generatedChunks.add(ci);

  const rng = makeRng(worldSeed * 997 + ci * 100003);
  const ox  = ci * CHUNK;

  // Safe starting zone
  if (ci === 0) {
    for (let i = 0; i < 5; i++)
      coins.push({ x: ox + 260 + i * 44, y: COIN_LEVELS[0], done: false });
    return;
  }

  // Nehézség: 0→1 az első 20 chunk alatt
  const diff = Math.min(1, ci / 20);

  // ── Pipes ──────────────────────────────────────────────────────
  const numPipes = ci < 5 ? 1 : (rng() < 0.35 + diff * 0.15 ? 2 : 1);
  for (let i = 0; i < numPipes; i++) {
    const lo = ox + 100 + i * 280;
    const hi = ox + CHUNK - 140 - (numPipes - 1 - i) * 220;
    if (lo >= hi) continue;
    const px = lo + rng() * (hi - lo);
    // Kezdetben alacsony csövek, fokozatosan magasabb
    const minH = 45 + diff * 45;
    const maxH = minH + 30 + diff * 70;
    const ph = minH + rng() * (maxH - minH);

    // Warp pipe: ~25% chance
    const isWarp   = ci >= 2 && rng() < 0.25;
    const warpDist = isWarp ? (300 + rng() * 300) : 0;

    pipes.push({ x: px, h: ph, warp: isWarp, warpDist });

    // Coin above pipe (snapped to a level above pipe top)
    const pipeTop  = GROUND_TOP - ph;
    const coinY    = coinLevelAbovePipe(pipeTop);
    if (coinY !== null) {
      coins.push({ x: px + PIPE_W / 2, y: coinY, done: false });
    }
  }

  // ── Platforms (no overlap with pipes or each other) ────────────
  const numPlat = Math.floor(rng() * 3) + 1;
  for (let i = 0; i < numPlat; i++) {
    let px, pw, py, tries = 0;
    do {
      // Korai chunkokon nagyobb, alacsonyabb platformok
      pw = 110 + rng() * 100 - diff * 30;
      px = ox + rng() * (CHUNK - pw);
      py = GROUND_TOP - 90 - rng() * (80 + diff * 100);
      tries++;
    } while (!platformFits(px, pw, py) && tries < 10);

    if (tries >= 10) continue;
    platforms.push({ x: px, y: py, w: pw });

    // Coin on platform: just above the platform surface
    if (rng() > 0.35) {
      const cx = px + rng() * (pw - COIN_R * 2) + COIN_R;
      const cy = py - COIN_R - 6;
      if (coinFits(cx, cy)) coins.push({ x: cx, y: cy, done: false });
    }
  }

  // ── Birds (csak diff 4+ chunkban, fokozatosan gyorsabb) ─────────
  if (ci >= 4) {
    const numBirds = ci > 10 && rng() > 0.6 ? 2 : 1;
    for (let i = 0; i < numBirds; i++) {
      const bx  = ox + rng() * (CHUNK - BIRD_W);
      const by  = GROUND_TOP - 90 - rng() * 150;
      const spd = 0.6 + diff * 0.9 + rng() * 0.5;
      birds.push({ x: bx, y: by, vx: rng() > 0.5 ? spd : -spd, ox: bx, range: 80 + rng() * 180 });
    }
  }

  // ── Floating coins on 4 fixed levels ──────────────────────────
  const numCoins = Math.floor(rng() * 4) + 4; // több coin!
  for (let i = 0; i < numCoins; i++) {
    const cx    = ox + rng() * CHUNK;
    const level = COIN_LEVELS[Math.floor(rng() * COIN_LEVELS.length)];
    if (coinFits(cx, level)) {
      coins.push({ x: cx, y: level, done: false });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// COLLISION
// ═══════════════════════════════════════════════════════════════════
function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════
function update() {
  if (phase !== 'play') return;
  if (warpFlash > 0) { warpFlash--; return; } // freeze during warp flash

  // Generate chunks ahead
  const rightChunk = Math.ceil((pl.x + VW + CHUNK) / CHUNK);
  for (let ci = 0; ci <= rightChunk; ci++) genChunk(ci);

  pl.crouching = isDown() && pl.onGround;
  const h = pl.crouching ? PL_CROUCH_H : PL_H;

  // Horizontal
  let vx = 0;
  if (isLeft())  { vx = -SPD; pl.facing = -1; }
  if (isRight()) { vx =  SPD; pl.facing =  1; }
  pl.x += vx;
  if (pl.x < 50) pl.x = 50;

  // Walking animation
  if (pl.onGround && vx !== 0) pl.legPhase += 0.13;
  else if (pl.onGround)        pl.legPhase = 0;

  // Fast fall in air
  if (!pl.onGround && isDown()) pl.vy = MAX_FALL;

  // Gravity
  pl.vy = Math.min(pl.vy + GRAVITY, MAX_FALL);
  const prevPY = pl.py;
  pl.py += pl.vy;
  pl.onGround    = false;
  pl.onWarpPipe  = null;

  // ── Ground ─────────────────────────────────────────────────────
  if (pl.py >= GROUND_TOP) {
    pl.py = GROUND_TOP; pl.vy = 0;
    pl.onGround = true; pl.jumpsLeft = 2;
  }

  // ── One-way platforms ──────────────────────────────────────────
  if (!pl.crouching && pl.vy >= 0) {
    for (const plat of platforms) {
      if (prevPY <= plat.y + 2 && pl.py >= plat.y &&
          pl.x + PL_W / 2 - 2 > plat.x &&
          pl.x - PL_W / 2 + 2 < plat.x + plat.w) {
        pl.py = plat.y; pl.vy = 0;
        pl.onGround = true; pl.jumpsLeft = 2;
      }
    }
  }

  // ── Pipes: solid (land on top, push from sides) ────────────────
  for (const pipe of pipes) {
    const pipeTop = GROUND_TOP - pipe.h;
    const withinX = pl.x + PL_W / 2 - 2 > pipe.x &&
                    pl.x - PL_W / 2 + 2 < pipe.x + PIPE_W;

    // Land on top
    if (pl.vy >= 0 && withinX && prevPY <= pipeTop + 2 && pl.py >= pipeTop) {
      pl.py = pipeTop; pl.vy = 0;
      pl.onGround = true; pl.jumpsLeft = 2;
      if (pipe.warp) pl.onWarpPipe = pipe;
      continue;
    }

    // Side push
    const hbL = pl.x - PL_W / 2;
    const hbT = pl.py - h;
    if (overlap(hbL, hbT, PL_W, h, pipe.x, pipeTop, PIPE_W, pipe.h)) {
      const oLeft  = hbL + PL_W - pipe.x;
      const oRight = pipe.x + PIPE_W - hbL;
      pl.x = oLeft < oRight
        ? pipe.x - PL_W / 2 - 1
        : pipe.x + PIPE_W + PL_W / 2 + 1;
    }
  }

  // ── Warp pipe: press S to enter ────────────────────────────────
  if (pl.onWarpPipe && isDown()) {
    const dist = pl.onWarpPipe.warpDist;
    warpDir   = dist > 0 ? 1 : -1;
    warpFlash = 18;
    pl.x = Math.max(100, pl.x + dist);
    camX = Math.max(0, pl.x - VW * 0.3);
    pl.onWarpPipe = null;
    // Regenerate chunks for new position
    const rc = Math.ceil((pl.x + VW + CHUNK) / CHUNK);
    for (let ci = 0; ci <= rc; ci++) genChunk(ci);
    return;
  }

  // ── Final hitbox ───────────────────────────────────────────────
  const hbLeft = pl.x - PL_W / 2;
  const hbTop  = pl.py - h;
  const hbW    = PL_W;
  const hbH    = h;

  // ── Birds → die ────────────────────────────────────────────────
  for (const bird of birds) {
    bird.x += bird.vx;
    if (bird.x < bird.ox - bird.range || bird.x > bird.ox + bird.range) bird.vx *= -1;
    if (overlap(hbLeft, hbTop, hbW, hbH, bird.x + 2, bird.y + 2, BIRD_W - 4, BIRD_H - 4)) {
      die(); return;
    }
  }

  // ── Combo timer ────────────────────────────────────────────────
  if (pl.comboTimer > 0) pl.comboTimer--;
  else pl.coinCombo = 0;

  // Combo popup élettartama
  if (pl.comboPopup) {
    pl.comboPopup.life--;
    pl.comboPopup.y -= 0.5;
    if (pl.comboPopup.life <= 0) pl.comboPopup = null;
  }

  // ── Coins ──────────────────────────────────────────────────────
  for (const c of coins) {
    if (c.done) continue;
    if (overlap(hbLeft, hbTop, hbW, hbH, c.x - COIN_R, c.y - COIN_R, COIN_R * 2, COIN_R * 2)) {
      c.done = true;
      if (pl.comboTimer > 0) pl.coinCombo++;
      else pl.coinCombo = 1;
      pl.comboTimer = 90;
      const mult = pl.coinCombo >= 6 ? 3 : pl.coinCombo >= 3 ? 2 : 1;
      const pts  = 10 * mult;
      score += pts;
      if (pl.coinCombo >= 3) {
        pl.comboPopup = {
          text: `x${pl.coinCombo} COMBO! +${pts}`,
          x: pl.x,
          y: pl.py - PL_H - 20,
          life: 50,
        };
      }
    }
  }

  // ── Camera ─────────────────────────────────────────────────────
  camX = Math.max(0, pl.x - VW * 0.3);
}

// ═══════════════════════════════════════════════════════════════════
// DRAW HELPERS
// ═══════════════════════════════════════════════════════════════════
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPipe(pipe, t) {
  const top = GROUND_TOP - pipe.h;
  if (pipe.warp) {
    // Warp pipe: animated color
    const pulse = 0.6 + Math.sin(t * 4 + pipe.x * 0.01) * 0.4;
    const col   = `rgba(230,${Math.round(100 * pulse)},0,1)`;
    const dark  = '#7f2000';
    const light = '#ff9800';
    ctx.fillStyle = dark;
    ctx.fillRect(pipe.x + 6, top + 22, PIPE_W - 12, pipe.h - 22);
    ctx.fillStyle = col;
    ctx.fillRect(pipe.x, top, PIPE_W, 24);
    ctx.fillStyle = light;
    ctx.fillRect(pipe.x + 8, top + 2, 7, pipe.h - 4);
    ctx.fillRect(pipe.x + 2, top + 4, 4, 16);
    // "S" hint if player is standing on it
    if (pl && pl.onWarpPipe === pipe) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼ S', pipe.x + PIPE_W / 2, top - 6);
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(pipe.x + 6, top + 22, PIPE_W - 12, pipe.h - 22);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(pipe.x, top, PIPE_W, 24);
    ctx.fillStyle = '#43A047';
    ctx.fillRect(pipe.x + 8, top + 2, 7, pipe.h - 4);
    ctx.fillRect(pipe.x + 2, top + 4, 4, 16);
  }
}

function drawPlayer() {
  const h      = pl.crouching ? PL_CROUCH_H : PL_H;
  const top    = pl.py - h;
  const inAir  = !pl.onGround;
  const moving = isLeft() || isRight();

  ctx.save();
  ctx.translate(pl.x, top);
  ctx.scale(pl.facing, 1);

  // Squash/stretch
  let scY = 1;
  if (inAir) scY = pl.vy < 0 ? 1.12 : 0.94;
  ctx.scale(1, scY);
  const dh = h / scY;

  const legW  = 10, legH = 16, shoeW = 14, shoeH = 5;

  if (pl.crouching) {
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(-PL_W / 2 + 2, dh - 10, 24, 10);
    ctx.fillStyle = '#212121';
    ctx.fillRect(-PL_W / 2, dh - 4, 26, 4);
  } else if (inAir) {
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(-8, dh - legH, legW, legH - 4);
    ctx.fillRect( 0, dh - legH, legW, legH - 4);
    ctx.fillStyle = '#212121';
    ctx.fillRect(-10, dh - shoeH, shoeW, shoeH);
    ctx.fillRect(  0, dh - shoeH, shoeW, shoeH);
  } else {
    const sw = moving ? Math.sin(pl.legPhase) * 8 : 0;
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(-PL_W / 2 + 2,  dh - legH + sw,  legW, legH - sw);
    ctx.fillRect( PL_W / 2 - 12, dh - legH - sw,  legW, legH + sw);
    ctx.fillStyle = '#212121';
    ctx.fillRect(-PL_W / 2,      dh - shoeH, shoeW, shoeH);
    ctx.fillRect( PL_W / 2 - 14, dh - shoeH, shoeW, shoeH);
  }

  const bodyTop = pl.crouching ? dh * 0.35 : dh * 0.38;
  ctx.fillStyle = '#1565C0';
  ctx.fillRect(-PL_W / 2, bodyTop, PL_W, dh - bodyTop - (pl.crouching ? 8 : 16));
  ctx.fillStyle = '#FFD600';
  ctx.fillRect(-PL_W / 2 + 4, bodyTop + 2, 4, 3);
  ctx.fillRect( PL_W / 2 - 8, bodyTop + 2, 4, 3);

  if (!pl.crouching) {
    const as = moving ? -Math.sin(pl.legPhase) * 6 : 0;
    ctx.fillStyle = '#1565C0';
    ctx.fillRect( PL_W / 2 - 2, bodyTop + 2 + as, 6, 12);
    ctx.fillRect(-PL_W / 2 - 4, bodyTop + 2 - as, 6, 12);
    ctx.fillStyle = '#FFCC80';
    ctx.fillRect( PL_W / 2 - 2, bodyTop + 14 + as, 6, 5);
    ctx.fillRect(-PL_W / 2 - 4, bodyTop + 14 - as, 6, 5);
  }

  const headTop = bodyTop - 22;
  ctx.fillStyle = '#FFCC80';
  ctx.fillRect(-PL_W / 2 + 3, headTop, PL_W - 6, 22);
  ctx.fillStyle = '#E53935';
  ctx.fillRect(-PL_W / 2 - 2, headTop + 2, PL_W + 4, 4);
  ctx.fillRect(-PL_W / 2 + 1, headTop - 8, PL_W - 2, 12);
  ctx.fillStyle = '#111';
  ctx.fillRect(4, headTop + 6, 5, 5);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(-5, headTop + 13, 17, 4);
  ctx.fillStyle = '#FFCC80';
  ctx.fillRect(-PL_W / 2 + 1, headTop + 5, 4, 7);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// DRAW
// ═══════════════════════════════════════════════════════════════════
function draw(t) {
  ctx.clearRect(0, 0, W, H);

  // Scale all drawing to screen
  ctx.save();
  ctx.scale(S, S);

  // ── Sky ────────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
  sky.addColorStop(0, '#0d0d3b');
  sky.addColorStop(1, '#1a6ea8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, GROUND_TOP);

  // Stars
  for (const s of STARS) {
    ctx.globalAlpha = 0.4 + Math.sin(t * 1.2 + s.x * 0.05) * 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2);
  }
  ctx.globalAlpha = 1;

  // ── Ground ─────────────────────────────────────────────────────
  ctx.fillStyle = '#3e2a1a';
  ctx.fillRect(0, GROUND_TOP, VW, 450 - GROUND_TOP);
  ctx.fillStyle = '#558B2F';
  ctx.fillRect(0, GROUND_TOP, VW, 14);
  ctx.fillStyle = '#33691E';
  for (let gx = -((camX | 0) % 32); gx < VW; gx += 32)
    ctx.fillRect(gx, GROUND_TOP, 1, 14);

  // ── World (camera offset) ──────────────────────────────────────
  ctx.save();
  ctx.translate(-(camX | 0), 0);

  if (phase !== 'start') {
    // Platforms
    for (const p of platforms) {
      if (p.x + p.w < camX - 10 || p.x > camX + VW + 10) continue;
      ctx.fillStyle = '#6D4C41';
      ctx.fillRect(p.x, p.y, p.w, PLAT_H);
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.fillStyle = '#4E342E';
      for (let tx = p.x; tx < p.x + p.w; tx += 18)
        ctx.fillRect(tx, p.y, 1, PLAT_H);
    }

    // Pipes
    for (const pipe of pipes) {
      if (pipe.x + PIPE_W < camX - 10 || pipe.x > camX + VW + 10) continue;
      drawPipe(pipe, t);
    }

    // Coins (on 4 discrete levels — draw level guides subtly)
    for (const c of coins) {
      if (c.done) continue;
      if (c.x + COIN_R < camX - 10 || c.x - COIN_R > camX + VW + 10) continue;
      const bob = Math.sin(t * 3 + c.x * 0.08) * 3;
      ctx.fillStyle = '#FFD600';
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, COIN_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFF8D';
      ctx.beginPath();
      ctx.arc(c.x - 2, c.y + bob - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Birds
    for (const b of birds) {
      if (b.x + BIRD_W < camX - 10 || b.x > camX + VW + 10) continue;
      const wing = Math.sin(t * 9 + b.ox * 0.01) * 0.45;
      ctx.save();
      ctx.translate(b.x + BIRD_W / 2, b.y + BIRD_H / 2);
      if (b.vx < 0) ctx.scale(-1, 1);
      ctx.fillStyle = '#C62828';
      ctx.fillRect(-14, -6, 28, 16);
      ctx.save();
      ctx.translate(0, -5); ctx.rotate(-wing);
      ctx.fillStyle = '#B71C1C';
      ctx.fillRect(-16, -7, 32, 8);
      ctx.restore();
      ctx.fillStyle = '#B71C1C'; ctx.fillRect(-14, 6, 10, 6);
      ctx.fillStyle = '#fff';    ctx.fillRect(8, -4, 7, 6);
      ctx.fillStyle = '#111';    ctx.fillRect(11, -3, 4, 4);
      ctx.fillStyle = '#FF8F00'; ctx.fillRect(14, 1, 9, 5);
      ctx.restore();
    }

    // Player
    drawPlayer();

    // Combo popup (world space, fölötte lebeg)
    if (pl.comboPopup) {
      const p = pl.comboPopup;
      const alpha = Math.min(1, p.life / 20);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = `bold ${10 + pl.coinCombo}px monospace`;
      ctx.fillStyle = pl.coinCombo >= 6 ? '#FF6D00' : '#FFD600';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }

  ctx.restore(); // end camera

  // ── HUD ────────────────────────────────────────────────────────
  if (phase !== 'start') {
    const dist = Math.max(0, Math.floor(pl.x - 150));
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(10, 10, 200, 72, 8); ctx.fill();
    ctx.fillStyle = '#FFD600';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`PONTOK: ${score}`, 22, 36);
    ctx.fillStyle = '#90CAF9';
    ctx.font = '14px monospace';
    ctx.fillText(`LEGJOBB: ${bestScore}`, 22, 56);
    ctx.fillStyle = '#A5D6A7';
    ctx.fillText(`TÁVOLSÁG: ${dist}m`, 22, 72);

    // Warp pipe legend
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(10, 72, 160, 22, 6); ctx.fill();
    ctx.fillStyle = '#FF9800'; ctx.fillRect(18, 79, 12, 12);
    ctx.fillStyle = '#ddd'; ctx.font = '11px monospace';
    ctx.fillText('= előre warp (S)', 34, 90);
  }

  // ── Mobile controls ────────────────────────────────────────────
  drawMobileControls();

  // ── Overlays ───────────────────────────────────────────────────
  if (phase === 'start') {
    drawOverlay('PUMPKIN RUN', [
      'SPACE / ENTER  →  indítás',
      '',
      'W / SPACE  →  ugrás (dupla ugrás!)',
      'A / D      →  mozgás',
      'S          →  guggolás / leesés / warp',
      '',
      '🟠 narancssárga cső = előre warp (S)',
    ]);
  } else if (phase === 'dead') {
    drawOverlay('GAME OVER', [
      `Pont: ${score}`,
      `Legjobb: ${bestScore}`,
      '',
      'SPACE / ENTER  →  újra',
    ]);
  }

  // ── Warp flash ─────────────────────────────────────────────────
  if (warpFlash > 0) {
    const alpha = warpFlash / 18;
    ctx.fillStyle = warpDir > 0
      ? `rgba(255,150,0,${alpha * 0.7})`
      : `rgba(160,0,255,${alpha * 0.7})`;
    ctx.fillRect(0, 0, VW, 450);
  }

  ctx.restore(); // end scale
}

function drawMobileControls() {
  if (!isMobile) return;
  ctx.save();
  ctx.lineWidth = 2.5;

  // ── Joystick ───────────────────────────────────────────────────
  const jcx = CTRL.joyOn ? CTRL.joyCX : 80;
  const jcy = CTRL.joyOn ? CTRL.joyCY : 412;
  // Outer ring
  ctx.globalAlpha = CTRL.joyOn ? 0.55 : 0.22;
  ctx.fillStyle   = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(jcx, jcy, JOY_R, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Inner knob
  const kx = jcx + Math.max(-JOY_R + 16, Math.min(JOY_R - 16, CTRL.joyDx));
  ctx.globalAlpha = CTRL.joyOn ? 0.8 : 0.3;
  ctx.fillStyle   = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(kx, jcy, 18, 0, Math.PI * 2); ctx.fill();
  // Hint arrows when idle
  if (!CTRL.joyOn) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 16px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('◀  ▶', jcx, jcy + 6);
  }

  // ── Jump button ────────────────────────────────────────────────
  const jp = CTRL.jumpId !== null;
  ctx.globalAlpha = jp ? 0.85 : 0.4;
  ctx.fillStyle   = jp ? 'rgba(80,190,255,0.6)' : 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(80,190,255,0.85)';
  ctx.beginPath(); ctx.arc(BTN_J.x, BTN_J.y, BTN_J.r, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle  = '#fff';
  ctx.font       = `bold 22px monospace`;
  ctx.textAlign  = 'center';
  ctx.fillText('▲', BTN_J.x, BTN_J.y + 8);

  // ── Down button ────────────────────────────────────────────────
  const dp = CTRL.downId !== null;
  ctx.globalAlpha = dp ? 0.85 : 0.38;
  ctx.fillStyle   = dp ? 'rgba(255,210,80,0.6)' : 'rgba(255,255,255,0.1)';
  ctx.strokeStyle = 'rgba(255,210,80,0.8)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(BTN_D.x, BTN_D.y, BTN_D.r, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 15px monospace';
  ctx.fillText('▼', BTN_D.x, BTN_D.y + 6);

  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
  ctx.restore();
}

function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, VW, 450);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF7043';
  ctx.font = 'bold 54px monospace';
  ctx.shadowColor = '#FF7043'; ctx.shadowBlur = 18;
  ctx.fillText(title, VW / 2, 225 - 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ECEFF1';
  ctx.font = '20px monospace';
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 225 - 10 + i * 30));
  ctx.textAlign = 'left';
}

// ═══════════════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════════════
function loop(ms) {
  update();
  draw(ms / 1000);
  requestAnimationFrame(loop);
}

phase = 'start';
requestAnimationFrame(loop);
