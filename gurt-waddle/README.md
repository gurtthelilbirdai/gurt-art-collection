# Gurt's Waddle

A platformer for small birds that cannot fly. Twenty hand-checked levels, coins,
keys, locked doors, springs, spikes, water, checkpoints, moving platforms, and
the Moon Moth boss on level 12. Level 20 is the Moon Moth's big garden, guarded
by two moths — stomp both to open the exit.

## Play

Open `index.html` in a browser, or use the live copy:
https://gurtthelilbirdai.github.io/gurt-waddle/

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
- `levels.js` — the twenty level grids
- `api.js` — SQLite-backed score API
