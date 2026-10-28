// On-screen UI: toolbar (tools, disasters, speed), status panel and event log.
import { ctx } from '../ctx.js';
import { ERAS, CIVICS, TRIBES, SEASON_LENGTH } from '../config.js';
import { season } from '../view/sky.js';
import { tribes, homesOf, civicsOf, LABELS } from '../game/settlements.js';
import { population, townsfolk } from '../game/villagers.js';
import { setMode, army, power } from '../game/conflict.js';
import { audio, setSound, setMusic } from '../audio/sound.js';
import { SLOTS, readSlot, saveTo, deleteSlot, restartWith, describe, storageOK } from '../game/save.js';
import { buildings } from '../game/settlements.js';
import * as THREE from 'three';

export const ui = { tool: 'raise', markerUntil: 45 };
const TOOLS = [
  ['raise', 'Raise', '1'], ['lower', 'Lower', '2'],
  ['quake', 'Earthquake', '3'], ['volcano', 'Volcano', '4'], ['tornado', 'Tornado', '5'], ['flood', 'Flood', '6'],
];
const COMMANDS = [['settle', 'Settle', '8'], ['gather', 'Gather', '9'], ['attack', 'Attack', '0']];
const RIVALS = ['peaceful', 'normal', 'aggressive'];
const MODE_TEXT = { settle: 'Settling', gather: 'Gathering an army', attack: 'At war' };
const SPEEDS = [[0, 'Pause'], [1, '1×'], [4, '4×'], [12, '12×']];

