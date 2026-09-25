// Tribal conflict: war gear by age, battles between walkers, sieges that
// capture buildings, arrow-shooting defences, rally flags and leaders, the
// rival god's war plans, and victory or defeat.
import * as THREE from 'three';
import { N, SEA, TRIBES } from '../config.js';
import { ctx } from '../ctx.js';
import { rnd } from '../rng.js';
import { heightAt } from '../view/terrainView.js';
import { Kit } from '../view/geometry.js';
import { FX, emit, dustBurst } from '../view/particles.js';
import { villagers, removeVillager, spawnVillager } from './villagers.js';
import { tribes, buildings, homesOf, captureBuilding, CAPACITY } from './settlements.js';

const enemyOf = t => (t === 'blue' ? 'red' : 'blue');
const alive = v => v.parent && v.userData.state !== 'dead' && v.userData.state !== 'drown' && v.userData.state !== 'fly';
const isFolk = v => !!v.userData.home;
const dist = (a, x, z) => Math.hypot(a.position.x - x, a.position.z - z);
function clearPath(x0, z0, x1, z1) {
  const n = Math.max(4, Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2));
  for (let k = 1; k <= n; k++) { const t = k / n; if (heightAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) < SEA + 0.05) return false; }
  return true;
}
const say = (tribe, text) => ctx.log(`<b style="color:${TRIBES[tribe].css}">${TRIBES[tribe].name}</b> ${text}`);

