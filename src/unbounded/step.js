// SPDX-License-Identifier: Apache-2.0
//
// One generation of the unbounded Game of Life 3D, as a single lockstep over the whole world:
//
// 1. The work set is every chunk with live cells, plus every neighbouring chunk (across a face,
//    an edge or a corner) that a live border cell touches. Those neighbours are allocated empty.
// 2. Every chunk in the work set reads generation t, from its own current copy and its
//    neighbours' current copies, and writes generation t+1 to its other copy. Nothing is
//    updated in place, so the order the chunks are processed in can't change the result.
// 3. The candidate generation is checked against the caller's veto (a timed run's deadline),
//    then the limits. If either ends the run, the step is discarded: the run ends with that
//    reason, and generation t stands, whole and unclipped.
// 4. Otherwise every chunk switches to its new copy at once, and chunks left empty are released.
//
// Space with no live cell in or next to it is skipped, and that is exact: rules.js refuses B0,
// so a dead cell with no live neighbour can't be born.
//
// An arena that wraps (#114) is a torus: a cell just past one face is the cell at the opposite
// face. Only chunks the arena's faces run through do anything different, so a world that doesn't
// wrap takes exactly the path it always has. In a wrapping world, the work set leaves out chunks
// wholly outside the arena, and adds the chunks across the wrap from each live chunk at a face;
// a chunk at a face reads its one-cell border from across the wrap, and computes only its cells
// inside the arena. Cells outside the arena are never written, so they stay dead.

import { COORDINATE_LIMIT, StopSignal, boxOf, inBox, longestSide, setFacts, borderClass, cellHashA, cellHashB } from './world.js';

/**
 * Advances the world one generation, unless a limit ends the run.
 * @param {import('./world.js').World} world
 * @param {object} [options]
 * @param {(slots: number[]) => void} [options.order] - may reorder the work set in place
 *   before it is computed; the tests use it to show that the order doesn't matter
 * @param {() => string | null} [options.veto] - called once generation t+1 is computed, before
 *   anything else: a reason it returns ends the run and discards the generation, as a limit
 *   does. A timed run uses it to drop a generation that finished after its deadline.
 * @returns {string | null} the stop reason if the run has ended, or null
 */
export function step(world, { order, veto } = {}) {
  if (world.stopReason) return world.stopReason;

  // 1. The work set
  const live = [...world.chunks.values()];
  const work = [...live];
  const created = [];
  try {
    for (const slot of live) {
      const touch = world.meta.touch[slot];
      if (!touch) continue;
      for (let d = 0; d < 27; d++) {
        if (!(touch & (1 << d))) continue;
        const cx = world.meta.cx[slot] + (d % 3) - 1;
        const cy = world.meta.cy[slot] + (Math.floor(d / 3) % 3) - 1;
        const cz = world.meta.cz[slot] + Math.floor(d / 9) - 1;
        if (world.wrap && !chunkMeetsArena(world, cx, cy, cz)) continue;
        const before = world.chunks.size;
        const neighbour = world.slotFor(cx, cy, cz);
        if (world.chunks.size > before) {
          created.push(neighbour);
          work.push(neighbour);
        }
      }
    }
    if (world.wrap) {
      for (const slot of live) {
        if (!world.meta.live[slot]) continue;
        for (const [cx, cy, cz] of acrossTheWrap(world, slot)) {
          const before = world.chunks.size;
          const neighbour = world.slotFor(cx, cy, cz);
          if (world.chunks.size > before) {
            created.push(neighbour);
            work.push(neighbour);
          }
        }
      }
    }
  } catch (err) {
    if (!(err instanceof StopSignal)) throw err;
    for (const slot of created) world.release(slot);
    return world.stop(err.reason);
  }

  // 2. Compute generation t+1 for every chunk in the work set
  if (order) order(work);
  for (const slot of work) computeChunk(world, slot);

  // 3. Check the candidate against the veto, then the limits
  let cells = 0;
  for (const slot of work) cells += world.next.live[slot];
  const box = boxOf(world.next, work, world.n);
  const reason = (veto && veto()) || (box && limitCrossed(world, box, cells));
  if (reason) {
    for (const slot of created) world.release(slot);
    return world.stop(reason);
  }

  // 4. Commit: every chunk moves to generation t+1 together
  world.parity ^= 1;
  for (const slot of work) {
    world.meta.live[slot] = world.next.live[slot];
    world.meta.touch[slot] = world.next.touch[slot];
    world.meta.box.set(world.next.box.subarray(6 * slot, 6 * slot + 6), 6 * slot);
    world.meta.hashA[slot] = world.next.hashA[slot];
    world.meta.hashB[slot] = world.next.hashB[slot];
    if (!world.meta.live[slot]) world.release(slot);
  }
  world.generation++;
  return null;
}

