import {
  GROUND_TOP, CHUNK, PIPE_W, COIN_R,
  BIRD_W, CRAWLER_W, CRAWLER_H, BEE_W, BEE_H, SPIDER_W, SPIDER_H, PLAT_H,
  MIN_PLAT_GAP,
} from '../core/constants.js';
import { state } from '../core/state.js';

// ═══════════════════════════════════════════════════════════════════
// SEEDED RNG  (XOR-shift, deterministic per chunk)
// ═══════════════════════════════════════════════════════════════════
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// ═══════════════════════════════════════════════════════════════════
// PLACEMENT HELPERS
// ═══════════════════════════════════════════════════════════════════
const PIPE_PLAT_GAP  = 50;  // platform ↔ cső minimális vízszintes távolság
const PIPE_COIN_GAP  = 40;  // talaj coin ↔ cső széle minimális távolság
const PLAT_COIN_GAP  = 35;  // talaj coin ↔ platform széle minimális távolság

function platformFits(px, pw) {
  for (const p of state.platforms) {
    if (px < p.x + p.w + MIN_PLAT_GAP && px + pw > p.x - MIN_PLAT_GAP) return false;
  }
  for (const pipe of state.pipes) {
    if (px < pipe.x + PIPE_W + PIPE_PLAT_GAP && px + pw > pipe.x - PIPE_PLAT_GAP) return false;
  }
  return true;
}

// Talaj coin nem kerülhet cső vagy platform közelébe
function groundCoinClear(cx) {
  for (const pipe of state.pipes) {
    if (cx + COIN_R > pipe.x - PIPE_COIN_GAP &&
        cx - COIN_R < pipe.x + PIPE_W + PIPE_COIN_GAP) return false;
  }
  for (const p of state.platforms) {
    if (cx + COIN_R > p.x - PLAT_COIN_GAP &&
        cx - COIN_R < p.x + p.w + PLAT_COIN_GAP) return false;
  }
  return true;
}

// Nem lehet cső belsejében
function coinFits(cx, cy) {
  for (const pipe of state.pipes) {
    const pipeTop = GROUND_TOP - pipe.h;
    const inX = cx + COIN_R > pipe.x - 4 && cx - COIN_R < pipe.x + PIPE_W + 4;
    const inY = cy + COIN_R > pipeTop    && cy - COIN_R < GROUND_TOP;
    if (inX && inY) return false;
  }
  return true;
}

// Nem fedhet át más coinnal (min. 2*COIN_R + 2px távolság)
function coinOverlaps(cx, cy) {
  const minD = COIN_R * 2 + 2;
  for (const c of state.coins) {
    if (Math.abs(c.x - cx) < minD && Math.abs(c.y - cy) < minD) return true;
  }
  return false;
}

// Coin lerakása ha nincs ütközés
function placeCoin(cx, cy) {
  if (coinFits(cx, cy) && !coinOverlaps(cx, cy))
    state.coins.push({ x: cx, y: cy, done: false });
}

