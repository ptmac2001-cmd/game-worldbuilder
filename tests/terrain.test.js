import { describe, it, expect, beforeEach } from 'vitest';
import { h, edit, relax, isFlatLand, isFlatBlock, lowerAll } from '../src/sim/terrain.js';
import { V, MAX_HEIGHT } from '../src/config.js';

const maxNeighbourGap = () => {
  let gap = 0;
  for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const nx = x + dx, nz = z + dz;
    if (nx < V && nz >= 0 && nz < V) gap = Math.max(gap, Math.abs(h[z * V + x] - h[nz * V + nx]));
  }
  return gap;
};

describe('terrain', () => {
  beforeEach(() => h.fill(0));

  it('raising a corner builds a pyramid that keeps the slope rule', () => {
    for (let i = 0; i < 5; i++) edit(20, 20, 1);
    expect(h[20 * V + 20]).toBe(5);
    expect(h[20 * V + 21]).toBe(4);
    expect(h[20 * V + 24]).toBe(1);
    expect(maxNeighbourGap()).toBe(1);
  });

  it('lowering drags neighbours down too', () => {
    h.fill(5);
    for (let i = 0; i < 3; i++) edit(10, 10, -1);
    expect(h[10 * V + 10]).toBe(2);
    expect(maxNeighbourGap()).toBe(1);
  });

  it('refuses to go above the max height or below sea level', () => {
    expect(edit(3, 3, -1)).toBe(false);
    h.fill(MAX_HEIGHT);
    expect(edit(3, 3, 1)).toBe(false);
  });

  it('relax fixes cliffs', () => {
    h[5 * V + 5] = 9;
    relax();
    expect(h[5 * V + 5]).toBe(1);
  });

  it('detects flat land and flat blocks', () => {
    h.fill(2);
    expect(isFlatLand(4, 4)).toBe(true);
    expect(isFlatBlock(4, 4, 3)).toBe(true);
    edit(6, 6, 1);
    expect(isFlatBlock(4, 4, 3)).toBe(false);
    expect(isFlatLand(1, 1)).toBe(true);
  });

  it('flood lowers everything by one step', () => {
    h.fill(1);
    lowerAll();
    expect(isFlatLand(4, 4)).toBe(false);
  });
});
