/* =========================================================
   Enclosed: home map
   - session readouts in the top bar
   - zoomable, draggable vector map
   - photo pins placed by latitude and longitude
   - side panel with details, stepping through in date order
   ========================================================= */

/* ---------- Map calibration ----------
   The map artwork is 1430 × 1100 units, traced from a north-up
   Google Maps screenshot. These two lines turn a latitude and
   longitude into a position on the artwork. Calibrated against
   8th Ave at W 14th St and at W 23rd St. */
const toMapX = (lng) => 52910.2844 * lng + 3916062.46;
const toMapY = (lat) => -69832.0678 * lat + 2845492.52;
const METERS_PER_UNIT = 1.594;
const MAP_W = 1430, MAP_H = 1100;

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtTime(d) { const h = d.getHours() % 12 || 12; return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`; }
function fmtDate(d) { return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function fmtCoords(lat, lng) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
}

/* ---------- Session timer ---------- */
(() => {
  const el = $("session-time"), start = Date.now();
  const tick = () => {
    const s = Math.floor((Date.now() - start) / 1000);
    el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };
  tick(); setInterval(tick, 1000);
})();

/* ---------- Collection, in date order ---------- */
const ITEMS = COLLECTION
  .map((item, i) => ({ ...item, order: i, when: new Date(item.date), mx: toMapX(item.lng), my: toMapY(item.lat) }))
  .sort((a, b) => a.when - b.when || a.order - b.order);

/* ---------- Map view ---------- */
const mapEl = $("map");
const svg = $("map-svg");
const art = $("map-art");
const pinLayer = $("pins");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Load the vector artwork inline so it stays sharp at every zoom level
fetch("map.svg")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then((text) => {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = doc.documentElement;
    art.innerHTML = "";
    for (const node of [...root.childNodes]) art.appendChild(document.importNode(node, true));
  })
  .catch(() => {
    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", "map.svg");
    img.setAttribute("width", MAP_W); img.setAttribute("height", MAP_H);
    art.appendChild(img);
  });

// Everything a visitor can pan to: the map plus any pins beyond its edges
const PAD = 60;
const bounds = ITEMS.reduce((b, p) => ({
  x0: Math.min(b.x0, p.mx - PAD), y0: Math.min(b.y0, p.my - PAD),
  x1: Math.max(b.x1, p.mx + PAD), y1: Math.max(b.y1, p.my + PAD),
}), { x0: 0, y0: 0, x1: MAP_W, y1: MAP_H });

// view.s = screen pixels per map unit; view.x / view.y = map point at the top-left corner
const view = { s: 1, x: 0, y: 0 };
const drawn = { s: 1, x: 0, y: 0 };   // what the SVG viewBox currently shows
let W = 0, H = 0, homeView = null, minS = 0.3, maxS = 8;

function measure() {
  const r = mapEl.getBoundingClientRect();
  W = r.width; H = r.height;
  minS = Math.min(W / (bounds.x1 - bounds.x0), H / (bounds.y1 - bounds.y0)) * 0.95;
  // Opening view: same zoom as the design, centered on where most of the photos were taken
  // (the median point, so a single far-off pin doesn't pull the view away)
  const s = Math.max((window.innerHeight - 17) / MAP_H, W / MAP_W);
  const mid = (arr) => { const a = [...arr].sort((p, q) => p - q), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  homeView = { s, x: mid(ITEMS.map((i) => i.mx)) - W / s / 2, y: mid(ITEMS.map((i) => i.my)) - H / s / 2 };
  maxS = homeView.s * 5;
}

function clampView() {
  view.s = Math.min(maxS, Math.max(minS, view.s));
  const vw = W / view.s, vh = H / view.s;
  // keep the middle of the screen inside the pannable area
  const cx = Math.min(bounds.x1, Math.max(bounds.x0, view.x + vw / 2));
  const cy = Math.min(bounds.y1, Math.max(bounds.y0, view.y + vh / 2));
  view.x = cx - vw / 2; view.y = cy - vh / 2;
}

const toScreen = (mx, my) => [(mx - view.x) * view.s, (my - view.y) * view.s];

/* While moving, the SVG is shifted with a cheap CSS transform; once the
   map settles, the viewBox is redrawn so lines are crisp again. */
let settleTimer = 0;
function commitViewBox() {
  drawn.s = view.s; drawn.x = view.x; drawn.y = view.y;
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${W / view.s} ${H / view.s}`);
  svg.style.transform = "";
}
function render(immediate) {
  clampView();
  const k = view.s / drawn.s;
  const tx = (drawn.x - view.x) * view.s, ty = (drawn.y - view.y) * view.s;
  svg.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  clearTimeout(settleTimer);
  if (immediate) commitViewBox(); else settleTimer = setTimeout(commitViewBox, 140);
  layoutPins();
  updateScale();
}

