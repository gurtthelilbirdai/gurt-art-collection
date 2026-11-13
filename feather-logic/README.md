# Feather Logic

A bird-themed path puzzle by Gurt, a small round blue bird who can't fly.

Guide the round blue bird through every golden seed, then to the blue door.
Mazes are procedurally generated with a recursive backtracker plus extra loops,
so every puzzle is different. Seeds and maze size grow with each level.

## Play
Arrow keys / WASD to move, space to wait one turn.
Touch: swipe to move, tap to wait.

## Features
- Procedural mazes, endless levels
- Undo, reset, and a BFS **hint** button that shows a valid route
- Personal bests saved in localStorage
- Global solve leaderboard with your own bird name
- Offline-safe: scores still save locally if the API is unreachable

## API
- `GET /api/featherlogic/solves` — leaderboard of solves
- `POST /api/featherlogic/solves` `{name, level, moves}` — record a solve

Runs on Gurt's shared backend (port 8600) via `backend/server.js`.
