// Sound: everything is synthesised live with the Web Audio API, so there are
// no audio files. Ambient beds (sea, wind, rain, tornado howl), positional
// one-shots (building, battles, disasters, animals) and gentle generative music.
import * as THREE from 'three';
import { ctx, U } from '../ctx.js';
import { season } from '../view/sky.js';
import { buildings, tribes } from '../game/settlements.js';
import { heightAt } from '../view/terrainView.js';
import { SEA } from '../config.js';

const PREFS_KEY = 'worldbuilder.audio';
export const audio = { sound: true, music: true, ready: false };
try { Object.assign(audio, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch { /* storage blocked */ }
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: audio.sound, music: audio.music })); } catch { /* ignore */ } };

let ac = null, master, sfxBus, ambBus, musicBus, white, brown;
const beds = {};

// Audio can only start after the player interacts with the page.
export function initAudio() {
  const unlock = () => start();
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
}
function start() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  master = ac.createGain(); master.gain.value = audio.sound ? 0.85 : 0;
  master.connect(comp).connect(ac.destination);
  sfxBus = gain(0.9, master); ambBus = gain(0.9, master);
  musicBus = gain(audio.music ? 0.3 : 0, master);
  // a soft echo gives the music some space
  const delay = ac.createDelay(1), fb = gain(0.33), wet = gain(0.4, master);
  delay.delayTime.value = 0.42;
  musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet);
  white = noiseBuffer('white'); brown = noiseBuffer('brown');
  beds.sea = bed(brown, 'lowpass', 520, 0.6);
  beds.wind = bed(white, 'bandpass', 500, 0.9);
  beds.rain = bed(white, 'highpass', 1800, 0.5);
  beds.howl = bed(white, 'bandpass', 320, 7);
  audio.ready = true;
}
export function setSound(on) { audio.sound = on; savePrefs(); if (master) master.gain.setTargetAtTime(on ? 0.85 : 0, ac.currentTime, 0.1); }
export function setMusic(on) { audio.music = on; savePrefs(); if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.3 : 0, ac.currentTime, 0.3); }

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function noiseBuffer(kind) {
  const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}
function bed(buf, type, freq, q) {
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = gain(0); src.connect(f).connect(g).connect(ambBus); src.start();
  return { f, g };
}
function out(vol, pan, bus = sfxBus) {
  const g = gain(vol), p = ac.createStereoPanner();
  p.pan.value = pan; g.connect(p).connect(bus);
  return g;
}
function env(g, t0, attack, peak, decay, curve = 'exp') {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  else g.gain.linearRampToValueAtTime(0, t0 + attack + decay);
}
function tone(dest, { f = 440, to = null, type = 'sine', t = 0, a = 0.005, d = 0.3, v = 0.3, lp = null, vib = 0, vibRate = 5 }) {
  const t0 = ac.currentTime + t, o = ac.createOscillator(), g = gain(0);
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + a + d);
  if (vib) { const l = ac.createOscillator(), lg = gain(vib); l.frequency.value = vibRate; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + a + d + 0.1); }
  let node = o;
  if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g).connect(dest);
  env(g, t0, a, v, d);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noise(dest, { t = 0, a = 0.005, d = 0.2, v = 0.3, type = 'lowpass', f = 1000, to = null, q = 1, buf = white }) {
  const t0 = ac.currentTime + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = gain(0);
  s.buffer = buf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + a + d);
  s.connect(fl).connect(g).connect(dest);
  env(g, t0, a, v, d);
  s.start(t0, Math.random() * 2); s.stop(t0 + a + d + 0.05);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// Where a sound sits relative to the camera: quieter when far, panned left or right.
const _v = new THREE.Vector3();
function place(x, z) {
  if (x == null) return { g: 1, p: 0 };
  const cam = ctx.camera, tg = ctx.controls.target, camDist = cam.position.distanceTo(tg);
  const d = Math.hypot(x - tg.x, z - tg.z), reach = 5 + camDist * 0.55;
  let g = Math.max(0, 1 - d / reach); g *= g;
  g *= 1.25 - Math.min(0.95, camDist / 60);
  _v.set(x, tg.y, z).project(cam);
  return { g, p: Math.max(-0.85, Math.min(0.85, _v.x * 0.85)) };
}

