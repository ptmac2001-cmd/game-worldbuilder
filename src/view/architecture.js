// Procedural architecture. Every building is assembled from dozens of coloured
// parts with the Kit builder and merged into one geometry per variant.
// Local coordinates: the footprint is centred on the origin, +Z is the front,
// y = 0 is the ground.
import * as THREE from 'three';
import { Kit, local, gableGeo } from './geometry.js';
import { TRIBES } from '../config.js';
import { hash2 } from '../rng.js';

export const C = {
  stone: 0x8e8a80, stoneDark: 0x6c685f, stoneLight: 0xb3ad9f, sandstone: 0xd4c19a,
  marble: 0xeee9df, marble2: 0xd9d2c3, plaster: 0xeadcc0, timber: 0x5b3b24,
  thatch: 0xc49a52, thatchDark: 0xa27c3c, mud: 0xb99a6c, door: 0x6b4428, wood: 0x8a5a34,
  brick: 0xa0523d, slate: 0x55606e, terracotta: 0xb5583a, copper: 0x6fa38f, gold: 0xd9b44a,
  iron: 0x3a3a3a, dark: 0x1e2a36, hay: 0xd8b85a, green: 0x4d6d3a,
};
const FLOWERS = [0xe0503a, 0xf0c63a, 0xe07ab0, 0xffffff];
const trimOf = tribe => tribe === 'red' ? 0x6a2a20 : 0x2e3a52;

function flag(k, x, y, z, tribe, pole = 0.35, size = 0.14) {
  k.cyl(0.008, 0.01, pole, C.timber, x, y, z, 5);
  k.box(size, size * 0.62, 0.01, TRIBES[tribe].flag, x + size / 2 + 0.005, y + pole - size * 0.62 - 0.01, z);
  k.ball(0.014, C.gold, x, y + pole + 0.01, z, 6);
}
function column(k, x, y, z, hh, r = 0.045, hex = C.marble, cap = C.marble2) {
  k.cyl(r * 1.35, r * 1.45, 0.03, cap, x, y, z, 10);
  k.cyl(r * 0.88, r, hh - 0.065, hex, x, y + 0.03, z, 12);
  k.cyl(r * 1.3, r * 0.9, 0.02, cap, x, y + hh - 0.035, z, 10);
  k.box(r * 2.7, 0.018, r * 2.7, cap, x, y + hh - 0.018, z);
}
function logs(k, x, z, n = 3) {
  const P = [[0, 0.025, 0], [0, 0.025, 0.05], [0, 0.07, 0.025], [0, 0.025, -0.05], [0, 0.07, -0.025]];
  for (let i = 0; i < n; i++) k.add(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 7), C.wood, x + P[i][0], P[i][1], z + P[i][2], 0, 0, Math.PI / 2);
}
function barrel(k, x, y, z) {
  k.cyl(0.04, 0.045, 0.1, C.wood, x, y, z, 10);
  k.cyl(0.047, 0.047, 0.012, C.iron, x, y + 0.02, z, 10);
  k.cyl(0.047, 0.047, 0.012, C.iron, x, y + 0.07, z, 10);
}
function crate(k, x, y, z, s = 0.07) { k.box(s, s, s, 0x9a6a3a, x, y, z); k.box(s + 0.004, 0.01, s + 0.004, 0x6b4428, x, y + s * 0.5, z); }
function tree(k, x, y, z, s = 1) {
  k.cyl(0.018 * s, 0.026 * s, 0.14 * s, 0x6b4a2e, x, y, z, 6);
  k.ball(0.1 * s, 0x4f8a3a, x, y + 0.2 * s, z, 7);
  k.ball(0.075 * s, 0x5a9640, x + 0.05 * s, y + 0.16 * s, z + 0.03 * s, 6);
}

// ---------------------------------------------------------------------------
// Homes
// ---------------------------------------------------------------------------
export function hut(tribe) {
  const k = new Kit();
  k.cyl(0.31, 0.34, 0.16, C.stone, 0, -0.1, 0, 14);
  k.cyl(0.26, 0.275, 0.27, C.mud, 0, 0.06, 0, 14);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; if (Math.abs(a - Math.PI / 2) < 0.3) continue; k.cyl(0.013, 0.016, 0.27, C.timber, Math.sin(a) * 0.27, 0.06, Math.cos(a) * 0.27, 5); }
  k.cyl(0.272, 0.272, 0.025, C.timber, 0, 0.2, 0, 14);
  k.door(0, 0.06, 0.268, 0, { w: 0.1, h: 0.17, frame: C.timber });
  k.cone(0.41, 0.36, C.thatch, 0, 0.31, 0, 16);
  k.cyl(0.405, 0.415, 0.04, C.thatchDark, 0, 0.3, 0, 16);
  k.cone(0.24, 0.22, C.thatchDark, 0, 0.5, 0, 12);
  k.cyl(0.035, 0.04, 0.06, C.timber, 0, 0.67, 0, 6);
  k.extras.chimneys.push({ x: 0, y: 0.74, z: 0 });
  logs(k, 0.3, 0.16, 5);
  k.cyl(0.01, 0.012, 0.26, C.timber, -0.3, 0.06, -0.12, 5); k.cyl(0.01, 0.012, 0.26, C.timber, -0.3, 0.06, 0.1, 5);
  k.box(0.012, 0.012, 0.25, C.timber, -0.3, 0.3, -0.01);
  k.box(0.006, 0.12, 0.08, 0xa47a50, -0.3, 0.17, -0.06); k.box(0.006, 0.1, 0.07, 0x8a6a48, -0.3, 0.19, 0.05);
  k.cyl(0.05, 0.04, 0.05, 0x8a6a48, 0.18, 0.06, 0.3, 8);
  flag(k, -0.33, 0.06, 0.25, tribe, 0.5, 0.12);
  return k;
}

