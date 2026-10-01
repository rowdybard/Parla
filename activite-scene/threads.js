// Threads of light that carry a word to its translation: a joined-up pen stroke
// from the end of one word to the start of the next, with a cursive loop on the
// way. A bright nib writes it, then the tail follows and it's gone. All threads
// share one mesh; each is a slice written once when it starts, and its progress
// lives in uniform arrays, so nothing is uploaded while it plays.
import * as THREE from "three";

const COUNT = 16;
const SEGMENTS = 64;
const PER = (SEGMENTS + 1) * 2;

const vertexShader = /* glsl */ `
  attribute vec3 aTangent;
  attribute float aS;
  attribute float aSide;
  attribute float aId;
  uniform float uHead[${COUNT}];
  uniform float uTail[${COUNT}];
  uniform float uWidth[${COUNT}];
  uniform vec3 uColor[${COUNT}];
  varying float vS;
  varying float vSide;
  varying float vHead;
  varying float vTail;
  varying vec3 vColor;
  void main() {
    int id = int(aId + 0.5);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 t = normalize((modelViewMatrix * vec4(aTangent, 0.0)).xyz);
    vec2 dir = normalize(t.xy + 1e-5);
    // a broad nib held at an angle: thick across it, a hairline along it
    float nib = 0.22 + 0.78 * abs(dir.x * 0.6 - dir.y * 0.8);
    float width = uWidth[id] * nib * pow(sin(3.14159 * aS), 0.55);
    mv.xy += vec2(-dir.y, dir.x) * aSide * width;
    gl_Position = projectionMatrix * mv;
    vS = aS;
    vSide = aSide;
    vHead = uHead[id];
    vTail = uTail[id];
    vColor = uColor[id];
  }
`;

const fragmentShader = /* glsl */ `
  varying float vS;
  varying float vSide;
  varying float vHead;
  varying float vTail;
  varying vec3 vColor;
  void main() {
    if (vS > vHead || vS < vTail) discard;
    float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
    float nib = exp(-(vHead - vS) * 40.0) * step(vHead, 0.995);
    float tail = smoothstep(vTail, vTail + 0.22, vS);
    float mirrored = step(cameraPosition.y, 0.0); // drawn into the sea's mirror: half strength
    gl_FragColor = vec4(vColor * (1.0 + nib * 3.0) * (1.0 - 0.5 * mirrored), edge * tail);
  }
`;

