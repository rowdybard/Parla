// The sunset: coral at the horizon through pink and orchid to periwinkle
// overhead, long streaks of cloud lit from below (gold near the sun, hot pink,
// lilac higher up), and the sun itself sitting low over the sea.
import * as THREE from "three";
import { hash, skyGradient } from "../glsl.js";
import { sunset, color } from "../palette.js";

const DOME = 2400;
const SUN_DISTANCE = 2000;
const SUN_RADIUS = 0.016; // radians: a little larger than life, as it looks at sunset
// The sun is drawn on its own layer, which the sea's mirror doesn't see: its path
// on the water comes from glitter on the ripples instead of a blurred copy.
export const SUN_LAYER = 1;

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
    uniform vec3 uZenith, uHigh, uLow, uHorizon, uGold, uSunDir, uCloudPink, uCloudLilac;
    varying vec3 vDir;
    ${hash}
    ${skyGradient}
    void main() {
      vec3 d = normalize(vDir);
      vec3 col = skyGradient(d);
      if (d.y > 0.0) {
        // a high layer of cloud, in long streaks along the horizon, drifting
        vec2 p = d.xz / (d.y + 0.05);
        p = vec2(p.x * 0.33, p.y * 1.1) + vec2(uTime * 0.008, 0.0);
        float c = fbm(p * 1.3);
        float cover = smoothstep(0.4, 0.74, c) * smoothstep(0.012, 0.06, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y));
        float toward = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz));
        vec3 lit = mix(uCloudPink, uGold, pow(max(toward, 0.0), 6.0) * exp(-d.y * 5.0));
        lit = mix(lit, uCloudLilac, smoothstep(0.12, 0.55, d.y) * 0.75);
        // thin edges catch more light than thick middles
        // thick middles shade towards violet
        lit = mix(lit, lit * vec3(0.72, 0.6, 0.95), smoothstep(0.6, 0.85, c));
        col = mix(col, lit, cover * 0.92);
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `
};

const sunShader = {
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
    void main() {
      float r = length(vUv);
      float disc = smoothstep(0.25, 0.235, r);
      float halo = exp(-max(r - 0.23, 0.0) * 5.0) * 0.5 + exp(-r * 2.2) * 0.25;
      gl_FragColor = vec4(uColor * disc + uHalo * halo * (1.0 - disc), 1.0);
    }
  `
};

export function createSky({ scene, camera, sunDir }) {
  const uniforms = {
    uTime: { value: 0 },
    uZenith: { value: color(sunset.zenith) },
    uHigh: { value: color(sunset.high) },
    uLow: { value: color(sunset.low) },
    uHorizon: { value: color(sunset.horizon) },
    uGold: { value: color(sunset.gold) },
    uCloudPink: { value: color(sunset.cloudPink) },
    uCloudLilac: { value: color(sunset.cloudLilac) },
    uSunDir: { value: sunDir }
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME, 48, 24),
    new THREE.ShaderMaterial({ uniforms, ...skyShader, side: THREE.BackSide, depthWrite: false })
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  scene.add(dome);

  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color(sunset.sun, 2.6) }, uHalo: { value: color(sunset.gold, 0.45) } },
    ...sunShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMaterial);
  sun.renderOrder = -1;
  sun.frustumCulled = false;
  sun.layers.set(SUN_LAYER);
  sun.scale.setScalar(SUN_DISTANCE * Math.tan(SUN_RADIUS) * 8); // the disc fills a quarter of the quad
  scene.add(sun);

  return {
    // the gradient's colours, for the sand and the sea to match
    gradient: uniforms,
    update(dt, time) {
      uniforms.uTime.value = time;
      dome.position.copy(camera.position);
      sun.position.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE);
      sun.lookAt(camera.position);
    },
    dispose() {
      dome.geometry.dispose();
      dome.material.dispose();
      sun.geometry.dispose();
      sunMaterial.dispose();
      scene.remove(dome, sun);
    }
  };
}