export function farmstead(tribe) {
  const k = new Kit(), W = 0.62, D = 0.32;
  k.box(W + 0.04, 0.2, D + 0.04, C.stone, 0, -0.14, -0.05);
  k.box(W, 0.24, D, C.mud, 0, 0.06, -0.05);
  for (let i = 0; i <= 4; i++) for (const z of [D / 2 - 0.05, -D / 2 - 0.05]) k.box(0.03, 0.24, 0.03, C.timber, -W / 2 + i * W / 4, 0.06, z);
  k.box(W + 0.02, 0.03, D + 0.02, C.timber, 0, 0.28, -0.05);
  k.door(-0.12, 0.06, D / 2 - 0.035, 0, { w: 0.1, h: 0.17, frame: C.timber });
  k.window(0.14, 0.2, D / 2 - 0.035, 0, { w: 0.07, h: 0.07, shutters: C.green });
  k.window(0.0, 0.2, -D / 2 - 0.065, Math.PI, { w: 0.07, h: 0.07 });
  k.gable(W + 0.12, D + 0.2, 0.3, C.thatch, 0, 0.3, -0.05, 0, C.mud, C.thatchDark, true);
  k.extras.chimneys.push({ x: 0.15, y: 0.62, z: -0.05 });
  k.box(0.07, 0.03, 0.07, C.thatchDark, 0.15, 0.58, -0.05);
  // granary on stilts
  for (const [x, z] of [[0.2, 0.2], [0.38, 0.2], [0.2, 0.36], [0.38, 0.36]]) k.cyl(0.012, 0.014, 0.12, C.timber, x, 0, z, 5);
  k.box(0.22, 0.14, 0.2, C.wood, 0.29, 0.12, 0.28);
  k.gable(0.26, 0.26, 0.12, C.thatch, 0.29, 0.26, 0.28, Math.PI / 2, C.wood, C.thatchDark, false);
  // haystack and well
  k.cyl(0.1, 0.11, 0.1, C.hay, -0.32, 0, 0.3, 12); k.dome(0.1, C.hay, -0.32, 0.1, 0.3, 12, 1.2);
  k.cyl(0.055, 0.06, 0.08, C.stone, -0.36, 0, -0.35, 10);
  k.cyl(0.045, 0.045, 0.005, 0x2a4a6a, -0.36, 0.075, -0.35, 10);
  k.box(0.01, 0.16, 0.01, C.timber, -0.41, 0.08, -0.35); k.box(0.01, 0.16, 0.01, C.timber, -0.31, 0.08, -0.35);
  k.gable(0.14, 0.1, 0.05, C.thatch, -0.36, 0.24, -0.35, 0, C.thatch, C.thatchDark, false);
  flag(k, 0.4, 0.26, 0.38, tribe, 0.25, 0.09);
  return k;
}

export function cottage(tribe) {
  const k = new Kit(), W = 0.7, D = 0.5, WH = 0.4, B = 0.06, T = TRIBES[tribe];
  k.box(W + 0.08, 0.36, D + 0.08, C.stone, 0, B - 0.36, 0);
  k.box(W, WH, D, C.plaster, 0, B, 0);
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [D / 2, -D / 2]) k.box(0.035, WH, 0.035, C.timber, x, B, z);
  for (const x of [-W / 2, W / 2]) k.box(0.035, WH, 0.035, C.timber, x, B, 0);
  for (const z of [D / 2, -D / 2]) { k.box(W + 0.03, 0.035, 0.035, C.timber, 0, B + WH - 0.035, z); k.box(W + 0.03, 0.03, 0.03, C.timber, 0, B + 0.2, z); k.box(W + 0.03, 0.03, 0.03, C.timber, 0, B, z); }
  for (const x of [-W / 2, W / 2]) k.box(0.035, 0.035, D + 0.03, C.timber, x, B + WH - 0.035, 0);
  k.box(0.022, 0.24, 0.02, C.timber, -W / 3, B + 0.1, D / 2 + 0.005, 0, 0, 0.65);
  k.box(0.022, 0.24, 0.02, C.timber, W / 3, B + 0.1, -D / 2 - 0.005, 0, 0, -0.65);
  k.door(0.04, B, D / 2 + 0.012, 0, { w: 0.12, h: 0.22 });
  k.box(0.2, 0.02, 0.1, C.timber, 0.04, B + 0.25, D / 2 + 0.05, 0, 0.35, 0); // porch hood
  k.window(-0.22, B + 0.27, D / 2 + 0.012, 0, { shutters: C.green, flowers: FLOWERS });
  k.window(0.24, B + 0.27, D / 2 + 0.012, 0, { shutters: C.green, flowers: FLOWERS });
  k.window(0.0, B + 0.25, -D / 2 - 0.012, Math.PI, { shutters: C.green });
  k.window(W / 2 + 0.012, B + 0.25, 0.0, Math.PI / 2, {});
  k.window(-W / 2 - 0.012, B + 0.25, 0.0, -Math.PI / 2, {});
  k.gable(W + 0.16, D + 0.18, 0.36, T.roof, 0, B + WH, 0, 0, C.plaster, trimOf(tribe));
  // dormer
  k.box(0.14, 0.14, 0.12, C.plaster, -0.1, B + WH + 0.02, 0.2);
  k.window(-0.1, B + WH + 0.1, 0.262, 0, { w: 0.06, h: 0.065 });
  k.hip(0.19, 0.17, 0.08, T.roof, -0.1, B + WH + 0.16, 0.21);
  const cx = W / 2 - 0.13, cz = -0.12;
  k.box(0.11, 0.44, 0.11, C.brick, cx, B + WH, cz);
  k.box(0.14, 0.035, 0.14, C.stoneDark, cx, B + WH + 0.42, cz);
  k.cyl(0.02, 0.022, 0.05, 0xb5583a, cx - 0.02, B + WH + 0.455, cz, 6); k.cyl(0.02, 0.022, 0.04, 0xb5583a, cx + 0.025, B + WH + 0.455, cz, 6);
  k.extras.chimneys.push({ x: cx, y: B + WH + 0.52, z: cz });
  barrel(k, W / 2 + 0.07, 0, D / 2 - 0.06);
  k.box(0.2, 0.02, 0.06, C.wood, -0.2, 0.06, D / 2 + 0.09); k.box(0.015, 0.05, 0.05, C.wood, -0.28, 0.01, D / 2 + 0.09); k.box(0.015, 0.05, 0.05, C.wood, -0.12, 0.01, D / 2 + 0.09);
  k.cyl(0.008, 0.008, 0.05, C.iron, 0.14, B + 0.2, D / 2 + 0.03, 4); k.box(0.03, 0.04, 0.03, 0xf2d27a, 0.14, B + 0.17, D / 2 + 0.035);
  return k;
}

