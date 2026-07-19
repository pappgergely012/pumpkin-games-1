import {
  GROUND_TOP, GRAVITY, MAX_FALL, JUMP_VEL, SPD,
  PL_W, PL_H, PL_CROUCH_H, PIPE_W, COIN_R,
  BIRD_W, BIRD_H, CRAWLER_W, CRAWLER_H, BEE_W, BEE_H, SPIDER_W, SPIDER_H,
  CHUNK, VW,
} from '../core/constants.js';
import { state, die } from '../core/state.js';
import { isLeft, isRight, isDown } from './input.js';
import { genChunk } from './world.js';

// ═══════════════════════════════════════════════════════════════════
// COLLISION UTILITY
// ═══════════════════════════════════════════════════════════════════
export function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE  — one frame of game logic
// ═══════════════════════════════════════════════════════════════════
export function update() {
  if (state.phase === 'dying') { updateDying(); return; }
  if (state.phase !== 'play') return;
  if (state.warpFlash > 0) { state.warpFlash--; return; } // freeze during flash

  const { pl, pipes, platforms, birds, coins, bullets } = state;

  // ── Chunk generation ───────────────────────────────────────────
  const leftChunk  = Math.max(0, Math.floor(pl.x / CHUNK) - 1);
  const rightChunk = Math.ceil((pl.x + VW + CHUNK) / CHUNK);
  for (let ci = leftChunk; ci <= rightChunk; ci++) genChunk(ci);

  // ── Player movement ────────────────────────────────────────────
  pl.crouching = isDown() && pl.onGround;
  const h = pl.crouching ? PL_CROUCH_H : PL_H;

  let vx = 0;
  if (isLeft())  { vx = -SPD; pl.facing = -1; }
  if (isRight()) { vx =  SPD; pl.facing =  1; }
  pl.x += vx;
  if (pl.x < 50) pl.x = 50;

  if (pl.onGround && vx !== 0) pl.legPhase += 0.13;
  else if (pl.onGround)        pl.legPhase  = 0;

  if (!pl.onGround && isDown()) pl.vy = MAX_FALL; // fast fall

  pl.vy = Math.min(pl.vy + GRAVITY, MAX_FALL);
  const prevPY = pl.py;
  pl.py += pl.vy;
  pl.onGround   = false;
  pl.onWarpPipe = null;

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

  // ── Pipes: solid (top landing + side push) ─────────────────────
  for (const pipe of pipes) {
    const pipeTop = GROUND_TOP - pipe.h;
    const withinX = pl.x + PL_W / 2 - 2 > pipe.x &&
                    pl.x - PL_W / 2 + 2 < pipe.x + PIPE_W;

    if (pl.vy >= 0 && withinX && prevPY <= pipeTop + 2 && pl.py >= pipeTop) {
      pl.py = pipeTop; pl.vy = 0;
      pl.onGround = true; pl.jumpsLeft = 2;
      if (pipe.warp) pl.onWarpPipe = pipe;
      continue;
    }

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

  // ── Warp pipe: press S to warp forward ────────────────────────
  if (pl.onWarpPipe && isDown()) {
    const dist = pl.onWarpPipe.warpDist;
    state.warpDir   = dist > 0 ? 1 : -1;
    state.warpFlash = 18;
    pl.x = Math.max(100, pl.x + dist);
    state.camX = Math.max(0, pl.x - VW * 0.3);
    pl.onWarpPipe = null;
    const lc = Math.max(0, Math.floor(pl.x / CHUNK) - 1);
    const rc = Math.ceil((pl.x + VW + CHUNK) / CHUNK);
    for (let ci = lc; ci <= rc; ci++) genChunk(ci);
    return;
  }

  // Hitbox (exact visual bounds, no inset)
  const hbLeft = pl.x - PL_W / 2;
  const hbTop  = pl.py - h;
  const hbW    = PL_W;
  const hbH    = h;

  // ── Live nehézség skála (pl.x alapján, sosem áll meg) ──────────
  // 0-nál 1.0x, ~10 000 design unit (~500m) után 2.0x madár sebesség
  const liveDiff = 1 + Math.min(1, pl.x / 10000);

  // ── Enemies (birds, crawlers, bees) ───────────────────────────
  if (pl.invincible > 0) pl.invincible--;

  for (let bi = birds.length - 1; bi >= 0; bi--) {
    const b = birds[bi];

    if (b.dead) {
      b.deathVy += 0.5;
      b.y       += b.deathVy;
      b.angle   += 0.18;
      if (b.y > GROUND_TOP + 250) birds.splice(bi, 1);
      continue;
    }

    // Típus-specifikus mozgás
    if (b.type === 'spider') {
      b.phase += b.spd;
      b.y = b.baseY + (Math.sin(b.phase) * 0.5 + 0.5) * b.dropRange;
    } else if (b.type === 'bee') {
      b.phase  += 0.065;
      b.y = b.baseY + Math.sin(b.phase) * 26 + Math.sin(b.phase * 1.7 + b.phase2) * 10;
      b.x += b.vx * liveDiff;
      if (b.x < b.ox - b.range || b.x > b.ox + b.range) b.vx *= -1;
    } else {
      b.x += b.vx * liveDiff;
      if (b.x < b.ox - b.range || b.x > b.ox + b.range) b.vx *= -1;
    }

    // Méretek típus szerint
    const ew = enemyW(b);
    const eh = enemyH(b);

    // Stomp: játékos esik, lába érinti az ellenség tetejét
    const eTop    = b.y + 2;
    const stomped = pl.vy > 0 &&
      prevPY       <= eTop + 6 &&
      pl.py        >= eTop &&
      hbLeft        < b.x + ew - 3 &&
      hbLeft + hbW  > b.x + 3;

    if (stomped) {
      if (b.type === 'crawler') {
        // Tüske tetején — játékos sebződik, nem az ellenség
        pl.lives--;
        pl.invincible = 100;
        pl.vy = JUMP_VEL * 0.55;
        if (pl.lives <= 0) { die(); return; }
        pl.comboPopup = { text: `🦔 ${pl.lives} élet maradt`, x: pl.x, y: pl.py - PL_H - 24, life: 70 };
      } else {
        killBird(b, b.vx > 0 ? 0.5 : -0.5);
        pl.vy = JUMP_VEL * 0.65;
        pl.onGround = false; pl.jumpsLeft = 2;
        awardBirdKill(pl);
      }
      continue;
    }

    // Normál ütközés → élet vesztés
    if (pl.invincible <= 0 &&
        overlap(hbLeft, hbTop, hbW, hbH, b.x + 2, b.y + 2, ew - 4, eh - 4)) {
      pl.lives--;
      pl.invincible = 100;
      pl.vy = JUMP_VEL * 0.45;
      if (pl.lives <= 0) { die(); return; }
      pl.comboPopup = { text: `❤️ ${pl.lives} élet maradt`, x: pl.x, y: pl.py - PL_H - 24, life: 70 };
    }
  }

  // ── Bullets ────────────────────────────────────────────────────
  if (pl.shootCooldown > 0) pl.shootCooldown--;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const blt = bullets[i];
    blt.x += blt.vx;
    if (blt.x < state.camX - 60 || blt.x > state.camX + VW + 60) {
      bullets.splice(i, 1); continue;
    }
    let hit = false;
    for (const b of birds) {
      if (b.dead) continue;
      const ew = enemyW(b);
      const eh = enemyH(b);
      const bltHit = blt.x > b.x && blt.x < b.x + ew
                  && blt.y > b.y && blt.y < b.y + eh;
      if (bltHit) {
        killBird(b, blt.vx * 0.08);
        awardBirdKill(pl);
        hit = true; break;
      }
    }
    if (hit) bullets.splice(i, 1);
  }

  // ── Combo timer ────────────────────────────────────────────────
  if (pl.comboTimer > 0) pl.comboTimer--;
  else pl.coinCombo = 0;

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
      state.score += pts;
      if (pl.coinCombo >= 3) {
        pl.comboPopup = { text: `x${pl.coinCombo} COMBO! +${pts}`, x: pl.x, y: pl.py - PL_H - 20, life: 50 };
      }
    }
  }

  // ── Camera ─────────────────────────────────────────────────────
  state.camX = Math.max(0, pl.x - VW * 0.3);
}

