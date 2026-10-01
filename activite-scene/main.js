// Parla — Activité: the header's living scene, built the way the techdemo is
// (three.js through an importmap, no build step, one small module per part).
//
// A night lagoon in the site's colours. Words in French, English, Spanish and
// Malagasy are written in light above the water, each carried to its
// translation by a thread of light; the lagoon mirrors them; a vanilla moon
// glitters on the ripples, and baobabs stand on the far shore. A click in the sky
// writes another. It pauses off screen, in a hidden tab, and with the header's
// « Animation » toggle, and shows one still frame for prefers-reduced-motion.
import * as THREE from "three";
import { createAtlas } from "./atlas.js";
import { createPost } from "./post.js";
import { createShore } from "./shore.js";
import { createSky, MOON_LAYER } from "./sky.js";
import { createThreads } from "./threads.js";
import { createWater } from "./water.js";
import { CONCEPTS, createWords } from "./words.js";

const host = document.getElementById("sky");
const canvas = document.getElementById("skyCanvas");
const copy = document.getElementById("skyCopy");
const toggle = document.getElementById("motionToggle");
const topbar = host && host.querySelector(".topbar");

// quality tiers: pixel-ratio cap, multisampling, bloom and mirror resolution
const TIERS = [
  { pixelRatio: 1, samples: 0, bloom: 0.4, mirror: 0.35 },
  { pixelRatio: 1.5, samples: 0, bloom: 0.5, mirror: 0.45 },
  { pixelRatio: 2, samples: 4, bloom: 0.5, mirror: 0.5 }
];
const EYE = new THREE.Vector3(0, 2.4, 10);
const LOOK = new THREE.Vector3(0, 7.2, -60);
const PREF = "parla:animation";

if (host && canvas && copy) {
  start().catch(error => {
    console.warn("Parla: the header scene could not start.", error);
    canvas.style.visibility = "hidden";
  });
}

function fonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loaded = document.fonts.load('italic 400 128px "Instrument Serif"', "Bonjour").catch(() => {});
  return Promise.race([loaded, new Promise(done => setTimeout(done, 2500))]);
}

