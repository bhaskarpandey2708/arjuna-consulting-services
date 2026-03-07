const html = document.documentElement;
html.classList.add("js-ready");

const revealNodes = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -24px 0px"
    }
  );

  revealNodes.forEach((node) => observer.observe(node));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
