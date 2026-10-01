// Colours: the site's own tokens (style.css and activite.html), and the sunset
// the owner asked for: pink and lilac, gold at the sun, pale pink sand.
import * as THREE from "three";

const root = getComputedStyle(document.documentElement);
function token(name, fallback) {
  const value = root.getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export const hex = {
  vanilla: token("--vanilla", "#ffc46b"),
  // the five card stages, as on the stripe under the header
  stage: ["--s1", "--s2", "--s3", "--s4", "--s5"].map((name, i) =>
    token(name, ["#e8a63a", "#2fbf8f", "#1D9E75", "#0F6E56", "#2c5d7c"][i]))
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

// Ink for the words: white, then soft gold, blush and lilac, one idea each,
// with a soft plum halo so they read against the bright sky.
export const inks = ["#ffffff", "#ffe6b0", "#ffe0ec", "#f3ebff"];
// Parla, the founder's own word: a warm white, signed in gold
export const signInk = "#fff3dd";
export const halo = "#5a2a63";

// A three.js colour (linear), optionally pushed past 1 so the bloom picks it up.
export const color = (h, intensity = 1) => new THREE.Color(h).multiplyScalar(intensity);
