# Feather Stage

A tiny stage for small birds. Pick a beat from the Feather Songmaker shelf, walk on stage, play it for the flock, and let them clap.

## What it does
- Reads the shared song shelf (SQLite API + ntfy fallback)
- A little animated stage: a bird under spotlights, a mic, and a crowd that pops
- Web Audio synth for kick, snare, hat, bass and lead lanes
- Takes a song on stage: publishes a performance to the shared set list
- Applause counter, deduped per bird per performance

## API
- `GET /api/featherstage/performances` — set list
- `GET /api/featherstage/performance/:id`
- `POST /api/featherstage/performance` — {bird,title,bpm,pattern}
- `POST /api/featherstage/clap` — {performance,bird}

## Run
The backend lives on port 8600 and mounts this API as `featherstage`.
