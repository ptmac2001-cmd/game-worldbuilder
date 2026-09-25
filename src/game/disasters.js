// Natural disasters: earthquakes, volcanoes, tornadoes and floods.
// They can be cast from the toolbar or strike on their own.
import * as THREE from 'three';
import { N, V, SEA } from '../config.js';
import { ctx } from '../ctx.js';
import { rnd } from '../rng.js';
import * as T from '../sim/terrain.js';
import { heightAt, lava, commitLava } from '../view/terrainView.js';
import { addBoulder, destroyPlants } from '../view/vegetation.js';
import { FX, emit, dustBurst, debrisBurst, flame } from '../view/particles.js';
import { setStorm } from '../view/sky.js';
import { buildings, destroyBuilding } from './settlements.js';
import { villagers, removeVillager } from './villagers.js';
import { animals, removeAnimal } from './animals.js';

const active = [];
const toWorld = (gx, gz) => [gx - N / 2, gz - N / 2];
const inLand = (x, z) => x > 1 && z > 1 && x < N - 1 && z < N - 1;

function editAround(gx, gz, radius, dir) {
  const a = rnd() * Math.PI * 2, r = rnd() * radius;
  const x = Math.round(gx + Math.cos(a) * r), z = Math.round(gz + Math.sin(a) * r);
  if (!inLand(x, z)) return;
  if (T.edit(x, z, dir ?? (rnd() < 0.5 ? 1 : -1))) ctx.onTerrainEdited([[x, z]]);
}
function markTiles(gx, gz, radius, fn) {
  for (let z = Math.floor(gz - radius); z <= gz + radius; z++) for (let x = Math.floor(gx - radius); x <= gx + radius; x++) {
    if (!T.inGrid(x, z)) continue;
    const d = Math.hypot(x + 0.5 - gx, z + 0.5 - gz);
    if (d <= radius) fn(z * N + x, d);
  }
}

export function earthquake(gx, gz) {
  ctx.log('<b>Earthquake!</b> The ground splits apart');
  markTiles(gx, gz, 4.5, (ti, d) => { lava.cracks[ti] = Math.max(lava.cracks[ti], 1 - d / 6); });
  commitLava();
  active.push({ kind: 'quake', gx, gz, t: 0, next: 0 });
}

export function volcano(gx, gz) {
  ctx.log('<b>Volcano!</b> A mountain of fire rises');
  active.push({ kind: 'volcano', gx, gz, t: 0, next: 0, raised: 0, base: T.heightAtVertex(gx, gz) });
}

const funnelMat = new THREE.MeshStandardMaterial({ color: 0x8a9298, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
export function tornado(gx, gz) {
  ctx.log('<b>Tornado!</b> A whirlwind tears across the land');
  const g = new THREE.Group(), rings = [];
  for (let i = 0; i < 9; i++) {
    const y = i * 0.42, r0 = 0.12 + i * 0.09, r1 = 0.12 + (i + 1) * 0.09;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 0.44, 18, 1, true), funnelMat);
    m.position.y = y + 0.22; g.add(m); rings.push(m);
  }
  const deb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x6b5a48 }), 40);
  deb.frustumCulled = false; g.add(deb);
  const [x, z] = toWorld(gx, gz);
  g.position.set(x, heightAt(x, z), z);
  ctx.scene.add(g);
  active.push({ kind: 'tornado', g, rings, deb, t: 0, life: 14, dir: rnd() * Math.PI * 2 });
}

