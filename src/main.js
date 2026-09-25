// Entry point: sets up rendering, builds the world and runs the game loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { N, SEA } from './config.js';
import { ctx, U } from './ctx.js';
import { setSeed } from './rng.js';
import * as T from './sim/terrain.js';
import { initTerrain, computeTarget, stepHeights, heightAt, terrain } from './view/terrainView.js';
import { initWater } from './view/water.js';
import { initSky, updateSky } from './view/sky.js';
import { initParticles, updateParticles, dustBurst } from './view/particles.js';
import { initVegetation, refreshVegetation, clearRocks } from './view/vegetation.js';
import { tileOwner, land, validateBuildings, updateBuildingHeights, updateSettlements, foundTribes, recomputeLand } from './game/settlements.js';
import { spawnMany, callWorkers, updateVillagers, homeSpawn } from './game/villagers.js';
import { syncAnimals, updateAnimals } from './game/animals.js';
import { earthquake, volcano, tornado, flood, updateDisasters } from './game/disasters.js';
import { initUI, updateHUD, ui } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6e9f2, 60, 170);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(14, 12, 21);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.25, minDistance: 3, maxDistance: 75, screenSpacePanning: false });
controls.target.set(0, 1.2, 1);
if (params.get('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }
Object.assign(ctx, { scene, camera, renderer, controls, randomDisasters: params.get('nature') !== 'off', speed: +(params.get('speed') ?? 1) });
if (params.get('time')) ctx.time = +params.get('time');

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
// Graphics quality: High adds ambient occlusion and sharper shadows. Small or touch screens start on Fast.
ctx.quality = params.get('quality') ?? (matchMedia('(pointer: coarse)').matches || innerWidth < 800 ? 'fast' : 'high');
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.0 });
gtao.blendIntensity = 0.8;
composer.addPass(gtao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.45, 0.9));
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Build the world
// ---------------------------------------------------------------------------
setSeed(+(params.get('seed') ?? 1989));
T.generate();
initTerrain(scene);
initWater(scene);
initSky(scene);
initParticles(scene);
initVegetation(scene);

let animating = false;
const blocked = ti => tileOwner.has(ti) || land[ti] !== 0;
ctx.refreshVegetation = () => refreshVegetation(blocked);
ctx.spawnVillager = (tribe, x, z, n = 1) => spawnMany(tribe, x, z, n);
ctx.callWorkers = callWorkers;
ctx.homeSpawn = homeSpawn;
ctx.onLandChanged = () => { syncAnimals(); ctx.refreshVegetation(); };
ctx.onTerrainEdited = (verts, opts = {}) => {
  if (opts.clearRocks) for (const [x, z] of verts) for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (T.inGrid(x + dx, z + dz)) clearRocks(x + dx, z + dz);
  let box = [N, 0, N, 0];
  for (const [x, z] of verts) box = [Math.min(box[0], x - 8), Math.max(box[1], x + 8), Math.min(box[2], z - 8), Math.max(box[3], z + 8)];
  computeTarget(verts.length > 20 ? null : box);
  animating = true;
  validateBuildings();
};
ctx.applyQuality = () => {
  const high = ctx.quality === 'high';
  gtao.enabled = high;
  renderer.setPixelRatio(high ? Math.min(2, devicePixelRatio || 1) : 1);
  composer.setPixelRatio(high ? Math.min(2, devicePixelRatio || 1) : 1);
  composer.setSize(innerWidth, innerHeight);
  ctx.sun.shadow.mapSize.set(high ? 4096 : 2048, high ? 4096 : 2048);
  ctx.sun.shadow.map?.dispose(); ctx.sun.shadow.map = null;
};
initUI({ onFlood: () => flood() });
ctx.applyQuality();
foundTribes();
recomputeLand();

// Testing aid: ?warp=SECONDS fast-forwards the simulation before the first frame.
const warp = +(params.get('warp') ?? 0);
const warpStart = performance.now();
for (let t = 0, snap = 0; t < warp; t += 0.1, snap += 0.1) {
  ctx.time += 0.1;
  updateSettlements(0.1); updateVillagers(0.1); updateAnimals(0.1); updateDisasters(0.1); updateSky(0.1);
  if (animating && snap > 1) { snap = 0; while (stepHeights(1)); animating = false; updateBuildingHeights(); }
}
if (warp) { console.warn('warp ms', Math.round(performance.now() - warpStart)); while (stepHeights(1)); animating = false; updateBuildingHeights(); recomputeLand(); for (const b of [...tileOwner.values()]) if (b.progress < 1) b.progress = 0.999; }
// Testing aid: ?focus=type[,tribe][,distance] points the camera at a building.
if (params.get('focus')) {
  const [type, tribe, dist = 3.5] = params.get('focus').split(',');
  const b = [...new Set(tileOwner.values())].find(b => b.type === type && (!tribe || b.tribe === tribe));
  if (b) {
    const y = heightAt(b.cx, b.cz), d = +dist;
    controls.target.set(b.cx, y + 0.4, b.cz);
    camera.position.set(b.cx + d * 0.55, y + d * 0.62, b.cz + d * 0.85);
  }
}

