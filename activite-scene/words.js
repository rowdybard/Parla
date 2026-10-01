// Words in four languages, written in light over the sea. An idea is written
// in French; a thread of gold carries it on into English, Spanish and Malagasy;
// the four drift together a while, mirrored in the water, and fade.
// And once a round, first of all, Parla: the word the school's founder made up
// from French and Spanish. It is nobody's translation, so it comes on its own,
// larger, and signed underneath with a gold flourish.
// Each word is an instance of one mesh: its slot is written once, and the
// shader does the rest (writing it out left to right, drifting, fading).
// Everything is allocated up front; placing an idea creates nothing.
import * as THREE from "three";
import { billboard } from "./glsl.js";
import { inks, signInk, halo, sunset, color as paint } from "./palette.js";

// French, English, Spanish, Malagasy
export const CONCEPTS = [
  ["Bonjour", "Hello", "Hola", "Salama"],
  ["Merci", "Thank you", "Gracias", "Misaotra"],
  ["Apprendre", "Learn", "Aprender", "Mianatra"],
  ["Ensemble", "Together", "Juntos", "Miaraka"],
  ["Mots", "Words", "Palabras", "Teny"]
];
export const SIGNATURE = "Parla";
export const WORDS = [SIGNATURE, ...CONCEPTS.flat()]; // all the atlas has to draw

