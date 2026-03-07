const html = document.documentElement;
html.classList.add("js-ready");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const liveTickers = document.querySelectorAll("[data-live-ticker]");

for (const ticker of liveTickers) {
  const chips = Array.from(ticker.querySelectorAll(".premium-chip"));

  chips.forEach((chip, index) => {
    chip.style.setProperty("--ticker-index", String(index));
  });

  if (prefersReducedMotion.matches || chips.length === 0) {
    continue;
  }

  const primaryTrack = document.createElement("div");
  primaryTrack.className = "premium-track-motion";

  chips.forEach((chip) => {
    primaryTrack.appendChild(chip);
  });

  const cloneTrack = primaryTrack.cloneNode(true);
  cloneTrack.classList.add("is-clone");
  cloneTrack.setAttribute("aria-hidden", "true");

  ticker.replaceChildren(primaryTrack, cloneTrack);
  ticker.classList.add("is-live");
}

const stagedContainers = document.querySelectorAll(".page-hero, .hero, .site-footer");
stagedContainers.forEach((container) => {
  Array.from(container.children).forEach((node, index) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (!node.classList.contains("reveal")) {
      node.classList.add("reveal");
    }

    if (!node.style.getPropertyValue("--reveal-delay")) {
      node.style.setProperty("--reveal-delay", `${index * 120}ms`);
    }
  });
});

const flowSections = Array.from(
  document.querySelectorAll(".premium-strip, .page-main > section, .site-footer")
);

flowSections.forEach((section, sectionIndex) => {
  if (!(section instanceof HTMLElement)) {
    return;
  }

  section.classList.add("flow-section");
  section.style.setProperty("--section-delay", `${Math.min(sectionIndex, 8) * 70}ms`);

  const stagedReveals = section.querySelectorAll(".reveal");
  stagedReveals.forEach((node, revealIndex) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (!node.style.getPropertyValue("--reveal-delay")) {
      node.style.setProperty("--reveal-delay", `${Math.min(revealIndex, 8) * 75}ms`);
    }
  });
});

const revealNodes = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -24px 0px"
    }
  );

  const flowObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-flow-visible");
          flowObserver.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -10% 0px"
    }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));
  flowSections.forEach((section) => flowObserver.observe(section));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
  flowSections.forEach((section) => section.classList.add("is-flow-visible"));
}

const sliders = document.querySelectorAll("[data-auto-slider]");

for (const slider of sliders) {
  const track = slider.querySelector("[data-slider-track]");
  const slides = Array.from(slider.querySelectorAll("[data-slider-slide]"));
  const dots = Array.from(slider.querySelectorAll("[data-slide-to]"));

  if (!(track instanceof HTMLElement) || slides.length === 0) {
    continue;
  }

  const delay = Number.parseInt(slider.getAttribute("data-slider-delay") ?? "", 10) || 4600;
  let activeIndex = 0;
  let timerId = 0;

  function setInteractiveState(slide, isActive) {
    slide.setAttribute("aria-hidden", String(!isActive));

    const interactiveNodes = slide.querySelectorAll("a, button");
    interactiveNodes.forEach((node) => {
      if (node instanceof HTMLAnchorElement || node instanceof HTMLButtonElement) {
        node.tabIndex = isActive ? 0 : -1;
      }
    });
  }

  function renderSlider(nextIndex) {
    activeIndex = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${activeIndex * 100}%)`;

    slides.forEach((slide, index) => setInteractiveState(slide, index === activeIndex));
    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });
  }

  function stopSlider() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
  }

  function startSlider() {
    if (prefersReducedMotion.matches || slides.length < 2) {
      return;
    }

    stopSlider();
    timerId = window.setInterval(() => renderSlider(activeIndex + 1), delay);
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const nextIndex = Number.parseInt(dot.getAttribute("data-slide-to") ?? "", 10);

      if (Number.isNaN(nextIndex)) {
        return;
      }

      renderSlider(nextIndex);
      startSlider();
    });
  });

  slider.addEventListener("mouseenter", stopSlider);
  slider.addEventListener("mouseleave", startSlider);
  slider.addEventListener("focusin", stopSlider);
  slider.addEventListener("focusout", (event) => {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && slider.contains(nextTarget)) {
      return;
    }

    startSlider();
  });

  renderSlider(0);
  startSlider();
}

const form = document.querySelector("#contact-form");
const statusNode = document.querySelector("#form-status");

function setStatus(message, tone = "") {
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message;
  statusNode.className = "form-status";

  if (tone) {
    statusNode.classList.add(tone);
  }
}

if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    setStatus("Sending your brief...");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data?.errors) ? data.errors.join(" ") : "Unable to submit the request.";
        throw new Error(message);
      }

      form.reset();
      setStatus(data?.message ?? "Request received.", "is-success");
    } catch (error) {
      setStatus(error?.message ?? "Something went wrong. Please try again.", "is-error");
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Send Campaign Brief";
      }
    }
  });
}