// ---------------------------------------------------------------------------
// War gear: clubs, then spears, then sword and shield, then helmets and armour.
// ---------------------------------------------------------------------------
const matCache = new Map();
const mat = hex => { if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: hex === 0xc8d0d8 || hex === 0x8a929a ? 0.6 : 0 })); return matCache.get(hex); };
const G = {
  club: new THREE.CylinderGeometry(0.014, 0.01, 0.15, 6).translate(0, -0.1, 0.02),
  clubKnob: new THREE.IcosahedronGeometry(0.024, 0).translate(0, -0.18, 0.02),
  spear: new THREE.CylinderGeometry(0.005, 0.005, 0.36, 5).rotateX(Math.PI / 2.4).translate(0, -0.08, 0.06),
  spearTip: new THREE.ConeGeometry(0.012, 0.045, 5).rotateX(Math.PI / 2.4).translate(0, -0.005, 0.23),
  blade: new THREE.BoxGeometry(0.012, 0.004, 0.17).translate(0, -0.1, 0.1),
  guard: new THREE.BoxGeometry(0.05, 0.01, 0.012).translate(0, -0.1, 0.012),
  shield: new THREE.CylinderGeometry(0.055, 0.055, 0.012, 14).rotateZ(Math.PI / 2).translate(-0.022, -0.06, 0.01),
  boss: new THREE.SphereGeometry(0.014, 6, 4).translate(-0.03, -0.06, 0.01),
  helmet: new THREE.SphereGeometry(0.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  nasal: new THREE.BoxGeometry(0.008, 0.035, 0.008),
  plate: new THREE.BoxGeometry(0.118, 0.1, 0.074),
  cape: new THREE.BoxGeometry(0.11, 0.2, 0.008).translate(0, -0.1, 0),
  staff: new THREE.CylinderGeometry(0.006, 0.006, 0.42, 5).translate(0, -0.05, 0.03),
  ankh: new THREE.TorusGeometry(0.022, 0.006, 5, 12).translate(0, 0.18, 0.03),
  ring: new THREE.RingGeometry(0.12, 0.16, 28).rotateX(-Math.PI / 2),
};
const IRON = 0x8a929a, STEEL = 0xc8d0d8, WOOD = 0x7a5232;

export function equip(v) {
  const u = v.userData, era = tribes[u.tribe].era;
  for (const k of ['weapon', 'offhand', 'helm', 'plate']) if (u[k]) { u[k].parent?.remove(u[k]); u[k] = null; }
  if (isFolk(v)) return;
  const w = new THREE.Group(), o = new THREE.Group();
  const m = (geo, hex) => { const x = new THREE.Mesh(geo, mat(hex)); return x; };
  if (era === 0) w.add(m(G.club, WOOD), m(G.clubKnob, WOOD));
  else if (era === 1) w.add(m(G.spear, WOOD), m(G.spearTip, IRON));
  else { w.add(m(G.blade, STEEL), m(G.guard, 0xb08a3a)); o.add(m(G.shield, TRIBES[u.tribe].flag), m(G.boss, IRON)); }
  u.armR.add(w); u.armL.add(o);
  u.weapon = w; u.offhand = o;
  if (era >= 3) {
    u.helm = new THREE.Group();
    const hm = m(G.helmet, IRON); hm.position.y = 0.308;
    const ns = m(G.nasal, IRON); ns.position.set(0, 0.3, 0.045);
    u.helm.add(hm, ns);
    u.plate = m(G.plate, IRON); u.plate.position.y = 0.19;
    v.add(u.helm, u.plate);
  }
  u.armed = undefined;
  setArmed(v, false);
}
function setArmed(v, armed) {
  const u = v.userData;
  if (u.armed === armed) return;
  u.armed = armed;
  if (u.weapon) u.weapon.visible = armed;
  if (u.offhand) u.offhand.visible = armed;
  if (u.helm) u.helm.visible = armed;
  if (u.plate) u.plate.visible = armed;
  if (u.hat) u.hat.visible = !(armed && u.helm);
  u.armR.children.forEach(c => { if (c !== u.weapon && c !== u.staff) c.visible = !armed; });
}
export function refreshGear(tribe) { for (const v of villagers) if (v.userData.tribe === tribe && alive(v)) equip(v); }

function makeLeader(v) {
  const u = v.userData, tr = tribes[u.tribe];
  tr.leader = v;
  u.leader = true;
  u.strength += 2;
  const cape = new THREE.Mesh(G.cape, mat(TRIBES[u.tribe].flag)); cape.position.set(0, 0.25, -0.04); cape.rotation.x = 0.15;
  const staff = new THREE.Group(); staff.add(new THREE.Mesh(G.staff, mat(WOOD)), new THREE.Mesh(G.ankh, mat(0xd9b44a)));
  u.armL.add(staff); u.staff = staff;
  const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: TRIBES[u.tribe].flag, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.position.y = 0.015;
  v.add(cape, ring);
  say(u.tribe, 'tribe has a new <b>Leader</b>');
}

// ---------------------------------------------------------------------------
// Rally flags and tribe commands
// ---------------------------------------------------------------------------
function flagMesh(tribe) {
  const k = new Kit();
  k.cyl(0.14, 0.17, 0.06, 0x8e8a80, 0, 0, 0, 10);
  k.cyl(0.012, 0.016, 1.3, 0x5b3b24, 0, 0.04, 0, 6);
  k.add(new THREE.TorusGeometry(0.05, 0.012, 6, 14), 0xd9b44a, 0, 1.42, 0);
  k.box(0.012, 0.12, 0.012, 0xd9b44a, 0, 1.25, 0);
  k.box(0.1, 0.012, 0.012, 0xd9b44a, 0, 1.33, 0);
  const g = new THREE.Group();
  const pole = new THREE.Mesh(k.build().geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
  pole.castShadow = true;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.01, 8, 1, 1).translate(0.17, 0, 0), new THREE.MeshStandardMaterial({ color: TRIBES[tribe].flag, side: THREE.DoubleSide }));
  banner.position.y = 1.12; banner.castShadow = true;
  g.add(pole, banner);
  g.userData.banner = banner;
  return g;
}
export function placeFlag(tribe, x, z) {
  if (heightAt(x, z) < SEA + 0.05) return false;
  const tr = tribes[tribe];
  if (!tr.flag) { tr.flag = { group: flagMesh(tribe) }; ctx.scene.add(tr.flag.group); }
  Object.assign(tr.flag, { x, z });
  tr.flag.group.position.set(x, heightAt(x, z), z);
  dustBurst(x, heightAt(x, z), z, 8);
  if (tr.mode !== 'settle') for (const v of villagers) if (v.userData.tribe === tribe && !isFolk(v) && alive(v) && v.userData.state !== 'fight' && v.userData.state !== 'siege') v.userData.state = 'idle';
  return true;
}
function centroid(tribe) {
  const bs = [...buildings].filter(b => b.tribe === tribe);
  if (!bs.length) return null;
  return [bs.reduce((s, b) => s + b.cx, 0) / bs.length, bs.reduce((s, b) => s + b.cz, 0) / bs.length];
}
export function setMode(tribe, mode) {
  const tr = tribes[tribe];
  if (tr.mode === mode) return;
  tr.mode = mode;
  if (mode !== 'settle' && !tr.flag) { const c = centroid(tribe); if (c) placeFlag(tribe, c[0], c[1] + 1.5); }
  for (const v of villagers) {
    const u = v.userData;
    if (u.tribe !== tribe || isFolk(v) || !alive(v) || u.state === 'fight') continue;
    if (u.state === 'work' && u.moveIn && mode !== 'settle') { u.moveIn = false; }
    if (u.state !== 'work' || mode !== 'settle') { u.state = 'idle'; u.timer = rnd() * 0.5; u.chase = null; u.arrive = null; }
  }
}