export function manor(tribe) {
  const k = new Kit(), W = 0.86, D = 0.62, B = 0.06, T = TRIBES[tribe];
  k.box(W + 0.08, 0.4, D + 0.08, C.stoneDark, 0, B - 0.4, 0);
  k.box(W, 0.34, D, C.stoneLight, 0, B, 0);
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) for (let q = 0; q < 4; q++) k.box(q % 2 ? 0.07 : 0.05, 0.085, q % 2 ? 0.05 : 0.07, C.stone, x, B + q * 0.085, z);
  k.box(W + 0.1, 0.04, D + 0.1, C.timber, 0, B + 0.34, 0);
  const UY = B + 0.38, UH = 0.3;
  k.box(W + 0.06, UH, D + 0.06, C.plaster, 0, UY, 0);
  for (let i = 0; i <= 6; i++) { const x = -W / 2 - 0.03 + i * (W + 0.06) / 6; for (const z of [D / 2 + 0.03, -D / 2 - 0.03]) k.box(0.03, UH, 0.03, C.timber, x, UY, z); }
  for (const x of [-W / 2 - 0.03, W / 2 + 0.03]) for (const z of [-D / 6, D / 6]) k.box(0.03, UH, 0.03, C.timber, x, UY, z);
  for (const z of [D / 2 + 0.03, -D / 2 - 0.03]) { k.box(W + 0.1, 0.03, 0.035, C.timber, 0, UY + UH - 0.03, z); k.box(W + 0.1, 0.025, 0.035, C.timber, 0, UY + 0.12, z); }
  k.door(0, B, D / 2 + 0.012, 0, { w: 0.15, h: 0.22, arched: true, frame: C.stone });
  k.box(0.3, 0.03, 0.14, C.stone, 0, 0.0, D / 2 + 0.08);
  for (const x of [-0.28, 0.28]) k.window(x, B + 0.19, D / 2 + 0.012, 0, { arched: true, h: 0.09, frame: C.stone, sill: C.stone });
  for (const x of [-0.3, -0.1, 0.1, 0.3]) k.window(x, UY + 0.15, D / 2 + 0.042, 0, { shutters: C.green, flowers: FLOWERS });
  for (const x of [-0.25, 0.25]) k.window(x, UY + 0.15, -D / 2 - 0.042, Math.PI, {});
  k.window(-W / 2 - 0.042, UY + 0.15, 0, -Math.PI / 2, {});
  k.gable(W + 0.2, D + 0.22, 0.42, T.roof, 0, UY + UH, 0, 0, C.plaster, trimOf(tribe));
  for (const x of [-0.22, 0.22]) {
    k.box(0.13, 0.14, 0.12, C.plaster, x, UY + UH + 0.01, 0.27);
    k.window(x, UY + UH + 0.09, 0.332, 0, { w: 0.055, h: 0.065 });
    k.hip(0.18, 0.17, 0.08, T.roof, x, UY + UH + 0.15, 0.28);
  }
  const cx = -W / 2 + 0.16, cz = -0.1;
  k.box(0.12, 0.52, 0.12, C.brick, cx, UY + UH, cz);
  k.box(0.15, 0.04, 0.15, C.stoneDark, cx, UY + UH + 0.5, cz);
  k.extras.chimneys.push({ x: cx, y: UY + UH + 0.58, z: cz });
  const tx = W / 2 + 0.02, tz = -D / 2 + 0.02;
  k.cyl(0.17, 0.2, 1.25, C.stoneLight, tx, -0.15, tz, 14);
  k.cyl(0.19, 0.19, 0.03, C.stone, tx, 0.55, tz, 14);
  k.cyl(0.21, 0.21, 0.07, C.stoneDark, tx, 1.06, tz, 14);
  k.cone(0.25, 0.46, T.roof, tx, 1.13, tz, 14);
  flag(k, tx, 1.57, tz, tribe, 0.28, 0.15);
  for (const a of [0.4, 2.2, 3.8]) { const [px, pz] = local(tx, tz, 0, Math.cos(a) * 0.18, Math.sin(a) * 0.18); k.window(px, 0.8, pz, Math.PI / 2 - a, { w: 0.045, h: 0.09, arched: true, mullion: false, frame: C.stone, sill: C.stone }); }
  k.box(0.05, 0.08, 0.3, 0x3f6e30, -W / 2 - 0.1, 0.02, 0.2);
  tree(k, -W / 2 - 0.12, 0, -0.25, 0.9);
  return k;
}

