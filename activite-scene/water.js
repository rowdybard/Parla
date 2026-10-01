// The sea at sunset: a mirror of everything above it (three's Reflector renders
// the scene from below), blue-violet out deep and periwinkle in the shallows,
// glittering gold on fine ripples towards the sun, with lines of foam rolling
// in to the beach. It thins to nothing over the sand, so the waterline is soft,
// and the whole sea rises and falls a little so the swash runs up the beach.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { hash } from "./glsl.js";
import { terrain, seaLevel } from "./terrain.js";
import { sunset, color } from "./palette.js";
import { SUN_LAYER } from "./sky.js";

const seaShader = {
  name: "ParlaSea",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.05, -1) },
    uGlint: { value: new THREE.Color() }
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
    uniform vec3 uDeep, uShallow, uFoam, uHorizon, uSunDir, uGlint;
    varying vec4 vUv;
    varying vec3 vWorld;
    ${hash}
    ${terrain}

    vec2 wave(vec2 p, vec2 dir, float k, float amp, float speed) {
      return dir * amp * cos(dot(p, dir) * k + uTime * speed);
    }
    // long swells, all drifting
    vec2 swell(vec2 p) {
      vec2 s = wave(p, vec2(0.80, 0.60), 0.21, 0.050, 0.65);
      s += wave(p, vec2(-0.60, 0.80), 0.33, 0.040, 0.90);
      s += wave(p, vec2(0.98, -0.20), 0.71, 0.026, 1.35);
      s += wave(p, vec2(0.30, 0.95), 1.37, 0.018, 1.90);
      return s;
    }
    // fine ripples, too small to bend the mirror, that break sunlight into glitter
    vec2 ripples(vec2 p) {
      return (vec2(noise2(p * 2.7 + uTime * 0.35), noise2(p.yx * 3.1 - uTime * 0.4)) - 0.5) * 0.2
           + (vec2(noise2(p * 7.3 - uTime * 0.6), noise2(p.yx * 6.9 + uTime * 0.7)) - 0.5) * 0.12;
    }

    void main() {
      vec3 toEye = cameraPosition - vWorld;
      float dist = length(toEye);
      vec3 view = toEye / dist;
      float near = 1.0 / (1.0 + dist * 0.012);
      vec2 s = swell(vWorld.xz) * (0.3 + 0.7 * near);
      vec3 n = normalize(vec3(-s, 1.0).xzy);
      vec3 fine = normalize(vec3(-(s + ripples(vWorld.xz) * near), 1.0).xzy);

      // what the sea mirrors, shifted by the swell
      vec4 uv = vUv;
      uv.xy += n.xz * 0.2 * uv.w;
      vec3 mirrored = texture2DProj(tDiffuse, uv).rgb;
      float depth = vWorld.y - sandHeight(vWorld.xz);
      vec3 body = mix(uShallow, uDeep, smoothstep(0.1, 1.6, depth));
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
      vec3 col = mix(body, mirrored, clamp(fresnel * 0.8 + 0.06, 0.0, 0.78));

      // the sun's path: glitter on the ripple faces
      vec3 r = reflect(-view, fine);
      col += uGlint * pow(max(dot(r, uSunDir), 0.0), 600.0) * 3.0 * smoothstep(3.0, 25.0, dist);

      // surf: wavy lines of foam rolling in to the beach, a crisp front with a
      // softer wake of bubbles behind it, broken here and there along the crest.
      // (the lace where the wave runs out is drawn on the sand: see beach.js)
      float offshore = -shoreDistance(vWorld.xz); // metres out from the waterline
      float along = dot(vWorld.xz, vec2(-0.2766, 0.961)); // metres along the shore
      float bend = sin(along * 0.23 + uTime * 0.1) * 0.9 + (noise2(vec2(along * 0.09, uTime * 0.05)) - 0.5) * 3.0;
      float crest = fract((offshore + bend) / 7.0 + uTime / 6.5);
      float front = smoothstep(0.0, 0.016, crest) * (1.0 - smoothstep(0.016, 0.1, crest));
      float wake = (1.0 - smoothstep(0.02, 0.3, crest)) * step(0.004, crest);
      // detail finer than a few pixels is averaged away, so nothing shimmers into dashes
      float pixel = length(fwidth(vWorld.xz));
      float pieces = noise2(vec2(along * 0.2, offshore * 0.5 - uTime * 0.1)) * 0.65
                   + noise2(vec2(along * 0.7, offshore * 1.7) + uTime * 0.2) * 0.35;
      pieces = smoothstep(0.34, 0.7, mix(pieces, 0.45, smoothstep(0.3, 1.5, pixel)));
      float bubbles = noise2(vec2(along, offshore) * vec2(2.3, 3.1) + uTime * 0.15) * 0.6
                    + noise2(vec2(along, offshore) * vec2(5.9, 7.7) - uTime * 0.25) * 0.4;
      bubbles = smoothstep(0.4, 0.75, mix(bubbles, 0.42, smoothstep(0.04, 0.25, pixel)));
      float foam = (front * pieces * (0.65 + 0.35 * bubbles) + wake * bubbles * pieces * 0.35)
                 * smoothstep(14.0, 5.0, offshore) * smoothstep(1.2, 3.2, offshore) * smoothstep(65.0, 14.0, dist);
      col = mix(col, uFoam, foam * 0.85);

      // into the haze where the sea meets the sky
      float grazing = 1.0 - smoothstep(0.003, 0.03, toEye.y / dist);
      col = mix(col, uHorizon, max(smoothstep(260.0, 1500.0, dist), grazing));
      // thinning to nothing over the sand
      float alpha = max(smoothstep(0.0, 0.25, depth), foam * 0.95);
      gl_FragColor = vec4(col, alpha);
    }
  `
};

export function createWater({ scene, camera, sunDir, gradient }) {
  const water = new Reflector(new THREE.PlaneGeometry(5000, 5000), {
    textureWidth: 512,
    textureHeight: 256,
    clipBias: 0.002,
    color: 0xffffff,
    shader: seaShader,
    multisample: 0
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -1500);
  water.material.transparent = true;
  water.renderOrder = 0;
  const u = water.material.uniforms;
  u.uDeep.value.copy(color(sunset.sea));
  u.uShallow.value.copy(color(sunset.shallow));
  u.uFoam.value.copy(color(sunset.foam, 1.05));
  u.uHorizon.value = gradient.uHorizon.value; // shared with the sky, so the two meet without a seam
  u.uSunDir.value = sunDir;
  u.uGlint.value.copy(color(sunset.gold).lerp(color(sunset.sun), 0.5));
  scene.add(water);
  water.getReflectionCamera(camera).layers.disable(SUN_LAYER);

  return {
    // the reflection is drawn at a fraction of the screen's resolution
    setSize(width, height) {
      water.getRenderTarget().setSize(Math.max(64, Math.round(width)), Math.max(64, Math.round(height)));
    },
    update(dt, time) {
      u.uTime.value = time;
      water.position.y = seaLevel(time);
    },
    dispose() {
      water.geometry.dispose();
      water.dispose();
      scene.remove(water);
    }
  };
}
