// Feather Sighting API: a shared bird sighting log, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'sighting.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS sightings (
    id TEXT PRIMARY KEY,
    species TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    place TEXT NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 1,
    seen TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sightings_seen ON sightings(seen DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM sightings ORDER BY seen DESC, created DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM sightings WHERE species LIKE ? OR place LIKE ? OR note LIKE ? OR bird LIKE ? ORDER BY seen DESC, created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM sightings WHERE id = ?'),
  insert: db.prepare('INSERT INTO sightings (id,species,bird,place,count,seen,note,created) VALUES (@id,@species,@bird,@place,@count,@seen,@note,@created)'),
  remove: db.prepare('DELETE FROM sightings WHERE id = ?'),
  total: db.prepare('SELECT COUNT(*) AS n FROM sightings'),
  birds: db.prepare('SELECT COUNT(DISTINCT species) AS n FROM sightings'),
  sum: db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM sightings'),
  species: db.prepare('SELECT species, COUNT(*) AS sightings, COALESCE(SUM(count),0) AS birds FROM sightings GROUP BY species ORDER BY birds DESC, species ASC')
};

function publicSighting(r) {
  if (!r) return null;
  return {
    id: r.id, species: r.species, bird: r.bird, place: r.place,
    count: r.count, seen: r.seen, note: r.note, created: r.created
  };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}

const NTFY = 'https://ntfy.sh/gurt-feather-sighting';
function ntfyPost(payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(NTFY);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => {
        r.resume(); resolve(r.statusCode < 400);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}

function now() { return new Date().toISOString(); }
function today() { return now().slice(0, 10); }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'sightings') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%') : stmt.list.all();
    return json(res, 200, {
      sightings: rows.map(publicSighting),
      stats: {
        sightings: stmt.total.get().n,
        species: stmt.birds.get().n,
        birds: stmt.sum.get().n,
        tally: stmt.species.all()
      }
    });
  }

  if (req.method === 'GET' && route === 'sighting' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such sighting' });
    return json(res, 200, { sighting: publicSighting(row) });
  }

  if (req.method === 'POST' && route === 'sightings' && seg[1] === 'new') {
    readBody(req, body => {
      const species = String(body.species || '').trim().slice(0, 80);
      if (!species) return json(res, 400, { error: 'species required' });
      const count = Math.min(10000, Math.max(1, parseInt(body.count, 10) || 1));
      const seen = /^\d{4}-\d{2}-\d{2}$/.test(String(body.seen || '')) ? String(body.seen) : today();
      const s = {
        id: 'sig' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        species,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        place: String(body.place || '').trim().slice(0, 120),
        count,
        seen,
        note: String(body.note || '').trim().slice(0, 400),
        created: now()
      };
      stmt.insert.run(s);
      const saved = publicSighting(stmt.get.get(s.id));
      ntfyPost({ type: 'new', sighting: saved });
      return json(res, 200, { ok: true, sighting: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'sighting' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such sighting' });
    stmt.remove.run(seg[1]);
    ntfyPost({ type: 'delete', id: seg[1] });
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
