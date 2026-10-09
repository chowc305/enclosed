/* =========================================================
   About page and nav state
   #about opens the About page; the slideshow steps through
   photographs of the publication.
   ========================================================= */
(() => {
  const about = document.getElementById("about");
  const slides = [...about.querySelectorAll(".slide")];
  const count = document.getElementById("slide-count");
  const navLinks = [...document.querySelectorAll(".nav a")];
  let current = 0;

  function show(i) {
    slides[current].classList.remove("is-current");
    current = (i + slides.length) % slides.length;
    slides[current].classList.add("is-current");
    count.textContent = `${current + 1}/${slides.length}`;
  }
  document.getElementById("slide-prev").addEventListener("click", () => show(current - 1));
  document.getElementById("slide-next").addEventListener("click", () => show(current + 1));

  // arrow keys while on the About page
  document.addEventListener("keydown", (e) => {
    if (about.hidden) return;
    if (e.key === "ArrowRight") show(current + 1);
    if (e.key === "ArrowLeft") show(current - 1);
  });

  // swipe on touch screens
  let touchX = null;
  const box = document.getElementById("slideshow");
  box.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  function route() {
    const hash = location.hash;
    const isAbout = hash === "#about";
    about.hidden = !isAbout;
    document.body.classList.toggle("is-about", isAbout);
    const page = isAbout ? "#about" : hash === "#unfolded" ? "#unfolded" : "#collection";
    navLinks.forEach((a) => {
      if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", route);
  route();
})();
