// SPDX-License-Identifier: Apache-2.0
//
// The reference for the unbounded Game of Life 3D: a deliberately simple engine, written to be
// easy to trust rather than fast. It keeps the live cells in a Set of "x,y,z" strings and has no
// chunks, slabs or limits. The tests check the chunked engine (world.js, step.js) against it.
// Given a box to wrap in, it is a torus: each neighbour's coordinates are taken round the box.

import { validateRules } from './rules.js';

export class ReferenceWorld {
  /**
   * @param {{birth: number[], survival: number[]}} rules
   * @param {Iterable<number[]>} [cells] - live cells, as [x, y, z]; inside `wrap`, if given
   * @param {{wrap?: {min: number[], max: number[]}}} [options] - wrap: the box, inclusive, whose
   *   opposite faces are neighbours
   */
  constructor(rules, cells = [], { wrap = null } = {}) {
    const { birth, survival } = validateRules(rules);
    this.birth = new Set(birth);
    this.survival = new Set(survival);
    this.live = new Set();
    this.generation = 0;
    this.wrap = wrap;
    for (const [x, y, z] of cells) this.live.add(`${x},${y},${z}`);
  }

  /** A coordinate on axis a, taken round the wrapping box if there is one. */
  round(c, a) {
    if (!this.wrap) return c;
    const { min, max } = this.wrap;
    const side = max[a] - min[a] + 1;
    return min[a] + ((((c - min[a]) % side) + side) % side);
  }

  /** Advances one generation. */
  step() {
    // How many live neighbours each cell next to a live cell has
    const counts = new Map();
    for (const key of this.live) {
      const [x, y, z] = key.split(',').map(Number);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            const neighbour = `${this.round(x + dx, 0)},${this.round(y + dy, 1)},${this.round(z + dz, 2)}`;
            counts.set(neighbour, (counts.get(neighbour) ?? 0) + 1);
          }
        }
      }
    }

    const next = new Set();
    // A live cell with no live neighbour isn't in `counts`; it survives only under S0
    for (const key of this.live) {
      if (!counts.has(key) && this.survival.has(0)) next.add(key);
    }
    for (const [key, count] of counts) {
      const rule = this.live.has(key) ? this.survival : this.birth;
      if (rule.has(count)) next.add(key);
    }
    this.live = next;
    this.generation++;
  }

  /** @returns {number[][]} the live cells as [x, y, z], sorted by z, then y, then x */
  cells() {
    return sortCells([...this.live].map((key) => key.split(',').map(Number)));
  }
}

/** Sorts [x, y, z] cells by z, then y, then x, in place, and returns them. */
export function sortCells(cells) {
  return cells.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
}
