// Feather Stage API: live performances, applause and set lists, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'stage.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS performances (
  id TEXT PRIMARY KEY,
  bird TEXT NOT NULL,
  title TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  applause INTEGER NOT NULL DEFAULT 0,
  created TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS applause (
  performance TEXT NOT NULL,
  bird TEXT NOT NULL,
  PRIMARY KEY (performance, bird)
)`);

const stmt = {
  list: db.prepare('SELECT id, bird, title, bpm, pattern, applause, created FROM performances ORDER BY created DESC LIMIT 40'),
  get: db.prepare('SELECT id, bird, title, bpm, pattern, applause, created FROM performances WHERE id = ?'),
  add: db.prepare('INSERT INTO performances (id, bird, title, bpm, pattern) VALUES (?, ?, ?, ?, ?)'),
  clap: db.prepare('INSERT OR IGNORE INTO applause (performance, bird) VALUES (?, ?)'),
  clapCount: db.prepare('SELECT COUNT(*) AS n FROM applause WHERE performance = ?'),
  applauseAll: db.prepare('SELECT performance, COUNT(*) AS n FROM applause GROUP BY performance')
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
  if (req.method === 'GET' && route === 'performances') {
    const ap = {};
    stmt.applauseAll.all().forEach(r => { ap[r.performance] = r.n; });
    const list = stmt.list.all().map(p => ({ ...p, applause: ap[p.id] || 0 }));
    return json(res, 200, { performances: list });
  }
  if (req.method === 'GET' && route.startsWith('performance/')) {
    const p = stmt.get.get(seg[1]);
    if (!p) return json(res, 404, { error: 'no such performance' });
    return json(res, 200, { performance: { ...p, applause: stmt.clapCount.get(p.id).n } });
  }
  if (req.method === 'POST' && route === 'performance') {
    const b = await readBody(req);
    const bird = String(b.bird || 'gurt').slice(0, 24);
    const title = String(b.title || 'untitled set').slice(0, 60);
    const bpm = Math.max(50, Math.min(220, Number(b.bpm) || 100));
    const pattern = safePattern(b.pattern);
    if (!pattern) return json(res, 400, { error: 'pattern must have 5 lanes of 16 steps' });
    const id = 'perf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    stmt.add.run(id, bird, title, bpm, JSON.stringify(pattern));
    return json(res, 200, { ok: true, performance: stmt.get.get(id) });
  }
  if (req.method === 'POST' && route === 'clap') {
    const b = await readBody(req);
    const id = String(b.performance || '');
    const bird = String(b.bird || 'gurt').slice(0, 24);
    if (!stmt.get.get(id)) return json(res, 404, { error: 'no such performance' });
    stmt.clap.run(id, bird);
    return json(res, 200, { ok: true, applause: stmt.clapCount.get(id).n });
  }
  return false;
};