// ---------------------------------------------------------------------------
// The sound library
// ---------------------------------------------------------------------------
const LIB = {
  raise: o => { tone(o, { f: 120, to: 210, d: 0.22, v: 0.35 }); noise(o, { f: 500, d: 0.25, v: 0.25, buf: brown }); },
  lower: o => { tone(o, { f: 210, to: 90, d: 0.25, v: 0.35 }); noise(o, { f: 400, d: 0.3, v: 0.25, buf: brown }); },
  flag: o => { tone(o, { f: 170, to: 80, d: 0.15, v: 0.4 }); noise(o, { type: 'bandpass', f: 1400, q: 2, a: 0.05, d: 0.35, v: 0.12, t: 0.05 }); },
  hammer: o => { const f = 1500 + Math.random() * 900; noise(o, { type: 'bandpass', f, q: 4, d: 0.05, v: 0.5 }); tone(o, { f: f * 0.45, type: 'triangle', d: 0.05, v: 0.15 }); },
  complete: o => { tone(o, { f: midi(76), d: 0.5, v: 0.12 }); tone(o, { f: midi(81), d: 0.7, v: 0.12, t: 0.12 }); },
  landmark: o => bell(o, midi(67), 0.4, 3),
  bell: o => { for (let i = 0; i < 3; i++) bell(o, midi(55), 0.3, 2.5, i * 1.1); },
  collapse: o => { noise(o, { f: 600, to: 120, a: 0.02, d: 1.2, v: 0.6, buf: brown }); for (let i = 0; i < 4; i++) tone(o, { f: 90 + Math.random() * 40, to: 40, d: 0.2, v: 0.3, t: Math.random() * 0.6 }); },
  clash: o => { const b = 2200 + Math.random() * 900; for (const k of [1, 1.47, 2.09]) tone(o, { f: b * k, d: 0.18 + Math.random() * 0.1, v: 0.06 }); noise(o, { type: 'highpass', f: 3000, d: 0.04, v: 0.25 }); },
  death: o => { tone(o, { f: 130, to: 55, d: 0.3, v: 0.3 }); noise(o, { f: 300, d: 0.25, v: 0.2, buf: brown }); },
  arrow: o => noise(o, { type: 'bandpass', f: 3200, to: 700, q: 3, a: 0.02, d: 0.3, v: 0.25 }),
  bomb: o => { noise(o, { f: 900, to: 70, d: 0.7, v: 0.6, buf: brown }); tone(o, { f: 70, to: 30, d: 0.5, v: 0.4 }); },
  quake: o => {
    noise(o, { f: 160, a: 0.4, d: 4, v: 0.9, buf: brown, curve: 'lin' });
    for (let i = 0; i < 7; i++) noise(o, { type: 'bandpass', f: 900 + Math.random() * 900, q: 1.5, d: 0.12, v: 0.35, t: 0.3 + Math.random() * 3 });
  },
  volcano: o => {
    noise(o, { f: 140, a: 1.2, d: 3, v: 0.9, buf: brown });
    noise(o, { f: 1200, to: 60, a: 0.01, d: 2.4, v: 1, t: 1.5, buf: brown });
    tone(o, { f: 55, to: 28, d: 2, v: 0.6, t: 1.5 });
  },
  whoosh: o => noise(o, { type: 'bandpass', f: 200, to: 900, q: 2, a: 0.6, d: 1.2, v: 0.5 }),
  thunder: o => { noise(o, { type: 'highpass', f: 1500, d: 0.15, v: 0.5 }); noise(o, { f: 900, to: 120, a: 0.05, d: 3.2, v: 0.9, buf: brown }); },
  horn: (o, x) => {
    const base = x.tribe === 'blue' ? 98 : 87.3;
    for (const k of [1, 1.5]) tone(o, { f: base * k, type: 'sawtooth', a: 0.35, d: 1.6, v: 0.12, lp: 650, vib: 1.5, vibRate: 4.5 });
  },
  capture: (o, x) => {
    const up = x.tribe === 'blue';
    tone(o, { f: 196, type: 'sawtooth', a: 0.08, d: 0.45, v: 0.13, lp: 1100 });
    tone(o, { f: up ? 247 : 233, type: 'sawtooth', a: 0.08, d: 0.7, v: 0.13, lp: 1100, t: 0.3 });
  },
  leader: o => { tone(o, { f: midi(69), type: 'triangle', d: 0.3, v: 0.15 }); tone(o, { f: midi(76), type: 'triangle', d: 0.6, v: 0.15, t: 0.18 }); },
  era: (o, x) => {
    const root = x.tribe === 'blue' ? 62 : 50, notes = [0, 4, 7, 12];
    notes.forEach((n, i) => tone(o, { f: midi(root + n), type: 'sawtooth', a: 0.03, d: 0.9 - i * 0.1, v: x.tribe === 'blue' ? 0.1 : 0.06, lp: 1800, t: i * 0.14 }));
    tone(o, { f: midi(root + 12), type: 'triangle', a: 0.05, d: 1.4, v: 0.12, t: 0.56 });
  },
  victory: o => [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(o, { f: midi(62 + n), type: 'triangle', a: 0.02, d: 1.2, v: 0.15, t: i * 0.12 })),
  defeat: o => [12, 10, 7, 3, 0].forEach((n, i) => tone(o, { f: midi(50 + n), type: 'sawtooth', a: 0.05, d: 1.2, v: 0.08, lp: 900, t: i * 0.3 })),
  click: o => tone(o, { f: 1300, d: 0.03, v: 0.06 }),
  bird: o => {
    const base = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) tone(o, { f: base * (0.9 + Math.random() * 0.25), to: base * (1.1 + Math.random() * 0.4), d: 0.06 + Math.random() * 0.05, v: 0.07, t: i * (0.09 + Math.random() * 0.05) });
  },
  baa: o => tone(o, { f: 290, to: 240, type: 'sawtooth', a: 0.04, d: 0.55, v: 0.1, lp: 1200, vib: 18, vibRate: 7 }),
  moo: o => tone(o, { f: 118, to: 92, type: 'sawtooth', a: 0.15, d: 0.9, v: 0.14, lp: 600, vib: 2, vibRate: 3 }),
  oink: o => { for (let i = 0; i < 2; i++) { tone(o, { f: 170, to: 130, type: 'sawtooth', d: 0.1, v: 0.1, lp: 700, t: i * 0.16 }); noise(o, { type: 'bandpass', f: 600, q: 3, d: 0.09, v: 0.1, t: i * 0.16 }); } },
  cluck: o => { for (let i = 0; i < 3; i++) tone(o, { f: 820, to: 520, type: 'triangle', d: 0.05, v: 0.08, t: i * 0.11 }); },
  splash: o => noise(o, { type: 'bandpass', f: 1200, to: 400, q: 1, d: 0.35, v: 0.3 }),
  drum: o => { tone(o, { f: 75, to: 42, d: 0.35, v: 0.5 }); noise(o, { f: 250, d: 0.08, v: 0.2, buf: brown }); },
};
function bell(o, f, v, d, t = 0) {
  [[1, 1], [2, 0.5], [2.76, 0.35], [5.4, 0.15], [8.9, 0.06]].forEach(([k, w]) => tone(o, { f: f * k, d: d / Math.sqrt(k), v: v * w * 0.4, t, a: 0.003 }));
}

