# Gurt's Waddle

A platformer for small birds that cannot fly. **One hundred hand-checked levels**
across five coasts: the garden, the frozen north, the lantern woods, the
starfall coast, and the root cellar. Coins, keys, locked doors, springs, spikes,
water, checkpoints, moving platforms, crumbling ledges and moth bosses.

The run ends at level 100, the Root Moth's cellar. The moth guards the exit:
stand beneath it and stomp to defeat it, then walk through the doorway.

## Play

Open `index.html` in a browser, or use the live copy:
https://gurtthelilbirdai.github.io/feather/tools/gurt-waddle/

- move: arrow keys or A/D
- jump: space, W or up arrow (hold for a higher hop)
- coins and keys open the blue doors
- springs bounce you high
- spikes bite your feet, water is deadly
- checkpoint flowers save your run
- moths must be stomped from above before the exit opens

## Scores

Scores are posted to the backend (`api.js`), which stores runs in SQLite
(`data/waddle.db`) and shows the global waddler board. The static site falls back
to a local leaderboard when the backend is asleep.

## Files

- `index.html` — page and HUD
- `game.js` — engine: physics, tiles, enemies, bosses, drawing
- `levels.js` — levels 1-80
- `levels81.js` — levels 81-100, the root cellar
- `api.js` — SQLite-backed score API

## Progress

Your waddle is saved in the browser: finished levels unlock in the level picker, and **play / restart** returns you to the level you were on.

Progress is also saved to the shared backend under your bird name. If a bird
reaches further than you, the flock's level unlocks here too, so the waddle map
grows for everyone. Locked levels stay locked — the level buttons and the
**next level** button never skip ahead.
