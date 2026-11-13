(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("js");

  const INTRO_HOLD = 2600;   // loading screen on-screen time (ms)
  const DISSOLVE_MS = 1250;  // intro brand fades out while the landing fades in

  /* ---------------- Heading: split words for the staggered reveal ---------------- */
  document.querySelectorAll(".hero-title .w").forEach((word, i) => {
    const inner = document.createElement("span");
    inner.textContent = word.textContent;
    inner.style.setProperty("--d", `${380 + i * 60}ms`);
    word.textContent = "";
    word.setAttribute("aria-hidden", "true");
    word.appendChild(inner);
  });

  /* ---------------- Analytics: report CTA clicks to window.dataLayer ---------------- */
  document.querySelectorAll("a.btn").forEach((link) => {
    link.addEventListener("click", () => {
      (window.dataLayer = window.dataLayer || []).push({
        event: "cta_click",
        label: link.textContent.trim(),
        location: link.closest("section, header")?.className.split(" ")[0] || "page",
      });
    });
  });

  /* ---------------- Video: fade in once the first frame is ready ---------------- */
  const videoPanel = document.querySelector(".hero-video");
  const video = videoPanel.querySelector("video");
  if (video.readyState >= 2) videoPanel.classList.add("has-video");
  else video.addEventListener("loadeddata", () => videoPanel.classList.add("has-video"));

  /* ---------------- Intro sequence ---------------- */
  let started = false;
  let holdTimer;

  // The hero heading, sub-line and buttons are in ~1.4s after the landing starts to show (the video
  // keeps easing in after that). Sections already on the first screen wait for them, so they never
  // draw the eye before the main header.
  const HERO_ENTRANCE_MS = 1400;

  function ready(alreadyShownMs = 0) {
    body.classList.remove("is-loading", "is-transitioning");
    body.classList.add("is-ready");
    const intro = document.querySelector(".intro");
    if (intro) intro.remove();
    startScrollReveal(Math.max(0, HERO_ENTRANCE_MS - alreadyShownMs));
  }

  function startTransition() {
    if (started) return;
    started = true;
    clearTimeout(holdTimer);

    body.classList.remove("is-loading");
    body.classList.add("is-transitioning");
    setTimeout(() => ready(DISSOLVE_MS), DISSOLVE_MS);
  }

  if (reduceMotion) {
    ready();
  } else if (root.classList.contains("no-intro")) {
    // Reload / return visit: skip the loading screen, play only the landing reveal
    void body.offsetWidth;
    ready();
  } else {
    // Let fonts settle so the intro text renders in its final face.
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 800))]).then(() => {
      void body.offsetWidth; // commit the hidden start state so the entrance transitions run
      body.classList.add("is-intro-in");
      holdTimer = setTimeout(startTransition, INTRO_HOLD);
    });

    document.querySelector(".intro").addEventListener("click", startTransition);
    window.addEventListener("keydown", startTransition, { once: true });
    window.addEventListener("wheel", startTransition, { once: true, passive: true });
    window.addEventListener("touchmove", startTransition, { once: true, passive: true });
  }

  /* ---------------- Scroll reveal ----------------
     Starts only once the landing is showing (called from ready()); otherwise sections that sit in
     the first screen, such as "Keep your project" in Plan A, get revealed behind the loading screen
     and show up fully drawn while the intro dissolves. */
  function startScrollReveal(holdMs) {
    const revealables = document.querySelectorAll(".sr");
    const releaseAt = performance.now() + holdMs;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealables.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const wait = releaseAt - performance.now();
        if (wait > 0) setTimeout(() => entry.target.classList.add("in"), wait);
        else entry.target.classList.add("in");
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    revealables.forEach((el) => io.observe(el));

    // Anything still hidden once the page is scrolled to the very end shows up anyway
    const revealRest = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      revealables.forEach((el) => { el.classList.add("in"); io.unobserve(el); });
      window.removeEventListener("scroll", revealRest);
    };
    window.addEventListener("scroll", revealRest, { passive: true });
  }

  /* ---------------- Logo strip: duplicate the list for a seamless loop ---------------- */
  const logoGrid = document.querySelector(".logo-grid");
  const logos = logoGrid.querySelector(".logos");
  const track = document.createElement("div");
  track.className = "logo-track";
  const copy = logos.cloneNode(true);
  copy.setAttribute("aria-hidden", "true");
  logoGrid.appendChild(track);
  track.append(logos, copy);

  /* ---------------- Feature picture follows the open feature ---------------- */
  const shot = document.querySelector(".tc-shot");
  const SHOT_LABELS = {
    pipeline: "TeamCity pipeline editor with Build, Test and Security scan jobs",
    code: "TeamCity pipeline settings shown as YAML and Kotlin DSL",
    cli: "Terminal running teamcity onboard, then starting a build with the TeamCity CLI",
    tests: "TeamCity pipeline running five test jobs in parallel next to the Build job log",
  };
  // "Shorten build and test times": parallel test jobs finish at different times; log lines stream in order
  [[4.2, 0], [5.6, 0.4], [3.4, 0.9], [6.2, 0.2], [4.8, 1.3]].forEach(([run, delay], i) => {
    const bar = shot.querySelectorAll('.tc-layer-tests [data-n="Load"][style*="background"]')[i];
    if (bar) { bar.style.setProperty("--run", `${run}s`); bar.style.setProperty("--run-delay", `${delay}s`); }
  });
  shot.querySelectorAll('.tc-layer-tests :is([data-n="buildlog_line"], [data-n="block_header"])')
    .forEach((row, i) => row.style.setProperty("--i", i));
  const showView = (view) => {
    if (!view || shot.dataset.view === view) return;
    shot.dataset.view = view;
    shot.setAttribute("aria-label", SHOT_LABELS[view]);
    if (view === "cli") terminal.restart();
    else terminal.sync();
    code.sync();
  };

  /* ---------------- CLI terminal: 10.8s loop, timings from the Figma prototype ---------------- */
  const terminal = (() => {
    const LOOP = 10800;
    const term = shot.querySelector(".term");
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const ramp = (t, [a, b]) => clamp01((t - a) / (b - a));
    const range = (attr) => attr && attr.split(",").map(Number);

    const fades = [...term.querySelectorAll("[data-in]")].map((el) => ({
      el, inn: range(el.dataset.in), out: range(el.dataset.out),
    }));
    const typed = [...term.querySelectorAll(".term-type")].map((el) => {
      const [start, step] = range(el.dataset.type);
      return { chars: [...el.children], start, step };
    });
    const cursors = {
      onboard: { el: term.querySelector('[data-cursor="onboard"]'), start: 550, step: 65.1, max: 16, dx: 7.2373,
        on: (t) => t < 240 || (t >= 480 && t < 1680) },
      run: { el: term.querySelector('[data-cursor="run"]'), start: 5200, step: 40, max: 34, dx: 7.2457,
        on: (t) => (t >= 4950 && t < 5189) || (t >= 5200 && t < 6750) },
    };
    const progress = term.querySelector(".term-progress");

    const render = (t) => {
      fades.forEach(({ el, inn, out }) => {
        el.style.opacity = ramp(t, inn) * (out ? 1 - ramp(t, out) : 1);
      });
      typed.forEach(({ chars, start, step }) => {
        chars.forEach((c, i) => { c.style.opacity = clamp01((t - start - i * step) / step); });
      });
      Object.values(cursors).forEach((c) => {
        const n = Math.min(c.max, Math.max(0, Math.floor((t - c.start) / c.step) + 1));
        c.el.style.opacity = c.on(t) ? 1 : 0;
        c.el.style.transform = `translateX(${n * c.dx}px)`;
      });
      progress.style.width = `${ramp(t, [1800, 2800]) * 244.082}px`;
    };

    let t0 = 0;
    let raf = 0;
    let inView = false;
    const tick = (now) => {
      render((now - t0) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const play = !reduceMotion && inView && shot.dataset.view === "cli";
      if (play && !raf) raf = requestAnimationFrame(tick);
      if (!play && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(shot);
    } else inView = true;

    render(reduceMotion ? LOOP - 1 : 0);
    return {
      restart() { t0 = performance.now(); render(reduceMotion ? LOOP - 1 : 0); sync(); },
      sync,
    };
  })();

  /* ---------------- Configuration as code: lines type in, then YAML ⇄ Kotlin DSL ---------------- */
  const code = (() => {
    const LINE_MS = 85;  // one line every 85ms
    const LEAVE_MS = 200; // the finished file fades out before the other one types in
    // pause on the finished file before switching: short after YAML, longer on Kotlin DSL
    const HOLD_MS = { yaml: 900, kotlin: 2600 };
    const tabs = [...shot.querySelectorAll(".tc-tabs button")];
    const blocks = [...shot.querySelectorAll(".tc-code")];
    const caret = document.createElement("span");
    caret.className = "tc-caret";

    let current = "yaml";
    let auto = true; // stops once the visitor picks a tab
    let timers = [];
    let playing = false;
    let inView = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    const show = (name) => {
      current = name;
      tabs.forEach((t) => t.classList.toggle("is-on", t.dataset.tab === name));
      blocks.forEach((c) => { c.hidden = c.dataset.code !== name; });
    };

    const play = (name, fromAuto = false) => {
      clear();
      const leaving = blocks.find((c) => !c.hidden);
      if (fromAuto && leaving && !reduceMotion) {
        leaving.classList.add("is-leaving");
        timers.push(setTimeout(() => { leaving.classList.remove("is-leaving"); type(name); }, LEAVE_MS));
      } else type(name);
    };

    const type = (name) => {
      show(name);
      const block = blocks.find((c) => c.dataset.code === name);
      const rows = [...block.querySelectorAll(".tc-row")];
      if (reduceMotion) { block.classList.remove("is-typing"); return; }

      block.classList.add("is-typing");
      rows.forEach((r) => r.classList.remove("on"));
      void block.offsetWidth;
      rows.forEach((row, i) => {
        const chars = row.querySelector(".tc-tx").textContent.length;
        row.style.setProperty("--type", `${Math.min(160 + chars * 7, 460)}ms`);
        timers.push(setTimeout(() => {
          row.classList.add("on");
          row.querySelector(".tc-tx").appendChild(caret);
        }, 250 + i * LINE_MS));
      });
      const done = 250 + rows.length * LINE_MS + 400;
      timers.push(setTimeout(() => {
        if (!auto) return;
        timers.push(setTimeout(() => play(current === "yaml" ? "kotlin" : "yaml", true), HOLD_MS[current]));
      }, done));
    };

    const sync = () => {
      const should = inView && shot.dataset.view === "code";
      if (should && !playing) { playing = true; play(current); }
      if (!should && playing) { playing = false; clear(); }
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(shot);
    } else inView = true;

    // "Visual" jumps to the visual editor feature; YAML / Kotlin DSL switch the file
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.dataset.tab === "visual") {
          document.querySelector('.accordion [data-view="pipeline"] .acc-trigger').click();
          return;
        }
        auto = false;
        play(tab.dataset.tab);
      });
    });

    return { sync };
  })();

  /* ---------------- Customer quotes: rotate every 7s, pause on hover / focus ---------------- */
  (() => {
    const carousel = document.querySelector(".quote-carousel");
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll(".quote-slide")];
    const dots = [...carousel.querySelectorAll(".quote-dot")];
    const ROTATE_MS = 7000;
    let index = 0;
    let timer = 0;
    let paused = false;
    let inView = false;

    const go = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((s, i) => {
        s.classList.toggle("is-active", i === index);
        if (i === index) s.removeAttribute("aria-hidden");
        else s.setAttribute("aria-hidden", "true");
      });
      dots.forEach((d, i) => {
        d.classList.toggle("is-active", i === index);
        if (i === index) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!reduceMotion && !paused && inView) timer = setTimeout(() => { go(index + 1); schedule(); }, ROTATE_MS);
    };

    dots.forEach((d, i) => d.addEventListener("click", () => { go(i); schedule(); }));
    carousel.addEventListener("pointerenter", () => { paused = true; schedule(); });
    carousel.addEventListener("pointerleave", () => { paused = false; schedule(); });
    carousel.addEventListener("focusin", () => { paused = true; schedule(); });
    carousel.addEventListener("focusout", () => { paused = false; schedule(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }).observe(carousel);
    } else { inView = true; schedule(); }
  })();

  /* ---------------- Accordions ---------------- */
  document.querySelectorAll("[data-accordion]").forEach((group) => {
    const single = group.dataset.accordion === "single";
    const items = [...group.querySelectorAll(".acc-item")];

    const setOpen = (item, open) => {
      const trigger = item.querySelector(".acc-trigger");
      const panel = item.querySelector(".acc-panel");
      item.classList.toggle("is-open", open);
      if (open && item.dataset.view) showView(item.dataset.view);
      trigger.setAttribute("aria-expanded", String(open));
      panel.inert = !open;
    };

    items.forEach((item) => {
      const panel = item.querySelector(".acc-panel");
      panel.hidden = false; // JS drives visibility via the grid-rows transition
      setOpen(item, item.classList.contains("is-open"));

      item.querySelector(".acc-trigger").addEventListener("click", () => {
        const open = !item.classList.contains("is-open");
        if (single) {
          if (!open) return; // keep one feature open at all times
          items.forEach((other) => other !== item && setOpen(other, false));
        }
        setOpen(item, open);
      });
    });
  });

  /* ---------------- UI mock: scale the 708×472 drawing to its slot ---------------- */
  const fitShot = () => shot.style.setProperty("--k", shot.offsetWidth / 708);
  fitShot();
  if ("ResizeObserver" in window) new ResizeObserver(fitShot).observe(shot);
  else window.addEventListener("resize", fitShot);

  /* ---------------- Pointer: card spotlight + tilt, ambient parallax ---------------- */
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
        card.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });

    const heroBg = document.querySelector(".hero-bg");
    let raf = 0;
    window.addEventListener("pointermove", (e) => {
      if (!body.classList.contains("is-ready") || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        heroBg.style.setProperty("--px", `${nx * 40}px`);
        heroBg.style.setProperty("--py", `${ny * 30}px`);
      });
    });
  }
})();
