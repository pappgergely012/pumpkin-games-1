import {
  S,
  VW,
  CHUNK,
  JOY_X,
  JOY_Y,
  PL_W,
  PL_H,
  PL_CROUCH_H,
  JUMP_VEL,
  BULLET_SPD,
  SHOOT_CD,
  JOY_DEAD,
  JOY_ZONE,
  BTN_J,
  BTN_D,
  BTN_S,
} from "../core/constants.js";
import { canvas } from "../core/canvas.js";
import { state, startGame } from "../core/state.js";
import { genChunk } from "./world.js";

// ═══════════════════════════════════════════════════════════════════
// KEYBOARD STATE
// ═══════════════════════════════════════════════════════════════════
export const K = {};

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (isGodMode()) toggleDistModal();
    return;
  }
  if (distModal) {
    e.stopPropagation();
    return;
  }
  if (K[e.key]) return;
  K[e.key] = true;
  if (state.phase === "play") {
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") tryJump();
    if (e.key === " ") tryShoot();
  } else {
    if (e.key === " " || e.key === "Enter") startGame();
  }
});
window.addEventListener("keyup", (e) => {
  K[e.key] = false;
});

// ═══════════════════════════════════════════════════════════════════
// TOUCH / JOYSTICK STATE
// ═══════════════════════════════════════════════════════════════════
export const CTRL = {
  joyId: null,
  joyCX: JOY_X,
  joyCY: JOY_Y,
  joyDx: 0,
  joyOn: false,
  jumpId: null,
  downId: null,
  shootId: null,
};

function td(t) {
  return { x: t.clientX / S, y: t.clientY / S };
}
function inC(px, py, cx, cy, r) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const d = td(t);
      if (state.phase !== "play") {
        startGame();
        break;
      }

      if (d.x < JOY_ZONE && CTRL.joyId === null) {
        CTRL.joyId = t.identifier;
        CTRL.joyCX = d.x;
        CTRL.joyCY = d.y;
        CTRL.joyDx = 0;
        CTRL.joyOn = true;
        continue;
      }
      if (
        inC(d.x, d.y, BTN_J.x, BTN_J.y, BTN_J.r * 1.4) &&
        CTRL.jumpId === null
      ) {
        CTRL.jumpId = t.identifier;
        tryJump();
        continue;
      }
      if (
        inC(d.x, d.y, BTN_D.x, BTN_D.y, BTN_D.r * 1.4) &&
        CTRL.downId === null
      ) {
        CTRL.downId = t.identifier;
        continue;
      }
      if (
        inC(d.x, d.y, BTN_S.x, BTN_S.y, BTN_S.r * 1.4) &&
        CTRL.shootId === null
      ) {
        CTRL.shootId = t.identifier;
        tryShoot();
        continue;
      }
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === CTRL.joyId) CTRL.joyDx = td(t).x - CTRL.joyCX;
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === CTRL.joyId) {
        CTRL.joyId = null;
        CTRL.joyDx = 0;
        CTRL.joyOn = false;
      }
      if (t.identifier === CTRL.jumpId) {
        CTRL.jumpId = null;
      }
      if (t.identifier === CTRL.downId) {
        CTRL.downId = null;
      }
      if (t.identifier === CTRL.shootId) {
        CTRL.shootId = null;
      }
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchcancel",
  () => {
    CTRL.joyId = null;
    CTRL.joyDx = 0;
    CTRL.joyOn = false;
    CTRL.jumpId = null;
    CTRL.downId = null;
    CTRL.shootId = null;
  },
  { passive: false }
);

window.addEventListener("orientationchange", () => {
  setTimeout(() => location.reload(), 150);
});

// ═══════════════════════════════════════════════════════════════════
// DIRECTION HELPERS
// ═══════════════════════════════════════════════════════════════════
export function isLeft() {
  return K["a"] || K["A"] || K["ArrowLeft"] || CTRL.joyDx < -JOY_DEAD;
}
export function isRight() {
  return K["d"] || K["D"] || K["ArrowRight"] || CTRL.joyDx > JOY_DEAD;
}
export function isDown() {
  return K["s"] || K["S"] || K["ArrowDown"] || CTRL.downId !== null;
}

// ═══════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════
export function isGodMode() {
  return localStorage.getItem("godMode") === "1";
}

// ═══════════════════════════════════════════════════════════════════
// GOD MODE — distance warp modal (ESC)
// ═══════════════════════════════════════════════════════════════════
let distModal = null;

function toggleDistModal() {
  if (distModal) {
    closeDistModal();
    return;
  }
  distModal = document.createElement("div");
  distModal.style.cssText = [
    "position:fixed",
    "top:50%",
    "left:50%",
    "transform:translate(-50%,-50%)",
    "background:#1a1a2e",
    "border:2px solid #FFD600",
    "border-radius:10px",
    "padding:22px 30px",
    "z-index:9999",
    "font-family:monospace",
    "color:#fff",
    "box-shadow:0 0 28px rgba(255,214,0,0.35)",
    "min-width:220px",
  ].join(";");
  distModal.innerHTML = `
    <div style="font-size:13px;color:#FFD600;margin-bottom:12px;">★ GOD MODE — Teleport</div>
    <label style="font-size:12px;color:#aaa;">Távolság (m):</label><br>
    <input id="godDistInput" type="number" min="0" placeholder="pl. 500" style="
      margin-top:7px;padding:7px 10px;font-size:16px;font-family:monospace;
      background:#0d0d2a;color:#FFD600;border:1px solid #FFD600;border-radius:5px;
      width:150px;outline:none;
    ">
    <div style="margin-top:10px;font-size:11px;color:#555;">Enter = warp &nbsp;·&nbsp; Esc = bezár</div>
  `;
  document.body.appendChild(distModal);
  const inp = document.getElementById("godDistInput");
  inp.focus();
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const dist = parseInt(inp.value, 10);
      if (!isNaN(dist) && dist >= 0) warpToDist(dist);
      closeDistModal();
    } else if (e.key === "Escape") {
      closeDistModal();
    }
  });
}

function closeDistModal() {
  if (distModal) {
    distModal.remove();
    distModal = null;
  }
}

function warpToDist(dist) {
  const pl = state.pl;
  if (!pl) return;
  pl.x = dist * 20 + 150;
  state.camX = Math.max(0, pl.x - VW * 0.3);
  const lc = Math.max(0, Math.floor(pl.x / CHUNK) - 1);
  const rc = Math.ceil((pl.x + VW + CHUNK) / CHUNK);
  for (let ci = lc; ci <= rc; ci++) genChunk(ci);
}

export function tryJump() {
  const pl = state.pl;
  if (pl.jumpsLeft > 0) {
    pl.vy = JUMP_VEL;
    pl.onGround = false;
    pl.jumpsLeft--;
  }
}

export function tryShoot() {
  const pl = state.pl;
  if (!pl || pl.shootCooldown > 0) return;
  const h = pl.crouching ? PL_CROUCH_H : PL_H;
  state.bullets.push({
    x: pl.x + pl.facing * (PL_W / 2 + 8),
    y: pl.py - h * 0.5,
    vx: pl.facing * BULLET_SPD,
  });
  pl.shootCooldown = SHOOT_CD;
}