// ---------------------------------------------------------------------------
// Targets, battles and sieges
// ---------------------------------------------------------------------------
export function power(v) {
  const u = v.userData, era = tribes[u.tribe].era;
  let p = u.strength * (1 + 0.3 * era) * (isFolk(v) ? 0.5 : 1) * (u.leader ? 1.6 : 1);
  const L = tribes[u.tribe].leader;
  if (L && L !== v && alive(L) && dist(L, v.position.x, v.position.z) < 2.5) p *= 1.25;
  return p;
}

// Called by villagers when a walker needs something to do. Returns true if war orders apply.
export function warRetarget(v) {
  const u = v.userData, tr = tribes[u.tribe];
  if (isFolk(v) || tr.mode === 'settle') return false;
  u.build = null; u.site = null;
  if (tr.mode === 'gather' && tr.flag) {
    const a = rnd() * Math.PI * 2, r = 0.25 + rnd() * 0.9;
    const x = tr.flag.x + Math.cos(a) * r, z = tr.flag.z + Math.sin(a) * r;
    u.target = new THREE.Vector2(x, z); u.state = 'walk'; u.chase = null;
    u.arrive = w => { w.userData.state = 'rally'; w.userData.timer = 1 + rnd() * 3; if (!tribes[w.userData.tribe].leader || !alive(tribes[w.userData.tribe].leader)) makeLeader(w); };
    return true;
  }
  // Attack: the nearest enemy walker nearby, otherwise the nearest enemy building.
  const x0 = v.position.x, z0 = v.position.z, foe = enemyOf(u.tribe);
  let best = null, bd = 7;
  for (const e of villagers) if (e.userData.tribe === foe && alive(e) && e.userData.state !== 'fight') { const d = dist(e, x0, z0); if (d < bd && clearPath(x0, z0, e.position.x, e.position.z)) { bd = d; best = e; } }
  if (best) { u.chase = best; u.target = new THREE.Vector2(best.position.x, best.position.z); u.state = 'walk'; u.arrive = null; return true; }
  let bb = null; bd = Infinity;
  for (const b of buildings) {
    if (b.tribe !== foe) continue;
    const d = Math.hypot(b.cx - x0, b.cz - z0) + (b.kind === 'civic' ? 3 : 0);
    if (d < bd) { bd = d; bb = b; }
  }
  if (bb) {
    const a = Math.atan2(z0 - bb.cz, x0 - bb.cx) + (rnd() - 0.5) * 1.2, r = bb.size * 0.5 + 0.18;
    const x = bb.cx + Math.cos(a) * r, z = bb.cz + Math.sin(a) * r;
    if (clearPath(x0, z0, x, z)) {
      u.target = new THREE.Vector2(x, z); u.state = 'walk'; u.chase = null;
      u.arrive = w => { if (buildings.has(bb) && bb.tribe !== w.userData.tribe) { w.userData.state = 'siege'; w.userData.siege = bb; } else w.userData.state = 'idle'; };
      return true;
    }
  }
  if (tr.flag) { u.target = new THREE.Vector2(tr.flag.x + (rnd() - 0.5), tr.flag.z + (rnd() - 0.5)); u.state = 'walk'; u.arrive = null; u.chase = null; return true; }
  return false;
}

