// Feather Recipe API: a shared recipe shelf for the flock.
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'recipes.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saves (
    id TEXT PRIMARY KEY,
    recipe TEXT NOT NULL,
    bird TEXT NOT NULL,
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM recipes ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM recipes WHERE id = ?'),
  insert: db.prepare('INSERT INTO recipes (id,title,kind,ingredients,steps,notes,bird,created) VALUES (@id,@title,@kind,@ingredients,@steps,@notes,@bird,@created)'),
  del: db.prepare('DELETE FROM recipes WHERE id = ?'),
  saves: db.prepare('SELECT * FROM saves ORDER BY created DESC LIMIT 1000'),
  recipeSaves: db.prepare('SELECT * FROM saves WHERE recipe = ? ORDER BY created ASC'),
  insertSave: db.prepare('INSERT INTO saves (id,recipe,bird,created) VALUES (@id,@recipe,@bird,@created)')
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
    kind: String(body.kind || '').trim().slice(0, 40),
    ingredients: String(body.ingredients || '').trim().slice(0, 800),
    steps: String(body.steps || '').trim().slice(0, 2000),
    notes: String(body.notes || '').trim().slice(0, 500),
    bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt'
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'recipes') {
    const rows = stmt.list.all();
    const saves = stmt.saves.all();
    return json(res, 200, {
      recipes: rows,
      saves,
      total: rows.length,
      birds: new Set(rows.map(r => r.bird)).size,
      cooked: saves.length
    });
  }

  if (req.method === 'POST' && route === 'recipes' && seg[1] === 'new') {
    readBody(req, body => {
      const f = clean(body);
      if (!f.title) return json(res, 400, { error: 'title required' });
      const now = new Date().toISOString();
      const r = Object.assign({ id: 'rc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), created: now }, f);
      stmt.insert.run(r);
      return json(res, 200, { ok: true, recipe: r });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'recipes' && seg[1] === 'save') {
    readBody(req, body => {
      const recipe = String(body.recipe || '').trim();
      const bird = String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt';
      if (!stmt.get.get(recipe)) return json(res, 404, { error: 'no such recipe' });
      const old = db.prepare('SELECT id FROM saves WHERE recipe = ? AND bird = ?').get(recipe, bird);
      const now = new Date().toISOString();
      if (old) {
        db.prepare('DELETE FROM saves WHERE id = ?').run(old.id);
        return json(res, 200, { ok: true, removed: old.id });
      }
      const row = { id: 'sv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), recipe, bird, created: now };
      stmt.insertSave.run(row);
      return json(res, 200, { ok: true, save: row });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'recipes' && seg[1] === 'delete') {
    if (!stmt.get.get(seg[2])) return json(res, 404, { error: 'no such recipe' });
    stmt.del.run(seg[2]);
    db.prepare('DELETE FROM saves WHERE recipe = ?').run(seg[2]);
    return json(res, 200, { ok: true, removed: seg[2] });
  }

  if (req.method === 'GET' && route === 'recipes' && seg[2] === 'saves') {
    return json(res, 200, { saves: stmt.recipeSaves.all(seg[2]) });
  }

  return false;
};
