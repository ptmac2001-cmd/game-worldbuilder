// Instanced vegetation and rocks that sway in the wind and follow the seasons:
// blossom in spring, gold and red in autumn, bare branches and snow in winter.
import * as THREE from 'three';
import { N, SEA } from '../config.js';
import { U } from '../ctx.js';
import { rnd, pick, fbm, hash2 } from '../rng.js';
import { corners, tileCenter } from '../sim/terrain.js';
import { part, merge, blob } from './geometry.js';
import { heightAt } from './terrainView.js';

const KIND = { deciduous: 1, evergreen: 2, grass: 3, flower: 4, rock: 5, bush: 6, reed: 7 };

function seasonal(mat, kind, amt = 0, leafY = 0.45) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uWind: U.uTime, uSeason: U.uSeason, uSnow: U.uSnow, uStorm: U.uStorm });
    sh.vertexShader = `attribute float leaf; uniform float uWind, uSnow, uStorm; uniform vec4 uSeason;\n` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ih = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        float ph = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.6;
        float gust = 1.0 + uStorm * 4.0;
        float sw = sin(uWind * (1.8 + uStorm * 3.0) + ph) + 0.4 * sin(uWind * 3.7 + ph * 1.7);
        #if ${KIND[kind]} == 1
          float bare = uSeason.w;
          if (leaf > 0.5) transformed = mix(transformed, vec3(0.0, ${leafY.toFixed(3)}, 0.0), bare);
        #endif
        #if ${KIND[kind]} == 3
          transformed *= 1.0 - uSeason.w * 0.8;
        #endif
        #if ${KIND[kind]} == 4
          transformed *= clamp(uSeason.x * 1.1 + uSeason.y * 0.8 + uSeason.z * 0.1, 0.0, 1.0);
        #endif
        transformed.x += sw * ${amt.toFixed(3)} * gust * position.y;
        transformed.z += cos(uWind * 1.3 + ph) * ${amt.toFixed(3)} * 0.5 * gust * position.y;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          float ihc = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
          #if ${KIND[kind]} == 1 || ${KIND[kind]} == 6
            if (leaf > 0.5 || ${KIND[kind]} == 6) {
              vec3 autumnC = ihc < 0.3 ? vec3(0.62, 0.10, 0.05) : (ihc < 0.65 ? vec3(0.85, 0.32, 0.05) : vec3(0.88, 0.62, 0.08));
              vec3 blossom = ihc > 0.78 ? vec3(1.0, 0.72, 0.82) : vColor.rgb * vec3(1.05, 1.15, 0.85);
              vColor.rgb = mix(vColor.rgb, blossom, uSeason.x * (ihc > 0.78 ? 0.85 : 1.0));
              vColor.rgb = mix(vColor.rgb, autumnC, uSeason.z * 0.9);
            }
          #endif
          #if ${KIND[kind]} == 3 || ${KIND[kind]} == 7
            vColor.rgb = mix(vColor.rgb, vColor.rgb * vec3(1.3, 1.02, 0.6), uSeason.z * 0.6);
          #endif
          vColor.rgb = mix(vColor.rgb, vec3(0.86, 0.9, 0.95), uSnow * smoothstep(0.25, 0.75, normal.y) * ${kind === 'grass' || kind === 'flower' ? '0.0' : '0.95'});
        }`);
  };
  mat.customProgramCacheKey = () => 'veg-' + kind + amt;
  return mat;
}

function oakGeo() {
  const brown = 0x6b4a2e;
  const P = [part(new THREE.CylinderGeometry(0.035, 0.06, 0.36, 6), brown, 0, 0.18, 0)];
  for (const [x, y, z, rz, rx] of [[0.07, 0.36, 0, -0.8, 0], [-0.07, 0.38, 0.02, 0.9, 0.2], [0.0, 0.4, -0.07, 0, -0.9], [0.02, 0.44, 0.06, 0.2, 0.8]])
    P.push(part(new THREE.CylinderGeometry(0.01, 0.022, 0.2, 5), brown, x, y, z, 0, rx, rz));
  const greens = [0x4f8a3a, 0x5a9640, 0x467f35, 0x62a046, 0x3f7530];
  [[0, 0.48, 0, 0.21], [0.13, 0.42, 0.06, 0.16], [-0.12, 0.44, -0.06, 0.16], [0.03, 0.62, -0.04, 0.15], [-0.05, 0.4, 0.12, 0.13]]
    .forEach(([x, y, z, r], i) => P.push(part(blob(r, i === 0 ? 1 : 0, 0.2), greens[i], x, y, z, 0, 0, 0, { leaf: 1 })));
  return merge(P);
}
function birchGeo() {
  const P = [part(new THREE.CylinderGeometry(0.022, 0.032, 0.55, 6), 0xe8e4dc, 0, 0.27, 0)];
  for (const y of [0.12, 0.25, 0.38]) P.push(part(new THREE.CylinderGeometry(0.033, 0.033, 0.015, 6), 0x2a2a2a, 0, y, 0));
  [[0, 0.62, 0, 0.13], [0.06, 0.52, 0.03, 0.1], [-0.05, 0.5, -0.04, 0.1], [0, 0.76, 0, 0.08]]
    .forEach(([x, y, z, r], i) => P.push(part(blob(r, i === 0 ? 1 : 0, 0.25), [0x7aae44, 0x86b84c, 0x6fa03e, 0x90c050][i], x, y, z, 0, 0, 0, { leaf: 1 })));
  return merge(P);
}
function pineGeo() {
  const P = [part(new THREE.CylinderGeometry(0.03, 0.045, 0.3, 6), 0x5a3d26, 0, 0.15, 0)];
  for (const [r, hh, y, c] of [[0.27, 0.36, 0.34, 0x2e5a34], [0.22, 0.32, 0.52, 0x33663a], [0.16, 0.28, 0.68, 0x3a7240], [0.09, 0.2, 0.82, 0x417c46]]) {
    const g = new THREE.ConeGeometry(r, hh, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const k = 1 + (hash2(Math.round(p.getX(i) * 999), Math.round(p.getZ(i) * 997)) - 0.5) * 0.3; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) - 0.02); }
    g.computeVertexNormals();
    P.push(part(g, c, 0, y, 0, 0, 0, 0, { leaf: 1 }));
  }
  return merge(P);
}
const bushGeo = () => merge([part(blob(0.11, 1, 0.2), 0x4a8a3c, 0, 0.07, 0), part(blob(0.08, 1, 0.2), 0x55963f, 0.08, 0.06, 0.03), part(blob(0.08, 1, 0.2), 0x437d35, -0.06, 0.05, -0.04)]);
function rockGeo() {
  const g = new THREE.DodecahedronGeometry(0.13, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (hash2(Math.round(p.getX(i) * 997), Math.round(p.getY(i) * 991 + p.getZ(i) * 983)) - 0.5) * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  g.computeVertexNormals();
  return merge([part(g, 0x9a958c, 0, 0.03, 0)]);
}
function bladeGeo(n, base, tip, hmin, hvar, spread, w) {
  const pos = [], col = [], nor = [], b = new THREE.Color(base), t = new THREE.Color(tip);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * spread, hh = hmin + rnd() * hvar, lean = 0.02 + rnd() * 0.035;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, hh, bz + Math.sin(a) * lean);
    col.push(b.r, b.g, b.b, b.r, b.g, b.b, t.r, t.g, t.b);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
const flowerGeo = () => merge([
  part(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 3), 0x4f8a3a, 0, 0.03, 0), part(new THREE.IcosahedronGeometry(0.02, 0), 0xffffff, 0, 0.065, 0, 0, 0, 0, { jitter: 0 }),
  part(new THREE.CylinderGeometry(0.004, 0.004, 0.045, 3), 0x4f8a3a, 0.03, 0.022, 0.02), part(new THREE.IcosahedronGeometry(0.017, 0), 0xffffff, 0.03, 0.05, 0.02, 0, 0, 0, { jitter: 0 })]);

const layers = [];
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
function layer(scene, geo, mat, items, cast, capacity = items.length) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, capacity));
  m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
  items.forEach((it, i) => m.setColorAt(i, it.color));
  if (!m.instanceColor) m.setColorAt(0, new THREE.Color(1, 1, 1));
  m.instanceColor.needsUpdate = true;
  scene.add(m);
  const L = { mesh: m, items };
  layers.push(L);
  return L;
}

// Volcanic boulders block building until the land under them is reshaped.
export const rocky = new Uint8Array(N * N);
let boulders;
const tint = (r, g, b) => new THREE.Color(r, g, b);

export function initVegetation(scene) {
  const oaks = [], birches = [], pines = [], bushes = [], rocks = [], tufts = [], flowers = [], reeds = [];
  const FLOWER_COLS = [0xffffff, 0xffe066, 0xff8fb3, 0xb58cff, 0xff6b5a, 0x8fd0ff];
  for (let tz = 1; tz < N - 1; tz++) for (let tx = 1; tx < N - 1; tx++) {
    const [cx, cz] = tileCenter(tx, tz), cs = corners(tx, tz), avg = cs.reduce((s, v) => s + v, 0) / 4;
    const item = (s, extra = {}) => ({ x: cx + (rnd() - 0.5) * 0.9, z: cz + (rnd() - 0.5) * 0.9, tx, tz, s, r: rnd() * Math.PI * 2, yOff: -0.02, maxY: 99, minY: 0.14, ...extra });
    const forest = fbm(tx * 0.11 + 50, tz * 0.11 - 20, 3);
    const nt = forest > 0.62 ? 3 : forest > 0.53 ? 2 : (rnd() < 0.06 ? 1 : 0);
    for (let k = 0; k < nt; k++) {
      const k2 = 0.85 + rnd() * 0.25;
      if (avg >= 4.5 || rnd() < 0.28) pines.push(item(0.8 + rnd() * 0.7, { maxY: 4.5, color: tint(k2, k2 + rnd() * 0.1, k2) }));
      else if (rnd() < 0.25) birches.push(item(0.8 + rnd() * 0.5, { maxY: 3.8, color: tint(k2, k2, k2) }));
      else oaks.push(item(0.8 + rnd() * 0.6, { maxY: 3.8, color: tint(k2 + rnd() * 0.12, k2, k2 * 0.9) }));
    }
    if (rnd() < 0.22) bushes.push(item(0.8 + rnd() * 0.6, { maxY: 3.8, color: tint(0.9 + rnd() * 0.2, 1, 0.9) }));
    const nr = avg >= 5.5 ? (rnd() < 0.6 ? 2 : 1) : (rnd() < 0.03 ? 1 : 0);
    for (let k = 0; k < nr; k++) { const g = 0.8 + rnd() * 0.35; rocks.push(item(0.5 + rnd() * 1.2, { minY: 0.02, color: tint(g, g, g * 0.97) })); }
    for (let k = 0; k < 6; k++) tufts.push(item(0.55 + rnd() * 0.45, { maxY: 3.6, yOff: -0.01, color: tint(0.92 + rnd() * 0.2, 0.92 + rnd() * 0.2, 0.85 + rnd() * 0.15) }));
    if (rnd() < 0.45) for (let k = 0; k < 2; k++) flowers.push(item(0.8 + rnd() * 0.5, { maxY: 3.2, yOff: -0.005, color: new THREE.Color(pick(FLOWER_COLS)) }));
    if (Math.min(...cs) === 0 && Math.max(...cs) >= 1) for (let k = 0; k < 4; k++) reeds.push(item(0.7 + rnd() * 0.6, { minY: -0.12, maxY: 0.45, yOff: -0.02, color: tint(0.9 + rnd() * 0.2, 1, 0.9) }));
  }
  const std = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  layer(scene, oakGeo(), seasonal(std(), 'deciduous', 0.03, 0.4), oaks, true);
  layer(scene, birchGeo(), seasonal(std(), 'deciduous', 0.04, 0.5), birches, true);
  layer(scene, pineGeo(), seasonal(std(), 'evergreen', 0.025), pines, true);
  layer(scene, bushGeo(), seasonal(std(), 'bush', 0.05), bushes, true);
  layer(scene, rockGeo(), seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), 'rock'), rocks, true);
  layer(scene, bladeGeo(8, 0x5f973a, 0xc2dc78, 0.07, 0.08, 0.07, 0.013), seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 'grass', 0.35), tufts, false);
  layer(scene, flowerGeo(), seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'flower', 0.3), flowers, false);
  layer(scene, bladeGeo(7, 0x4a6a2a, 0x9ab060, 0.18, 0.14, 0.05, 0.01), seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 'reed', 0.25), reeds, false);
  const bg = new THREE.DodecahedronGeometry(0.14, 0);
  boulders = layer(scene, merge([part(bg, 0x4a4442, 0, 0.06, 0)]), seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), 'rock'), [], true, 400);
}

export function addBoulder(x, z) {
  const tx = Math.floor(x + N / 2), tz = Math.floor(z + N / 2);
  if (tx < 0 || tz < 0 || tx >= N || tz >= N || boulders.items.length >= 400) return;
  const g = 0.7 + rnd() * 0.4;
  const it = { x, z, tx, tz, s: 0.55 + rnd() * 0.75, r: rnd() * 6, yOff: 0, maxY: 99, minY: -0.1, rock: true };
  boulders.mesh.setColorAt(boulders.items.length, tint(g, g * 0.95, g * 0.9));
  boulders.mesh.instanceColor.needsUpdate = true;
  boulders.items.push(it);
  rocky[tz * N + tx] = 1;
}
export function clearRocks(tx, tz) {
  if (!rocky[tz * N + tx]) return;
  rocky[tz * N + tx] = 0;
  for (const it of boulders.items) if (it.tx === tx && it.tz === tz) it.dead = true;
}

// Kill plants within a radius (tornado, lava).
export function destroyPlants(x, z, radius) {
  let n = 0;
  for (const { items } of layers) for (const it of items) if (!it.dead && !it.rock && Math.hypot(it.x - x, it.z - z) < radius) { it.dead = true; n++; }
  return n;
}

export function refreshVegetation(blocked) {
  for (const { mesh, items } of layers) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i], y = heightAt(it.x, it.z);
      const ok = !it.dead && y > SEA + it.minY && y < it.maxY && (it.rock || !blocked(it.tz * N + it.tx));
      const sc = ok ? it.s : 0.0001;
      mesh.setMatrixAt(i, _m.compose(_p.set(it.x, y + it.yOff, it.z), _q.setFromAxisAngle(_up, it.r), _s.set(sc, sc, sc)));
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