function startFight(a, b) {
  for (const [v, f] of [[a, b], [b, a]]) {
    const u = v.userData;
    u.state = 'fight'; u.foe = f; u.fightT = 1.2 + rnd() * 1.6; u.chase = null; u.arrive = null; u.fleeing = false;
    setArmed(v, true);
  }
  const mx = (a.position.x + b.position.x) / 2, mz = (a.position.z + b.position.z) / 2;
  const ang = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
  a.position.set(mx - Math.sin(ang) * 0.11, a.position.y, mz - Math.cos(ang) * 0.11);
  b.position.set(mx + Math.sin(ang) * 0.11, b.position.y, mz + Math.cos(ang) * 0.11);
}
function kill(v, cause = 'battle') {
  const u = v.userData;
  if (u.state === 'dead') return;
  u.state = 'dead'; u.timer = 3; u.foe = null;
  if (u.leader) { tribes[u.tribe].leader = null; say(u.tribe, 'tribe\'s Leader has fallen'); }
  dustBurst(v.position.x, v.position.y, v.position.z, 4);
  if (cause === 'arrow') emit(FX.debris, v.position.x, v.position.y + 0.2, v.position.z, 0, 0.8, 0, 0.6, 0.4, 0xd8352a);
}
function resolve(a, b) {
  const pa = power(a), pb = power(b), aWins = rnd() < pa / (pa + pb);
  const [w, l] = aWins ? [a, b] : [b, a];
  w.userData.strength = Math.max(0.5, w.userData.strength - l.userData.strength * 0.5);
  kill(l);
  w.userData.state = 'idle'; w.userData.timer = 0.3; w.userData.foe = null;
}

export function capture(b, v) {
  const tribe = v.userData.tribe, old = b.tribe;
  say(tribe, `warriors captured a ${TRIBES[old].name} ${b.kind === 'civic' ? b.type.replace('towncentre', 'Town Centre') : b.type}`);
  for (const f of [...villagers]) if (f.userData.home === b) removeVillager(f);
  captureBuilding(b, tribe);
  removeVillager(v); // the victor moves in
  for (const o of villagers) if (o.userData.siege === b) { o.userData.siege = null; o.userData.state = 'idle'; }
}
const maxHp = b => b.kind === 'civic' ? 4 + b.size * 4 : (b.type === 'keep' ? 10 : CAPACITY[b.type] * 2);