// ═══════════════════════════════════════════════════════════════════
// CHUNK GENERATION
// Each chunk is generated once per world seed (idempotent).
// ═══════════════════════════════════════════════════════════════════
export function genChunk(ci) {
  if (state.generatedChunks.has(ci)) return;
  state.generatedChunks.add(ci);

  const rng = makeRng(state.worldSeed * 997 + ci * 100003);
  const ox  = ci * CHUNK;

  // Chunk 0: safe starter coins only (talaj szinten, nem fednek át)
  if (ci === 0) {
    const groundCoinY = GROUND_TOP - COIN_R - 4;
    const SPACING = COIN_R * 2 + 4;
    for (let i = 0; i < 5; i++)
      placeCoin(ox + 260 + i * SPACING, groundCoinY);
    return;
  }

  // diff: 0→2 az első 40 chunkban, sosem áll meg — minél messzebb, annál nehezebb
  const diff = Math.min(2, ci / 20);

  // ── Pipes ──────────────────────────────────────────────────────
  const numPipes = ci < 5 ? 1 : (rng() < 0.35 + diff * 0.15 ? 2 : 1);
  for (let i = 0; i < numPipes; i++) {
    const lo = ox + 100 + i * 280;
    const hi = ox + CHUNK - 140 - (numPipes - 1 - i) * 220;
    if (lo >= hi) continue;

    const px       = lo + rng() * (hi - lo);
    const minH     = 45 + diff * 45;
    const maxH     = minH + 30 + diff * 70;
    const ph       = minH + rng() * (maxH - minH);
    const isWarp   = ci >= 2 && rng() < 0.25;
    const warpDist = isWarp ? (300 + rng() * 300) : 0;

    state.pipes.push({ x: px, h: ph, warp: isWarp, warpDist });

    // 1 coin a cső tetején (középre)
    placeCoin(px + PIPE_W / 2, GROUND_TOP - ph - COIN_R - 2);

    // Ha dupla ugrással sem érhető el a cső teteje (~237 egység max),
    // kötelező segítő platform az oldalán
    if (ph > 237) {
      const helpW = 100 + rng() * 60;
      const helpY = GROUND_TOP - 90; // layer 0 — talajról elérhető, onnan a cső is
      for (const side of [1, -1]) {
        const helpX = side > 0
          ? px + PIPE_W + PIPE_PLAT_GAP + 5
          : px - helpW - PIPE_PLAT_GAP - 5;
        if (platformFits(helpX, helpW)) {
          state.platforms.push({ x: helpX, y: helpY, w: helpW });
          break;
        }
      }
    }
  }

  // ── Platforms  (max 3 rögzített magassági réteg) ───────────────
  // Layer 0 = közel a talajhoz, Layer 2 = magasan
  const PLAT_LAYERS = [
    GROUND_TOP - 90,   // layer 0 — alacsony
    GROUND_TOP - 175,  // layer 1 — közepes
    GROUND_TOP - 260,  // layer 2 — magas
  ];
  // Korai chunkokon csak az alsó réteg(ek) érhetők el
  const maxLayer = diff < 0.3 ? 1 : diff < 0.7 ? 2 : 3;

  const numPlat = Math.floor(rng() * 3) + 1;
  for (let i = 0; i < numPlat; i++) {
    let px, pw, py, tries = 0;
    const layer = Math.floor(rng() * maxLayer);
    do {
      pw = 110 + rng() * 80 - diff * 20;
      px = ox + rng() * (CHUNK - pw);
      py = PLAT_LAYERS[layer];
      tries++;
    } while (!platformFits(px, pw) && tries < 10);

    if (tries >= 10) continue;
    state.platforms.push({ x: px, y: py, w: pw });

    // Sor of coins ON the platform (2-5 db, egyenletesen elosztva)
    if (rng() > 0.45) {
      const SPACING = COIN_R * 2 + 4; // 24px — garantáltan nem fednek át
      const count   = Math.min(5, Math.floor(rng() * 4) + 2); // 2-5
      const totalW  = (count - 1) * SPACING;
      const startX  = px + (pw - totalW) / 2; // platorm közepére centrálva
      const coinY   = py - COIN_R - 6;
      for (let j = 0; j < count; j++) placeCoin(startX + j * SPACING, coinY);
    }
  }

  // ── Birds (chunk 4+, rikulnak ahogy nő a diff) ─────────────────
  // 70% eséllyel spawnak korán, de diff=2-nél már csak 10% körül
  const birdChance = Math.max(0.1, 0.75 - diff * 0.3);
  if (ci >= 4 && rng() < birdChance) {
    const numBirds = ci > 10 && rng() > 0.7 ? 2 : 1;
    for (let i = 0; i < numBirds; i++) {
      const bx  = ox + rng() * (CHUNK - BIRD_W);
      const by  = GROUND_TOP - 90 - rng() * 150;
      const spd = 0.6 + diff * 0.9 + rng() * 0.5;
      state.birds.push({
        type: 'bird',
        x: bx, y: by,
        vx: rng() > 0.5 ? spd : -spd,
        ox: bx, range: 80 + rng() * 180,
        dead: false, deathVy: 0, angle: 0,
      });
    }
  }

  // ── Crawlers (chunk 8+, diff >= 0.8) — tüskés talaj-járó ──────
  if (ci >= 8 && diff >= 0.8 && rng() < Math.min(0.75, diff * 0.35)) {
    const bx  = ox + rng() * (CHUNK - CRAWLER_W);
    const spd = 0.7 + diff * 0.5 + rng() * 0.4;
    state.birds.push({
      type: 'crawler',
      x: bx, y: GROUND_TOP - CRAWLER_H,
      vx: rng() > 0.5 ? spd : -spd,
      ox: bx, range: 120 + rng() * 200,
      dead: false, deathVy: 0, angle: 0,
    });
  }

  // ── Spiders (chunk 10+, diff >= 1.0) — ereszkedő pók ──────────
  // Fentről ereszkedik le fonálon, majd visszamászik. Ugorható + lőhető.
  if (ci >= 10 && diff >= 1.0 && rng() < Math.min(0.7, (diff - 1.0) * 0.5)) {
    const sx = ox + rng() * (CHUNK - SPIDER_W);

    // Rögzítési pont: közeli platform alja, vagy a mennyezet (y=0)
    let baseY = 0;
    for (const p of state.platforms) {
      if (sx + SPIDER_W > p.x - 20 && sx < p.x + p.w + 20) {
        baseY = p.y + PLAT_H;
        break;
      }
    }

    const maxDrop   = GROUND_TOP - baseY - SPIDER_H - 15;
    const dropRange = Math.min(maxDrop, 110 + rng() * 140);
    const spd       = 0.018 + diff * 0.006 + rng() * 0.008;
    state.birds.push({
      type:      'spider',
      x:         sx,
      y:         baseY,
      baseY,
      dropRange,
      phase:     rng() * Math.PI * 2,
      spd,
      dead: false, deathVy: 0, angle: 0,
    });
  }

  // ── Bees (chunk 14+, diff >= 1.2) — komplex repülő ───────────
  if (ci >= 14 && diff >= 1.2 && rng() < Math.min(0.7, (diff - 1.2) * 0.45)) {
    const bx  = ox + rng() * (CHUNK - BEE_W);
    const by  = GROUND_TOP - 110 - rng() * 120;
    const spd = 1.2 + diff * 0.4 + rng() * 0.5;
    state.birds.push({
      type:   'bee',
      x:      bx, y: by,
      vx:     rng() > 0.5 ? spd : -spd,
      ox:     bx, range: 120 + rng() * 160,
      baseY:  by,
      phase:  rng() * Math.PI * 2,
      phase2: rng() * Math.PI * 2, // másodlagos oszcilláció fázisa
      dead: false, deathVy: 0, angle: 0,
    });
  }

  // ── Talaj coin csoportok ───────────────────────────────────────
  // Csak a talajon lebegő coinok — magasabb coinok csak platformon lehetnek.
  const groundY   = GROUND_TOP - COIN_R - 4;
  const SPACING   = COIN_R * 2 + 4; // 24px — nem fednek át
  const numGroups = Math.floor(rng() * 2) + 2; // 2-3 csoport per chunk
  for (let g = 0; g < numGroups; g++) {
    const count  = Math.min(5, Math.floor(rng() * 4) + 2); // 2-5, max 5
    const startX = ox + 80 + rng() * (CHUNK - 220);
    for (let j = 0; j < count; j++) {
      const cx = startX + j * SPACING;
      if (groundCoinClear(cx)) placeCoin(cx, groundY);
    }
  }
}