const TOWN_WALLS = [0xe8d5b0, 0xd9b99b, 0xc9d3c0, 0xe6c8c0, 0xd4c19a, 0xa0523d];
const AWNINGS = [[0xc0392b, 0xf3efe6], [0x2e7d4f, 0xf3efe6], [0x2f5fa8, 0xf3efe6], [0xd9a72b, 0xf3efe6]];
export function townhouses(tribe, seed = 0) {
  const k = new Kit(), T = TRIBES[tribe], D = 0.5, FH = 0.25, w = 0.3;
  for (let i = 0; i < 3; i++) {
    const x = -0.3 + i * 0.3, r = hash2(seed * 7 + i, seed * 3 - i);
    const wall = TOWN_WALLS[Math.floor(r * TOWN_WALLS.length)], brick = wall === C.brick;
    const floors = 2 + (r > 0.45 ? 1 : 0), top = 0.04 + floors * FH;
    const roof = r > 0.6 ? C.slate : (r > 0.25 ? T.roof : C.terracotta);
    k.box(w, 0.3, D, C.stoneDark, x, -0.26, 0);
    k.box(w - 0.004, top, D, wall, x, 0.04, 0);
    for (let f = 1; f < floors; f++) k.box(w + 0.01, 0.018, D + 0.01, brick ? C.stoneLight : C.stone, x, 0.04 + f * FH, 0);
    k.box(w + 0.02, 0.03, D + 0.02, C.stoneLight, x, top, 0);
    if (i === 1 || r > 0.7) {
      // shop front with striped awning
      k.box(w * 0.7, 0.12, 0.02, 0x2f4458, x, 0.08, D / 2 + 0.005);
      k.box(w * 0.74, 0.02, 0.03, C.timber, x, 0.2, D / 2 + 0.01);
      const [a, b] = AWNINGS[Math.floor(r * 97) % AWNINGS.length];
      for (let s = 0; s < 5; s++) k.box(w * 0.8 / 5, 0.012, 0.1, s % 2 ? b : a, x - w * 0.4 + (s + 0.5) * w * 0.8 / 5 - w * 0.08, 0.2, D / 2 + 0.06, 0, 0.35, 0);
      crate(k, x - 0.08, 0, D / 2 + 0.06, 0.05);
    } else {
      k.door(x - 0.06, 0.04, D / 2 + 0.01, 0, { w: 0.08, h: 0.17, arched: r > 0.5, hex: r > 0.5 ? 0x3b5a8a : C.door });
      k.window(x + 0.07, 0.15, D / 2 + 0.012, 0, { w: 0.07, h: 0.09 });
    }
    for (let f = 1; f < floors; f++) for (const wx of [-0.07, 0.07]) {
      k.window(x + wx, 0.04 + f * FH + 0.12, D / 2 + 0.012, 0, { w: 0.065, h: 0.1, shutters: f === 1 && !brick ? C.green : null, flowers: f === 1 && r > 0.3 ? FLOWERS : null });
      k.window(x + wx, 0.04 + f * FH + 0.12, -D / 2 - 0.012, Math.PI, { w: 0.065, h: 0.1 });
    }
    // gable faces the street
    if (brick) {
      for (let s = 0; s < 4; s++) k.box(w - 0.02 - s * 0.07, 0.07, 0.03, wall, x, top + 0.03 + s * 0.065, D / 2 - 0.005);
      k.gable(D + 0.04, w + 0.04, 0.28, roof, x, top + 0.03, -0.02, Math.PI / 2, wall, trimOf(tribe), true);
    } else {
      k.gable(D + 0.06, w + 0.04, 0.26, roof, x, top + 0.03, 0, Math.PI / 2, wall, trimOf(tribe), true);
      k.window(x, top + 0.12, D / 2 + 0.035, 0, { w: 0.05, h: 0.07, mullion: false });
    }
    if (i !== 1) {
      k.box(0.07, 0.3, 0.07, brick ? C.stoneLight : C.brick, x + (i === 0 ? -0.08 : 0.08), top, -0.12);
      k.extras.chimneys.push({ x: x + (i === 0 ? -0.08 : 0.08), y: top + 0.33, z: -0.12 });
    }
  }
  k.box(0.9, 0.08, 0.02, C.stone, 0, 0, -D / 2 - 0.16);
  barrel(k, 0.36, 0, -0.34);
  return k;
}

export function keep(tribe) {
  const k = new Kit(), T = TRIBES[tribe], S = 0.56, H = 1.0;
  k.box(0.9, 0.3, 0.9, C.stoneDark, 0, -0.26, 0);
  k.box(0.9, 0.06, 0.9, C.stone, 0, 0.0, 0);
  k.box(S, H, S, C.stoneLight, 0, 0.04, 0);
  for (const y of [0.35, 0.7]) k.box(S + 0.02, 0.025, S + 0.02, C.stone, 0, y, 0);
  for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const [lx, y] of [[-0.12, 0.5], [0.12, 0.5], [0, 0.82], [-0.12, 0.82], [0.12, 0.82]]) {
    const [px, pz] = local(0, 0, face, lx, S / 2 + 0.006);
    k.box(0.025, 0.09, 0.02, C.dark, px, y, pz, face);
  }
  const top = 0.04 + H;
  k.box(S + 0.06, 0.04, S + 0.06, C.stone, 0, top, 0);
  for (let i = 0; i < 7; i++) for (const [dx, dz, ry] of [[1, 0, 0], [0, 1, Math.PI / 2]]) for (const s of [-1, 1]) {
    const t = -S / 2 + 0.03 + i * (S - 0.06) / 6;
    k.box(0.05, 0.07, 0.05, C.stoneLight, dx ? t : s * (S / 2), top + 0.04, dz ? t : s * (S / 2), ry);
  }
  flag(k, 0, top + 0.04, 0, tribe, 0.45, 0.2);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = x * S / 2, tz = z * S / 2;
    k.cyl(0.1, 0.11, 1.2, C.stone, tx, 0.04, tz, 12);
    k.cyl(0.12, 0.12, 0.05, C.stoneDark, tx, 1.24, tz, 12);
    k.cone(0.14, 0.3, T.roof, tx, 1.29, tz, 12);
    k.ball(0.015, C.gold, tx, 1.6, tz, 6);
    k.box(0.02, 0.08, 0.02, C.dark, tx + x * 0.1, 0.7, tz + z * 0.1 * 0 + 0.0);
  }
  // gatehouse
  k.box(0.26, 0.4, 0.14, C.stone, 0, 0.04, S / 2 + 0.05);
  k.door(0, 0.04, S / 2 + 0.125, 0, { w: 0.14, h: 0.2, arched: true, hex: 0x4a3020, frame: C.stoneDark });
  for (let i = 0; i < 4; i++) k.box(0.05, 0.05, 0.05, C.stoneLight, -0.105 + i * 0.07, 0.44, S / 2 + 0.1);
  k.box(0.02, 0.02, 0.3, C.stoneDark, -0.24, 0.02, 0.36); k.box(0.02, 0.02, 0.3, C.stoneDark, 0.24, 0.02, 0.36);
  return k;
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------
export function shrine(tribe) {
  const k = new Kit();
  k.cyl(0.4, 0.44, 0.14, C.stoneLight, 0, -0.08, 0, 20);
  k.cyl(0.3, 0.32, 0.04, C.stone, 0, 0.06, 0, 20);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, hgt = 0.24 + hash2(i, 5) * 0.12;
    k.box(0.07, hgt, 0.05, 0x9a958c, Math.sin(a) * 0.33, 0.04, Math.cos(a) * 0.33, a, 0, (hash2(i, 9) - 0.5) * 0.15);
  }
  k.box(0.08, 0.035, 0.34, 0x9a958c, 0, 0.36, -0.28, 0);
  k.box(0.16, 0.12, 0.11, C.marble, 0, 0.1, 0);
  k.cyl(0.05, 0.035, 0.035, 0xb07a3a, 0, 0.22, 0, 10);
  k.extras.fires.push({ x: 0, y: 0.26, z: 0, s: 0.8 });
  for (const s of [-1, 1]) flag(k, s * 0.22, 0.06, 0.28, tribe, 0.34, 0.1);
  return k;
}

