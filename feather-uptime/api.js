// Feather Uptime API: shared URL monitor for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'uptime.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    interval INTEGER NOT NULL DEFAULT 60,
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor TEXT NOT NULL,
    ok INTEGER NOT NULL,
    code INTEGER NOT NULL DEFAULT 0,
    ms INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS checks_monitor ON checks(monitor, at);
`);

const stmt = {
  list: db.prepare('SELECT * FROM monitors ORDER BY created DESC'),
  get: db.prepare('SELECT * FROM monitors WHERE id = ?'),
  insert: db.prepare('INSERT INTO monitors (id,name,url,interval,created) VALUES (@id,@name,@url,@interval,@created)'),
  remove: db.prepare('DELETE FROM monitors WHERE id = ?'),
  addCheck: db.prepare('INSERT INTO checks (monitor,ok,code,ms,note,at) VALUES (@monitor,@ok,@code,@ms,@note,@at)'),
  recent: db.prepare('SELECT * FROM checks WHERE monitor = ? ORDER BY at DESC LIMIT ?'),
  stats: db.prepare(`SELECT COUNT(*) AS n, SUM(ok) AS good, AVG(ms) AS avgms FROM checks WHERE monitor = ? AND at >= ?`),
  last: db.prepare('SELECT * FROM checks WHERE monitor = ? ORDER BY at DESC LIMIT 1'),
  lastN: db.prepare('SELECT * FROM checks WHERE monitor = ? ORDER BY at DESC LIMIT 30')
};

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
function now() { return new Date().toISOString(); }
function clean(v, max) { return String(v || '').trim().slice(0, max); }

function probe(url, timeoutMs) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: 0, code: 0, ms: 0, note: 'bad url' }); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return resolve({ ok: 0, code: 0, ms: 0, note: 'http only' });
    const lib = u.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.request(u, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'FeatherUptime/1.0' } }, r => {
      r.resume();
      resolve({ ok: r.statusCode >= 200 && r.statusCode < 400 ? 1 : 0, code: r.statusCode, ms: Date.now() - started, note: '' });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: 0, code: 0, ms: Date.now() - started, note: 'timeout' }); });
    req.on('error', e => resolve({ ok: 0, code: 0, ms: Date.now() - started, note: String(e.message || e).slice(0, 120) }));
    req.end();
  });
}

const NTFY = 'https://ntfy.sh/gurt-feather-uptime';
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

async function checkOne(m) {
  const r = await probe(m.url, 10000);
  const at = now();
  stmt.addCheck.run({ monitor: m.id, ok: r.ok, code: r.code, ms: r.ms, note: r.note, at });
  const pub = publicMonitor(stmt.get.get(m.id));
  ntfyPost({ type: 'check', monitor: { id: m.id, name: m.name, url: m.url, interval: m.interval, created: m.created }, result: { ok: !!r.ok, code: r.code, ms: r.ms, note: r.note, at }, uptime24h: pub.uptime24h, avgMs: pub.avgMs });
  return r;
}

let timer = null;
function startScheduler() {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const rows = stmt.list.all();
      for (const m of rows) {
        const last = stmt.last.get(m.id);
        const due = !last || (Date.now() - new Date(last.at).getTime()) >= m.interval * 1000;
        if (due) await checkOne(m);
      }
    } catch (e) { /* keep the flock quiet */ }
  }, 15000);
  timer.unref && timer.unref();
}
startScheduler();

function publicMonitor(m) {
  const last = stmt.last.get(m.id);
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const day = stmt.stats.get(m.id, cutoff);
  const total = day.n || 0;
  const uptime = total ? Math.round((day.good || 0) / total * 1000) / 10 : null;
  const avg = day.avgms ? Math.round(day.avgms) : null;
  return {
    id: m.id, name: m.name, url: m.url, interval: m.interval, created: m.created,
    last: last ? { ok: !!last.ok, code: last.code, ms: last.ms, note: last.note, at: last.at } : null,
    uptime24h: uptime, avgMs: avg, checks24h: total
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'monitors') {
    return json(res, 200, { monitors: stmt.list.all().map(publicMonitor) });
  }

  if (req.method === 'GET' && route === 'monitor' && seg[1]) {
    const m = stmt.get.get(seg[1]);
    if (!m) return json(res, 404, { error: 'no such monitor' });
    const limit = Math.min(200, parseInt(seg[2] || '50', 10) || 50);
    return json(res, 200, { monitor: publicMonitor(m), checks: stmt.recent.all(m.id, limit) });
  }

  if (req.method === 'POST' && route === 'monitors' && seg[1] === 'new') {
    readBody(req, body => {
      const url = clean(body.url, 500);
      const name = clean(body.name, 80);
      if (!url || !/^https?:\/\//i.test(url)) return json(res, 400, { error: 'url required' });
      const interval = Math.min(3600, Math.max(15, parseInt(body.interval, 10) || 60));
      const m = {
        id: 'mon' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name || url.replace(/^https?:\/\//i, '').slice(0, 60),
        url, interval, created: now()
      };
      stmt.insert.run(m);
      ntfyPost({ type: 'new', monitor: { id: m.id, name: m.name, url: m.url, interval: m.interval, created: m.created } });
      checkOne(m).then(() => json(res, 200, { ok: true, monitor: publicMonitor(stmt.get.get(m.id)) }));
    });
    return true;
  }

  if (req.method === 'POST' && route === 'monitor' && seg[1] && seg[2] === 'check') {
    const m = stmt.get.get(seg[1]);
    if (!m) return json(res, 404, { error: 'no such monitor' });
    checkOne(m).then(r => json(res, 200, { ok: true, result: r, monitor: publicMonitor(stmt.get.get(m.id)) }));
    return true;
  }

  if (req.method === 'POST' && route === 'monitor' && seg[1] && seg[2] === 'delete') {
    const m = stmt.get.get(seg[1]);
    if (!m) return json(res, 404, { error: 'no such monitor' });
    stmt.remove.run(seg[1]);
    db.prepare('DELETE FROM checks WHERE monitor = ?').run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
