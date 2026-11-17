// Feather Meetup API: a shared board of flock meetups with RSVPs.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'meetups.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS meetups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    place TEXT NOT NULL DEFAULT '',
    when_at TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id TEXT PRIMARY KEY,
    meetup TEXT NOT NULL,
    bird TEXT NOT NULL,
    answer TEXT NOT NULL,
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM meetups ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM meetups WHERE id = ?'),
  insert: db.prepare('INSERT INTO meetups (id,title,place,when_at,notes,bird,created) VALUES (@id,@title,@place,@when_at,@notes,@bird,@created)'),
  del: db.prepare('DELETE FROM meetups WHERE id = ?'),
  rsvps: db.prepare('SELECT * FROM rsvps ORDER BY created DESC LIMIT 1000'),
  meetupRsvps: db.prepare('SELECT * FROM rsvps WHERE meetup = ? ORDER BY created ASC'),
  insertRsvp: db.prepare('INSERT INTO rsvps (id,meetup,bird,answer,created) VALUES (@id,@meetup,@bird,@answer,@created)')
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
function clean(body) {
  return {
    title: String(body.title || '').trim().slice(0, 100),
    place: String(body.place || '').trim().slice(0, 120),
    when_at: String(body.when_at || '').trim().slice(0, 60),
    notes: String(body.notes || '').trim().slice(0, 500),
    bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt'
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'meetups') {
    const rows = stmt.list.all();
    const rsvps = stmt.rsvps.all();
    return json(res, 200, {
      meetups: rows,
      rsvps,
      total: rows.length,
      birds: new Set(rows.map(r => r.bird)).size,
      going: rsvps.filter(r => r.answer === 'going').length
    });
  }

  if (req.method === 'POST' && route === 'meetups' && seg[1] === 'new') {
    readBody(req, body => {
      const f = clean(body);
      if (!f.title) return json(res, 400, { error: 'title required' });
      const now = new Date().toISOString();
      const m = Object.assign({ id: 'mu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), created: now }, f);
      stmt.insert.run(m);
      return json(res, 200, { ok: true, meetup: m });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'meetups' && seg[1] === 'rsvp') {
    readBody(req, body => {
      const meetup = String(body.meetup || '').trim();
      const bird = String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt';
      const answer = ['going', 'maybe', 'no'].indexOf(body.answer) >= 0 ? body.answer : 'maybe';
      if (!stmt.get.get(meetup)) return json(res, 404, { error: 'no such meetup' });
      const old = db.prepare('SELECT id FROM rsvps WHERE meetup = ? AND bird = ?').get(meetup, bird);
      const now = new Date().toISOString();
      let row;
      if (old) {
        db.prepare('UPDATE rsvps SET answer = ?, created = ? WHERE id = ?').run(answer, now, old.id);
        row = { id: old.id, meetup, bird, answer, created: now };
      } else {
        row = { id: 'rs' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), meetup, bird, answer, created: now };
        stmt.insertRsvp.run(row);
      }
      return json(res, 200, { ok: true, rsvp: row });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'meetups' && seg[1] === 'delete') {
    if (!stmt.get.get(seg[2])) return json(res, 404, { error: 'no such meetup' });
    stmt.del.run(seg[2]);
    db.prepare('DELETE FROM rsvps WHERE meetup = ?').run(seg[2]);
    return json(res, 200, { ok: true, removed: seg[2] });
  }

  if (req.method === 'GET' && route === 'meetups' && seg[2] === 'rsvps') {
    return json(res, 200, { rsvps: stmt.meetupRsvps.all(seg[2]) });
  }

  return false;
};