/* ---------- Pins ---------- */
const THUMB_W = 52, THUMB_H = 40, STEM = 10, GAP = 4;
const pinEls = ITEMS.map((item, i) => {
  const btn = document.createElement("button");
  btn.className = "pin";
  btn.type = "button";
  btn.setAttribute("aria-label", `${item.title}, ${fmtDate(item.when)}`);
  btn.innerHTML = `<span class="pin-stem"></span><span class="pin-dot"></span><span class="pin-thumb">${
    item.thumb ? `<img src="${item.thumb}" alt="">` : ""}</span>`;
  btn.addEventListener("click", (e) => { if (!dragMoved) openItem(i); else e.preventDefault(); });
  pinLayer.appendChild(btn);
  return { btn, stem: btn.firstChild, thumb: btn.lastChild, ox: 0, oy: 0 };
});

// Place each thumbnail just above its point, then nudge overlapping ones apart
function layoutPins() {
  const pts = ITEMS.map((it) => toScreen(it.mx, it.my));
  const box = pts.map(([x, y]) => ({ x, y: y - STEM - THUMB_H / 2, ax: x, ay: y - STEM - THUMB_H / 2 }));
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
      const a = box[i], b = box[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const ox = THUMB_W + GAP - Math.abs(dx), oy = THUMB_H + GAP - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        moved = true;
        if (ox < oy * 1.4) { const m = (ox / 2) * (dx < 0 ? -1 : dx > 0 ? 1 : (i % 2 ? 1 : -1)); a.x -= m; b.x += m; }
        else { const m = (oy / 2) * (dy < 0 ? -1 : dy > 0 ? 1 : (i % 2 ? 1 : -1)); a.y -= m; b.y += m; }
      }
    }
    for (const b of box) { b.x += (b.ax - b.x) * 0.04; b.y += (b.ay - b.y) * 0.04; }
    if (!moved) break;
  }
  pinEls.forEach((p, i) => {
    const [x, y] = pts[i], b = box[i];
    const offScreen = x < -120 || y < -120 || x > W + 120 || y > H + 120;
    p.btn.hidden = offScreen;
    if (offScreen) return;
    p.btn.style.transform = `translate(${x}px, ${y}px)`;
    const tx = b.x - x, ty = b.y - y;
    p.thumb.style.transform = `translate(${tx - THUMB_W / 2}px, ${ty - THUMB_H / 2}px)`;
    // stem from the point to the bottom edge of the thumbnail
    const ex = tx, ey = ty + THUMB_H / 2;
    const len = Math.hypot(ex, ey);
    p.stem.style.width = `${len}px`;
    p.stem.style.transform = `rotate(${Math.atan2(ey, ex)}rad)`;
  });
}

/* ---------- Scale bar ---------- */
const scaleEl = $("scale");
function updateScale() {
  const mPerPx = METERS_PER_UNIT / view.s;
  const options = [50, 100, 200, 250, 500, 1000, 2000];
  let d = options[0];
  for (const o of options) if (o / mPerPx <= 330) d = o;
  const w = d / mPerPx;
  const label = (m) => (m >= 1000 ? `${m / 1000}` : `${+(m / 1000).toFixed(3)}`);
  scaleEl.style.width = `${w}px`;
  scaleEl.querySelector(".scale-labels").innerHTML =
    `<span style="left:0%">0</span><span style="left:50%">${label(d / 2)}</span><span style="left:100%">${label(d)} KM</span>`;
}

