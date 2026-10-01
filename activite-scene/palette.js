// The site's own colours, read from its CSS tokens (style.css and activite.html).
import * as THREE from "three";

const root = getComputedStyle(document.documentElement);
function token(name, fallback) {
  const value = root.getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export const hex = {
  night: token("--night", "#08141d"),
  night2: token("--night-2", "#0e2130"),
  line: token("--night-line", "#1f3a4c"),
  paper: token("--night-paper", "#eef4f2"),
  mist: token("--night-mist", "#9db3c2"),
  lagoon: token("--lagoon", "#3fd3a2"),
  vanilla: token("--vanilla", "#ffc46b"),
  // the five card stages, as on the stripe under the header
  stage: ["--s1", "--s2", "--s3", "--s4", "--s5"].map((name, i) =>
    token(name, ["#e8a63a", "#2fbf8f", "#1D9E75", "#0F6E56", "#2c5d7c"][i])),
  mint: "#96d6be", // the land dots of the landing-page globe
  ocean: "#7fb8dc" // --s5 lifted for the night, the way --lagoon lifts Parla green
};

// Colours bright enough to glow against the night: one per card stage, then amber.
export const glow = [hex.vanilla, hex.stage[1], hex.lagoon, hex.mint, hex.ocean, hex.stage[0]];

// A three.js colour (linear), optionally pushed past 1 so the bloom picks it up.
export const color = (h, intensity = 1) => new THREE.Color(h).multiplyScalar(intensity);
