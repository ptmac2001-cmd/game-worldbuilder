// On-screen UI: toolbar (tools, disasters, speed), status panel and event log.
import { ctx } from '../ctx.js';
import { ERAS, CIVICS, TRIBES, SEASON_LENGTH } from '../config.js';
import { season } from '../view/sky.js';
import { tribes, homesOf, civicsOf, LABELS } from '../game/settlements.js';
import { population, townsfolk } from '../game/villagers.js';
import { setMode, army, power } from '../game/conflict.js';

export const ui = { tool: 'raise' };
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
    group('Your tribe', `<button type="button" data-tool="flag" title="Plant your rally flag (key 7)">Place flag</button>` + COMMANDS.map(([id, l, k]) => `<button type="button" data-cmd="${id}" class="cmd" title="${l} (key ${k})">${l}</button>`).join('')) +
    group('Speed', SPEEDS.map(([s, l]) => `<button type="button" data-speed="${s}">${l}</button>`).join('')) +
    group('Options', `<button type="button" id="optNature" aria-pressed="true">Nature strikes</button><button type="button" id="optAssist" aria-pressed="true">Blue god helps</button><button type="button" id="optQuality" aria-pressed="true">Graphics: High</button><button type="button" id="optRival" aria-pressed="false">Rival: Normal</button>`);
  const sync = () => {
    bar.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === ui.tool));
    bar.querySelectorAll('[data-cmd]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cmd === tribes.blue.mode));
    const rv = document.getElementById('optRival'); rv.textContent = 'Rival: ' + ctx.rival[0].toUpperCase() + ctx.rival.slice(1);
    bar.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === ctx.speed));
    document.getElementById('optNature').setAttribute('aria-pressed', !!ctx.randomDisasters);
    document.getElementById('optAssist').setAttribute('aria-pressed', tribes.blue.ai);
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
    if (b.dataset.tool) setTool(b.dataset.tool);
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
  document.getElementById('newIsland').addEventListener('click', () => { location.search = '?seed=' + Math.floor(Math.random() * 1e6); });

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
      <div class="thead"><b style="color:${T.css}">${T.name} tribe</b><span class="era">${ERAS[tr.era].name} Age</span></div>
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