/* ---------- Pan and zoom ---------- */
function zoomAt(factor, sx, sy) {
  const mx = view.x + sx / view.s, my = view.y + sy / view.s;
  view.s = Math.min(maxS, Math.max(minS, view.s * factor));
  view.x = mx - sx / view.s; view.y = my - sy / view.s;
  render();
}

mapEl.addEventListener("wheel", (e) => {
  e.preventDefault();
  const r = mapEl.getBoundingClientRect();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

const pointers = new Map();
let dragMoved = false, dragStart = null, pinchStart = null;
mapEl.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".map-controls")) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = false;
  dragStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
  }
  mapEl.classList.add("grabbing");
});
mapEl.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const r = mapEl.getBoundingClientRect();
  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((pinchStart.s * d / pinchStart.d) / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    dragMoved = true;
    return;
  }
  const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
  if (!dragMoved && Math.hypot(dx, dy) < 4) return;
  if (!dragMoved) { try { mapEl.setPointerCapture(e.pointerId); } catch (err) {} }
  dragMoved = true;
  view.x = dragStart.vx - dx / view.s; view.y = dragStart.vy - dy / view.s;
  render();
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 1) { const [p] = [...pointers.values()]; dragStart = { x: p.x, y: p.y, vx: view.x, vy: view.y }; }
  if (!pointers.size) mapEl.classList.remove("grabbing");
  setTimeout(() => { if (!pointers.size) dragMoved = false; }, 0);
}
mapEl.addEventListener("pointerup", endPointer);
mapEl.addEventListener("pointercancel", endPointer);
mapEl.addEventListener("dblclick", (e) => {
  if (e.target.closest(".pin, .map-controls")) return;
  const r = mapEl.getBoundingClientRect();
  zoomAt(1.8, e.clientX - r.left, e.clientY - r.top);
});

// Smoothly move the view (used by the controls and the panel arrows)
let anim = 0;
function animateTo(target) {
  cancelAnimationFrame(anim);
  const from = { ...view };
  if (reduceMotion) { Object.assign(view, target); render(true); return; }
  const t0 = performance.now(), dur = 450;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    // interpolate scale in log space so zooming feels even
    view.s = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e);
    const fcx = from.x + W / from.s / 2, fcy = from.y + H / from.s / 2;
    const tcx = target.x + W / target.s / 2, tcy = target.y + H / target.s / 2;
    const cx = fcx + (tcx - fcx) * e, cy = fcy + (tcy - fcy) * e;
    view.x = cx - W / view.s / 2; view.y = cy - H / view.s / 2;
    render(t === 1);
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
const centerOn = (mx, my, s = view.s) => ({ s, x: mx - W / s / 2, y: my - H / s / 2 });

$("zoom-in").addEventListener("click", () => animateTo(centerOn(view.x + W / view.s / 2, view.y + H / view.s / 2, Math.min(maxS, view.s * 1.6))));
$("zoom-out").addEventListener("click", () => animateTo(centerOn(view.x + W / view.s / 2, view.y + H / view.s / 2, Math.max(minS, view.s / 1.6))));
// "All" frames every pin, including any past the map's edges
$("zoom-all").addEventListener("click", () => {
  const xs = ITEMS.map((i) => i.mx), ys = ITEMS.map((i) => i.my);
  const x0 = Math.min(...xs) - 50, x1 = Math.max(...xs) + 50, y0 = Math.min(...ys) - 70, y1 = Math.max(...ys) + 30;
  const s = Math.min(maxS, Math.max(minS, Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9));
  animateTo(centerOn((x0 + x1) / 2, (y0 + y1) / 2, s));
});

/* ---------- Side panel ---------- */
const panel = $("panel");
const viewed = new Set();
let current = -1;