export function initUI({ onFlood }) {
  const bar = document.getElementById('toolbar');
  const group = (label, html) => `<div class="group"><span class="glabel">${label}</span><div class="btns">${html}</div></div>`;
  bar.innerHTML =
    group('Shape land', TOOLS.slice(0, 2).map(([id, l, k]) => `<button type="button" data-tool="${id}" title="${l} (key ${k})">${l}</button>`).join('')) +
    group('Disasters', TOOLS.slice(2).map(([id, l, k]) => `<button type="button" data-tool="${id}" class="danger" title="${l} (key ${k})">${l}</button>`).join('')) +
    group('Your tribe', `<button type="button" id="findHome" title="Show your village (key H)">My village</button><button type="button" data-tool="flag" title="Plant your rally flag (key 7)">Place flag</button>` + COMMANDS.map(([id, l, k]) => `<button type="button" data-cmd="${id}" class="cmd" title="${l} (key ${k})">${l}</button>`).join('')) +
    group('Speed', SPEEDS.map(([s, l]) => `<button type="button" data-speed="${s}">${l}</button>`).join('')) +
    group('Options', `<button type="button" id="optNature" aria-pressed="true">Nature strikes</button><button type="button" id="optAssist" aria-pressed="true">Blue god helps</button><button type="button" id="optQuality" aria-pressed="true">Graphics: High</button><button type="button" id="optRival" aria-pressed="false">Rival: Normal</button><button type="button" id="optSound" title="Sound on or off (key M)">Sound</button><button type="button" id="optMusic">Music</button><button type="button" id="optSaves" title="Save or load a game">Save / Load</button>`);
  const sync = () => {
    bar.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === ui.tool));
    bar.querySelectorAll('[data-cmd]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cmd === tribes.blue.mode));
    const rv = document.getElementById('optRival'); rv.textContent = 'Rival: ' + ctx.rival[0].toUpperCase() + ctx.rival.slice(1);
    bar.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === ctx.speed));
    document.getElementById('optNature').setAttribute('aria-pressed', !!ctx.randomDisasters);
    document.getElementById('optAssist').setAttribute('aria-pressed', tribes.blue.ai);
    const sd = document.getElementById('optSound'); sd.textContent = audio.sound ? 'Sound: On' : 'Sound: Off'; sd.setAttribute('aria-pressed', audio.sound);
    const mu = document.getElementById('optMusic'); mu.textContent = audio.music ? 'Music: On' : 'Music: Off'; mu.setAttribute('aria-pressed', audio.music);
    const q = document.getElementById('optQuality');
    q.textContent = ctx.quality === 'high' ? 'Graphics: High' : 'Graphics: Fast';
    q.setAttribute('aria-pressed', ctx.quality === 'high');
  };
  const command = id => { setMode('blue', id); ctx.log({ settle: 'Your tribe returns to settling', gather: 'Your tribe gathers at the flag', attack: 'Your tribe <b>attacks!</b>' }[id]); sync(); };
  ui.sync = () => sync();
  const setTool = id => { if (id === 'flood') { onFlood(); return; } ui.tool = id; sync(); };
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    ctx.sound?.('click');
    if (b.dataset.tool) setTool(b.dataset.tool);
    if (b.id === 'findHome') findHome();
    if (b.id === 'optSound') setSound(!audio.sound);
    if (b.id === 'optMusic') setMusic(!audio.music);
    if (b.id === 'optSaves') openSaves();
    if (b.dataset.speed) ctx.speed = +b.dataset.speed;
    if (b.dataset.cmd) command(b.dataset.cmd);
    if (b.id === 'optRival') { ctx.rival = RIVALS[(RIVALS.indexOf(ctx.rival) + 1) % 3]; ctx.log(`The rival god is now ${ctx.rival}`); }
    if (b.id === 'optNature') ctx.randomDisasters = !ctx.randomDisasters;
    if (b.id === 'optAssist') tribes.blue.ai = !tribes.blue.ai;
    if (b.id === 'optQuality') { ctx.quality = ctx.quality === 'high' ? 'fast' : 'high'; ctx.applyQuality(); }
    sync();
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const t = TOOLS.find(t => t[2] === e.key);
    if (t) setTool(t[0]);
    if (e.key === '7') setTool('flag');
    const c = COMMANDS.find(c => c[2] === e.key);
    if (c) command(c[0]);
    if (e.key === ' ') { ctx.speed = ctx.speed ? 0 : 1; e.preventDefault(); sync(); }
    if (e.key === 'h' || e.key === 'H') findHome();
    if (e.key === 'm' || e.key === 'M') { setSound(!audio.sound); sync(); }
    if (e.key === 'Escape') document.getElementById('saves').hidden = true;
  });
  sync();

  // Victory and defeat
  ctx.onGameOver = result => {
    const o = document.getElementById('overlay');
    o.querySelector('h2').textContent = result === 'victory' ? 'Victory' : 'Defeat';
    o.querySelector('p').textContent = result === 'victory' ? 'The Red tribe has been wiped from the island. Your people rule it now.' : 'The Blue tribe is gone. The Red tribe rules the island.';
    o.className = result;
    o.hidden = false;
  };
  document.getElementById('keepWatching').addEventListener('click', () => { document.getElementById('overlay').hidden = true; });
  document.getElementById('newIsland').addEventListener('click', () => restartWith({ seed: Math.floor(Math.random() * 1e6) }));

  // Save / load dialog
  const saves = document.getElementById('saves');
  const renderSaves = () => {
    document.getElementById('savesList').innerHTML = !storageOK
      ? '<p class="small">This browser is blocking storage (for example in a private window), so games can\'t be saved here.</p>'
      : SLOTS.map(slot => {
        const d = readSlot(slot), name = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
        return `<div class="slot"><div class="info"><b>${name}</b><span class="small">${describe(d)}</span></div><div class="btns">
          ${slot !== 'auto' ? `<button type="button" data-save="${slot}">Save here</button>` : ''}
          ${d ? `<button type="button" data-load="${slot}" class="primary">Load</button><button type="button" data-del="${slot}">Delete</button>` : ''}</div></div>`;
      }).join('');
  };
  function openSaves() { renderSaves(); saves.hidden = false; }
  saves.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === saves || b?.id === 'closeSaves') { saves.hidden = true; return; }
    if (!b) return;
    ctx.sound?.('click');
    if (b.dataset.save) { if (saveTo(b.dataset.save)) ctx.log(`Game saved to slot ${b.dataset.save}`); else ctx.log('Saving failed: the browser refused to store the game'); renderSaves(); }
    if (b.dataset.load) restartWith({ load: b.dataset.load });
    if (b.dataset.del) { deleteSlot(b.dataset.del); renderSaves(); }
    if (b.id === 'savesNew') restartWith({ seed: Math.floor(Math.random() * 1e6) });
  });

  function findHome() {
    const c = blueCentre();
    if (!c) return;
    const off = ctx.camera.position.clone().sub(ctx.controls.target);
    ctx.controls.target.set(c.x, c.y, c.z);
    ctx.camera.position.copy(c).add(off.setLength(Math.min(off.length(), 16)));
    ui.markerUntil = ctx.realTime + 6;
  }

  const log = document.getElementById('log');
  ctx.log = html => {
    const d = document.createElement('div');
    d.className = 'entry';
    d.innerHTML = html;
    log.prepend(d);
    while (log.children.length > 5) log.lastChild.remove();
    setTimeout(() => d.classList.add('old'), 12000);
  };
}

