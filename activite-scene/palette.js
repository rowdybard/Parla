// Colours: the site's own tokens (style.css and activite.html), the sunset the
// owner asked for (pink and lilac, gold at the sun, pale pink sand), and the
// night over the lagoon in the site's own night colours.
import * as THREE from "three";

const root = getComputedStyle(document.documentElement);
function token(name, fallback) {
  const value = root.getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export const hex = {
  night: token("--night", "#08141d"),
  night2: token("--night-2", "#0e2130"),
  paper: token("--night-paper", "#eef4f2"),
  lagoon: token("--lagoon", "#3fd3a2"),
  vanilla: token("--vanilla", "#ffc46b"),
  // the five card stages, as on the stripe under the header
  stage: ["--s1", "--s2", "--s3", "--s4", "--s5"].map((name, i) =>
    token(name, ["#e8a63a", "#2fbf8f", "#1D9E75", "#0F6E56", "#2c5d7c"][i])),
  mint: "#96d6be", // the land dots of the landing-page globe
  ocean: "#7fb8dc" // --s5 lifted for the night, the way --lagoon lifts Parla green
};

export const sunset = {
  zenith: "#5d5cb9", // periwinkle-violet overhead
  high: "#a372d4", // orchid
  low: "#ff6aa5", // hot pink
  horizon: "#ff8e80", // coral at the waterline
  gold: "#ffb45e", // towards the sun
  sun: "#fff1d0",
  cloudPink: "#ff3f86", // magenta, lit from below
  cloudLilac: "#b98ee0",
  sea: "#3f4797", // deep water, indigo-violet
  shallow: "#7aa6d8", // near the shore
  foam: "#fff3f6",
  sand: "#eab6c5", // pink sand
  sandShade: "#9a85c2", // lilac in the shade
  wetSand: "#a86d8c",
  grass: "#4b2c3d",
  grassTip: "#9a6457"
};

// Ink for the words. By day: white, soft gold, blush and lilac, one idea each,
// with a soft plum halo so they read against the bright sky, and gold threads.
// Parla, the founder's own word, in a warm white, signed in gold.
export const dayInk = {
  colors: ["#ffffff", "#ffe6b0", "#ffe0ec", "#f3ebff"],
  sign: "#fff3dd",
  halo: "#5a2a63",
  thread: sunset.gold,
  flourish: sunset.gold,
  boost: 1.25, // pushed past white a little, so the bloom picks them up
  signBoost: 1.4
};
// By night the words are light itself, in the site's colours (one per card
// stage, then amber), each idea's thread in its own colour, and no halo; Parla
// in moonlight, signed in vanilla.
export const nightInk = {
  colors: [hex.vanilla, hex.stage[1], hex.lagoon, hex.mint, hex.ocean, "#e8a63a"], // amber last
  sign: "#fff3dc",
  halo: null,
  thread: null,
  flourish: hex.vanilla,
  boost: 1.4,
  signBoost: 1.05 // it's added to the night, with more bloom: it needs less push
};

// A three.js colour (linear), optionally pushed past 1 so the bloom picks it up.
export const color = (h, intensity = 1) => new THREE.Color(h).multiplyScalar(intensity);
