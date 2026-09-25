// Sky dome, sun, clouds, seasons and weather (snowfall and rain).
import * as THREE from 'three';
import { SEASON_LENGTH, SEASONS } from '../config.js';
import { U, ctx, srgb } from '../ctx.js';
import { rnd, smooth } from '../rng.js';
import { part, merge, blob } from './geometry.js';
import { waterUniforms } from './water.js';

// Per-season atmosphere: sky zenith, horizon, sun colour, sun strength, hemisphere sky, ground.
const ATMOS = [
  { zenith: 0x5aa0dc, horizon: 0xd8ecf2, sun: 0xfff0d0, sunI: 2.6, hemi: 0xd6ecff, ground: 0x62763e },
  { zenith: 0x4f98da, horizon: 0xd2e8f4, sun: 0xffe4b8, sunI: 2.8, hemi: 0xcfe4ff, ground: 0x5d6b3a },
  { zenith: 0x6b9cc8, horizon: 0xe6dcc8, sun: 0xffc98a, sunI: 2.4, hemi: 0xe8dcc8, ground: 0x6b5a3a },
  { zenith: 0x7fa2c4, horizon: 0xdfe6ee, sun: 0xeef2ff, sunI: 2.0, hemi: 0xe4ecf6, ground: 0x8a8f96 },
];
const STORM = { zenith: 0x4a5560, horizon: 0x8a949c, sun: 0x9aa4ae, sunI: 0.6, hemi: 0x7a848e, ground: 0x3a4038 };

export const SUN_DIR = new THREE.Vector3(-0.62, 0.55, 0.36).normalize();
let sky, sun, hemi, clouds = [], cloudMat, snow, rain;
const skyU = { top: { value: new THREE.Vector3() }, horizon: { value: new THREE.Vector3() }, sunDir: { value: SUN_DIR } };

export const season = { index: 0, year: 1, name: 'Spring', weights: [1, 0, 0, 0] };
let storm = 0, stormTarget = 0;
export function setStorm(v) { stormTarget = v; }

export function initSky(scene) {
  sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top, horizon, sunDir; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(horizon, top, smoothstep(0.0, 0.45, d.y));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.85, 0.6) * pow(s, 10.0) * 0.25 + vec3(1.0, 0.96, 0.85) * pow(s, 900.0) * 3.0;
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5d6b3a, 1.1);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe4bd, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  ctx.sun = sun;
  waterUniforms.sunDir.value = SUN_DIR;

  cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0xc8d4e0, emissiveIntensity: 0.45 });
  for (let i = 0; i < 16; i++) {
    const P = [], n = 5 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) P.push(part(blob(0.9 + rnd() * 1.3, 1, 0.12), 0xffffff, (k - n / 2) * 1.1 + rnd() * 0.6, rnd() * 0.5, (rnd() - 0.5) * 1.6, 0, 0, 0, { jitter: 0 }));
    const c = new THREE.Mesh(merge(P), cloudMat);
    c.scale.set(1.7, 0.8, 1.7);
    c.position.set(-90 + rnd() * 180, 32 + rnd() * 6, -80 + rnd() * 160);
    c.rotation.y = rnd() * Math.PI;
    c.castShadow = true;
    clouds.push(c); scene.add(c);
  }

  // Snowfall: soft round flakes around the camera target.
  const SN = 4000, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = (rnd() - 0.5) * 60; sp[i * 3 + 1] = rnd() * 25; sp[i * 3 + 2] = (rnd() - 0.5) * 60; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g2 = cv.getContext('2d'), grd = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, 32, 32);
  snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.12, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0 }));
  snow.frustumCulled = false;
  scene.add(snow);
  // Rain: short streaks.
  const RN = 3000, rp = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = (rnd() - 0.5) * 60, y = rnd() * 25, z = (rnd() - 0.5) * 60; rp.set([x, y, z, x + 0.05, y - 0.45, z + 0.02], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaabbd0, transparent: true, opacity: 0 }));
  rain.frustumCulled = false;
  scene.add(rain);
}

