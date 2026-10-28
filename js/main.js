/* ==========================================================================
   Ableglobal Logistics — interactions
   Smooth scroll (Lenis) + scroll animations (GSAP ScrollTrigger).
   Everything degrades to a static, fully visible page without JS,
   without the CDN libraries, or with prefers-reduced-motion.
   ========================================================================== */

(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const motion = hasGsap && !reduceMotion;

  root.classList.add("js");
  if (motion) root.classList.add("motion");

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const nav = $(".nav");
  const preloader = $(".preloader");

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Always start at the top on load / refresh ---------- */

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  // ScrollTrigger keeps its own scroll memory and would restore the old position after refresh
  if (hasGsap) ScrollTrigger.clearScrollMemory("manual");
  window.scrollTo(0, 0);
  window.addEventListener("load", () => window.scrollTo(0, 0), { once: true });

  /* ---------- Smooth scroll ---------- */

  let lenis = null;
  if (motion && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    const offset = target.id === "hero" ? 0 : -70;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: reduceMotion ? "auto" : "smooth" });
  };

  /* ---------- Mobile menu ---------- */

  const toggle = $(".nav__toggle");
  const menu = $("#mobile-menu");

  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) menu.hidden = false;
    else setTimeout(() => { if (!document.body.classList.contains("menu-open")) menu.hidden = true; }, 800);
    if (lenis) open ? lenis.stop() : lenis.start();
  };

  toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
  });

  /* ---------- Anchor links ---------- */

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      if (document.body.classList.contains("menu-open")) setMenu(false);
      scrollToTarget(target);
    });
  });

  /* ---------- Nav state ---------- */

  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > lastY && y > 600 && !document.body.classList.contains("menu-open"));
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Highlight the nav link for the section in view
  const navLinks = $$(".nav__links a");
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main section[id]").forEach((s) => spy.observe(s));

  /* ---------- Partner marquee: repeat logos so the loop is seamless ---------- */

  if (!reduceMotion) {
    $$(".marquee__track").forEach(async (track) => {
      const originals = [...track.children];
      // Measure only once the logos have real widths, otherwise the track over-fills and jumps when they arrive
      await Promise.all(originals.map((img) => (img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true }) || img.addEventListener("error", r, { once: true })))));
      const fill = () => track.scrollWidth < window.innerWidth * 1.2;
      while (fill()) originals.forEach((n) => track.appendChild(n.cloneNode(true)));
      // Duplicate the whole set once more so translateX(-50%) lands on an identical frame
      [...track.children].forEach((n) => {
        const c = n.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        c.alt = "";
        track.appendChild(c);
      });
    });
  }

  /* ---------- About video: muted preview while in view, full playback on request ---------- */

  const aboutVideo = $("[data-about-video]");
  if (aboutVideo) {
    const frame = $("[data-about-frame]");
    const playBtn = $("[data-about-play]");
    const playLabel = $("[data-about-play-label]");
    const toggleBtn = $("[data-about-toggle]");
    const soundBtn = $("[data-about-sound]");
    const volume = $("[data-about-volume]");
    const progress = $("[data-about-progress]");
    let userPaused = reduceMotion; // reduced motion: wait for the viewer to press play

    aboutVideo.volume = Number(volume.value); // the track is mastered loud; start well below full

    const syncSound = () => {
      const on = !aboutVideo.muted && aboutVideo.volume > 0;
      frame.classList.toggle("has-sound", on);
      soundBtn.setAttribute("aria-pressed", String(on));
      soundBtn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
      volume.value = aboutVideo.muted ? 0 : aboutVideo.volume;
    };
    const setSound = (on) => {
      if (on && aboutVideo.volume === 0) aboutVideo.volume = 0.4;
      aboutVideo.muted = !on;
    };
    // Autoplay can be refused (Low Power Mode, browser settings); fall back to an obvious play button
    const play = () =>
      aboutVideo.play().catch(() => {
        if (aboutVideo.muted) playLabel.textContent = "Play video";
      });

    aboutVideo.addEventListener("volumechange", syncSound);
    aboutVideo.addEventListener("play", () => {
      frame.classList.remove("is-paused");
      toggleBtn.setAttribute("aria-label", "Pause video");
    });
    aboutVideo.addEventListener("pause", () => {
      frame.classList.add("is-paused");
      toggleBtn.setAttribute("aria-label", "Play video");
    });
    aboutVideo.addEventListener("timeupdate", () => {
      if (aboutVideo.duration) progress.style.transform = `scaleX(${aboutVideo.currentTime / aboutVideo.duration})`;
    });
    if (reduceMotion) playLabel.textContent = "Play video";
    frame.classList.add("is-paused");
    syncSound();

    playBtn.addEventListener("click", () => {
      userPaused = false;
      aboutVideo.currentTime = 0;
      setSound(true);
      play();
    });
    const togglePlay = () => {
      userPaused = !aboutVideo.paused;
      if (userPaused) aboutVideo.pause();
      else play();
    };
    toggleBtn.addEventListener("click", togglePlay);
    aboutVideo.addEventListener("click", togglePlay);
    soundBtn.addEventListener("click", () => setSound(aboutVideo.muted));
    volume.addEventListener("input", () => {
      const level = Number(volume.value);
      if (level > 0) aboutVideo.volume = level;
      aboutVideo.muted = level === 0;
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) aboutVideo.pause();
        else if (!userPaused) play();
      }, { threshold: 0.25 }).observe(frame);
    }
  }

  /* ---------- Contact form (front-end only) ---------- */

  const form = $(".form");
  const status = $(".form__status", form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;
    $$(".field", form).forEach((field) => {
      const input = $("input, textarea", field);
      const ok = input.checkValidity();
      field.classList.toggle("is-invalid", !ok);
      if (!ok) valid = false;
    });
    if (!valid) {
      status.textContent = "Please fill in your name, a valid email and a message.";
      return;
    }
    // TODO: connect to a form backend (e.g. Formspree, Netlify Forms or a custom endpoint)
    status.textContent = "We got your message. Thanks!";
    form.reset();
  });
  $$(".field input, .field textarea", form).forEach((input) =>
    input.addEventListener("input", () => input.closest(".field").classList.remove("is-invalid"))
  );

  /* ---------- Counters (run with or without GSAP) ---------- */

  const fmt = new Intl.NumberFormat("en-US");
  const counters = $$("[data-count]");

  if (!motion) {
    counters.forEach((el) => (el.textContent = fmt.format(+el.dataset.count)));
    if (preloader) preloader.remove();
    return;
  }

  /* ======================================================================
     Motion below this line
     ====================================================================== */

  gsap.registerPlugin(ScrollTrigger);

  // Split hero title into words for the staggered reveal
  const title = $("[data-split]");
  const splitWords = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(" "));
          const w = document.createElement("span");
          w.className = "w";
          w.innerHTML = `<span>${part.replace(/ /g, "&nbsp;")}</span>`;
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        splitWords(child);
      }
    });
  };
  splitWords(title);
  title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());

  // Mission statement: words light up as you scroll through it
  const statement = $("[data-words]");
  statement.innerHTML = statement.textContent
    .trim()
    .split(/\s+/)
    .map((w) => `<span class="word">${w}</span>`)
    .join(" ");

  /* ---------- Intro ---------- */

  gsap.set(".hero__title .w > span", { yPercent: 110 });
  gsap.set([".hero__eyebrow", ".hero__lead", ".hero__actions", ".hero__scroll"], { autoAlpha: 0, y: 24 });
  gsap.set(".hero__img", { scale: 1.18 });
  gsap.set(".nav", { yPercent: -100 });

  const intro = gsap.timeline({ defaults: { ease: "expo.out" }, paused: true });
  intro
    .to(".preloader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" })
    .to(".hero__img", { scale: 1.04, duration: 2.4 }, "<0.2")
    .to(".nav", { yPercent: 0, duration: 1.1 }, "<0.3")
    .to(".hero__eyebrow", { autoAlpha: 1, y: 0, duration: 1 }, "<0.1")
    .to(".hero__title .w > span", { yPercent: 0, duration: 1.2, stagger: 0.045 }, "<0.1")
    .to(".hero__lead", { autoAlpha: 1, y: 0, duration: 1 }, "-=0.8")
    .to(".hero__actions", { autoAlpha: 1, y: 0, duration: 1 }, "-=0.85")
    .to(".hero__scroll", { autoAlpha: 1, y: 0, duration: 1 }, "-=0.7")
    .add(() => preloader && preloader.remove());

  const startIntro = () => setTimeout(() => intro.play(), 450);
  const heroImg = $(".hero__img");
  if (heroImg.complete) startIntro();
  else {
    heroImg.addEventListener("load", startIntro, { once: true });
    heroImg.addEventListener("error", startIntro, { once: true });
    setTimeout(() => intro.progress() === 0 && intro.play(), 2500); // never block on a slow image
  }

  /* ---------- Hero parallax on scroll ---------- */

  gsap.to(".hero__media", {
    yPercent: 22,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero__content", {
    yPercent: -18,
    autoAlpha: 0.2,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });

  /* ---------- Generic reveals ---------- */

  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: (els) =>
      gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.09, overwrite: true }),
  });

  /* ---------- Image parallax ---------- */

  $$("[data-parallax-img]").forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -8 },
      {
        yPercent: 8,
        ease: "none",
        scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
  });

  $$("[data-parallax-bg]").forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -12 },
      {
        yPercent: 12,
        ease: "none",
        scrollTrigger: { trigger: img.closest("section"), start: "top bottom", end: "bottom top", scrub: true },
      }
    );
  });

  /* ---------- Mission words ---------- */

  gsap.to(".mission__statement .word", {
    opacity: 1,
    stagger: 0.08,
    ease: "none",
    scrollTrigger: { trigger: statement, start: "top 80%", end: "bottom 45%", scrub: true },
  });

  /* ---------- Counters ---------- */

  counters.forEach((el) => {
    const end = +el.dataset.count;
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: end,
          duration: 2.2,
          ease: "power3.out",
          onUpdate: () => (el.textContent = fmt.format(Math.round(obj.v))),
        }),
    });
  });

  /* ---------- CTA band: subtle scale-in ---------- */

  gsap.from(".cta-band__inner", {
    scale: 0.94,
    ease: "none",
    scrollTrigger: { trigger: ".cta-band", start: "top bottom", end: "center center", scrub: true },
  });

  // Recalculate positions once fonts and lazy images settle
  window.addEventListener("load", () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