function activeCard() {
  const tabs = document.querySelectorAll("#cardNavigation .card-tab");
  for (let i = 0; i < tabs.length; i++) if (tabs[i].classList.contains("active")) return i;
  return 0;
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 6000);
  camera.layers.enable(MOON_LAYER);
  const moonDir = new THREE.Vector3(0.4, 0.2, -1).normalize();
  const rest = () => {
    camera.position.copy(EYE);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
  };
  rest();

  await fonts(); // the words take the accent serif's shape

  const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
  let tier = phone ? 1 : 2;
  const ctx = {
    scene, camera, moonDir, eye: EYE,
    atlas: createAtlas(CONCEPTS.flat()),
    height: 1, wordPx: 60, floor: -0.1, ceiling: 0.8, avoid: null, wide: true,
    stage: activeCard,
    maxIdeas: () => (ctx.wide ? 3 : 2)
  };
  const sky = createSky(ctx);
  ctx.horizon = sky.horizon;
  const water = createWater(ctx);
  const shore = createShore(ctx);
  const threads = (ctx.threads = createThreads(ctx));
  const words = createWords(ctx);
  const post = createPost(renderer, scene, camera);
  const parts = [sky, water, shore, words, threads];

  // where the words may go, in normalised screen space: above the horizon,
  // below the top bar, clear of the title
  const v = new THREE.Vector3();
  function measure() {
    const box = host.getBoundingClientRect(), w = box.width, h = box.height;
    const ndcX = px => (px / w) * 2 - 1, ndcY = py => 1 - (py / h) * 2;
    const c = copy.getBoundingClientRect();
    ctx.avoid = { x0: ndcX(c.left - box.left), x1: ndcX(c.right - box.left), y0: ndcY(c.bottom - box.top), y1: ndcY(c.top - box.top) };
    ctx.ceiling = topbar ? ndcY(topbar.getBoundingClientRect().bottom - box.top) - 0.04 : 0.8;
    ctx.floor = v.set(0, 0, -5000).project(camera).y + 0.06;
    ctx.height = h;
    ctx.wide = w >= 700;
    ctx.wordPx = ctx.wide ? Math.min(Math.max(h * 0.095, 44), 64) : Math.min(Math.max(h * 0.085, 34), 44);
    // keep the words off the moon
    v.copy(camera.position).addScaledVector(moonDir, 100).project(camera);
    ctx.moon = { x0: v.x - 0.07, x1: v.x + 0.07, y0: v.y - 0.12, y1: v.y + 0.12 };
  }

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), t = TIERS[tier];
    const pixelRatio = Math.min(window.devicePixelRatio || 1, t.pixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSamples(t.samples);
    post.setSize(w, h, pixelRatio, t.bloom);
    water.setSize(w * pixelRatio * t.mirror, h * pixelRatio * t.mirror);
    rest();
    // the moon high on the right of the frame, whatever its shape
    moonDir.set(w > h ? 0.46 : 0.42, 0.5, 0.5).unproject(camera).sub(camera.position).normalize();
    measure();
  }

  // ----- the loop -----
  let time = 0, last = 0, running = false, animate = false, onScreen = true, still = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let warm = 0, frames = 0, spent = 0;

  function frame(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    time += dt;
    // a little parallax with the pointer
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 1.6);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 1.6);
    camera.position.set(EYE.x + pointer.sx * 0.9, EYE.y - pointer.sy * 0.35, EYE.z);
    camera.lookAt(LOOK);
    for (const part of parts) part.update(dt, time);
    post.render();
    watch(dt);
  }

  // if frames keep running slow, step down a tier (as the techdemo does)
  function watch(dt) {
    if (tier === 0 || (warm += dt) < 1.2) return;
    frames++;
    spent += dt;
    if (frames < 90) return;
    if (spent / frames > 0.022) {
      tier--;
      warm = 0;
      resize();
    }
    frames = spent = 0;
  }

  // draws the scene as it stands, without moving it on
  function redraw() {
    for (const part of parts) if (!(still && part === threads)) part.update(0, time);
    if (still) threads.settle();
    post.render();
  }

  function sync() {
    const run = animate && onScreen && !document.hidden;
    if (run === running) return;
    running = run;
    last = 0;
    renderer.setAnimationLoop(run ? frame : null);
  }

  let wanted = true;
  try { wanted = localStorage.getItem(PREF) !== "off"; } catch (e) { /* storage blocked: animation stays on */ }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let shown = false;

  function apply() {
    const on = wanted && !reduced.matches;
    if (toggle) {
      toggle.hidden = reduced.matches;
      toggle.setAttribute("aria-pressed", String(wanted));
    }
    host.classList.toggle("is-live", on);
    if (on && still) {
      // leave the composed frame: its threads let go as the scene moves on
      still = false;
      threads.release(time);
    }
    if (!on && !shown) {
      // nothing drawn yet: compose a still frame (two ideas written, threads drawn)
      still = true;
      rest();
      words.compose(time);
      redraw();
    }
    shown = true;
    animate = on;
    sync();
  }

  // ----- events -----
  const signal = new AbortController().signal;
  if (toggle) {
    toggle.addEventListener("click", () => {
      wanted = !wanted;
      try { localStorage.setItem(PREF, wanted ? "on" : "off"); } catch (e) { /* not remembered */ }
      apply();
    }, { signal });
  }
  reduced.addEventListener("change", apply, { signal });
  document.addEventListener("visibilitychange", sync, { signal });
  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    sync();
  }).observe(host);
  new ResizeObserver(() => {
    resize();
    if (!running) redraw(); // resizing clears the canvas
  }).observe(host);
  if (matchMedia("(pointer: fine)").matches) {
    host.addEventListener("pointermove", e => {
      const box = host.getBoundingClientRect();
      pointer.x = ((e.clientX - box.left) / box.width) * 2 - 1;
      pointer.y = ((e.clientY - box.top) / box.height) * 2 - 1;
    }, { signal });
    host.addEventListener("pointerleave", () => { pointer.x = pointer.y = 0; }, { signal });
  }
  host.addEventListener("click", e => {
    if (!running || e.target.closest("a, button")) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const box = host.getBoundingClientRect();
    words.writeAt(time, ((e.clientX - box.left) / box.width) * 2 - 1, 1 - ((e.clientY - box.top) / box.height) * 2);
  }, { signal });
  canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    canvas.style.visibility = "hidden"; // the header's own night background shows instead
  }, { signal });

  resize();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compiles on first frame instead */ }
  apply();

  if (location.hash.includes("debug")) {
    window.parlaScene = {
      renderer, info: () => renderer.info, tier: () => tier, time: () => time,
      // moves the scene on by `seconds` without waiting for frames (slow software WebGL in tests)
      step(seconds) {
        for (let s = 0; s < seconds; s += 1 / 30) {
          time += 1 / 30;
          for (const part of parts) part.update(1 / 30, time);
        }
        post.render();
      },
      // draw calls and triangles for one whole frame, mirror and bloom included
      frameInfo() {
        renderer.info.autoReset = false;
        renderer.info.reset();
        post.render();
        const { calls, triangles } = renderer.info.render;
        renderer.info.autoReset = true;
        return { calls, triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length };
      }
    };
  }
}
