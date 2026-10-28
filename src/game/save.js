// Save and load. A save is a compact JSON snapshot kept in this browser's
// local storage: three slots plus an autosave. Loading reloads the page and
// rebuilds the world from the snapshot, so nothing from the old game lingers.
import { ctx } from '../ctx.js';
import { getSeed, setSeed } from '../rng.js';
import * as T from '../sim/terrain.js';
import { computeTarget, cur, tgt, applyHeights, lava, commitLava } from '../view/terrainView.js';
import { deadPlants, setDeadPlants, boulderList, addBoulder } from '../view/vegetation.js';
import { season } from '../view/sky.js';
import { ERAS } from '../config.js';
import { buildings, tribes, restoreBuilding, recomputeLand } from './settlements.js';
import { villagers, spawnVillager } from './villagers.js';
import { placeFlag, makeLeader } from './conflict.js';

const PREFIX = 'worldbuilder.save.', PENDING = 'worldbuilder.pending';
export const SLOTS = ['auto', '1', '2', '3'];
export const storageOK = (() => { try { localStorage.setItem('worldbuilder.test', '1'); localStorage.removeItem('worldbuilder.test'); return true; } catch { return false; } })();

const toB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode(...bytes.subarray(i, i + 4096)); return btoa(s); };
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const pack = arr => toB64(Uint8Array.from(arr, v => Math.round(Math.min(1, Math.max(0, v)) * 255)));
const unpack = (str, into) => fromB64(str).forEach((b, i) => { into[i] = b / 255; });

export function snapshot() {
  const list = [...buildings];
  const index = new Map(list.map((b, i) => [b, i]));
  const live = villagers.filter(v => v.parent && !['dead', 'drown', 'fly'].includes(v.userData.state));
  return {
    v: 1, savedAt: Date.now(), seed: ctx.seed, rng: getSeed(), time: ctx.time,
    summary: `${season.name}, Year ${season.year} · Blue: ${ERAS[tribes.blue.era].name} Age · Red: ${ERAS[tribes.red.era].name} Age`,
    opts: { rival: ctx.rival, nature: !!ctx.randomDisasters, nextDisaster: ctx.nextDisaster ?? null, gameOver: ctx.gameOver ?? null },
    h: toB64(new Uint8Array(T.h.buffer.slice(0))),
    lava: { m: pack(lava.molten), b: pack(lava.basalt), c: pack(lava.cracks) },
    rocks: boulderList(),
    dead: deadPlants(),
    buildings: list.map(b => ({ kind: b.kind, type: b.type, tribe: b.tribe, tx: b.tx, tz: b.tz, size: b.size, progress: +b.progress.toFixed(3) })),
    tribes: Object.fromEntries(Object.values(tribes).map(t => [t.id, {
      era: t.era, mode: t.mode, ai: t.ai, autoWar: !!t.autoWar, spawnT: t.spawnT ?? 0, planT: t.planT, aiT: t.aiT, war: t.war ?? null,
      flag: t.flag ? [+t.flag.x.toFixed(2), +t.flag.z.toFixed(2)] : null,
    }])),
    walkers: live.map(v => {
      const u = v.userData;
      return [u.tribe, +v.position.x.toFixed(2), +v.position.z.toFixed(2), u.home ? index.get(u.home) ?? -1 : -1, +u.strength.toFixed(2), u.leader ? 1 : 0];
    }),
    cam: [...ctx.camera.position.toArray(), ...ctx.controls.target.toArray()].map(n => +n.toFixed(2)),
  };
}

export function readSlot(slot) { try { const s = localStorage.getItem(PREFIX + slot); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveTo(slot) {
  try { localStorage.setItem(PREFIX + slot, JSON.stringify(snapshot())); return true; } catch { return false; }
}
export function deleteSlot(slot) { try { localStorage.removeItem(PREFIX + slot); } catch { /* ignore */ } }

// Loading and starting a new island both restart the page with a note of what to do.
export function restartWith(intent) {
  try { localStorage.setItem(PENDING, JSON.stringify(intent)); location.reload(); }
  catch { if (intent.seed != null) location.search = '?seed=' + intent.seed; }
}
export function takePending() {
  try { const p = JSON.parse(localStorage.getItem(PENDING) || 'null'); localStorage.removeItem(PENDING); return p; } catch { return null; }
}

// Called during start-up, after the world has been generated from the same seed.
export function applySave(d) {
  T.h.set(new Int8Array(fromB64(d.h).buffer));
  computeTarget(); cur.set(tgt); applyHeights();
  unpack(d.lava.m, lava.molten); unpack(d.lava.b, lava.basalt); unpack(d.lava.c, lava.cracks);
  commitLava();
  for (const [x, z, s, r] of d.rocks) addBoulder(x, z, s, r);
  setDeadPlants(d.dead);
  for (const [id, t] of Object.entries(d.tribes)) Object.assign(tribes[id], { era: t.era, mode: t.mode, ai: t.ai, autoWar: t.autoWar, spawnT: t.spawnT, planT: t.planT, aiT: t.aiT, war: t.war });
  const list = d.buildings.map(e => restoreBuilding(e));
  for (const [id, t] of Object.entries(d.tribes)) if (t.flag) placeFlag(id, t.flag[0], t.flag[1]);
  for (const [tribe, x, z, home, strength, leader] of d.walkers) {
    const v = spawnVillager(tribe, x, z, home >= 0 ? list[home] ?? null : null, strength);
    if (home >= 0 && !list[home]) v.userData.home = null;
    v.userData.strength = strength;
    if (leader) makeLeader(v, true);
  }
  recomputeLand(true);
  Object.assign(ctx, { time: d.time, rival: d.opts.rival, randomDisasters: d.opts.nature, nextDisaster: d.opts.nextDisaster ?? undefined, gameOver: d.opts.gameOver ?? undefined });
  const c = d.cam;
  ctx.camera.position.set(c[0], c[1], c[2]);
  ctx.controls.target.set(c[3], c[4], c[5]);
  setSeed(d.rng);
}
export const describe = d => d ? `${d.summary} · saved ${new Date(d.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Empty';
