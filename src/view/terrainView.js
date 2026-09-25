// The visible landscape: a smooth, detailed mesh built from the simulation
// grid and painted by a procedural shader (grass, rock, snow, fields, streets,
// lava) that also follows the seasons.
import * as THREE from 'three';
import { N, SUB, R, STEP, SEA } from '../config.js';
import { corners } from '../sim/terrain.js';
import { fbm, smooth } from '../rng.js';
import { U, GLSL_NOISE } from '../ctx.js';

export const tgt = new Float32Array(R * R);
export const cur = new Float32Array(R * R);
const work = new Float32Array(R * R), work2 = new Float32Array(R * R), detailN = new Float32Array(R * R);
for (let rz = 0; rz < R; rz++) for (let rx = 0; rx < R; rx++) detailN[rz * R + rx] = fbm(rx / SUB * 0.9, rz / SUB * 0.9, 4) - 0.5;

// Land use per tile: 0 wild, 1 field, 2 pasture, 3 paved street.
export const LAND = { WILD: 0, FIELD: 1, PASTURE: 2, PAVED: 3 };
const tileData = new Uint8Array(N * N * 4);
export const tileTex = new THREE.DataTexture(tileData, N, N, THREE.RGBAFormat);
// Disaster marks per tile (smoothly filtered): molten lava, cooled basalt, cracks.
export const lava = { molten: new Float32Array(N * N), basalt: new Float32Array(N * N), cracks: new Float32Array(N * N) };
const lavaData = new Uint8Array(N * N * 4);
export const lavaTex = new THREE.DataTexture(lavaData, N, N, THREE.RGBAFormat);
lavaTex.magFilter = lavaTex.minFilter = THREE.LinearFilter;
const hData = new Uint8Array(R * R * 4);
export const hTex = new THREE.DataTexture(hData, R, R, THREE.RGBAFormat);
hTex.magFilter = hTex.minFilter = THREE.LinearFilter;

export function setLand(ti, type, variant, orient) {
  tileData[ti * 4] = type * 60; tileData[ti * 4 + 1] = variant; tileData[ti * 4 + 2] = orient ? 255 : 0;
}
export function commitLand() { tileTex.needsUpdate = true; }
export function commitLava() {
  for (let i = 0; i < N * N; i++) {
    lavaData[i * 4] = Math.min(255, lava.molten[i] * 255);
    lavaData[i * 4 + 1] = Math.min(255, lava.basalt[i] * 255);
    lavaData[i * 4 + 2] = Math.min(255, lava.cracks[i] * 255);
  }
  lavaTex.needsUpdate = true;
}

function blur(src, dst, rx0 = 0, rx1 = R - 1, rz0 = 0, rz1 = R - 1) {
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const i = rz * R + rx;
    if (rx === rx0 || rz === rz0 || rx === rx1 || rz === rz1) { dst[i] = src[i]; continue; }
    dst[i] = (src[i] * 4 + src[i - 1] + src[i + 1] + src[i - R] + src[i + R]) / 8;
  }
}
// Recompute render heights, optionally only inside a tile-space box [x0, x1] × [z0, z1].
export function computeTarget(box = null) {
  const pad = 3 * SUB;
  const rx0 = box ? Math.max(0, box[0] * SUB - pad) : 0, rx1 = box ? Math.min(R - 1, box[1] * SUB + pad) : R - 1;
  const rz0 = box ? Math.max(0, box[2] * SUB - pad) : 0, rz1 = box ? Math.min(R - 1, box[3] * SUB + pad) : R - 1;
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const gx = rx / SUB, gz = rz / SUB;
    const x0 = Math.min(N - 1, Math.floor(gx)), z0 = Math.min(N - 1, Math.floor(gz)), fx = gx - x0, fz = gz - z0;
    const [a, b, c, d] = corners(x0, z0);
    const hb = (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
    let y = hb * STEP - 0.34 * (1 - smooth(0, 1, hb));
    y -= 0.6 * (1 - smooth(0, 6, Math.min(gx, gz, N - gx, N - gz)));
    work[rz * R + rx] = y;
  }
  blur(work, work2, rx0, rx1, rz0, rz1); blur(work2, work, rx0, rx1, rz0, rz1);
  const m = box ? 2 : 0;
  for (let rz = rz0 + (rz0 ? m : 0); rz <= rz1 - (rz1 < R - 1 ? m : 0); rz++) for (let rx = rx0 + (rx0 ? m : 0); rx <= rx1 - (rx1 < R - 1 ? m : 0); rx++) {
    const i = rz * R + rx;
    const xm = Math.max(0, rx - 1), xp = Math.min(R - 1, rx + 1), zm = Math.max(0, rz - 1), zp = Math.min(R - 1, rz + 1);
    const g = (Math.abs(work[rz * R + xp] - work[rz * R + xm]) + Math.abs(work[zp * R + rx] - work[zm * R + rx])) * SUB / STEP;
    const amp = 0.05 + 0.1 * Math.min(1, g) + Math.max(0, work[i] - 3.2) * 0.18;
    tgt[i] = work[i] + detailN[i] * amp;
  }
}