const MIN_GAP = { hammer: 0.12, clash: 0.07, arrow: 0.1, death: 0.08, complete: 0.4, bomb: 0.12, baa: 1.2, moo: 1.5, oink: 1.2, cluck: 1, bird: 0.4, collapse: 0.25 };
const lastPlayed = {};
// Play a sound, optionally at a world position (x, z).
export function play(name, x = null, z = null, extra = {}) {
  if (!audio.ready || !audio.sound || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (MIN_GAP[name] && now - (lastPlayed[name] ?? -1) < MIN_GAP[name]) return;
  const { g, p } = place(x, z);
  if (g < 0.02) return;
  lastPlayed[name] = now;
  const dest = out(g * (extra.vol ?? 1), p, name === 'drum' ? musicBus : sfxBus);
  LIB[name]?.(dest, extra);
  setTimeout(() => dest.disconnect(), 6000);
}

// ---------------------------------------------------------------------------
// Ambience and music, updated every frame
// ---------------------------------------------------------------------------
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let birdT = 2, bellT = 15, thunderT = 3, beatT = 0, beat = 0, chord = 0;
const CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]]; // D, Bm, G, A
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81];
export function updateAudio(dt) {
  if (!audio.ready) return;
  const t = ac.currentTime, cam = ctx.camera, tg = ctx.controls.target;
  const camDist = cam.position.distanceTo(tg), zoomOut = smoothstep(8, 45, camDist);
  const w = season.weights, storm = U.uStorm.value;
  // How much open water is near the view
  let wet = 0;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = 3 + camDist * 0.15; if (heightAt(tg.x + Math.cos(a) * r, tg.z + Math.sin(a) * r) < SEA) wet++; }
  wet /= 8;
  const set = (node, v) => node.g.gain.setTargetAtTime(v, t, 0.6);
  set(beds.sea, (0.05 + 0.22 * Math.max(zoomOut, wet)) * (0.75 + 0.25 * Math.sin(t * 0.55) * Math.sin(t * 0.21)) * (1 + storm));
  beds.sea.f.frequency.setTargetAtTime(420 + 200 * Math.sin(t * 0.37) + storm * 300, t, 0.5);
  set(beds.wind, 0.025 + 0.08 * zoomOut + 0.08 * w[3] + 0.25 * storm);
  beds.wind.f.frequency.setTargetAtTime(380 + 220 * (Math.sin(t * 0.13) * 0.5 + Math.sin(t * 0.31) * 0.5) + storm * 400, t, 1);
  set(beds.rain, storm * 0.32);
  // Tornado howl near active tornadoes
  let howl = 0;
  for (const tw of ctx.tornadoes ?? []) howl = Math.max(howl, place(tw.x, tw.z).g);
  set(beds.howl, howl * 0.6);
  beds.howl.f.frequency.setTargetAtTime(260 + 140 * Math.sin(t * 1.7), t, 0.2);
  // Birds in spring and summer when looking at the land up close
  birdT -= dt;
  if (birdT <= 0) {
    birdT = 0.6 + Math.random() * 2.5;
    const life = (w[0] + w[1] + w[2] * 0.3) * (1 - zoomOut * 0.8) * (1 - storm);
    if (Math.random() < life) play('bird', tg.x + (Math.random() - 0.5) * 10, tg.z + (Math.random() - 0.5) * 10);
  }
  // Bells from nearby temples, town centres and cathedrals
  bellT -= dt;
  if (bellT <= 0) {
    bellT = 20 + Math.random() * 25;
    const near = [...buildings].filter(b => b.progress >= 1 && ['temple', 'towncentre', 'cathedral'].includes(b.type));
    const b = near.sort((a, c) => Math.hypot(a.cx - tg.x, a.cz - tg.z) - Math.hypot(c.cx - tg.x, c.cz - tg.z))[0];
    if (b) play('bell', b.cx, b.cz);
  }
  if (storm > 0.5) { thunderT -= dt; if (thunderT <= 0) { thunderT = 3 + Math.random() * 6; play('thunder', null, null, { vol: 0.5 + Math.random() * 0.5 }); } }
  // Music: soft chords and a wandering pentatonic melody; war drums when fighting.
  beatT -= dt;
  if (beatT <= 0 && ctx.speed > 0) {
    beatT = 0.75; beat++;
    const war = tribes.blue.mode === 'attack' || ctx.time - (ctx.lastBattleAt ?? -99) < 4;
    if (audio.music) {
      if (beat % 8 === 1) {
        chord = (chord + 1) % 4;
        for (const n of CHORDS[chord]) tone(musicBus, { f: midi(n), type: 'triangle', a: 1.5, d: 5, v: 0.06, lp: 1400 });
      }
      if (Math.random() < 0.38) {
        const n = PENTA[Math.floor(Math.random() * PENTA.length)];
        tone(musicBus, { f: midi(n), type: 'sine', a: 0.01, d: 1.4, v: 0.07 });
        tone(musicBus, { f: midi(n + 12), type: 'sine', a: 0.01, d: 0.6, v: 0.02 });
      }
      if (war && beat % 2 === 0) play('drum', null, null, { vol: beat % 4 === 0 ? 0.9 : 0.5 });
    }
  }
}

export const sound = (name, x, z, extra) => play(name, x, z, extra);

// Testing aid: how loud the output is right now (0 = silent).
let meter = null;
export function outputLevel() {
  if (!ac) return -1;
  if (!meter) { meter = ac.createAnalyser(); meter.fftSize = 2048; master.connect(meter); }
  const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
  return Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
}
export const soundNames = Object.keys(LIB);
export const audioState = () => ac?.state ?? 'not started';
