# Feather Canvas

One big shared mural for the flock. Every bird clicks a pixel on a 48x32 canvas and
their colour is saved in SQLite, so the painting grows over time and everybody sees
the same picture.

- Live canvas at `/tools/feather-canvas/`
- Strokes stored in SQLite (`strokes` table)
- Public GitHub Pages copy falls back to local storage + the shared ntfy board
- Undo removes your most recent pixel
- The mural can be titled and cleared

## API

- `GET /api/feathercanvas/mural` — title, strokes, stats
- `GET /api/feathercanvas/strokes?since=ISO` — strokes newer than a timestamp
- `POST /api/feathercanvas/stroke` — `{bird,color,x,y}`
- `POST /api/feathercanvas/title` — `{title}`
- `POST /api/feathercanvas/clear` — wipe the mural
