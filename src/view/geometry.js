// Helpers for building detailed props out of coloured primitives. Every part
// is baked into one merged geometry with per-vertex colours, so a whole
// building draws in a single call.
import * as THREE from 'three';
import { hash2, rnd } from '../rng.js';

const _e = new THREE.Euler(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);

export function part(geo, hex, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, opts = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _one));
  const c = new THREE.Color(hex);
  const j = opts.jitter ?? 0.04, k = 1 + (rnd() - 0.5) * 2 * j;
  const n = g.attributes.position.count, a = new Float32Array(n * 3), leaf = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; leaf[i] = opts.leaf || 0; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.setAttribute('leaf', new THREE.BufferAttribute(leaf, 1));
  return g;
}

export function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), leaf = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3); leaf.set(p.attributes.leaf.array, o);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('leaf', new THREE.BufferAttribute(leaf, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// Lumpy blob: vertices displaced by a position hash, so shared corners stay welded.
export function blob(r, detail = 1, lump = 0.18) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash2(Math.round(x * 997), Math.round(y * 991 + z * 983)) - 0.5) * 2 * lump;
    p.setXYZ(i, x * k, y * k * 0.9, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function tris(arr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

// Gable roof with the ridge along X. Returns [slopes, gable ends].
export function gableGeo(w, d, rh) {
  const a = w / 2, b = d / 2;
  const s = tris([
    -a, 0, b, a, 0, b, a, rh, 0, -a, 0, b, a, rh, 0, -a, rh, 0,
    a, 0, -b, -a, 0, -b, -a, rh, 0, a, 0, -b, -a, rh, 0, a, rh, 0,
    a, 0, b, -a, 0, b, -a, 0, -b, a, 0, b, -a, 0, -b, a, 0, -b,
  ]);
  const e = tris([a, 0, b, a, 0, -b, a, rh, 0, -a, 0, -b, -a, 0, b, -a, rh, 0]);
  return [s, e];
}
// Hip roof: four slopes, ridge along X (w >= d).
export function hipGeo(w, d, rh) {
  const a = w / 2, b = d / 2, r = Math.max(0, a - b);
  return tris([
    -a, 0, b, a, 0, b, r, rh, 0, -a, 0, b, r, rh, 0, -r, rh, 0,
    a, 0, -b, -a, 0, -b, -r, rh, 0, a, 0, -b, -r, rh, 0, r, rh, 0,
    a, 0, b, a, 0, -b, r, rh, 0,
    -a, 0, -b, -a, 0, b, -r, rh, 0,
    a, 0, b, -a, 0, b, -a, 0, -b, a, 0, b, -a, 0, -b, a, 0, -b,
  ]);
}
// Half disc facing +Z (for arches), radius r, centred at its flat edge.
export const halfDisc = (r, depth = 0.02, seg = 10) => new THREE.CylinderGeometry(r, r, depth, seg, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);

// Rotate a local offset (lx, lz) by ry and add to (x, z).
export const local = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

// A builder that collects coloured parts and extras (chimneys, fires, ...).
export class Kit {
  constructor() { this.parts = []; this.extras = { chimneys: [], fires: [], sails: [], sprays: [] }; }
  add(geo, hex, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, opts) { this.parts.push(part(geo, hex, x, y, z, ry, rx, rz, opts)); return this; }
  // Boxes and cylinders are positioned by their *bottom* centre.
  box(w, hh, d, hex, x, y, z, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, hh, d), hex, x, y + hh / 2, z, ry, rx, rz); }
  cyl(rt, rb, hh, hex, x, y, z, seg = 10, ry = 0) { return this.add(new THREE.CylinderGeometry(rt, rb, hh, seg), hex, x, y + hh / 2, z, ry); }
  cone(r, hh, hex, x, y, z, seg = 10, ry = 0) { return this.add(new THREE.ConeGeometry(r, hh, seg), hex, x, y + hh / 2, z, ry); }
  dome(r, hex, x, y, z, seg = 20, squash = 1) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.ceil(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2).scale(1, squash, 1), hex, x, y, z);
  }
  ball(r, hex, x, y, z, seg = 8) { return this.add(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.75)), hex, x, y, z); }
  gable(w, d, rh, hex, x, y, z, ry = 0, endHex = null, trim = 0x2e3a52, courses = true) {
    const [s, e] = gableGeo(w, d, rh);
    this.add(s, hex, x, y, z, ry);
    this.add(e, endHex ?? hex, x, y - 0.001, z, ry);
    if (courses) {
      const ang = Math.atan2(rh, d / 2);
      for (const t of [0.28, 0.56, 0.8]) for (const side of [1, -1]) {
        const [px, pz] = local(x, z, ry, 0, side * (d / 2) * (1 - t));
        this.add(new THREE.BoxGeometry(w + 0.01, 0.012, 0.025), trim, px, y + rh * t + 0.008, pz, ry, side * -ang, 0);
      }
    }
    this.add(new THREE.BoxGeometry(w + 0.03, 0.035, 0.045), 0x4a3020, x, y + rh, z, ry);
    return this;
  }
  hip(w, d, rh, hex, x, y, z, ry = 0) { return this.add(hipGeo(w, d, rh), hex, x, y, z, ry); }
  // Window on a wall facing direction ry, centre at (x, y, z).
  window(x, y, z, ry, o = {}) {
    const w = o.w ?? 0.085, hh = o.h ?? 0.1, glass = o.glass ?? 0x2f4458, frame = o.frame ?? 0x5b3b24;
    const at = (lx, ly, lz) => { const [px, pz] = local(x, z, ry, lx, lz); return [px, y + ly, pz]; };
    this.add(new THREE.BoxGeometry(w, hh, 0.02), glass, ...at(0, 0, 0), ry);
    if (o.arched) this.add(halfDisc(w / 2, 0.02), glass, ...at(0, hh / 2, 0), ry);
    this.add(new THREE.BoxGeometry(w + 0.035, 0.018, 0.04), o.sill ?? frame, ...at(0, -hh / 2 - 0.009, 0.008), ry);
    if (!o.arched) this.add(new THREE.BoxGeometry(w + 0.025, 0.016, 0.03), frame, ...at(0, hh / 2 + 0.008, 0), ry);
    if (o.mullion !== false) {
      this.add(new THREE.BoxGeometry(0.008, hh, 0.026), frame, ...at(0, 0, 0), ry);
      this.add(new THREE.BoxGeometry(w, 0.008, 0.026), frame, ...at(0, 0.005, 0), ry);
    }
    if (o.shutters) for (const s of [-1, 1]) this.add(new THREE.BoxGeometry(w * 0.48, hh, 0.012), o.shutters, ...at(s * (w * 0.74 + 0.004), 0, 0.004), ry);
    if (o.flowers) {
      this.add(new THREE.BoxGeometry(w + 0.02, 0.03, 0.035), 0x6b4428, ...at(0, -hh / 2 - 0.035, 0.03), ry);
      for (let i = 0; i < 4; i++) this.add(new THREE.IcosahedronGeometry(0.012, 0), o.flowers[i % o.flowers.length], ...at(-w / 2 + 0.01 + i * w / 3.3, -hh / 2 - 0.012, 0.035), ry);
    }
    return this;
  }
  door(x, y, z, ry, o = {}) {
    const w = o.w ?? 0.11, hh = o.h ?? 0.2;
    const at = (lx, ly, lz) => { const [px, pz] = local(x, z, ry, lx, lz); return [px, y + ly, pz]; };
    this.add(new THREE.BoxGeometry(w, hh, 0.03), o.hex ?? 0x6b4428, ...at(0, hh / 2, 0), ry);
    if (o.arched) this.add(halfDisc(w / 2, 0.03), o.hex ?? 0x6b4428, ...at(0, hh, 0), ry);
    this.add(new THREE.BoxGeometry(w + 0.04, 0.03, 0.045), o.frame ?? 0x6c685f, ...at(0, o.arched ? hh + w / 2 + 0.01 : hh + 0.015, 0.006), ry);
    this.add(new THREE.BoxGeometry(w + 0.06, 0.025, 0.08), o.step ?? 0x8e8a80, ...at(0, 0.012, 0.04), ry);
    this.add(new THREE.BoxGeometry(0.012, 0.012, 0.01), 0xd9b44a, ...at(w * 0.3, hh * 0.5, 0.02), ry);
    return this;
  }
  build(ry = 0) {
    const geo = merge(this.parts);
    if (ry) geo.rotateY(ry);
    geo.computeBoundingBox();
    const rot = p => { const [x, z] = local(0, 0, ry, p.x, p.z); return { ...p, x, z, ry: (p.ry || 0) + ry }; };
    const ex = {};
    for (const k in this.extras) ex[k] = this.extras[k].map(rot);
    return { geo, extras: ex, height: geo.boundingBox.max.y };
  }
}
