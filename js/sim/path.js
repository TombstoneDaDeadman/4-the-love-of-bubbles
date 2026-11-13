// Store grid, build validation helpers and A* pathfinding (the brief's NavMesh stand-in).
// Pure functions over plain state; nothing here touches the DOM or three.js.

import { STORE_GRID, STORE_ROWS, STORE_DOORS, STORE_FIXED, STORE_RESERVED, FURNITURE, STORE_POINTS, QUEUE_CELLS } from '../data.js';

const { cell: CELL, x0: X0, z0: Z0, cols: COLS, rows: ROWS } = STORE_GRID;
export { CELL, COLS, ROWS };

export const idx = (i, j) => j * COLS + i;
export const inGrid = (i, j) => i >= 0 && j >= 0 && i < COLS && j < ROWS;
export function cellOf(x, z) {
  return [Math.max(0, Math.min(COLS - 1, Math.floor((x - X0) / CELL))), Math.max(0, Math.min(ROWS - 1, Math.floor((z - Z0) / CELL)))];
}
export function cellCenter(i, j) { return { x: X0 + (i + 0.5) * CELL, z: Z0 + (j + 0.5) * CELL }; }
const inRect = (i, j, r) => i >= r[0] && i <= r[1] && j >= r[2] && j <= r[3];

// ---- Furniture geometry -------------------------------------------------------

// Rotation r: the display's front faces +z, +x, -z, -x for r = 0, 1, 2, 3.
export const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export function footprint(type, i, j, rot) {
  const f = FURNITURE[type];
  const w = rot % 2 ? f.d : f.w, d = rot % 2 ? f.w : f.d;
  return { i0: i, j0: j, i1: i + w - 1, j1: j + d - 1 };
}
export function furnitureCenter(fu) {
  const fp = footprint(fu.type, fu.i, fu.j, fu.rot);
  return { x: X0 + ((fp.i0 + fp.i1 + 1) / 2) * CELL, z: Z0 + ((fp.j0 + fp.j1 + 1) / 2) * CELL };
}

// Cells a shopper or stocker stands on to use a display. A shelf is used from its front;
// a table from any side. Optionally only the half of a shelf's front that serves one slot.
export function accessCells(fu, slot = -1) {
  const f = FURNITURE[fu.type];
  if (!f.slots && !f.access) return [];
  const fp = footprint(fu.type, fu.i, fu.j, fu.rot);
  const out = [];
  if (fu.type === 'table') {
    for (let i = fp.i0; i <= fp.i1; i++) out.push([i, fp.j0 - 1], [i, fp.j1 + 1]);
    for (let j = fp.j0; j <= fp.j1; j++) out.push([fp.i0 - 1, j], [fp.i1 + 1, j]);
    return out.filter(([i, j]) => inGrid(i, j));
  }
  const [fx, fz] = FRONT[fu.rot];
  if (fz) { const j = fz > 0 ? fp.j1 + 1 : fp.j0 - 1; for (let i = fp.i0; i <= fp.i1; i++) out.push([i, j]); }
  else { const i = fx > 0 ? fp.i1 + 1 : fp.i0 - 1; for (let j = fp.j0; j <= fp.j1; j++) out.push([i, j]); }
  // Slot 0 is on the shopper's left when facing the shelf.
  if (fu.rot === 1 || fu.rot === 2) out.reverse();
  const valid = out.filter(([i, j]) => inGrid(i, j));
  if (slot < 0 || f.slots < 2) return valid;
  const half = Math.ceil(valid.length / 2);
  return slot === 0 ? valid.slice(0, half) : valid.slice(half);
}

// ---- Static masks ---------------------------------------------------------------

let staticMasks = null;
function masks() {
  if (staticMasks) return staticMasks;
  const walk = new Uint8Array(COLS * ROWS).fill(1);
  const build = new Uint8Array(COLS * ROWS);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (j === STORE_ROWS.partition && (i < STORE_DOORS.partition[0] || i > STORE_DOORS.partition[1])) walk[idx(i, j)] = 0;
    if (j === STORE_ROWS.front && (i < STORE_DOORS.entrance[0] || i > STORE_DOORS.entrance[1])) walk[idx(i, j)] = 0;
    if (j >= STORE_ROWS.floor[0] && j <= STORE_ROWS.floor[1]) build[idx(i, j)] = 1;
  }
  for (const f of STORE_FIXED) {
    const [a, b, c, d] = f.cells;
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) { walk[idx(i, j)] = 0; build[idx(i, j)] = 0; }
  }
  for (const r of STORE_RESERVED) for (let j = r[2]; j <= r[3]; j++) for (let i = r[0]; i <= r[1]; i++) build[idx(i, j)] = 0;
  staticMasks = { walk, build };
  return staticMasks;
}

