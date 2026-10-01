// The far shore: a low ridge with baobabs standing on it, dark against the glow
// on the horizon (the Avenue of the Baobabs at dusk), mirrored in the lagoon.
// One merged mesh, the same every visit (seeded).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { color } from "./palette.js";

const DEPTH = -360;
const FROM = 24;
const TO = 820;

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(x) {
  const fade = Math.min(1, (x - FROM) / 60) * Math.min(1, (TO - x) / 60);
  return fade * (2.6 + 1.5 * Math.sin(x * 0.019) + 0.8 * Math.sin(x * 0.061 + 1.3));
}

// A Grandidier's baobab: a tall bottle-shaped trunk and a flat crown of short,
// forked branches.
function baobab(rand, height, girth) {
  const profile = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    profile.push(new THREE.Vector2(girth * (1.08 - 0.34 * t + 0.1 * Math.sin(t * Math.PI)), t * height));
  }
  const parts = [new THREE.LatheGeometry(profile, 8)];
  const branches = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < branches; i++) {
    const len = height * (0.15 + rand() * 0.13);
    const lean = 0.45 + rand() * 0.65;
    const turn = (i / branches) * Math.PI * 2 + rand() * 0.5;
    const limb = new THREE.CylinderGeometry(girth * 0.08, girth * 0.2, len, 5);
    limb.translate(0, len / 2, 0);
    limb.rotateZ(lean);
    limb.rotateY(turn);
    limb.translate(0, height * 0.96, 0);
    parts.push(limb);
    // a fork at the tip
    const tip = new THREE.Vector3(0, len, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), lean)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), turn).add(new THREE.Vector3(0, height * 0.96, 0));
    for (const side of [-1, 1]) {
      const twigLen = len * (0.35 + rand() * 0.25);
      const twig = new THREE.CylinderGeometry(girth * 0.03, girth * 0.08, twigLen, 4);
      twig.translate(0, twigLen / 2, 0);
      twig.rotateZ(lean * 0.6 + side * 0.45);
      twig.rotateY(turn);
      twig.translate(tip.x, tip.y - 0.2, tip.z);
      parts.push(twig);
    }
  }
  return parts;
}

export function createShore({ scene }) {
  const rand = seeded(2026);
  const parts = [];

  const land = new THREE.Shape();
  land.moveTo(FROM, -4);
  for (let i = 0; i <= 80; i++) {
    const x = FROM + ((TO - FROM) * i) / 80;
    land.lineTo(x, ridge(x));
  }
  land.lineTo(TO, -4);
  land.closePath();
  const ground = new THREE.ShapeGeometry(land, 1);
  ground.translate(0, 0, DEPTH);
  parts.push(ground);

  for (let x = FROM + 30; x < TO - 30; x += 26 + rand() * 46) {
    const height = 15 + rand() * 13;
    const tree = baobab(rand, height, 0.9 + rand() * 0.8);
    const z = DEPTH + 2 + rand() * 6;
    const y = ridge(x) - 0.8;
    for (const g of tree) {
      g.translate(x, y, z);
      parts.push(g);
    }
  }

  const geometry = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  const material = new THREE.MeshBasicMaterial({ color: color("#050c12") });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return {
    update() {},
    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    }
  };
}
