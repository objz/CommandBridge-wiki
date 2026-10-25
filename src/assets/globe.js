// Landing page globe: a line-drawn earth with servers on real cities; scrolling through the story steps draws routes along its surface.
// Needs d3-geo (window.d3) and topojson-client (window.topojson), loaded before this module.
const stage = document.querySelector("[data-globe]");
if (stage) {
  fetch("/land-110m.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("land-110m.json returned " + r.status))))
    .then((atlas) => init(stage, topojson.feature(atlas, atlas.objects.land)))
    .catch((error) => console.error("Globe could not load the land outlines:", error));
}

function init(stage, land) {
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const labelLayer = stage.querySelector("[data-globe-labels]");
  const blocks = [...document.querySelectorAll("[data-globe-step]")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (x) => x * x * (3 - 2 * x);

  // [name, lon, lat]; the first five are named, the rest fill the network
  const servers = [
    ["Velocity", 8.68, 50.11], ["Lobby", -79.38, 43.65], ["Survival", -46.63, -23.55], ["Minigames", 18.42, -33.92], ["Creative", 55.27, 25.2],
    ["", -0.13, 51.51], ["", -74.0, 40.71], ["", 18.07, 59.33], ["", 12.5, 41.9], ["", -122.42, 37.77], ["", -99.13, 19.43],
    ["", 3.38, 6.52], ["", 31.24, 30.04], ["", 37.62, 55.76], ["", 72.88, 19.08], ["", 103.82, 1.35], ["", 151.21, -33.87], ["", 139.65, 35.68]
  ].map(([name, lon, lat]) => ({ name, at: [lon, lat] }));
  const VELOCITY = 0, LOBBY = 1, MINIGAMES = 3;

  // any direction: every server also links to its nearest neighbour
  const mesh = [];
  servers.forEach((s, i) => {
    if (i === VELOCITY) return;
    let best = -1, min = Infinity;
    servers.forEach((o, j) => { const d = d3.geoDistance(s.at, o.at); if (j !== i && j !== VELOCITY && d < min) { min = d; best = j; } });
    if (!mesh.some(([a, b]) => a === best && b === i)) mesh.push([i, best]);
  });
  const spokes = servers.map((_, i) => [VELOCITY, i]).filter(([, i]) => i !== VELOCITY);
  const steps = [
    { routes: [[MINIGAMES, LOBBY]] },
    { routes: spokes },
    { routes: mesh, keep: spokes }
  ];

  const SEG = 64;
  const cache = new Map();
  const route = (i, j) => {
    const key = i + "-" + j;
    if (!cache.has(key)) { const at = d3.geoInterpolate(servers[i].at, servers[j].at); cache.set(key, Array.from({ length: SEG + 1 }, (_, k) => at(k / SEG))); }
    return cache.get(key);
  };

  // each state turns the earth toward the servers it involves, only halfway so the motion stays gentle
  const centre = (ids) => d3.geoCentroid({ type: "MultiPoint", coordinates: ids.map((i) => servers[i].at) });
  const rest = [10, 22];
  const halfway = (p) => [(rest[0] + p[0]) / 2, (rest[1] + p[1]) / 2];
  const views = [[rest[0] - 14, rest[1] + 4], halfway(centre([MINIGAMES, LOBBY])), halfway(servers[VELOCITY].at), [rest[0] + 12, rest[1]]];

  const labels = new Map();
  servers.forEach((s, i) => {
    if (!s.name) return;
    const el = document.createElement("span");
    el.textContent = s.name;
    labelLayer.append(el);
    labels.set(i, el);
  });

  const projection = d3.geoOrthographic().clipAngle(90);
  const path = d3.geoPath(projection, ctx);
  const graticule = d3.geoGraticule10();
  let width = 0, height = 0, colors = {};

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const token = (name) => `hsl(${css.getPropertyValue(name).trim()})`;
    colors = { fg: token("--foreground"), bg: token("--background") };
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = stage.clientWidth;
    height = stage.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    projection.scale(Math.min(width, height) * 0.4).translate([width / 2, height / 2]);
    render();
  }

  // a step starts when its block enters the lower part of the screen and is complete once its text reaches the middle
  function progress() {
    const mobile = innerWidth < 1024;
    const start = innerHeight * (mobile ? 0.95 : 0.9), end = innerHeight * (mobile ? 0.55 : 0.5);
    let step = -1, t = 1;
    blocks.forEach((block, k) => {
      const r = block.getBoundingClientRect(), mid = r.top + r.height / 2;
      if (mid < start) { step = k; t = clamp((start - mid) / (start - end)); }
    });
    return { step, t: reducedMotion.matches ? 1 : t };
  }

  function draw(geometry, { fill, stroke, width: lineWidth = 1 }) {
    ctx.beginPath();
    path(geometry);
    if (fill) { ctx.globalAlpha = fill; ctx.fill(); }
    if (stroke) { ctx.globalAlpha = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function render() {
    if (!width || !height) return;
    const { step, t } = progress();
    const from = views[Math.max(step, 0)], to = views[step + 1], k = ease(clamp(t * 1.2));
    const view = step < 0 ? views[0] : [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
    projection.rotate([-view[0], -view[1]]);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = ctx.strokeStyle = colors.fg;
    ctx.lineCap = ctx.lineJoin = "round";
    draw({ type: "Sphere" }, { fill: 0.03, stroke: 0.28 });
    draw(graticule, { stroke: 0.06 });
    draw(land, { fill: 0.07, stroke: 0.4, width: 0.8 });

    const lit = new Set();
    // at rest the whole network is shown at once; the first step clears it and starts from a single route
    if (step < 0) {
      spokes.forEach(([i, j]) => draw({ type: "LineString", coordinates: route(i, j) }, { stroke: 0.3 }));
      mesh.forEach(([i, j]) => draw({ type: "LineString", coordinates: route(i, j) }, { stroke: 0.6, width: 1.2 }));
      servers.forEach((_, i) => lit.add(i));
    } else {
      // routes from the previous step stay as a quiet grey layer under the new ones
      (steps[step].keep || []).forEach(([i, j]) => { draw({ type: "LineString", coordinates: route(i, j) }, { stroke: 0.22 }); lit.add(i); lit.add(j); });
      const routes = steps[step].routes;
      routes.forEach(([i, j], n) => {
        // in the busier steps routes start one after another, so the network fills in
        const local = step === 0 ? t : clamp(t * 2 - n / routes.length);
        const count = Math.round(SEG * local);
        if (count < 1) return;
        lit.add(i);
        if (local > 0.98) lit.add(j);
        draw({ type: "LineString", coordinates: route(i, j).slice(0, count + 1) }, { stroke: step === 2 ? 0.6 : 0.85, width: 1.2 });
      });
    }

    // a server is a small rack icon where its routes meet; servers behind the earth are not drawn
    const facing = projection.invert([width / 2, height / 2]);
    servers.forEach((s, i) => {
      if (d3.geoDistance(s.at, facing) > Math.PI / 2 - 0.05) return;
      const [x, y] = projection(s.at), on = lit.has(i), w = s.name ? 13 : 9, h = s.name ? 8.5 : 6.5;
      ctx.globalAlpha = 1;
      ctx.fillStyle = on ? colors.fg : colors.bg;
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 1.5); ctx.fill();
      ctx.globalAlpha = on ? 1 : 0.6; ctx.lineWidth = 1; ctx.strokeStyle = colors.fg; ctx.stroke();
      ctx.globalAlpha = on ? 1 : 0.45; ctx.strokeStyle = on ? colors.bg : colors.fg;
      ctx.beginPath(); ctx.moveTo(x - w / 2 + 2.5, y); ctx.lineTo(x + w / 2 - 4, y); ctx.stroke();
      ctx.strokeStyle = colors.fg; ctx.fillStyle = colors.fg;
    });
    ctx.globalAlpha = 1;

    // labels sit on the outer side of their server, away from the routes crossing the middle
    labels.forEach((el, i) => {
      const s = servers[i];
      const visible = d3.geoDistance(s.at, facing) < Math.PI / 2 - 0.05;
      el.hidden = !visible;
      if (!visible) return;
      const [x, y] = projection(s.at);
      let dx = x - width / 2, dy = y - height / 2;
      const len = Math.hypot(dx, dy);
      if (len < 12) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
      const gap = 11 + Math.abs(dx) * (el.offsetWidth / 2) + Math.abs(dy) * (el.offsetHeight / 2);
      el.style.transform = `translate(${x + dx * gap}px, ${y + dy * gap}px) translate(-50%, -50%)`;
      el.classList.toggle("is-on", step < 0 || lit.has(i));
    });
  }

  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); } };
  addEventListener("scroll", schedule, { passive: true });
  reducedMotion.addEventListener("change", schedule);
  new ResizeObserver(resize).observe(stage);
  // the docs theme toggle flips the "dark" class on <html>; redraw in the new colors
  new MutationObserver(() => { readColors(); schedule(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  readColors();
  resize();
}