// Handles the war states for one walker. Returns true if it did.
export function warState(v, dt, t) {
  const u = v.userData;
  const armed = (!isFolk(v) && tribes[u.tribe].mode !== 'settle') || u.state === 'fight' || u.state === 'siege';
  setArmed(v, armed && !isFolk(v));
  if (!isFolk(v)) v.scale.setScalar(0.9 * (1 + Math.min(0.35, (u.strength - 1) * 0.07)));
  if (u.leader && u.staff) u.staff.visible = true;
  if (u.state === 'dead') {
    u.timer -= dt;
    v.rotation.x = Math.max(-Math.PI / 2, v.rotation.x - dt * 5);
    if (u.timer < 1.2) v.position.y -= dt * 0.15;
    if (u.timer <= 0) removeVillager(v);
    return true;
  }
  if (u.state === 'fight') {
    const f = u.foe;
    if (!f || !f.parent || f.userData.state !== 'fight' || f.userData.foe !== v) { u.state = 'idle'; u.timer = 0.2; u.foe = null; return false; }
    v.rotation.y = Math.atan2(f.position.x - v.position.x, f.position.z - v.position.z);
    u.armR.rotation.x = -1.6 + Math.sin(t * 14 + u.phase) * 1.1;
    u.armL.rotation.x = -0.6 + Math.sin(t * 7 + u.phase) * 0.2;
    u.legL.rotation.x = 0.3; u.legR.rotation.x = -0.3;
    v.position.y = heightAt(v.position.x, v.position.z);
    if (Math.random() < dt * 5) emit(FX.fire, (v.position.x + f.position.x) / 2, v.position.y + 0.22, (v.position.z + f.position.z) / 2, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, 0.25, 0.4, 0xfff0b0);
    u.fightT -= dt;
    if (u.fightT <= 0) resolve(v, f);
    return true;
  }
  if (u.state === 'siege') {
    const b = u.siege;
    if (!b || !buildings.has(b) || b.tribe === u.tribe) { u.state = 'idle'; u.timer = 0.2; u.siege = null; return false; }
    v.rotation.y = Math.atan2(b.cx - v.position.x, b.cz - v.position.z);
    u.armR.rotation.x = -1.4 + Math.sin(t * 12 + u.phase) * 1.0;
    v.position.y = heightAt(v.position.x, v.position.z);
    b.hp = (b.hp ?? maxHp(b)) - power(v) * dt * 0.35;
    b.siegedAt = ctx.time;
    // Militia: the residents come out to defend their home, once per siege.
    if (!b.militia && b.progress >= 1) {
      b.militia = true;
      const n = b.kind === 'civic' ? 2 + b.size : Math.ceil(CAPACITY[b.type] / 2);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = b.size * 0.5 + 0.2;
        const d = spawnVillager(b.tribe, b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r, null, b.kind === 'civic' ? 1.5 : 0.8 + CAPACITY[b.type] * 0.2);
        d.userData.chase = v; d.userData.state = 'walk'; d.userData.target = new THREE.Vector2(v.position.x, v.position.z);
      }
    }
    if (Math.random() < dt * 3) emit(FX.dust, b.cx + (Math.random() - 0.5) * b.size * 0.7, b.group.position.y + 0.1, b.cz + (Math.random() - 0.5) * b.size * 0.7, 0, 0.3, 0, 0.8, 0.8, 0xb59f7c);
    if (b.hp <= 0) capture(b, v);
    return true;
  }
  if (u.state === 'rally') {
    u.timer -= dt;
    v.rotation.y += Math.sin(t + u.phase) * dt * 0.5;
    u.armR.rotation.x = u.leader ? -2.4 + Math.sin(t * 3) * 0.3 : Math.sin(t * 2 + u.phase) * 0.1;
    u.legL.rotation.x = u.legR.rotation.x = 0;
    v.position.y = heightAt(v.position.x, v.position.z);
    if (tribes[u.tribe].mode !== 'gather') { u.state = 'idle'; u.timer = rnd() * 0.5; }
    else if (u.timer <= 0 && rnd() < 0.3) warRetarget(v); else if (u.timer <= 0) u.timer = 2 + rnd() * 3;
    return true;
  }
  if (u.chase) {
    if (!alive(u.chase)) { u.chase = null; u.state = 'idle'; u.timer = 0.1; }
    else u.target.set(u.chase.position.x, u.chase.position.z);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Arrows from towers
// ---------------------------------------------------------------------------
const arrows = [];
const arrowGeo = new Kit().add(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4).rotateX(Math.PI / 2), 0x6b4a2e).add(new THREE.ConeGeometry(0.009, 0.03, 4).rotateX(Math.PI / 2), 0x8a929a, 0, 0, 0.08).build().geo;
const arrowMat = new THREE.MeshStandardMaterial({ vertexColors: true });
const TOWERS = { keep: 3.6, manor: 2.8, towncentre: 3.8, cathedral: 3.8 };
function shoot(b, target) {
  const top = b.group.position.y + b.design.height * 0.8;
  const m = new THREE.Mesh(arrowGeo, arrowMat);
  ctx.scene.add(m);
  const to = new THREE.Vector3(target.position.x, target.position.y + 0.15, target.position.z);
  arrows.push({ m, from: new THREE.Vector3(b.cx, top, b.cz), to, t: 0, dur: 0.4 + Math.hypot(to.x - b.cx, to.z - b.cz) * 0.12, target });
}
function updateArrows(dt) {
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (const a of [...arrows]) {
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const arc = Math.sin(k * Math.PI) * 0.5;
    p.lerpVectors(a.from, a.to, k); p.y += arc;
    q.lerpVectors(a.from, a.to, Math.min(1, k + 0.05)); q.y += Math.sin(Math.min(1, k + 0.05) * Math.PI) * 0.5;
    a.m.position.copy(p); a.m.lookAt(q);
    if (k >= 1) {
      ctx.scene.remove(a.m); arrows.splice(arrows.indexOf(a), 1);
      const v = a.target;
      if (alive(v) && dist(v, a.to.x, a.to.z) < 0.3) { v.userData.strength -= 0.8; if (v.userData.strength <= 0) kill(v, 'arrow'); }
    }
  }
}

