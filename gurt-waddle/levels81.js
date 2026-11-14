// Gurt's Waddle — the root cellar, levels 81-100.
// A deeper region under the starfall coast: damp stone, glowing spores,
// crumbling roots, hammers and the Root Moth at the bottom.
(function (root) {
  const W = 25, H = 14;

  function blank() {
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    return g;
  }
  function put(g, x, y, ch) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; }
  function rect(g, x, y, w, h, ch) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, ch); }
  function ground(g, holes) {
    rect(g, 0, 12, W, 2, '#');
    (holes || []).forEach(([x, w]) => rect(g, x, 12, w, 2, '.'));
  }
  function row(g, y, x, ch, n) { rect(g, x, y, n, 1, ch); }
  function col(g, x, y, ch, n) { rect(g, x, y, 1, n, ch); }
  function coins(g, pairs) { pairs.forEach(([x, y]) => put(g, x, y, 'o')); }

  const builders = [
    // 81 — mossy steps
    () => {
      const g = blank(); ground(g, [[9, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 6, '=', 3); row(g, 10, 12, '=', 3); row(g, 11, 16, '=', 3);
      put(g, 13, 9, 'C');
      coins(g, [[7, 10], [13, 9], [17, 10], [20, 11]]);
      return g;
    },
    // 82 — the crumbling bridge
    () => {
      const g = blank(); ground(g, [[6, 13]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      for (let x = 6; x < 19; x++) put(g, x, 11, 'c');
      put(g, 12, 10, 'C');
      coins(g, [[8, 10], [12, 10], [16, 10], [21, 11]]);
      return g;
    },
    // 83 — spike corridor
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 11, '^'); put(g, 9, 11, '^'); put(g, 13, 11, '^');
      put(g, 17, 11, '^'); put(g, 18, 11, '^');
      put(g, 11, 8, 'S'); put(g, 15, 8, 'S');
      put(g, 21, 10, 'C');
      coins(g, [[11, 7], [15, 7], [6, 11], [20, 11]]);
      return g;
    },
    // 84 — hammer gauntlet
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 11, 'm'); put(g, 14, 11, 'm'); put(g, 19, 11, 'm');
      put(g, 11, 10, 'C');
      coins(g, [[6, 11], [11, 10], [16, 11], [21, 11]]);
      return g;
    },
    // 85 — the cistern
    () => {
      const g = blank(); ground(g, [[5, 15]]);
      rect(g, 5, 12, 15, 2, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, '=', 3); row(g, 10, 9, '=', 3); row(g, 11, 13, '=', 3); row(g, 10, 17, '=', 3);
      put(g, 15, 9, 'C');
      coins(g, [[6, 10], [10, 9], [14, 10], [18, 9]]);
      return g;
    },
    // 86 — the long ferry
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 6, '=', 4); row(g, 10, 12, '=', 4); row(g, 10, 18, '=', 4);
      put(g, 10, 10, 'C');
      coins(g, [[3, 11], [8, 9], [14, 9], [20, 9]]);
      return g;
    },
    // 87 — the root climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 8, 8, '=', 3); row(g, 6, 12, '=', 3);
      row(g, 5, 16, '=', 3); row(g, 7, 20, '=', 3);
      put(g, 12, 5, 'C');
      coins(g, [[5, 9], [9, 7], [13, 5], [17, 4], [21, 6]]);
      return g;
    },
    // 88 — two fliers
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 6, 'f'); put(g, 18, 6, 'f');
      put(g, 12, 10, 'C');
      coins(g, [[3, 11], [9, 11], [15, 11], [21, 11]]);
      return g;
    },
    // 89 — the locked root door
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 5, 11, 'k'); put(g, 15, 11, 'D');
      put(g, 10, 10, 'C');
      coins(g, [[8, 11], [12, 11], [19, 11]]);
      return g;
    },
    // 90 — wet steps
    () => {
      const g = blank(); ground(g, [[6, 2], [12, 2], [18, 2]]);
      rect(g, 6, 12, 2, 2, 'w'); rect(g, 12, 12, 2, 2, 'w'); rect(g, 18, 12, 2, 2, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 4, '=', 2); row(g, 11, 8, '=', 2); row(g, 11, 14, '=', 2); row(g, 11, 20, '=', 2);
      put(g, 9, 10, 'C');
      coins(g, [[5, 10], [9, 10], [15, 10], [21, 10]]);
      return g;
    },
    // 91 — spring ladder
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'S'); put(g, 11, 8, 'S'); put(g, 16, 5, 'S');
      row(g, 10, 8, '=', 3); row(g, 7, 13, '=', 3); row(g, 4, 18, '=', 3);
      put(g, 13, 6, 'C');
      coins(g, [[6, 10], [11, 7], [16, 4], [21, 10]]);
      return g;
    },
    // 92 — the shifting gap
    () => {
      const g = blank(); ground(g, [[8, 9]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 10, 11, 'M'); put(g, 14, 11, 'M');
      put(g, 12, 10, 'C');
      coins(g, [[5, 11], [12, 10], [19, 11]]);
      return g;
    },
    // 93 — roots and a walker
    () => {
      const g = blank(); ground(g, [[7, 11]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      for (let x = 7; x < 18; x++) put(g, x, 11, 'c');
      put(g, 12, 10, 'e');
      put(g, 12, 9, 'C');
      coins(g, [[9, 10], [15, 10], [20, 11]]);
      return g;
    },
    // 94 — hammer and flyer
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 9, 11, 'm'); put(g, 16, 7, 'f');
      row(g, 11, 12, '=', 3);
      put(g, 13, 10, 'C');
      coins(g, [[6, 11], [12, 10], [18, 11]]);
      return g;
    },
    // 95 — the deep tower
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 5, '=', 4); row(g, 9, 11, '=', 4); row(g, 8, 17, '=', 4);
      put(g, 12, 8, 'C');
      coins(g, [[3, 11], [7, 9], [13, 8], [19, 7]]);
      return g;
    },
    // 96 — flooded spikes
    () => {
      const g = blank(); ground(g, [[4, 17]]);
      rect(g, 4, 12, 17, 2, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 11, '^'); put(g, 12, 11, '^'); put(g, 16, 11, '^');
      row(g, 10, 6, '=', 3); row(g, 10, 11, '=', 3); row(g, 10, 16, '=', 3);
      put(g, 14, 9, 'C');
      coins(g, [[7, 9], [12, 9], [17, 9]]);
      return g;
    },
    // 97 — the hammer field
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'm'); put(g, 10, 11, 'm'); put(g, 14, 11, 'm'); put(g, 18, 11, 'm');
      row(g, 8, 8, '=', 4); row(g, 8, 16, '=', 4);
      put(g, 12, 7, 'C');
      coins(g, [[4, 11], [10, 7], [18, 7], [21, 11]]);
      return g;
    },
    // 98 — everything at once
    () => {
      const g = blank(); ground(g, [[8, 3], [16, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, '^'); put(g, 11, 11, 'm'); put(g, 14, 8, 'f');
      put(g, 18, 11, '^'); put(g, 20, 11, 'e');
      row(g, 11, 8, '=', 3); row(g, 11, 16, '=', 3);
      put(g, 12, 10, 'C');
      coins(g, [[4, 11], [10, 10], [15, 7], [19, 10]]);
      return g;
    },
    // 99 — the descent to the moth
    () => {
      const g = blank(); ground(g, [[5, 3], [11, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, '=', 3); row(g, 11, 11, '=', 3); row(g, 11, 17, '=', 3);
      put(g, 13, 10, 'C');
      put(g, 9, 10, 'k');
      coins(g, [[7, 10], [13, 10], [19, 10]]);
      return g;
    },
    // 100 — the Root Moth
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 10, 'B');
      put(g, 18, 11, 'C');
      put(g, 4, 10, 'k');
      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [15, 6]]);
      return g;
    },
  ];

  const LEVELS = builders.map(b => b().map(r => r.join('')));
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = (root.LEVELS || []).concat(LEVELS);
})(typeof window !== 'undefined' ? window : globalThis);
