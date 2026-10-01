// The night over the lagoon: a gradient from --night overhead to a lit horizon,
// warm vanilla on the moon's side and a trace of lagoon green on the other, a
// faint band of stars, twinkling stars, and a vanilla moon with its halo.
import * as THREE from "three";
import { hash } from "../glsl.js";
import { hex, color } from "../palette.js";

const DOME = 2400;
const MOON_DISTANCE = 2000;
// The moon is drawn on its own layer, which the lagoon's mirror doesn't see: its
// path on the water comes from the glints on the ripples instead of a blurred copy.
export const MOON_LAYER = 1;
const MOON_RADIUS = 0.017; // radians: a little larger than life, as it looks low on the horizon

const skyShader = {
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uZenith, uMid, uHorizon, uWarm, uLagoon, uMoonDir;
    varying vec3 vDir;
    ${hash}

    float starField(vec3 d, float scale, float rarity, float size) {
      vec3 p = d * scale;
      vec3 cell = floor(p);
      float h = hash31(cell);
      if (h < rarity) return 0.0;
      vec3 jitter = vec3(hash31(cell + 1.7), hash31(cell + 3.1), hash31(cell + 5.3)) - 0.5;
      float r = length(fract(p) - 0.5 - jitter * 0.55);
      float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + 2.6 * hash31(cell + 7.7)) + h * 80.0);
      return smoothstep(size, 0.0, r) * twinkle * (h - rarity) / (1.0 - rarity);
    }

    void main() {
      vec3 d = normalize(vDir);
      float up = max(d.y, 0.0);
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.17, up));
      col = mix(col, uZenith, smoothstep(0.12, 0.72, up));

      // vanilla light low over the water on the moon's side, a little lagoon on the other
      float toward = dot(normalize(d.xz + 1e-5), normalize(uMoonDir.xz));
      float low = exp(-up * 11.0);
      col += uWarm * pow(max(toward, 0.0), 14.0) * low * 0.09;
      col += uLagoon * pow(max(0.5 - 0.5 * toward, 0.0), 2.0) * exp(-up * 8.0) * 0.035;

      // a faint band of starlight across the sky
      vec3 bandAxis = normalize(vec3(0.42, 0.62, 0.66));
      float band = exp(-pow(dot(d, bandAxis), 2.0) * 22.0);
      vec2 bp = vec2(atan(d.z, d.x) * 3.0, d.y * 9.0);
      float dust = noise2(bp * 2.3) * 0.6 + noise2(bp * 6.1) * 0.4;
      col += mix(uLagoon, vec3(0.45, 0.6, 1.0), 0.55) * band * dust * 0.05 * smoothstep(0.03, 0.3, up);

      // stars, faint and many, then a few bright ones; they sink into the haze
      float stars = starField(d, 300.0, 0.972, 0.13) * 0.9 + starField(d, 110.0, 0.988, 0.09) * 2.4;
      col += vec3(1.0, 0.96, 0.9) * stars * smoothstep(0.03, 0.24, d.y);

      // below the horizon (only ever seen in grazing reflections): dark water-sky
      if (d.y < 0.0) col = mix(uHorizon, uZenith, smoothstep(0.0, 0.25, -d.y));
      gl_FragColor = vec4(col, 1.0);
    }
  `
};

const moonShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv * 2.0 - 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor, uHalo;
    varying vec2 vUv;
    ${hash}
    void main() {
      float r = length(vUv);
      float disc = smoothstep(0.25, 0.238, r);
      // soft grey seas on the face
      float seas = noise2(vUv * 9.0 + 3.0) * 0.6 + noise2(vUv * 21.0) * 0.4;
      float face = 1.0 - 0.22 * smoothstep(0.45, 0.8, seas);
      float halo = exp(-max(r - 0.24, 0.0) * 7.0) * 0.22 + exp(-r * 2.4) * 0.07;
      gl_FragColor = vec4(uColor * disc * face + uHalo * halo * (1.0 - disc), 1.0);
    }
  `
};

export function createSky({ scene, camera, moonDir }) {
  const uniforms = {
    uTime: { value: 0 },
    uZenith: { value: color("#050d14") },
    uMid: { value: color(hex.night2) },
    uHorizon: { value: color("#163743") },
    uWarm: { value: color(hex.vanilla) },
    uLagoon: { value: color(hex.lagoon) },
    uMoonDir: { value: moonDir }
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME, 48, 24),
    new THREE.ShaderMaterial({ uniforms, ...skyShader, side: THREE.BackSide, depthWrite: false })
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  scene.add(dome);

  const moonMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color(hex.paper).lerp(color(hex.vanilla), 0.3).multiplyScalar(1.12) },
      uHalo: { value: color(hex.vanilla, 0.24) }
    },
    ...moonShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMaterial);
  moon.renderOrder = -1;
  moon.frustumCulled = false;
  moon.scale.setScalar(MOON_DISTANCE * Math.tan(MOON_RADIUS) * 8); // the disc fills a quarter of the quad
  moon.layers.set(MOON_LAYER);
  scene.add(moon);

  return {
    horizon: uniforms.uHorizon.value,
    update(dt, time) {
      uniforms.uTime.value = time;
      dome.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(moonDir, MOON_DISTANCE);
      moon.lookAt(camera.position);
    },
    dispose() {
      dome.geometry.dispose();
      dome.material.dispose();
      moon.geometry.dispose();
      moonMaterial.dispose();
      scene.remove(dome, moon);
    }
  };
}
