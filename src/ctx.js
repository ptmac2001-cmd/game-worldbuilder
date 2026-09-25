// Shared game context and shader uniforms, filled in by main.js.
import * as THREE from 'three';

export const ctx = {
  scene: null, camera: null, renderer: null, controls: null,
  time: 0,        // game time in seconds (affected by speed)
  realTime: 0,
  speed: 1,
  shake: 0,       // camera shake strength
  log: () => {},  // event log, set by the UI
};

// Uniforms shared by many shaders.
export const U = {
  uTime: { value: 0 },                        // real time, for water and wind
  uSeason: { value: new THREE.Vector4(1, 0, 0, 0) }, // weights: spring, summer, autumn, winter
  uSnow: { value: 0 },                         // snow cover 0..1
  uStorm: { value: 0 },                        // storm darkness 0..1
};

export const GLSL_NOISE = `
  float hh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), u.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), u.x), u.y); }
  float fb(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vn(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return v / 0.9375; }
`;

// Convert a hex colour to an sRGB vec3 for custom shaders that do their own conversion.
export const srgb = hex => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
