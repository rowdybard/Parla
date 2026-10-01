// Words in four languages, written in light above the lagoon. An idea is
// written in French; a thread of light carries it on into English, Spanish and
// Malagasy; the four drift together a while, mirrored in the water, and fade.
// Each word is an instance of one mesh: its slot is written once, and the
// shader does the rest (writing it out left to right, drifting, fading).
import * as THREE from "three";
import { billboard } from "./glsl.js";
import { glow } from "./palette.js";

export const LANGS = ["Français", "English", "Español", "Malagasy"];
export const CONCEPTS = [
  ["Bonjour", "Hello", "Hola", "Salama"],
  ["Merci", "Thank you", "Gracias", "Misaotra"],
  ["Apprendre", "Learn", "Aprender", "Mianatra"],
  ["Parler", "Speak", "Hablar", "Miteny"],
  ["Ensemble", "Together", "Juntos", "Miaraka"],
  ["Mots", "Words", "Palabras", "Teny"]
];

const SLOTS = 40;
const STEP = 1.55; // seconds from one language to the next
const WRITE = 0.95; // seconds to write one word
const STAY = 15; // an idea stays this long ...
const FADE = 2.4; // ... the last part of it fading

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iDrift; // xyz: drift per second, w: when the idea began
  attribute vec4 iRect;
  attribute vec2 iSize;
  attribute vec3 iColor;
  attribute vec4 iTime; // birth, seconds to write, end, sway seed
  uniform float uTime;
  varying vec2 vUv;
  varying float vX;
  varying float vReveal;
  varying float vFade;
  varying vec3 vColor;
  ${billboard}
  void main() {
    float age = uTime - iTime.x;
    float shown = step(0.0, age) * step(uTime, iTime.z);
    vReveal = age / iTime.y;
    vFade = 1.0 - smoothstep(iTime.z - ${FADE.toFixed(2)}, iTime.z, uTime);
    vec3 sway = vec3(sin(uTime * 0.33 + iTime.w) * 0.12, sin(uTime * 0.27 + iTime.w * 1.7) * 0.08, 0.0);
    vec3 center = iPos + iDrift.xyz * (uTime - iDrift.w) + sway;
    gl_Position = billboard(center, position.xy, iSize * shown);
    vUv = mix(iRect.xy, iRect.zw, uv);
    vX = uv.x;
    vColor = iColor;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vX;
  varying float vReveal;
  varying float vFade;
  varying vec3 vColor;
  void main() {
    float ink = texture2D(uAtlas, vUv).r;
    // written from left to right: a soft front, and a bright nib where the pen is
    float front = vReveal * 1.2 - 0.08;
    float written = 1.0 - smoothstep(front - 0.1, front, vX);
    float nib = exp(-pow((vX - front) * 10.0, 2.0)) * (1.0 - smoothstep(0.9, 1.15, vReveal));
    gl_FragColor = vec4(vColor * (1.0 + nib * 2.2), ink * written * vFade);
  }
`;

export function createWords(ctx) {
  const { scene, camera, atlas, threads } = ctx;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  const make = (name, size) => {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * size), size);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    return attribute;
  };
  const iPos = make("iPos", 3), iDrift = make("iDrift", 4), iRect = make("iRect", 4);
  const iSize = make("iSize", 2), iColor = make("iColor", 3), iTime = make("iTime", 4);
  geometry.instanceCount = SLOTS;

  const uniforms = { uTime: { value: 0 }, uAtlas: { value: atlas.texture } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const ideas = []; // what is on screen: { end, box } with the box in normalised screen space
  let next = 0.35, deck = [], last = -1, hue = 0, cursor = 0;

  const v = new THREE.Vector3(), dir = new THREE.Vector3(), forward = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const spots = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const color = new THREE.Color();

  function set(attribute, slot, a, b, c, d) {
    const n = attribute.itemSize, o = slot * n, array = attribute.array;
    array[o] = a;
    if (n > 1) array[o + 1] = b;
    if (n > 2) array[o + 2] = c;
    if (n > 3) array[o + 3] = d;
    attribute.addUpdateRange(o, n);
    attribute.needsUpdate = true;
  }

  // every idea once per round, in a new order each round, starting with « Bonjour »
  function nextConcept() {
    if (!deck.length) {
      deck = CONCEPTS.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (last < 0) deck.unshift(...deck.splice(deck.indexOf(0), 1));
      else if (deck[0] === last) deck.push(deck.shift());
    }
    return (last = deck.shift());
  }

  // the point `depth` metres ahead that shows at (x, y) on screen (normalised)
  function worldAt(x, y, depth, out) {
    v.set(x, y, 0.5).unproject(camera);
    dir.copy(v).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(dir, depth / dir.dot(forward));
  }

  const overlaps = (a, b, m) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;

  function place(time, at) {
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();

    const ci = nextConcept();
    const texts = CONCEPTS[ci];
    const depth = 36 + Math.random() * 34;
    const viewH = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const cell = (viewH * ctx.wordPx) / ctx.height; // world height of one word's cell
    const toX = w => (2 * w) / (viewH * camera.aspect), toY = h => (2 * h) / viewH;
    const sizes = texts.map(text => {
      const entry = atlas.word(text);
      return { entry, w: cell * entry.aspect, h: cell };
    });
    // two lines, like a short sentence: French and English, then Spanish and Malagasy, indented
    const gap = toY(cell) * 0.3, lineH = toY(cell) * 0.9;
    const w = sizes.map(s => toX(s.w));
    const indent = Math.min(w[0] * 0.55, toX(cell) * 1.4);
    const blockW = Math.max(w[0] + gap + w[1], indent + w[2] + gap + w[3]), blockH = lineH * 2.1;
    if (blockW > 1.9) return false;

    // the reflection shows about as far below the horizon as the words are above
    // it, plus a little more (the eye is above the water); best kept off the title
    const horizon = ctx.floor - 0.06, below = (2 * ctx.eye.y) / (depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    let box = null;
    for (let k = 0; k < 24 && !box; k++) {
      const cx = at ? at.x + (Math.random() - 0.5) * 0.15 * k : -0.96 + blockW / 2 + Math.random() * Math.max(0, 1.92 - blockW);
      const cy = at ? at.y + (Math.random() - 0.5) * 0.1 * k
        : ctx.floor + blockH / 2 + Math.random() * Math.max(0, ctx.ceiling - ctx.floor - blockH);
      const b = { x0: cx - blockW / 2, x1: cx + blockW / 2, y0: cy - blockH / 2, y1: cy + blockH / 2 };
      if (b.x0 < -0.97 || b.x1 > 0.97 || b.y0 < ctx.floor || b.y1 > ctx.ceiling) continue;
      if (ctx.avoid && overlaps(b, ctx.avoid, 0.05)) continue;
      if (ctx.moon && overlaps(b, ctx.moon, 0.02)) continue;
      const mirrored = { x0: b.x0, x1: b.x1, y0: 2 * horizon - b.y1 - below, y1: 2 * horizon - b.y0 - below };
      if (k < 16 && ctx.avoid && overlaps(mirrored, ctx.avoid, 0.02)) continue;
      if (ideas.some(idea => overlaps(idea.box, b, 0.04))) continue;
      box = b;
    }
    if (!box) return false;

    const top = box.y1, left = box.x0;
    const xs = [left + w[0] / 2, left + w[0] + gap + w[1] / 2, left + indent + w[2] / 2, left + indent + w[2] + gap + w[3] / 2];
    const ys = [top - lineH * 0.5, top - lineH * 0.6, top - lineH * 1.55, top - lineH * 1.65];
    const hex = glow[(ctx.stage() + hue++) % glow.length];
    color.set(hex).multiplyScalar(1.4);
    const drift = [(Math.random() - 0.5) * 0.08, 0.035 + Math.random() * 0.04, 0];
    const seed = Math.random() * 100;
    for (let i = 0; i < 4; i++) {
      worldAt(xs[i], ys[i], depth, spots[i]);
      const slot = cursor;
      cursor = (cursor + 1) % SLOTS;
      const e = sizes[i].entry;
      set(iPos, slot, spots[i].x, spots[i].y, spots[i].z);
      set(iDrift, slot, drift[0], drift[1], drift[2], time);
      set(iRect, slot, e.u0, e.v0, e.u1, e.v1);
      set(iSize, slot, sizes[i].w, sizes[i].h);
      set(iColor, slot, color.r, color.g, color.b);
      set(iTime, slot, time + i * STEP, WRITE, time + STAY, seed);
    }
    // a thread from the end of each word to the start of the next, landing as that word begins
    for (let i = 0; i < 3; i++) {
      const start = time + i * STEP + WRITE * 0.85;
      const lead = start - time + 0.4; // where the words will have drifted to by mid-stroke
      const a = sizes[i], b = sizes[i + 1];
      from.copy(spots[i]).addScaledVector(right, a.w * 0.46).addScaledVector(up, (a.entry.baseline - 0.36) * a.h)
        .add(v.set(drift[0], drift[1], 0).multiplyScalar(lead));
      to.copy(spots[i + 1]).addScaledVector(right, -b.w * 0.46).addScaledVector(up, (b.entry.baseline - 0.36) * b.h)
        .add(v.set(drift[0], drift[1], 0).multiplyScalar(lead));
      threads.spawn(from, to, up, hex, start, STEP - WRITE * 0.85 + 0.12, cell * 0.05);
    }
    ideas.push({ end: time + STAY, box });
    return true;
  }

  return {
    // a click in the sky: an idea written where it was
    writeAt(time, x, y) {
      if (ideas.length > ctx.maxIdeas()) return;
      place(time, { x, y });
    },
    // the still frame: two ideas already written, their threads drawn
    compose(time) {
      place(time - 6.4);
      place(time - 9.1);
      threads.settle();
      next = time + 3;
    },
    update(dt, time) {
      uniforms.uTime.value = time;
      for (let i = ideas.length - 1; i >= 0; i--) if (ideas[i].end < time) ideas.splice(i, 1);
      if (time >= next) {
        const placed = ideas.length < ctx.maxIdeas() && place(time);
        next = time + (placed ? 4.6 + Math.random() * 1.8 : 0.8);
      }
    },
    dispose() {
      quad.dispose();
      geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    }
  };
}
