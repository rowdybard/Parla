// Parla — Activité: the header's living scene, built the way the techdemo is
// (three.js through an importmap, no build step, one small module per part).
//
// Two settings, and a light switch in the header between them (settings.js).
// Lights on: a beach at sunset, pink and lilac as the owner asked, waves rolling
// in over pale pink sand and sea oats swaying on the dunes. Lights off: the
// lagoon at night in the site's own colours, stars, a moon, baobabs on the far
// shore. In both, words in French, English, Spanish and Malagasy are written in
// light over the water, each carried to its translation by a thread, and now and
// then Parla, the founder's own word, signed with a flourish; the water mirrors
// them. A click in the sky writes another. It pauses off screen, in a hidden
// tab, and with the header's « Animation » toggle, and shows one still frame for
// prefers-reduced-motion.
//
// Memory follows the techdemo's no-leak rules: everything is allocated when the
// scene is built, nothing in the render loop, and destroy() gives it all back in
// the techdemo's order (loop, listeners, observers, parts, passes, renderer,
// context). The light switch fades one scene out, destroys it, and builds the
// other, so only one is ever alive. With #debug in the address,
// window.parlaScene.rebuild() does the same with one setting, for the leak test.
import * as THREE from "three";
import { createAtlas } from "./atlas.js";
import { createPost } from "./post.js";
import { SETTINGS } from "./settings.js";
import { createThreads } from "./threads.js";
import { WORDS, createWords } from "./words.js";

const host = document.getElementById("sky");
const copy = document.getElementById("skyCopy");
const toggle = document.getElementById("motionToggle");
const lightSwitch = document.getElementById("lightSwitch");
const topbar = host && host.querySelector(".topbar");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// quality tiers: pixel-ratio cap, multisampling, bloom and mirror resolution
const TIERS = [
  { pixelRatio: 1, samples: 0, bloom: 0.4, mirror: 0.35 },
  { pixelRatio: 1.5, samples: 0, bloom: 0.5, mirror: 0.45 },
  { pixelRatio: 2, samples: 4, bloom: 0.5, mirror: 0.5 }
];
const PREF = "parla:animation";
const LIGHT = "parla:light"; // "off": the night lagoon
const SWITCH_FADE = 320; // ms, as .sky-canvas's opacity transition

// the viewer's last choice, on the header straight away so its own gradient
// (shown until the scene has drawn) is already the right one
let lightsOn = true;
try { lightsOn = localStorage.getItem(LIGHT) !== "off"; } catch (e) { /* storage blocked: lights on */ }
if (host) host.classList.toggle("is-night", !lightsOn);

if (host && copy && document.getElementById("skyCanvas")) boot();

async function boot() {
  await fonts(); // the words take the accent serif's shape
  const chosen = () => (lightsOn ? SETTINGS.day : SETTINGS.night);
  let current = launch(chosen()), switching = false;

  // The light switch: fade the scene out, let it go, build the other, which
  // fades itself in once it has drawn. A flip during the fade is picked up after.
  // (This listener belongs to the page, not to any one scene, as in the techdemo.)
  function change() {
    if (switching || !current || current.setting === chosen()) return;
    switching = true;
    current.hide();
    setTimeout(() => {
      current.destroy();
      current = launch(chosen());
      switching = false;
      change();
    }, reducedMotion.matches ? 0 : SWITCH_FADE);
  }
  if (current && lightSwitch) {
    lightSwitch.setAttribute("aria-checked", String(lightsOn));
    lightSwitch.hidden = false;
    lightSwitch.addEventListener("click", () => {
      lightsOn = !lightsOn;
      try { localStorage.setItem(LIGHT, lightsOn ? "on" : "off"); } catch (e) { /* not remembered */ }
      lightSwitch.setAttribute("aria-checked", String(lightsOn));
      host.classList.toggle("is-night", !lightsOn);
      change();
    });
  }

  if (!location.hash.includes("debug")) return;
  // for tests: drive the scene, read its counts, and rebuild it
  window.parlaScene = {
    rebuild() {
      if (current) current.destroy();
      current = launch(chosen());
    },
    destroy() {
      if (current) current.destroy();
      current = null;
    },
    setting: () => current && !switching ? current.setting.name : null,
    get renderer() { return current && current.renderer; },
    info: () => current.renderer.info,
    tier: () => current.tier(),
    time: () => current.time(),
    step: seconds => current.step(seconds),
    frameInfo: () => current.frameInfo()
  };
}

