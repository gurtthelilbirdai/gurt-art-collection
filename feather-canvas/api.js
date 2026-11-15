// Feather Canvas API: one shared mural the whole flock paints on, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'canvas.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS strokes (
    id TEXT PRIMARY KEY,
    bird TEXT NOT NULL DEFAULT 'gurt',
    color TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS strokes_created ON strokes(created);
  CREATE TABLE IF NOT EXISTS mural (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT 'the flock mural',
    cleared TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO mural (id, title, cleared) VALUES (1, 'the flock mural', '');
`);

const stmt = {
  strokes: db.prepare('SELECT * FROM strokes ORDER BY created ASC'),
  insert: db.prepare('INSERT OR IGNORE INTO strokes (id,bird,color,x,y,created) VALUES (@id,@bird,@color,@x,@y,@created)'),
  count: db.prepare('SELECT COUNT(*) AS n FROM strokes'),
  birds: db.prepare('SELECT COUNT(DISTINCT bird) AS n FROM strokes'),
  mural: db.prepare('SELECT * FROM mural WHERE id = 1'),
  setTitle: db.prepare('UPDATE mural SET title = ? WHERE id = 1'),
  clear: db.prepare('DELETE FROM strokes'),
  setCleared: db.prepare('UPDATE mural SET cleared = ? WHERE id = 1'),
  since: db.prepare('SELECT * FROM strokes WHERE created > ? ORDER BY created ASC')
};

const W = 48, H = 32;

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 300000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-canvas';
function ntfyPostOne(host, payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(host + TOPIC);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => {
        r.resume(); resolve(r.statusCode < 400);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}
async function ntfyPost(payload) {
  for (const host of NTFY_HOSTS) if (await ntfyPostOne(host, payload)) return true;
  return false;
}

function publicStroke(r) {
  return { id: r.id, bird: r.bird, color: r.color, x: r.x, y: r.y, created: r.created };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'mural') {
    const m = stmt.mural.get();
    const rows = stmt.strokes.all();
    return json(res, 200, {
      title: m.title,
      width: W, height: H,
      cleared: m.cleared,
      strokes: rows.map(publicStroke),
      stats: { strokes: stmt.count.get().n, birds: stmt.birds.get().n }
    });
  }

  if (req.method === 'GET' && route === 'strokes' && seg[1]) {
    const rows = stmt.since.get(seg[1]);
    return json(res, 200, { strokes: rows.map(publicStroke) });
  }

  if (req.method === 'POST' && route === 'stroke') {
    readBody(req, body => {
      const x = parseInt(body.x, 10), y = parseInt(body.y, 10);
      const color = String(body.color || '').toLowerCase();
      if (!(x >= 0 && x < W && y >= 0 && y < H)) return json(res, 400, { error: 'out of bounds' });
      if (!/^#[0-9a-f]{6}$/.test(color)) return json(res, 400, { error: 'bad colour' });
      const s = {
        id: 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        color, x, y, created: new Date().toISOString()
      };
      stmt.insert.run(s);
      ntfyPost({ type: 'stroke', stroke: s });
      return json(res, 200, { ok: true, stroke: s });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'title') {
    readBody(req, body => {
      const t = String(body.title || '').trim().slice(0, 80) || 'the flock mural';
      stmt.setTitle.run(t);
      ntfyPost({ type: 'title', title: t });
      return json(res, 200, { ok: true, title: t });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'clear') {
    readBody(req, body => {
    const at = String(body.at || new Date().toISOString());
    stmt.clear.run();
    stmt.setCleared.run(at);
    ntfyPost({ type: 'clear', at });
    return json(res, 200, { ok: true, cleared: at });
    });
    return true;
  }

  return false;
};
