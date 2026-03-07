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