// ---------------------------------------------------------------------------
// The rival god's war plans
// ---------------------------------------------------------------------------
const RIVAL = { peaceful: null, normal: { grace: 300, muster: 35, war: 70, rest: 200 }, aggressive: { grace: 150, muster: 25, war: 90, rest: 110 } };
function rivalAI(tribe, dt) {
  const tr = tribes[tribe], cfg = RIVAL[ctx.rival ?? 'normal'];
  const w = tr.war ??= { phase: 'peace', t: cfg ? cfg.grace : 1e9 };
  if (!cfg) { if (tr.mode !== 'settle' && w.phase !== 'defend') setMode(tribe, 'settle'); }
  // Defend: if enemy warriors are close to our buildings, fight back.
  const foe = enemyOf(tribe);
  if (w.phase === 'peace' && tribes[foe].mode === 'attack') {
    const bs = [...buildings].filter(b => b.tribe === tribe);
    const threat = villagers.some(e => e.userData.tribe === foe && !isFolk(e) && alive(e) && bs.some(b => Math.hypot(b.cx - e.position.x, b.cz - e.position.z) < 4));
    if (threat) { w.phase = 'defend'; w.t = 25; setMode(tribe, 'attack'); say(tribe, 'tribe rushes to defend its homes'); return; }
  }
  w.t -= dt;
  if (w.t > 0) return;
  if (w.phase === 'peace' && cfg) {
    const mine = centroid(tribe), theirs = centroid(foe);
    if (!mine || !theirs || homesOf(tribe).length < 5) { w.t = 30; return; }
    let placed = false;
    for (let k = 0.35; k > 0 && !placed; k -= 0.05) placed = placeFlag(tribe, mine[0] + (theirs[0] - mine[0]) * k, mine[1] + (theirs[1] - mine[1]) * k);
    setMode(tribe, 'gather');
    say(tribe, 'tribe is <b>gathering an army</b>');
    w.phase = 'muster'; w.t = cfg.muster;
  } else if (w.phase === 'muster') {
    setMode(tribe, 'attack');
    say(tribe, 'tribe <b>attacks!</b>');
    w.phase = 'war'; w.t = cfg.war;
  } else if (w.phase === 'war' || w.phase === 'defend') {
    setMode(tribe, 'settle');
    if (w.phase === 'war') say(tribe, 'tribe\'s army returns home');
    w.phase = 'peace'; w.t = cfg ? cfg.rest : 1e9;
  }
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------
let checkT = 0;
export function updateConflict(dt) {
  // Battles start when rival walkers meet; townsfolk run home instead.
  const live = villagers.filter(v => alive(v));
  for (let i = 0; i < live.length; i++) {
    const a = live[i], ua = a.userData;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j], ub = b.userData;
      if (ua.tribe === ub.tribe) continue;
      const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
      if (d > 1.3) continue;
      const fa = isFolk(a), fb = isFolk(b);
      if (fa && fb) continue;
      for (const [f, e] of [[a, b], [b, a]]) {
        const uf = f.userData;
        if (isFolk(f) && !isFolk(e) && !uf.fleeing && uf.state !== 'fight' && uf.home?.group.parent) {
          uf.fleeing = true; uf.state = 'walk'; uf.target = new THREE.Vector2(uf.home.cx + 0.3, uf.home.cz + 0.4); uf.arrive = null;
        }
      }
      if (d < 0.32 && ua.state !== 'fight' && ub.state !== 'fight') startFight(a, b);
    }
  }
  // Towers shoot at invaders.
  for (const b of buildings) {
    const range = TOWERS[b.type];
    if (!range || b.progress < 1) continue;
    b.arrowT = (b.arrowT ?? rnd() * 2) - dt;
    if (b.arrowT > 0) continue;
    b.arrowT = 2.2;
    let best = null, bd = range;
    for (const v of live) if (v.userData.tribe !== b.tribe && !isFolk(v)) { const d = dist(v, b.cx, b.cz); if (d < bd) { bd = d; best = v; } }
    if (best) shoot(b, best);
  }
  updateArrows(dt);
  // Buildings slowly repair when no longer besieged.
  for (const b of buildings) if (b.hp != null && ctx.time - (b.siegedAt ?? 0) > 3) { b.hp = Math.min(maxHp(b), b.hp + dt * 0.3); if (b.hp >= maxHp(b)) { b.hp = null; b.militia = false; } }
  // Flags wave in the wind.
  for (const tr of Object.values(tribes)) if (tr.flag) tr.flag.group.userData.banner.rotation.y = Math.sin(ctx.realTime * 2.2) * 0.35;
  rivalAI('red', dt);
  if (tribes.blue.autoWar) rivalAI('blue', dt);
  // Victory and defeat.
  checkT -= dt;
  if (checkT <= 0 && !ctx.gameOver) {
    checkT = 1;
    for (const tribe of Object.keys(TRIBES)) {
      const left = [...buildings].some(b => b.tribe === tribe) || villagers.some(v => v.userData.tribe === tribe && alive(v));
      if (!left) { ctx.gameOver = tribe === 'blue' ? 'defeat' : 'victory'; ctx.onGameOver?.(ctx.gameOver); break; }
    }
  }
}

export const army = tribe => villagers.filter(v => v.userData.tribe === tribe && !isFolk(v) && alive(v));
