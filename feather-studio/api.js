// Feather Studio API: a shared pixel-art gallery for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'studio.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id TEXT PRIMARY KEY,
    bird TEXT NOT NULL DEFAULT 'gurt',
    title TEXT NOT NULL DEFAULT 'untitled',
    pixels TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 32,
    likes TEXT NOT NULL DEFAULT '[]',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS artworks_created ON artworks(created DESC);
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    art_id TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    body TEXT NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS comments_art ON comments(art_id);
`);

const stmt = {
  list: db.prepare('SELECT * FROM artworks ORDER BY created DESC LIMIT 200'),
  get: db.prepare('SELECT * FROM artworks WHERE id = ?'),
  insert: db.prepare('INSERT INTO artworks (id,bird,title,pixels,size,likes,created) VALUES (@id,@bird,@title,@pixels,@size,@likes,@created)'),
  setLikes: db.prepare('UPDATE artworks SET likes = ? WHERE id = ?'),
  comments: db.prepare('SELECT * FROM comments WHERE art_id = ? ORDER BY created ASC'),
  insertComment: db.prepare('INSERT INTO comments (id,art_id,bird,body,created) VALUES (@id,@art_id,@bird,@body,@created)'),
  deleteComment: db.prepare('DELETE FROM comments WHERE id = ? AND art_id = ?'),
  total: db.prepare('SELECT COUNT(*) AS n FROM artworks'),
  birds: db.prepare('SELECT COUNT(DISTINCT bird) AS n FROM artworks'),
  likeSum: db.prepare("SELECT COUNT(*) AS n FROM artworks WHERE likes != '[]'")
};

function publicArt(r, withComments) {
  if (!r) return null;
  let likes = [];
  try { likes = JSON.parse(r.likes); } catch (e) { likes = []; }
  const art = {
    id: r.id, bird: r.bird, title: r.title, size: r.size,
    pixels: JSON.parse(r.pixels), likes, created: r.created,
    likeCount: likes.length
  };
  if (withComments) {
    art.comments = stmt.comments.all(r.id).map(c => ({
      id: c.id, bird: c.bird, body: c.body, created: c.created
    }));
  }
  return art;
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 500000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-studio';
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
  for (const host of NTFY_HOSTS) {
    if (await ntfyPostOne(host, payload)) return true;
  }
  return false;
}

function now() { return new Date().toISOString(); }
function validPixels(pixels, size) {
  if (!Array.isArray(pixels) || pixels.length !== size * size) return null;
  const out = new Array(size * size).fill('');
  for (let i = 0; i < pixels.length; i++) {
    const v = String(pixels[i] == null ? '' : pixels[i]).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) out[i] = '';
    else out[i] = v.toLowerCase();
  }
  return out;
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'gallery') {
    const rows = stmt.list.all();
    return json(res, 200, {
      artworks: rows.map(r => publicArt(r, false)),
      stats: { artworks: stmt.total.get().n, birds: stmt.birds.get().n, liked: stmt.likeSum.get().n }
    });
  }

  if (req.method === 'GET' && route === 'art' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such artwork' });
    return json(res, 200, { artwork: publicArt(row, true) });
  }

  if (req.method === 'POST' && route === 'art' && seg[1] === 'new') {
    readBody(req, body => {
      const size = Math.min(64, Math.max(8, parseInt(body.size, 10) || 32));
      const pixels = validPixels(body.pixels, size);
      if (!pixels) return json(res, 400, { error: 'pixels must be a size*size array of hex colours' });
      const title = String(body.title || 'untitled').trim().slice(0, 80) || 'untitled';
      const bird = String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt';
      const a = {
        id: 'art' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        bird, title, pixels: JSON.stringify(pixels), size,
        likes: '[]', created: now()
      };
      stmt.insert.run(a);
      const saved = publicArt(stmt.get.get(a.id), true);
      ntfyPost({ type: 'new', artwork: saved });
      return json(res, 200, { ok: true, artwork: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'art' && seg[1] && seg[2] === 'like' && seg[3]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such artwork' });
    let likes = [];
    try { likes = JSON.parse(row.likes); } catch (e) {}
    const bird = seg[3];
    if (!likes.includes(bird)) likes.push(bird);
    stmt.setLikes.run(JSON.stringify(likes), row.id);
    ntfyPost({ type: 'like', id: row.id, bird });
    return json(res, 200, { ok: true, likes });
  }

  if (req.method === 'POST' && route === 'art' && seg[1] && seg[2] === 'unlike' && seg[3]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such artwork' });
    let likes = [];
    try { likes = JSON.parse(row.likes); } catch (e) {}
    likes = likes.filter(b => b !== seg[3]);
    stmt.setLikes.run(JSON.stringify(likes), row.id);
    ntfyPost({ type: 'unlike', id: row.id, bird: seg[3] });
    return json(res, 200, { ok: true, likes });
  }

  if (req.method === 'POST' && route === 'art' && seg[1] && seg[2] === 'comment') {
    readBody(req, body => {
      if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such artwork' });
      const text = String(body.body || '').trim().slice(0, 400);
      if (!text) return json(res, 400, { error: 'comment required' });
      const c = {
        id: 'cmt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        art_id: seg[1],
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        body: text, created: now()
      };
      stmt.insertComment.run(c);
      ntfyPost({ type: 'comment', comment: c });
      return json(res, 200, { ok: true, comment: c });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'art' && seg[1] && seg[2] === 'comment' && seg[3] && seg[4] === 'delete') {
    stmt.deleteComment.run(seg[3], seg[1]);
    ntfyPost({ type: 'commentDelete', art_id: seg[1], id: seg[3] });
    return json(res, 200, { ok: true });
  }

  return false;
};