const tPos = new Float32Array(R * R * 3);
for (let rz = 0; rz < R; rz++) for (let rx = 0; rx < R; rx++) { const i = rz * R + rx; tPos[i * 3] = rx / SUB - N / 2; tPos[i * 3 + 2] = rz / SUB - N / 2; }
const tIdx = new Uint32Array((R - 1) * (R - 1) * 6);
{ let k = 0; for (let rz = 0; rz < R - 1; rz++) for (let rx = 0; rx < R - 1; rx++) { const a = rz * R + rx, b = a + 1, c = a + R, d = c + 1; tIdx.set([a, c, b, b, c, d], k); k += 6; } }
const tGeo = new THREE.BufferGeometry();
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));

const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
mat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, { tileTex: { value: tileTex }, lavaTex: { value: lavaTex }, uN: { value: N }, uSea: { value: SEA }, uSeason: U.uSeason, uSnow: U.uSnow, uTime: U.uTime });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2D tileTex, lavaTex; uniform float uN, uSea, uSnow, uTime; uniform vec4 uSeason;
      varying vec3 vWPos; varying vec3 vWNrm; float lavaGlow = 0.0;
      ${GLSL_NOISE}`)
    .replace('#include <color_fragment>', `
      vec3 nn = normalize(vWNrm);
      float slope = 1.0 - nn.y;
      vec2 p = vWPos.xz; float y = vWPos.y;
      float n1 = fb(p * 0.35), n2 = fb(p * 1.7), n3 = vn(p * 9.0), n4 = vn(p * 31.0);
      vec4 S = uSeason;
      vec3 gSpring = mix(vec3(0.36, 0.60, 0.20), vec3(0.54, 0.72, 0.27), n1);
      vec3 gSummer = mix(vec3(0.31, 0.53, 0.19), vec3(0.50, 0.66, 0.25), n1);
      vec3 gAutumn = mix(vec3(0.37, 0.50, 0.20), vec3(0.52, 0.56, 0.25), n1);
      vec3 gWinter = mix(vec3(0.40, 0.43, 0.30), vec3(0.52, 0.50, 0.37), n1);
      vec3 grass = gSpring * S.x + gSummer * S.y + gAutumn * S.z + gWinter * S.w;
      grass = mix(grass, vec3(0.66, 0.64, 0.34), smoothstep(0.62, 0.85, n2) * (0.35 + 0.4 * S.y));
      grass = mix(grass, vec3(0.21, 0.40, 0.15), smoothstep(0.6, 0.9, 1.0 - n2) * 0.4 * (1.0 - S.w));
      grass *= 0.86 + 0.2 * n3 + 0.1 * n4;
      float bloom = step(0.9, vn(p * 38.0)) * smoothstep(0.4, 0.7, n2) * (S.x + 0.4 * S.y);
      grass = mix(grass, mix(vec3(1.0, 0.95, 0.7), vec3(0.95, 0.6, 0.8), step(0.5, vn(p * 5.0))), bloom * 0.8);
      vec3 dirt = mix(vec3(0.52, 0.40, 0.25), vec3(0.40, 0.30, 0.20), n2) * (0.85 + 0.3 * n4);
      vec3 sand = mix(vec3(0.89, 0.81, 0.59), vec3(0.80, 0.72, 0.52), n2) * (0.92 + 0.16 * n4);
      vec3 rock = mix(vec3(0.44, 0.42, 0.40), vec3(0.62, 0.60, 0.56), n2) * (0.72 + 0.35 * n3 + 0.12 * n4);
      vec3 snow = vec3(0.94, 0.96, 0.99) * (0.94 + 0.06 * n4);
      vec3 col = grass;
      col = mix(col, dirt, smoothstep(0.14, 0.28, slope + (n2 - 0.5) * 0.18) * 0.45);
      col = mix(col, rock, smoothstep(0.30, 0.44, slope + (n1 - 0.5) * 0.2));
      float rockLine = 3.5 + (n1 - 0.5) * 0.8;
      col = mix(col, rock, smoothstep(rockLine, rockLine + 0.7, y + (n2 - 0.5) * 0.9));
      float sandLine = uSea + 0.15 + (n1 - 0.5) * 0.14;
      col = mix(sand, col, smoothstep(sandLine - 0.04, sandLine + 0.06, y));

      vec2 gp = p + uN * 0.5;
      vec4 td = texture2D(tileTex, gp / uN);
      float land = floor(td.r * 255.0 / 60.0 + 0.5);
      vec2 lp = fract(gp);
      float edge = smoothstep(0.02, 0.08, lp.x) * smoothstep(0.98, 0.92, lp.x) * smoothstep(0.02, 0.08, lp.y) * smoothstep(0.98, 0.92, lp.y);
      if (land > 0.5 && land < 1.5) {
        float along = td.b > 0.5 ? lp.x : lp.y;
        float furrow = smoothstep(0.25, 0.75, abs(fract(along * 7.0) - 0.5) * 2.0);
        vec3 soil = vec3(0.46, 0.33, 0.21) * (0.85 + 0.3 * n4);
        vec3 ripe = td.g < 85.0 / 255.0 ? vec3(0.86, 0.73, 0.31) : (td.g < 170.0 / 255.0 ? vec3(0.44, 0.64, 0.22) : vec3(0.74, 0.64, 0.30));
        ripe *= 0.82 + 0.3 * n4 + 0.1 * n3;
        vec3 sprout = vec3(0.42, 0.63, 0.22) * (0.85 + 0.3 * n4);
        vec3 stubble = vec3(0.74, 0.63, 0.37) * (0.85 + 0.3 * n4);
        vec3 field = mix(sprout, soil, furrow * 0.9) * S.x + mix(ripe, soil, furrow * 0.5) * S.y
                   + mix(stubble, soil, furrow * 0.6) * S.z + mix(soil * 0.9, soil * 0.7, furrow) * S.w;
        col = mix(col, field, edge);
      } else if (land > 1.5 && land < 2.5) {
        vec3 lush = grass * vec3(0.92, 1.02, 0.9);
        vec3 trodden = mix(lush, dirt, smoothstep(0.62, 0.85, vn(p * 3.3)) * 0.6);
        col = mix(col, trodden, smoothstep(0.0, 0.05, lp.x) * smoothstep(1.0, 0.95, lp.x) * smoothstep(0.0, 0.05, lp.y) * smoothstep(1.0, 0.95, lp.y));
      } else if (land > 2.5) {
        vec2 cp = p * 9.0; cp.x += floor(cp.y) * 0.5;
        vec2 cf = fract(cp), ci = floor(cp);
        float stone = smoothstep(0.0, 0.14, cf.x) * smoothstep(1.0, 0.86, cf.x) * smoothstep(0.0, 0.18, cf.y) * smoothstep(1.0, 0.82, cf.y);
        vec3 cob = mix(vec3(0.56, 0.53, 0.48), vec3(0.72, 0.68, 0.60), hh(ci)) * (0.92 + 0.12 * n4);
        vec3 paved = mix(vec3(0.34, 0.32, 0.29), cob, stone);
        col = mix(col, paved, smoothstep(0.0, 0.015, lp.x) * smoothstep(1.0, 0.985, lp.x) * smoothstep(0.0, 0.015, lp.y) * smoothstep(1.0, 0.985, lp.y));
      }

      vec4 lv = texture2D(lavaTex, gp / uN);
      col = mix(col, vec3(0.17, 0.15, 0.14) * (0.75 + 0.4 * n3 + 0.2 * n4), smoothstep(0.05, 0.4, lv.g));
      float flow = vn(p * 2.6 + vec2(uTime * 0.06, -uTime * 0.04)) * 0.7 + vn(p * 7.0 - uTime * 0.05) * 0.3;
      float veins = smoothstep(0.1, 0.0, abs(flow - 0.5));
      vec3 crust = vec3(0.10, 0.07, 0.06) * (0.7 + 0.5 * n4);
      col = mix(col, crust, smoothstep(0.0, 0.2, lv.r));
      float hot = smoothstep(0.35, 0.9, lv.r);
      col = mix(col, vec3(0.9, 0.35, 0.08), veins * lv.r);
      lavaGlow = lv.r * (0.04 + veins * (0.6 + 0.8 * hot)) + hot * 0.25 * smoothstep(0.6, 0.2, abs(flow - 0.5));
      float crack = lv.b * smoothstep(0.06, 0.0, abs(vn(p * 5.0) - 0.5)) ;
      col = mix(col, vec3(0.07, 0.05, 0.04), crack);

      float snowLine = 5.0 - uSnow * 1.2 + (n1 - 0.5) * 0.6;
      col = mix(col, snow, smoothstep(snowLine, snowLine + 0.2, y) * (1.0 - smoothstep(0.38, 0.55, slope)));
      float cover = uSnow * smoothstep(0.3, 0.6, n2 * 0.7 + 0.35 + uSnow * 0.35 - slope * 1.4) * smoothstep(uSea + 0.02, uSea + 0.12, y) * (1.0 - smoothstep(0.02, 0.1, lv.r));
      col = mix(col, snow, cover);
      col *= mix(0.62, 1.0, smoothstep(uSea - 0.03, uSea + 0.03, y));
      diffuseColor.rgb = pow(col, vec3(2.2));`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(5.0, 1.4, 0.25) * lavaGlow;');
};
export const terrain = new THREE.Mesh(tGeo, mat);
terrain.castShadow = terrain.receiveShadow = true;

export function applyHeights() {
  for (let i = 0; i < R * R; i++) {
    tPos[i * 3 + 1] = cur[i];
    hData[i * 4] = Math.max(0, Math.min(255, Math.round((cur[i] + 1.2) / 10 * 255)));
  }
  tGeo.attributes.position.needsUpdate = true;
  tGeo.computeVertexNormals();
  tGeo.computeBoundingSphere();
  hTex.needsUpdate = true;
}

// Ease the visible terrain toward the simulation. Returns true while moving.
export function stepHeights(dt) {
  let maxd = 0;
  const k = Math.min(1, dt * 7);
  for (let i = 0; i < R * R; i++) { const d = tgt[i] - cur[i]; cur[i] += d * k; if (Math.abs(d) > maxd) maxd = Math.abs(d); }
  if (maxd < 0.003) cur.set(tgt);
  applyHeights();
  return maxd >= 0.003;
}

export function heightAt(px, pz) {
  const gx = Math.min(R - 1.001, Math.max(0, (px + N / 2) * SUB)), gz = Math.min(R - 1.001, Math.max(0, (pz + N / 2) * SUB));
  const x = Math.floor(gx), z = Math.floor(gz), fx = gx - x, fz = gz - z, i = z * R + x;
  return (cur[i] * (1 - fx) + cur[i + 1] * fx) * (1 - fz) + (cur[i + R] * (1 - fx) + cur[i + R + 1] * fx) * fz;
}

export function initTerrain(scene) {
  computeTarget();
  cur.set(tgt);
  applyHeights();
  commitLava();
  scene.add(terrain);
  const seabed = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x9c8a62, roughness: 1 }));
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = -0.95;
  scene.add(seabed);
}
