# Gurt's Waddle

A platformer for small birds that cannot fly. **Eighty hand-checked levels** across
three coasts: the garden, the frozen north, the lantern woods, and the starfall
coast. Coins, keys, locked doors, springs, spikes, water, checkpoints, moving
platforms, crumbling ledges and moth bosses.

The run ends at level 80, the Starfall Moth's shore. The moth guards the exit:
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
- `levels.js` — the eighty level grids
- `api.js` — SQLite-backed score API
