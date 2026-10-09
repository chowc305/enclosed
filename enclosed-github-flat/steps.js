/* =========================================================
   Unfolded
   The photographs run as one continuous strip, like the
   accordion book unfolded. The strip loops: scroll as far
   as you like in either direction and there is no edge.
   ========================================================= */

/* One entry per photograph, in the order they unfold.
   Fill in place and time once the locations are confirmed. */
const STEPS = [
  { src: "unfolded-01.jpg", place: "", time: "" },
  { src: "unfolded-02.jpg", place: "", time: "" },
  { src: "unfolded-03.jpg", place: "", time: "" },
  { src: "unfolded-04.jpg", place: "", time: "" },
  { src: "unfolded-05.jpg", place: "", time: "" },
  { src: "unfolded-06.jpg", place: "", time: "" },
  { src: "unfolded-07.jpg", place: "", time: "" },
  { src: "unfolded-08.jpg", place: "", time: "" },
  { src: "unfolded-09.jpg", place: "", time: "" },
  { src: "unfolded-10.jpg", place: "", time: "" },
  { src: "unfolded-11.jpg", place: "", time: "" },
  { src: "unfolded-12.jpg", place: "", time: "" },
  { src: "unfolded-13.jpg", place: "", time: "" },
  { src: "unfolded-14.jpg", place: "", time: "" },
  { src: "unfolded-15.jpg", place: "", time: "" },
  { src: "unfolded-16.jpg", place: "", time: "" },
  { src: "unfolded-17.jpg", place: "", time: "" },
  { src: "unfolded-18.jpg", place: "", time: "" },
  { src: "unfolded-19.jpg", place: "", time: "" },
  { src: "unfolded-20.jpg", place: "", time: "" },
  { src: "unfolded-21.jpg", place: "", time: "" },
  { src: "unfolded-22.jpg", place: "", time: "" },
  { src: "unfolded-23.jpg", place: "", time: "" },
  { src: "unfolded-24.jpg", place: "", time: "" },
];

(() => {
  const COPIES = 3; // the set is laid out three times; we always stay in the middle copy
  const view = document.getElementById("steps");
  const track = document.getElementById("steps-track");
  const intro = document.getElementById("steps-intro");
  const indexEl = document.getElementById("steps-index");
  const placeEl = document.getElementById("steps-place");
  const back = document.getElementById("back-link");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  // Build the strip
  const panels = [];
  for (let c = 0; c < COPIES; c++) {
    STEPS.forEach((step, i) => {
      const fig = document.createElement("figure");
      fig.className = "steps-photo";
      fig.dataset.index = i;
      const img = document.createElement("img");
      img.src = step.src;
      img.alt = c === 1 ? `Photograph ${pad(i + 1)}${step.place ? ", " + step.place : ""}` : "";
      if (c !== 1) fig.setAttribute("aria-hidden", "true");
      img.decoding = "async";
      fig.appendChild(img);
      track.appendChild(fig);
      panels.push(fig);
    });
  }

  // Width of one full set of photos
  const setWidth = () => panels[STEPS.length].offsetLeft - panels[0].offsetLeft;

  // Keep the scroll inside the middle copy so the strip never ends
  function wrap() {
    const w = setWidth();
    if (!w) return;
    if (track.scrollLeft < w * 0.5) track.scrollLeft += w;
    else if (track.scrollLeft > w * 1.5) track.scrollLeft -= w;
  }

  function updateCaption() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    const current = panels.find((p) => p.offsetLeft <= mid && p.offsetLeft + p.offsetWidth > mid);
    if (!current) return;
    const i = Number(current.dataset.index);
    const step = STEPS[i];
    indexEl.textContent = `${pad(i + 1)} / ${pad(STEPS.length)}`;
    placeEl.textContent = [step.place, step.time].filter(Boolean).join("  ");
  }

  track.addEventListener("scroll", () => {
    wrap();
    updateCaption();
    if (track.scrollLeft !== startScroll) intro.classList.add("gone");
  });

  // Vertical wheel scrolls sideways
  track.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Click and drag with a mouse
  let dragX = null, dragStart = 0;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    dragX = e.clientX; dragStart = track.scrollLeft;
    track.classList.add("dragging");
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    track.scrollLeft = dragStart - (e.clientX - dragX);
    dragX = e.clientX; dragStart = track.scrollLeft;
  });
  const endDrag = () => { dragX = null; track.classList.remove("dragging"); };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // Arrow keys move one photo at a time
  track.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  });

  // Start in the middle copy, at the first photo
  let startScroll = 0;
  function reset() {
    track.scrollLeft = startScroll = panels[STEPS.length].offsetLeft;
    intro.classList.remove("gone");
    updateCaption();
  }
  window.addEventListener("resize", () => { if (!view.hidden) wrap(); });

  // View switching through the address bar: #steps opens Unfolded
  function route() {
    const show = location.hash === "#unfolded";
    const wasHidden = view.hidden;
    view.hidden = !show;
    back.hidden = !show;
    document.body.classList.toggle("is-unfolded", show);
    if (show && wasHidden) {
      touched = false;
      requestAnimationFrame(reset);
      track.focus({ preventScroll: true });
    }
  }
  back.addEventListener("click", (e) => {
    e.preventDefault();
    try { history.pushState("", document.title, location.pathname + location.search); }
    catch (err) { location.hash = ""; }
    route();
  });
  window.addEventListener("hashchange", route);
  // images change the layout as they load
  // images change the strip's widths as they load; keep the start on photo 01 until the visitor scrolls
  let touched = false;
  ["wheel", "pointerdown", "keydown", "touchstart"].forEach((ev) => track.addEventListener(ev, () => { touched = true; }, { passive: true }));
  track.querySelectorAll("img").forEach((img) => img.addEventListener("load", () => { if (!view.hidden && !touched) reset(); }));
  route();
})();