function launch(setting) {
  const canvas = document.getElementById("skyCanvas");
  try {
    return createScene(canvas, setting);
  } catch (error) {
    console.warn("Parla: the header scene could not start.", error);
    canvas.style.visibility = "hidden"; // the header's own gradient shows instead
    return null;
  }
}

function fonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loaded = document.fonts.load('italic 400 128px "Instrument Serif"', "Bonjour").catch(() => {});
  return Promise.race([loaded, new Promise(done => setTimeout(done, 2500))]);
}

// which of the five cards is open in the editor (it tints the words)
function activeCard() {
  const tab = document.querySelector("#cardNavigation .card-tab.active");
  let i = 0;
  for (let el = tab && tab.previousElementSibling; el; el = el.previousElementSibling) {
    if (el.classList.contains("card-tab")) i++;
  }
  return i;
}

function createScene(canvas, setting) {
  const abort = new AbortController();
  const { signal } = abort;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.toneMapping = setting.toneMapping;
  renderer.toneMappingExposure = setting.exposure;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 6000);
  camera.layers.enable(setting.layer); // the sun or moon (the water's mirror leaves it out)
  const EYE = setting.eye, LOOK = setting.look;
  const lightDir = new THREE.Vector3(0.2, 0.05, -1).normalize(); // towards the sun or moon
  const rest = () => {
    camera.position.copy(EYE);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
  };
  rest();

  const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
  let tier = phone ? 1 : 2;
  // shared with the parts; the boxes are in normalised screen space, measured on resize
  const ctx = {
    scene, camera, lightDir, eye: EYE, ink: setting.ink, atlas: null,
    height: 1, wordPx: 60, floor: -0.1, ceiling: 0.8, wide: true,
    avoid: { x0: 9, x1: 9, y0: 9, y1: 9 }, // the title and its subtitle
    light: { x0: 9, x1: 9, y0: 9, y1: 9 }, // the sun or moon
    stage: activeCard,
    maxIdeas: () => (ctx.wide ? 3 : 2)
  };

  // the parts, updated in this order and disposed in reverse: the place, then the words
  const parts = [];
  const add = part => {
    parts.push(part);
    return part;
  };
  let water = null, words = null, threads = null, post = null;
  let viewObserver = null, sizeObserver = null, destroyed = false;
  try {
    ctx.atlas = createAtlas(WORDS);
    water = setting.build(ctx, add);
    threads = ctx.threads = add(createThreads(ctx));
    words = add(createWords(ctx));
    post = createPost(renderer, scene, camera, setting.bloom);
  } catch (error) {
    destroy();
    throw error;
  }

  // where the words may go: above the horizon, below the top bar, clear of the title
  const v = new THREE.Vector3(), at = new THREE.Vector2();
  function measure() {
    const frameBox = host.getBoundingClientRect(), w = frameBox.width, h = frameBox.height;
    const ndcX = px => (px / w) * 2 - 1, ndcY = py => 1 - (py / h) * 2;
    const c = copy.getBoundingClientRect();
    ctx.avoid.x0 = ndcX(c.left - frameBox.left);
    ctx.avoid.x1 = ndcX(c.right - frameBox.left);
    ctx.avoid.y0 = ndcY(c.bottom - frameBox.top);
    ctx.avoid.y1 = ndcY(c.top - frameBox.top);
    ctx.ceiling = topbar ? ndcY(topbar.getBoundingClientRect().bottom - frameBox.top) - 0.04 : 0.8;
    ctx.floor = v.set(0, 0, -5000).project(camera).y + 0.06;
    ctx.height = h;
    ctx.wide = w >= 700;
    ctx.wordPx = ctx.wide ? Math.min(Math.max(h * 0.095, 44), 64) : Math.min(Math.max(h * 0.085, 34), 44);
    // keep the words off the sun or moon
    const box = setting.lightBox;
    v.copy(camera.position).addScaledVector(lightDir, 100).project(camera);
    ctx.light.x0 = v.x - box.half;
    ctx.light.x1 = v.x + box.half;
    ctx.light.y0 = v.y - box.below;
    ctx.light.y1 = v.y + box.above;
  }

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), t = TIERS[tier];
    const pixelRatio = Math.min(window.devicePixelRatio || 1, t.pixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSamples(t.samples); // a new target only when the tier's samples change; the old ones are disposed
    post.setSize(w, h, pixelRatio, t.bloom);
    water.setSize(w * pixelRatio * t.mirror, h * pixelRatio * t.mirror);
    rest();
    // where the setting puts its sun or moon, whatever the frame's shape
    const horizon = v.set(0, 0, -5000).project(camera).y;
    setting.light(w > h, horizon, at);
    lightDir.set(at.x, at.y, 0.5).unproject(camera).sub(camera.position).normalize();
    measure();
  }

  // ----- the loop: nothing in it allocates -----
  let time = 0, last = 0, running = false, animate = false, onScreen = true, still = false, shown = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let warm = 0, frames = 0, spent = 0;

  function frame(now) {
    // clamped, so a stall or a long pause never jumps the scene on
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    time += dt;
    // a little parallax with the pointer
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 1.6);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 1.6);
    camera.position.set(EYE.x + pointer.sx * 0.9, EYE.y - pointer.sy * 0.35, EYE.z);
    camera.lookAt(LOOK);
    for (let i = 0; i < parts.length; i++) parts[i].update(dt, time);
    post.render();
    if (!revealed) reveal();
    watch(dt);
  }

  // the canvas fades in (CSS) once it has something on it, over the header's gradient
  let revealed = false;
  function reveal() {
    revealed = true;
    canvas.classList.add("is-on");
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
    for (let i = 0; i < parts.length; i++) if (!(still && parts[i] === threads)) parts[i].update(0, time);
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
      reveal();
    }
    shown = true;
    animate = on;
    sync();
  }

  // ----- events: every listener takes the one signal, so destroy() removes them all -----
  if (toggle) {
    toggle.addEventListener("click", () => {
      wanted = !wanted;
      try { localStorage.setItem(PREF, wanted ? "on" : "off"); } catch (e) { /* not remembered */ }
      apply();
    }, { signal });
  }
  reduced.addEventListener("change", apply, { signal });
  document.addEventListener("visibilitychange", sync, { signal });
  viewObserver = new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    sync();
  });
  viewObserver.observe(host);
  sizeObserver = new ResizeObserver(() => {
    resize();
    if (shown && !running) redraw(); // resizing clears the canvas
  });
  sizeObserver.observe(host);
  // ResizeObserver doesn't report a new pixel ratio (a window dragged to another screen)
  const watchPixelRatio = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", () => {
      resize();
      if (shown && !running) redraw();
      watchPixelRatio();
    }, { once: true, signal });
  };
  watchPixelRatio();
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
  // the GPU took the context back: let everything go, and the header's own gradient shows
  canvas.addEventListener("webglcontextlost", () => destroy(), { signal });

  resize();
  // compile the shaders off the main thread where the browser can, then start. They're
  // compiled for the composer's target, where the scene is drawn: compiled for the
  // screen they'd be other variants (tone mapped), and the real ones would still stall.
  if (renderer.extensions.has("KHR_parallel_shader_compile")) {
    renderer.setRenderTarget(post.target);
    const compiling = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    compiling.catch(() => {}).then(() => {
      if (!destroyed) apply();
    });
  } else apply();

  // The techdemo's teardown order (its no-leak rule 8).
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    renderer.setAnimationLoop(null);
    abort.abort();
    if (viewObserver) viewObserver.disconnect();
    if (sizeObserver) sizeObserver.disconnect();
    for (let i = parts.length - 1; i >= 0; i--) parts[i].dispose();
    parts.length = 0;
    if (ctx.atlas) ctx.atlas.dispose();
    if (post) post.dispose();
    const lost = renderer.getContext().isContextLost();
    renderer.dispose();
    if (!lost) renderer.forceContextLoss(); // browsers cap how many contexts can be alive
    // a canvas keeps its lost context: leave a fresh one in its place, hidden until drawn on
    const fresh = canvas.cloneNode(false);
    fresh.classList.remove("is-on");
    canvas.replaceWith(fresh);
    host.classList.remove("is-live");
    if (toggle) toggle.hidden = true;
  }

  return {
    setting,
    destroy,
    // fades the canvas out (the light switch, before destroy)
    hide() { canvas.classList.remove("is-on"); },
    renderer,
    tier: () => tier,
    time: () => time,
    // moves the scene on by `seconds` without waiting for frames (slow software WebGL in tests)
    step(seconds) {
      for (let s = 0; s < seconds; s += 1 / 30) {
        time += 1 / 30;
        for (let i = 0; i < parts.length; i++) parts[i].update(1 / 30, time);
      }
      post.render();
    },
    // draw calls and triangles for one whole frame (mirror and bloom included), and memory
    frameInfo() {
      renderer.info.autoReset = false;
      renderer.info.reset();
      post.render();
      const { calls, triangles } = renderer.info.render;
      renderer.info.autoReset = true;
      const { geometries, textures } = renderer.info.memory;
      return { calls, triangles, geometries, textures, programs: renderer.info.programs.length };
    }
  };
}
