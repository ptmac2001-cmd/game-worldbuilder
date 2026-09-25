// Settlements: homes that grow with the flat land around them, ages of
// civilisation, landmarks (shrine → cathedral), construction, farmland,
// pastures and streets, and the AI gods that shape land for their tribes.
import * as THREE from 'three';
import { N, V, ERAS, CIVICS, TRIBES } from '../config.js';
import { ctx, U } from '../ctx.js';
import { rnd, hash2 } from '../rng.js';
import * as T from '../sim/terrain.js';
import { Kit, merge, part } from '../view/geometry.js';
import { BUILDERS, sailsGeo } from '../view/architecture.js';
import { heightAt, setLand, commitLand, LAND } from '../view/terrainView.js';
import { rocky, clearRocks } from '../view/vegetation.js';
import { FX, emit, flame, dustBurst, debrisBurst } from '../view/particles.js';

export const buildings = new Set();
export const tileOwner = new Map();     // tile index -> building
export const land = new Uint8Array(N * N);
export const tribes = {};
for (const id of Object.keys(TRIBES)) tribes[id] = { id, era: 0, score: 0, mode: 'settle', flag: null, leader: null, ai: true, aiT: rnd(), planT: rnd() * 2, plan: null, nextCivic: null };

const HOME_TYPES = [['hut', 'hut', 'farmstead'], ['hut', 'cottage', 'manor'], ['cottage', 'townhouses', 'manor'], ['cottage', 'townhouses', 'keep']];
const CAPACITY = { hut: 1, farmstead: 2, cottage: 2, manor: 3, townhouses: 3, keep: 4 };
export { CAPACITY };
export const LABELS = { hut: 'huts', farmstead: 'farmsteads', cottage: 'cottages', manor: 'manors', townhouses: 'townhouse rows', keep: 'keeps' };
const FARMING = { hut: 0.35, farmstead: 0.85, cottage: 0.45 };
const PASTURE_CHANCE = [0.55, 0.4, 0.12, 0];