const SIGN = CONCEPTS.length; // the signature's place in the deck, after the ideas
const SLOTS = 40;
const POOL = 6; // ideas on screen at once, at most
const SCALES = [1, 0.84, 0.7]; // an idea that doesn't fit is tried smaller (narrow screens)
const STEP = 1.55; // seconds from one language to the next
const WRITE = 0.95; // seconds to write one word
const SIGN_SIZE = 1.6; // the signature, against a word of an idea
const SIGN_WRITE = 1.6; // seconds to write it
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
  uniform vec3 uHalo;
  varying vec2 vUv;
  varying float vX;
  varying float vReveal;
  varying float vFade;
  varying vec3 vColor;
  void main() {
    float ink = texture2D(uAtlas, vUv).r;
    // a soft halo around the letters, from a blurrier level of the same texture
    float glow = texture2D(uAtlas, vUv, 3.5).r;
    // written from left to right: a soft front, and a bright nib where the pen is
    float front = vReveal * 1.2 - 0.08;
    float written = 1.0 - smoothstep(front - 0.1, front, vX);
    float nib = exp(-pow((vX - front) * 10.0, 2.0)) * (1.0 - smoothstep(0.9, 1.15, vReveal));
    vec3 col = mix(uHalo, vColor * (1.0 + nib * 2.2), ink);
    // in the sea's mirror (its camera is below the water) the words show at half strength
    float mirrored = step(cameraPosition.y, 0.0);
    gl_FragColor = vec4(col, max(ink, smoothstep(0.0, 0.5, glow) * 0.42) * written * vFade * (1.0 - 0.5 * mirrored));
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

  const uniforms = { uTime: { value: 0 }, uAtlas: { value: atlas.texture }, uHalo: { value: paint(halo) } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1; // over the sea
  scene.add(mesh);

  // what is on screen: when each idea ends, and its box in normalised screen space
  const ideas = Array.from({ length: POOL }, () => ({ end: -1e9, box: { x0: 0, x1: 0, y0: 0, y1: 0 } }));
  const live = time => {
    let n = 0;
    for (let i = 0; i < POOL; i++) if (ideas[i].end > time) n++;
    return n;
  };
  let next = 0.35, hue = 0, cursor = 0;

  // every idea once per round and the signature with them, in a new order each round
  const deck = new Int8Array(CONCEPTS.length + 1);
  let dealt = deck.length, last = -1;
  function upcoming() {
    if (dealt === deck.length) {
      for (let i = 0; i < deck.length; i++) deck[i] = i;
      for (let i = deck.length - 1; i > 0; i--) swap(i, (Math.random() * (i + 1)) | 0);
      // the first round opens with Parla; a round never starts with the idea just shown
      if (last < 0) swap(0, deck.indexOf(SIGN));
      else if (deck[0] === last) swap(0, 1 + ((Math.random() * (deck.length - 1)) | 0));
      dealt = 0;
    }
    return deck[dealt];
  }
  function swap(i, j) {
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  // no room for this idea just now: a later one in the round goes first
  function defer() {
    if (dealt + 1 < deck.length) swap(dealt, dealt + 1 + ((Math.random() * (deck.length - dealt - 1)) | 0));
    else dealt++; // the last of the round waits for the next
  }

  // each word's place in the atlas, and the inks and thread colour, looked up once
  const table = CONCEPTS.map(texts => texts.map(text => atlas.word(text)));
  table[SIGN] = [atlas.word(SIGNATURE)];
  const inkColors = inks.map(hex => paint(hex, 1.25));
  const signColor = paint(signInk, 1.4);
  const gold = paint(sunset.gold);

  const v = new THREE.Vector3(), dir = new THREE.Vector3(), forward = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), down = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const spots = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const cellW = new Float64Array(4), w = new Float64Array(4), xs = new Float64Array(4), ys = new Float64Array(4);
  const box = { x0: 0, x1: 0, y0: 0, y1: 0 }, mirrored = { x0: 0, x1: 0, y0: 0, y1: 0 };

  function set(attribute, slot, a, b, c, d) {
    const n = attribute.itemSize, o = slot * n, array = attribute.array;
    array[o] = a;
    if (n > 1) array[o + 1] = b;
    if (n > 2) array[o + 2] = c;
    if (n > 3) array[o + 3] = d;
    attribute.addUpdateRange(o, n);
    attribute.needsUpdate = true;
  }

  // the point `depth` metres ahead that shows at (x, y) on screen (normalised)
  function worldAt(x, y, depth, out) {
    v.set(x, y, 0.5).unproject(camera);
    dir.copy(v).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(dir, depth / dir.dot(forward));
  }

  function overlaps(a, b, m) {
    return a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
  }
  function crowded(b, time) {
    for (let i = 0; i < POOL; i++) if (ideas[i].end > time && overlaps(ideas[i].box, b, 0.04)) return true;
    return false;
  }

  // writes the next idea somewhere free (near (atX, atY) when asked), or returns false
  function place(time, near, atX, atY) {
    let free = null;
    for (let i = 0; i < POOL && !free; i++) if (ideas[i].end <= time) free = ideas[i];
    if (!free) return false;
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();
    const ci = upcoming();
    for (let k = 0; k < SCALES.length; k++) {
      if (write(time, ci, SCALES[k], free, near, atX, atY)) {
        dealt++;
        last = ci;
        return true;
      }
    }
    defer();
    return false;
  }

  function write(time, ci, scale, idea, near, atX, atY) {
    const entries = table[ci], n = entries.length, signing = ci === SIGN;
    const depth = 36 + Math.random() * 34;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const viewH = 2 * depth * tanHalf;
    const cell = (viewH * ctx.wordPx * scale * (signing ? SIGN_SIZE : 1)) / ctx.height; // world height of one word's cell
    const sx = 2 / (viewH * camera.aspect), sy = 2 / viewH; // world size to normalised screen size
    for (let i = 0; i < n; i++) {
      cellW[i] = cell * entries[i].aspect;
      w[i] = cellW[i] * sx;
    }
    // an idea in two lines, like a short sentence: French and English, then Spanish and
    // Malagasy, indented. The signature on its own, with room below for its flourish.
    const gap = cell * sy * 0.3, lineH = cell * sy * 0.9;
    const indent = signing ? 0 : Math.min(w[0] * 0.55, cell * sx * 1.4);
    const blockW = signing ? w[0] * 1.04 : Math.max(w[0] + gap + w[1], indent + w[2] + gap + w[3]);
    const blockH = signing ? cell * sy * 1.5 : lineH * 2.1;
    if (blockW > 1.9) return false;

    // the reflection shows about as far below the horizon as the words are above
    // it, plus a little more (the eye is above the water); best kept off the title
    const horizon = ctx.floor - 0.06, below = (2 * ctx.eye.y) / (depth * tanHalf);
    let found = false;
    for (let k = 0; k < 24 && !found; k++) {
      const cx = near ? atX + (Math.random() - 0.5) * 0.15 * k : -0.96 + blockW / 2 + Math.random() * Math.max(0, 1.92 - blockW);
      const cy = near ? atY + (Math.random() - 0.5) * 0.1 * k
        : ctx.floor + blockH / 2 + Math.random() * Math.max(0, ctx.ceiling - ctx.floor - blockH);
      box.x0 = cx - blockW / 2;
      box.x1 = cx + blockW / 2;
      box.y0 = cy - blockH / 2;
      box.y1 = cy + blockH / 2;
      if (box.x0 < -0.97 || box.x1 > 0.97 || box.y0 < ctx.floor || box.y1 > ctx.ceiling) continue;
      if (overlaps(box, ctx.avoid, 0.05) || overlaps(box, ctx.sun, 0.02)) continue;
      mirrored.x0 = box.x0;
      mirrored.x1 = box.x1;
      mirrored.y0 = 2 * horizon - box.y1 - below;
      mirrored.y1 = 2 * horizon - box.y0 - below;
      if (k < 16 && overlaps(mirrored, ctx.avoid, 0.02)) continue;
      if (crowded(box, time)) continue;
      found = true;
    }
    if (!found) return false;

    const top = box.y1, left = box.x0;
    xs[0] = left + w[0] / 2;
    ys[0] = top - lineH * 0.5;
    if (!signing) {
      xs[1] = left + w[0] + gap + w[1] / 2;
      xs[2] = left + indent + w[2] / 2;
      xs[3] = left + indent + w[2] + gap + w[3] / 2;
      ys[1] = top - lineH * 0.6;
      ys[2] = top - lineH * 1.55;
      ys[3] = top - lineH * 1.65;
    }
    const ink = signing ? signColor : inkColors[(ctx.stage() + hue++) % inkColors.length];
    const driftX = (Math.random() - 0.5) * 0.08, driftY = 0.035 + Math.random() * 0.04;
    const seed = Math.random() * 100;
    for (let i = 0; i < n; i++) {
      worldAt(xs[i], ys[i], depth, spots[i]);
      const slot = cursor;
      cursor = (cursor + 1) % SLOTS;
      const e = entries[i];
      set(iPos, slot, spots[i].x, spots[i].y, spots[i].z);
      set(iDrift, slot, driftX, driftY, 0, time);
      set(iRect, slot, e.u0, e.v0, e.u1, e.v1);
      set(iSize, slot, cellW[i], cell);
      set(iColor, slot, ink.r, ink.g, ink.b);
      set(iTime, slot, time + i * STEP, signing ? SIGN_WRITE : WRITE, time + STAY, seed);
    }
    if (signing) {
      // the flourish: from the end of the word, back underneath it, as a signature is
      // underlined; it stays as long as the word does
      const e = entries[0], start = time + SIGN_WRITE * 0.92, draw = 1.3;
      const lead = start - time + draw * 0.5; // where the word will have drifted to by mid-stroke
      v.set(driftX, driftY, 0).multiplyScalar(lead);
      from.copy(spots[0]).addScaledVector(right, cellW[0] * 0.46).addScaledVector(up, (e.baseline - 0.54) * cell).add(v);
      to.copy(spots[0]).addScaledVector(right, -cellW[0] * 0.4).addScaledVector(up, (e.baseline - 0.74) * cell).add(v);
      down.copy(up).negate();
      threads.spawn(from, to, down, gold, start, draw, cell * 0.045, STAY - FADE - (start - time) - draw, FADE);
      idea.end = time + STAY;
      idea.box.x0 = box.x0;
      idea.box.x1 = box.x1;
      idea.box.y0 = box.y0;
      idea.box.y1 = box.y1;
      return true;
    }
    // a thread from the end of each word to the start of the next, landing as that word begins
    for (let i = 0; i < 3; i++) {
      const start = time + i * STEP + WRITE * 0.85;
      const lead = start - time + 0.4; // where the words will have drifted to by mid-stroke
      const a = entries[i], b = entries[i + 1];
      from.copy(spots[i]).addScaledVector(right, cellW[i] * 0.46).addScaledVector(up, (a.baseline - 0.36) * cell)
        .add(v.set(driftX, driftY, 0).multiplyScalar(lead));
      to.copy(spots[i + 1]).addScaledVector(right, -cellW[i + 1] * 0.46).addScaledVector(up, (b.baseline - 0.36) * cell)
        .add(v.set(driftX, driftY, 0).multiplyScalar(lead));
      threads.spawn(from, to, up, gold, start, STEP - WRITE * 0.85 + 0.12, cell * 0.05);
    }
    idea.end = time + STAY;
    idea.box.x0 = box.x0;
    idea.box.x1 = box.x1;
    idea.box.y0 = box.y0;
    idea.box.y1 = box.y1;
    return true;
  }

  return {
    // a click in the sky: an idea written where it was
    writeAt(time, x, y) {
      if (live(time) > ctx.maxIdeas()) return;
      place(time, true, x, y);
    },
    // the still frame: two ideas already written, their threads drawn
    compose(time) {
      place(time - 9.1, false, 0, 0);
      place(time - 6.4, false, 0, 0);
      threads.settle();
      next = time + 3;
    },
    update(dt, time) {
      uniforms.uTime.value = time;
      if (time >= next) {
        const placed = live(time) < ctx.maxIdeas() && place(time, false, 0, 0);
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
