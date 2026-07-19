import {
  W, H, S, VW,
  GROUND_TOP, PIPE_W, PLAT_H, COIN_R, BIRD_W, BIRD_H, CRAWLER_W, CRAWLER_H, BEE_W, BEE_H, SPIDER_W, SPIDER_H,
  PL_W, PL_H, PL_CROUCH_H, SHOOT_CD,
  STARS, isMobile,
  JOY_R, JOY_X, JOY_Y, BTN_J, BTN_D, BTN_S,
} from '../core/constants.js';
import { ctx } from '../core/canvas.js';
import { state } from '../core/state.js';
import { CTRL, isLeft, isRight } from '../logic/input.js';
import { enemyW } from '../logic/physics.js';

// ═══════════════════════════════════════════════════════════════════
// DRAW PRIMITIVES
// ═══════════════════════════════════════════════════════════════════
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);           ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,  x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,  x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,      x + r, y);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════
// WORLD OBJECTS
// ═══════════════════════════════════════════════════════════════════
function drawPipe(pipe, t, sx) {
  const top = GROUND_TOP - pipe.h;
  if (pipe.warp) {
    const pulse = 0.6 + Math.sin(t * 4 + pipe.x * 0.01) * 0.4;
    const col   = `rgba(230,${Math.round(100 * pulse)},0,1)`;
    ctx.fillStyle = '#7f2000';
    ctx.fillRect(sx + 6, top + 22, PIPE_W - 12, pipe.h - 22);
    ctx.fillStyle = col;
    ctx.fillRect(sx, top, PIPE_W, 24);
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(sx + 8, top + 2, 7, pipe.h - 4);
    ctx.fillRect(sx + 2, top + 4, 4, 16);
    if (state.pl && state.pl.onWarpPipe === pipe) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('▼ S', sx + PIPE_W / 2, top - 6);
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(sx + 6, top + 22, PIPE_W - 12, pipe.h - 22);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(sx, top, PIPE_W, 24);
    ctx.fillStyle = '#43A047';
    ctx.fillRect(sx + 8, top + 2, 7, pipe.h - 4);
    ctx.fillRect(sx + 2, top + 4, 4, 16);
  }
}

// Halott ellenség közös rajzolás (szürke, forog, X-szem)
function drawDeadEnemy(b, w, h) {
  ctx.rotate(b.angle);
  ctx.globalAlpha = Math.max(0, 1 - b.deathVy / 18);
  ctx.fillStyle = '#555'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(w / 2 - 10, -4, 7, 6);
  ctx.fillStyle = '#f00';
  ctx.fillRect(w / 2 - 9, -3, 2, 2); ctx.fillRect(w / 2 - 5, -3, 2, 2);
  ctx.fillRect(w / 2 - 7, -1, 2, 2);
  ctx.fillRect(w / 2 - 9,  1, 2, 2); ctx.fillRect(w / 2 - 5,  1, 2, 2);
  ctx.globalAlpha = 1;
}

