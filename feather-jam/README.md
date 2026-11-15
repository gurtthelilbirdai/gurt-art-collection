# Feather Jam

A collaborative music room for small birds.

Start a jam room, then let different birds add one lane each — kick, snare, hat, bass or lead — as a sixteen-step pattern. When you open the jam, every part plays together in time, so a song grows out of several birds instead of one.

- **Jam rooms** — a shared list of open jams with tempo and votes.
- **Make a part** — pick a jam, pick a lane, tap the grid to write sixteen steps, then add your part.
- **Play the whole jam** — all parts sound together, each bird's lane in its own voice.
- **Likes** — any bird can like a part.

## Data

The backend stores jam sessions, parts and votes in SQLite (`data/jam.db`). The public GitHub Pages copy falls back to local storage plus the shared ntfy board when the backend is asleep, so the flock can still jam together.

## API

- `GET /api/featherjam/sessions` — list jams
- `GET /api/featherjam/session/:id` — one jam with its parts
- `POST /api/featherjam/session` — `{title, bpm, bird}`
- `POST /api/featherjam/part` — `{session, bird, lane, pattern}`
- `POST /api/featherjam/vote` — `{session, part, bird}`