export function createThreads({ scene }) {
  const n = COUNT * PER;
  const position = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const tangent = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const s = new Float32Array(n), side = new Float32Array(n), id = new Float32Array(n);
  const index = [];
  for (let r = 0; r < COUNT; r++) {
    for (let i = 0; i <= SEGMENTS; i++) {
      const v = r * PER + i * 2;
      s[v] = s[v + 1] = i / SEGMENTS;
      side[v] = -1;
      side[v + 1] = 1;
      id[v] = id[v + 1] = r;
      if (i < SEGMENTS) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  position.setUsage(THREE.DynamicDrawUsage);
  tangent.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("aTangent", tangent);
  geometry.setAttribute("aS", new THREE.BufferAttribute(s, 1));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geometry.setAttribute("aId", new THREE.BufferAttribute(id, 1));
  geometry.setIndex(index);

  const uniforms = {
    uHead: { value: new Float32Array(COUNT) },
    uTail: { value: new Float32Array(COUNT) },
    uWidth: { value: new Float32Array(COUNT) },
    uColor: { value: Array.from({ length: COUNT }, () => new THREE.Color()) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1; // over the sea
  scene.add(mesh);

  // timing per thread: when it starts, how long the nib takes, how long it stays, how long the tail takes
  const timing = Array.from({ length: COUNT }, () => ({ start: -1e9, draw: 1, stay: 1, erase: 1 }));
  let cursor = 0;

  const p = new Float32Array((SEGMENTS + 1) * 3);
  const chord = new THREE.Vector3(), up = new THREE.Vector3(), along = new THREE.Vector3();
  const c1 = new THREE.Vector3(), c2 = new THREE.Vector3(), pt = new THREE.Vector3();

  function point(out, a, b, k, lift, loop, u) {
    // a gentle arc from a to b ...
    const v = 1 - u;
    c1.copy(a).addScaledVector(chord, 0.3).addScaledVector(up, lift);
    c2.copy(a).addScaledVector(chord, 0.7).addScaledVector(up, -lift * 0.6);
    out.copy(a).multiplyScalar(v * v * v)
      .addScaledVector(c1, 3 * v * v * u)
      .addScaledVector(c2, 3 * v * u * u)
      .addScaledVector(b, u * u * u);
    // ... with one cursive loop in the middle
    const w = Math.min(1, Math.max(0, (u - 0.38) / 0.26));
    const turn = w * w * (3 - 2 * w) * Math.PI * 2;
    out.addScaledVector(k, Math.sin(turn) * loop).addScaledVector(up, (1 - Math.cos(turn)) * loop);
    return out;
  }

  return {
    // a: where the stroke leaves (end of a word), b: where it lands, up: which way its
    // arc and loop lean (the camera's up); it stays `stay` seconds once drawn, then goes
    spawn(a, b, camUp, tint, start, draw, width, stay = 0.7, erase = 1.3) {
      const r = cursor;
      cursor = (cursor + 1) % COUNT;
      chord.subVectors(b, a);
      const length = chord.length();
      up.copy(camUp);
      along.copy(chord).normalize();
      const lift = length * 0.18;
      const loop = Math.min(Math.max(length * 0.085, 0.25), 1.1);
      for (let i = 0; i <= SEGMENTS; i++) {
        point(pt, a, b, along, lift, loop, i / SEGMENTS);
        p[i * 3] = pt.x;
        p[i * 3 + 1] = pt.y;
        p[i * 3 + 2] = pt.z;
      }
      const base = r * PER;
      for (let i = 0; i <= SEGMENTS; i++) {
        const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(SEGMENTS, i + 1) * 3;
        let tx = p[i1] - p[i0], ty = p[i1 + 1] - p[i0 + 1], tz = p[i1 + 2] - p[i0 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        for (let j = 0; j < 2; j++) {
          const v = base + i * 2 + j;
          position.array[v * 3] = p[i * 3];
          position.array[v * 3 + 1] = p[i * 3 + 1];
          position.array[v * 3 + 2] = p[i * 3 + 2];
          tangent.array[v * 3] = tx;
          tangent.array[v * 3 + 1] = ty;
          tangent.array[v * 3 + 2] = tz;
        }
      }
      position.addUpdateRange(base * 3, PER * 3);
      tangent.addUpdateRange(base * 3, PER * 3);
      position.needsUpdate = tangent.needsUpdate = true;
      uniforms.uColor.value[r].copy(tint).multiplyScalar(1.9);
      uniforms.uWidth.value[r] = width;
      const t = timing[r];
      t.start = start;
      t.draw = draw;
      t.stay = stay;
      t.erase = erase;
    },
    // every thread drawn in full, for the still frame
    settle() {
      for (let r = 0; r < COUNT; r++) {
        if (timing[r].start < -1e8) continue;
        uniforms.uHead.value[r] = 1;
        uniforms.uTail.value[r] = 0;
      }
    },
    // after the still frame: threads that were held drawn let go from now
    release(time) {
      for (let r = 0; r < COUNT; r++) {
        const t = timing[r];
        if (t.start > -1e8 && time - t.start > t.draw + t.stay) t.start = time - t.draw - t.stay;
      }
    },
    update(dt, time) {
      const head = uniforms.uHead.value, tail = uniforms.uTail.value;
      for (let r = 0; r < COUNT; r++) {
        const t = timing[r], age = time - t.start;
        head[r] = Math.min(1, Math.max(0, age / t.draw));
        tail[r] = Math.min(1, Math.max(0, (age - t.draw - t.stay) / t.erase));
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    }
  };
}