export function windmill(tribe) {
  const k = new Kit();
  k.cyl(0.3, 0.32, 0.12, C.stone, 0, -0.08, 0, 12);
  k.cyl(0.17, 0.25, 0.92, C.plaster, 0, 0.04, 0, 10);
  for (const y of [0.3, 0.62]) k.cyl(0.235 - y * 0.08, 0.24 - y * 0.08, 0.02, C.stone, 0, y, 0, 10);
  k.door(0, 0.04, 0.245, 0, { w: 0.09, h: 0.16, arched: true, frame: C.stone });
  for (const [a, y] of [[0.8, 0.4], [-1.2, 0.55], [2.6, 0.72]]) { const r = 0.24 - y * 0.08; k.window(Math.sin(a) * r, y, Math.cos(a) * r, a, { w: 0.05, h: 0.07, mullion: false }); }
  k.cyl(0.21, 0.19, 0.04, C.timber, 0, 0.96, 0, 10);
  k.cone(0.22, 0.28, C.thatchDark, 0, 1.0, 0, 10);
  k.ball(0.02, C.gold, 0, 1.3, 0, 6);
  k.cyl(0.018, 0.018, 0.12, C.timber, 0, 1.06, 0.2, 6); // axle housing
  k.extras.sails.push({ x: 0, y: 1.1, z: 0.27 });
  k.box(0.2, 0.14, 0.16, C.wood, 0.3, 0, -0.18);
  k.gable(0.24, 0.2, 0.08, C.thatch, 0.3, 0.14, -0.18, 0, C.wood, C.thatchDark, false);
  for (let i = 0; i < 3; i++) k.ball(0.035, 0xd8c8a0, -0.28 + i * 0.05, 0.03, 0.22 + (i % 2) * 0.03, 6);
  flag(k, -0.3, 0.04, -0.2, tribe, 0.3, 0.1);
  return k;
}

// The sails are a separate spinning mesh.
export function sailsGeo() {
  const k = new Kit();
  k.cyl(0.035, 0.035, 0.05, C.timber, 0, -0.025, 0, 8);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const at = (d, o) => [Math.sin(a) * d + Math.cos(a) * o, Math.cos(a) * d - Math.sin(a) * o];
    let [x, y] = at(0.3, 0);
    k.add(new THREE.BoxGeometry(0.018, 0.6, 0.018), C.timber, x, y, 0.03, 0, 0, -a);
    [x, y] = at(0.34, 0.065);
    k.add(new THREE.BoxGeometry(0.11, 0.44, 0.006), 0xefe6d0, x, y, 0.035, 0, 0, -a);
    for (let j = 0; j < 5; j++) { [x, y] = at(0.14 + j * 0.095, 0.065); k.add(new THREE.BoxGeometry(0.13, 0.008, 0.01), C.timber, x, y, 0.04, 0, 0, -a); }
  }
  return k.build().geo.rotateX(Math.PI / 2).rotateX(-Math.PI / 2);
}

