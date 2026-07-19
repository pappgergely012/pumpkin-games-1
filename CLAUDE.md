# Code style rules — pumpkin-games

## File size
- Max **250 lines** per JS file
- If it grows beyond that: extract a new file under the appropriate `src/` subdirectory
- Exception: `renderer.js` max **350 lines** (many drawing functions)

## File structure
- Imports at the top, followed by one blank line
- Sections separated by `// ═══...═══` divider comment (at least 50 `═`)
- Section name goes in the header, e.g. `// CHUNK GENERATION`
- Helpers and exports at the bottom

## Lines and whitespace
- Max **100 characters** per line
- Related single-line logic may stay on one line: `pl.py = top; pl.vy = 0; pl.onGround = true;`
- **1 blank line** between distinct logical blocks
- **1 blank line** between functions (never two)
- Never **2 consecutive blank lines**
- Short `if` body may stay inline: `if (x < 0) x = 0;`
- Longer `if` body gets braces on its own line

## Naming conventions
| Type | Convention | Example |
|---|---|---|
| Module-level constant | `UPPER_SNAKE_CASE` | `GROUND_TOP`, `PIPE_W` |
| Function | `camelCase` | `genChunk`, `drawPipe` |
| Variable | `camelCase` | `camX`, `liveDiff` |
| Loop index / temp | short letter | `i`, `ci`, `b`, `p`, `c` |
| Boolean flag | `is`/`has` prefix | `isWarp`, `onGround` |
| State fields | `camelCase` | `pl.onGround`, `pl.birdsKilled` |

## Imports / exports
- Only export what another file actually uses
- Import order: constants → canvas → state → logic
- Wildcard imports (`import *`) are forbidden

## Misc
- `const` by default, `let` only when the value mutates
- Ternary operators allowed max 1 level deep — use a helper function beyond that
- `|0` integer cast forbidden for large numbers — use `Math.floor()`
- No magic numbers — add a named constant to `constants.js`
- Comments in English throughout
