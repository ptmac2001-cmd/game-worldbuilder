// Livestock that graze in fenced pastures while a tribe still farms.
import * as THREE from 'three';
import { N } from '../config.js';
import { ctx } from '../ctx.js';
import { rnd, hash2 } from '../rng.js';
import { Kit } from '../view/geometry.js';
import { heightAt, LAND } from '../view/terrainView.js';
import { land } from './settlements.js';
import { tileCenter } from '../sim/terrain.js';

function legs(k, hex, dx, dz, hgt, r = 0.011) { for (const [x, z] of [[-dx, -dz], [dx, -dz], [-dx, dz], [dx, dz]]) k.cyl(r * 0.85, r, hgt, hex, x, 0, z, 5); }
const SPECIES = {
  sheep: { count: 3, speed: 0.12, build() {
    const k = new Kit();
    legs(k, 0x2e2a28, 0.035, 0.05, 0.07);
    k.add(new THREE.IcosahedronGeometry(0.075, 1).scale(1, 0.8, 1.3), 0xf1ede2, 0, 0.11, 0);
    k.add(new THREE.IcosahedronGeometry(0.05, 1).scale(1, 0.8, 1), 0xf6f2e8, 0, 0.15, -0.02);
    k.box(0.045, 0.05, 0.06, 0x2e2a28, 0, 0.1, 0.1);
    k.box(0.03, 0.012, 0.02, 0x2e2a28, -0.03, 0.14, 0.09, 0, 0, 0.4); k.box(0.03, 0.012, 0.02, 0x2e2a28, 0.03, 0.14, 0.09, 0, 0, -0.4);
    return k.build().geo;
  } },
  cow: { count: 2, speed: 0.09, build(v) {
    const k = new Kit(), body = v ? 0x8a5a3a : 0xf2f0ea, spot = v ? 0xf2f0ea : 0x2a2624;
    legs(k, body, 0.04, 0.075, 0.09, 0.014);
    k.box(0.1, 0.1, 0.22, body, 0, 0.08, 0);
    k.box(0.102, 0.05, 0.06, spot, 0, 0.12, -0.03); k.box(0.07, 0.04, 0.05, spot, 0.016, 0.1, 0.06);
    k.box(0.07, 0.075, 0.08, body, 0, 0.13, 0.13);
    k.box(0.06, 0.035, 0.03, 0xe8a6a0, 0, 0.12, 0.18);
    k.cone(0.008, 0.035, 0xe8e0c8, -0.03, 0.2, 0.12, 5); k.cone(0.008, 0.035, 0xe8e0c8, 0.03, 0.2, 0.12, 5);
    k.box(0.025, 0.012, 0.015, body, -0.045, 0.18, 0.13); k.box(0.025, 0.012, 0.015, body, 0.045, 0.18, 0.13);
    k.box(0.04, 0.025, 0.04, 0xe8a6a0, 0, 0.065, -0.04);
    k.box(0.008, 0.1, 0.008, body, 0, 0.08, -0.115, 0, 0.3);
    return k.build().geo;
  } },
  pig: { count: 2, speed: 0.1, build() {
    const k = new Kit(), pink = 0xe8a6a0;
    legs(k, pink, 0.03, 0.045, 0.05, 0.012);
    k.add(new THREE.IcosahedronGeometry(0.065, 1).scale(1, 0.85, 1.4), pink, 0, 0.09, 0);
    k.add(new THREE.CylinderGeometry(0.022, 0.025, 0.03, 8).rotateX(Math.PI / 2), 0xd88a86, 0, 0.09, 0.1);
    k.box(0.025, 0.03, 0.01, 0xd88a86, -0.03, 0.14, 0.06, 0, 0.4, 0.3); k.box(0.025, 0.03, 0.01, 0xd88a86, 0.03, 0.14, 0.06, 0, 0.4, -0.3);
    k.add(new THREE.TorusGeometry(0.012, 0.004, 4, 8, 5), pink, 0, 0.11, -0.09, Math.PI / 2);
    return k.build().geo;
  } },
  chicken: { count: 5, speed: 0.13, build(v) {
    const k = new Kit(), c = v ? 0xb5652a : 0xf6f2ea;
    k.cyl(0.003, 0.003, 0.03, 0xe0a030, -0.01, 0, 0, 3); k.cyl(0.003, 0.003, 0.03, 0xe0a030, 0.01, 0, 0, 3);
    k.add(new THREE.IcosahedronGeometry(0.03, 1).scale(1, 0.9, 1.2), c, 0, 0.048, 0);
    k.cone(0.018, 0.035, c, 0, 0.055, -0.035, 5);
    k.ball(0.017, c, 0, 0.078, 0.025, 6);
    k.box(0.005, 0.018, 0.018, 0xd8352a, 0, 0.095, 0.025);
    k.add(new THREE.ConeGeometry(0.006, 0.016, 4).rotateX(Math.PI / 2), 0xf0b030, 0, 0.076, 0.045);
    return k.build().geo;
  } },
};
const geos = {};
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
export const animals = [];
const byTile = new Map();

