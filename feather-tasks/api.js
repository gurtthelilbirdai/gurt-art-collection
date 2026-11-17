// Feather Tasks API: a shared task board for the flock.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'tasks.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    status TEXT NOT NULL DEFAULT 'todo',
    priority INTEGER NOT NULL DEFAULT 2,
    created TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    kind TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM tasks ORDER BY updated DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  insert: db.prepare('INSERT INTO tasks (id,title,notes,bird,status,priority,created,updated) VALUES (@id,@title,@notes,@bird,@status,@priority,@created,@updated)'),
  update: db.prepare('UPDATE tasks SET title=@title,notes=@notes,bird=@bird,status=@status,priority=@priority,updated=@updated WHERE id=@id'),
  del: db.prepare('DELETE FROM tasks WHERE id = ?'),
  events: db.prepare('SELECT * FROM events ORDER BY created DESC LIMIT 500'),
  taskEvents: db.prepare('SELECT * FROM events WHERE task = ? ORDER BY created DESC LIMIT 100'),
  insertEvent: db.prepare('INSERT INTO events (id,task,bird,kind,detail,created) VALUES (@id,@task,@bird,@kind,@detail,@created)')
};

const STATUSES = ['todo', 'doing', 'done'];

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
  const status = STATUSES.indexOf(body.status) >= 0 ? body.status : 'todo';
  const priority = Math.min(3, Math.max(1, Math.floor(Number(body.priority) || 2)));
  return {
    title: String(body.title || '').trim().slice(0, 100),
    notes: String(body.notes || '').trim().slice(0, 500),
    bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
    status,
    priority
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'tasks') {
    const rows = stmt.list.all();
    const events = stmt.events.all();
    return json(res, 200, {
      tasks: rows,
      events,
      total: rows.length,
      birds: new Set(rows.map(r => r.bird)).size,
      done: rows.filter(r => r.status === 'done').length
    });
  }

  if (req.method === 'POST' && route === 'tasks' && seg[1] === 'new') {
    readBody(req, body => {
      const f = clean(body);
      if (!f.title) return json(res, 400, { error: 'title required' });
      const now = new Date().toISOString();
      const task = Object.assign({ id: 'tk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), created: now, updated: now }, f);
      stmt.insert.run(task);
      const ev = { id: 'te' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), task: task.id, bird: task.bird, kind: 'created', detail: task.title, created: now };
      stmt.insertEvent.run(ev);
      return json(res, 200, { ok: true, task, event: ev });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'tasks' && seg[2] === 'update') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such task' });
    readBody(req, body => {
      const f = clean(Object.assign({}, row, body));
      if (!f.title) return json(res, 400, { error: 'title required' });
      const now = new Date().toISOString();
      const task = Object.assign({}, row, f, { updated: now });
      stmt.update.run(task);
      const ev = { id: 'te' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), task: task.id, bird: task.bird, kind: 'moved', detail: task.status, created: now };
      stmt.insertEvent.run(ev);
      return json(res, 200, { ok: true, task, event: ev });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'tasks' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such task' });
    stmt.del.run(seg[1]);
    db.prepare('DELETE FROM events WHERE task = ?').run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  if (req.method === 'GET' && route === 'tasks' && seg[2] === 'events') {
    return json(res, 200, { events: stmt.taskEvents.all(seg[1]) });
  }

  return false;
};
