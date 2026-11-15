// Feather Post API: a shared postal service for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'post.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS letters (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    stamp TEXT NOT NULL DEFAULT 'feather',
    delivered INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS letters_created ON letters(created DESC);
  CREATE INDEX IF NOT EXISTS letters_recipient ON letters(recipient);
`);

const stmt = {
  list: db.prepare('SELECT * FROM letters ORDER BY created DESC LIMIT 200'),
  inbox: db.prepare('SELECT * FROM letters WHERE recipient = ? ORDER BY created DESC LIMIT 100'),
  get: db.prepare('SELECT * FROM letters WHERE id = ?'),
  insert: db.prepare('INSERT INTO letters (id,sender,recipient,subject,body,stamp,delivered,created) VALUES (@id,@sender,@recipient,@subject,@body,@stamp,@delivered,@created)'),
  deliver: db.prepare('UPDATE letters SET delivered = 1 WHERE id = ? AND recipient = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM letters'),
  sent: db.prepare('SELECT COUNT(*) AS n FROM letters WHERE sender = ?')
};

function now() { return new Date().toISOString(); }
function birdName(v) { return String(v || '').trim().slice(0, 18) || 'anonymous bird'; }
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => { let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { b = {}; } cb(b); });
}
function publicLetter(r) {
  if (!r) return null;
  return {
    id: r.id, sender: r.sender, recipient: r.recipient, subject: r.subject,
    body: r.body, stamp: r.stamp, delivered: !!r.delivered, created: r.created
  };
}

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-post';
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

module.exports = async function handler(req, res, rest) {
  const route = rest.join('/');

  if (req.method === 'GET' && (route === 'letters' || route === 'letters/all')) {
    const rows = stmt.list.all().map(publicLetter);
    return json(res, 200, { letters: rows, total: rows.length });
  }

  if (req.method === 'GET' && route === 'letters/inbox') {
    const u = new URL(req.url, 'http://x');
    const bird = birdName(u.searchParams.get('bird'));
    const rows = stmt.inbox.all(bird).map(publicLetter);
    return json(res, 200, { letters: rows, bird });
  }

  if (req.method === 'POST' && route === 'letters') {
    readBody(req, body => {
      const sender = birdName(body.sender);
      const recipient = birdName(body.recipient);
      const subject = String(body.subject || '').trim().slice(0, 80);
      const text = String(body.body || '').trim().slice(0, 2000);
      if (!text) return json(res, 400, { error: 'a letter needs a body' });
      if (sender.toLowerCase() === recipient.toLowerCase()) return json(res, 400, { error: 'you cannot post a letter to yourself' });
      const stamp = ['feather', 'leaf', 'star', 'shell', 'seed'].includes(body.stamp) ? body.stamp : 'feather';
      const id = 'ltr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const created = now();
      stmt.insert.run({ id, sender, recipient, subject, body: text, stamp, delivered: 0, created });
      const letter = publicLetter(stmt.get.get(id));
      ntfy({ type: 'letter', letter });
      return json(res, 200, { ok: true, letter });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'letters/deliver') {
    readBody(req, body => {
      const id = String(body.id || '').slice(0, 60);
      const bird = birdName(body.bird);
      const l = stmt.get.get(id);
      if (!l) return json(res, 404, { error: 'no such letter' });
      if (l.recipient !== bird) return json(res, 403, { error: 'that letter is not addressed to you' });
      stmt.deliver.run(id, bird);
      return json(res, 200, { ok: true, letter: publicLetter(stmt.get.get(id)) });
    });
    return true;
  }

  if (req.method === 'GET' && route === 'stats') {
    return json(res, 200, { total: stmt.count.get().n });
  }

  return false;
};
