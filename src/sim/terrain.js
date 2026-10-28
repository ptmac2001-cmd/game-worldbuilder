// The simulation heightmap: integer heights on tile corners, with the Populous
// slope rule (neighbouring corners never differ by more than one step).
import { N, V, MAX_HEIGHT } from '../config.js';
import { rnd, fbm } from '../rng.js';

export const h = new Int8Array(V * V);

export function generate() {
  const feats = [];
  for (let i = 0; i < 4; i++) { const top = 8 + Math.floor(rnd() * 4); feats.push({ x: N * (0.2 + rnd() * 0.6), z: N * (0.2 + rnd() * 0.6), top, r: top + rnd() * 2 }); }
  for (let i = 0; i < 10; i++) feats.push({ x: N * (0.15 + rnd() * 0.7), z: N * (0.15 + rnd() * 0.7), top: 1 + Math.floor(rnd() * 3), r: 5 + rnd() * 7 });
  for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
    let v = 0;
    for (const f of feats) v = Math.max(v, Math.min(f.top, f.r - Math.hypot(x - f.x, z - f.z)));
    v += (fbm(x * 0.15, z * 0.15) - 0.5) * 2.5;
    v = Math.min(v, (Math.min(x, z, N - x, N - z) - 3) * 0.8);
    h[z * V + x] = Math.max(0, Math.round(v));
  }
  relax();
}

// Lower any corner that is more than one step above a neighbour.
export function relax() {
  for (let changed = true; changed;) {
    changed = false;
    for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= V || nz >= V) continue;
      if (h[z * V + x] > h[nz * V + nx] + 1) { h[z * V + x] = h[nz * V + nx] + 1; changed = true; }
    }
  }
}

// Raise (dir 1) or lower (dir -1) one corner and drag neighbours along.
export function edit(x, z, dir) {
  const i0 = z * V + x;
  if ((dir > 0 && h[i0] >= MAX_HEIGHT) || (dir < 0 && h[i0] <= 0)) return false;
  h[i0] += dir;
  const q = [[x, z]];
  while (q.length) {
    const [cx, cz] = q.pop(), hv = h[cz * V + cx];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= V || nz >= V) continue;
      const i = nz * V + nx;
      if (dir > 0 && hv - h[i] > 1) { h[i] = hv - 1; q.push([nx, nz]); }
      if (dir < 0 && h[i] - hv > 1) { h[i] = hv + 1; q.push([nx, nz]); }
    }
  }
  return true;
}

// Flood: the whole world sinks by one step.
export function lowerAll() { for (let i = 0; i < h.length; i++) if (h[i] > 0) h[i]--; }

export const heightAtVertex = (x, z) => h[z * V + x];
export const corners = (x, z) => [h[z * V + x], h[z * V + x + 1], h[(z + 1) * V + x], h[(z + 1) * V + x + 1]];
export const inGrid = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
export function isFlatLand(x, z) {
  if (!inGrid(x, z)) return false;
  const [a, b, c, d] = corners(x, z);
  return a === b && b === c && c === d && a >= 1;
}
export const tileHeight = (x, z) => h[z * V + x];
// A size×size block of tiles starting at (x0, z0) that is all flat at one height.
export function isFlatBlock(x0, z0, size) {
  if (!inGrid(x0, z0) || !inGrid(x0 + size - 1, z0 + size - 1)) return false;
  const hc = h[z0 * V + x0];
  for (let z = z0; z <= z0 + size; z++) for (let x = x0; x <= x0 + size; x++) if (h[z * V + x] !== hc) return false;
  return hc >= 1;
}
export const tileCenter = (x, z) => [x - N / 2 + 0.5, z - N / 2 + 0.5];
export const snapshot = () => h.slice();
export const restore = s => h.set(s);
