// The lagoon: a mirror of everything above it (three's Reflector renders the
// scene from below), broken up by slow swells, with the moon glittering on fine
// ripples, tiny lagoon-green lights winking near the viewer (bioluminescence),
// and a haze that meets the sky at the horizon.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { hash } from "./glsl.js";
import { hex, color } from "./palette.js";
import { MOON_LAYER } from "./sky.js";

const waterShader = {
  name: "ParlaLagoon",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uMoonDir: { value: new THREE.Vector3(0, 0.2, -1) },
    uMoon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() }
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeep, uHorizon, uMoonDir, uMoon, uGlow;
    varying vec4 vUv;
    varying vec3 vWorld;
    ${hash}

    // the surface's slope: long swells and short ripples, all drifting
    vec2 wave(vec2 p, vec2 dir, float k, float amp, float speed) {
      return dir * amp * cos(dot(p, dir) * k + uTime * speed);
    }
    vec2 slope(vec2 p) {
      vec2 s = wave(p, vec2(0.80, 0.60), 0.21, 0.050, 0.65);
      s += wave(p, vec2(-0.60, 0.80), 0.33, 0.040, 0.90);
      s += wave(p, vec2(0.98, -0.20), 0.71, 0.026, 1.35);
      s += wave(p, vec2(0.30, 0.95), 1.37, 0.018, 1.90);
      s += wave(p, vec2(-0.85, -0.53), 2.60, 0.012, 2.70);
      s += wave(p, vec2(0.55, -0.83), 4.10, 0.008, 3.60);
      return s;
    }
    // fine ripples, too small to bend the mirror, that break moonlight into glitter
    vec2 ripples(vec2 p) {
      return (vec2(noise2(p * 2.7 + uTime * 0.35), noise2(p.yx * 3.1 - uTime * 0.4)) - 0.5) * 0.2
           + (vec2(noise2(p * 7.3 - uTime * 0.6), noise2(p.yx * 6.9 + uTime * 0.7)) - 0.5) * 0.12;
    }

    void main() {
      vec3 toEye = cameraPosition - vWorld;
      float dist = length(toEye);
      vec3 view = toEye / dist;
      float near = 1.0 / (1.0 + dist * 0.012); // ripples average out with distance
      vec2 swell = slope(vWorld.xz) * (0.3 + 0.7 * near);
      vec3 n = normalize(vec3(-swell, 1.0).xzy);
      vec3 fine = normalize(vec3(-(swell + ripples(vWorld.xz) * near), 1.0).xzy);

      // what the water mirrors, shifted by the ripples
      vec4 uv = vUv;
      uv.xy += n.xz * 0.2 * uv.w;
      vec3 mirrored = texture2DProj(tDiffuse, uv).rgb;
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
      vec3 col = mix(uDeep, mirrored, clamp(fresnel * 0.95 + 0.08, 0.0, 0.92));

      // moonlight caught on the ripple faces
      vec3 r = reflect(-view, fine);
      col += uMoon * pow(max(dot(r, uMoonDir), 0.0), 700.0) * 3.0 * smoothstep(3.0, 25.0, dist);

      // bioluminescence: small lagoon lights winking on and off close by
      vec2 q = vWorld.xz * 1.4;
      vec2 cell = floor(q);
      float h = hash21(cell);
      vec2 spot = fract(q) - 0.5 - (hash22(cell) - 0.5) * 0.7;
      float wink = pow(max(sin(uTime * (0.5 + h * 1.3) + h * 50.0), 0.0), 18.0);
      col += uGlow * smoothstep(0.1, 0.0, length(spot)) * wink * step(0.93, h) * smoothstep(60.0, 6.0, dist) * 2.0;

      // into the haze where the lagoon meets the sky
      col = mix(col, uHorizon, smoothstep(240.0, 1500.0, dist));
      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export function createWater({ scene, camera, moonDir, horizon }) {
  const water = new Reflector(new THREE.PlaneGeometry(5000, 5000), {
    textureWidth: 512,
    textureHeight: 256,
    clipBias: 0.002,
    color: 0xffffff,
    shader: waterShader,
    multisample: 0
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -1500);
  const u = water.material.uniforms;
  u.uDeep.value.copy(color("#03111a"));
  u.uHorizon.value = horizon; // shared with the sky, so the two meet without a seam
  u.uMoonDir.value = moonDir;
  u.uMoon.value.copy(color(hex.vanilla).lerp(color(hex.paper), 0.4));
  u.uGlow.value.copy(color(hex.lagoon, 1.6));
  scene.add(water);
  water.getReflectionCamera(camera).layers.disable(MOON_LAYER);

  return {
    // the reflection is drawn at a fraction of the screen's resolution
    setSize(width, height) {
      water.getRenderTarget().setSize(Math.max(64, Math.round(width)), Math.max(64, Math.round(height)));
    },
    update(dt, time) {
      u.uTime.value = time;
    },
    dispose() {
      water.geometry.dispose();
      water.dispose();
      scene.remove(water);
    }
  };
}
