// Every word the scene writes, drawn once into one texture in the site's
// accent serif (Instrument Serif italic). Only the coverage is kept (one
// channel), and each entry remembers its rectangle in the texture.
import * as THREE from "three";

const FONT = px => `italic 400 ${px}px "Instrument Serif", "Iowan Old Style", Georgia, serif`;
const WIDTH = 2048;
const PAD = 10;

const WORD_PX = 128;

export function createAtlas(words) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const items = [];
  const measure = (text, px) => {
    ctx.font = FONT(px);
    const m = ctx.measureText(text);
    const left = Math.ceil(m.actualBoundingBoxLeft) + PAD, right = Math.ceil(m.actualBoundingBoxRight) + PAD;
    const ascent = Math.ceil(m.actualBoundingBoxAscent) + PAD, descent = Math.ceil(m.actualBoundingBoxDescent) + PAD;
    items.push({ key: px + "|" + text, text, px, left, ascent, w: left + right, h: ascent + descent });
  };
  for (const text of words) measure(text, WORD_PX);

  // shelves, left to right, top to bottom
  let x = 0, y = 0, row = 0;
  for (const it of items) {
    if (x + it.w > WIDTH) { x = 0; y += row; row = 0; }
    it.x = x;
    it.y = y;
    x += it.w;
    row = Math.max(row, it.h);
  }
  const height = 2 ** Math.ceil(Math.log2(y + row));
  canvas.width = WIDTH;
  canvas.height = height;
  ctx.fillStyle = "#fff";
  for (const it of items) {
    ctx.font = FONT(it.px);
    ctx.fillText(it.text, it.x + it.left, it.y + it.ascent);
  }
  const rgba = ctx.getImageData(0, 0, WIDTH, height).data;
  const coverage = new Uint8Array(WIDTH * height);
  for (let i = 0; i < coverage.length; i++) coverage[i] = rgba[i * 4 + 3];
  canvas.width = canvas.height = 1; // let the drawing go

  const texture = new THREE.DataTexture(coverage, WIDTH, height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  // rows of the canvas are rows of the texture, so v grows downwards here:
  // (u0, v0) is the bottom-left of the entry, (u1, v1) its top-right
  const entries = new Map();
  for (const it of items) {
    entries.set(it.key, {
      u0: it.x / WIDTH, v0: (it.y + it.h) / height, u1: (it.x + it.w) / WIDTH, v1: it.y / height,
      aspect: it.w / it.h,
      baseline: 1 - it.ascent / it.h // height of the baseline in the entry, from its bottom
    });
  }
  return {
    texture,
    word: text => entries.get(WORD_PX + "|" + text),
    dispose() { texture.dispose(); }
  };
}
