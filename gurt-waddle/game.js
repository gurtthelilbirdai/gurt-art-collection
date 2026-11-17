// Gurt's Waddle — game engine
(function () {
  const c = document.getElementById('c'), x = c.getContext('2d');
  const $ = id => document.getElementById(id);
  const T = 32, W = 25, H = 14, VW = 25, VH = 14;
  const LEVELS = window.LEVELS || [];
  // the public https copy cannot reach the plain-http backend (mixed
  // content), so it only tries its own origin and falls back to ntfy
  const API_BASES = location.protocol === 'https:' ? [] : ['', 'http://computer:8600'];
  async function api(path, opts) {
    const urls = [];
    for (const base of API_BASES) {
      urls.push(base + '/api/gurtwaddle' + path);
      if (base.indexOf('8600') >= 0) urls.push(base + '/gurtwaddle' + path);
    }
    for (const url of urls) {
      try { const r = await fetch(url, opts); if (r.ok) return await r.json(); } catch (e) {}
    }
    return null;
  }

  let grid, level, lives, coins, keys, score, elapsed = 0, state, p, enemies, bosses, cam;
  let platforms, checkpoint, spawn, maxLevel = 1, crumbling = [];
  let best = 0, muted = false, audio = null, runStart = 0;
  let safeFor = 0;
  let dailyMode = false, dailyLevel = 1, dailyLimit = 90, dailyPosted = false;
  let customMode = false, customRows = null, customTitle = '', levelRows = null;
  let storyMode = false, storyChapter = 0, storyLevel = 1;
  // ghost race: the fastest bird's run through this level, replayed beside you
  let ghost = null, ghostSamples = [], ghostTick = 0, ghostOn = true, ghostMsg = '';

  function beep(freq, dur, type) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.value = 0.04; g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  // region music: each area of the waddle has its own theme
  const THEME_FILES = [
    { from: 1,  to: 20,  file: 'music/garden.mp3' },
    { from: 21, to: 40,  file: 'music/frozen.mp3' },
    { from: 41, to: 60,  file: 'music/woods.mp3' },
    { from: 61, to: 80,  file: 'music/starfall.mp3' },
    { from: 81, to: 100, file: 'music/cellar.mp3' },
    { from: 101, to: 120, file: 'music/wind.mp3' }
  ];
  let theme = null, themeName = '';
  function playTheme(n) {
    if (!n) { if (theme) { theme.pause(); } return; }
    let f = null;
    for (const t of THEME_FILES) if (n >= t.from && n <= t.to) f = t.file;
    if (!f) return;
    if (themeName === f && theme) { if (theme.paused) theme.play().catch(()=>{}); return; }
    if (theme) { theme.pause(); theme = null; }
    themeName = f;
    try {
      theme = new Audio(f);
      theme.loop = true;
      theme.volume = 0.55;
      theme.play().catch(()=>{});
    } catch (e) {}
  }

  function loadLevel(n) {
    level = n;
    try { refreshMap(); } catch (e) {}
    levelRows = null;
    const src = (customMode && customRows) ? customRows : (LEVELS[n] || []);
    grid = src.map(r => r.split(''));
    let sx = 1, sy = 11;
    enemies = []; bosses = []; cam = 0; platforms = []; crumbling = [];
    checkpoint = null; spawn = { x: 1, y: 11 };
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx];
      if (ch === 'P') { sx = xx; sy = yy; spawn = { x: xx, y: yy }; }
      if (ch === 'B') bosses.push({ x: xx * T + 4, y: yy * T, baseY: yy * T, hoverY: (level === 80 || level === 100 || level === 119 ? 11 * T - 70 : yy * T - 18), w: 26, h: (level === 79 ? 58 : (level === 80 || level === 100 || level === 119 ? 44 : 26)), vx: level >= 41 ? -0.8 : -1.2, vx0: level >= 41 ? -0.8 : -1.2, vy: 0, hp: (level >= 60 && level !== 79) ? (level >= 119 ? 3 : (level >= 100 ? 3 : 2)) : (level >= 41 ? 1 : 2), maxHp: (level >= 60 && level !== 79) ? (level >= 119 ? 3 : (level >= 100 ? 3 : 2)) : (level >= 41 ? 1 : 2), dead: false, stun: 0, t: 0, x0: Math.max(1 * T, xx * T - 2 * T), x1: Math.min(23 * T, xx * T + 2 * T) });
      if (ch === 'C') checkpoint = { x: xx, y: yy };
      if (ch === 'c') crumbling.push({ x: xx, y: yy, timer: -1, back: 0 });
      if (ch === 'e') enemies.push({ kind: 'walker', x: xx * T + 4, y: yy * T + 4, w: 24, h: 24, vx: 1.1, vy: 0, dead: false, t: 0 });
      if (ch === 'f') enemies.push({ kind: 'flyer', x: xx * T + 4, y: yy * T + 4, w: 22, h: 22, vx: 1.3, vy: 0, dead: false, t: 0, base: yy * T, x0: xx * T, x1: Math.min(W * T - T, xx * T + T * 3) });
      if (ch === 'm') enemies.push({ kind: 'hammer', x: xx * T + 4, y: yy * T + 4, w: 26, h: 26, vx: 1.6, vy: 0, dead: false, t: 0, base: yy * T });
      if (ch === 'M') platforms.push({ kind: 'h', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: xx * T + T * 2, dx: 0, dy: 0 });
      if (ch === 'F') platforms.push({ kind: 'm', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: 21 * T, dx: 1.1, dy: 0, wait: 90 });
      if (ch === 'G') platforms.push({ kind: 'm', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: Math.max(4 * T, xx * T - 18 * T), dx: -1.1, dy: 0, wait: 30 });
      if (ch === 'V') platforms.push({ kind: 'v', x: xx * T, y: (yy + 1) * T, w: T * 2, h: 12, y0: (yy + 1) * T, y1: (yy - 5) * T, dx: 0, dy: -0.9, wait: 120 });
    }
    p = { x: sx * T + 4, y: sy * T + 4, w: 24, h: 24, vx: 0, vy: 0, onGround: false, face: 1, ride: null };
    ghostSamples = []; ghostTick = 0;
    loadGhost(level + 1);
    state = 'play';
    if (!muted) playTheme(level + 1); else playTheme(0);
    $('lvl').textContent = customMode ? customTitle : ((level + 1) + '/' + LEVELS.length);
    if (storyMode) showStoryText(storyLevel);
  }

  function loadCustomRows(rows, title) {
    customMode = true; customRows = rows; customTitle = title || 'custom level';
    award('playwright');
    levelRows = rows;
    level = 0;
    loadLevel(0);
    $('lvl').textContent = customTitle;
  }

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= W || ty < 0) return '#';
    if (ty >= H) return '.';
    return grid[ty][tx];
  }
  function solid(tx, ty) {
    const ch = tileAt(tx, ty);
    if (ch === 'D') return keys <= 0;
    if (ch === 'i') {
      // ice on the ground row is a slippery patch the bird walks across;
      // ice floating in the air is a solid block to climb
      const below = tileAt(tx, ty + 1);
      return !(below === '#' || below === 'c' || below === 'i');
    }
    return ch === '#' || ch === 'c';
  }
  function platform(tx, ty) { return tileAt(tx, ty) === '='; }

  function moveX(e, dx) {
    e.x += dx;
    const dir = dx > 0 ? 1 : -1;
    const tx = Math.floor((e.x + (dir > 0 ? e.w : 0)) / T);
    for (let ty = Math.floor(e.y / T); ty <= Math.floor((e.y + e.h - 1) / T); ty++) {
      if (solid(tx, ty)) {
        e.x = dir > 0 ? tx * T - e.w : (tx + 1) * T;
        e.vx = 0; return true;
      }
    }
    return false;
  }
  function moveY(e, dy) {
    const prevBottom = e.y + e.h;
    e.y += dy;
    const dir = dy > 0 ? 1 : -1;
    const ty = Math.floor((e.y + (dir > 0 ? e.h : 0)) / T);
    for (let tx = Math.floor(e.x / T); tx <= Math.floor((e.x + e.w - 1) / T); tx++) {
      if (solid(tx, ty)) {
        e.y = dir > 0 ? ty * T - e.h : (ty + 1) * T;
        e.vy = 0; return dir > 0;
      }
      // one-way platform: the walkable surface is the BOTTOM of the tile,
      // so catch a falling body as it crosses that bottom edge
      for (const row of [ty, ty - 1]) {
        if (row < 0) continue;
        const surf = (row + 1) * T;
        if (dir > 0 && platform(tx, row) && prevBottom <= surf + 24 && e.y + e.h >= surf) {
          e.y = surf - e.h;
          e.vy = 0; return true;
        }
      }
    }
    return false;
  }

  const keysDown = {};
  document.addEventListener('keydown', e => {
    keysDown[e.key.toLowerCase()] = true;
    if ([' ', 'arrowup', 'w'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keysDown[e.key.toLowerCase()] = false; });

  // touch controls: same keysDown map, so the game code stays simple
  function touchBtn(id, key) {
    const b = $(id); if (!b) return;
    const on = e => { e.preventDefault(); keysDown[key] = true; };
    const off = e => { e.preventDefault(); keysDown[key] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  }
  touchBtn('tleft', 'arrowleft'); touchBtn('tright', 'arrowright'); touchBtn('tjump', ' ');
  const touchRow = $('touch');
  function showTouch(on) {
    if (!touchRow) return;
    touchRow.style.display = on ? 'flex' : 'none';
    try { localStorage.setItem('waddle-touch', on ? '1' : '0'); } catch (e) {}
    const t = $('tgl'); if (t) t.textContent = on ? 'hide touch controls' : 'touch controls';
  }
  if ($('tgl')) $('tgl').onclick = () => showTouch(touchRow.style.display !== 'flex');
  try { showTouch(localStorage.getItem('waddle-touch') === '1'); } catch (e) {}
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) showTouch(true);

  function hurt(reason) {
    if (state !== 'play') return;
    window.__gurtHurt = reason;
    lives--; safeFor = 1.5; window.__gurtHurt = reason; beep(120, .3, 'sawtooth');
    $('lives').textContent = lives;
    if (lives <= 0) { gameOver(); return; }
    const keepScore = score, keepCoins = coins;
    loadLevel(level);
    score = keepScore; coins = keepCoins;
    if (checkpoint) { p.x = checkpoint.x * T + 4; p.y = checkpoint.y * T; }
    $('score').textContent = score; $('coins').textContent = coins;
  }
  let overlay = null;
  function gameOver() {
    state = 'over';
    saveRun();
    if (storyMode) {
      overlay = { title: 'the story waits for you', sub: 'press play to try this chapter again' };
      return;
    }
    overlay = { title: 'the waddle ends', sub: 'score ' + score + ' · press play to try again' };
  }
  function drawOverlay(title, sub) {
    x.fillStyle = 'rgba(8,14,26,.78)'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e8f1ff'; x.textAlign = 'center';
    x.font = 'bold 34px system-ui'; x.fillText(title, c.width / 2, c.height / 2 - 10);
    x.font = '16px system-ui'; x.fillStyle = '#9fc3e8'; x.fillText(sub, c.width / 2, c.height / 2 + 24);
    x.textAlign = 'left';
  }

  function update(dt) {
    if (state !== 'play') return;
    elapsed += dt;
    if (safeFor > 0) safeFor -= dt;
    // record the waddle for the ghost race (10 samples a second)
    ghostTick += dt;
    if (ghostTick >= 0.1) {
      ghostTick -= 0.1;
      if (ghostSamples.length < 6000) ghostSamples.push([Math.round(p.x), Math.round(p.y), p.face]);
    }
    if (dailyMode) {
      const left = Math.max(0, dailyLimit - elapsed);
      $('time').textContent = Math.floor(left);
      if (left <= 0) { dailyEnd(); return; }
    } else {
      $('time').textContent = Math.floor(elapsed);
    }

    const left = keysDown['arrowleft'] || keysDown['a'];
    const right = keysDown['arrowright'] || keysDown['d'];
    const jump = keysDown[' '] || keysDown['w'] || keysDown['arrowup'];

    let onIce = false;
    if (p.onGround) {
      const ix = Math.floor((p.x + p.w / 2) / T);
      const iy = Math.floor((p.y + p.h + 2) / T);
      onIce = tileAt(ix, iy) === 'i' || tileAt(Math.floor((p.x + 4) / T), iy) === 'i' ||
        tileAt(ix, iy - 1) === 'i' || tileAt(Math.floor((p.x + 4) / T), iy - 1) === 'i';
    }
    const accel = p.onGround ? 0.55 : 0.32; // ice keeps momentum, handled by friction
    if (left) { p.vx -= accel; p.face = -1; }
    if (right) { p.vx += accel; p.face = 1; }
    p.vx = Math.max(-5, Math.min(5, p.vx));
    if (!left && !right) p.vx *= p.onGround ? (onIce ? 0.985 : 0.78) : 0.94;

    // wind gardens: the air itself pushes the bird around
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 1) / T); ty++) {
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) {
        const wc = tileAt(tx, ty);
        if (wc === '>') { p.vx += 0.16; p.vx = Math.max(-7, Math.min(7, p.vx)); }
        else if (wc === '<') { p.vx -= 0.16; p.vx = Math.max(-7, Math.min(7, p.vx)); }
        else if (wc === 'U') { p.vy -= 0.42; p.onGround = false; }
      }
    }

    const wasGround = p.onGround;
    // a bird riding a moving platform stays glued to it
    if (p.ride) {
      const r = p.ride;
      const stillOn = p.x + p.w > r.x - 10 && p.x < r.x + r.w + 10 && Math.abs((p.y + p.h) - r.y) < 18;
      if (stillOn) { p.y = r.y - p.h; p.vy = 0; p.onGround = true; }
      else p.ride = null;
    }
    p.vy += 0.62;
    // a spring under the bird always wins over a normal jump, so the bird
    // gets the big launch instead of a short hop into the spikes
    let onSpring = false;
    if (wasGround) {
      const srow = Math.floor((p.y + p.h - 1) / T);
      for (const sx of [Math.floor((p.x + p.w / 2) / T), Math.floor((p.x + 4) / T), Math.floor((p.x + p.w - 4) / T)]) {
        if (tileAt(sx, srow) === 'S') { onSpring = true; break; }
      }
    }
    if (jump && wasGround) {
      p.vy = onSpring ? -17 : -12.8;
      p.onGround = false;
      beep(onSpring ? 700 : 520, .08, 'triangle');
    }
    if (!jump && p.vy < -5) p.vy += 0.35; // variable jump height

    moveX(p, p.vx);
    const prevFeet = p.y + p.h;
    const landed = moveY(p, p.vy);
    p.onGround = landed;
    // moving platforms catch a falling bird from above
    if (!p.onGround && p.vy > 0) {
      for (const pl of platforms) {
        if (prevFeet <= pl.y + 6 && p.y + p.h >= pl.y &&
            p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.ride = pl; break;
        }
      }
    }
    if (landed && !wasGround) {
      const ch = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h - 1) / T));
      if (ch === 'S') { p.vy = -16; beep(700, .12, 'triangle'); }
    }
    // spring tiles bounce the bird when it stands on them
    if (p.onGround) {
      // a spring tile sits in the row the bird stands in, so look at the
      // row just above the feet, not the row below them
      const srow2 = Math.floor((p.y + p.h - 1) / T);
      const sxs = [Math.floor((p.x + p.w / 2) / T), Math.floor((p.x + 4) / T), Math.floor((p.x + p.w - 4) / T)];
      for (const sx of sxs) {
        const sch = tileAt(sx, srow2);
        if (sch === 'S') { p.vy = -17; p.onGround = false; beep(700, .12, 'triangle'); break; }
      }
    }

    // crumbling roots: they hold for a moment, then fall away and grow back
    const feetX = Math.floor((p.x + p.w / 2) / T);
    const feetY = Math.floor((p.y + p.h + 3) / T);
    for (const cr of crumbling) {
      if (cr.timer >= 0) {
        // a root only gives way when nobody is standing on it
        if (cr.x === feetX && cr.y === feetY) { cr.timer = 0; continue; }
        cr.timer += dt;
        // only give way when the bird has moved off the root
        if (cr.timer > 0.55 && Math.abs(cr.x - feetX) > 1) { grid[cr.y][cr.x] = '.'; cr.timer = -1; cr.back = 2.5; }
      } else if (cr.back > 0) {
        cr.back -= dt;
        if (cr.back <= 0) grid[cr.y][cr.x] = 'c';
      }
    }
    if (p.onGround) {
      const ftx = Math.floor((p.x + p.w / 2) / T);
      const fty = Math.floor((p.y + p.h + 3) / T);
      for (const cr of crumbling) {
        if (cr.x === ftx && cr.y === fty && cr.timer < 0 && cr.back <= 0) {
          cr.timer = 0; beep(180, .08, 'square');
        }
      }
    }

    // tile interactions: scan every tile the bird's body touches, so a key
    // two rows above the floor can still be grabbed while jumping past it
    const ptx = Math.floor((p.x + p.w / 2) / T), pty = Math.floor((p.y + p.h / 2) / T);
    const ch = tileAt(ptx, pty);
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 1) / T); ty++) {
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) {
        const tc = tileAt(tx, ty);
        if (tc === 'o') { grid[ty][tx] = '.'; coins++; score += 10; beep(880, .06); }
        else if (tc === 'k') { grid[ty][tx] = '.'; keys++; score += 25; beep(990, .1); }
        else if (tc === 'H') { grid[ty][tx] = '.'; lives = Math.min(9, lives + 1); score += 50; $('lives').textContent = lives; beep(1320, .18, 'triangle'); }
        else if (tc === 'D' && keys > 0) { grid[ty][tx] = '.'; keys--; beep(300, .12, 'triangle'); }
      }
    }
    // the exit counts if ANY touched tile is E, not just the body centre,
    // so a fast bird cannot hop straight over the doorway
    // the exit is a doorway column: walking past its column counts,
    // even if the bird hops over the green tile
    let touchingExit = false;
    for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) {
      for (let ty = 0; ty < H; ty++) {
        if (tileAt(tx, ty) === 'E') { touchingExit = true; break; }
      }
      if (touchingExit) break;
    }
    if (touchingExit) {
      if (bosses.some(b => !b.dead)) { $('msg').textContent = 'the moths guard the exit — stomp them first'; beep(160, .12, 'sawtooth'); return; }
      if (customMode) { winCustom(); return; }
      if (storyMode) {
        // the story advances by its own script, not the normal level counter
        score += 100; $('score').textContent = score;
        storyNextLevel();
        return;
      }
      if (level === LEVELS.length - 1) { win(); return; }
      score += 100; level++;
      award('first-step');
      if (level + 1 >= 21) award('frozen-foot');
      if (level + 1 >= 41) award('lantern-lamp');
      if (level + 1 >= 61) award('star-chaser');
      if (level + 1 >= 81) award('root-digger');
      if (level + 1 > unlockedCount()) unlockTo(level + 1);
      try { localStorage.setItem('waddle-current', String(level + 1)); } catch (e) {}
      loadLevel(level); fillPicker(); beep(1200, .15, 'triangle'); return;
    }
    // spikes are the points at the bottom of their tile: a bird is only hurt
    // when its feet are down in the points, so a clean hop clears them
    const feet = p.y + p.h;
    const cx = p.x + p.w / 2;
    for (let hx = Math.floor(cx / T); hx <= Math.floor((cx + 0.5) / T); hx++) {
      for (let sy = Math.floor((p.y + 4) / T); sy <= Math.floor(feet / T); sy++) {
        if (tileAt(hx, sy) !== '^') continue;
        const top = sy * T, bottom = top + T;
        if (feet > top + 16 && feet < bottom + 8 && (p.vy > 0 || p.onGround)) { window.__gurtSpike = {hx, sy, px: Math.round(p.x), py: Math.round(p.y), feet: Math.round(feet), row: (grid[sy]||[]).join('')}; hurt('spikes'); return; }
      }
    }
    // water swallows the whole bird
    for (let hy = Math.floor(p.y / T); hy <= Math.floor((p.y + p.h - 1) / T); hy++) {
      for (let hx = Math.floor(p.x / T); hx <= Math.floor((p.x + p.w - 1) / T); hx++) {
        if (tileAt(hx, hy) === 'w') { hurt('water'); return; }
      }
    }

    // moving platforms (simulation)
    for (const pl of platforms) {
      if (pl.kind === 'h' || pl.kind === 'm') {
        if (pl.wait > 0) { pl.wait--; pl.moveX = 0; }
        else {
          pl.moveX = pl.dx; pl.x += pl.dx;
          if (pl.x <= pl.x0) { pl.x = pl.x0; pl.dx = 1.1; pl.wait = 90; }
          else if (pl.x >= pl.x1) { pl.x = pl.x1; pl.dx = -1.1; }
        }
      } else {
        if (pl.wait > 0) { pl.wait--; }
        else {
          pl.y += pl.dy;
          if (pl.y >= pl.y0) { pl.y = pl.y0; pl.dy = -0.9; pl.wait = 120; }
          if (pl.y <= pl.y1) { pl.y = pl.y1; pl.dy = 0.9; pl.wait = 120; }
        }
      }
      // ride the platform if the bird stands on it
      const feet = p.y + p.h;
      if (p.ride === pl) {
        // already aboard: the deck carries the bird, it never slips off
        p.x += (pl.moveX || 0); p.y += (pl.dy || 0);
        p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
      }
      if (p.onGround && feet >= pl.y - 14 && feet <= pl.y + 12 &&
          p.x + p.w > pl.x - 10 && p.x < pl.x + pl.w + 10) {
        // if we are already riding this deck the ride block above moved us,
        // so do not add the platform's travel a second time
        if (p.ride !== pl) p.x += (pl.moveX || 0);
        p.y += (pl.dy || 0); p.ride = pl;
        p.y = pl.y - p.h; p.vy = 0;
      }
    }

    window.__gurtDebug = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, ride: p.ride ? p.ride.x : -1, decks: platforms.map(pl => pl.x) };

    // a stale ride reference would teleport the bird back onto a deck
    if (p.ride && !platforms.some(pl => pl === p.ride &&
        p.x + p.w > pl.x && p.x < pl.x + pl.w &&
        Math.abs((p.y + p.h) - pl.y) < 20)) p.ride = null;

    // enemies (simulation)
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.kind === 'walker' || e.kind === 'hammer') {
        e.vy += 0.5;
        const blocked = moveX(e, e.vx);
        if (blocked) e.vx *= -1;
        moveY(e, e.vy);
        if (e.kind === 'hammer' && e.onGround !== true && e.vy > 0) { e.vy = 0; e.vx *= -1; }
        if (e.kind === 'hammer' && e.t > 1.2 && Math.abs(e.y - e.base) < 4) { e.vy = -7; e.t = 0; }
      } else if (e.kind === 'flyer') {
        e.x += e.vx;
        if (e.x <= e.x0) { e.x = e.x0; e.vx = 1.3; }
        if (e.x >= e.x1) { e.x = e.x1; e.vx = -1.3; }
        e.y = e.base + Math.sin(e.t * 2.2) * 40;
      }
      if (Math.abs(e.x - p.x) < 24 && Math.abs(e.y - p.y) < 24) {
        // stomp from above defeats the enemy
        // a stomp lands on the flyer's back: the bird's feet must be above the
        // flyer's middle, not perfectly on its head
        if (p.vy > 0 && p.y + p.h < e.y + 24) {
          e.dead = true; p.vy = -9; score += 75; beep(260, .12, 'sawtooth');
        } else { hurt(e.kind); return; }
      }
    }

    // bosses
    window.__gurtBosses = [];
    for (const boss of bosses) {
      if (boss.dead) continue;
      boss.t += dt;
      // moths hover: they bob over the garden instead of sinking to the floor
      boss.y = boss.hoverY + Math.sin(boss.t * 1.6) * 6;
      // moths patrol their own patch of garden and never hunt the bird
      if (Math.random() < 0.012) boss.vx *= -1;
      boss.vx = Math.max(-1.6, Math.min(1.6, boss.vx));
      boss.x += boss.vx;
      if (boss.x < boss.x0) { boss.x = boss.x0; boss.vx = Math.abs(boss.vx); }
      if (boss.x > boss.x1) { boss.x = boss.x1; boss.vx = -Math.abs(boss.vx); }
      if (boss.stun > 0) { boss.stun -= dt; if (boss.stun <= 0) boss.vx = boss.vx0; }
      const feet = p.y + p.h;
      // real body overlap: the bird must actually touch the moth
      const nearX = Math.abs(boss.x - p.x) < 58;
      // stomping: the bird must come down ON the moth's back, so its feet
      // have to be at or above the moth's top while falling. Standing on the
      // floor underneath the moth is not a stomp.
      // landing on the moth counts from any direction: a bird jumping up
      // into its back should not be punished for the sign of its velocity
      const landOn = nearX && feet >= boss.y - 70 && feet <= boss.y + 80;
      const stomping = landOn;
      const touching = nearX && feet > boss.y - 8 && p.y < boss.y + boss.h;
      const canStomp = stomping;
      window.__gurtBosses.push({ bx: Math.round(boss.x), by: Math.round(boss.y), hp: boss.hp, dead: boss.dead, stomping, touching, nearX });
      window.__gurtSafe = safeFor; window.__gurtStomps = (window.__gurtStomps||0); window.__gurtBoss = { bx: Math.round(boss.x), by: Math.round(boss.y), px: Math.round(p.x), py: Math.round(p.y), feet: Math.round(feet), vy: Math.round(p.vy), nearX, stomping, touching, hp: boss.hp };
      // a stomp always counts, even right after a hit: the bird must be able
      // to fight back instead of being helpless for a second and a half
      if (canStomp) {
        window.__gurtStomps++; boss.hp--; boss.stun = 0.9; boss.vx = 0; safeFor = 0.25; p.vy = -12; score += 50; beep(200, .15, 'sawtooth');
        if (boss.hp <= 0) { boss.dead = true; score += 200; beep(1400, .2, 'triangle'); }
        continue;
      }
      if (safeFor <= 0 && touching) {
        if (canStomp) {
          boss.hp--; boss.stun = 1.6; boss.vx = 0; safeFor = 0.3; p.vy = -12; score += 50; beep(200, .15, 'sawtooth');
          if (boss.hp <= 0) { boss.dead = true; score += 200; beep(1400, .2, 'triangle'); }
        } else if (p.vy > 3) {
          // only a real fall into the moth hurts; brushing past is safe
          hurt('moth');
        }
        return;
      }
    }

    if (p.y > H * T + 40) hurt('fall');
    const aliveB = bosses.filter(b => !b.dead).length;
    if ($('moths')) $('moths').textContent = aliveB;
    $('coins').textContent = coins; $('keys').textContent = keys; $('score').textContent = score;
    const posEl = $('pos'); if (posEl) posEl.textContent = 'x' + Math.floor(p.x / T) + ' y' + Math.floor(p.y / T) + ' B:' + bosses.map(b=>Math.floor(b.x/T)+','+Math.floor(b.y/T)+','+b.hp+(b.dead?'D':'')).join('|') + ' K:' + keys + ' E:' + enemies.filter(e=>!e.dead).map(e=>Math.floor(e.x/T)+','+Math.floor(e.y/T)+','+e.kind).join('|') + ' P:' + platforms.map(pl=>pl.kind+':'+Math.floor(pl.x/T)+','+Math.floor(pl.y/T)+','+Math.floor((pl.x+pl.w)/T)).join('|') + ' R:' + (p.ride ? Math.floor(p.ride.x/T) : -1) + ' PY:' + Math.round(p.y) + ' FY:' + Math.round(p.y+p.h) + ' VY:' + Math.round(p.vy) + ' BY:' + bosses.map(bb=>Math.round(bb.y)).join(',') + ' BX:' + bosses.map(bb=>Math.round(bb.x)).join(',');
  }


  // ---- story mode -------------------------------------------------------
  const STORY = window.STORY || [];
  function storyChapterFor(n) {
    for (let i = 0; i < STORY.length; i++) {
      const c = STORY[i];
      if (n >= c.levels[0].n && n <= c.levels[c.levels.length - 1].n) return i;
    }
    return 0;
  }
  function storyEntry(n) {
    const ci = storyChapterFor(n);
    const c = STORY[ci];
    if (!c) return null;
    return c.levels.find(l => l.n === n) || null;
  }
  function showStoryText(n) {
    const box = $('story'), line = $('storyline'), goal = $('storygoal');
    if (!box) return;
    const e = storyEntry(n);
    if (!e) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    line.textContent = e.line;
    goal.textContent = 'goal: ' + e.goal;
    const ci = storyChapterFor(n);
    const c = STORY[ci];
    const chap = $('storychap');
    if (chap) chap.textContent = c ? ('chapter ' + (ci + 1) + ' of ' + STORY.length + ' \u00b7 ' + c.title + ' \u00b7 level ' + n + ' of 120') : ('level ' + n);
  }
  function hideStoryText() { const b = $('story'); if (b) b.style.display = 'none'; }
  function startStory() {
    storyMode = true; customMode = false; customRows = null; levelRows = null;
    dailyMode = false;
    storyChapter = 0; storyLevel = 1;
    lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
    $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
    const c = STORY[0];
    loadLevel(0); // load a grid so the overlay has something to draw over
    overlay = { title: c.title, sub: c.intro + '  ·  press play to begin' };
    state = 'story';
    $('msg').textContent = 'story mode — chapter 1 of ' + STORY.length;
    hideStoryText();
  }
  function storyBeginChapter(ci) {
    const c = STORY[ci];
    if (!c) return;
    storyChapter = ci;
    storyLevel = c.levels[0].n;
    lives = 5; $('lives').textContent = lives;   // a new chapter, a new set of lives
    loadLevel(storyLevel - 1);
    overlay = { title: c.title, sub: c.intro + '  ·  press play to begin' };
    state = 'story';
    $('msg').textContent = 'story mode — chapter ' + (ci + 1) + ' of ' + STORY.length;
    hideStoryText();
  }
  function storyNextLevel() {
    const c = STORY[storyChapter];
    storyLevel++;
    const last = c.levels[c.levels.length - 1].n;
    if (storyLevel > last) {
      award('story-' + (storyChapter + 1));
      if (storyChapter + 1 < STORY.length) {
        const nc = STORY[storyChapter + 1];
        overlay = { title: 'chapter complete', sub: c.outro + '  ·  press play for ' + nc.title };
        state = 'story';
        storyPendingChapter = storyChapter + 1;
        hideStoryText();
        return;
      }
      storyMode = false;
      state = 'win'; score += lives * 100 + 500; saveRun();
      $('score').textContent = score;
      overlay = { title: 'the waddle ends, and begins', sub: c.outro + '  ·  score ' + score };
      hideStoryText();
      return;
    }
    overlay = null;
    state = 'play';
    loadLevel(storyLevel - 1);
    showStoryText(storyLevel);
    beep(1200, .15, 'triangle');
  }
  let storyPendingChapter = -1;

  function winCustom() {
    state = 'win'; score += lives * 100 + 500; saveRun();
    award('playwright');
    award('first-step');
    $('score').textContent = score;
    overlay = { title: 'you made it through!', sub: 'score ' + score + ' · the flock heard about this' };
  }

  function winTitle() {
    if (level >= 119) return 'you beat the wind moth!';
    if (level >= 99) return 'you beat the root moth!';
    if (level >= 79) return 'you beat the starfall moth!';
    if (level >= 59) return 'you beat the lantern moth!';
    return 'you beat the moon moth!';
  }
  function win() {
    if (dailyMode) { score += lives * 100 + 500; dailyEnd(); return; }
    if (storyMode) { score += lives * 100 + 500; $('score').textContent = score; storyNextLevel(); return; }
    state = 'win'; score += lives * 100 + 500; saveRun(); saveGhost();
    if (level >= 119) { award('wind-moth'); award('twenty'); }
    if (level >= 99) { award('root-moth'); award('hundred'); }
    else if (level >= 79) award('star-moth');
    else if (level >= 59) award('lantern-moth');
    else if (level >= 39) award('moon-moth');
    if (coins >= 100) award('coin-100');
    if (score >= 500) award('score-500');
    award('first-step');
    const reached = level + 1;
    if (reached >= 21) award('frozen-foot');
    if (reached >= 41) award('lantern-lamp');
    if (reached >= 61) award('star-chaser');
    if (reached >= 81) award('root-digger');
    if (reached >= 101) award('wind-walker');
    // the next level is now unlocked for this bird
    if (level + 2 > unlockedCount()) unlockTo(level + 2);
    try { localStorage.setItem('waddle-current', String(level + 2)); } catch (e) {}
    fillPicker();
    $('score').textContent = score;
    overlay = { title: winTitle(), sub: 'score ' + score + ' · the flock will hear about this' };
  }

  function draw() {
    if (!grid || !p || level == null) { window.__gurtState = state || 'loading'; return; }
    x.clearRect(0, 0, c.width, c.height);
    // background gradient by level
    const icy = level >= 20 && level < 40;
    const woods = level >= 40 && level < 60;
    const coast = level >= 60 && level < 80;
    const cellar = level >= 80 && level < 100;
    const gardens = level >= 100;
    const g = x.createLinearGradient(0, 0, 0, c.height);
    if (icy) {
      g.addColorStop(0, '#2b4f74'); g.addColorStop(0.55, '#3d6f99'); g.addColorStop(1, '#dcefff');
    } else {
      const hue = (level * 24) % 360;
      g.addColorStop(0, 'hsl(' + hue + ',45%,22%)'); g.addColorStop(1, 'hsl(' + hue + ',40%,12%)');
    }
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (cellar) {
      g.addColorStop(0, '#0d1410'); g.addColorStop(0.55, '#1b2a1e'); g.addColorStop(1, '#3d5136');
      x.fillStyle = g; x.fillRect(0, 0, 800, 450);
      // glowing spores drifting in the damp
      for (let i = 0; i < 50; i++) {
        const sx = (i * 149 + Math.sin(Date.now() / 1400 + i) * 22) % 800;
        const sy = (i * 83 + Math.cos(Date.now() / 1900 + i * 1.3) * 18) % 440;
        x.fillStyle = i % 4 ? '#9fffaa55' : '#c8ffd980';
        x.beginPath(); x.arc(sx, sy, 1.4 + (i % 3), 0, 7); x.fill();
      }
      // stone arches
      x.fillStyle = '#0a0f0b66';
      for (let i = 0; i < 4; i++) {
        const ax = i * 220 - 30;
        x.beginPath(); x.moveTo(ax, 450); x.lineTo(ax, 250); x.arc(ax + 55, 250, 55, Math.PI, 0); x.lineTo(ax + 110, 450); x.fill();
      }
    } else if (coast) {
      g.addColorStop(0, '#0b1030'); g.addColorStop(0.55, '#1d2a63'); g.addColorStop(1, '#3f6f9e');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      // slow falling stars
      x.fillStyle = '#ffffffcc';
      for (let i = 0; i < 60; i++) {
        const sx = (i * 137 + level * 13) % 800;
        const sy = ((i * 61 + Math.floor(Date.now() / 60) * (1 + i % 3)) % 450);
        x.beginPath(); x.arc(sx, sy, 1 + (i % 3) * 0.6, 0, 7); x.fill();
      }
      // the sea horizon with a moon path
      x.fillStyle = '#16305c';
      x.fillRect(0, 300, 800, 150);
      x.fillStyle = '#8fd8ff55';
      for (let i = 0; i < 30; i++) {
        const wx = (i * 53 + Math.floor(Date.now() / 300) * (i % 3)) % 800;
        const wy = 310 + (i * 17) % 130;
        x.fillRect(wx, wy, 14, 2);
      }
      x.fillStyle = '#ffe9a8';
      x.beginPath(); x.arc(650, 90, 26, 0, 7); x.fill();
      x.fillStyle = '#0b1030';
      x.beginPath(); x.arc(640, 82, 24, 0, 7); x.fill();
    } else if (woods) {
      g.addColorStop(0, '#241a12'); g.addColorStop(0.55, '#3d2a18'); g.addColorStop(1, '#6b4a26');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      // fireflies drifting between the roots
      for (let i = 0; i < 40; i++) {
        const fx = (i * 149 + Math.sin(Date.now() / 900 + i) * 30) % 800;
        const fy = (i * 71 + Math.cos(Date.now() / 1100 + i * 1.7) * 24) % 420;
        x.fillStyle = i % 3 ? '#ffd76a88' : '#ffe9a8cc';
        x.beginPath(); x.arc(fx, fy, 1.6 + (i % 3), 0, 7); x.fill();
      }
      // lantern glow along the floor
      for (let i = 0; i < 6; i++) {
        const lx = 40 + i * 140;
        const rg = x.createRadialGradient(lx, 400, 4, lx, 400, 70);
        rg.addColorStop(0, '#ffb34733'); rg.addColorStop(1, '#ffb34700');
        x.fillStyle = rg; x.fillRect(lx - 70, 330, 140, 140);
      }
    } else if (icy) {
      // falling snow
      x.fillStyle = '#ffffffcc';
      for (let i = 0; i < 70; i++) {
        const sx = (i * 137 + level * 13) % 800;
        const sy = ((i * 61 + Math.floor(Date.now() / 40) * (1 + i % 3)) % 450);
        x.beginPath(); x.arc(sx, sy, 1 + (i % 3) * 0.7, 0, 7); x.fill();
      }
      // distant icy peaks
      x.fillStyle = '#ffffff33';
      for (let i = 0; i < 5; i++) {
        const bx = i * 190 - 40, by = 300 + (i % 2) * 30;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + 90, by - 110); x.lineTo(bx + 180, by); x.fill();
      }
    } else {
      x.fillStyle = '#ffffff22';
      for (let i = 0; i < 40; i++) { const sx = (i * 97 + level * 13) % 800, sy = (i * 53) % 260; x.fillRect(sx, sy, 2, 2); }
    }

    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx], px = xx * T, py = yy * T;
      if (ch === '#') {
        if (cellar) {
      g.addColorStop(0, '#0d1410'); g.addColorStop(0.55, '#1b2a1e'); g.addColorStop(1, '#3d5136');
      x.fillStyle = g; x.fillRect(0, 0, 800, 450);
      // glowing spores drifting in the damp
      for (let i = 0; i < 50; i++) {
        const sx = (i * 149 + Math.sin(Date.now() / 1400 + i) * 22) % 800;
        const sy = (i * 83 + Math.cos(Date.now() / 1900 + i * 1.3) * 18) % 440;
        x.fillStyle = i % 4 ? '#9fffaa55' : '#c8ffd980';
        x.beginPath(); x.arc(sx, sy, 1.4 + (i % 3), 0, 7); x.fill();
      }
      // stone arches
      x.fillStyle = '#0a0f0b66';
      for (let i = 0; i < 4; i++) {
        const ax = i * 220 - 30;
        x.beginPath(); x.moveTo(ax, 450); x.lineTo(ax, 250); x.arc(ax + 55, 250, 55, Math.PI, 0); x.lineTo(ax + 110, 450); x.fill();
      }
    } else if (gardens) { x.fillStyle = '#4e7a3a'; x.fillRect(px, py, T, T); x.fillStyle = '#6ea14d'; x.fillRect(px, py, T, 4); }
        else if (coast) { x.fillStyle = '#c9b083'; x.fillRect(px, py, T, T); x.fillStyle = '#e3d3ab'; x.fillRect(px, py, T, 4); }
        else if (woods) { x.fillStyle = '#4a331d'; x.fillRect(px, py, T, T); x.fillStyle = '#5f4327'; x.fillRect(px, py, T, 4); }
        else if (icy) { x.fillStyle = '#d7eaf7'; x.fillRect(px, py, T, T); x.fillStyle = '#ffffff'; x.fillRect(px, py, T, 5); x.fillStyle = '#9fc6de'; x.fillRect(px, py + T - 5, T, 5); }
        else { x.fillStyle = '#3b5876'; x.fillRect(px, py, T, T); x.fillStyle = '#4d7398'; x.fillRect(px, py, T, 4); }
      }
      else if (ch === 'c') {
        x.fillStyle = '#6b4a2a'; x.fillRect(px, py, T, T);
        x.fillStyle = '#8a6338'; x.fillRect(px, py, T, 4);
        x.strokeStyle = '#3a2714'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(px + 6, py + 4); x.lineTo(px + 12, py + 15); x.lineTo(px + 7, py + 26);
        x.moveTo(px + 12, py + 15); x.lineTo(px + 22, py + 22); x.stroke();
      }
      else if (ch === '=') { if (coast) { x.fillStyle = '#a9855a'; x.fillRect(px, py + 20, T, 10); } else if (woods) { x.fillStyle = '#8a6338'; x.fillRect(px, py + 20, T, 10); } else if (icy) { x.fillStyle = '#bfe9ff'; x.fillRect(px, py + 20, T, 10); x.fillStyle = '#ffffff'; x.fillRect(px, py + 20, T, 3); } else { x.fillStyle = '#8b5a2b'; x.fillRect(px, py + 20, T, 10); } }
      else if (ch === 'o') { x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(px + 16, py + 16, 8, 0, 7); x.fill(); x.fillStyle = '#fff3b0'; x.fillRect(px + 13, py + 13, 5, 5); }
      else if (ch === 'k') { x.fillStyle = '#f5f5f5'; x.fillRect(px + 13, py + 8, 6, 16); x.fillRect(px + 8, py + 13, 16, 6); }
      else if (ch === 'D') { x.fillStyle = '#b5651d'; x.fillRect(px + 3, py + 2, T - 6, T - 2); x.fillStyle = '#ffd23f'; x.fillRect(px + 19, py + 16, 4, 4); }
      else if (ch === 'S') { x.fillStyle = '#45c26a'; x.fillRect(px + 6, py + 12, 20, 18); x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 6, 12, 8); }
      else if (ch === '^') { x.fillStyle = '#e05a5a'; x.beginPath(); x.moveTo(px + 4, py + 30); x.lineTo(px + 16, py + 6); x.lineTo(px + 28, py + 30); x.fill(); }
      else if (ch === 'i') { x.fillStyle = '#bfe9ff'; x.fillRect(px, py, T, T); x.fillStyle = '#7fc9ef'; x.fillRect(px, py + T - 6, T, 6); x.fillStyle = '#ffffffaa'; x.fillRect(px + 5, py + 6, 14, 3); }
      else if (ch === '>') {
        x.strokeStyle = '#bff3ffaa'; x.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const off = (Date.now() / 18 + k * 10 + xx * 7) % 32;
          x.beginPath(); x.moveTo(px - off + 8, py + 8 + k * 8); x.lineTo(px - off + 24, py + 8 + k * 8); x.stroke();
        }
      }
      else if (ch === '<') {
        x.strokeStyle = '#bff3ffaa'; x.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const off = (Date.now() / 18 + k * 10 + xx * 7) % 32;
          x.beginPath(); x.moveTo(px + off + 24, py + 8 + k * 8); x.lineTo(px + off + 8, py + 8 + k * 8); x.stroke();
        }
      }
      else if (ch === 'U') {
        x.strokeStyle = '#e8fff0aa'; x.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const off = (Date.now() / 14 + k * 11 + yy * 5) % 32;
          x.beginPath(); x.moveTo(px + 8 + k * 8, py + off + 26); x.lineTo(px + 8 + k * 8, py + off + 4); x.stroke();
        }
      }
      else if (ch === 'w') { x.fillStyle = coast ? '#2a5f9caa' : '#3aa6d8aa'; x.fillRect(px, py, T, T); x.fillStyle = '#8fd8ff'; x.fillRect(px + 4, py + 8 + Math.sin(Date.now() / 300 + xx) * 2, 12, 2); }
      else if (ch === 'P') { x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 10, 12, 20); }
      else if (ch === 'C') { x.fillStyle = '#45c26a'; x.fillRect(px + 14, py + 4, 4, 26); x.fillStyle = '#8ef0a8'; x.beginPath(); x.moveTo(px + 18, py + 4); x.lineTo(px + 30, py + 10); x.lineTo(px + 18, py + 16); x.fill(); }
      else if (ch === 'H') { x.fillStyle = '#ff6b8b'; x.beginPath(); x.arc(px + 12, py + 12, 7, 0, 7); x.arc(px + 20, py + 12, 7, 0, 7); x.fill(); x.beginPath(); x.moveTo(px + 5, py + 12); x.lineTo(px + 27, py + 12); x.lineTo(px + 16, py + 27); x.fill(); }
      else if (ch === 'E') { x.fillStyle = '#45c26a'; x.fillRect(px + 4, py + 2, T - 8, T - 2); x.fillStyle = '#0f1b2d'; x.fillRect(px + 8, py + 8, 16, 20); x.fillStyle = '#ffd23f'; x.fillRect(px + 18, py + 16, 4, 4); }
    }
    // moving platforms
    for (const pl of platforms) {
      x.fillStyle = '#c98a3d'; x.fillRect(pl.x, pl.y, pl.w, pl.h);
      x.fillStyle = '#e8b56a'; x.fillRect(pl.x, pl.y, pl.w, 4);
      x.fillStyle = '#8b5a2b'; x.fillRect(pl.x + 4, pl.y + pl.h, 4, 4); x.fillRect(pl.x + pl.w - 8, pl.y + pl.h, 4, 4);
    }
    // enemies
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.kind === 'walker') {
        x.fillStyle = '#e05a5a'; x.beginPath(); x.arc(e.x + 12, e.y + 12, 12, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(e.x + 5, e.y + 8, 5, 5); x.fillRect(e.x + 15, e.y + 8, 5, 5);
        x.fillStyle = '#111'; x.fillRect(e.x + 7, e.y + 10, 3, 3); x.fillRect(e.x + 17, e.y + 10, 3, 3);
      } else if (e.kind === 'flyer') {
        x.fillStyle = '#ffb347'; x.beginPath(); x.ellipse(e.x + 11, e.y + 11, 11, 9, 0, 0, 7); x.fill();
        x.fillStyle = '#ffd88a'; x.beginPath(); x.ellipse(e.x + 3, e.y + 6, 7, 5, -0.5 + Math.sin(e.t * 12) * 0.3, 0, 7); x.fill();
        x.beginPath(); x.ellipse(e.x + 19, e.y + 6, 7, 5, 0.5 - Math.sin(e.t * 12) * 0.3, 0, 7); x.fill();
      } else if (e.kind === 'hammer') {
        x.fillStyle = '#7a4fbf'; x.fillRect(e.x + 2, e.y + 8, 22, 16);
        x.fillStyle = '#b79ae8'; x.fillRect(e.x + 8, e.y + 2, 10, 8);
        x.fillStyle = '#fff'; x.fillRect(e.x + 6, e.y + 12, 4, 4); x.fillRect(e.x + 16, e.y + 12, 4, 4);
      }
    }
    // bosses
    window.__gurtBosses = [];
    for (const boss of bosses) {
      if (boss.dead) continue;
      x.fillStyle = '#d9c6ff'; x.beginPath(); x.ellipse(boss.x + 13, boss.y + 13, 15, 13, Math.sin(boss.t) * 0.2, 0, 7); x.fill();
      x.fillStyle = '#8f6fd1'; x.beginPath(); x.ellipse(boss.x + 4, boss.y + 8, 9, 6, -0.5, 0, 7); x.fill();
      x.beginPath(); x.ellipse(boss.x + 22, boss.y + 8, 9, 6, 0.5, 0, 7); x.fill();
      x.fillStyle = '#241a3a'; x.fillRect(boss.x + 8, boss.y + 10, 4, 4); x.fillRect(boss.x + 15, boss.y + 10, 4, 4);
      x.fillStyle = '#ff8f8f'; x.fillRect(boss.x + 4, boss.y + 26, 18 * (boss.hp / (boss.maxHp || 2)), 3);
    }
    // player: round blue bird
    x.fillStyle = '#4aa8ff'; x.beginPath(); x.arc(p.x + 12, p.y + 12, 12, 0, 7); x.fill();
    x.fillStyle = '#7cc6ff'; x.beginPath(); x.arc(p.x + 8, p.y + 8, 6, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x + 12 + p.face * 4, p.y + 10, 4, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(p.x + 13 + p.face * 4, p.y + 10, 2, 0, 7); x.fill();
    x.fillStyle = '#ffb347'; x.beginPath(); x.moveTo(p.x + 12 + p.face * 7, p.y + 14); x.lineTo(p.x + 12 + p.face * 15, p.y + 16); x.lineTo(p.x + 12 + p.face * 7, p.y + 18); x.fill();
    x.fillStyle = '#2f7fd1'; x.beginPath(); x.ellipse(p.x + 12, p.y + 21, 8, 5, 0, 0, 7); x.fill();
    // ghost bird: the fastest run through this level, replayed beside you
    if (ghostOn && ghost && ghost.samples && ghost.samples.length) {
      const gi = Math.min(ghost.samples.length - 1, Math.floor(elapsed * 10));
      const gs = ghost.samples[gi];
      if (gs) {
        // the ghost floats a little above the ground so it never hides behind the player
        const gx = gs[0], gy = gs[1] - 22, gf = gs[2] || 1;
        x.globalAlpha = 0.55;
        x.fillStyle = '#c9a6ff'; x.beginPath(); x.arc(gx + 12, gy + 12, 12, 0, 7); x.fill();
        x.fillStyle = '#efe4ff'; x.beginPath(); x.arc(gx + 12 + gf * 4, gy + 10, 4, 0, 7); x.fill();
        x.fillStyle = '#2a1a44'; x.beginPath(); x.arc(gx + 13 + gf * 4, gy + 10, 2, 0, 7); x.fill();
        x.fillStyle = '#ffb347'; x.beginPath(); x.moveTo(gx + 12 + gf * 7, gy + 14); x.lineTo(gx + 12 + gf * 15, gy + 16); x.lineTo(gx + 12 + gf * 7, gy + 18); x.fill();
        x.globalAlpha = 1;
      }
    }
    if (state === 'over') drawOverlay('the waddle ends', 'score ' + score + ' \u00b7 press play to try again');
    if (state === 'win') drawOverlay(winTitle(), 'score ' + score + ' \u00b7 the flock will hear about this');
    if (overlay) drawOverlay(overlay.title, overlay.sub);
    window.__gurtState = state; window.__gurtOverlay = overlay ? overlay.title : '';
    window.__gurtGrid = grid;
  }

  window.addEventListener('error', e => { const m=$('msg'); if(m) m.textContent='ERR: '+e.message; });
  window.addEventListener('unhandledrejection', e => { const m=$('msg'); if(m) m.textContent='ERR: '+(e.reason&&e.reason.message||e.reason); });

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  const MEDALS = window.MEDALS || [];
  const awarded = new Set();
  try { for (const m of JSON.parse(localStorage.getItem('waddle-medals') || '[]')) awarded.add(m); } catch (e) {}
  refreshMedalCount();
  function birdName() { return ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt'; }
  function award(id) {
    if (!id || awarded.has(id)) return;
    const def = MEDALS.find(m => m.id === id);
    if (!def) return;
    awarded.add(id);
    try { localStorage.setItem('waddle-medals', JSON.stringify([...awarded])); } catch (e) {}
    const bird = birdName();
    const at = new Date().toISOString();
    api('/medals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bird, medal: id }) })
      .catch(() => {});
    ntfyPostProgress({ type: 'medal', bird, medal: id, at });
    showMedal(def);
    refreshMedalCount();
  }
  function refreshMedalCount() {
    const el = $('medalcount');
    if (!el) return;
    const n = awarded.size;
    el.textContent = n ? '\u{1F947} ' + n + ' medal' + (n === 1 ? '' : 's') + ' earned' : '';
  }
  function showMedal(def) {
    const old = $('medalpop');
    if (old) old.remove();
    const b = document.createElement('div');
    b.id = 'medalpop';
    b.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#17301f;border:1px solid #4c8f5f;color:#d8ffe0;padding:8px 14px;border-radius:10px;font:14px system-ui;z-index:99;box-shadow:0 4px 14px #0006';
    b.textContent = def.icon + '  medal earned: ' + def.name;
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.remove(); }, 3200);
  }
  function saveRun() {
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    api('/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bird, score, coins, level: level + 1, seconds: Math.floor(elapsed) })
    }).then(d => { if (d && d.rank) { $('board').dataset.msg = 'rank ' + d.rank; } loadBoard(); });
    saveLocalRun({ bird, score, coins, level: level + 1, seconds: Math.floor(elapsed) });
    ntfyPostProgress({ type: 'run', bird, score: Math.max(0, score || 0), coins: Math.max(0, coins || 0), level: level + 1, seconds: Math.floor(elapsed), at: new Date().toISOString() });
  }
  function localRuns() {
    try { return JSON.parse(localStorage.getItem('waddle-runs') || '[]'); } catch (e) { return []; }
  }
  function saveLocalRun(r) {
    try { const l = localRuns(); l.push(r); l.sort((a, b) => b.score - a.score); localStorage.setItem('waddle-runs', JSON.stringify(l.slice(0, 50))); } catch (e) {}
  }
  function localBoard() {
    const rows = localRuns().slice(0, 10).map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.bird + '</td><td>' + s.score + '</td><td>' + s.level + '</td></tr>').join('');
    $('board').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">no waddlers yet</td></tr>';
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dailyLevelFor(date) {
    // same level for every bird on a given day
    const n = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 86400000);
    return ((n % 100) + 100) % 100 + 1;
  }
  function dailyEnd() {
    if (dailyPosted) return;
    dailyPosted = true;
    state = 'over';
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    const payload = { date: todayStr(), bird, score: Math.max(0, score || 0), level: dailyLevel };
    api('/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(d => { if (d) drawDailyBoard(d.scores); })
      .catch(() => {});
    ntfyPostProgress({ type: 'daily', date: payload.date, bird, score: payload.score, level: payload.level, at: new Date().toISOString() });
    award('daily-waddle');
    overlay = { title: 'time!', sub: 'daily score ' + payload.score + ' · the flock will see this' };
    loadDailyBoard();
  }
  function drawDailyBoard(rows) {
    const box = $('dailyboard');
    if (!box) return;
    const list = (rows || []).slice(0, 10);
    box.innerHTML = list.length
      ? list.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + r.bird + '</td><td>' + r.score + '</td><td>L' + r.level + '</td></tr>').join('')
      : '<tr><td colspan="4">nobody has waddled today yet</td></tr>';
  }
  function loadDailyBoard() {
    const date = todayStr();
    api('/daily?date=' + date).then(d => { if (d) drawDailyBoard(d.scores); }).catch(() => {});
    ntfyGetDaily(date).then(rows => { if (rows && rows.length) drawDailyBoard(rows); });
  }
  async function ntfyGetDaily(date) {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url + '/json?poll=1&since=all', { cache: 'no-store' });
        if (!r.ok) continue;
        const lines = (await r.text()).split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        const best = {};
        for (const m of lines) {
          let d = m.message;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { continue; } }
          if (!d || d.type !== 'daily' || d.date !== date) continue;
          const k = d.bird;
          if (!best[k] || Number(d.score) > Number(best[k].score)) best[k] = d;
        }
        return Object.values(best).sort((a, b) => Number(b.score) - Number(a.score));
      } catch (e) {}
    }
    return [];
  }
  window.__gurtDailyEnd = dailyEnd;
  window.__gurtAward = award;
  window.__gurtWin = win;
  // test hooks: advance in place without a page reload, so a recording bot
  // can walk all hundred levels without losing its frame
  window.__gurtGo = function (n) { if (n >= 1 && n <= LEVELS.length) { level = n - 1; loadLevel(level); } };
  window.__gurtNext = function () { if ((level || 0) + 1 < LEVELS.length) { level = level + 1; loadLevel(level); } };
  window.__gurtRetry = function () { lives = 5; $('lives').textContent = 5; loadLevel(level); };
  window.__gurtWinCustom = winCustom;
  function startDaily() {
    dailyMode = true; dailyPosted = false;
    dailyLevel = dailyLevelFor(todayStr());
    dailyLimit = 90;
    const q = new URLSearchParams(location.search);
    q.set('daily', '1');
    try { localStorage.setItem('waddle-current', String(dailyLevel)); } catch (e) {}
    location.search = q.toString();
  }
  function loadBoard() {
    api('/scores').then(d => {
      if (!d) { localBoard(); return; }
      const rows = (d.scores || []).slice(0, 10).map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.bird + '</td><td>' + s.score + '</td><td>' + s.level + '</td></tr>').join('');
      $('board').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">no waddlers yet</td></tr>';
    }).catch(() => { localBoard(); });
  }

  async function ntfyGetRuns() {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url + '/json?poll=1&since=all', { cache: 'no-store' });
        if (!r.ok) continue;
        const lines = (await r.text()).split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        const runs = [];
        for (const m of lines) {
          let d = m.message;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { continue; } }
          if (!d || d.type !== 'run') continue;
          runs.push({ bird: String(d.bird || 'bird').slice(0, 18), score: Number(d.score) || 0, coins: Number(d.coins) || 0, level: Number(d.level) || 1, seconds: Number(d.seconds) || 0, at: d.at || '' });
        }
        if (runs.length) return runs;
      } catch (e) {}
    }
    return [];
  }
  function flockStatsFromRuns(runs) {
    const birds = {};
    let best = 0, deepest = 0, coins = 0;
    for (const r of runs) {
      coins += r.coins;
      best = Math.max(best, r.score);
      deepest = Math.max(deepest, r.level);
      const b = birds[r.bird] || (birds[r.bird] = { bird: r.bird, score: 0, level: 0, runs: 0 });
      b.score = Math.max(b.score, r.score);
      b.level = Math.max(b.level, r.level);
      b.runs++;
    }
    const list = Object.values(birds).sort((a, b) => b.score - a.score);
    return { stats: { runs: runs.length, birds: list.length, best, deepest, coins }, birds: list };
  }
  function drawFlockStats(d) {
    const box = $('flockstats'), tbl = $('flockbirds');
    if (!box || !tbl) return;
    const st = d.stats;
    box.textContent = st.runs + ' run' + (st.runs === 1 ? '' : 's') + ' \u00b7 ' + st.birds + ' bird' + (st.birds === 1 ? '' : 's') + ' \u00b7 best score ' + st.best + ' \u00b7 deepest level ' + st.deepest + ' \u00b7 ' + st.coins + ' coins waddled';
    const rows = (d.birds || []).map((b, i) => '<tr><td>' + (i + 1) + '. ' + b.bird + '</td><td>' + b.score + '</td><td>' + b.level + '</td></tr>').join('');
    tbl.querySelector('tbody').innerHTML = rows || '<tr><td colspan="3">no waddlers yet</td></tr>';
  }
  function loadFlockStats() {
    const box = $('flockstats'), tbl = $('flockbirds');
    if (!box || !tbl) return;
    api('/stats').then(d => {
      if (d && d.stats) { drawFlockStats(d); return; }
      ntfyGetRuns().then(runs => {
        if (runs.length) { drawFlockStats(flockStatsFromRuns(runs)); return; }
        const local = JSON.parse(localStorage.getItem('waddle-runs') || '[]');
        box.textContent = local.length + ' local run' + (local.length === 1 ? '' : 's') + ' \u00b7 the shared flock board is sleeping, try again when it wakes';
        tbl.querySelector('tbody').innerHTML = '<tr><td colspan="3">the shared board is sleeping</td></tr>';
      });
    }).catch(() => {
      ntfyGetRuns().then(runs => { if (runs.length) drawFlockStats(flockStatsFromRuns(runs)); else box.textContent = 'the shared flock board is sleeping'; });
    });
  }

  function unlockedCount() {
    const n = parseInt(localStorage.getItem('waddle-progress') || '1', 10);
    return Math.min(LEVELS.length, Math.max(1, isNaN(n) ? 1 : n));
  }
  function saveProgress(n) {
    try { localStorage.setItem('waddle-progress', String(Math.min(LEVELS.length, Math.max(1, n)))); } catch (e) {}
  }
  function fillPicker() {
    const sel = $('levels');
    if (!sel) return;
    const max = unlockedCount();
    let html = '';
    for (let i = 1; i <= max; i++) html += '<option value="' + i + '">level ' + i + '</option>';
    sel.innerHTML = html;
    sel.value = String(Math.min(max, (level || 0) + 1));
  }
  function goToLevel(n) {
    n = Math.max(1, Math.min(LEVELS.length, n));
    // only earned levels can be entered; the next-level button must not
    // quietly unlock the door in front of it
    if (n > unlockedCount()) { $('msg').textContent = 'that level is still locked'; return; }
    const q = new URLSearchParams(location.search);
    q.set('level', n);
    try { localStorage.setItem('waddle-current', String(n)); } catch (e) {}
    location.search = q.toString();
  }
  function unlockTo(n) {
    if (n > unlockedCount()) saveProgress(n);
    syncProgress();
  }
  let cloudLevel = 1;
  const NTFY = 'https://ntfy.nerdvpn.de/gurt-feather-waddle';
  const NTFY_ALT = 'https://ntfy.sh/gurt-feather-waddle';
  async function ntfyPostProgress(payload) {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) return true;
      } catch (e) {}
    }
    return false;
  }
  async function ntfyGetGhost(level) {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url + '/json?poll=1&since=all', { cache: 'no-store' });
        if (!r.ok) continue;
        const lines = (await r.text()).split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        let best = null;
        for (const m of lines) {
          let d = m.message;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { continue; } }
          if (!d || d.type !== 'ghost' || Number(d.level) !== Number(level)) continue;
          if (!d.samples || !d.samples.length) continue;
          if (!best || Number(d.seconds) < Number(best.seconds)) best = d;
        }
        if (best) return best;
      } catch (e) {}
    }
    return null;
  }
  async function loadGhost(level) {
    ghost = null; ghostMsg = '';
    const d = await api('/ghost?level=' + level);
    if (d && d.ghost) { ghost = d.ghost; }
    else {
      const g = await ntfyGetGhost(level);
      if (g) ghost = { level: g.level, bird: g.bird, samples: g.samples, seconds: g.seconds };
    }
    window.__gurtGhost = ghost;
    if (ghost && ghost.samples && ghost.samples.length) {
      ghostMsg = 'racing ' + (ghost.bird || 'a bird') + ' — ' + (Math.round(Number(ghost.seconds) * 10) / 10) + 's';
      if (!storyMode) $('msg').textContent = ghostMsg;
      if ($('ghostinfo')) $('ghostinfo').textContent = ghostMsg + " · the pale bird is the flock's fastest run";
    }
  }
  async function saveGhost() {
    if (!ghostSamples.length) return;
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    const payload = { bird, level: level + 1, seconds: Math.max(0.1, elapsed), samples: ghostSamples.slice(0, 4000), at: new Date().toISOString() };
    try {
      await api('/ghost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {}
    await ntfyPostProgress({ type: 'ghost', ...payload });
  }
  async function ntfyGetCustom(id) {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url + '/json?poll=1&since=all', { cache: 'no-store' });
        if (!r.ok) continue;
        const lines = (await r.text()).split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        for (const m of lines) {
          let d = m.message;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { continue; } }
          if (d && d.type === 'custom' && d.id === id && d.v === 2) return d;
        }
      } catch (e) {}
    }
    return null;
  }
  async function ntfyGetProgress(bird) {
    for (const url of [NTFY, NTFY_ALT]) {
      try {
        const r = await fetch(url + '/json?poll=1&since=all', { cache: 'no-store' });
        if (!r.ok) continue;
        const lines = (await r.text()).split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        let best = 1;
        for (const m of lines) {
          let d = m.message;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { continue; } }
          if (!d || d.type !== 'progress') continue;
          if (d.bird !== bird) continue;
          best = Math.max(best, Number(d.level) || 1);
        }
        return best;
      } catch (e) {}
    }
    return 1;
  }
  function applyCloudLevel(n) {
    n = Math.max(1, Math.min(LEVELS.length, Number(n) || 1));
    cloudLevel = Math.max(cloudLevel, n);
    if (cloudLevel > unlockedCount()) { saveProgress(cloudLevel); fillPicker(); buildMap(); refreshMap(); }
    return cloudLevel;
  }
  function syncProgress() {
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    api('/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bird, level: unlockedCount(), score: Math.max(0, score || 0), coins: Math.max(0, coins || 0) })
    }).then(d => {
      if (d && d.progress && d.progress.level > cloudLevel) {
        applyCloudLevel(d.progress.level);
        $('msg').textContent = 'the flock reached level ' + cloudLevel + ' — unlocked for you';
      }
    }).catch(() => {});
    // the public shared board: works even when the private backend sleeps
    ntfyPostProgress({ type: 'progress', bird, level: unlockedCount(), score: Math.max(0, score || 0), coins: Math.max(0, coins || 0), at: new Date().toISOString() });
  }
  function loadCloudProgress() {
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    api('/progress?bird=' + encodeURIComponent(bird)).then(d => {
      if (d && d.progress) applyCloudLevel(d.progress.level || 1);
    }).catch(() => {});
    ntfyGetProgress(bird).then(n => {
      if (n > unlockedCount()) {
        applyCloudLevel(n);
        $('msg').textContent = 'the flock reached level ' + n + ' — unlocked for you';
      }
    });
  }

  const REGIONS = [
    { name: 'the garden', from: 1, to: 20 },
    { name: 'frozen north', from: 21, to: 40 },
    { name: 'lantern woods', from: 41, to: 60 },
    { name: 'starfall coast', from: 61, to: 80 },
    { name: 'root cellar', from: 81, to: 100 },
    { name: 'wind gardens', from: 101, to: 120 }
  ];
  function buildMap() {
    const box = $('map'); if (!box) return;
    const max = unlockedCount();
    let html = '<h3 style="margin:6px 0 0;text-align:center">the waddle map</h3>';
    for (const r of REGIONS) {
      html += '<div class="region"><b>' + r.name + '</b>';
      for (let n = r.from; n <= r.to; n++) {
        const cls = n > max ? 'locked' : (n < max ? 'done' : '');
        html += '<button class="' + cls + '" data-lv="' + n + '"' + (n > max ? ' disabled' : '') + '>' + n + '</button>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('button[data-lv]').forEach(b => {
      b.onclick = () => goToLevel(parseInt(b.dataset.lv, 10));
    });
  }
  function refreshMap() {
    const box = $('map'); if (!box) return;
    const cur = (level || 0) + 1;
    box.querySelectorAll('button[data-lv]').forEach(b => {
      const n = parseInt(b.dataset.lv, 10);
      b.classList.toggle('cur', n === cur);
    });
  }

  $('play').onclick = () => {
    if (storyMode && state === 'story') {
      if (storyPendingChapter >= 0) { const ci = storyPendingChapter; storyPendingChapter = -1; storyBeginChapter(ci); }
      else { overlay = null; state = 'play'; loadLevel(storyLevel - 1); showStoryText(storyLevel); }
      return;
    }
    if (storyMode) {
      if (state === 'over') {
        // died in the story: give the chapter fresh lives and try that level again
        lives = 5; $('lives').textContent = lives;
        overlay = null; state = 'play';
        loadLevel(storyLevel - 1);
        showStoryText(storyLevel);
        $('msg').textContent = 'story mode — chapter ' + (storyChapter + 1) + ' of ' + STORY.length;
        return;
      }
      if (state === 'play') {
        // play is already running: in story mode this button means
        // "restart this story level", never "leave the story"
        lives = 5; $('lives').textContent = lives;
        overlay = null; state = 'play';
        loadLevel(storyLevel - 1);
        showStoryText(storyLevel);
        $('msg').textContent = 'story mode — chapter ' + (storyChapter + 1) + ' of ' + STORY.length;
        return;
      }
      storyMode = false; hideStoryText(); reset(); return;
    }
    reset();
  };
  if ($('storybtn')) $('storybtn').onclick = () => startStory();
  if ($('ghostbtn')) $('ghostbtn').onclick = () => {
    ghostOn = !ghostOn;
    $('ghostbtn').textContent = 'ghost: ' + (ghostOn ? 'on' : 'off');
    $('ghostinfo').textContent = ghostOn ? (ghostMsg || 'no ghost run for this level yet — finish it to leave one') : 'ghost hidden';
  };
  window.__gurtStory = { start: startStory, win: () => { if (storyMode) win(); }, jump: n => { if (storyMode) { storyChapter = storyChapterFor(n); storyLevel = n; overlay = null; state = 'play'; loadLevel(n-1); showStoryText(n); } }, level: () => storyLevel, chapter: () => storyChapter, state: () => state };
  if ($('daily')) $('daily').onclick = () => startDaily();
  $('go').onclick = () => { const v = parseInt($('levels').value, 10); if (!isNaN(v)) goToLevel(v); };
  $('next').onclick = () => { goToLevel((level || 0) + 1); };
  $('mute').onclick = () => {
    muted = !muted;
    $('mute').textContent = 'sound: ' + (muted ? 'off' : 'on');
    if (muted) playTheme(0); else playTheme(level + 1);
  };
  // browsers block autoplay, so the theme starts on the first real gesture
  function kickMusic() {
    if (muted || !themeName) return;
    if (!theme) theme = new Audio(themeName);
    theme.loop = true; theme.volume = 0.55;
    if (theme.paused) theme.play().catch(()=>{});
  }
  window.addEventListener('pointerdown', kickMusic);
  window.addEventListener('keydown', kickMusic);
  $('name').onchange = () => saveRun();

  function reset() {
    overlay = null;
    storyMode = false; storyPendingChapter = -1; hideStoryText();
    const q0 = new URLSearchParams(location.search);
    if (q0.get('story') === '1') { startStory(); return; }
    if (q0.get('daily') === '1') {
      dailyMode = true; dailyPosted = false;
      dailyLevel = dailyLevelFor(todayStr());
      dailyLimit = 90;
      lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
      $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = dailyLimit;
      loadLevel(dailyLevel - 1);
      $('msg').textContent = 'daily waddle: level ' + dailyLevel + ' · 90 seconds · beat the clock';
      return;
    }
    dailyMode = false;
    const draft = q0.get('draft');
    if (draft) {
      lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
      $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
      try {
        const rows = atob(draft).split('\n');
        loadCustomRows(rows, 'draft test');
        $('msg').textContent = 'testing your draft — reach the exit!';
      } catch (e) { $('msg').textContent = 'that draft could not be read'; }
      return;
    }
    const cid = q0.get('custom');
    if (cid) {
      lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
      $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
      const id = cid.slice(0, 40);
      api('/custom?id=' + encodeURIComponent(id)).then(d => {
        if (d && d.level && d.level.rows) {
          loadCustomRows(d.level.rows, d.level.title);
          $('msg').textContent = 'playing "' + d.level.title + '" by ' + d.level.author;
          api('/custom/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        } else {
          ntfyGetCustom(id).then(pub => {
            if (pub && pub.rows) {
              loadCustomRows(pub.rows, pub.title);
              $('msg').textContent = 'playing "' + pub.title + '" by ' + (pub.author || 'a bird');
              ntfyPostProgress({ type: 'customplay', id, at: new Date().toISOString() });
            } else {
              $('msg').textContent = 'that custom level is missing';
            }
          });
        }
      }).catch(() => {
        ntfyGetCustom(id).then(pub => {
          if (pub && pub.rows) {
            loadCustomRows(pub.rows, pub.title);
            $('msg').textContent = 'playing "' + pub.title + '" by ' + (pub.author || 'a bird');
            ntfyPostProgress({ type: 'customplay', id, at: new Date().toISOString() });
          } else {
            $('msg').textContent = 'the custom level shelf is sleeping';
          }
        });
      });
      return;
    }
    customMode = false; customRows = null; levelRows = null;
    lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
    $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
    const q = new URLSearchParams(location.search);
    let start = 0;
    // the bird's saved place wins, so "play / restart" resumes where it left off
    const cur = parseInt(localStorage.getItem('waddle-current') || '', 10);
    if (!isNaN(cur) && cur >= 1 && cur <= unlockedCount()) start = cur - 1;
    else {
      const lv = parseInt(q.get('level'), 10);
      if (!isNaN(lv) && lv >= 1 && lv <= LEVELS.length) start = lv - 1;
    }
    const lv2 = parseInt(q.get('lives'), 10);
    if (!isNaN(lv2) && lv2 >= 1 && lv2 <= 9) { lives = lv2; $('lives').textContent = lives; }
    loadLevel(start);
  }
  reset(); fillPicker(); buildMap(); refreshMap(); loadBoard(); loadCloudProgress(); loadDailyBoard(); loadFlockStats(); requestAnimationFrame(loop);

  // trailer button
  const tb = $('trailerbtn'), tv = $('trailer');
  if (tb && tv) tb.onclick = () => { tv.style.display = tv.style.display === 'none' ? 'block' : 'none'; if (tv.style.display === 'block') tv.play().catch(()=>{}); };
})();
