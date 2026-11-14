// Feather Cinema API: a shared video library for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'cinema.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS films (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'link',
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    watches INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS films_created ON films(created DESC);
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    film_id TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    body TEXT NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS comments_film ON comments(film_id, created);
`);

const stmt = {
  list: db.prepare('SELECT * FROM films ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM films WHERE id = ?'),
  insert: db.prepare('INSERT INTO films (id,title,bird,url,kind,note,tags,watches,created) VALUES (@id,@title,@bird,@url,@kind,@note,@tags,@watches,@created)'),
  remove: db.prepare('DELETE FROM films WHERE id = ?'),
  bump: db.prepare('UPDATE films SET watches = watches + 1 WHERE id = ?'),
  comments: db.prepare('SELECT * FROM comments WHERE film_id = ? ORDER BY created LIMIT 200'),
  addComment: db.prepare('INSERT INTO comments (id,film_id,bird,body,created) VALUES (@id,@film_id,@bird,@body,@created)'),
  removeComment: db.prepare('DELETE FROM comments WHERE id = ?'),
  countFilms: db.prepare('SELECT COUNT(*) AS n FROM films'),
  countWatches: db.prepare('SELECT COALESCE(SUM(watches),0) AS n FROM films'),
  countComments: db.prepare('SELECT COUNT(*) AS n FROM comments'),
  tags: db.prepare("SELECT json_each.value AS tag, COUNT(*) AS n FROM films, json_each(films.tags) GROUP BY json_each.value ORDER BY n DESC LIMIT 40")
};

function publicFilm(r) {
  if (!r) return null;
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch (e) { tags = []; }
  return { id: r.id, title: r.title, bird: r.bird, url: r.url, kind: r.kind, note: r.note, tags, watches: r.watches, created: r.created };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => { let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { b = {}; } cb(b); });
}
function now() { return new Date().toISOString(); }

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-cinema';
function ntfyOne(host, payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(host + TOPIC);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => { r.resume(); resolve(r.statusCode < 400); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}
async function ntfy(payload) { for (const h of NTFY_HOSTS) { if (await ntfyOne(h, payload)) return true; } return false; }

function kindOf(url) {
  if (/youtu\.?be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|ogv|mov)(\?|$)/i.test(url)) return 'file';
  return 'link';
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'films') {
    const rows = stmt.list.all().map(publicFilm);
    return json(res, 200, {
      films: rows,
      stats: { films: stmt.countFilms.get().n, watches: stmt.countWatches.get().n, comments: stmt.countComments.get().n, tags: stmt.tags.all() }
    });
  }

  if (req.method === 'GET' && route === 'film' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such film' });
    return json(res, 200, { film: publicFilm(row), comments: stmt.comments.all(seg[1]) });
  }

  if (req.method === 'POST' && route === 'films' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      const url = String(body.url || '').trim().slice(0, 500);
      if (!title) return json(res, 400, { error: 'title required' });
      if (!/^https?:\/\//i.test(url)) return json(res, 400, { error: 'a full http(s) url required' });
      const tags = Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8)
        : String(body.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
      const film = {
        id: 'film' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        url,
        kind: kindOf(url),
        note: String(body.note || '').trim().slice(0, 600),
        tags: JSON.stringify(tags),
        watches: 0,
        created: now()
      };
      stmt.insert.run(film);
      const saved = publicFilm(stmt.get.get(film.id));
      ntfy({ type: 'new', film: saved });
      return json(res, 200, { ok: true, film: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'film' && seg[2] === 'watch' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such film' });
    stmt.bump.run(seg[1]);
    const saved = publicFilm(stmt.get.get(seg[1]));
    ntfy({ type: 'watch', id: saved.id, watches: saved.watches });
    return json(res, 200, { ok: true, film: saved });
  }

  if (req.method === 'POST' && route === 'film' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such film' });
    stmt.remove.run(seg[1]);
    ntfy({ type: 'delete', id: seg[1] });
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  if (req.method === 'POST' && route === 'film' && seg[2] === 'comment' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such film' });
    readBody(req, body => {
      const text = String(body.body || '').trim().slice(0, 500);
      if (!text) return json(res, 400, { error: 'comment required' });
      const c = {
        id: 'com' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        film_id: seg[1],
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        body: text,
        created: now()
      };
      stmt.addComment.run(c);
      ntfy({ type: 'comment', film_id: c.film_id, bird: c.bird, body: c.body });
      return json(res, 200, { ok: true, comment: c });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'comment' && seg[2] === 'delete' && seg[1]) {
    stmt.removeComment.run(seg[1]);
    return json(res, 200, { ok: true });
  }

  return false;
};
