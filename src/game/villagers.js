// Villagers: articulated little people who wander, build homes, help raise
// landmarks, and drown if the sea takes their land.
import * as THREE from 'three';
import { N, SEA, TRIBES } from '../config.js';
import { ctx } from '../ctx.js';
import { rnd, pick } from '../rng.js';
import { tileCenter } from '../sim/terrain.js';
import { heightAt } from '../view/terrainView.js';
import { C } from '../view/architecture.js';
import { canBuildHome, placeHome, homesOf, civicsOf } from './settlements.js';

const matCache = new Map();
const mat = hex => { if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })); return matCache.get(hex); };
const VG = {
  leg: new THREE.BoxGeometry(0.036, 0.12, 0.04).translate(0, -0.06, 0),
  torso: new THREE.BoxGeometry(0.11, 0.13, 0.066),
  belt: new THREE.BoxGeometry(0.114, 0.018, 0.07),
  arm: new THREE.BoxGeometry(0.03, 0.11, 0.032).translate(0, -0.05, 0),
  head: new THREE.SphereGeometry(0.045, 12, 10),
  hair: new THREE.SphereGeometry(0.048, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  brim: new THREE.CylinderGeometry(0.075, 0.075, 0.008, 14),
  crown: new THREE.CylinderGeometry(0.035, 0.045, 0.045, 10),
  hood: new THREE.ConeGeometry(0.05, 0.08, 10),
  tool: new THREE.BoxGeometry(0.012, 0.12, 0.012).translate(0, -0.08, 0.03),
  basket: new THREE.CylinderGeometry(0.035, 0.028, 0.04, 8),
};
const SKIN = [0xf1c9a0, 0xe0b088, 0xc68e62, 0x8a5a3b], HAIR = [0x3b2a1a, 0x6b4a2a, 0xd8b060, 0x222222, 0x8a3a1a];
export const villagers = [];

function mesh(geo, hex, x, y, z, cast = false) { const m = new THREE.Mesh(geo, mat(hex)); m.position.set(x, y, z); m.castShadow = cast; return m; }
export function spawnVillager(tribe, px, pz, home = null) {
  const T = TRIBES[tribe], g = new THREE.Group(), shirt = pick(T.shirts), skin = pick(SKIN), trousers = pick([0x4a3b2a, 0x3b3f4a, 0x5a4a38]);
  const legL = mesh(VG.leg, trousers, -0.026, 0.12, 0), legR = mesh(VG.leg, trousers, 0.026, 0.12, 0);
  const torso = mesh(VG.torso, shirt, 0, 0.185, 0, true), belt = mesh(VG.belt, 0x3a2a1a, 0, 0.13, 0);
  const armL = mesh(VG.arm, shirt, -0.07, 0.24, 0), armR = mesh(VG.arm, shirt, 0.07, 0.24, 0);
  armR.add(mesh(VG.tool, C.wood, 0, 0, 0));
  if (rnd() < 0.25) armL.add(mesh(VG.basket, 0xb08a52, 0, -0.1, 0.02));
  const head = mesh(VG.head, skin, 0, 0.3, 0, true);
  g.add(legL, legR, torso, belt, armL, armR, head);
  const r = rnd();
  if (r < 0.3) g.add(mesh(VG.brim, 0xd8bf7a, 0, 0.33, 0), mesh(VG.crown, 0xd8bf7a, 0, 0.355, 0));
  else if (r < 0.45) g.add(mesh(VG.hood, shirt, 0, 0.35, -0.005));
  else g.add(mesh(VG.hair, pick(HAIR), 0, 0.305, -0.004));
  g.scale.setScalar(0.9);
  g.position.set(px, heightAt(px, pz), pz);
  g.userData = { tribe, home, legL, legR, armL, armR, state: 'idle', timer: rnd() * 1.5, phase: rnd() * 6, speed: (home ? 0.35 : 0.55) + rnd() * 0.25, target: null, build: null };
  ctx.scene.add(g);
  villagers.push(g);
  return g;
}
export function spawnMany(tribe, x, z, n = 1) { for (let i = 0; i < n; i++) spawnVillager(tribe, x + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5); }
export function removeVillager(v) { const i = villagers.indexOf(v); if (i >= 0) villagers.splice(i, 1); ctx.scene.remove(v); }
export const population = tribe => villagers.filter(v => v.userData.tribe === tribe && !v.userData.home).length;
export const townsfolk = tribe => villagers.filter(v => v.userData.tribe === tribe && v.userData.home).length;

function clearPath(x0, z0, x1, z1) {
  for (let k = 1; k <= 8; k++) { const t = k / 8; if (heightAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) < SEA + 0.05) return false; }
  return true;
}
function retarget(v) {
  const u = v.userData, x0 = v.position.x, z0 = v.position.z;
  if (u.home) { // townsfolk stroll around their neighbourhood and visit landmarks
    if (!u.home.group.parent) { removeVillager(v); return; }
    const civ = civicsOf(u.tribe).filter(c => c.progress >= 1 && Math.hypot(c.cx - x0, c.cz - z0) < 9);
    if (civ.length && rnd() < 0.25) {
      const c = pick(civ), a = rnd() * Math.PI * 2, r = c.size * 0.5 + 0.25, x = c.cx + Math.cos(a) * r, z = c.cz + Math.sin(a) * r;
      if (heightAt(x, z) > SEA + 0.1 && clearPath(x0, z0, x, z)) { u.target = new THREE.Vector2(x, z); u.state = 'walk'; return; }
    }
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, r = 0.6 + rnd() * 2.6, x = u.home.cx + Math.cos(a) * r, z = u.home.cz + Math.sin(a) * r;
      if (heightAt(x, z) > SEA + 0.1 && clearPath(x0, z0, x, z)) { u.target = new THREE.Vector2(x, z); u.state = 'walk'; return; }
    }
    u.state = 'idle'; u.timer = 2; return;
  }
  let best = null, bd = 14;
  if (rnd() < 0.6) for (let i = 0; i < 30; i++) {
    const tx = 1 + Math.floor(rnd() * (N - 2)), tz = 1 + Math.floor(rnd() * (N - 2));
    if (!canBuildHome(tx, tz)) continue;
    const [cx, cz] = tileCenter(tx, tz), d = Math.hypot(cx - x0, cz - z0);
    if (d < bd && clearPath(x0, z0, cx, cz)) { bd = d; best = [tx, tz, cx, cz]; }
  }
  if (best) { u.target = new THREE.Vector2(best[2], best[3]); u.build = [best[0], best[1]]; u.state = 'walk'; return; }
  for (let i = 0; i < 20; i++) {
    const a = rnd() * Math.PI * 2, r = 1 + rnd() * 4, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (Math.abs(x) < N / 2 - 1 && Math.abs(z) < N / 2 - 1 && heightAt(x, z) > SEA + 0.1 && clearPath(x0, z0, x, z)) {
      u.target = new THREE.Vector2(x, z); u.build = null; u.state = 'walk'; return;
    }
  }
  u.state = 'idle'; u.timer = 1;
}

