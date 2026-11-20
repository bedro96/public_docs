(() => {
  const root = document.documentElement;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const theme = $(".theme");
  theme.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    root.dataset.theme = dark ? "dark" : "light";
    theme.setAttribute("aria-pressed", String(dark));
  });

  const parts = $$(".component");
  const partCards = $$(".static-components > div");
  const partNote = $("#component-note");
  const partReadout = $("#part-readout");
  const machine = $("#inspector-plate .machine");

  function keyboard(event, buttons, index, select) {
    let next;
    switch (event.key) {
      case "ArrowLeft": case "ArrowUp": next = Math.max(0, index - 1); break;
      case "ArrowRight": case "ArrowDown": next = Math.min(buttons.length - 1, index + 1); break;
      case "Home": next = 0; break;
      case "End": next = buttons.length - 1; break;
      default: return;
    }
    event.preventDefault();
    select(next);
    buttons[next].focus();
  }

  function selectPart(index) {
    parts.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    machine.dataset.focus = parts[index].dataset.part;
    partReadout.textContent = partCards[index].querySelector("dt").textContent;
    partNote.replaceChildren(...[...partCards[index].querySelector("dd").children].map((node) => node.cloneNode(true)));
  }

  parts.forEach((button, index) => {
    button.addEventListener("click", () => selectPart(index));
    button.addEventListener("keydown", (event) => keyboard(event, parts, index, selectPart));
  });

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const flow = $("#flow");
  const flowButtons = $$(".flow-controls button");
  const flowCards = $$(".static-flow li");
  const tracks = new Map($$(".field-track [data-track]").map((path) => [path.dataset.track, path]));
  const marker = $(".tracer");
  const stepCard = $("#step-card");
  const stepReadout = $("#step-readout");
  const previous = $("#previous");
  const next = $("#next");
  const play = $("#play");
  const reset = $("#reset");
  const beat = 4700;
  let step = 0, running = false, visible = false, elapsed = 0, last = 0, frame = 0, trackLength = 0;

  function showStep(index) {
    step = index;
    elapsed = 0;
    const id = flowButtons[index].dataset.step;
    flow.dataset.step = id;
    trackLength = tracks.get(id).getTotalLength();
    stepReadout.textContent = flowCards[index].dataset.readout;
    stepCard.replaceChildren(...[...flowCards[index].children].map((node) => node.cloneNode(true)));
    previous.disabled = !index;
    next.disabled = index === flowButtons.length - 1;
    flowButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    paint();
  }

  function paint() {
    marker.toggleAttribute("hidden", !running || motion.matches || elapsed === 0);
    if (marker.hasAttribute("hidden")) return;
    const path = tracks.get(flow.dataset.step);
    const unit = elapsed / beat;
    const phase = flow.dataset.step === "exhaust" ? Math.min(1, unit * 1.18) : unit;
    const point = path.getPointAtLength(trackLength * phase);
    marker.setAttribute("cx", point.x.toFixed(2));
    marker.setAttribute("cy", point.y.toFixed(2));
  }

  function animate(now) {
    frame = 0;
    if (!running || !visible || document.hidden) { last = 0; return; }
    elapsed += last ? Math.min(80, now - last) : 0;
    last = now;
    if (elapsed < beat) paint();
    else if (step < flowButtons.length - 1) showStep(step + 1);
    else stop();
    wake();
  }

  function wake() {
    if (!frame && running && visible && !document.hidden) {
      frame = requestAnimationFrame(animate);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    play.setAttribute("aria-pressed", "false");
    play.textContent = "재생";
    paint();
  }

  function go(index) {
    stop();
    showStep(index);
  }

  previous.addEventListener("click", () => go(step - 1));
  next.addEventListener("click", () => go(step + 1));
  reset.addEventListener("click", () => go(0));
  play.addEventListener("click", () => {
    if (running) { stop(); return; }
    if (step === flowButtons.length - 1) showStep(0);
    running = true;
    play.setAttribute("aria-pressed", "true");
    play.textContent = "일시 정지";
    wake();
  });
  flowButtons.forEach((button, index) => {
    button.addEventListener("click", () => go(index));
    button.addEventListener("keydown", (event) => keyboard(event, flowButtons, index, go));
  });

  function updateVisibility(isVisible) {
    visible = isVisible;
    if (!visible || document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else wake();
  }

  new IntersectionObserver((entries) => updateVisibility(entries[entries.length - 1].isIntersecting)).observe(flow);
  document.addEventListener("visibilitychange", () => updateVisibility(visible));
  motion.addEventListener("change", paint);
  showStep(0);
  $(".static-components").hidden = true;
  $(".static-flow").hidden = true;
  root.dataset.enhanced = "";
})();
