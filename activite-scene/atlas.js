// Every word the scene writes, drawn once into one texture in the site's
// accent serif (Instrument Serif italic). Only the coverage is kept (one
// channel), and each entry remembers its rectangle in the texture. The canvas
// used to draw them is let go as soon as its pixels are read (as in the techdemo).
import * as THREE from "three";

const FONT = `italic 400 128px "Instrument Serif", "Iowan Old Style", Georgia, serif`;
const WIDTH = 2048;
const PAD = 10;

// Draws the words on shelves, left to right, top to bottom; returns their
// coverage and where each one went.
function rasterize(words) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = FONT;
  const items = words.map(text => {
    const m = ctx.measureText(text);
    const left = Math.ceil(m.actualBoundingBoxLeft) + PAD, right = Math.ceil(m.actualBoundingBoxRight) + PAD;
    const ascent = Math.ceil(m.actualBoundingBoxAscent) + PAD, descent = Math.ceil(m.actualBoundingBoxDescent) + PAD;
    return { text, left, ascent, w: left + right, h: ascent + descent, x: 0, y: 0 };
  });
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
  ctx.font = FONT; // resizing the canvas resets it
  ctx.fillStyle = "#fff";
  for (const it of items) ctx.fillText(it.text, it.x + it.left, it.y + it.ascent);
  const rgba = ctx.getImageData(0, 0, WIDTH, height).data;
  const coverage = new Uint8Array(WIDTH * height);
  for (let i = 0; i < coverage.length; i++) coverage[i] = rgba[i * 4 + 3];
  canvas.width = canvas.height = 1; // let the drawing go
  return { coverage, height, items };
}

export function createAtlas(words) {
  const { coverage, height, items } = rasterize(words);
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
    entries.set(it.text, {
      u0: it.x / WIDTH, v0: (it.y + it.h) / height, u1: (it.x + it.w) / WIDTH, v1: it.y / height,
      aspect: it.w / it.h,
      baseline: 1 - it.ascent / it.h // height of the baseline in the entry, from its bottom
    });
  }
  return {
    texture,
    word: text => entries.get(text),
    dispose() { texture.dispose(); }
  };
}