function blueCentre() {
  const bs = [...buildings].filter(b => b.tribe === 'blue');
  if (!bs.length) return null;
  const x = bs.reduce((s, b) => s + b.cx, 0) / bs.length, z = bs.reduce((s, b) => s + b.cz, 0) / bs.length;
  const b = bs.reduce((best, b) => Math.hypot(b.cx - x, b.cz - z) < Math.hypot(best.cx - x, best.cz - z) ? b : best);
  return new THREE.Vector3(b.cx, b.group.position.y + b.design.height + 0.15, b.cz);
}
// A floating "You" marker over your village for the first minute (and when you press H).
const _p = new THREE.Vector3();
export function updateMarker() {
  const el = document.getElementById('youMarker');
  const c = ctx.realTime < ui.markerUntil ? blueCentre() : null;
  if (!c) { el.hidden = true; return; }
  _p.copy(c).project(ctx.camera);
  if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) { el.hidden = true; return; }
  el.hidden = false;
  el.style.transform = `translate(${((_p.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - _p.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  el.style.opacity = Math.min(1, ui.markerUntil - ctx.realTime).toFixed(2);
}

export function updateHUD() {
  const hud = document.getElementById('hud');
  const f = (ctx.time / SEASON_LENGTH) % 1;
  let html = `<div class="season"><span>${season.name}</span><span class="year">Year ${season.year}</span></div><div class="bar season-bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div>`;
  for (const id of Object.keys(TRIBES)) {
    const tr = tribes[id], T = TRIBES[id], next = ERAS[tr.era + 1];
    const homes = homesOf(id).filter(b => b.progress >= 1), counts = {};
    for (const b of homes) counts[b.type] = (counts[b.type] || 0) + 1;
    const civCount = {};
    for (const b of civicsOf(id)) if (b.progress >= 1) civCount[CIVICS[b.type].label] = (civCount[CIVICS[b.type].label] || 0) + 1;
    const civ = Object.entries(civCount).map(([l, n]) => n > 1 ? `${l} ×${n}` : l);
    const building = civicsOf(id).filter(b => b.progress < 1).map(b => `${CIVICS[b.type].label} (${Math.round(b.progress * 100)}%)`);
    const pct = next ? Math.min(100, (tr.score - ERAS[tr.era].score) / (next.score - ERAS[tr.era].score) * 100) : 100;
    let need = '';
    if (tr.nextCivic && !building.length) { const c = CIVICS[tr.nextCivic]; need = `<div class="need">Next: ${c.label}, needs ${c.size}×${c.size} flat land</div>`; }
    html += `<div class="tribe">
      <div class="thead"><span><b style="color:${T.css}">${T.name} tribe</b>${id === 'blue' ? '<span class="badge you">You</span>' : '<span class="badge rival">Rival</span>'}</span><span class="era">${ERAS[tr.era].name} Age</span></div>
      <div class="bar"><i style="width:${pct.toFixed(0)}%;background:${T.css}"></i></div>
      <div class="small">${next ? `Prosperity ${tr.score} / ${next.score} for the ${next.name} Age` : `Prosperity ${tr.score}, the greatest age`}</div>
      <div class="small">${population(id)} walkers · ${townsfolk(id)} townsfolk · ${Object.entries(counts).map(([k, n]) => `${n} ${n === 1 ? LABELS[k].replace(/s$/, '').replace(/ rows?$/, ' row') : LABELS[k]}`).join(' · ') || 'no homes'}</div>
      <div class="small war ${tr.mode}">${MODE_TEXT[tr.mode]} · army ${army(id).length}, strength ${Math.round(army(id).reduce((s, v) => s + power(v), 0))}${tr.leader?.parent ? ' · has a Leader' : ''}</div>
      ${civ.length ? `<div class="small">Landmarks: ${civ.join(', ')}</div>` : ''}
      ${building.length ? `<div class="small">Building: ${building.join(', ')}</div>` : need}
    </div>`;
  }
  hud.innerHTML = html;
}