// ── Enemy size helper ───────────────────────────────────────────────
export function enemyW(b) {
  if (b.type === 'crawler') return CRAWLER_W;
  if (b.type === 'bee')     return BEE_W;
  if (b.type === 'spider')  return SPIDER_W;
  return BIRD_W;
}
export function enemyH(b) {
  if (b.type === 'crawler') return CRAWLER_H;
  if (b.type === 'bee')     return BEE_H;
  if (b.type === 'spider')  return SPIDER_H;
  return BIRD_H;
}

// ── Death fall animation ────────────────────────────────────────────
function updateDying() {
  const pl = state.pl;
  pl.vy = Math.min(pl.vy + GRAVITY, MAX_FALL);
  pl.py += pl.vy;
  pl.deathAngle += (pl.facing * Math.PI / 2 - pl.deathAngle) * 0.1;
  if (pl.py >= GROUND_TOP) {
    pl.py = GROUND_TOP;
    pl.vy = 0;
    pl.deathAngle = pl.facing * Math.PI / 2;
    pl.deathTimer++;
    if (pl.deathTimer > 80) state.phase = 'dead';
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function killBird(b, driftVx) {
  b.dead    = true;
  b.deathVy = 1.5;
  b.vx      = driftVx;
}

function awardBirdKill(pl) {
  pl.birdsKilled++;
  state.score += 150;
  if (pl.birdsKilled % 5 === 0) {
    pl.lives++;
    pl.comboPopup = { text: `+1 ÉLET! ❤️ (${pl.lives})`, x: pl.x, y: pl.py - PL_H - 24, life: 90 };
  } else {
    pl.comboPopup = { text: `+150! 💀 (${pl.birdsKilled} madár)`, x: pl.x, y: pl.py - PL_H - 24, life: 55 };
  }
}