// ---------------------------------------------------------------------------
// Materials: buildings get snow on roofs in winter.
// ---------------------------------------------------------------------------
function buildingMaterial(clip) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  if (clip) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  m.onBeforeCompile = sh => {
    sh.uniforms.uSnow = U.uSnow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 fnw = normalize(cross(dFdx(vWP), dFdy(vWP)));
        float roofSnow = uSnow * smoothstep(0.45, 0.8, abs(fnw.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.86, 0.92), roofSnow * 0.92);`);
  };
  m.customProgramCacheKey = () => 'building' + (clip ? '-clip' : '');
  return m;
}
const buildMat = buildingMaterial(null);
const plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

const geoCache = new Map();
function design(type, tribe, variant) {
  const key = `${type}-${tribe}-${variant}`;
  if (!geoCache.has(key)) geoCache.set(key, BUILDERS[type](tribe, variant).build((variant % 4) * Math.PI / 2));
  return geoCache.get(key);
}
let sailsGeometry = null;

function scaffold(bb) {
  const k = new Kit(), x0 = bb.min.x - 0.04, x1 = bb.max.x + 0.04, z0 = bb.min.z - 0.04, z1 = bb.max.z + 0.04, top = bb.max.y + 0.05;
  const nx = Math.max(2, Math.round((x1 - x0) / 0.3)), nz = Math.max(2, Math.round((z1 - z0) / 0.3));
  for (let i = 0; i <= nx; i++) for (const z of [z0, z1]) k.cyl(0.008, 0.008, top, 0x9a7a4a, x0 + i * (x1 - x0) / nx, 0, z, 4);
  for (let i = 1; i < nz; i++) for (const x of [x0, x1]) k.cyl(0.008, 0.008, top, 0x9a7a4a, x, 0, z0 + i * (z1 - z0) / nz, 4);
  for (let y = 0.25; y < top; y += 0.28) {
    k.box(x1 - x0, 0.012, 0.05, 0xb08a52, (x0 + x1) / 2, y, z0); k.box(x1 - x0, 0.012, 0.05, 0xb08a52, (x0 + x1) / 2, y, z1);
    k.box(0.05, 0.012, z1 - z0, 0xb08a52, x0, y, (z0 + z1) / 2); k.box(0.05, 0.012, z1 - z0, 0xb08a52, x1, y, (z0 + z1) / 2);
  }
  return new THREE.Mesh(k.build().geo, plainMat);
}

// ---------------------------------------------------------------------------
// Placement rules
// ---------------------------------------------------------------------------
export function spaceTier(tx, tz) {
  const hc = T.tileHeight(tx, tz);
  let n = 0;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (T.isFlatLand(tx + dx, tz + dz) && T.tileHeight(tx + dx, tz + dz) === hc) n++;
  return n >= 20 ? 2 : n >= 10 ? 1 : 0;
}
export function canBuildHome(tx, tz) {
  if (tx < 1 || tz < 1 || tx >= N - 1 || tz >= N - 1 || !T.isFlatLand(tx, tz)) return false;
  const ti = tz * N + tx;
  if (land[ti] !== LAND.WILD || rocky[ti]) return false;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (tileOwner.has((tz + dz) * N + tx + dx)) return false;
  return true;
}
function canPlaceBlock(x0, z0, size) {
  if (x0 < 1 || z0 < 1 || x0 + size > N - 1 || z0 + size > N - 1 || !T.isFlatBlock(x0, z0, size)) return false;
  for (let z = z0 - 1; z <= z0 + size; z++) for (let x = x0 - 1; x <= x0 + size; x++) {
    const ti = z * N + x, inside = x >= x0 && z >= z0 && x < x0 + size && z < z0 + size;
    if (tileOwner.has(ti) && (inside || size === 1)) return false;
    if (inside && rocky[ti]) return false;
  }
  return true;
}
const homeTypeFor = (tribe, tx, tz) => HOME_TYPES[tribes[tribe].era][spaceTier(tx, tz)];

// ---------------------------------------------------------------------------
// Creating and removing buildings
// ---------------------------------------------------------------------------
let nextId = 1;
function setMesh(b, instant) {
  if (b.group) ctx.scene.remove(b.group);
  const d = design(b.type, b.tribe, b.variant);
  b.design = d;
  b.group = new THREE.Group();
  b.group.position.set(b.cx, heightAt(b.cx, b.cz), b.cz);
  b.mesh = new THREE.Mesh(d.geo, buildMat);
  b.mesh.castShadow = b.mesh.receiveShadow = true;
  b.group.add(b.mesh);
  b.sails = d.extras.sails.map(s => {
    sailsGeometry ??= sailsGeo();
    const holder = new THREE.Group(), m = new THREE.Mesh(sailsGeometry, plainMat);
    holder.position.set(s.x, s.y, s.z); holder.rotation.y = s.ry; m.castShadow = true;
    holder.add(m); b.group.add(holder);
    return m;
  });
  if (instant) { b.progress = 1; }
  else {
    b.progress = 0;
    b.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    b.mesh.material = buildingMaterial(b.clip);
    b.sails.forEach(s => { s.visible = false; });
    b.scaffold = scaffold(d.geo.boundingBox);
    b.group.add(b.scaffold);
  }
  ctx.scene.add(b.group);
}

function makeBuilding(kind, type, tribe, x0, z0, size, instant) {
  const b = { id: nextId++, kind, type, tribe, tx: x0, tz: z0, size, tiles: [], variant: Math.floor(hash2(x0 * 3 + 1, z0 * 5 + 2) * 4) + (type === 'townhouses' ? 4 * Math.floor(hash2(x0, z0) * 5) : 0) };
  b.cx = x0 - N / 2 + size / 2; b.cz = z0 - N / 2 + size / 2;
  for (let z = z0; z < z0 + size; z++) for (let x = x0; x < x0 + size; x++) { const ti = z * N + x; b.tiles.push(ti); tileOwner.set(ti, b); clearRocks(x, z); }
  b.buildTime = kind === 'civic' ? 10 + size * 6 : 3.5;
  setMesh(b, instant);
  buildings.add(b);
  recomputeLand();
  return b;
}
export function placeHome(tx, tz, tribe, instant = false) { return makeBuilding('home', homeTypeFor(tribe, tx, tz), tribe, tx, tz, 1, instant); }
function placeCivic(type, x0, z0, tribe) {
  const b = makeBuilding('civic', type, tribe, x0, z0, CIVICS[type].size, false);
  ctx.log(`<b style="color:${TRIBES[tribe].css}">${TRIBES[tribe].name}</b> tribe began building a ${CIVICS[type].label}`);
  ctx.callWorkers?.(b, 4);
  return b;
}

export function destroyBuilding(b, cause = 'collapse') {
  if (!buildings.has(b)) return;
  buildings.delete(b);
  for (const ti of b.tiles) if (tileOwner.get(ti) === b) tileOwner.delete(ti);
  ctx.scene.remove(b.group);
  const y = b.group.position.y, s = b.size;
  dustBurst(b.cx, y, b.cz, 12 + s * 10);
  debrisBurst(b.cx, y, b.cz, 10 + s * 12, 0.8 + s * 0.2);
  if (cause === 'fire') for (let i = 0; i < 20; i++) emit(FX.ash, b.cx + (rnd() - 0.5) * s, y + 0.2, b.cz + (rnd() - 0.5) * s, 0, 0.5, 0, 2.5, 1.5, 0x3a3634);
  if (b.progress >= 1) ctx.spawnVillager?.(b.tribe, b.cx, b.cz, b.kind === 'home' ? CAPACITY[b.type] : 2);
  if (b.kind === 'civic') ctx.log(`${TRIBES[b.tribe].name} tribe's ${CIVICS[b.type].label} was destroyed`);
  recomputeLand();
}

