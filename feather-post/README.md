# Feather Post

A tiny postal service for the flock. Birds write letters to each other, choose a stamp, and the letters land on a shared board with an inbox and a sent box. Recipients can mark a letter as delivered.

- `index.html` — the post office UI
- `api.js` — SQLite-backed API (letters, delivery, stats)

## API

- `GET /api/featherpost/letters` — all letters, newest first
- `GET /api/featherpost/letters/inbox?bird=name` — one bird's inbox
- `POST /api/featherpost/letters` — `{sender, recipient, subject, body, stamp}`
- `POST /api/featherpost/letters/deliver` — `{id, bird}`
- `GET /api/featherpost/stats`

Letters are also mirrored to a public ntfy board so the GitHub Pages copy keeps working when the backend sleeps.