function speciesFor(ti) { const r = hash2(ti * 3 + 7, ti); return r < 0.4 ? 'sheep' : r < 0.68 ? 'cow' : r < 0.86 ? 'pig' : 'chicken'; }

export function syncAnimals() {
  for (const [ti, list] of byTile) if (land[ti] !== LAND.PASTURE) { for (const a of list) removeAnimal(a); byTile.delete(ti); }
  for (let ti = 0; ti < N * N; ti++) {
    if (land[ti] !== LAND.PASTURE || byTile.has(ti)) continue;
    const sp = speciesFor(ti), S = SPECIES[sp], [cx, cz] = tileCenter(ti % N, (ti / N) | 0), list = [];
    for (let i = 0; i < S.count; i++) {
      const v = rnd() < 0.35 ? 1 : 0, key = sp + v;
      geos[key] ??= S.build(v);
      const m = new THREE.Mesh(geos[key], mat);
      m.castShadow = true;
      const x = cx + (rnd() - 0.5) * 0.7, z = cz + (rnd() - 0.5) * 0.7;
      m.position.set(x, heightAt(x, z), z);
      m.rotation.y = rnd() * Math.PI * 2;
      m.userData = { ti, cx, cz, sp, speed: S.speed * (0.8 + rnd() * 0.4), state: 'idle', t: rnd() * 3, phase: rnd() * 6 };
      ctx.scene.add(m); animals.push(m); list.push(m);
    }
    byTile.set(ti, list);
  }
}
export function removeAnimal(a) {
  const i = animals.indexOf(a);
  if (i >= 0) animals.splice(i, 1);
  ctx.scene.remove(a);
  const list = byTile.get(a.userData.ti);
  if (list) { const j = list.indexOf(a); if (j >= 0) list.splice(j, 1); }
}

export function updateAnimals(dt) {
  const t = ctx.time;
  for (const a of animals) {
    const u = a.userData;
    u.t -= dt;
    if (u.state === 'idle' || u.state === 'graze') {
      a.rotation.x = u.state === 'graze' ? (u.sp === 'chicken' ? Math.max(0, Math.sin(t * 12 + u.phase)) * 0.6 : 0.12) : 0;
      if (u.t <= 0) {
        if (rnd() < 0.5) { u.state = 'walk'; u.tx = u.cx + (rnd() - 0.5) * 0.76; u.tz = u.cz + (rnd() - 0.5) * 0.76; }
        else { u.state = rnd() < 0.7 ? 'graze' : 'idle'; u.t = 1.5 + rnd() * 3; }
      }
    } else {
      const dx = u.tx - a.position.x, dz = u.tz - a.position.z, d = Math.hypot(dx, dz);
      a.rotation.x = 0;
      if (d < 0.02) { u.state = 'graze'; u.t = 1 + rnd() * 3; }
      else {
        const want = Math.atan2(dx, dz);
        let dr = want - a.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        a.rotation.y += dr * Math.min(1, dt * 5);
        a.position.x += dx / d * u.speed * dt; a.position.z += dz / d * u.speed * dt;
      }
    }
    a.position.y = heightAt(a.position.x, a.position.z) + (u.state === 'walk' ? Math.abs(Math.sin(t * 10 + u.phase)) * 0.01 : 0);
  }
}
