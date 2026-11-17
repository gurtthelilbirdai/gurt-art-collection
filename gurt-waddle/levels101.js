// Gurt's Waddle — the wind gardens, levels 101-120.
// Above the root cellar: open sky, tall grass, updrafts and crosswinds.
// Legend adds: > wind pushing right, < wind pushing left, U updraft column.
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
    // 101 — the first gust
    () => {
      const g = blank(); ground(g, [[11, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 9, 11, '>', 3);
      row(g, 11, 6, '=', 3); row(g, 11, 15, '=', 3);
      coins(g, [[5, 11], [13, 8], [18, 10], [21, 11]]);
      return g;
    },
    // 102 — crosswind bridge
    () => {
      const g = blank(); ground(g, [[8, 3], [16, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 8, '>', 5); row(g, 10, 16, '<', 5);
      row(g, 11, 12, '=', 3);
      put(g, 13, 9, 'C');
      coins(g, [[6, 11], [12, 9], [18, 9], [21, 11]]);
      return g;
    },
    // 103 — the tall grass
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 5, 9, 4, 3, '>'); rect(g, 14, 8, 5, 4, '<');
      row(g, 11, 10, '=', 3);
      coins(g, [[4, 11], [9, 8], [16, 7], [21, 11]]);
      return g;
    },
    // 104 — spring into the gale
    () => {
      const g = blank(); ground(g, [[14, 2]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 11, 'S');
      rect(g, 14, 4, 6, 5, '>');
      row(g, 10, 18, '=', 3);
      coins(g, [[8, 11], [16, 3], [20, 9], [22, 11]]);
      return g;
    },
    // 105 — keys in the wind
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 6, 8, 3, 4, '>'); rect(g, 15, 8, 3, 4, '<');
      put(g, 4, 9, 'k'); put(g, 13, 11, 'D');
      put(g, 19, 9, 'k');
      coins(g, [[9, 11], [17, 7], [21, 11]]);
      return g;
    },
    // 106 — updraft tower
    () => {
      const g = blank(); ground(g, [[6, 2], [18, 2]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      col(g, 12, 3, 'U', 8);
      row(g, 6, 8, '=', 3); row(g, 4, 14, '=', 3); row(g, 6, 18, '=', 3);
      put(g, 15, 3, 'C');
      coins(g, [[4, 11], [12, 2], [17, 3], [21, 5]]);
      return g;
    },
    // 107 — windy spikes
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 7, 10, 4, 2, '>'); rect(g, 15, 10, 4, 2, '<');
      row(g, 11, 11, '^', 2); row(g, 11, 19, '^', 2);
      coins(g, [[5, 11], [13, 9], [18, 9], [22, 11]]);
      return g;
    },
    // 108 — the long meadow
    () => {
      const g = blank(); ground(g, [[5, 2], [10, 2], [15, 2], [20, 2]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 6, '>', 3); row(g, 10, 11, '>', 3); row(g, 10, 16, '>', 3);
      coins(g, [[4, 11], [9, 9], [14, 9], [19, 9]]);
      return g;
    },
    // 109 — the leaf lift
    () => {
      const g = blank(); ground(g, [[9, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      col(g, 12, 2, 'U', 9);
      row(g, 9, 6, '=', 3); row(g, 8, 14, '=', 3);
      put(g, 13, 7, 'C');
      put(g, 20, 6, 'f');
      coins(g, [[6, 8], [12, 1], [16, 7], [21, 11]]);
      return g;
    },
    // 110 — crosswind corridor
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 3, 8, 19, 4, '>');
      rect(g, 8, 4, 9, 4, '<');
      row(g, 11, 12, '=', 3);
      put(g, 4, 10, 'k'); put(g, 18, 11, 'D');
      coins(g, [[6, 7], [11, 3], [17, 7], [21, 11]]);
      return g;
    },
    // 111 — the hammer in the gale
    () => {
      const g = blank(); ground(g, [[13, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 6, 9, 4, 3, '>');
      put(g, 16, 10, 'm');
      row(g, 11, 17, '=', 3);
      put(g, 10, 10, 'C');
      coins(g, [[4, 11], [9, 8], [18, 10], [22, 11]]);
      return g;
    },
    // 112 — two updrafts
    () => {
      const g = blank(); ground(g, [[7, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      col(g, 9, 3, 'U', 8); col(g, 15, 2, 'U', 9);
      row(g, 6, 11, '=', 3); row(g, 4, 17, '=', 3);
      coins(g, [[5, 11], [9, 2], [15, 1], [20, 3]]);
      return g;
    },
    // 113 — slippery winds
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, 'i', 5);
      rect(g, 12, 9, 4, 3, '>');
      row(g, 11, 18, '=', 3);
      put(g, 8, 10, 'C');
      coins(g, [[3, 11], [7, 10], [14, 8], [21, 10]]);
      return g;
    },
    // 114 — the windy gate
    () => {
      const g = blank(); ground(g, [[10, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 4, 9, 3, 3, '<'); rect(g, 16, 9, 3, 3, '>');
      put(g, 12, 11, 'D');
      put(g, 7, 7, 'k'); put(g, 19, 7, 'k');
      row(g, 8, 11, '=', 3);
      coins(g, [[3, 11], [11, 7], [15, 7], [22, 11]]);
      return g;
    },
    // 115 — birdsong lookout
    () => {
      const g = blank(); ground(g, [[6, 2], [12, 2], [18, 2]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 9, 7, '>', 3); row(g, 9, 13, '<', 3);
      put(g, 8, 6, 'f'); put(g, 16, 5, 'f');
      put(g, 15, 10, 'C');
      coins(g, [[5, 11], [10, 8], [15, 4], [21, 11]]);
      return g;
    },
    // 116 — the long fall
    () => {
      const g = blank(); ground(g, [[4, 2], [9, 2], [14, 2], [19, 2]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 5, 10, 3, 2, '<'); rect(g, 10, 10, 3, 2, '>');
      row(g, 11, 15, '=', 3); row(g, 9, 20, '=', 3);
      coins(g, [[3, 11], [8, 9], [13, 9], [18, 8]]);
      return g;
    },
    // 117 — the bough bridge
    () => {
      const g = blank(); ground(g, [[8, 3], [16, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 10, 12, '=', 3);
      row(g, 9, 16, '=', 3); row(g, 10, 20, '=', 3);
      rect(g, 10, 7, 4, 3, '>');
      put(g, 14, 8, 'C');
      coins(g, [[5, 9], [9, 8], [14, 6], [19, 8]]);
      return g;
    },
    // 118 — the sky vault
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      col(g, 6, 4, 'U', 7); col(g, 18, 3, 'U', 8);
      rect(g, 10, 6, 5, 4, '<');
      row(g, 5, 8, '=', 3); row(g, 3, 15, '=', 3);
      put(g, 4, 10, 'k'); put(g, 21, 10, 'k');
      put(g, 12, 11, 'D');
      coins(g, [[6, 3], [12, 5], [18, 2], [22, 11]]);
      return g;
    },
    // 119 — the wind guardian
    () => {
      const g = blank(); ground(g, [[7, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      rect(g, 5, 8, 4, 4, '>'); rect(g, 15, 8, 4, 4, '<');
      put(g, 12, 10, 'm');
      put(g, 12, 11, 'C');
      put(g, 10, 7, 'k'); put(g, 20, 11, 'D');
      coins(g, [[3, 11], [9, 7], [16, 7], [22, 11]]);
      return g;
    },
    // 120 — the Wind Moth
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 10, 'B');
      put(g, 18, 11, 'C');
      put(g, 4, 10, 'k');
      rect(g, 8, 6, 4, 4, '>'); rect(g, 15, 6, 4, 4, '<');
      col(g, 12, 2, 'U', 8);
      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [12, 1]]);
      return g;
    },
  ];

  const LEVELS = builders.map(b => b().map(r => r.join('')));
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = (root.LEVELS || []).concat(LEVELS);
})(typeof window !== 'undefined' ? window : globalThis);
