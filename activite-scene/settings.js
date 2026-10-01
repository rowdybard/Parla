// The two settings the header's light switch flips between. Each is a recipe for
// one scene: how it's lit (tone mapping, exposure, bloom), where the camera
// stands and looks, where the sun or moon sits, the words' ink, and the parts
// that make the place (sky, water, land). main.js adds the words and threads.
import * as THREE from "three";
import { dayInk, nightInk } from "./palette.js";
import { createSky as createSunset, SUN_LAYER } from "./day/sky.js";
import { createWater as createSea } from "./day/water.js";
import { createBeach } from "./day/beach.js";
import { createGrass } from "./day/grass.js";
import { sandHeight } from "./day/terrain.js";
import { createSky as createNightSky, MOON_LAYER } from "./night/sky.js";
import { createWater as createLagoon } from "./night/water.js";
import { createShore } from "./night/shore.js";

// standing at the water's edge, looking out to sea a little to the left of the sun
const shoreEye = new THREE.Vector3(0, sandHeight(0, 10) + 1.7, 10);

export const SETTINGS = {
  // Lights on: the beach at sunset, pink and lilac, as the owner asked.
  day: {
    name: "day",
    toneMapping: THREE.NeutralToneMapping, // keeps the pinks pink (ACES washes them towards orange and grey)
    exposure: 0.92,
    bloom: { strength: 0.32, radius: 0.2, threshold: 1.0 },
    eye: shoreEye,
    look: new THREE.Vector3(-7, shoreEye.y - 3.4, -100),
    layer: SUN_LAYER,
    // the sun low over the sea, right of centre (further right on a tall screen, so
    // the words have the left of the sky), in normalised screen space
    light: (wide, horizon, out) => out.set(wide ? 0.2 : 0.5, horizon + 0.1),
    lightBox: { half: 0.08, below: 0.14, above: 0.16 }, // kept clear of words
    ink: dayInk,
    // the place, its parts handed to `add` as they're made; returns the mirror
    build({ scene, camera, lightDir, eye }, add) {
      const sky = add(createSunset({ scene, camera, sunDir: lightDir }));
      const gradient = sky.gradient; // the sky's colours, for the sea and sand to match
      const water = add(createSea({ scene, camera, sunDir: lightDir, gradient }));
      add(createBeach({ scene, gradient }));
      add(createGrass({ scene, eye }));
      return water;
    }
  },

  // Lights off: the lagoon at night, in the site's own colours, with baobabs on
  // the far shore and the moon high on the right.
  night: {
    name: "night",
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.05,
    bloom: { strength: 0.5, radius: 0.22, threshold: 1.0 },
    eye: new THREE.Vector3(0, 2.4, 10),
    look: new THREE.Vector3(0, 7.2, -60),
    layer: MOON_LAYER,
    light: (wide, horizon, out) => out.set(wide ? 0.46 : 0.5, 0.5),
    lightBox: { half: 0.07, below: 0.12, above: 0.12 },
    ink: nightInk,
    build({ scene, camera, lightDir }, add) {
      const sky = add(createNightSky({ scene, camera, moonDir: lightDir }));
      const water = add(createLagoon({ scene, camera, moonDir: lightDir, horizon: sky.horizon }));
      add(createShore({ scene }));
      return water;
    }
  }
};
