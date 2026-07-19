// ═══════════════════════════════════════════════════════════════════
// SCREEN & VIRTUAL RESOLUTION
// ═══════════════════════════════════════════════════════════════════
export const W  = window.innerWidth;
export const H  = window.innerHeight;
export const S  = H / 450;
export const VW = Math.round(W / S);

// ═══════════════════════════════════════════════════════════════════
// GAME CONSTANTS  (design units — 450px tall virtual space)
// ═══════════════════════════════════════════════════════════════════
export const GROUND_TOP   = 394;
export const GRAVITY      = 0.38;
export const MAX_FALL     = 15;
export const JUMP_VEL     = -9.5;
export const SPD          = 3.5;
export const PL_W         = 28;
export const PL_H         = 46;
export const PL_CROUCH_H  = 26;
export const PIPE_W       = 52;
export const COIN_R       = 10;
export const BIRD_W       = 38;
export const BIRD_H       = 26;
export const CRAWLER_W    = 28;
export const CRAWLER_H    = 22;
export const BEE_W        = 34;
export const BEE_H        = 22;
export const SPIDER_W     = 22;
export const SPIDER_H     = 22;
export const PLAT_H       = 14;
export const CHUNK        = 680;
export const MIN_PLAT_GAP = 80;
export const BULLET_SPD   = 12;
export const SHOOT_CD     = 18; // frames between shots

// 4 fixed coin height levels (design y, lower = higher on screen)
export const COIN_LEVELS = [
  GROUND_TOP - 55,   // 339 — near ground
  GROUND_TOP - 115,  // 279 — medium low
  GROUND_TOP - 185,  // 209 — medium high
  GROUND_TOP - 255,  // 139 — high
];

// ═══════════════════════════════════════════════════════════════════
// MOBILE / TOUCH
// ═══════════════════════════════════════════════════════════════════
export const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export const JOY_R    = 50;          // joystick outer radius
export const JOY_X    = 80;          // joystick default center x
export const JOY_Y    = 376;         // joystick default center y
export const JOY_DEAD = 14;          // dead zone
export const JOY_ZONE = VW * 0.44;  // left portion = joystick area
export const BTN_J    = { x: VW - 65,  y: 341, r: 30 }; // jump
export const BTN_D    = { x: VW - 65,  y: 411, r: 30 }; // down
export const BTN_S    = { x: VW - 140, y: 381, r: 30 }; // shoot

// ═══════════════════════════════════════════════════════════════════
// BACKGROUND STARS  (static, covers virtual width)
// ═══════════════════════════════════════════════════════════════════
export const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 137 + 23) % VW,
  y: (i * 97  + 11) % (GROUND_TOP - 30),
  r: i % 3 === 0 ? 1.5 : 1,
}));
