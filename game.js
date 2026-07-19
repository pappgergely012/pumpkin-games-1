// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT
// Imports wire up all modules; this file only owns the game loop.
// ═══════════════════════════════════════════════════════════════════
import "./src/core/canvas.js";   // sets up canvas size
import "./src/logic/input.js";   // registers keyboard + touch listeners

import { W, H } from "./src/core/constants.js";
import { state } from "./src/core/state.js";
import { update } from "./src/logic/physics.js";
import { draw, drawPortraitWarning } from "./src/render/renderer.js";
import { ctx } from "./src/core/canvas.js";

state.phase = "start";

function loop(ms) {
  if (W < H && W < 540) {
    ctx.clearRect(0, 0, W, H);
    drawPortraitWarning();
  } else {
    update();
    draw(ms / 1000);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