const cB = new THREE.Color(), tmp = new THREE.Color();
function blendHex(key) {
  const w = season.weights, cA = new THREE.Color(0, 0, 0);
  ATMOS.forEach((a, i) => { tmp.setHex(a[key]); cA.r += tmp.r * w[i]; cA.g += tmp.g * w[i]; cA.b += tmp.b * w[i]; });
  cB.setHex(STORM[key]);
  return cA.lerp(cB, storm);
}
const toVec = (c, v) => { const s = c.clone().convertLinearToSRGB(); return v.set(s.r, s.g, s.b); };

export function updateSky(dt) {
  // Seasons: weights blend smoothly into the next season near the end of each one.
  const s = ctx.time / SEASON_LENGTH, base = Math.floor(s) % 4, f = s - Math.floor(s), b = smooth(0.8, 1, f);
  const w = [0, 0, 0, 0]; w[base] += 1 - b; w[(base + 1) % 4] += b;
  season.weights = w; season.index = base; season.name = SEASONS[base]; season.year = Math.floor(s / 4) + 1;
  U.uSeason.value.set(w[0], w[1], w[2], w[3]);
  // Snow builds up through winter and melts in early spring.
  const snowTarget = w[3] > 0.5 ? Math.min(1, (f + (base === 3 ? 0 : 1)) * 3) : 0;
  U.uSnow.value += ((base === 3 ? snowTarget : 0) - U.uSnow.value) * Math.min(1, dt * 0.35);
  storm += (stormTarget - storm) * Math.min(1, dt * 1.2);
  U.uStorm.value = storm;

  toVec(blendHex('zenith'), skyU.top.value);
  const hz = blendHex('horizon');
  toVec(hz, skyU.horizon.value);
  ctx.scene.fog.color.copy(hz);
  ctx.renderer.setClearColor(hz);
  toVec(hz, waterUniforms.fogColor.value);
  toVec(blendHex('zenith').lerp(hz, 0.6), waterUniforms.skyColor.value);
  sun.color.copy(blendHex('sun'));
  sun.intensity = ATMOS.reduce((a, x, i) => a + x.sunI * w[i], 0) * (1 - storm) + STORM.sunI * storm;
  hemi.color.copy(blendHex('hemi'));
  hemi.groundColor.copy(blendHex('ground'));
  cloudMat.color.setRGB(1, 1, 1).lerp(tmp.setHex(0x6a737c), storm);
  cloudMat.emissiveIntensity = 0.45 * (1 - storm);

  for (const c of clouds) { c.position.x += dt * (0.5 + storm * 3); if (c.position.x > 95) c.position.x = -95; c.position.y = 32 + (c.id % 6) - storm * 12; }

  // Weather particles follow the camera target.
  const t = ctx.controls.target;
  const snowing = w[3] * (1 - smooth(0.7, 1, f) * (base === 3 ? 1 : 0)) * 0.9;
  snow.material.opacity = snowing;
  snow.visible = snowing > 0.02;
  if (snow.visible) {
    const p = snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 1.2;
      if (y < 0) y += 25;
      p.setXYZ(i, p.getX(i) + Math.sin(ctx.realTime + i) * dt * 0.2, y, p.getZ(i));
    }
    p.needsUpdate = true;
    snow.position.set(Math.round(t.x), 0, Math.round(t.z));
  }
  rain.material.opacity = storm * 0.55;
  rain.visible = storm > 0.02;
  if (rain.visible) {
    const p = rain.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 2) {
      let y = p.getY(i) - dt * 22;
      if (y < 0) y += 25;
      p.setY(i, y); p.setY(i + 1, y - 0.45);
    }
    p.needsUpdate = true;
    rain.position.set(Math.round(t.x), 0, Math.round(t.z));
  }
}