export function temple(tribe) {
  const k = new Kit(), T = TRIBES[tribe];
  // stepped platform
  k.box(1.9, 0.3, 1.66, C.marble2, 0, -0.24, 0);
  k.box(1.8, 0.06, 1.56, C.marble, 0, 0.06, 0);
  k.box(1.7, 0.06, 1.46, C.marble2, 0, 0.12, 0);
  k.box(0.6, 0.06, 0.12, C.marble, 0, 0.0, 0.85); k.box(0.6, 0.06, 0.12, C.marble2, 0, 0.06, 0.8);
  const CY = 0.18, CH = 0.66;
  const xs = [...Array(6)].map((_, i) => -0.75 + i * 0.3), zs = [...Array(7)].map((_, i) => -0.6 + i * 0.2);
  for (const x of xs) for (const z of [-0.6, 0.6]) column(k, x, CY, z, CH);
  for (const z of zs.slice(1, -1)) for (const x of [-0.75, 0.75]) column(k, x, CY, z, CH);
  // cella
  k.box(1.0, 0.62, 0.8, C.marble2, 0, CY, -0.05);
  k.door(0, CY, 0.355, 0, { w: 0.2, h: 0.36, hex: 0x8a6a2a, frame: C.marble });
  for (const x of [-0.3, 0.3]) k.box(0.05, 0.62, 0.05, C.marble, x, CY, 0.35);
  // statue inside the portico
  k.box(0.12, 0.08, 0.1, C.marble, 0, CY, 0.45);
  k.cyl(0.03, 0.04, 0.16, C.gold, 0, CY + 0.08, 0.45, 8); k.ball(0.028, C.gold, 0, CY + 0.27, 0.45, 8);
  // entablature
  const EY = CY + CH;
  k.box(1.66, 0.07, 1.36, C.marble2, 0, EY, 0);
  k.box(1.66, 0.07, 1.36, C.marble, 0, EY + 0.07, 0);
  for (let i = 0; i < 16; i++) for (const z of [0.681, -0.681]) k.box(0.03, 0.06, 0.004, T.flag, -0.78 + i * 0.104, EY + 0.075, z);
  k.box(1.78, 0.035, 1.48, C.marble2, 0, EY + 0.14, 0);
  // roof with pediments front and back
  const RY = EY + 0.175;
  const [s, e] = gableGeo(1.52, 1.8, 0.3);
  k.add(s, C.terracotta, 0, RY, 0, Math.PI / 2);
  k.add(e, C.marble, 0, RY, 0, Math.PI / 2);
  const [, e2] = gableGeo(1.53, 1.36, 0.2);
  k.add(e2, T.roof, 0, RY + 0.035, 0, Math.PI / 2);
  for (let i = 1; i < 8; i++) for (const sd of [-1, 1]) k.box(0.02, 0.01, 1.52, 0x8e3f28, sd * i * 0.11, RY + 0.3 * (1 - i * 0.11 / 0.9) + 0.004, 0, 0, 0, sd * Math.atan2(0.3, 0.9));
  for (const z of [0.76, -0.76]) { k.cone(0.04, 0.1, C.gold, 0, RY + 0.3, z, 6); for (const x of [-0.88, 0.88]) k.cone(0.03, 0.07, C.gold, x, RY, z, 6); }
  // braziers
  for (const x of [-0.65, 0.65]) {
    k.cyl(0.03, 0.05, 0.2, C.stoneDark, x, 0.18, 0.8, 8);
    k.cyl(0.07, 0.04, 0.05, 0xb07a3a, x, 0.38, 0.8, 10);
    k.extras.fires.push({ x, y: 0.43, z: 0.8, s: 0.9 });
  }
  return k;
}

