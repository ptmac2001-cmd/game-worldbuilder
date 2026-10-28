// Water: depth-tinted, animated waves, sun glints, shoreline foam,
// shore ice in winter and choppy dark water in storms.
import * as THREE from 'three';
import { N, SUB, R, SEA } from '../config.js';
import { U, GLSL_NOISE, srgb } from '../ctx.js';
import { hTex } from './terrainView.js';

export const waterUniforms = {
  uN: { value: N }, uSub: { value: SUB }, uR: { value: R }, uSea: { value: SEA }, hTex: { value: hTex },
  uTime: U.uTime, uSnow: U.uSnow, uStorm: U.uStorm,
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, fogColor: { value: srgb(0xd6e9f2) }, skyColor: { value: srgb(0xbfdcf0) },
  fogNear: { value: 60 }, fogFar: { value: 170 },
};

export function initWater(scene) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: waterUniforms,
    vertexShader: `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform float uTime, uN, uSub, uR, uSea, fogNear, fogFar, uSnow, uStorm; uniform sampler2D hTex; uniform vec3 sunDir, fogColor, skyColor;
      varying vec3 vPos;
      ${GLSL_NOISE}
      float waves(vec2 p) {
        float t = uTime * (1.0 + uStorm * 1.5);
        return vn(p * 1.3 + vec2(t * 0.25, t * 0.1)) * 0.5 + vn(p * 3.1 - vec2(t * 0.35, -t * 0.2)) * 0.3
             + vn(p * 7.5 + vec2(t * 0.6, t * 0.5)) * 0.2;
      }
      void main() {
        vec2 p = vPos.xz;
        vec2 g = (p + uN * 0.5) * uSub;
        float ground;
        if (g.x < 0.0 || g.y < 0.0 || g.x > uR - 1.0 || g.y > uR - 1.0) {
          float d = max(max(-g.x, -g.y), max(g.x - (uR - 1.0), g.y - (uR - 1.0))) / uSub;
          ground = -0.95 - d * 0.05;
        } else ground = texture2D(hTex, (g + 0.5) / uR).r * 10.0 - 1.2;
        float depth = uSea - ground;
        float e = 0.06, amp = 2.2 + uStorm * 3.0;
        vec3 nrm = normalize(vec3((waves(p - vec2(e, 0.0)) - waves(p + vec2(e, 0.0))) * amp, 1.0,
                                  (waves(p - vec2(0.0, e)) - waves(p + vec2(0.0, e))) * amp));
        vec3 V = normalize(cameraPosition - vPos);
        vec3 col = mix(vec3(0.33, 0.83, 0.80), vec3(0.11, 0.53, 0.72), smoothstep(0.0, 0.35, depth));
        col = mix(col, vec3(0.05, 0.26, 0.50), smoothstep(0.35, 1.3, depth));
        col = mix(col, col * vec3(0.55, 0.65, 0.7), uStorm);
        col *= 0.92 + 0.16 * vn(p * 0.4 + uTime * 0.05);
        float fres = pow(1.0 - clamp(dot(nrm, V), 0.0, 1.0), 4.0);
        col = mix(col, skyColor, fres * 0.75);
        vec3 H = normalize(sunDir + V);
        col += vec3(1.0, 0.93, 0.8) * pow(clamp(dot(nrm, H), 0.0, 1.0), 220.0) * 1.6 * (1.0 - uStorm);
        float band = 1.0 - smoothstep(0.0, 0.17 + uStorm * 0.15, depth);
        float ripple = 0.5 + 0.5 * sin(depth * 55.0 - uTime * 2.2 + vn(p * 2.0) * 6.0);
        float foam = smoothstep(0.4, 0.75, band * (0.5 + 0.7 * ripple * vn(p * 6.0 + vec2(uTime * 0.3, -uTime * 0.2))));
        foam = max(foam, smoothstep(0.93, 1.0, band));
        foam = max(foam, uStorm * smoothstep(0.78, 0.92, vn(p * 2.5 + uTime * 0.4)) * 0.55);
        col = mix(col, vec3(0.97, 0.99, 1.0), foam);
        float alpha = mix(0.5, 0.93, smoothstep(0.0, 0.7, depth));
        alpha = max(alpha, foam * 0.95);
        // winter shore ice with cracks
        float ice = uSnow * (1.0 - smoothstep(0.15, 0.45, depth + (vn(p * 1.5) - 0.5) * 0.35));
        float cracks = smoothstep(0.04, 0.0, abs(vn(p * 4.0) - 0.5)) * 0.5;
        col = mix(col, mix(vec3(0.86, 0.93, 0.97), vec3(0.6, 0.72, 0.8), cracks), ice);
        alpha = mix(alpha, 0.97, ice);
        alpha *= smoothstep(-0.02, 0.015, depth);
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, distance(vPos, cameraPosition)));
        gl_FragColor = vec4(pow(col, vec3(2.2)), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = SEA;
  water.renderOrder = 2;
  scene.add(water);
  return water;
}