// A building taken in battle changes hands (and colours).
export function captureBuilding(b, tribe) {
  b.tribe = tribe;
  if (b.kind === 'home') b.type = homeTypeFor(tribe, b.tx, b.tz);
  b.hp = null; b.militia = false;
  setMesh(b, true);
  dustBurst(b.cx, b.group.position.y, b.cz, 10 + b.size * 6);
  recomputeLand(true);
}

// After the land changes: remove buildings whose ground is no longer flat,
// and resize homes whose surroundings changed.
export function validateBuildings() {
  for (const b of [...buildings]) {
    const ok = b.kind === 'home' ? T.isFlatLand(b.tx, b.tz) : T.isFlatBlock(b.tx, b.tz, b.size);
    if (!ok) { destroyBuilding(b); continue; }
    if (b.kind === 'home' && b.progress >= 1) {
      const t = homeTypeFor(b.tribe, b.tx, b.tz);
      if (t !== b.type) { b.type = t; setMesh(b, false); b.buildTime = 3; }
    }
  }
  recomputeLand();
}
export function updateBuildingHeights() { for (const b of buildings) b.group.position.y = heightAt(b.cx, b.cz); }

// ---------------------------------------------------------------------------
// Land use: fields and pastures around farms, cobbled streets in towns.
// ---------------------------------------------------------------------------
let fenceMesh = null, hayMesh = null;
const hayMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
hayMat.onBeforeCompile = sh => {
  sh.uniforms.uSeason = U.uSeason;
  sh.vertexShader = 'uniform vec4 uSeason;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= clamp(uSeason.z * 1.2 + uSeason.w * 0.3, 0.0, 1.0);');
};
const prevLand = new Uint8Array(N * N);
export function recomputeLand(force = false) {
  prevLand.set(land);
  land.fill(LAND.WILD);
  for (const b of buildings) {
    const era = tribes[b.tribe].era, hc = T.tileHeight(b.tx, b.tz);
    const ring = (fn, pad = 1) => {
      for (let z = b.tz - pad; z < b.tz + b.size + pad; z++) for (let x = b.tx - pad; x < b.tx + b.size + pad; x++) {
        const ti = z * N + x;
        if (!T.inGrid(x, z) || tileOwner.has(ti) || !T.isFlatLand(x, z) || T.tileHeight(x, z) !== hc || rocky[ti]) continue;
        fn(ti, x, z);
      }
    };
    if (b.kind === 'home' && FARMING[b.type] && !(b.type === 'cottage' && era >= 3)) {
      ring((ti, x, z) => { if (land[ti] === LAND.WILD && hash2(x * 7 + 3, z * 13 + 1) < FARMING[b.type]) land[ti] = hash2(x + 91, z + 17) < PASTURE_CHANCE[era] ? LAND.PASTURE : LAND.FIELD; });
    } else if (b.kind === 'home' && (b.type === 'townhouses' || b.type === 'keep' || (b.type === 'manor' && era >= 2))) {
      ring((ti, x, z) => { if (hash2(x * 5 + 1, z * 3 + 7) < 0.8) land[ti] = LAND.PAVED; });
    } else if (b.kind === 'civic' && b.size > 1) {
      if (b.type !== 'temple') for (const ti of b.tiles) land[ti] = LAND.PAVED;
      ring(ti => { land[ti] = LAND.PAVED; });
    }
  }
  for (let ti = 0; ti < N * N; ti++) if (tileOwner.get(ti)?.type === 'towncentre' || tileOwner.get(ti)?.type === 'cathedral') land[ti] = LAND.PAVED;
  let same = !force;
  for (let ti = 0; same && ti < N * N; ti++) if (land[ti] !== prevLand[ti]) same = false;
  if (same) { ctx.refreshVegetation?.(); return; }
  for (let ti = 0; ti < N * N; ti++) {
    const x = ti % N, z = (ti / N) | 0;
    setLand(ti, land[ti], Math.floor(hash2(x + 11, z + 5) * 255), hash2(x + 3, z + 17) > 0.5);
  }
  commitLand();
  rebuildFences();
  ctx.onLandChanged?.();
}