export function townCentre(tribe) {
  const k = new Kit(), T = TRIBES[tribe];
  // Town hall along the back
  const HZ = -0.85, W = 2.3, D = 0.9, B = 0.02;
  k.box(W + 0.06, 0.3, D + 0.06, C.stoneDark, 0, B - 0.3, HZ);
  k.box(W, 0.4, D, C.stoneLight, 0, B, HZ);
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 0.16 + i * (W - 0.32) / 8;
    k.box(0.16, 0.2, 0.02, 0x3e3a34, x, B, HZ + D / 2 + 0.005);
    k.add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), 0x3e3a34, x, B + 0.2, HZ + D / 2 + 0.005);
    k.box(0.05, 0.4, 0.05, C.stone, x + (W - 0.32) / 16, B, HZ + D / 2 + 0.01);
  }
  k.box(W + 0.04, 0.04, D + 0.04, C.stone, 0, B + 0.4, HZ);
  k.box(W - 0.04, 0.36, D - 0.04, C.sandstone, 0, B + 0.44, HZ);
  for (let i = 0; i < 10; i++) {
    const x = -W / 2 + 0.14 + i * (W - 0.28) / 9;
    k.window(x, B + 0.6, HZ + D / 2 - 0.008, 0, { w: 0.08, h: 0.13, arched: true, frame: C.stone, sill: C.stone });
    k.window(x, B + 0.6, HZ - D / 2 + 0.008, Math.PI, { w: 0.08, h: 0.13, arched: true, frame: C.stone, sill: C.stone });
  }
  for (const s of [-1, 1]) for (const z of [-0.2, 0.2]) k.window(s * (W / 2 - 0.02) + s * 0.008, B + 0.6, HZ + z, s * Math.PI / 2, { w: 0.08, h: 0.13, arched: true, frame: C.stone, sill: C.stone });
  k.box(W + 0.06, 0.05, D + 0.06, C.stone, 0, B + 0.8, HZ);
  k.hip(W + 0.1, D + 0.12, 0.34, C.slate, 0, B + 0.85, HZ);
  // entrance portico
  k.box(0.6, 0.06, 0.2, C.stone, 0, 0, HZ + D / 2 + 0.1);
  k.door(0, B, HZ + D / 2 + 0.012, 0, { w: 0.18, h: 0.26, arched: true, hex: 0x5a3a20, frame: C.stoneDark });
  for (const x of [-0.24, 0.24]) column(k, x, 0.06, HZ + D / 2 + 0.15, 0.5, 0.035, C.stoneLight, C.stone);
  k.box(0.62, 0.06, 0.1, C.stone, 0, 0.56, HZ + D / 2 + 0.13);
  // clock tower
  const TY = B + 0.85, TS = 0.38;
  k.box(TS, 1.05, TS, C.sandstone, 0, TY, HZ);
  for (const y of [TY + 0.35, TY + 0.7]) k.box(TS + 0.03, 0.03, TS + 0.03, C.stone, 0, y, HZ);
  for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const [cx, cz] = local(0, HZ, face, 0, TS / 2 + 0.012);
    k.add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20).rotateX(Math.PI / 2), 0xf4f0e4, cx, TY + 0.52, cz, face);
    k.add(new THREE.CylinderGeometry(0.125, 0.125, 0.015, 20).rotateX(Math.PI / 2), C.gold, ...local(0, HZ, face, 0, TS / 2 + 0.004).flatMap((v, i) => i ? [TY + 0.52, v] : [v]), face);
    const [hx, hz] = local(0, HZ, face, 0, TS / 2 + 0.024);
    k.add(new THREE.BoxGeometry(0.012, 0.07, 0.006), C.iron, hx, TY + 0.55, hz, face, 0, 0.5);
    k.add(new THREE.BoxGeometry(0.01, 0.09, 0.006), C.iron, hx, TY + 0.56, hz, face, 0, -0.9);
    for (const lx of [-0.08, 0.08]) {
      const [ox, oz] = local(0, HZ, face, lx, TS / 2 + 0.006);
      k.box(0.07, 0.14, 0.012, 0x2a2622, ox, TY + 0.78, oz, face);
      k.add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 8, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), 0x2a2622, ox, TY + 0.92, oz, face);
    }
  }
  k.box(TS + 0.06, 0.05, TS + 0.06, C.stone, 0, TY + 1.05, HZ);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cone(0.035, 0.12, C.stone, x * TS / 2, TY + 1.1, HZ + z * TS / 2, 6);
  k.cone(0.26, 0.7, T.roof, 0, TY + 1.1, HZ, 4, Math.PI / 4);
  k.ball(0.03, C.gold, 0, TY + 1.82, HZ, 8);
  flag(k, 0, TY + 1.84, HZ, tribe, 0.3, 0.16);
  // Plaza: fountain
  const FZ = 0.45;
  k.cyl(0.36, 0.38, 0.1, C.stoneLight, 0, 0, FZ, 8);
  k.cyl(0.33, 0.33, 0.005, 0x4aa3c8, 0, 0.085, FZ, 8);
  k.cyl(0.06, 0.08, 0.22, C.stoneLight, 0, 0.08, FZ, 10);
  k.cyl(0.16, 0.05, 0.05, C.stoneLight, 0, 0.3, FZ, 12);
  k.cyl(0.14, 0.14, 0.005, 0x4aa3c8, 0, 0.345, FZ, 12);
  k.cyl(0.025, 0.035, 0.12, C.stoneLight, 0, 0.35, FZ, 8);
  k.ball(0.035, C.gold, 0, 0.49, FZ, 8);
  k.extras.sprays.push({ x: 0, y: 0.5, z: FZ });
  // market stalls
  const stall = (x, z, ry, cols) => {
    const at = (lx, lz) => local(x, z, ry, lx, lz);
    for (const [lx, lz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) { const [px, pz] = at(lx, lz); k.cyl(0.008, 0.008, 0.26, C.timber, px, 0, pz, 4); }
    let [px, pz] = at(0, 0.05); k.box(0.3, 0.1, 0.1, C.wood, px, 0, pz, ry);
    for (let s = 0; s < 6; s++) { [px, pz] = at(-0.15 + (s + 0.5) * 0.05, 0); k.box(0.05, 0.01, 0.28, s % 2 ? cols[1] : cols[0], px, 0.27, pz, ry, 0.25); }
    for (let g = 0; g < 5; g++) { [px, pz] = at(-0.1 + g * 0.05, 0.06); k.ball(0.018, [0xd8352a, 0xf0c63a, 0x6fa33a, 0xe07a2a, 0x8a3a8a][g], px, 0.115, pz, 6); }
    [px, pz] = at(0.2, -0.05); crate(k, px, 0, pz, 0.06);
    [px, pz] = at(-0.2, 0.0); barrel(k, px, 0, pz);
  };
  stall(-1.05, 0.25, Math.PI / 2, AWNINGS[0]); stall(-1.05, 0.95, Math.PI / 2, AWNINGS[1]);
  stall(1.05, 0.25, -Math.PI / 2, AWNINGS[2]); stall(1.05, 0.95, -Math.PI / 2, AWNINGS[3]);
  // lamps, benches, planters, statue
  for (const [x, z] of [[-0.55, 0.0], [0.55, 0.0], [-0.55, 1.1], [0.55, 1.1]]) {
    k.cyl(0.012, 0.018, 0.4, C.iron, x, 0, z, 6); k.box(0.05, 0.06, 0.05, 0xf2d27a, x, 0.4, z); k.cone(0.045, 0.04, C.iron, x, 0.46, z, 4, Math.PI / 4);
  }
  for (const x of [-0.45, 0.45]) { k.box(0.2, 0.02, 0.06, C.wood, x, 0.05, FZ); k.box(0.02, 0.05, 0.05, C.iron, x - 0.08, 0, FZ); k.box(0.02, 0.05, 0.05, C.iron, x + 0.08, 0, FZ); }
  for (const x of [-1.25, 1.25]) { k.cyl(0.09, 0.08, 0.08, C.stoneLight, x, 0, -0.2, 10); tree(k, x, 0.08, -0.2, 1.1); }
  k.box(0.16, 0.2, 0.16, C.stoneLight, 0, 0, 1.25);
  k.cyl(0.03, 0.04, 0.14, 0x8a6a3a, 0, 0.2, 1.25, 8); k.ball(0.03, 0x8a6a3a, 0, 0.37, 1.25, 8);
  k.box(0.012, 0.12, 0.012, 0x8a6a3a, 0.04, 0.3, 1.25, 0, 0, -0.6);
  return k;
}

