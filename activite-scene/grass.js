// Sea oats on the dunes, as in her photo: tall stalks with drooping seed heads
// and long curved leaves, dark against the sunset with warm tips, swaying in
// the sea breeze. Two instanced meshes (stalks, leaves); placed once, seeded,
// and moved entirely in the shader.
import * as THREE from "three";
import { sandHeight } from "./terrain.js";
import { sunset, color } from "./palette.js";

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A strip from y = 0 to 1, `width(y)` wide, bent sideways by `curve(y)`.
function strip(points, segments, width, curve) {
  const base = points.length / 3;
  for (let i = 0; i <= segments; i++) {
    const y = i / segments, w = width(y) / 2, x = curve(y);
    points.push(x - w, y, 0, x + w, y, 0);
  }
  const index = [];
  for (let i = 0; i < segments; i++) {
    const a = base + i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return index;
}

// one sea-oat stalk with its head of flat spikelets hanging on both sides
function stalkGeometry() {
  const points = [], index = [];
  index.push(...strip(points, 10, y => 0.016 * (1 - 0.6 * y), () => 0));
  for (let k = 0; k < 11; k++) {
    const y = 0.7 + k * 0.028, side = k % 2 ? 1 : -1, b = points.length / 3;
    // a spikelet: a flat lens hanging out and down from the stalk
    const len = 0.07 - k * 0.002, wide = 0.022;
    const tipX = side * len * 0.75, tipY = y - len * 0.65;
    points.push(0, y, 0, side * wide + tipX * 0.4, y - len * 0.25, 0, tipX, tipY, 0, side * -wide * 0.3 + tipX * 0.5, y - len * 0.45, 0);
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(index);
  return g;
}

// a long leaf arching out from the base
function leafGeometry() {
  const points = [];
  const index = strip(points, 10, y => 0.03 * (1 - y), y => 0.35 * y * y);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(index);
  return g;
}

const vertexShader = /* glsl */ `
  attribute vec3 iBase;
  attribute vec4 iShape; // height, turn, lean, phase
  uniform float uTime;
  uniform vec2 uWind;
  varying float vHeight;
  void main() {
    vec3 p = position;
    float y = p.y;
    float sway = sin(uTime * 1.3 + iShape.w) * 0.09 + sin(uTime * 2.7 + iShape.w * 1.7) * 0.035;
    float bend = (iShape.z + sway) * y * y;
    float c = cos(iShape.y), s = sin(iShape.y);
    vec3 q = vec3(p.x * c, p.y * iShape.x, p.x * s);
    q.xz += uWind * bend * iShape.x;
    q.y -= bend * bend * iShape.x * 0.35;
    vHeight = y;
    gl_Position = projectionMatrix * viewMatrix * vec4(iBase + q, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase, uTip;
  varying float vHeight;
  void main() {
    gl_FragColor = vec4(mix(uBase, uTip, smoothstep(0.25, 1.0, vHeight)), 1.0);
  }
`;

export function createGrass({ scene, eye }) {
  const rand = seeded(7);
  const stalks = [], leaves = [];
  const plant = (list, x, z, height, lean) => {
    // face the viewer, more or less, so the silhouettes read
    const turn = Math.atan2(eye.x - x, -(eye.z - z)) + (rand() - 0.5) * 1.1;
    list.push(x, sandHeight(x, z) - 0.04, z, height, turn, lean, rand() * 6.28);
  };
  const clump = (cx, cz, radius, nStalks, nLeaves, scale) => {
    for (let i = 0; i < nStalks; i++) {
      const a = rand() * 6.28, r = Math.sqrt(rand()) * radius;
      plant(stalks, cx + Math.cos(a) * r, cz + Math.sin(a) * r, (0.9 + rand() * 0.75) * scale, 0.1 + rand() * 0.25);
    }
    for (let i = 0; i < nLeaves; i++) {
      const a = rand() * 6.28, r = Math.sqrt(rand()) * radius * 0.8;
      plant(leaves, cx + Math.cos(a) * r, cz + Math.sin(a) * r, (0.45 + rand() * 0.45) * scale, rand() * 0.2);
    }
  };
  // a big clump close by on the right, framing the view, then tufts along the dunes
  clump(6.4, 0.8, 2.3, 54, 80, 1.3);
  clump(9.6, -4.5, 1.8, 24, 32, 1.05);
  for (let k = 0; k < 12; k++) {
    const z = -6 - k * 4.5 - rand() * 3, d = 8 + rand() * 6;
    const x = 3 + (d - 0.2766 * (z + 2)) / 0.961;
    clump(x, z, 1.4 + rand(), 9 + Math.floor(rand() * 8), 12, 0.95);
  }

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2(0.94, 0.34) },
    uBase: { value: color(sunset.grass) },
    uTip: { value: color(sunset.grassTip) }
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide });
  const meshes = [[stalkGeometry(), stalks], [leafGeometry(), leaves]].map(([shape, data]) => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = shape.index;
    geometry.setAttribute("position", shape.getAttribute("position"));
    const n = data.length / 7, base = new Float32Array(n * 3), form = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      base.set(data.slice(i * 7, i * 7 + 3), i * 3);
      form.set(data.slice(i * 7 + 3, i * 7 + 7), i * 4);
    }
    geometry.setAttribute("iBase", new THREE.InstancedBufferAttribute(base, 3));
    geometry.setAttribute("iShape", new THREE.InstancedBufferAttribute(form, 4));
    geometry.instanceCount = n;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, shape, geometry };
  });

  return {
    update(dt, time) { uniforms.uTime.value = time; },
    dispose() {
      for (const { mesh, shape, geometry } of meshes) {
        shape.dispose();
        geometry.dispose();
        scene.remove(mesh);
      }
      material.dispose();
    }
  };
}
