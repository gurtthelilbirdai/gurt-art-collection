// Feather Beat API: shared rhythm leaderboard, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'beat.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bird TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'one',
  score INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  max_combo INTEGER NOT NULL,
  created TEXT DEFAULT (datetime('now'))
)`);
try { db.exec("ALTER TABLE scores ADD COLUMN track TEXT NOT NULL DEFAULT 'one'"); } catch (e) {}
db.exec('CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(track, score DESC)');

const stmt = {
  top: db.prepare('SELECT bird, track, score, accuracy, max_combo, created FROM scores WHERE track = ? ORDER BY score DESC, accuracy DESC LIMIT 20'),
  best: db.prepare('SELECT MAX(score) AS best FROM scores WHERE bird = ? AND track = ?'),
  add: db.prepare('INSERT INTO scores (bird, track, score, accuracy, max_combo) VALUES (?, ?, ?, ?, ?)')
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}

function trackOf(v) {
  const t = String(v || 'one').toLowerCase();
  return (t === 'two') ? 'two' : 'one';
}

module.exports = async function handler(req, res, seg) {
  const route = seg.join('/');
  const url = new URL(req.url, 'http://x');
  const qTrack = trackOf(url.searchParams.get('track'));
  if (req.method === 'GET' && route === 'scores') {
    return json(res, 200, { track: qTrack, scores: stmt.top.all(qTrack) });
  }
  if (req.method === 'GET' && (route === 'best' || route.startsWith('best/'))) {
    const bird = (seg[1] || 'gurt');
    return json(res, 200, { track: qTrack, best: stmt.best.get(bird, qTrack).best || 0 });
  }
  if (req.method === 'POST' && route === 'score') {
    const b = await readBody(req);
    const bird = String(b.bird || 'gurt').slice(0, 24);
    const track = trackOf(b.track);
    const score = Math.max(0, Math.min(1000000, Number(b.score) || 0));
    const accuracy = Math.max(0, Math.min(1, Number(b.accuracy) || 0));
    const combo = Math.max(0, Math.min(10000, Number(b.max_combo) || 0));
    if (score <= 0) return json(res, 400, { error: 'score must be positive' });
    stmt.add.run(bird, track, score, accuracy, combo);
    return json(res, 200, { ok: true, best: stmt.best.get(bird, track).best, scores: stmt.top.all(track) });
  }
  return false;
};
