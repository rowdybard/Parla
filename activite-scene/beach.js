// The beach: pale pink sand rising from the sea to the dunes, lilac in the shade
// of the low sun and warm where it reaches, darker and glossy in the wet band at
// the water's edge, where it mirrors the sunset, with a lace of foam on the edge.
import * as THREE from "three";
import { hash, skyGradient } from "./glsl.js";
import { terrain, seaLevel } from "./terrain.js";
import { sunset, color } from "./palette.js";

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${terrain}
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec2 p = world.xz;
    world.y = sandHeight(p);
    float e = 0.2;
    vNormal = normalize(vec3(sandHeight(p - vec2(e, 0.0)) - sandHeight(p + vec2(e, 0.0)), 2.0 * e,
                             sandHeight(p - vec2(0.0, e)) - sandHeight(p + vec2(0.0, e))));
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime, uLevel;
  uniform vec3 uSand, uShade, uWet, uFoam;
  uniform vec3 uZenith, uHigh, uLow, uHorizon, uGold, uSunDir;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${hash}
  ${skyGradient}
  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 view = toEye / dist;
    // wind ripples in the dry sand, fading with distance
    vec2 q = vWorld.xz;
    float ripple = sin(dot(q, vec2(0.45, 1.0)) * 5.0 + noise2(q * 0.7) * 6.0);
    vec3 n = normalize(vNormal + vec3(0.0, 0.0, ripple * 0.12 * smoothstep(25.0, 4.0, dist) * smoothstep(0.1, 0.3, vWorld.y)));
    // lit mostly by the pink sky, and a little by the sun on the slopes that face it
    float facing = max(dot(n, normalize(vec3(uSunDir.x, 0.35, uSunDir.z))), 0.0);
    float grain = noise2(vWorld.xz * 9.0) * 0.5 + noise2(vWorld.xz * 31.0) * 0.5;
    vec3 col = mix(uShade, uSand, 0.35 + 0.65 * n.y * (0.55 + 0.45 * facing)) * (0.93 + 0.14 * grain);
    col += uGold * pow(facing, 3.0) * 0.12;
    // the sand nearest the viewer lies in the dune's shadow
    col *= mix(0.8, 1.0, smoothstep(3.0, 28.0, dist));

    // the wet band, up to the highest the swash reaches: darker, and mirroring the sky
    float wet = 1.0 - smoothstep(0.1, 0.24, vWorld.y);
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
    vec3 shine = mix(uWet, skyGradient(reflect(-view, n)), clamp(fresnel * 1.3 + 0.1, 0.0, 1.0));
    col = mix(col, shine, wet * 0.85);

    // where the wave runs out: a thin bright edge, and lace in the sheet of water
    // behind it. Drawn here, on the sand as it is drawn, so the edge follows the
    // line where the sea actually meets it. h: the sand's height above the water.
    float h = vWorld.y - uLevel;
    float pixel = length(fwidth(vWorld.xz)), dh = fwidth(h);
    vec2 s = vec2(dot(vWorld.xz, vec2(-0.2766, 0.961)), dot(vWorld.xz, vec2(0.961, 0.2766))); // along the shore, up the beach
    float lace = noise2(s * vec2(1.7, 5.5) + vec2(uTime * 0.12, 0.0)) * 0.6 + noise2(s * vec2(4.3, 12.0) - uTime * 0.2) * 0.4;
    lace = smoothstep(0.42, 0.7, mix(lace, 0.45, smoothstep(0.03, 0.18, pixel)));
    float edge = 1.0 - smoothstep(0.0, max(0.004, dh * 1.5), abs(h + 0.004));
    float sheet = smoothstep(-0.05, -0.012, h) * (1.0 - smoothstep(-0.008, 0.0, h));
    float foam = (edge * (0.45 + 0.35 * lace) + sheet * lace * 0.45) * smoothstep(160.0, 30.0, dist);
    col = mix(col, uFoam, foam);

    col = mix(col, uHorizon, smoothstep(220.0, 1000.0, dist));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createBeach({ scene, gradient }) {
  // x from the sea on the left to the dunes on the right, z from behind the viewer far out along the shore
  const geometry = new THREE.PlaneGeometry(240, 280, 150, 190);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(80, 0, -126);
  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uSand: { value: color(sunset.sand) },
    uShade: { value: color(sunset.sandShade) },
    uWet: { value: color(sunset.wetSand) },
    uFoam: { value: color(sunset.foam) },
    // the sky's own gradient, so the wet sand mirrors the same sunset
    uZenith: gradient.uZenith, uHigh: gradient.uHigh, uLow: gradient.uLow,
    uHorizon: gradient.uHorizon, uGold: gradient.uGold, uSunDir: gradient.uSunDir
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // the heights come from the shader
  scene.add(mesh);

  return {
    update(dt, time) {
      uniforms.uTime.value = time;
      uniforms.uLevel.value = seaLevel(time);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    }
  };
}