function openItem(i, pan) {
  current = (i + ITEMS.length) % ITEMS.length;
  const item = ITEMS[current];
  $("panel-title").textContent = item.title;
  $("panel-img").innerHTML = item.image ? `<img src="${item.image}" alt="${item.title}">` : "";
  const pimg = $("panel-img").querySelector("img");
  if (pimg) pimg.addEventListener("load", () => { panelRatio = pimg.naturalWidth / pimg.naturalHeight; sizePanel(); });
  $("panel-img").classList.toggle("empty", !item.image);
  $("panel-loc").textContent = item.place;
  $("panel-time").textContent = fmtTime(item.when);
  $("panel-date").textContent = fmtDate(item.when);
  $("panel-count").textContent = `${current + 1}/${ITEMS.length}`;
  panel.hidden = false;
  sizePanel();
  pinEls.forEach((p, j) => p.btn.classList.toggle("active", j === current));

  viewed.add(current);
  pinEls[current].btn.classList.add("viewed");
  $("viewed-count").textContent = viewed.size;
  $("last-viewed").textContent = fmtCoords(item.lat, item.lng);

  // bring the pin into view if it is near or past the edge
  if (pan) {
    const [x, y] = toScreen(item.mx, item.my);
    const m = 90;
    if (x < m || y < m || x > W - m || y > H - m) {
      // center on the pin, but avoid showing empty space past the map's edges where possible
      const t = centerOn(item.mx, item.my);
      const vw = W / t.s, vh = H / t.s;
      if (vw < MAP_W) t.x = Math.min(MAP_W - vw, Math.max(0, t.x));
      if (vh < MAP_H) t.y = Math.min(MAP_H - vh, Math.max(0, t.y));
      animateTo(t);
    }
  }
}
/* Fit the photo frame to the photo: as wide as the column allows,
   but small enough that the whole card stays on screen. */
let panelRatio = 893 / 504;
function sizePanel() {
  if (panel.hidden) return;
  const box = $("panel-img");
  const sidebar = document.querySelector(".sidebar");
  const cs = getComputedStyle(document.documentElement);
  const sidePad = parseFloat(cs.getPropertyValue("--side-pad")) || 40;
  const pcs = getComputedStyle(panel);
  const chromeW = parseFloat(pcs.paddingLeft) + parseFloat(pcs.paddingRight) + 2;
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  const maxW = (mobile ? window.innerWidth - 24 : sidebar.clientWidth - 2 * sidePad) - chromeW;
  const others = panel.offsetHeight - box.offsetHeight;
  const avail = mobile
    ? window.innerHeight * 0.7 - others
    : window.innerHeight - panel.getBoundingClientRect().top - parseFloat(pcs.marginBottom) - others;
  const w = Math.max(160, Math.min(maxW, Math.max(60, avail) * panelRatio));
  box.style.width = `${Math.round(w)}px`;
  box.style.height = `${Math.round(w / panelRatio)}px`;
}
window.addEventListener("resize", sizePanel);

function closePanel() {
  panel.hidden = true;
  current = -1;
  pinEls.forEach((p) => p.btn.classList.remove("active"));
}
$("panel-close").addEventListener("click", closePanel);
$("panel-prev").addEventListener("click", () => openItem(current - 1, true));
$("panel-next").addEventListener("click", () => openItem(current + 1, true));
document.addEventListener("keydown", (e) => {
  if (location.hash === "#unfolded") return;
  if (e.key === "Escape" && !panel.hidden) closePanel();
  if (!panel.hidden && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.target.closest(".steps")) {
    openItem(current + (e.key === "ArrowRight" ? 1 : -1), true);
  }
});

/* ---------- Start ---------- */
function setup(keepCenter) {
  const c = keepCenter ? { x: view.x + W / view.s / 2, y: view.y + H / view.s / 2, s: view.s } : null;
  measure();
  if (c) Object.assign(view, centerOn(c.x, c.y, c.s)); else Object.assign(view, homeView);
  render(true);
}
setup(false);
window.addEventListener("resize", () => setup(true));