/** The first limit a candidate generation crosses, in a fixed order, or null. */
function limitCrossed(world, box, cells) {
  const outside = box.min.some((c) => c < -COORDINATE_LIMIT) || box.max.some((c) => c >= COORDINATE_LIMIT);
  if (outside) return 'coordinate-limit';
  if (world.arena && !(inBox(world.arena, ...box.min) && inBox(world.arena, ...box.max))) return 'arena-edge';
  if (longestSide(box) > world.limits.extent) return 'extent-limit';
  if (cells > world.limits.cells) return 'cell-limit';
  return null;
}

/**
 * Writes generation t+1 of one chunk into its other copy, and records its live cells, border
 * contacts and bounding box in world.next. Reads only generation t. Exported for the bench
 * (scripts/bench/), which times it on its own; only step() calls it otherwise.
 */
export function computeChunk(world, slot) {
  const { n, padded: p, sumX, sumXY, table } = world;
  const m = n + 2, mm = m * m, nn = n * n, nm = n * m;
  const { cx, cy, cz } = world.meta;
  const ox = cx[slot], oy = cy[slot], oz = cz[slot];

  // The chunk's cells at generation t, with a one-cell border read from its neighbours.
  // Each axis offset d = -1, 0, +1 maps the neighbour's local range to the padded range.
  p.fill(0);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbour = world.findSlot(ox + dx, oy + dy, oz + dz);
        if (neighbour === undefined) continue;
        const [slab, base] = world.current(neighbour);
        const [x0, xLen, px0] = span(dx, n);
        const [y0, yLen, py0] = span(dy, n);
        const [z0, zLen, pz0] = span(dz, n);
        for (let z = 0; z < zLen; z++) {
          for (let y = 0; y < yLen; y++) {
            const src = base + x0 + (y0 + y) * n + (z0 + z) * nn;
            const dst = px0 + (py0 + y) * m + (pz0 + z) * mm;
            for (let x = 0; x < xLen; x++) p[dst + x] = slab[src + x];
          }
        }
      }
    }
  }

  // In an arena that wraps, a chunk its faces run through computes only its cells inside the
  // arena, and reads its border from across the wrap
  const clip = world.wrap ? wrapClip(world, p, ox, oy, oz) : null;
  const x0 = clip ? clip[0] : 0, y0 = clip ? clip[1] : 0, z0 = clip ? clip[2] : 0;
  const x1 = clip ? clip[3] : n, y1 = clip ? clip[4] : n, z1 = clip ? clip[5] : n;

  // Each cell's 3×3×3 block total, as three passes of three: along x, then y, then z
  for (let z = 0; z < m; z++) {
    for (let y = 0; y < m; y++) {
      const src = y * m + z * mm, dst = y * n + z * nm;
      for (let x = 0; x < n; x++) sumX[dst + x] = p[src + x] + p[src + x + 1] + p[src + x + 2];
    }
  }
  for (let z = 0; z < m; z++) {
    for (let y = 0; y < n; y++) {
      const src = y * n + z * nm, dst = y * n + z * nn;
      for (let x = 0; x < n; x++) sumXY[dst + x] = sumX[src + x] + sumX[src + x + n] + sumX[src + x + 2 * n];
    }
  }

  // Apply the rule: neighbours = block total - the cell itself
  const [slab, base] = world.copy(slot, world.parity ^ 1);
  const box = [n, n, n, -1, -1, -1];
  let live = 0;
  let classes = 0;
  const fingerprinting = world.fingerprinting;
  const gx = ox * n, gy = oy * n, gz = oz * n;
  let hashA = 0;
  let hashB = 0;
  for (let z = z0; z < z1; z++) {
    const zClass = 9 * borderClass(z, n);
    for (let y = y0; y < y1; y++) {
      const rowClass = zClass + 3 * borderClass(y, n);
      const row = y * n + z * nn;
      const self = (y + 1) * m + (z + 1) * mm + 1;
      for (let x = x0; x < x1; x++) {
        const i = row + x;
        const alive = p[self + x];
        const count = sumXY[i] + sumXY[i + nn] + sumXY[i + 2 * nn] - alive;
        const next = table[alive * 27 + count];
        slab[base + i] = next;
        if (next) {
          live++;
          classes |= 1 << (rowClass + borderClass(x, n));
          if (fingerprinting) {
            hashA = (hashA + cellHashA(gx + x, gy + y, gz + z)) | 0;
            hashB = (hashB + cellHashB(gx + x, gy + y, gz + z)) | 0;
          }
          if (x < box[0]) box[0] = x;
          if (x > box[3]) box[3] = x;
          if (y < box[1]) box[1] = y;
          if (y > box[4]) box[4] = y;
          if (z < box[2]) box[2] = z;
          if (z > box[5]) box[5] = z;
        }
      }
    }
  }
  world.next.cx[slot] = ox;
  world.next.cy[slot] = oy;
  world.next.cz[slot] = oz;
  setFacts(world.next, slot, live, classes, box, n);
  world.next.hashA[slot] = hashA;
  world.next.hashB[slot] = hashB;
}