function gridFor(furniture) {
  const walk = masks().walk.slice();
  for (const fu of furniture) {
    const fp = footprint(fu.type, fu.i, fu.j, fu.rot);
    for (let j = fp.j0; j <= fp.j1; j++) for (let i = fp.i0; i <= fp.i1; i++) if (inGrid(i, j)) walk[idx(i, j)] = 0;
  }
  return walk;
}

// Walkable grid for the current layout, cached per layout version.
const cache = new WeakMap();
export function walkGrid(store) {
  const c = cache.get(store);
  if (c && c.ver === store.layoutVer) return c.walk;
  const walk = gridFor(store.furniture);
  cache.set(store, { ver: store.layoutVer, walk });
  return walk;
}
export const isWalkable = (walk, i, j) => inGrid(i, j) && walk[idx(i, j)] === 1;

function flood(walk, from) {
  const seen = new Uint8Array(COLS * ROWS);
  const q = [from];
  seen[idx(...from)] = 1;
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (isWalkable(walk, a, b) && !seen[idx(a, b)]) { seen[idx(a, b)] = 1; q.push([a, b]); }
    }
  }
  return seen;
}

// Build-mode validation. `ignoreId` lets a piece be moved onto its own old spot.
export function checkPlacement(store, type, i, j, rot, ignoreId = null) {
  if (!FURNITURE[type]) return { ok: false, reason: 'Unknown item.' };
  if (!(rot >= 0 && rot <= 3)) return { ok: false, reason: 'Bad rotation.' };
  const fp = footprint(type, i, j, rot);
  const { build } = masks();
  const others = store.furniture.filter((f) => f.id !== ignoreId);
  const taken = gridFor(others);
  for (let b = fp.j0; b <= fp.j1; b++) for (let a = fp.i0; a <= fp.i1; a++) {
    if (!inGrid(a, b) || !build[idx(a, b)]) return { ok: false, reason: 'That spot is outside the shop floor or keeps an aisle clear.' };
    if (!taken[idx(a, b)]) return { ok: false, reason: 'Something is already there.' };
  }
  // Everything that matters must still be reachable from the entrance.
  const piece = { id: '__new', type, i, j, rot };
  const layout = [...others, piece];
  const walk = gridFor(layout);
  const reach = flood(walk, cellOf(STORE_POINTS.inside.x, STORE_POINTS.inside.z));
  const must = [cellOf(STORE_POINTS.backdoor.x, STORE_POINTS.backdoor.z), cellOf(STORE_POINTS.register.x, STORE_POINTS.register.z), ...QUEUE_CELLS];
  if (must.some(([a, b]) => !reach[idx(a, b)])) return { ok: false, reason: 'That would block the till or the back room.' };
  for (const fu of layout) {
    const acc = accessCells(fu);
    if (acc.length && !acc.some(([a, b]) => isWalkable(walk, a, b) && reach[idx(a, b)])) {
      return { ok: false, reason: fu === piece ? 'Shoppers could not reach the front of it there.' : 'That would block another display.' };
    }
  }
  return { ok: true };
}

// ---- A* -------------------------------------------------------------------------

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function nearestWalkable(walk, i, j) {
  if (isWalkable(walk, i, j)) return [i, j];
  for (let r = 1; r < Math.max(COLS, ROWS); r++) {
    let best = null, bd = Infinity;
    for (let b = j - r; b <= j + r; b++) for (let a = i - r; a <= i + r; a++) {
      if (Math.max(Math.abs(a - i), Math.abs(b - j)) !== r || !isWalkable(walk, a, b)) continue;
      const d = (a - i) ** 2 + (b - j) ** 2;
      if (d < bd) { bd = d; best = [a, b]; }
    }
    if (best) return best;
  }
  return null;
}