export function cathedral(tribe) {
  const k = new Kit(), T = TRIBES[tribe], M = 0xe9e2d2;
  k.box(2.9, 0.3, 2.9, C.stoneDark, 0, -0.26, 0);
  k.box(2.8, 0.08, 2.8, C.stoneLight, 0, 0.04, 0);
  k.box(2.6, 0.08, 2.6, C.marble2, 0, 0.12, 0);
  const B = 0.2, S = 1.6, H = 0.9;
  k.box(S, H, S, M, 0, B, 0);
  for (const y of [B + 0.42, B + H]) k.box(S + 0.04, 0.035, S + 0.04, C.marble2, 0, y, 0);
  for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (let i = 0; i < 5; i++) {
      const lx = -0.6 + i * 0.3;
      let [px, pz] = local(0, 0, face, lx - 0.15, S / 2 + 0.01);
      if (i > 0) k.box(0.05, H, 0.02, C.marble2, px, B, pz, face);
      if (face === 0 && Math.abs(lx) < 0.4) continue;
      [px, pz] = local(0, 0, face, lx, S / 2 + 0.008);
      k.window(px, B + 0.22, pz, face, { w: 0.09, h: 0.16, arched: true, frame: C.marble2, sill: C.marble2, glass: 0x34506e });
      k.window(px, B + 0.64, pz, face, { w: 0.07, h: 0.12, arched: true, frame: C.marble2, sill: C.marble2, glass: 0x34506e });
    }
  }
  // rose window above the portico
  k.add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16).rotateX(Math.PI / 2), 0x6a3a7a, 0, B + 0.7, S / 2 + 0.01);
  k.add(new THREE.TorusGeometry(0.13, 0.02, 6, 20), C.marble2, 0, B + 0.7, S / 2 + 0.02);
  for (let i = 0; i < 4; i++) k.add(new THREE.BoxGeometry(0.26, 0.012, 0.01), C.marble2, 0, B + 0.7, S / 2 + 0.022, 0, 0, i * Math.PI / 4);
  // flat roof and drum
  k.box(S + 0.08, 0.05, S + 0.08, C.marble2, 0, B + H, 0);
  const DY = B + H + 0.05, DR = 0.6;
  k.cyl(DR + 0.06, DR + 0.08, 0.06, C.marble2, 0, DY, 0, 24);
  k.cyl(DR, DR, 0.38, M, 0, DY + 0.06, 0, 24);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    k.window(Math.sin(a) * (DR + 0.005), DY + 0.24, Math.cos(a) * (DR + 0.005), a, { w: 0.07, h: 0.13, arched: true, frame: C.marble2, sill: C.marble2, mullion: false });
    const b = a + Math.PI / 12;
    k.box(0.035, 0.38, 0.03, C.marble2, Math.sin(b) * (DR + 0.01), DY + 0.06, Math.cos(b) * (DR + 0.01), b);
  }
  k.cyl(DR + 0.05, DR + 0.05, 0.04, C.marble2, 0, DY + 0.44, 0, 24);
  const domeHex = tribe === 'red' ? 0xb86a3a : C.copper;
  k.dome(DR + 0.01, domeHex, 0, DY + 0.48, 0, 28, 1.05);
  for (let i = 0; i < 4; i++) k.add(new THREE.TorusGeometry(DR + 0.02, 0.012, 4, 24, Math.PI).scale(1, 1.05, 1), C.gold, 0, DY + 0.48, 0, i * Math.PI / 4);
  const LY = DY + 0.48 + DR * 1.05 - 0.04;
  k.cyl(0.1, 0.1, 0.2, M, 0, LY, 0, 8);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box(0.035, 0.12, 0.01, C.dark, Math.sin(a) * 0.1, LY + 0.04, Math.cos(a) * 0.1, a); }
  k.dome(0.11, C.gold, 0, LY + 0.2, 0, 12);
  k.ball(0.03, C.gold, 0, LY + 0.34, 0, 8);
  k.cone(0.012, 0.16, C.gold, 0, LY + 0.35, 0, 6);
  // corner bell towers
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = x * 0.9, tz = z * 0.9;
    k.box(0.34, 1.25, 0.34, M, tx, B, tz);
    for (const y of [B + 0.42, B + 0.9]) k.box(0.37, 0.03, 0.37, C.marble2, tx, y, tz);
    for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const [px, pz] = local(tx, tz, face, 0, 0.175);
      k.window(px, B + 0.62, pz, face, { w: 0.06, h: 0.12, arched: true, frame: C.marble2, sill: C.marble2, mullion: false });
    }
    k.cyl(0.14, 0.16, 0.32, M, tx, B + 1.25, tz, 8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; k.box(0.05, 0.16, 0.01, C.dark, tx + Math.sin(a) * 0.145, B + 1.33, tz + Math.cos(a) * 0.145, a); }
    k.cyl(0.17, 0.17, 0.03, C.marble2, tx, B + 1.57, tz, 8);
    k.dome(0.15, domeHex, tx, B + 1.6, tz, 12, 1.3);
    k.ball(0.022, C.gold, tx, B + 1.82, tz, 6);
    k.cone(0.008, 0.1, C.gold, tx, B + 1.83, tz, 5);
  }
  // portico
  const PZ = S / 2 + 0.22;
  for (let i = 0; i < 6; i++) column(k, -0.5 + i * 0.2, B, PZ + 0.12, 0.66, 0.04, M, C.marble2);
  for (const x of [-0.5, 0.5]) column(k, x, B, PZ - 0.08, 0.66, 0.04, M, C.marble2);
  k.box(1.16, 0.07, 0.42, C.marble2, 0, B + 0.66, PZ + 0.02);
  const [ps, pe] = gableGeo(0.44, 1.2, 0.24);
  k.add(ps, domeHex, 0, B + 0.73, PZ + 0.02, Math.PI / 2);
  k.add(pe, M, 0, B + 0.73, PZ + 0.02, Math.PI / 2);
  const [, pe2] = gableGeo(0.45, 0.9, 0.16);
  k.add(pe2, T.flag, 0, B + 0.76, PZ + 0.02, Math.PI / 2);
  k.door(0, B, S / 2 + 0.012, 0, { w: 0.24, h: 0.4, arched: true, hex: 0x8a6a2a, frame: C.marble2 });
  for (let i = 0; i < 3; i++) k.box(1.2 - i * 0.08, 0.06, 0.12, i % 2 ? C.marble2 : C.marble, 0, 0.14 + i * 0.02 - 0.12, PZ + 0.46 - i * 0.08);
  // obelisks
  for (const x of [-1.2, 1.2]) {
    k.box(0.16, 0.12, 0.16, C.stoneLight, x, 0.2, 1.2);
    k.add(new THREE.CylinderGeometry(0.03, 0.055, 0.7, 4).rotateY(Math.PI / 4), C.sandstone, x, 0.67, 1.2);
    k.cone(0.03 * Math.SQRT2, 0.07, C.gold, x, 1.02, 1.2, 4, Math.PI / 4);
  }
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 0.0], [1.25, 0.0]]) tree(k, x, 0.2, z, 1.2);
  return k;
}

export const BUILDERS = { hut, farmstead, cottage, manor, townhouses, keep, shrine, windmill, temple, towncentre: townCentre, cathedral };
