(() => {
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INTRO_HOLD = 2600;   // loading screen on-screen time (ms)
  const DISSOLVE_MS = 1250;  // intro brand fades out while the landing fades in

  /* ---------------- Heading: split words for the staggered reveal ---------------- */
  document.querySelectorAll(".hero-title .w").forEach((word, i) => {
    const inner = document.createElement("span");
    inner.textContent = word.textContent;
    inner.style.setProperty("--d", `${380 + i * 70}ms`);
    word.textContent = "";
    word.setAttribute("aria-hidden", "true");
    word.appendChild(inner);
  });

  /* ---------------- Video: swap the coded stand-in for the real clip once it exists ---------------- */
  const videoPanel = document.querySelector(".hero-video");
  const video = videoPanel.querySelector("video");
  video.addEventListener("loadeddata", () => videoPanel.classList.add("has-video"));

  /* ---------------- Intro sequence ---------------- */
  let started = false;
  let holdTimer;

  function startTransition() {
    if (started) return;
    started = true;
    clearTimeout(holdTimer);

    body.classList.remove("is-loading");
    body.classList.add("is-transitioning");

    setTimeout(() => {
      body.classList.remove("is-transitioning");
      body.classList.add("is-ready");
      document.querySelector(".intro").remove();
      startTerminal();
      startJobs();
    }, DISSOLVE_MS);
  }

  if (reduceMotion) {
    body.classList.remove("is-loading");
    body.classList.add("is-ready");
    document.querySelector(".intro").remove();
    startTerminal();
    startJobs();
  } else {
    // Let fonts settle so the intro text renders in its final face.
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 800))]).then(() => {
      void body.offsetWidth; // commit the hidden start state so the entrance transitions run
      body.classList.add("is-intro-in");
      holdTimer = setTimeout(startTransition, INTRO_HOLD);
    });

    const intro = document.querySelector(".intro");
    intro.addEventListener("click", startTransition);
    window.addEventListener("keydown", startTransition, { once: true });
    window.addEventListener("wheel", startTransition, { once: true, passive: true });
    window.addEventListener("touchmove", startTransition, { once: true, passive: true });
  }

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
        videoPanel.style.setProperty("--vx", `${nx * -14}px`);
        videoPanel.style.setProperty("--vy", `${ny * -10}px`);
      });
    });
  }

  /* ---------------- Card 2: running jobs count down while their load bars fill ---------------- */
  function startJobs() {
    const LOAD_MIN = 30.616; // load width in the design at the starting time
    const LOAD_MAX = 171.99; // job width minus the 1.8px inset on both sides

    document.querySelectorAll(".job-running").forEach((job) => {
      const start = Number(job.dataset.seconds);
      const time = job.querySelector(".job-time");
      let left = start;

      const render = () => {
        time.textContent = `${left}s left`;
        const done = 1 - left / start;
        job.style.setProperty("--load", `${LOAD_MIN + (LOAD_MAX - LOAD_MIN) * done}px`);
      };
      render();
      if (reduceMotion) return;

      setInterval(() => {
        left = left > 0 ? left - 1 : start;
        render();
      }, 1000);
    });
  }

  /* ---------------- Terminal stand-in for the pipeline demo video ---------------- */
  function startTerminal() {
    if (videoPanel.classList.contains("has-video")) return;

    const term = videoPanel.querySelector(".term");
    const input = term.querySelector(".term-input");
    const output = term.querySelector(".term-output");
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const script = [
      { type: "migrate .github/workflows to TeamCity" },
      { out: "✓ Found 3 workflows · 14 jobs", ok: true, pause: 650 },
      { out: "✓ Generated Kotlin DSL build configurations", ok: true, pause: 750 },
      { out: "✓ Reused your existing VCS root", ok: true, pause: 650 },
      { out: "● Running first build…", pause: 1100 },
      { out: "✓ Build #1 passed in 2m 14s", ok: true, pause: 3200 },
    ];

    async function typeText(text) {
      term.classList.add("is-typing");
      for (const ch of text) {
        input.textContent += ch;
        await wait(38 + Math.random() * 55);
      }
      term.classList.remove("is-typing");
    }

    async function loop() {
      if (reduceMotion) {
        input.textContent = script[0].type;
        script.slice(1).forEach((step) => addLine(step));
        return;
      }
      for (;;) {
        input.textContent = "";
        output.textContent = "";
        await wait(1200);
        for (const step of script) {
          if (step.type) {
            await typeText(step.type);
            await wait(450);
            input.textContent = "";
            addLine({ out: `› ${step.type}` });
          } else {
            addLine(step);
            await wait(step.pause);
          }
        }
      }
    }

    function addLine(step) {
      const line = document.createElement("div");
      line.textContent = step.out;
      if (step.ok) line.className = "ok";
      output.appendChild(line);
      while (output.children.length > 4) output.firstElementChild.remove();
    }

    loop();
  }
})();
