/* =========================================================
   Parla by Hitondra — Activité : encre de lumière
   ---------------------------------------------------------
   Night sky header: a broad-nib flourish rises and bursts
   like a firework; its sparks write a word, then flow into
   the same word in the next language (Français → English →
   Español → Malagasy) before falling as embers.
   Behind the editor: slow calligraphic ribbons in the colour
   of the active card. Adding an element throws a few sparks;
   saving the five cards sets off a small celebration.

   Honours prefers-reduced-motion (one still frame) and the
   « Animation » toggle in the header, remembered per browser.
   Colours come from the CSS tokens; no dependencies.
========================================================= */
(() => {
  "use strict";

  const sky = document.getElementById("sky");
  const skyCanvas = document.getElementById("skyCanvas");
  const skyCopy = document.getElementById("skyCopy");
  const toggle = document.getElementById("motionToggle");
  if (!sky || !skyCanvas || !skyCopy || !skyCanvas.getContext) return;
  const topbar = sky.querySelector(".topbar");

  /* ---------- helpers ---------- */

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[(Math.random() * list.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => t * t * (3 - 2 * t);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  // `to`, unwrapped to lie within half a turn of `from`
  const nearAngle = (from, to) => from + ((((to - from) % TAU) + TAU * 1.5) % TAU) - Math.PI;
  const hit = (r, x, y, m) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
  const order = keys => Array.from(keys.keys()).sort((a, b) => keys[a] - keys[b]);
  const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  };

  /* ---------- palette: the site's own tokens ---------- */

  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name, fallback) => {
    const value = rootStyle.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  // the five card stages, as on the stripe under the header
  const STAGE = [
    token("--s1", "#e8a63a"), token("--s2", "#2fbf8f"), token("--s3", "#1D9E75"),
    token("--s4", "#0F6E56"), token("--s5", "#2c5d7c")
  ];
  const VANILLA = token("--vanilla", "#ffc46b");
  const LAGOON = token("--lagoon", "#3fd3a2");
  const PAPER = token("--night-paper", "#eef4f2");
  const MIST = token("--night-mist", "#9db3c2");
  const MINT = "#96d6be";  // the land dots of the landing-page globe
  const OCEAN = "#7fb8dc"; // --s5 lifted for the night, as --lagoon lifts Parla green
  // only colours bright enough to glow on --night go in the sky
  const NIGHT = [VANILLA, STAGE[0], LAGOON, MINT, OCEAN];
  // [word, sparkle] colours in the sky for each card stage
  const STAGE_NIGHT = [[VANILLA, LAGOON], [MINT, VANILLA], [LAGOON, VANILLA], [MINT, LAGOON], [OCEAN, VANILLA]];

  /* ---------- words that flow from one language to the next ---------- */

  const LANGS = ["Français", "English", "Español", "Malagasy"];
  const CONCEPTS = [
    ["Bonjour", "Hello", "Hola", "Salama"],
    ["Merci", "Thank you", "Gracias", "Misaotra"],
    ["Apprendre", "Learn", "Aprender", "Mianatra"],
    ["Parler", "Speak", "Hablar", "Miteny"],
    ["Ensemble", "Together", "Juntos", "Miaraka"],
    ["Mots", "Words", "Palabras", "Teny"]
  ];
  const CHEERS = ["Bravo !", "Tsara be !", "¡Muy bien!", "Well done!"];

  /* ---------- inks and batched drawing ---------- */

  // Each ink caches one rgba() string per alpha level, so a frame with a few
  // thousand marks costs a few dozen fill and stroke calls, not thousands.
  const LEVELS = 24;
  const inks = new Map();
  function ink(hex) {
    let k = inks.get(hex);
    if (k) return k;
    const v = parseInt(hex.slice(1), 16);
    const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const styles = [];
    for (let i = 0; i <= LEVELS; i++) styles.push(`rgba(${rgb},${(i / LEVELS).toFixed(3)})`);
    k = { id: inks.size, rgb, styles };
    inks.set(hex, k);
    return k;
  }
  const PAPER_INK = ink(PAPER);
  const MIST_INK = ink(MIST);

  class Batch {
    constructor() { this.groups = []; this.used = []; }
    get(k, alpha) {
      const level = alpha >= 1 ? LEVELS : Math.round(alpha * LEVELS);
      if (level <= 0) return null;
      const key = k.id * (LEVELS + 1) + level;
      let g = this.groups[key];
      if (!g) g = this.groups[key] = { style: k.styles[level], quads: [], hairs: [], trails: [], dots: [], used: false };
      if (!g.used) { g.used = true; this.used.push(g); }
      return g;
    }
    flush(ctx, hairWidth, trailWidth) {
      for (const g of this.used) {
        ctx.fillStyle = ctx.strokeStyle = g.style;
        const q = g.quads, d = g.dots;
        if (q.length) {
          ctx.beginPath();
          for (let i = 0; i < q.length; i += 8) {
            ctx.moveTo(q[i], q[i + 1]);
            ctx.lineTo(q[i + 2], q[i + 3]);
            ctx.lineTo(q[i + 4], q[i + 5]);
            ctx.lineTo(q[i + 6], q[i + 7]);
            ctx.closePath();
          }
          ctx.fill();
        }
        if (d.length) {
          ctx.beginPath();
          for (let i = 0; i < d.length; i += 3) {
            const s = d[i + 2];
            ctx.rect(d[i] - s / 2, d[i + 1] - s / 2, s, s);
          }
          ctx.fill();
        }
        if (g.hairs.length) { ctx.lineWidth = hairWidth; strokeLines(ctx, g.hairs); }
        if (g.trails.length) { ctx.lineWidth = trailWidth; strokeLines(ctx, g.trails); }
        q.length = d.length = g.hairs.length = g.trails.length = 0;
        g.used = false;
      }
      this.used.length = 0;
    }
  }
  function strokeLines(ctx, l) {
    ctx.beginPath();
    for (let i = 0; i < l.length; i += 4) {
      ctx.moveTo(l[i], l[i + 1]);
      ctx.lineTo(l[i + 2], l[i + 3]);
    }
    ctx.stroke();
  }

  /* ---------- broad-nib strokes ---------- */

  // A broad nib held at a fixed angle: strokes across the nib come out thick,
  // strokes along it are hairlines. That contrast is what reads as calligraphy.
  const NIB_ANGLE = -0.72;

  class Stroke {
    constructor(k, nib, alpha, life) {
      this.k = k;
      this.alpha = alpha;
      this.life = life;
      this.ex = (Math.cos(NIB_ANGLE) * nib) / 2;
      this.ey = (Math.sin(NIB_ANGLE) * nib) / 2;
      this.p = []; // x, y, time, pressure
      this.head = 0;
      this.open = true;
    }
    add(x, y, t, w) { this.p.push(x, y, t, w); }
    // forgets faded points; false once nothing is left to draw
    prune(now) {
      const p = this.p;
      let h = this.head;
      while (h < p.length && now - p[h + 2] >= this.life) h += 4;
      if (h > 400 && h * 2 > p.length) { p.splice(0, h); h = 0; }
      this.head = h;
      return this.open || h + 4 < p.length;
    }
    draw(b, now) {
      const p = this.p, ex = this.ex, ey = this.ey;
      for (let i = this.head; i + 7 < p.length; i += 4) {
        const age = (now - p[i + 2]) / this.life;
        if (age >= 1) continue;
        const aw = p[i + 3], bw = p[i + 7];
        const g = b.get(this.k, this.alpha * Math.pow(1 - age, 1.6) * Math.min(1, (aw + bw) * 2));
        if (!g) continue;
        const ax = p[i], ay = p[i + 1], bx = p[i + 4], by = p[i + 5];
        const e1x = ex * aw, e1y = ey * aw, e2x = ex * bw, e2y = ey * bw;
        // wind every quad the same way round, so where a loop crosses itself the ink adds up instead of cancelling
        if ((bx - ax) * ey - (by - ay) * ex >= 0) g.quads.push(ax + e1x, ay + e1y, bx + e2x, by + e2y, bx - e2x, by - e2y, ax - e1x, ay - e1y);
        else g.quads.push(ax - e1x, ay - e1y, bx - e2x, by - e2y, bx + e2x, by + e2y, ax + e1x, ay + e1y);
        g.hairs.push(ax, ay, bx, by);
      }
    }
  }

  // The pen's base glides along `heading` while the nib circles it (a trochoid).
  // When the circling outruns the glide (ratio > 1) the line makes loops, like
  // joined-up handwriting; below 1 it makes waves.
  class Writer {
    constructor(layer, o) {
      this.layer = layer;
      this.bx = o.x;
      this.by = o.y;
      this.heading = o.heading || 0;
      this.speed = o.speed;
      this.loop = o.loop;
      this.ratio = o.ratio;
      this.turn = o.turn || 0;
      this.decay = o.decay || 0;
      this.fall = o.fall || 0;
      this.target = o.target || null;
      this.dur = o.dur;
      this.wobble = o.wobble ?? 1;
      this.bounded = !!o.bounded;
      this.phase = rand(0, TAU);
      this.n1 = rand(0, 50);
      this.n2 = rand(0, 50);
      this.sparkRate = o.sparkRate || 0;
      this.sparkInk = o.sparkInk || o.ink;
      this.sparkAcc = 0;
      this.t = 0;
      this.x = o.x;
      this.y = o.y;
      this.done = false;
      this.stroke = new Stroke(o.ink, o.nib, o.alpha, o.life);
      layer.strokes.push(this.stroke);
      layer.writers.push(this);
    }
    end(after) { this.dur = Math.min(this.dur, this.t + after); }
    update(dt, now) {
      // a fast nib takes several small steps per frame, so its curves stay round
      const reach = this.speed * (1 + this.ratio * 1.3) * dt;
      const n = clamp(Math.ceil(reach / 2.5), 1, 8), h = dt / n;
      for (let i = 1; i <= n && !this.done; i++) this.step(h, now - dt + h * i);
    }
    step(dt, now) {
      const t = (this.t += dt);
      if (this.target) {
        const want = Math.atan2(this.target.y - this.by, this.target.x - this.bx);
        this.heading += (nearAngle(this.heading, want) - this.heading) * Math.min(1, dt * 5);
      } else if (this.turn) {
        this.heading += (Math.sin(t * 0.8 + this.n1) * 0.7 + Math.sin(t * 2.3 + this.n2) * 0.3) * this.turn * dt;
      }
      if (this.fall) this.heading += (nearAngle(this.heading, Math.PI / 2) - this.heading) * Math.min(1, dt * this.fall);
      if (this.decay) this.speed *= Math.exp(-this.decay * dt);
      const r = this.loop * (1 + 0.3 * this.wobble * Math.sin(t * 1.3 + this.n2));
      const ratio = this.ratio * (1 + 0.25 * this.wobble * Math.sin(t * 0.7 + this.n1));
      this.phase += ((ratio * this.speed) / Math.max(2, r)) * dt;
      const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
      this.bx += fx * this.speed * dt;
      this.by += fy * this.speed * dt;
      const s = -Math.sin(this.phase) * r, c = Math.cos(this.phase) * r;
      this.x = this.bx + fx * s - fy * c;
      this.y = this.by + fy * s + fx * c;
      // pressure: the nib lands, writes and lifts
      const w = smooth(clamp(t / 0.28, 0, 1)) * smooth(clamp((this.dur - t) / 0.4, 0, 1)) * (0.85 + 0.15 * Math.sin(t * 3.1 + this.n1));
      this.stroke.add(this.x, this.y, now, w);
      if (this.sparkRate) this.shed(dt);
      if (this.bounded) {
        const L = this.layer, m = 90;
        if (this.bx < -m || this.by < -m || this.bx > L.w + m || this.by > L.h + m) this.end(0);
      }
      if (t >= this.dur) {
        this.done = true;
        this.stroke.open = false;
      }
    }
    shed(dt) {
      for (this.sparkAcc += this.sparkRate * dt; this.sparkAcc >= 1; this.sparkAcc--) {
        this.layer.parts.push(particle(this.x, this.y, rand(-30, 30), rand(-20, 25), this.sparkInk,
          { life: rand(0.35, 0.75), size: rand(1, 1.7), drag: 1.6, grav: 90, flick: true }));
      }
    }
  }

  /* ---------- sparks ---------- */

  function particle(x, y, vx, vy, k, o) {
    return {
      x, y, vx, vy, k, age: 0, life: o.life, k2: o.k2 || null, size: o.size, drag: o.drag ?? 2,
      grav: o.grav || 0, a: o.a ?? 1, fade: o.fade ?? true, flick: !!o.flick, onEnd: o.onEnd || null
    };
  }

  // a firework shell: most sparks on the rim, a few inside; `dir` and `spread` aim it
  function burst(layer, x, y, k, n, power, o = {}) {
    const life = o.life || [0.9, 1.5], size = o.size || [1.2, 2];
    const dir = o.dir ?? 0, spread = o.spread ?? Math.PI;
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-spread, spread);
      const s = power * (Math.random() < 0.72 ? rand(0.78, 1) : rand(0.15, 0.78));
      const kk = o.glint && Math.random() < o.glint ? o.glintInk : k;
      layer.parts.push(particle(x, y, Math.cos(a) * s, Math.sin(a) * s, kk, {
        life: rand(life[0], life[1]), size: rand(size[0], size[1]), drag: o.drag ?? 2.3,
        grav: o.grav ?? 40, k2: o.k2, flick: o.flick ?? true, a: o.a
      }));
    }
  }

  function updateParts(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list[i] = list[list.length - 1];
        list.pop();
        if (p.onEnd) p.onEnd(p);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParts(b, list, trailK) {
    for (const p of list) {
      const life = p.age / p.life;
      let a = p.a * (p.fade ? Math.pow(1 - life, 1.3) : 1);
      if (p.flick && Math.random() < 0.07) a = Math.min(1, a * 1.9);
      const k = p.k2 && life > 0.5 ? p.k2 : p.k;
      const g = b.get(k, a);
      if (!g) continue;
      g.dots.push(p.x, p.y, p.size);
      if (p.vx * p.vx + p.vy * p.vy > 900) {
        const tg = b.get(k, a * 0.55);
        if (tg) tg.trails.push(p.x - p.vx * trailK, p.y - p.vy * trailK, p.x, p.y);
      }
    }
  }

  function drawFlash(ctx, f) {
    const u = f.t / f.dur, r = f.r * (0.3 + 0.7 * easeOut(u)), a = Math.pow(1 - u, 2);
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,250,240,${(0.9 * a).toFixed(3)})`);
    g.addColorStop(0.25, `rgba(${f.k.rgb},${(0.45 * a).toFixed(3)})`);
    g.addColorStop(1, `rgba(${f.k.rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r, 0, TAU);
    ctx.fill();
  }

  /* ---------- words set in sparks ---------- */

  const WORD_FONT = px => `italic 400 ${px}px "Instrument Serif", "Iowan Old Style", Georgia, serif`;
  const CAPTION_FONT = '600 10.5px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const HAS_SPACING = "letterSpacing" in CanvasRenderingContext2D.prototype;
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  const rasters = new Map();

  function measure(text, px) {
    sctx.font = WORD_FONT(px);
    return sctx.measureText(text).width;
  }

  // the ink pixels of a word in the accent serif, centred on its ink box
  function raster(text, px) {
    const key = px + "|" + text;
    let r = rasters.get(key);
    if (r) return r;
    const pad = Math.ceil(px * 0.4);
    const w = Math.ceil(measure(text, px)) + pad * 2, h = Math.ceil(px * 1.6);
    scratch.width = w;
    scratch.height = h;
    sctx.font = WORD_FONT(px);
    sctx.fillStyle = "#fff";
    sctx.fillText(text, pad, Math.round(px * 1.15));
    const data = sctx.getImageData(0, 0, w, h).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 127) count++;
    const xs = new Float32Array(count), ys = new Float32Array(count);
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0, j = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= 127) continue;
        xs[j] = x;
        ys[j] = y;
        j++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    for (let i = 0; i < count; i++) { xs[i] -= cx; ys[i] -= cy; }
    r = { xs, ys, count, w: count ? maxX - minX + 1 : 0, h: count ? maxY - minY + 1 : 0, samples: new Map() };
    if (rasters.size > 60) rasters.clear();
    rasters.set(key, r);
    return r;
  }

  // n points spread evenly over the ink: one random ink pixel per grid cell
  function pointsFor(r, n) {
    let pts = r.samples.get(n);
    if (pts) return pts;
    pts = new Float32Array(n * 2);
    if (r.count) {
      const ox = r.w / 2 + 2, oy = r.h / 2 + 2;
      let step = Math.max(1, Math.sqrt(r.count / n)), chosen = null;
      for (let pass = 0; pass < 4; pass++) {
        const cols = Math.ceil((r.w + 4) / step) + 1, rows = Math.ceil((r.h + 4) / step) + 1;
        chosen = new Int32Array(cols * rows).fill(-1);
        const seen = new Uint16Array(cols * rows);
        for (let i = 0; i < r.count; i++) {
          const c = (((r.xs[i] + ox) / step) | 0) + (((r.ys[i] + oy) / step) | 0) * cols;
          if (Math.random() * ++seen[c] < 1) chosen[c] = i;
        }
        let filled = 0;
        for (let c = 0; c < chosen.length; c++) if (chosen[c] >= 0) filled++;
        if (filled <= n * 1.06) break;
        step *= Math.sqrt(filled / n);
      }
      const list = [];
      for (let c = 0; c < chosen.length; c++) if (chosen[c] >= 0) list.push(chosen[c]);
      shuffle(list);
      for (let j = 0; j < n; j++) {
        const i = j < list.length ? list[j] : (Math.random() * r.count) | 0;
        pts[j * 2] = r.xs[i] + rand(-0.45, 0.45);
        pts[j * 2 + 1] = r.ys[i] + rand(-0.45, 0.45);
      }
    }
    r.samples.set(n, pts);
    return pts;
  }

  const DRIFT = 0, FLY = 1, HOLD = 2, FALL = 3;
  const MAX_STREAK = 34;

  // One word, or several translations of it, written by the same sparks:
  // they burst, write word 0 from left to right, rest, flow into word 1,
  // and so on, then fall as embers.
  class WordShow {
    constructor(layer, o) {
      this.layer = layer;
      this.words = o.words;
      this.x = o.x;
      this.y = o.y;
      this.px = o.px;
      this.k = o.ink;
      this.k2 = o.accent || o.ink;
      this.cool = o.cool || null;
      this.colorAt = o.colorAt || null;
      this.form = o.form ?? 0.95;
      this.hold = o.hold ?? 1.75;
      this.fall = o.fall ?? 1.9;
      this.write = o.write ?? 0.5;
      this.arc = o.arc ?? o.px * 0.35;
      this.dot = o.dot ?? 1.7;
      this.captions = o.captions !== false;
      this.swashes = o.swashes !== false;
      this.launchTime = o.launchTime ?? 1;
      this.halo = !!o.halo;     // a soft pool of light under the word, so it reads over a busy page
      this.steady = !!o.steady; // letters shimmer less
      const density = o.density ?? 7; // ink pixels per spark
      this.rasters = this.words.map(w => raster(w.text, o.px));
      this.n = clamp(Math.round(Math.max(1, ...this.rasters.map(r => r.count)) / density), o.min ?? 160, o.max ?? 900);
      this.points = this.rasters.map(r => pointsFor(r, this.n));
      // a word with less ink gets its sparks packed tighter: dim them so every word glows alike
      this.gain = this.rasters.map(r => clamp(Math.sqrt(r.count / this.n / density), 0.55, 1));
      const wide = Math.max(...this.rasters.map(r => r.w)), tall = Math.max(...this.rasters.map(r => r.h));
      this.capY = o.y + tall / 2 + 26;
      this.box = { x: o.x - wide / 2, y: o.y - tall / 2, w: wide, h: tall + 36 };
      this.parts = [];
      this.caps = [];
      this.queue = [];
      this.t = 0;
      this.cur = 0;
      this.end = Infinity;
      this.done = false;
      let t = 0;
      if (o.launch) {
        this.at(0, () => this.launch(o.launch));
        t = this.launchTime;
      }
      const origin = o.origin || { x: o.x, y: o.y };
      this.at(t, () => this.burst(origin));
      t += o.settle ?? 0.42;
      this.tWrite = t;
      this.words.forEach((_, i) => {
        this.at(t, () => this.writeWord(i));
        t += this.form + this.hold;
      });
      this.tRelease = t;
      this.at(t, () => this.release());
    }
    at(t, fn) {
      this.queue.push([t, fn]);
      this.queue.sort((a, b) => a[0] - b[0]);
    }
    launch(from) {
      const dx = this.x - from.x, dy = this.y - from.y;
      new Writer(this.layer, {
        x: from.x, y: from.y, heading: Math.atan2(dy, dx), target: { x: this.x, y: this.y },
        speed: Math.hypot(dx, dy) / this.launchTime, loop: rand(9, 15), ratio: rand(1.15, 1.5),
        dur: this.launchTime, nib: 6.5, alpha: 0.95, life: 0.85, ink: this.k,
        sparkRate: 45, sparkInk: this.k2, wobble: 0.6
      });
    }
    burst(o) {
      const power = this.px * rand(2.6, 3.3);
      for (let j = 0; j < this.n; j++) {
        const a = rand(0, TAU), s = power * (Math.random() < 0.72 ? rand(0.8, 1) : rand(0.1, 0.8)), c = Math.random();
        this.parts.push({
          x: o.x, y: o.y, ox: o.x, oy: o.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          tx: o.x, ty: o.y, hx: o.x, hy: o.y, sx: o.x, sy: o.y, t0: 0, dur: 1, arc: 0, started: false,
          mode: DRIFT, before: DRIFT, age: 0, life: 1, grav: 14, drag: 3.4, ph: rand(0, TAU),
          k: this.colorAt || c < 0.82 ? this.k : c < 0.94 ? this.k2 : PAPER_INK,
          size: this.dot * rand(0.8, 1.2)
        });
      }
      this.layer.flashes.push({ x: o.x, y: o.y, t: 0, dur: 0.4, r: this.px * 1.1, k: this.k });
    }
    writeWord(i) {
      const P = this.parts, T = this.points[i], R = this.rasters[i], n = P.length;
      const first = i === 0, cx = this.x, cy = this.y, jitter = R.w * 0.1;
      // pair sparks with letters by angle round the burst for the first word,
      // then left to right, so each spark makes a short trip
      const keyP = new Float64Array(n), keyT = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        keyP[j] = first ? Math.atan2(P[j].y - cy, P[j].x - cx) : P[j].x + rand(-jitter, jitter);
        keyT[j] = first ? Math.atan2(T[j * 2 + 1], T[j * 2]) : cx + T[j * 2] + rand(-jitter, jitter);
      }
      const ip = order(keyP), it = order(keyT);
      for (let j = 0; j < n; j++) {
        const p = P[ip[j]], q = it[j];
        if (p.mode === DRIFT) p.before = DRIFT;
        else { p.before = HOLD; p.hx = p.tx; p.hy = p.ty; }
        p.tx = cx + T[q * 2];
        p.ty = cy + T[q * 2 + 1];
        // letters appear from left to right, like handwriting
        const u = clamp((T[q * 2] + R.w / 2) / Math.max(1, R.w), 0, 1);
        p.t0 = this.t + u * this.write + rand(0, 0.08);
        p.dur = this.form * rand(0.7, 1);
        p.arc = rand(-1, 1) * this.arc;
        p.mode = FLY;
        p.started = false;
        if (this.colorAt) p.k = this.colorAt(u);
      }
      this.cur = i;
      const lang = this.words[i].lang;
      if (this.captions && lang) {
        const prev = this.caps[this.caps.length - 1];
        if (prev) prev.t1 = this.t;
        this.caps.push({ text: lang.toUpperCase(), t0: this.t + this.form * 0.55, t1: Infinity });
      }
      if (this.swashes) this.at(this.t + 0.12, () => this.swash(i));
    }
    // a calligraphic underline, written along with the letters: one or two long, slow waves
    swash(i) {
      const R = this.rasters[i], dur = this.form * 0.85;
      new Writer(this.layer, {
        x: this.x - R.w / 2 - 6, y: this.y + R.h / 2 + 10, heading: rand(-0.04, 0.02),
        speed: (R.w + 12) / dur, loop: clamp(this.px * 0.07, 3, 8), ratio: rand(0.14, 0.26), dur,
        nib: clamp(this.px * 0.06, 3, 6.5), alpha: 0.8, life: this.hold + this.form * 0.6, ink: this.k, wobble: 0.3
      });
    }
    release() {
      for (const p of this.parts) {
        p.mode = FALL;
        p.age = 0;
        p.life = rand(0.55, 1) * this.fall;
        p.vx = rand(-28, 28) + (p.x - this.x) * 0.2;
        p.vy = rand(-55, 5);
        p.grav = rand(70, 140);
        p.drag = 0.9;
      }
      const last = this.caps[this.caps.length - 1];
      if (last) last.t1 = this.t;
      this.end = this.t + this.fall;
    }
    update(dt) {
      const t = (this.t += dt);
      while (this.queue.length && this.queue[0][0] <= t) this.queue.shift()[1]();
      for (const p of this.parts) {
        p.ox = p.x;
        p.oy = p.y;
        let mode = p.mode;
        if (mode === FLY) {
          if (t < p.t0) mode = p.before;
          else if (!p.started) { p.started = true; p.sx = p.x; p.sy = p.y; }
        }
        if (mode === DRIFT || mode === FALL) {
          const drag = Math.exp(-p.drag * dt);
          p.vx *= drag;
          p.vy = p.vy * drag + p.grav * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (mode === FALL) p.age += dt;
          continue;
        }
        if (mode === FLY) {
          const u = clamp((t - p.t0) / p.dur, 0, 1), e = easeInOut(u);
          const dx = p.tx - p.sx, dy = p.ty - p.sy, len = Math.hypot(dx, dy) || 1;
          const bend = Math.sin(Math.PI * u) * p.arc * Math.min(1, len / 80);
          p.x = p.sx + dx * e - (dy / len) * bend;
          p.y = p.sy + dy * e + (dx / len) * bend;
          if (u >= 1) { p.mode = HOLD; p.hx = p.tx; p.hy = p.ty; }
        } else {
          // resting in a letter: breathe a little
          p.x = p.hx + Math.sin(t * 2.3 + p.ph) * 0.45;
          p.y = p.hy + Math.cos(t * 1.9 + p.ph) * 0.45;
        }
        p.vx = (p.x - p.ox) / dt;
        p.vy = (p.y - p.oy) / dt;
      }
      if (t >= this.end) this.done = true;
    }
    draw(b) {
      const t = this.t, gain = this.gain[this.cur];
      for (const p of this.parts) {
        const mode = p.mode === FLY && t < p.t0 ? p.before : p.mode;
        let a, trail = 0.045, k = p.k;
        if (mode === HOLD) a = this.steady ? 0.88 + 0.12 * Math.sin(t * 5.5 + p.ph * 3) : 0.62 + 0.38 * Math.sin(t * 5.5 + p.ph * 3);
        else if (mode === FALL) {
          a = Math.pow(Math.max(0, 1 - p.age / p.life), 1.4);
          if (Math.random() < 0.05) a = Math.min(1, a * 2);
          if (this.cool && p.age > p.life * 0.45) k = this.cool;
          trail = 0.11;
        } else a = mode === DRIFT ? 0.95 : 1;
        a *= gain;
        const g = b.get(k, a);
        if (!g) continue;
        g.dots.push(p.x, p.y, quality ? p.size : p.size * 1.3); // bigger sparks make up for the lost glow
        const v2 = p.vx * p.vx + p.vy * p.vy;
        if (v2 > 1600) {
          const tg = b.get(k, a * 0.5);
          // streak length follows speed, up to a point
          const f = Math.min(trail, MAX_STREAK / Math.sqrt(v2));
          if (tg) tg.trails.push(p.x - p.vx * f, p.y - p.vy * f, p.x, p.y);
        }
      }
    }
    drawUnder(ctx) {
      if (!this.halo) return;
      const t = this.t;
      const a = smooth(clamp((t - this.tWrite) / 0.45, 0, 1)) * (1 - smooth(clamp((t - this.tRelease) / 0.7, 0, 1)));
      if (a <= 0) return;
      const rx = this.box.w / 2 + this.px * 0.9, ry = this.box.h / 2 + this.px * 0.35;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(255,255,255,${(0.92 * a).toFixed(3)})`);
      g.addColorStop(0.55, `rgba(255,255,255,${(0.75 * a).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    drawCaptions(ctx) {
      if (!this.caps.length) return;
      ctx.font = CAPTION_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      if (HAS_SPACING) ctx.letterSpacing = "2px";
      for (const c of this.caps) {
        const a = clamp((this.t - c.t0) / 0.4, 0, 1) * (1 - clamp((this.t - c.t1) / 0.3, 0, 1));
        if (a <= 0) continue;
        ctx.fillStyle = MIST_INK.styles[Math.round(a * 0.9 * LEVELS)];
        ctx.fillText(c.text, this.x, this.capY);
      }
      if (HAS_SPACING) ctx.letterSpacing = "0px";
    }
  }

  /* ---------- canvases ---------- */

  // Soft glow: halve the frame three times, then add the two smallest copies
  // back stretched to full size. Each halving averages pixels, so it stays steady.
  class Bloom {
    constructor() {
      this.levels = [0, 1, 2].map(() => {
        const c = document.createElement("canvas");
        return { c, ctx: c.getContext("2d") };
      });
    }
    apply(src, ctx) {
      let from = src;
      for (const L of this.levels) {
        const w = Math.max(1, from.width >> 1), h = Math.max(1, from.height >> 1);
        if (L.c.width !== w || L.c.height !== h) { L.c.width = w; L.c.height = h; }
        L.ctx.globalCompositeOperation = "copy";
        L.ctx.drawImage(from, 0, 0, w, h);
        from = L.c;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.75;
      ctx.drawImage(this.levels[1].c, 0, 0, src.width, src.height);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.levels[2].c, 0, 0, src.width, src.height);
      ctx.restore();
    }
  }

  class Layer {
    constructor(canvas, o) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.additive = !!o.additive;
      this.opacity = o.opacity ?? 1;
      this.maxDpr = o.maxDpr;
      this.hair = o.hair;
      this.trail = o.trail;
      this.trailK = o.trailK;
      this.bloom = o.bloom ? new Bloom() : null;
      this.decorate = null;
      this.batch = new Batch();
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.time = 0;
      this.reset();
    }
    reset() {
      this.strokes = [];
      this.writers = [];
      this.parts = [];
      this.shows = [];
      this.flashes = [];
    }
    get busy() { return this.strokes.length + this.parts.length + this.shows.length + this.flashes.length > 0; }
    resize() {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      if (w === this.w && h === this.h && dpr === this.dpr) return false;
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      return true;
    }
    update(dt) {
      const now = (this.time += dt);
      for (let i = this.writers.length - 1; i >= 0; i--) {
        this.writers[i].update(dt, now);
        if (this.writers[i].done) this.writers.splice(i, 1);
      }
      for (let i = this.strokes.length - 1; i >= 0; i--) if (!this.strokes[i].prune(now)) this.strokes.splice(i, 1);
      updateParts(this.parts, dt);
      for (let i = this.shows.length - 1; i >= 0; i--) {
        this.shows[i].update(dt);
        if (this.shows[i].done) this.shows.splice(i, 1);
      }
      for (let i = this.flashes.length - 1; i >= 0; i--) if ((this.flashes[i].t += dt) >= this.flashes[i].dur) this.flashes.splice(i, 1);
    }
    draw() {
      const { ctx, canvas, dpr } = this, b = this.batch, now = this.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!this.busy && !this.decorate) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = this.additive ? "lighter" : "source-over";
      ctx.lineCap = "round";
      if (this.decorate) this.decorate(b, now);
      for (const s of this.strokes) s.draw(b, now);
      drawParts(b, this.parts, this.trailK);
      for (const s of this.shows) {
        s.drawUnder(ctx);
        s.draw(b);
      }
      ctx.globalAlpha = this.opacity;
      b.flush(ctx, this.hair, this.trail);
      ctx.globalAlpha = 1;
      for (const f of this.flashes) drawFlash(ctx, f);
      if (this.bloom && quality > 0) this.bloom.apply(canvas, ctx);
      ctx.globalCompositeOperation = "source-over";
      for (const s of this.shows) s.drawCaptions(ctx);
    }
  }

  // Pens that keep writing lines of loops somewhere on a layer.
  class Ambient {
    constructor(layer, cfg) {
      this.layer = layer;
      this.cfg = cfg;
      this.slots = Array.from({ length: cfg.slots }, (_, i) => ({ pen: null, wait: 0.3 + i * rand(0.5, 1.2) }));
    }
    spawn() {
      const L = this.layer, c = this.cfg;
      const ltr = Math.random() < 0.62; // most lines run left to right, like writing
      const at = (c.place && c.place()) || {
        x: (ltr ? rand(-0.05, 0.55) : rand(0.45, 1.05)) * L.w,
        y: rand(c.top, c.bottom) * L.h,
        heading: (ltr ? 0 : Math.PI) + rand(-0.5, 0.5)
      };
      return new Writer(L, {
        x: at.x, y: at.y, heading: at.heading,
        speed: rand(c.speed[0], c.speed[1]), loop: rand(c.loop[0], c.loop[1]), ratio: rand(c.ratio[0], c.ratio[1]),
        turn: c.turn, dur: rand(c.dur[0], c.dur[1]), nib: c.nib, alpha: c.alpha, life: c.life,
        ink: ink(c.color()), bounded: true
      });
    }
    update(dt) {
      const n = this.cfg.count();
      this.slots.forEach((s, i) => {
        if (s.pen && s.pen.done) { s.pen = null; s.wait = rand(this.cfg.gap[0], this.cfg.gap[1]); }
        if (!s.pen && i < n && (s.wait -= dt) <= 0) s.pen = this.spawn();
      });
    }
    // start writing at once (for the still frame)
    prime() {
      const n = this.cfg.count();
      this.slots.forEach((s, i) => {
        s.pen = i < n ? this.spawn() : null;
        s.wait = rand(0.5, 2);
      });
    }
    // lift every pen; the next lines start shortly, in the current colours
    lift(wait) {
      for (const s of this.slots) {
        if (s.pen) s.pen.end(0.25);
        s.pen = null;
        s.wait = rand(wait[0], wait[1]);
      }
    }
  }

  const makeCanvas = cls => {
    const c = document.createElement("canvas");
    c.className = cls;
    c.setAttribute("aria-hidden", "true");
    return c;
  };
  const dayCanvas = makeCanvas("ink-day"), fxCanvas = makeCanvas("ink-fx");
  document.body.prepend(dayCanvas);
  document.body.append(fxCanvas);

  const skyLayer = new Layer(skyCanvas, { additive: true, bloom: true, maxDpr: 2, hair: 0.8, trail: 1.1, trailK: 0.07 });
  const dayLayer = new Layer(dayCanvas, { opacity: 0.32, maxDpr: 1.5, hair: 1, trail: 1.2, trailK: 0.06 });
  const fxLayer = new Layer(fxCanvas, { maxDpr: 2, hair: 1, trail: 1.4, trailK: 0.05 });

  let stage = 0;      // active card, 0–4
  let quality = 1;    // drops to 0 on slow devices
  let animating = false;
  let fontsOk = false;

  const skyInk = new Ambient(skyLayer, {
    slots: 2, count: () => (quality > 0 && skyLayer.w > 700 ? 2 : 1),
    top: 0.18, bottom: 0.92, speed: [70, 110], loop: [10, 18], ratio: [1.05, 1.5], turn: 0.5,
    dur: [3, 6], gap: [0.6, 1.8], nib: 5, alpha: 0.34, life: 2.4, color: () => pick(NIGHT)
  });
  // The editor's cards are opaque, so ink is only seen beside them: on wide
  // screens the pens write down (or up) the margins, otherwise anywhere.
  const page = document.querySelector(".page");
  function dayPlace() {
    if (!page) return null;
    const r = page.getBoundingClientRect(), cs = getComputedStyle(page), L = dayLayer;
    const left = r.left + parseFloat(cs.paddingLeft) - 8, right = L.w - (r.right - parseFloat(cs.paddingRight)) - 8;
    if (Math.max(left, right) < 64) return null;
    const onLeft = right < 64 || (left >= 64 && Math.random() < 0.5), down = Math.random() < 0.6;
    return {
      x: onLeft ? rand(0.3, 0.7) * left : L.w - rand(0.3, 0.7) * right,
      y: (down ? rand(-0.05, 0.45) : rand(0.55, 1.05)) * L.h,
      heading: (down ? 1 : -1) * Math.PI / 2 + rand(-0.2, 0.2)
    };
  }
  const dayInk = new Ambient(dayLayer, {
    slots: 3, count: () => (quality > 0 && dayLayer.w > 900 ? 3 : 2),
    top: 0.05, bottom: 0.95, speed: [40, 60], loop: [18, 28], ratio: [1.1, 1.45], turn: 0.2,
    dur: [7, 12], gap: [0.6, 2], nib: 16, alpha: 1, life: 6, place: dayPlace,
    // mostly the active card's colour, now and then one of the others
    color: () => STAGE[Math.random() < 0.7 ? stage : (stage + 1 + ((Math.random() * 4) | 0)) % 5]
  });

  /* ---------- the sky ---------- */

  let stars = [];
  function makeStars() {
    const n = Math.round(clamp((skyLayer.w * skyLayer.h) / 7000, 24, 110));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * skyLayer.w, y: Math.random() * skyLayer.h, s: rand(0.8, 1.7), ph: rand(0, TAU), sp: rand(0.5, 1.5)
    }));
  }
  skyLayer.decorate = (b, now) => {
    for (const s of stars) {
      const g = b.get(PAPER_INK, 0.1 + 0.32 * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph)));
      if (g) g.dots.push(s.x, s.y, s.s);
    }
  };

  // Where words can bloom without covering the title: beside it on wide
  // screens, above it on narrow ones.
  let regions = null;
  function measureRegions() {
    const s = sky.getBoundingClientRect(), c = skyCopy.getBoundingClientRect();
    const top = (topbar ? topbar.getBoundingClientRect().bottom - s.top : 60) + 8;
    const bottom = s.height - 16;
    const left = c.left - s.left, right = s.width - left;
    const copy = { x: left - 12, y: c.top - s.top - 10, w: c.width + 24, h: c.height + 20 };
    const sideX = copy.x + copy.w + 28;
    regions = {
      top, bottom, copy,
      side: { x: sideX, y: top, w: right - sideX, h: bottom - top, from: "below" },
      above: { x: left, y: top, w: right - left, h: copy.y - top, from: "side" }
    };
  }

  const MAX_PX = 104;
  function placeWords(texts) {
    const R = regions;
    const per = Math.max(...texts.map(text => measure(text, 100))) / 100; // width per px of font size
    const fit = r => Math.min((r.h - 34) / 1.2, (r.w * 0.88) / per, MAX_PX);
    const fs = fit(R.side), fa = fit(R.above);
    const r = fs >= fa ? R.side : R.above;
    const px = Math.round(clamp(Math.max(fs, fa), 26, MAX_PX));
    const ww = per * px, wh = px * 1.2 + 34;
    return {
      px, from: r.from,
      x: r.x + r.w / 2 + rand(-0.5, 0.5) * Math.max(0, r.w - ww) * 0.6,
      y: r.y + (r.h - 30) / 2 + rand(-0.5, 0.5) * Math.max(0, r.h - wh) * 0.5
    };
  }

  const director = {
    show: null,
    wait: 0.4,
    popIn: 1.6,
    deck: [],
    last: -1,
    // every concept once per round, in a new order each time, starting with « Bonjour »
    peek() {
      if (!this.deck.length) {
        const all = shuffle(CONCEPTS.map((_, i) => i));
        if (all[0] === this.last) all.push(all.shift()); // never the same one twice in a row
        this.deck = this.last < 0 ? [0, ...all.filter(i => i !== 0)] : all;
      }
      return this.deck[0];
    },
    next() {
      this.peek();
      return (this.last = this.deck.shift());
    },
    makeShow(ci, launch) {
      const L = skyLayer, texts = CONCEPTS[ci], place = placeWords(texts), [main, accent] = STAGE_NIGHT[stage];
      let from = null;
      if (launch) {
        from = place.from === "below"
          ? { x: place.x + rand(-50, 50), y: L.h + 24 }
          : { x: Math.random() < 0.5 ? -24 : L.w + 24, y: place.y + rand(-10, 30) };
      }
      return new WordShow(L, {
        words: texts.map((text, i) => ({ text, lang: LANGS[i] })),
        x: place.x, y: place.y, px: place.px, launch: from, launchTime: place.from === "below" ? 1 : 1.25,
        ink: ink(main), accent: ink(accent), cool: ink(STAGE[0]),
        dot: clamp(place.px * 0.02, 1.3, 2.1), max: L.w < 600 ? 600 : 1100
      });
    },
    update(dt) {
      if (!fontsOk || !regions) return;
      if (this.show && this.show.done) this.show = null;
      if (!this.show && (this.wait -= dt) <= 0) {
        measureRegions();
        this.show = this.makeShow(this.next(), true);
        skyLayer.shows.push(this.show);
        this.wait = 0.5;
        prewarm();
      }
      if ((this.popIn -= dt) <= 0) {
        this.pop();
        this.popIn = rand(2.2, 4.4);
      }
    },
    // a small firework somewhere clear of the title and the current word
    pop() {
      const L = skyLayer, R = regions;
      for (let tries = 0; tries < 14; tries++) {
        const x = rand(0.05, 0.95) * L.w, y = rand(R.top + 14, R.bottom - 40);
        if (hit(R.copy, x, y, 34) || (this.show && hit(this.show.box, x, y, 46))) continue;
        const k = ink(pick(NIGHT)), power = rand(50, 95);
        const bloom = () => {
          burst(L, x, y, k, (rand(26, 44)) | 0, power, { glint: 0.3, glintInk: Math.random() < 0.5 ? PAPER_INK : ink(pick(NIGHT)) });
          L.flashes.push({ x, y, t: 0, dur: 0.3, r: power * 0.7, k });
        };
        // a rocket rises first, unless its path would cross the title
        if (x < R.copy.x - 20 || x > R.copy.x + R.copy.w + 20) {
          const T = rand(0.55, 0.8), g = 110, rise = L.h + 6 - y;
          L.parts.push(particle(x, L.h + 6, rand(-8, 8), -(rise + 0.5 * g * T * T) / T, PAPER_INK,
            { life: T, size: 1.6, drag: 0, grav: g, a: 0.9, fade: false, onEnd: bloom }));
        } else bloom();
        return;
      }
    },
    // a click in the sky: a firework that writes one word
    mini(x, y) {
      const L = skyLayer, R = regions;
      if (!fontsOk || !R || L.shows.length > 3) {
        burst(L, x, y, ink(pick(NIGHT)), 36, 80, { glint: 0.3, glintInk: PAPER_INK });
        return;
      }
      const li = (Math.random() * LANGS.length) | 0, text = pick(CONCEPTS)[li];
      const px = Math.round(clamp(L.h * 0.15, 26, 46)), half = measure(text, px) / 2 + 10;
      L.shows.push(new WordShow(L, {
        words: [{ text, lang: LANGS[li] }], origin: { x, y }, px,
        x: clamp(x, half, L.w - half), y: clamp(y, R.top + px * 0.6, R.bottom - px * 0.6 - 26),
        ink: ink(pick(NIGHT)), accent: PAPER_INK, cool: ink(STAGE[0]),
        form: 0.6, hold: 1, fall: 1.4, write: 0.3, settle: 0.3, density: 6, min: 120, max: 420, dot: 1.4
      }));
    }
  };

  // set the next concept's letters while the browser is idle, not on the frame it starts
  function prewarm() {
    const run = () => {
      if (!regions) return;
      const texts = CONCEPTS[director.peek()], px = placeWords(texts).px;
      texts.forEach(text => raster(text, px));
    };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 300);
  }

  /* ---------- the editor: card colour, new elements, saving ---------- */

  // a small burst with two calligraphic curls, thrown towards `dir` so it lands
  // on the page rather than on the (same-coloured) button it came from
  function sparkle(x, y, hex, dir) {
    const k = ink(hex), glint = ink(STAGE[(STAGE.indexOf(hex) + 2) % 5]);
    burst(fxLayer, x, y, k, 26, 300, {
      dir, spread: 1.25, life: [0.55, 0.95], size: [2.2, 3.4], drag: 3.2, grav: 240, flick: false, glint: 0.3, glintInk: glint
    });
    for (const side of [-1, 1]) {
      new Writer(fxLayer, {
        x, y, heading: dir + side * rand(0.45, 0.8), speed: rand(210, 260), decay: 2.6, fall: 1.4,
        loop: rand(6, 9), ratio: rand(1.2, 1.6), dur: 0.55, nib: 5, alpha: 0.9, life: 0.5, ink: k, wobble: 0.3
      });
    }
  }

  let cheers = 0, lastCheer = -Infinity;
  function celebrate(btn) {
    const r = btn.getBoundingClientRect(), L = fxLayer;
    if (r.bottom < 0 || r.top > L.h) return;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // five ribbons, one per card colour, and sparks of every colour
    STAGE.forEach((hex, i) => new Writer(L, {
      x, y, heading: -Math.PI / 2 + (i - 2) * 0.5 + rand(-0.1, 0.1), speed: rand(420, 520), decay: 1.8, fall: 1,
      loop: rand(10, 16), ratio: rand(1.1, 1.5), dur: rand(0.9, 1.1), nib: 8, alpha: 0.95, life: 0.8, ink: ink(hex), wobble: 0.5
    }));
    STAGE.forEach(hex => burst(L, x, y, ink(hex), 14, 420, { life: [0.7, 1.2], size: [2.2, 3.4], drag: 2.6, grav: 420, flick: false }));
    // a word now and then, not on every save
    const now = performance.now();
    if (!fontsOk || now - lastCheer < 12000) return;
    lastCheer = now;
    const text = CHEERS[cheers++ % CHEERS.length], spot = cheerSpot(r, text);
    L.shows.push(new WordShow(L, {
      words: [{ text }], origin: { x, y }, px: spot.px, x: spot.x, y: spot.y,
      ink: ink(STAGE[0]), colorAt: u => ink(STAGE[Math.min(4, (u * 5) | 0)]),
      form: spot.far ? 0.85 : 0.6, hold: 1.2, fall: 1.1, write: 0.35, settle: 0.3, captions: false, swashes: false,
      density: 4.5, min: 160, max: 700, dot: 2.4, arc: 36, halo: !spot.far, steady: true
    }));
  }

  function cheerSpot(r, text) {
    const L = fxLayer, per = measure(text, 100) / 100;
    const tabs = nav ? nav.children : [];
    if (tabs.length) {
      // the column is as tall as the editor (grid stretch): what is free is below the last tab
      const col = nav.getBoundingClientRect(), last = tabs[tabs.length - 1].getBoundingClientRect();
      if (col.width > 140 && col.right < r.left - 40) {
        const px = Math.round(clamp((col.width - 16) / per, 30, 64));
        const y = clamp(r.top + r.height / 2, last.bottom + px * 0.8, L.h - px * 0.8);
        if (y - px * 0.6 > last.bottom && y + px * 0.6 < L.h) return { x: col.left + col.width / 2, y, px, far: true };
      }
    }
    const px = Math.round(clamp(L.w / 15, 40, 64)), half = per * px / 2 + 16;
    const above = r.top - px * 0.95 - 12;
    return { x: clamp(L.w / 2, half, L.w - half), y: above > px ? above : r.bottom + px, px, far: false };
  }

  const nav = document.getElementById("cardNavigation");
  if (nav) {
    new MutationObserver(() => {
      let s = 0;
      for (let i = 0; i < nav.children.length; i++) if (nav.children[i].classList.contains("active")) s = i % 5;
      if (s === stage) return;
      stage = s;
      if (!animating) return;
      dayInk.lift([0.1, 0.7]);
      const tab = nav.children[s].getBoundingClientRect();
      sparkle(tab.left + 4, tab.top + tab.height / 2, STAGE[s], Math.PI);
    }).observe(nav, { childList: true });
  }

  const addBtn = document.getElementById("addElementBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (!animating) return;
      const r = addBtn.getBoundingClientRect();
      sparkle(r.left + r.width / 2, r.top + 2, STAGE[stage], -Math.PI / 2);
    });
  }

  const statusBox = document.getElementById("statusBox"), saveBtn = document.getElementById("saveBtn");
  if (statusBox && saveBtn) {
    new MutationObserver(() => {
      if (animating && statusBox.classList.contains("success")) celebrate(saveBtn);
    }).observe(statusBox, { attributes: true, attributeFilter: ["class"] });
  }

  sky.addEventListener("click", e => {
    if (!animating || e.target.closest("a, button")) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const r = sky.getBoundingClientRect();
    director.mini(e.clientX - r.left, e.clientY - r.top);
  });

  /* ---------- the loop ---------- */

  let raf = 0, lastTs = 0, dayAcc = 0, fxDirty = false, slowFor = 0, skyVisible = true;

  // If frames keep arriving late, drop the glow, the retina resolution and a pen or two.
  function watchSpeed(dt) {
    if (!quality) return;
    slowFor = dt > 1 / 40 ? slowFor + dt : Math.max(0, slowFor - dt);
    if (slowFor > 2.5) {
      quality = 0;
      skyLayer.maxDpr = dayLayer.maxDpr = fxLayer.maxDpr = 1;
      resizeAll();
    }
  }

  function frame(ts) {
    raf = 0;
    if (!animating) return;
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
    lastTs = ts;
    watchSpeed(dt);
    if (skyVisible) {
      director.update(dt);
      skyInk.update(dt);
      skyLayer.update(dt);
      skyLayer.draw();
    }
    // the ribbons behind the editor move slowly: 30 frames a second is plenty
    dayAcc += dt;
    if (dayAcc >= 1 / 32) {
      dayInk.update(dayAcc);
      dayLayer.update(dayAcc);
      dayLayer.draw();
      dayAcc = 0;
    }
    if (fxLayer.busy) {
      fxLayer.update(dt);
      fxLayer.draw();
      fxDirty = true;
    } else if (fxDirty) {
      fxLayer.draw();
      fxDirty = false;
    }
    raf = requestAnimationFrame(frame);
  }

  // One composed frame for reduced motion, or when the animation is off:
  // the first word resting in its letters, a few ribbons, the stars.
  function still() {
    if (!fontsOk || !regions || !skyLayer.w) return;
    for (const L of [skyLayer, dayLayer, fxLayer]) L.reset();
    skyInk.prime();
    dayInk.prime();
    director.show = director.makeShow(0, false);
    director.last = 0;
    skyLayer.shows.push(director.show);
    const dt = 1 / 30;
    for (let t = 0; t < 2.1; t += dt) { skyInk.update(dt); skyLayer.update(dt); }
    for (let t = 0; t < 5; t += dt) { dayInk.update(dt); dayLayer.update(dt); }
    skyLayer.draw();
    dayLayer.draw();
    fxLayer.draw();
  }

  function resizeAll() {
    if (skyLayer.resize()) makeStars();
    measureRegions();
    dayLayer.resize();
    fxLayer.resize();
    if (!animating) still();
  }

  /* ---------- on / off ---------- */

  const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const PREF = "parla:animation";
  let wanted = true;
  try { wanted = localStorage.getItem(PREF) !== "off"; } catch (e) { /* storage blocked: animation stays on */ }

  function apply() {
    const reduce = !!(motionQuery && motionQuery.matches), on = wanted && !reduce;
    if (toggle) {
      toggle.hidden = reduce;
      toggle.setAttribute("aria-pressed", String(wanted));
    }
    sky.classList.toggle("is-live", on);
    if (on === animating) return;
    animating = on;
    if (on) {
      lastTs = 0;
      if (!raf) raf = requestAnimationFrame(frame);
      return;
    }
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    fxLayer.reset();
    fxLayer.draw();
    // paused by the toggle: the sky keeps its last frame; reduced motion gets the still one
    if (reduce || !skyLayer.busy) still();
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      wanted = !wanted;
      try { localStorage.setItem(PREF, wanted ? "on" : "off"); } catch (e) { /* not remembered */ }
      apply();
    });
  }
  if (motionQuery) {
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", apply);
    else if (motionQuery.addListener) motionQuery.addListener(apply);
  }

  let resizeQueued = false;
  const queueResize = () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resizeAll();
    });
  };
  window.addEventListener("resize", queueResize);
  if (window.ResizeObserver) new ResizeObserver(queueResize).observe(sky);
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => {
      skyVisible = entries[entries.length - 1].isIntersecting;
    }).observe(sky);
  }

  // words wait for the accent serif, so their sparks take its shape
  const fontsLoaded = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load(WORD_FONT(64), "Bonjour"), document.fonts.load(CAPTION_FONT, "MALAGASY")])
    : Promise.resolve();
  Promise.race([fontsLoaded, new Promise(done => setTimeout(done, 2500))])
    .catch(() => {})
    .then(() => {
      fontsOk = true;
      rasters.clear(); // anything measured before the font arrived
      measureRegions(); // the title may have changed width with its web font
      if (!animating) still();
    });

  resizeAll();
  apply();
})();