function drawEnemy(b, t, sx) {
  if (b.type === 'crawler') {
    const cx = sx + CRAWLER_W / 2, cy = b.y + CRAWLER_H / 2;
    ctx.save(); ctx.translate(cx, cy);
    if (b.dead) {
      drawDeadEnemy(b, CRAWLER_W, CRAWLER_H);
    } else {
      if (b.vx < 0) ctx.scale(-1, 1);
      // test (lila gömb)
      ctx.fillStyle = '#6A1B9A';
      ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); ctx.fill();
      // tüskék felül (nem lehet rá ugrani)
      ctx.fillStyle = '#4A148C';
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 5 - 2, -13, 4, 9);
      }
      // fény
      ctx.fillStyle = '#AB47BC';
      ctx.beginPath(); ctx.arc(-3, -1, 4, 0, Math.PI * 2); ctx.fill();
      // szemek
      ctx.fillStyle = '#E040FB';
      ctx.fillRect(4, -1, 4, 4); ctx.fillRect(-2, 4, 10, 3);
    }
    ctx.restore();

  } else if (b.type === 'bee') {
    const cx = sx + BEE_W / 2, cy = b.y + BEE_H / 2;
    ctx.save(); ctx.translate(cx, cy);
    if (b.dead) {
      drawDeadEnemy(b, BEE_W, BEE_H);
    } else {
      const wing = Math.sin(t * 14 + b.ox * 0.01) * 0.5;
      if (b.vx < 0) ctx.scale(-1, 1);
      // szárnyak
      ctx.save(); ctx.translate(-4, -5); ctx.rotate(-wing);
      ctx.fillStyle = 'rgba(190,230,255,0.75)';
      ctx.fillRect(-10, -5, 20, 9);
      ctx.restore();
      ctx.save(); ctx.translate(-4, 5); ctx.rotate(wing);
      ctx.fillStyle = 'rgba(190,230,255,0.6)';
      ctx.fillRect(-10, -4, 20, 8);
      ctx.restore();
      // test
      ctx.fillStyle = '#FFD600'; ctx.fillRect(-13, -7, 26, 14);
      // csíkok
      ctx.fillStyle = '#212121';
      ctx.fillRect(-5, -7, 5, 14);
      ctx.fillRect(4,  -7, 5, 14);
      // fullánk
      ctx.fillStyle = '#FF6F00'; ctx.fillRect(11, -2, 6, 4);
      // szem
      ctx.fillStyle = '#111'; ctx.fillRect(6, -4, 5, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(7, -3, 2, 2);
    }
    ctx.restore();

  } else if (b.type === 'spider') {
    const cx = sx + SPIDER_W / 2;
    // Fonál (cérna a mennyezetről)
    ctx.save();
    ctx.strokeStyle = 'rgba(200,200,200,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, b.baseY); ctx.lineTo(cx, b.y + SPIDER_H / 2); ctx.stroke();
    ctx.restore();

    ctx.save(); ctx.translate(cx, b.y + SPIDER_H / 2);
    if (b.dead) {
      drawDeadEnemy(b, SPIDER_W, SPIDER_H);
    } else {
      // Lábak (4 pár)
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      const legAngles = [-0.9, -0.5, 0.5, 0.9];
      for (const ang of legAngles) {
        // bal lábak
        ctx.beginPath(); ctx.moveTo(-4, 0);
        ctx.lineTo(-4 - Math.cos(ang) * 9, Math.sin(Math.abs(ang)) * 6);
        ctx.lineTo(-4 - Math.cos(ang) * 14, Math.sin(Math.abs(ang)) * 3 + 2);
        ctx.stroke();
        // jobb lábak
        ctx.beginPath(); ctx.moveTo(4, 0);
        ctx.lineTo(4 + Math.cos(ang) * 9, Math.sin(Math.abs(ang)) * 6);
        ctx.lineTo(4 + Math.cos(ang) * 14, Math.sin(Math.abs(ang)) * 3 + 2);
        ctx.stroke();
      }
      // Test
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      // Fényvisszaverés
      ctx.fillStyle = '#2d2d5e';
      ctx.beginPath(); ctx.arc(-2, -3, 4, 0, Math.PI * 2); ctx.fill();
      // Szemek
      ctx.fillStyle = '#e53935';
      ctx.fillRect(-5, -5, 3, 3); ctx.fillRect(-1, -5, 3, 3);
      ctx.fillRect( 3, -5, 3, 3);
    }
    ctx.restore();

  } else {
    // Bird (eredeti)
    ctx.save();
    ctx.translate(sx + BIRD_W / 2, b.y + BIRD_H / 2);
    if (b.dead) {
      ctx.rotate(b.angle);
      ctx.globalAlpha = Math.max(0, 1 - b.deathVy / 18);
      ctx.fillStyle = '#555'; ctx.fillRect(-14, -6, 28, 16);
      ctx.fillStyle = '#333'; ctx.fillRect(-14, 6, 10, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(8, -4, 7, 6);
      ctx.fillStyle = '#f00';
      ctx.fillRect(9, -3, 2, 2); ctx.fillRect(13, -3, 2, 2);
      ctx.fillRect(11, -1, 2, 2);
      ctx.fillRect(9,  1, 2, 2); ctx.fillRect(13, 1, 2, 2);
      ctx.globalAlpha = 1;
    } else {
      const wing = Math.sin(t * 9 + b.ox * 0.01) * 0.45;
      if (b.vx < 0) ctx.scale(-1, 1);
      ctx.fillStyle = '#C62828'; ctx.fillRect(-14, -6, 28, 16);
      ctx.save();
      ctx.translate(0, -5); ctx.rotate(-wing);
      ctx.fillStyle = '#B71C1C'; ctx.fillRect(-16, -7, 32, 8);
      ctx.restore();
      ctx.fillStyle = '#B71C1C'; ctx.fillRect(-14, 6, 10, 6);
      ctx.fillStyle = '#fff';    ctx.fillRect(8, -4, 7, 6);
      ctx.fillStyle = '#111';    ctx.fillRect(11, -3, 4, 4);
      ctx.fillStyle = '#FF8F00'; ctx.fillRect(14, 1, 9, 5);
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
// PLAYER
// ═══════════════════════════════════════════════════════════════════
function drawPlayer(cam) {
  const pl    = state.pl;
  const dying = state.phase === 'dying' || state.phase === 'dead';
  if (!dying && pl.invincible > 0 && Math.floor(pl.invincible / 5) % 2 === 0) return;

  const h      = pl.crouching ? PL_CROUCH_H : PL_H;
  const top    = pl.py - h;
  const inAir  = !pl.onGround;
  const moving = isLeft() || isRight();
  const screenX = pl.x - cam;

  ctx.save();
  if (dying) {
    ctx.translate(screenX, pl.py);
    ctx.rotate(pl.deathAngle ?? 0);
    ctx.translate(-screenX, -pl.py);
  }
  ctx.translate(screenX, top);
  ctx.scale(pl.facing, 1);

  let scY = 1;
  if (inAir) scY = pl.vy < 0 ? 1.12 : 0.94;
  ctx.scale(1, scY);
  const dh = h / scY;

  const legW = 10, legH = 16, shoeW = 14, shoeH = 5;

  // Legs
  if (pl.crouching) {
    ctx.fillStyle = '#1B5E20'; ctx.fillRect(-PL_W / 2 + 2, dh - 10, 24, 10);
    ctx.fillStyle = '#212121'; ctx.fillRect(-PL_W / 2, dh - 4, 26, 4);
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
    ctx.fillRect(-PL_W / 2 + 2,  dh - legH + sw, legW, legH - sw);
    ctx.fillRect( PL_W / 2 - 12, dh - legH - sw, legW, legH + sw);
    ctx.fillStyle = '#212121';
    ctx.fillRect(-PL_W / 2,      dh - shoeH, shoeW, shoeH);
    ctx.fillRect( PL_W / 2 - 14, dh - shoeH, shoeW, shoeH);
  }

  // Body
  const bodyTop = pl.crouching ? dh * 0.35 : dh * 0.38;
  ctx.fillStyle = '#1565C0';
  ctx.fillRect(-PL_W / 2, bodyTop, PL_W, dh - bodyTop - (pl.crouching ? 8 : 16));
  ctx.fillStyle = '#FFD600';
  ctx.fillRect(-PL_W / 2 + 4, bodyTop + 2, 4, 3);
  ctx.fillRect( PL_W / 2 - 8, bodyTop + 2, 4, 3);

  // Arms + gun
  if (!pl.crouching) {
    const as = moving ? -Math.sin(pl.legPhase) * 6 : 0;
    ctx.fillStyle = '#1565C0';
    ctx.fillRect( PL_W / 2 - 2, bodyTop + 2 + as, 6, 12);
    ctx.fillRect(-PL_W / 2 - 4, bodyTop + 2 - as, 6, 12);
    ctx.fillStyle = '#FFCC80';
    ctx.fillRect( PL_W / 2 - 2, bodyTop + 14 + as, 6, 5);
    ctx.fillRect(-PL_W / 2 - 4, bodyTop + 14 - as, 6, 5);

    const gy = bodyTop + 14 + as;
    ctx.fillStyle = '#333'; ctx.fillRect(PL_W / 2 + 4,  gy,     14, 6); // barrel
    ctx.fillStyle = '#555'; ctx.fillRect(PL_W / 2 + 4,  gy + 1,  3, 4); // highlight
    ctx.fillStyle = '#222'; ctx.fillRect(PL_W / 2 + 16, gy + 1,  4, 4); // muzzle
    ctx.fillStyle = '#5D4037'; ctx.fillRect(PL_W / 2 + 5, gy + 5, 8, 5); // handle

    if (pl.shootCooldown > SHOOT_CD - 4) {
      ctx.fillStyle = '#FFD600';
      ctx.beginPath(); ctx.arc(PL_W / 2 + 22, gy + 3, 5,   0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FF6D00';
      ctx.beginPath(); ctx.arc(PL_W / 2 + 22, gy + 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Head
  const headTop = bodyTop - 22;
  ctx.fillStyle = '#FFCC80'; ctx.fillRect(-PL_W / 2 + 3, headTop, PL_W - 6, 22);
  ctx.fillStyle = '#E53935';
  ctx.fillRect(-PL_W / 2 - 2, headTop + 2, PL_W + 4, 4);
  ctx.fillRect(-PL_W / 2 + 1, headTop - 8, PL_W - 2, 12);
  ctx.fillStyle = '#111';    ctx.fillRect(4, headTop + 6, 5, 5);
  ctx.fillStyle = '#5D4037'; ctx.fillRect(-5, headTop + 13, 17, 4);
  ctx.fillStyle = '#FFCC80'; ctx.fillRect(-PL_W / 2 + 1, headTop + 5, 4, 7);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════════════
function drawHUD() {
  const { score, bestScore, pl } = state;
  const dist = Math.max(0, Math.floor((pl.x - 150) / 20));

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(10, 10, 200, 90, 8); ctx.fill();
  ctx.fillStyle = '#FFD600'; ctx.font = 'bold 20px monospace';
  ctx.fillText(`PONTOK: ${score}`, 22, 36);
  ctx.fillStyle = '#90CAF9'; ctx.font = '14px monospace';
  ctx.fillText(`LEGJOBB: ${bestScore}`, 22, 56);
  ctx.fillStyle = '#A5D6A7';
  ctx.fillText(`TÁVOLSÁG: ${dist}m`, 22, 72);
  ctx.font = '16px monospace';
  ctx.fillText('❤️'.repeat(Math.max(0, pl.lives)) || '💀', 22, 92);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(10, 104, 160, 22, 6); ctx.fill();
  ctx.fillStyle = '#FF9800'; ctx.fillRect(18, 111, 12, 12);
  ctx.fillStyle = '#ddd'; ctx.font = '11px monospace';
  ctx.fillText('= előre warp (S)', 34, 122);
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE CONTROLS
// ═══════════════════════════════════════════════════════════════════
function drawMobileControls() {
  if (!isMobile) return;
  const pl = state.pl;
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.textAlign = 'center';

  // Joystick
  const jcx = CTRL.joyOn ? CTRL.joyCX : JOY_X;
  const jcy = CTRL.joyOn ? CTRL.joyCY : JOY_Y;
  ctx.globalAlpha = CTRL.joyOn ? 0.55 : 0.22;
  ctx.fillStyle   = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(jcx, jcy, JOY_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const kx = jcx + Math.max(-JOY_R + 16, Math.min(JOY_R - 16, CTRL.joyDx));
  ctx.globalAlpha = CTRL.joyOn ? 0.8 : 0.3;
  ctx.fillStyle   = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(kx, jcy, 18, 0, Math.PI * 2); ctx.fill();
  if (!CTRL.joyOn) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('◀  ▶', jcx, jcy + 6);
  }

  // Jump
  const jp = CTRL.jumpId !== null;
  ctx.globalAlpha = jp ? 0.85 : 0.4;
  ctx.fillStyle   = jp ? 'rgba(80,190,255,0.6)' : 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(80,190,255,0.85)';
  ctx.beginPath(); ctx.arc(BTN_J.x, BTN_J.y, BTN_J.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
  ctx.fillText('▲', BTN_J.x, BTN_J.y + 7);

  // Down
  const dp = CTRL.downId !== null;
  ctx.globalAlpha = dp ? 0.85 : 0.38;
  ctx.fillStyle   = dp ? 'rgba(255,210,80,0.6)' : 'rgba(255,255,255,0.1)';
  ctx.strokeStyle = 'rgba(255,210,80,0.8)';
  ctx.lineWidth   = 2.5;
  ctx.beginPath(); ctx.arc(BTN_D.x, BTN_D.y, BTN_D.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
  ctx.fillText('▼', BTN_D.x, BTN_D.y + 7);

  // Shoot
  const sp = CTRL.shootId !== null || (pl && pl.shootCooldown > SHOOT_CD - 4);
  ctx.globalAlpha = sp ? 0.9 : 0.45;
  ctx.fillStyle   = sp ? 'rgba(255,120,0,0.7)' : 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = sp ? 'rgba(255,200,0,0.9)' : 'rgba(255,150,0,0.7)';
  ctx.lineWidth   = 2.5;
  ctx.beginPath(); ctx.arc(BTN_S.x, BTN_S.y, BTN_S.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
  ctx.fillText('🔫', BTN_S.x, BTN_S.y + 8);

  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// OVERLAYS
// ═══════════════════════════════════════════════════════════════════
function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, VW, 450);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF7043'; ctx.font = 'bold 54px monospace';
  ctx.shadowColor = '#FF7043'; ctx.shadowBlur = 18;
  ctx.fillText(title, VW / 2, 225 - 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ECEFF1'; ctx.font = '20px monospace';
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 225 - 10 + i * 30));
  ctx.textAlign = 'left';
}

export function drawPortraitWarning() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
  const fs = Math.round(W * 0.12);
  ctx.textAlign = 'center';
  ctx.font = `${fs}px monospace`;
  ctx.fillStyle = '#FFD600'; ctx.fillText('📱', W / 2, H / 2 - fs * 1.5);
  ctx.font = `bold ${Math.round(W * 0.055)}px monospace`;
  ctx.fillStyle = '#fff'; ctx.fillText('Forgasd el a képernyőt!', W / 2, H / 2);
  ctx.font = `${Math.round(W * 0.04)}px monospace`;
  ctx.fillStyle = '#aaa'; ctx.fillText('Please rotate your device', W / 2, H / 2 + fs * 0.9);
  ctx.textAlign = 'left';
}

// ═══════════════════════════════════════════════════════════════════
// MAIN DRAW  — called each frame
// ═══════════════════════════════════════════════════════════════════
export function draw(t) {
  const { phase, score, bestScore, camX, warpFlash, warpDir,
          pl, pipes, platforms, birds, coins, bullets } = state;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(S, S);
  ctx.beginPath(); ctx.rect(0, 0, VW, 450); ctx.clip(); // prevent overflow

  // ── Sky ──────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
  sky.addColorStop(0, '#0d0d3b'); sky.addColorStop(1, '#1a6ea8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, GROUND_TOP);

  for (const s of STARS) {
    ctx.globalAlpha = 0.4 + Math.sin(t * 1.2 + s.x * 0.05) * 0.3;
    ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2);
  }
  ctx.globalAlpha = 1;

  // ── Ground ───────────────────────────────────────────────────
  ctx.fillStyle = '#3e2a1a'; ctx.fillRect(0, GROUND_TOP, VW, 450 - GROUND_TOP);
  ctx.fillStyle = '#558B2F'; ctx.fillRect(0, GROUND_TOP, VW, 14);
  ctx.fillStyle = '#33691E';
  for (let gx = -(Math.floor(camX) % 32); gx < VW; gx += 32)
    ctx.fillRect(gx, GROUND_TOP, 1, 14);

  // ── World (screen-relative, no GPU translate — float64 precision) ─
  const cam = Math.floor(camX);

  if (phase !== 'start') {
    // Platforms
    for (const p of platforms) {
      const sx = p.x - cam;
      if (sx + p.w < -10 || sx > VW + 10) continue;
      ctx.fillStyle = '#6D4C41'; ctx.fillRect(sx, p.y, p.w, PLAT_H);
      ctx.fillStyle = '#8D6E63'; ctx.fillRect(sx, p.y, p.w, 4);
      ctx.fillStyle = '#4E342E';
      for (let tx = 0; tx < p.w; tx += 18) ctx.fillRect(sx + tx, p.y, 1, PLAT_H);
    }

    // Pipes
    for (const pipe of pipes) {
      const sx = pipe.x - cam;
      if (sx + PIPE_W < -10 || sx > VW + 10) continue;
      drawPipe(pipe, t, sx);
    }

    // Coins
    for (const c of coins) {
      if (c.done) continue;
      const sx = c.x - cam;
      if (sx + COIN_R < -10 || sx - COIN_R > VW + 10) continue;
      const bob = Math.sin(t * 3 + c.x * 0.08) * 3;
      ctx.fillStyle = '#FFD600';
      ctx.beginPath(); ctx.arc(sx, c.y + bob, COIN_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFF8D';
      ctx.beginPath(); ctx.arc(sx - 2, c.y + bob - 3, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Bullets
    for (const blt of bullets) {
      const sx = blt.x - cam;
      if (sx < -20 || sx > VW + 20) continue;
      ctx.fillStyle = 'rgba(255,150,0,0.45)';
      ctx.fillRect(sx - blt.vx * 2, blt.y - 2, Math.abs(blt.vx) * 2, 4);
      ctx.fillStyle = '#FFD600';
      ctx.beginPath(); ctx.arc(sx, blt.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx - 1, blt.y - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // Enemies (bird / crawler / bee / spider)
    for (const b of birds) {
      const sx = b.x - cam;
      if (sx + enemyW(b) < -10 || sx > VW + 10) continue;
      drawEnemy(b, t, sx);
    }

    // Player
    drawPlayer(cam);

    // Combo popup
    if (pl.comboPopup) {
      const p = pl.comboPopup;
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.textAlign = 'center';
      ctx.font = `bold ${10 + pl.coinCombo}px monospace`;
      ctx.fillStyle = pl.coinCombo >= 6 ? '#FF6D00' : '#FFD600';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(p.text, p.x - cam, p.y);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  }

  // ── HUD ──────────────────────────────────────────────────────
  if (phase !== 'start') drawHUD();

  // ── Mobile controls ──────────────────────────────────────────
  drawMobileControls();

  // ── Start / Game Over overlay ─────────────────────────────────
  if (phase === 'start') {
    drawOverlay('PUMPKIN RUN', [
      'SPACE / ENTER  →  indítás',
      '',
      'W / ↑    →  ugrás (dupla ugrás!)',
      'A / D    →  mozgás',
      'SPACE    →  lövés 🔫',
      'S        →  guggolás / leesés / warp',
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

  // ── Warp flash ───────────────────────────────────────────────
  if (warpFlash > 0) {
    const alpha = warpFlash / 18;
    ctx.fillStyle = warpDir > 0
      ? `rgba(255,150,0,${alpha * 0.7})`
      : `rgba(160,0,255,${alpha * 0.7})`;
    ctx.fillRect(0, 0, VW, 450);
  }

  ctx.restore(); // end scale
}