// ---------------------------------------------------------------------------
// Input: hover marker and tools
// ---------------------------------------------------------------------------
const ringGeo = new THREE.RingGeometry(0.13, 0.2, 40), areaGeo = new THREE.RingGeometry(0.96, 1, 64);
const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
ring.rotation.x = -Math.PI / 2;
ring.renderOrder = 10;
ring.visible = false;
scene.add(ring);
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let lastMove = null, hoverDirty = false, down = null;
function pickVertex(e) {
  const r = canvas.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(terrain)[0];
  if (!hit) return null;
  const gx = Math.round(hit.point.x + N / 2), gz = Math.round(hit.point.z + N / 2);
  return gx > 0 && gz > 0 && gx < N && gz < N ? [gx, gz] : null;
}
canvas.addEventListener('pointermove', e => { lastMove = e; hoverDirty = true; });
canvas.addEventListener('pointerleave', () => { ring.visible = false; lastMove = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
  down = null;
  const v = pickVertex(e);
  if (!v) return;
  const [gx, gz] = v, [wx, wz] = [gx - N / 2, gz - N / 2];
  let tool = ui.tool;
  if (e.button === 2 || e.shiftKey) tool = tool === 'raise' ? 'lower' : tool === 'lower' ? 'raise' : tool;
  if (tool === 'raise' || tool === 'lower') {
    if (!T.edit(gx, gz, tool === 'raise' ? 1 : -1)) return;
    ctx.onTerrainEdited([v], { clearRocks: true });
    dustBurst(wx, heightAt(wx, wz), wz);
  } else if (tool === 'quake') earthquake(gx, gz);
  else if (tool === 'volcano') volcano(gx, gz);
  else if (tool === 'tornado') tornado(gx, gz);
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let hudT = 0;
const shakeOffset = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const frameStart = performance.now();
  const realDt = Math.min(0.05, clock.getDelta());
  ctx.realTime += realDt;
  U.uTime.value = ctx.realTime;

  let remaining = realDt * ctx.speed;
  while (remaining > 1e-6) {
    const dt = Math.min(0.05, remaining);
    remaining -= dt;
    ctx.time += dt;
    updateSettlements(dt);
    updateVillagers(dt);
    updateAnimals(dt);
    updateDisasters(dt);
  }
  updateSky(realDt * Math.max(1, ctx.speed));
  if (animating) {
    animating = stepHeights(realDt);
    ctx.refreshVegetation();
    updateBuildingHeights();
    if (!animating) recomputeLand();
  }
  updateParticles(ctx.speed ? realDt * Math.min(ctx.speed, 2) : 0, heightAt);

  if (hoverDirty && lastMove) {
    hoverDirty = false;
    const v = pickVertex(lastMove);
    ring.visible = !!v;
    if (v) {
      const x = v[0] - N / 2, z = v[1] - N / 2, big = ui.tool !== 'raise' && ui.tool !== 'lower';
      ring.position.set(x, Math.max(heightAt(x, z), SEA) + 0.03, z);
      ring.geometry = big ? areaGeo : ringGeo;
      ring.scale.setScalar(big ? 4.5 : 1);
      ring.material.color.setHex(big ? 0xff8a5a : 0xffffff);
    }
  }
  hudT -= realDt;
  if (hudT <= 0) { hudT = 0.3; updateHUD(); }

  camera.position.sub(shakeOffset);
  controls.update();
  ctx.shake *= Math.pow(0.1, realDt);
  shakeOffset.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.5, (Math.random() - 0.5)).multiplyScalar(ctx.shake);
  camera.position.add(shakeOffset);
  const r0 = performance.now();
  renderer.info.autoReset = false; renderer.info.reset();
  composer.render();
  if (params.get('debug')) console.warn('frame ms', Math.round(performance.now() - frameStart), 'render ms', Math.round(performance.now() - r0), 'calls', renderer.info.render.calls, 'tris', renderer.info.render.triangles);
}
frame();