function rebuildFences() {
  if (fenceMesh) { ctx.scene.remove(fenceMesh); fenceMesh.geometry.dispose(); }
  if (hayMesh) { ctx.scene.remove(hayMesh); hayMesh.geometry.dispose(); }
  const k = new Kit(), hay = new Kit();
  const isP = (x, z) => T.inGrid(x, z) && land[z * N + x] === LAND.PASTURE;
  for (let ti = 0; ti < N * N; ti++) {
    const x = ti % N, z = (ti / N) | 0, [cx, cz] = T.tileCenter(x, z);
    if (land[ti] === LAND.FIELD) {
      const n = 1 + Math.floor(hash2(x * 3, z * 9) * 2);
      for (let i = 0; i < n; i++) {
        const hx = cx + (hash2(x + i, z) - 0.5) * 0.6, hz = cz + (hash2(x, z + i) - 0.5) * 0.6, y = heightAt(hx, hz);
        hay.cyl(0.07, 0.08, 0.08, 0xd8b85a, hx, y, hz, 10); hay.dome(0.07, 0xe0c46a, hx, y + 0.08, hz, 10, 1.1);
      }
    }
    if (land[ti] !== LAND.PASTURE) continue;
    const y = heightAt(cx, cz);
    for (const [dx, dz, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) {
      if (isP(x + dx, z + dz)) continue;
      const ex = cx + dx * 0.47, ez = cz + dz * 0.47;
      for (const t of [-0.47, 0, 0.47]) { const px = ex + (dz ? t : 0), pz = ez + (dx ? t : 0); k.box(0.025, 0.14, 0.025, 0x7a5a3a, px, y - 0.02, pz); }
      for (const hy of [0.05, 0.1]) k.box(0.96, 0.014, 0.012, 0x9a7a52, ex, y + hy, ez, ry);
    }
    // water trough
    if (hash2(x, z * 3) < 0.4) { k.box(0.16, 0.05, 0.07, 0x6b4428, cx + 0.3, y, cz - 0.3); k.box(0.13, 0.005, 0.045, 0x4a8ab0, cx + 0.3, y + 0.046, cz - 0.3); }
  }
  if (k.parts.length) { fenceMesh = new THREE.Mesh(k.build().geo, plainMat); fenceMesh.castShadow = fenceMesh.receiveShadow = true; ctx.scene.add(fenceMesh); } else fenceMesh = null;
  if (hay.parts.length) { hayMesh = new THREE.Mesh(hay.build().geo, hayMat); hayMesh.castShadow = true; ctx.scene.add(hayMesh); } else hayMesh = null;
}

// ---------------------------------------------------------------------------
// Ages, landmarks and the AI gods
// ---------------------------------------------------------------------------
export const homesOf = tribe => [...buildings].filter(b => b.tribe === tribe && b.kind === 'home');
export const civicsOf = tribe => [...buildings].filter(b => b.tribe === tribe && b.kind === 'civic');
function centroid(tribe) {
  const hs = [...buildings].filter(b => b.tribe === tribe);
  if (!hs.length) return null;
  return [hs.reduce((s, b) => s + b.tx + b.size / 2, 0) / hs.length, hs.reduce((s, b) => s + b.tz + b.size / 2, 0) / hs.length];
}
function wantedCivic(tr) {
  const have = civicsOf(tr.id);
  for (const [type, c] of Object.entries(CIVICS)) {
    if (c.era > tr.era) continue;
    const count = have.filter(b => b.type === type).length;
    const allowed = type === 'windmill' ? Math.min(3, 1 + Math.floor(homesOf(tr.id).length / 10)) : 1;
    if (count < allowed) return type;
  }
  return null;
}

function updateEras() {
  for (const tr of Object.values(tribes)) {
    tr.score = homesOf(tr.id).filter(b => b.progress >= 1).reduce((s, b) => s + CAPACITY[b.type], 0);
    let era = tr.era;
    while (era + 1 < ERAS.length && tr.score >= ERAS[era + 1].score) era++;
    if (era > tr.era) {
      tr.era = era;
      ctx.log(`<b style="color:${TRIBES[tr.id].css}">${TRIBES[tr.id].name}</b> tribe entered the <b>${ERAS[era].name} Age</b>`);
      ctx.onEraChanged?.(tr.id);
      let delay = 0;
      for (const b of homesOf(tr.id)) { b.retypeAt = ctx.time + (delay += 0.4 + rnd() * 0.6); }
    }
  }
}

function planCivic(tr) {
  const type = wantedCivic(tr);
  tr.nextCivic = type;
  if (!type) { tr.plan = null; return; }
  const size = CIVICS[type].size, c = centroid(tr.id);
  if (!c) return;
  let best = null, bestPlan = null;
  for (let z0 = Math.max(1, Math.floor(c[1] - 12)); z0 < Math.min(N - size - 1, c[1] + 12); z0++) for (let x0 = Math.max(1, Math.floor(c[0] - 12)); x0 < Math.min(N - size - 1, c[0] + 12); x0++) {
    const d = Math.hypot(x0 + size / 2 - c[0], z0 + size / 2 - c[1]);
    if (canPlaceBlock(x0, z0, size)) { if (!best || d < best.d) best = { x0, z0, d }; continue; }
    // Otherwise score how much work it would be to flatten this block.
    let blocked = false, sum = 0, cnt = 0;
    for (let z = z0 - 1; z <= z0 + size && !blocked; z++) for (let x = x0 - 1; x <= x0 + size; x++) if (tileOwner.has(z * N + x)) { blocked = true; break; }
    if (blocked) continue;
    for (let z = z0; z <= z0 + size; z++) for (let x = x0; x <= x0 + size; x++) { sum += T.heightAtVertex(x, z); cnt++; }
    const target = Math.max(1, Math.round(sum / cnt));
    let cost = 0;
    for (let z = z0; z <= z0 + size; z++) for (let x = x0; x <= x0 + size; x++) cost += Math.abs(T.heightAtVertex(x, z) - target);
    const score = cost + d * 0.8;
    if (!bestPlan || score < bestPlan.score) bestPlan = { x0, z0, size, target, score, type };
  }
  if (best) { placeCivic(type, best.x0, best.z0, tr.id); tr.plan = null; }
  else tr.plan = bestPlan;
}

// One small step of divine landscaping, undone if it would wreck the tribe's own buildings.
function aiShape(tr) {
  let vx, vz, target;
  if (tr.plan && rnd() < 0.65) {
    const p = tr.plan;
    const cands = [];
    for (let z = p.z0; z <= p.z0 + p.size; z++) for (let x = p.x0; x <= p.x0 + p.size; x++) if (T.heightAtVertex(x, z) !== p.target) cands.push([x, z]);
    if (!cands.length) return;
    [vx, vz] = cands[Math.floor(rnd() * cands.length)]; target = p.target;
  } else {
    const hs = homesOf(tr.id);
    if (!hs.length) return;
    const b = hs[Math.floor(rnd() * hs.length)];
    vx = b.tx + Math.floor(rnd() * 6) - 2; vz = b.tz + Math.floor(rnd() * 6) - 2;
    if (vx < 1 || vz < 1 || vx >= N || vz >= N) return;
    target = T.tileHeight(b.tx, b.tz);
  }
  const hv = T.heightAtVertex(vx, vz);
  if (hv === target) return;
  const before = T.snapshot();
  T.edit(vx, vz, hv < target ? 1 : -1);
  const own = [...buildings].filter(b => b.tribe === tr.id || b.kind === 'civic');
  const broken = own.some(b => b.kind === 'home' ? !T.isFlatLand(b.tx, b.tz) : !T.isFlatBlock(b.tx, b.tz, b.size));
  if (broken) { T.restore(before); return; }
  ctx.onTerrainEdited?.([[vx, vz]]);
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------
let smokeT = 0;
export function updateSettlements(dt) {
  for (const tr of Object.values(tribes)) {
    // A steady trickle of new walkers leaves the tribe's homes.
    const homes = homesOf(tr.id).filter(b => b.progress >= 1);
    const muster = tr.mode !== 'settle';
    tr.spawnT = (tr.spawnT ?? 0) + dt * (1 + homes.length / 40) * (muster ? 4 : 1);
    if (tr.spawnT > 30 && homes.length) { tr.spawnT = 0; ctx.homeSpawn?.(homes[Math.floor(rnd() * homes.length)], muster); }
    tr.planT -= dt;
    if (tr.planT <= 0) { tr.planT = 2 + rnd(); planCivic(tr); }
    if (tr.ai) { tr.aiT -= dt; if (tr.aiT <= 0) { tr.aiT = 1.4 + rnd() * 1.0; aiShape(tr); } }
  }
  updateEras();
  smokeT += dt;
  const puff = smokeT > 0.1;
  if (puff) smokeT = 0;
  const winter = U.uSnow.value;
  for (const b of buildings) {
    if (b.retypeAt && ctx.time >= b.retypeAt) {
      b.retypeAt = 0;
      const t = homeTypeFor(b.tribe, b.tx, b.tz);
      if (t !== b.type) { b.type = t; setMesh(b, false); dustBurst(b.cx, b.group.position.y, b.cz, 8); }
    }
    if (b.progress < 1) {
      b.progress = Math.min(1, b.progress + dt / b.buildTime);
      const hgt = b.design.height + 0.05;
      b.clip.constant = b.group.position.y - 0.3 + (hgt + 0.3) * b.progress;
      if (Math.random() < dt * 1.2) emit(FX.dust, b.cx + (rnd() - 0.5) * b.size * 0.8, b.group.position.y + 0.05, b.cz + (rnd() - 0.5) * b.size * 0.8, 0, 0.2, 0, 0.8, 0.7, 0xb59f7c);
      if (b.progress >= 1) {
        b.mesh.material.dispose();
        b.mesh.material = buildMat;
        b.group.remove(b.scaffold); b.scaffold = null;
        b.sails.forEach(s => { s.visible = true; });
        if (b.kind === 'civic') ctx.log(`<b style="color:${TRIBES[b.tribe].css}">${TRIBES[b.tribe].name}</b> tribe completed a <b>${CIVICS[b.type].label}</b>`);
      }
      continue;
    }
    const gy = b.group.position.y, ex = b.design.extras;
    for (const s of b.sails) s.rotation.z -= dt * (1.2 + U.uStorm.value * 5);
    if (puff) for (const c of ex.chimneys) if (Math.random() < 0.3 + winter * 0.4) emit(FX.smoke, b.cx + c.x, gy + c.y, b.cz + c.z, 0.08 + Math.random() * 0.05, 0.3 + Math.random() * 0.1, (Math.random() - 0.5) * 0.05, 3 + Math.random() * 1.5, 0.5 + Math.random() * 0.4, 0xe9e9ec);
    for (const f of ex.fires) if (Math.random() < 0.6) flame(b.cx + f.x, gy + f.y, b.cz + f.z, f.s);
    if (U.uSnow.value < 0.5) for (const s of ex.sprays) for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.2; emit(FX.spray, b.cx + s.x, gy + s.y, b.cz + s.z, Math.cos(a) * r, 0.7 + Math.random() * 0.3, Math.sin(a) * r, 0.7, 1, 0xcfe8f5); }
  }
}

// Start two tribes on opposite sides of the island.
export function foundTribes() {
  const nearest = (fx, fz) => {
    let best = null, bd = Infinity;
    for (let tz = 1; tz < N - 1; tz++) for (let tx = 1; tx < N - 1; tx++) {
      if (!canBuildHome(tx, tz)) continue;
      const d = Math.hypot(tx - fx, tz - fz) - spaceTier(tx, tz) * 1.5;
      if (d < bd) { bd = d; best = [tx, tz]; }
    }
    return best;
  };
  for (const [tribe, fx] of [['blue', N * 0.3], ['red', N * 0.7]]) {
    for (let i = 0; i < 4; i++) {
      const s = nearest(fx, N * 0.5);
      if (!s) break;
      const b = placeHome(s[0], s[1], tribe, true);
      ctx.spawnVillager?.(tribe, b.cx, b.cz + 0.6, 1);
    }
  }
}
