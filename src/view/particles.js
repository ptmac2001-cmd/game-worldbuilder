// Instanced particle pools: smoke, dust, debris, fire, water spray, ash.
import * as THREE from 'three';
import { smooth } from '../rng.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const pools = [];

function pool(scene, count, material, geo, o) {
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  mesh.castShadow = !!o.shadow;
  for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); mesh.setColorAt(i, _c.setHex(0xffffff)); }
  scene.add(mesh);
  const P = { mesh, ps: Array.from({ length: count }, () => ({ alive: false })), next: 0, ...o };
  pools.push(P);
  return P;
}

export const FX = {};
export function initParticles(scene) {
  const puff = new THREE.IcosahedronGeometry(0.05, 1);
  FX.smoke = pool(scene, 260, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.32, depthWrite: false }), puff, { grow: 3, gravity: 0, drag: 0.98 });
  FX.ash = pool(scene, 260, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false }), puff, { grow: 3.5, gravity: 0, drag: 0.99 });
  FX.dust = pool(scene, 260, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false }), puff, { grow: 1.3, gravity: -0.3, drag: 0.96 });
  FX.debris = pool(scene, 300, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), new THREE.BoxGeometry(0.05, 0.05, 0.05), { grow: 0, gravity: -5, drag: 0.995, shadow: true, spin: true, ground: true });
  FX.fire = pool(scene, 300, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), new THREE.IcosahedronGeometry(0.04, 0), { grow: -0.6, gravity: 0.4, drag: 0.97 });
  FX.bomb = pool(scene, 120, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), new THREE.IcosahedronGeometry(0.07, 0), { grow: 0, gravity: -6, drag: 0.998, ground: true, trail: true });
  FX.spray = pool(scene, 200, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.7, depthWrite: false }), new THREE.IcosahedronGeometry(0.012, 0), { grow: 0.3, gravity: -1.6, drag: 0.99 });
}

export function emit(P, x, y, z, vx, vy, vz, life, size, hex = 0xffffff) {
  for (let n = 0; n < P.ps.length; n++) {
    const i = (P.next + n) % P.ps.length, p = P.ps[i];
    if (p.alive) continue;
    Object.assign(p, { alive: true, x, y, z, vx, vy, vz, age: 0, life, size, rx: 0, ry: 0 });
    P.mesh.setColorAt(i, _c.setHex(hex));
    P.mesh.instanceColor.needsUpdate = true;
    P.next = i + 1;
    return p;
  }
  return null;
}

export function updateParticles(dt, groundAt) {
  for (const P of pools) {
    P.ps.forEach((p, i) => {
      if (!p.alive) return;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; P.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      p.vy += P.gravity * dt;
      p.vx *= P.drag; p.vz *= P.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (P.ground) {
        const g = groundAt(p.x, p.z);
        if (p.y < g) {
          if (P.trail) { p.life = 0; emit(FX.ash, p.x, g + 0.05, p.z, 0, 0.3, 0, 1.5, 1.5, 0x3a3634); emit(FX.fire, p.x, g + 0.05, p.z, 0, 0.3, 0, 0.6, 1.4, 0xff7a20); return; }
          p.y = g; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6;
        }
      }
      if (P.trail && Math.random() < 0.4) emit(FX.ash, p.x, p.y, p.z, 0, 0.1, 0, 1.2, 0.8, 0x4a4442);
      if (P.spin) { p.rx += dt * 6; p.ry += dt * 4; }
      const k = p.age / p.life;
      const sc = p.size * Math.max(0.05, 1 + k * P.grow) * (P.grow >= 0 ? (1 - smooth(0.6, 1, k)) : 1);
      _q.setFromEuler(new THREE.Euler(p.rx, p.ry, 0));
      P.mesh.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(sc, sc, sc)));
    });
    P.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Helpers
export function dustBurst(x, y, z, n = 14, hex = 0xb59f7c) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 0.8; emit(FX.dust, x, y + 0.05, z, Math.cos(a) * s, 0.25 + Math.random() * 0.4, Math.sin(a) * s, 0.8 + Math.random() * 0.5, 1.2 + Math.random(), hex); }
}
const DEBRIS_COLS = [0x8e8a80, 0x6b4428, 0xb99a6c, 0xa4432f, 0xeadcc0, 0x5b3b24];
export function debrisBurst(x, y, z, n = 18, power = 1, cols = DEBRIS_COLS) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * power; emit(FX.debris, x, y + 0.2, z, Math.cos(a) * s, (1.5 + Math.random() * 2) * power, Math.sin(a) * s, 1.5 + Math.random(), 0.5 + Math.random() * 0.8, cols[i % cols.length]); }
}
export function flame(x, y, z, s = 1) {
  const r = Math.random();
  emit(FX.fire, x + (Math.random() - 0.5) * 0.03 * s, y, z + (Math.random() - 0.5) * 0.03 * s, (Math.random() - 0.5) * 0.05, 0.25 + Math.random() * 0.2, (Math.random() - 0.5) * 0.05, 0.4 + Math.random() * 0.3, s * (0.8 + Math.random() * 0.5), r < 0.4 ? 0xffc040 : r < 0.8 ? 0xff7a20 : 0xff3a10);
}