/**
 * For a chunk of a wrapping arena: if the arena's faces run through it or its border, fills its
 * border from across the wrap (wrapBorder()) and returns the local range of its cells inside the
 * arena, [x0, y0, z0, x1, y1, z1], ends exclusive; otherwise null, and the chunk is computed whole.
 */
function wrapClip(world, p, ox, oy, oz) {
  const { n } = world;
  const { min, max } = world.arena;
  const o = [ox * n, oy * n, oz * n];
  if (!o.some((c, a) => c - 1 < min[a] || c + n > max[a])) return null;
  wrapBorder(world, p, o);
  return [...o.map((c, a) => Math.max(0, min[a] - c)), ...o.map((c, a) => Math.min(n, max[a] - c + 1))];
}

/** Whether any of the chunk's cells lie in the arena. */
function chunkMeetsArena(world, cx, cy, cz) {
  const { n } = world;
  const { min, max } = world.arena;
  return [cx, cy, cz].every((c, a) => c * n <= max[a] && c * n + n - 1 >= min[a]);
}

/**
 * The chunks a live chunk at a face of a wrapping arena can bring cells to life in, across the
 * wrap: its live cells' box grown by one, carried round to the opposite faces, and clipped to
 * the arena. Each axis whose grown box crosses a face is carried round, alone and with the
 * others, so an edge or a corner reaches the chunks diagonally across too.
 * @returns {number[][]} chunk coordinates, [cx, cy, cz] each
 */
function acrossTheWrap(world, slot) {
  const { n } = world;
  const { min, max } = world.arena;
  const b = 6 * slot;
  const lo = [], hi = [], shifts = [];
  for (let a = 0; a < 3; a++) {
    const origin = [world.meta.cx, world.meta.cy, world.meta.cz][a][slot] * n;
    lo[a] = origin + world.meta.box[b + a] - 1;
    hi[a] = origin + world.meta.box[b + 3 + a] + 1;
    const side = max[a] - min[a] + 1;
    shifts[a] = [0];
    if (lo[a] < min[a]) shifts[a].push(side);
    if (hi[a] > max[a]) shifts[a].push(-side);
  }
  const chunks = [];
  for (const sx of shifts[0]) {
    for (const sy of shifts[1]) {
      for (const sz of shifts[2]) {
        if (sx === 0 && sy === 0 && sz === 0) continue;
        const range = [sx, sy, sz].map((s, a) => [
          Math.floor(Math.max(lo[a] + s, min[a]) / n), Math.floor(Math.min(hi[a] + s, max[a]) / n),
        ]);
        if (range.some(([from, to]) => from > to)) continue;
        for (let cz = range[2][0]; cz <= range[2][1]; cz++) {
          for (let cy = range[1][0]; cy <= range[1][1]; cy++) {
            for (let cx = range[0][0]; cx <= range[0][1]; cx++) chunks.push([cx, cy, cz]);
          }
        }
      }
    }
  }
  return chunks;
}

/**
 * Fills the padded block of a chunk a wrapping arena's faces run through: each place outside the
 * arena but within a cell of it holds the cell it stands for across the wrap, at generation t,
 * and every other place outside the arena is empty. Places inside the arena are left as read.
 * @param {number[]} o - the chunk's first cell, [x, y, z]
 */
function wrapBorder(world, p, o) {
  const { n } = world;
  const { min, max } = world.arena;
  const m = n + 2, mm = m * m;
  const g = [0, 0, 0];
  for (let pz = 0; pz < m; pz++) {
    g[2] = o[2] + pz - 1;
    for (let py = 0; py < m; py++) {
      g[1] = o[1] + py - 1;
      for (let px = 0; px < m; px++) {
        g[0] = o[0] + px - 1;
        let inside = true, near = true;
        for (let a = 0; a < 3; a++) {
          if (g[a] < min[a] || g[a] > max[a]) inside = false;
          if (g[a] < min[a] - 1 || g[a] > max[a] + 1) near = false;
        }
        if (inside) continue;
        const i = px + py * m + pz * mm;
        if (!near) {
          p[i] = 0;
          continue;
        }
        const [x, y, z] = g.map((c, a) => (c < min[a] ? c + max[a] - min[a] + 1 : c > max[a] ? c - (max[a] - min[a] + 1) : c));
        p[i] = world.has(x, y, z) ? 1 : 0;
      }
    }
  }
}

// [first local cell, length, first padded cell] of a neighbour's cells that border this chunk
function span(d, n) {
  if (d < 0) return [n - 1, 1, 0];
  if (d > 0) return [0, 1, n + 1];
  return [0, n, 1];
}