export function flood() {
  ctx.log('<b>Flood!</b> The seas rise and the land sinks');
  setStorm(1);
  active.push({ kind: 'flood', t: 0, done: false });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
let lavaT = 0;
export function updateDisasters(dt) {
  for (const d of [...active]) {
    d.t += dt;
    if (d.kind === 'quake') {
      ctx.shake = Math.max(ctx.shake, 0.18 * (1 - d.t / 4));
      d.next -= dt;
      if (d.next <= 0 && d.t < 3.6) {
        d.next = 0.12;
        editAround(d.gx, d.gz, 4.5);
        const [x, z] = toWorld(d.gx + (rnd() - 0.5) * 8, d.gz + (rnd() - 0.5) * 8);
        dustBurst(x, heightAt(x, z), z, 6);
      }
      if (d.t > 4) active.splice(active.indexOf(d), 1);
    } else if (d.kind === 'volcano') {
      const [cx, cz] = toWorld(d.gx, d.gz), top = heightAt(cx, cz);
      ctx.shake = Math.max(ctx.shake, d.t < 6 ? 0.12 : 0.05 * (1 - (d.t - 6) / 8));
      if (d.t < 1.5) { if (rnd() < 0.5) emit(FX.ash, cx + (rnd() - 0.5) * 0.4, top, cz + (rnd() - 0.5) * 0.4, 0, 0.8, 0, 2.5, 2, 0x5a5452); }
      else {
        d.next -= dt;
        if (d.next <= 0 && d.raised < 7) {
          d.next = 0.3; d.raised++;
          T.edit(d.gx, d.gz, 1);
          ctx.onTerrainEdited([[d.gx, d.gz]]);
          markTiles(d.gx, d.gz, 1.2 + d.raised * 0.3, (ti, dist) => { lava.molten[ti] = Math.max(lava.molten[ti], 1 - dist / 4.5); lava.basalt[ti] = 0; });
          destroyPlants(cx, cz, 1 + d.raised * 0.4);
          for (const b of [...buildings]) if (Math.hypot(b.cx - cx, b.cz - cz) < 1.2 + d.raised * 0.3 + b.size * 0.4) destroyBuilding(b, 'fire');
        }
        if (d.t < 11) {
          for (let i = 0; i < 2; i++) emit(FX.ash, cx + (rnd() - 0.5) * 0.3, top + 0.1, cz + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3 + 0.2, 1.4 + rnd(), (rnd() - 0.5) * 0.3, 4 + rnd() * 2, 2.5 + rnd() * 2, rnd() < 0.5 ? 0x3a3634 : 0x5a5452);
          for (let i = 0; i < 3; i++) flame(cx + (rnd() - 0.5) * 0.4, top + 0.05, cz + (rnd() - 0.5) * 0.4, 3);
          if (rnd() < dt * 9) {
            const a = rnd() * Math.PI * 2, s = 1 + rnd() * 2.5;
            emit(FX.bomb, cx, top + 0.2, cz, Math.cos(a) * s, 4 + rnd() * 3, Math.sin(a) * s, 6, 0.8 + rnd() * 0.8, rnd() < 0.5 ? 0xff6a1a : 0xffa030);
          }
          if (rnd() < dt * 4) {
            const a = rnd() * Math.PI * 2, r = 2 + rnd() * 4.5, bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r;
            if (heightAt(bx, bz) > SEA + 0.1) { addBoulder(bx, bz); dustBurst(bx, heightAt(bx, bz), bz, 4, 0x5a5452); ctx.refreshVegetation(); }
          }
        }
      }
      for (const v of [...villagers]) if (Math.hypot(v.position.x - cx, v.position.z - cz) < 1 + d.raised * 0.3) { for (let i = 0; i < 6; i++) flame(v.position.x, v.position.y + 0.1, v.position.z, 1.5); removeVillager(v); }
      if (d.t > 14) active.splice(active.indexOf(d), 1);
    } else if (d.kind === 'tornado') {
      const g = d.g;
      d.dir += (Math.sin(d.t * 0.9) * 0.9 + (rnd() - 0.5)) * dt;
      const gx = g.position.x + N / 2, gz = g.position.z + N / 2;
      if (gx < 5 || gz < 5 || gx > N - 5 || gz > N - 5) d.dir = Math.atan2(-g.position.x, -g.position.z); // steer back toward the island centre
      g.position.x += Math.sin(d.dir) * 1.3 * dt; g.position.z += Math.cos(d.dir) * 1.3 * dt;
      g.position.y = Math.max(SEA, heightAt(g.position.x, g.position.z));
      const fade = Math.min(1, d.t / 1.2, (d.life - d.t) / 1.5);
      g.scale.set(fade, Math.max(0.05, fade), fade);
      d.rings.forEach((r, i) => { r.rotation.y += dt * (6 - i * 0.3); r.position.x = Math.sin(d.t * 2 + i * 0.5) * 0.04 * i; r.position.z = Math.cos(d.t * 1.7 + i * 0.5) * 0.04 * i; });
      for (let i = 0; i < 40; i++) {
        const a = d.t * (4 + (i % 5)) + i, y = (i / 40) * 3.2, r = 0.2 + y * 0.28;
        d.deb.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * r, y, Math.sin(a) * r), _q.setFromAxisAngle(_p.clone().set(1, 1, 0).normalize(), a), _s));
      }
      d.deb.instanceMatrix.needsUpdate = true;
      const x = g.position.x, z = g.position.z;
      if (rnd() < 0.6) dustBurst(x, g.position.y, z, 2, g.position.y <= SEA + 0.01 ? 0xdfeaf0 : 0xa08a6a);
      if (fade > 0.5) {
        for (const b of [...buildings]) if (Math.hypot(b.cx - x, b.cz - z) < 0.55 + b.size * 0.35) destroyBuilding(b);
        if (destroyPlants(x, z, 0.7)) { debrisBurst(x, g.position.y, z, 6, 1.2, [0x3f7530, 0x5a9640, 0x6b4a2e]); ctx.refreshVegetation(); }
        for (const v of villagers) if (v.userData.state !== 'fly' && Math.hypot(v.position.x - x, v.position.z - z) < 0.7) Object.assign(v.userData, { state: 'fly', timer: 2.5, vx: (rnd() - 0.5) * 3, vz: (rnd() - 0.5) * 3, vy: 4 });
        for (const a of [...animals]) if (Math.hypot(a.position.x - x, a.position.z - z) < 0.6) { debrisBurst(a.position.x, a.position.y, a.position.z, 4, 1, [0xf1ede2]); removeAnimal(a); }
      }
      ctx.shake = Math.max(ctx.shake, 0.03);
      if (d.t > d.life) { ctx.scene.remove(g); active.splice(active.indexOf(d), 1); }
    } else if (d.kind === 'flood') {
      if (d.t > 2.5 && !d.done) {
        d.done = true;
        T.lowerAll();
        const all = [];
        for (let z = 0; z < V; z += 6) for (let x = 0; x < V; x += 6) all.push([x, z]);
        ctx.onTerrainEdited(all);
      }
      if (d.t > 11) { setStorm(0); active.splice(active.indexOf(d), 1); }
    }
  }
  // Lava cools into basalt; basalt and cracks slowly weather away.
  lavaT += dt;
  if (lavaT > 0.25) {
    let changed = false;
    for (let i = 0; i < N * N; i++) {
      if (lava.molten[i] > 0) { const m = Math.max(0, lava.molten[i] - lavaT / 40); lava.basalt[i] = Math.max(lava.basalt[i], Math.min(1, (lava.molten[i] - m) * 60)); lava.molten[i] = m; changed = true; }
      else if (lava.basalt[i] > 0) { lava.basalt[i] = Math.max(0, lava.basalt[i] - lavaT / 150); changed = true; }
      if (lava.cracks[i] > 0) { lava.cracks[i] = Math.max(0, lava.cracks[i] - lavaT / 30); changed = true; }
    }
    if (changed) commitLava();
    lavaT = 0;
  }
  // Nature strikes on its own now and then.
  if (ctx.randomDisasters) {
    ctx.nextDisaster = (ctx.nextDisaster ?? 150) - dt;
    if (ctx.nextDisaster <= 0) {
      ctx.nextDisaster = 110 + rnd() * 120;
      const list = [...buildings];
      const b = list.length ? list[Math.floor(rnd() * list.length)] : null;
      const gx = b ? Math.round(b.tx + (rnd() - 0.5) * 8) : 10 + Math.floor(rnd() * (N - 20));
      const gz = b ? Math.round(b.tz + (rnd() - 0.5) * 8) : 10 + Math.floor(rnd() * (N - 20));
      const r = rnd(), cx = Math.min(N - 4, Math.max(4, gx)), cz = Math.min(N - 4, Math.max(4, gz));
      if (r < 0.38) earthquake(cx, cz); else if (r < 0.76) tornado(cx, cz); else if (r < 0.93) volcano(cx, cz); else flood();
    }
  }
}