function astar(walk, s, t) {
  const N = COLS * ROWS, start = idx(...s), goal = idx(...t);
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const h = (n) => { const dx = Math.abs((n % COLS) - t[0]), dz = Math.abs(Math.floor(n / COLS) - t[1]); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  const heap = [];
  const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  g[start] = 0; push(start, h(start));
  while (heap.length) {
    const n = pop();
    if (n === goal) break;
    if (closed[n]) continue;
    closed[n] = 1;
    const i = n % COLS, j = Math.floor(n / COLS);
    for (const [di, dj, c] of DIRS) {
      const a = i + di, b = j + dj;
      if (!isWalkable(walk, a, b)) continue;
      if (di && dj && (!isWalkable(walk, i + di, j) || !isWalkable(walk, i, j + dj))) continue; // no corner cutting
      const m = idx(a, b), ng = g[n] + c;
      if (ng < g[m]) { g[m] = ng; came[m] = n; push(m, ng + h(m)); }
    }
  }
  if (start !== goal && came[goal] < 0) return null;
  const cells = [];
  for (let n = goal; n !== start && n >= 0; n = came[n]) cells.push([n % COLS, Math.floor(n / COLS)]);
  return cells.reverse();
}

// Straight-line visibility on the grid with a little body width, used to smooth paths.
function clear(walk, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 0.12);
  for (let k = 0; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / Math.max(1, n), z = az + ((bz - az) * k) / Math.max(1, n);
    for (const [ox, oz] of [[0, 0], [0.17, 0], [-0.17, 0], [0, 0.17], [0, -0.17]]) {
      const [i, j] = cellOf(x + ox, z + oz);
      if (!isWalkable(walk, i, j)) return false;
    }
  }
  return true;
}

// Waypoints from (sx, sz) to (tx, tz), excluding the start. Unreachable targets resolve to the
// nearest walkable cell; returns null only if no route exists at all.
export function findPath(walk, sx, sz, tx, tz) {
  const s = nearestWalkable(walk, ...cellOf(sx, sz));
  const tc = cellOf(tx, tz);
  const t = nearestWalkable(walk, ...tc);
  if (!s || !t) return null;
  const cells = astar(walk, s, t);
  if (!cells) return null;
  const exact = t[0] === tc[0] && t[1] === tc[1];
  const pts = cells.map(([i, j]) => cellCenter(i, j));
  if (exact) { if (pts.length) pts[pts.length - 1] = { x: tx, z: tz }; else pts.push({ x: tx, z: tz }); }
  else if (!pts.length) pts.push(cellCenter(...t));
  // string-pull: skip waypoints we can walk straight past
  const out = [];
  let ax = sx, az = sz, k = 0;
  if (!isWalkable(walk, ...cellOf(sx, sz))) { const c = cellCenter(...s); out.push(c); ax = c.x; az = c.z; }
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (clear(walk, ax, az, pts[m].x, pts[m].z)) { far = m; break; }
    out.push(pts[far]); ax = pts[far].x; az = pts[far].z; k = far + 1;
  }
  return out.map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.z * 1000) / 1000]);
}

// Move an entity (actor or shopper: {x, z, face, path, pathKey, pathVer}) toward a target,
// re-planning when the target or the layout changes. Returns true once it has arrived.
export function walkTo(store, ent, tx, tz, dt, speed) {
  const key = `${tx.toFixed(2)},${tz.toFixed(2)}`;
  if (ent.pathKey !== key || ent.pathVer !== store.layoutVer || !ent.path) {
    ent.path = findPath(walkGrid(store), ent.x, ent.z, tx, tz) || [];
    ent.pathKey = key; ent.pathVer = store.layoutVer;
    if (!ent.path.length && Math.hypot(tx - ent.x, tz - ent.z) > 0.05) { ent.blocked = (ent.blocked || 0) + 1; return false; }
  }
  let budget = speed * dt;
  while (budget > 0 && ent.path.length) {
    const [px, pz] = ent.path[0];
    const dx = px - ent.x, dz = pz - ent.z, d = Math.hypot(dx, dz);
    if (d <= budget) { ent.x = px; ent.z = pz; budget -= d; ent.path.shift(); if (d > 1e-4) ent.face = Math.atan2(dx, dz); }
    else { ent.x += (dx / d) * budget; ent.z += (dz / d) * budget; ent.face = Math.atan2(dx, dz); budget = 0; }
  }
  ent.blocked = 0;
  return ent.path.length === 0;
}
