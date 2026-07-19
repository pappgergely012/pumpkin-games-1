import { GROUND_TOP } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// MUTABLE GAME STATE
// Single object so all modules share the same reference.
// ═══════════════════════════════════════════════════════════════════
export const state = {
  phase:    'start',   // 'start' | 'play' | 'dying' | 'dead'
  score:    0,
  bestScore: parseInt(localStorage.getItem('pumpkin_best') || '0'),
  camX:     0,
  worldSeed: 0,
  warpFlash: 0,   // frames left for warp freeze/flash
  warpDir:   0,   // +1 forward (for flash colour)

  pl:        null,
  pipes:     [],
  platforms: [],
  birds:     [],
  coins:     [],
  bullets:   [],
  generatedChunks: new Set(),
};

// ═══════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════
export function startGame() {
  state.worldSeed       = (Math.random() * 1e9) | 0;
  state.score           = 0;
  state.camX            = 0;
  state.warpFlash       = 0;
  state.pipes           = [];
  state.platforms       = [];
  state.birds           = [];
  state.coins           = [];
  state.bullets         = [];
  state.generatedChunks = new Set();

  state.pl = {
    x:             150,
    py:            GROUND_TOP,
    vy:            0,
    onGround:      true,
    crouching:     false,
    facing:        1,
    legPhase:      0,
    jumpsLeft:     2,
    onWarpPipe:    null,
    coinCombo:     0,
    comboTimer:    0,
    comboPopup:    null,
    lives:         3,
    birdsKilled:   0,
    invincible:    0,
    shootCooldown: 0,
  };

  state.phase = 'play';
}

export function die() {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('pumpkin_best', state.bestScore);
  }
  state.pl.deathAngle = 0;
  state.pl.deathTimer = 0;
  state.phase = 'dying';
}