// Send the nearest villagers of a tribe to help on a construction site.
export function callWorkers(b, n) {
  const list = villagers.filter(v => v.userData.tribe === b.tribe && v.userData.state !== 'drown')
    .sort((a, c) => Math.hypot(a.position.x - b.cx, a.position.z - b.cz) - Math.hypot(c.position.x - b.cx, c.position.z - b.cz)).slice(0, n);
  list.forEach((v, i) => {
    const a = i / n * Math.PI * 2, r = b.size * 0.55 + 0.15;
    Object.assign(v.userData, { state: 'walk', target: new THREE.Vector2(b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r), build: null, site: b });
  });
}

function update(v, i, dt, t) {
  const u = v.userData;
  const ground = heightAt(v.position.x, v.position.z);
  if (u.state !== 'drown' && u.state !== 'fly' && ground < SEA - 0.08) { u.state = 'drown'; u.timer = 1.2; }
  if (u.state === 'drown') {
    u.timer -= dt; v.position.y -= dt * 0.35; v.rotation.z += dt * 1.5;
    if (u.timer <= 0) removeVillager(v);
    return;
  }
  if (u.state === 'fly') { // caught by a tornado
    u.timer -= dt; u.vy -= dt * 6; v.position.x += u.vx * dt; v.position.z += u.vz * dt; v.position.y += u.vy * dt; v.rotation.x += dt * 8; v.rotation.z += dt * 5;
    if (u.timer <= 0 || v.position.y < ground - 0.2) removeVillager(v);
    return;
  }
  let swing = 0, armSwing = 0;
  if (u.state === 'idle') { u.timer -= dt; if (u.timer <= 0) retarget(v); }
  else if (u.state === 'walk') {
    const dx = u.target.x - v.position.x, dz = u.target.y - v.position.z, d = Math.hypot(dx, dz);
    if (d < 0.06) {
      if (u.home) { u.state = 'idle'; u.timer = 1 + rnd() * 4; }
      else if (u.site) { u.state = 'work'; u.timer = 99; }
      else if (u.build && canBuildHome(u.build[0], u.build[1])) { u.site = placeHome(u.build[0], u.build[1], u.tribe); u.state = 'work'; u.timer = 30; u.moveIn = true; v.position.x += 0.35; }
      else { u.state = 'idle'; u.timer = 0.5 + rnd() * 2; }
    } else {
      const sp = u.speed * dt;
      v.position.x += dx / d * sp; v.position.z += dz / d * sp;
      v.rotation.y = Math.atan2(dx, dz);
      swing = Math.sin(t * 11 * u.speed + u.phase) * 0.7; armSwing = -swing * 0.8;
    }
  } else if (u.state === 'work') {
    u.timer -= dt;
    const s = u.site;
    if (s) v.rotation.y = Math.atan2(s.cx - v.position.x, s.cz - v.position.z);
    u.armR.rotation.x = -1.2 + Math.sin(t * 16 + u.phase) * 0.8;
    if (u.moveIn && s && s.progress >= 1 && s.group.parent) { removeVillager(v); return; }
    if (u.timer <= 0 || !s || s.progress >= 1 || !s.group.parent) { u.site = null; u.moveIn = false; u.state = 'idle'; u.timer = 0.3; }
  }
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = armSwing;
  if (u.state !== 'work') u.armR.rotation.x = -armSwing;
  v.position.y = heightAt(v.position.x, v.position.z) + Math.abs(swing) * 0.02;
}

// A full home sends out a new walker, as long as the tribe isn't crowded.
export function homeSpawn(b) {
  const homes = homesOf(b.tribe).length;
  if (population(b.tribe) < Math.min(45, 6 + homes * 0.6)) spawnVillager(b.tribe, b.cx + 0.35, b.cz + 0.45);
}
let folkT = 0;
export function updateVillagers(dt) {
  folkT += dt;
  if (folkT > 2) {
    folkT = 0;
    for (const tribe of Object.keys(TRIBES)) {
      const homes = homesOf(tribe).filter(b => b.progress >= 1);
      if (homes.length && townsfolk(tribe) < Math.min(50, homes.length * 0.6)) { const b = pick(homes); spawnVillager(tribe, b.cx + 0.3, b.cz + 0.4, b); }
    }
  }
  for (let i = villagers.length - 1; i >= 0; i--) update(villagers[i], i, dt, ctx.time);
}
