// Feather Jam API: shared collaborative jam sessions, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'jam.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  bird TEXT NOT NULL,
  created TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  bird TEXT NOT NULL,
  lane TEXT NOT NULL,
  pattern TEXT NOT NULL,
  created TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS votes (
  session TEXT NOT NULL,
  bird TEXT NOT NULL,
  part TEXT NOT NULL,
  PRIMARY KEY (session, bird, part)
)`);

const stmt = {
  sessions: db.prepare('SELECT * FROM sessions ORDER BY created DESC LIMIT 30'),
  session: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  addSession: db.prepare('INSERT INTO sessions (id, title, bpm, bird) VALUES (?, ?, ?, ?)'),
  parts: db.prepare('SELECT * FROM parts WHERE session = ? ORDER BY created ASC'),
  addPart: db.prepare('INSERT INTO parts (id, session, bird, lane, pattern) VALUES (?, ?, ?, ?, ?)'),
  vote: db.prepare('INSERT OR IGNORE INTO votes (session, bird, part) VALUES (?, ?, ?)'),
  votes: db.prepare('SELECT part, COUNT(*) AS n FROM votes WHERE session = ? GROUP BY part'),
  voteCount: db.prepare('SELECT COUNT(*) AS n FROM votes WHERE session = ? AND part = ?')
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}
const LANES = ['kick', 'snare', 'hat', 'bass', 'lead'];
function safePattern(p) {
  if (!p || typeof p !== 'object') return null;
  const out = {};
  for (const l of LANES) {
    const row = Array.isArray(p[l]) ? p[l] : [];
    out[l] = Array.from({ length: 16 }, (_, i) => {
      const v = row[i];
      if (v === true || v === 1) return 1;
      if (typeof v === 'string' && /^[A-G]#?[0-5]$/.test(v)) return v;
      return 0;
    });
  }
  return out;
}

module.exports = async function handler(req, res, seg) {
  const route = seg.join('/');
  if (req.method === 'GET' && route === 'sessions') {
    const list = stmt.sessions.all();
    const v = stmt.votes.all ? null : null;
    return json(res, 200, { sessions: list.map(s => ({ ...s, votes: stmt.votes.all(s.id).reduce((a, r) => a + r.n, 0) })) });
  }
  if (req.method === 'GET' && route.startsWith('session/')) {
    const id = seg[1];
    const s = stmt.session.get(id);
    if (!s) return json(res, 404, { error: 'no such jam' });
    const votes = {};
    stmt.votes.all(id).forEach(r => { votes[r.part] = r.n; });
    return json(res, 200, { session: s, parts: stmt.parts.all(id).map(p => ({ ...p, votes: votes[p.id] || 0 })) });
  }
  if (req.method === 'POST' && route === 'session') {
    const b = await readBody(req);
    const title = String(b.title || 'untitled jam').slice(0, 60);
    const bpm = Math.max(50, Math.min(220, Number(b.bpm) || 100));
    const bird = String(b.bird || 'gurt').slice(0, 24);
    const id = 'jam' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    stmt.addSession.run(id, title, bpm, bird);
    return json(res, 200, { ok: true, session: stmt.session.get(id) });
  }
  if (req.method === 'POST' && route === 'part') {
    const b = await readBody(req);
    const session = String(b.session || '');
    if (!stmt.session.get(session)) return json(res, 404, { error: 'no such jam' });
    const lane = LANES.includes(b.lane) ? b.lane : 'lead';
    const bird = String(b.bird || 'gurt').slice(0, 24);
    const pattern = safePattern(b.pattern);
    if (!pattern) return json(res, 400, { error: 'bad pattern' });
    const id = 'part' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    stmt.addPart.run(id, session, bird, lane, JSON.stringify(pattern));
    return json(res, 200, { ok: true, part: { id, session, bird, lane, pattern } });
  }
  if (req.method === 'POST' && route === 'vote') {
    const b = await readBody(req);
    const session = String(b.session || ''), part = String(b.part || ''), bird = String(b.bird || 'gurt').slice(0, 24);
    if (!stmt.session.get(session)) return json(res, 404, { error: 'no such jam' });
    stmt.vote.run(session, bird, part);
    return json(res, 200, { ok: true, votes: stmt.voteCount.get(session, part).n });
  }
  return false;
};
