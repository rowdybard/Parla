// The beach's shape, the same in JavaScript and GLSL (as in the techdemo): a
// shoreline that starts near the viewer and runs away to the right, a gentle
// beach rising from it, dunes higher up, and a hummock of sea oats close by.
// x is across the view, z towards the viewer, y up; the sea lies to the left.

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// metres from the resting waterline, positive towards land
export function shoreDistance(x, z) {
  return 0.961 * (x - 3) + 0.2766 * (z + 2) + 0.7 * Math.sin(z * 0.06 + 1);
}

export function sandHeight(x, z) {
  const d = shoreDistance(x, z);
  const dune = smooth(6, 15, d) * (1.5 + 0.5 * Math.sin(z * 0.11 + 0.7));
  const hx = x - 6.4, hz = z - 0.8;
  return Math.max(-4, d * 0.055 + dune + 0.6 * Math.exp(-(hx * hx + hz * hz) / 9));
}

export const terrain = /* glsl */ `
  float shoreDistance(vec2 p) {
    return 0.961 * (p.x - 3.0) + 0.2766 * (p.y + 2.0) + 0.7 * sin(p.y * 0.06 + 1.0);
  }
  float sandHeight(vec2 p) {
    float d = shoreDistance(p);
    float dune = smoothstep(6.0, 15.0, d) * (1.5 + 0.5 * sin(p.y * 0.11 + 0.7));
    vec2 h = p - vec2(6.4, 0.8);
    return max(-4.0, d * 0.055 + dune + 0.6 * exp(-dot(h, h) / 9.0));
  }
`;

// The swash: the sea rises and falls a few centimetres, so its edge runs up and
// down the beach (the sea and the sand both follow it).
export function seaLevel(time) {
  return 0.055 * Math.sin(time * 0.55) + 0.03 * Math.sin(time * 0.9 + 1.2);
}
