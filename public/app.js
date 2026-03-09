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

function readJsonScript(id) {
  const node = document.getElementById(id);

  if (!(node instanceof HTMLScriptElement)) {
    return null;
  }

  try {
    return JSON.parse(node.textContent ?? "");
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pending";
  }

  return new Intl.NumberFormat("en-IN").format(value);
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pending";
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatSignedPoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pending";
  }

  const numeric = Number(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(1)} pts`;
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pending";
  }

  return String(Math.round(Number(value)));
}

function formatPressureBand(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pending";
  }

  const numeric = Number(value);

  if (numeric >= 67) {
    return "High pressure";
  }

  if (numeric >= 34) {
    return "Active pressure";
  }

  return "Contained pressure";
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatTimestamp(value) {
  if (!value) {
    return "Not captured yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatAtlasSourceName(value) {
  if (!value) {
    return "Source";
  }

  if (value === "lokdhaba") {
    return "LokDhaba";
  }

  if (value === "indiavotes") {
    return "IndiaVotes";
  }

  return String(value);
}

function slugifyText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CONSTITUENCY_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 5;
const DISTRICT_PAGE_SIZE = 10;

function sortNumbersDesc(values) {
  return [...values].sort((left, right) => right - left);
}

function getAtlasYears(statesList, stateSlug, house) {
  const state = statesList.find((entry) => entry.slug === stateSlug);
  return sortNumbersDesc(state?.yearsByHouse?.[house] ?? []);
}

function getAtlasHouseLabel(house) {
  return house === "LS" ? "Lok Sabha" : "Vidhan Sabha";
}

function buildAtlasOverviewPath(selection) {
  return `/election-atlas/${encodeURIComponent(selection.state)}/${encodeURIComponent(selection.house)}/${encodeURIComponent(String(selection.year))}`;
}

function buildAtlasConstituencyPath(selection, row) {
  const seat = row.constituencyNumber ?? "na";
  const slug = row.constituencySlug ?? slugifyText(row.constituency);
  return `${buildAtlasOverviewPath(selection)}/constituency/${encodeURIComponent(String(seat))}-${encodeURIComponent(slug)}`;
}

function buildAtlasDistrictPath(selection, row) {
  return `${buildAtlasOverviewPath(selection)}/district/${encodeURIComponent(row.districtSlug)}`;
}

function parseAtlasPath(pathname, fallbackSelection) {
  const normalizedPath = String(pathname || "/election-atlas").replace(/\/+$/, "") || "/election-atlas";
  const match = normalizedPath.match(
    /^\/election-atlas(?:\/([^/]+)\/(VS|LS|vs|ls)\/(\d{4})(?:\/(constituency|district)\/([^/]+))?)?$/i
  );

  if (!match) {
    return {
      type: "overview",
      selection: fallbackSelection
    };
  }

  const [, state, house, year, detailType, detailValue] = match;
  const selection = state && house && year
    ? {
        state: decodeURIComponent(state),
        house: String(house).toUpperCase(),
        year: Number.parseInt(year, 10)
      }
    : fallbackSelection;

  if (detailType === "constituency" && detailValue) {
    const decodedValue = decodeURIComponent(detailValue);
    const seatMatch = decodedValue.match(/^(\d+)(?:-(.+))?$/);

    return {
      type: "constituency",
      selection,
      seat: seatMatch?.[1] ?? "",
      slug: seatMatch?.[2] ?? ""
    };
  }

  if (detailType === "district" && detailValue) {
    return {
      type: "district",
      selection,
      slug: decodeURIComponent(detailValue)
    };
  }

  return {
    type: "overview",
    selection
  };
}

function paginateRows(rows, currentPage, pageSize = CONSTITUENCY_PAGE_SIZE) {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);

  return {
    page: safePage,
    pageSize,
    totalRows,
    totalPages,
    startIndex,
    endIndex,
    rows: rows.slice(startIndex, endIndex)
  };
}

function buildPaginationWindow(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

function buildPaginationMarkup(target, pageData) {
  if (pageData.totalPages <= 1) {
    return `
      <div class="atlas-pagination atlas-pagination-static">
        <span class="atlas-page-chip">Page 1 of 1</span>
      </div>
    `;
  }

  const pageButtons = buildPaginationWindow(pageData.page, pageData.totalPages)
    .map(
      (page) => `
        <button
          class="atlas-page-button ${page === pageData.page ? "is-active" : ""}"
          type="button"
          data-atlas-page-target="${target}"
          data-atlas-page="${page}"
          ${page === pageData.page ? 'aria-current="page"' : ""}
        >
          ${page}
        </button>
      `
    )
    .join("");

  return `
    <div class="atlas-pagination">
      <button
        class="atlas-page-nav"
        type="button"
        data-atlas-page-target="${target}"
        data-atlas-page="${pageData.page - 1}"
        ${pageData.page <= 1 ? "disabled" : ""}
      >
        Previous
      </button>
      <div class="atlas-page-group">${pageButtons}</div>
      <button
        class="atlas-page-nav"
        type="button"
        data-atlas-page-target="${target}"
        data-atlas-page="${pageData.page + 1}"
        ${pageData.page >= pageData.totalPages ? "disabled" : ""}
      >
        Next
      </button>
    </div>
  `;
}

function filterConstituencyRows(model) {
  const needle = model.searchTerm.trim().toLowerCase();
  const rows = model.constituencies.constituencies ?? [];

  if (!needle) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.constituency,
      row.district,
      row.winner,
      row.winnerParty,
      row.runnerUp,
      row.runnerUpParty
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function filterDistrictRows(model) {
  const needle = model.districtSearchTerm.trim().toLowerCase();
  const rows = model.districts?.districts ?? [];

  if (!needle) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.district,
      row.winnerParty,
      ...(row.constituencies ?? []).map((seat) => seat.constituency)
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function buildDistrictPartyChips(parties, limit = 4) {
  const rows = (parties ?? []).slice(0, limit);

  if (rows.length === 0) {
    return '<p class="atlas-chart-helper">District party concentration will appear here once the mart has enough rows.</p>';
  }

  return `
    <div class="atlas-district-chip-list">
      ${rows
        .map(
          (party) => `
            <span class="atlas-district-chip">
              <span class="atlas-legend-dot" style="background:${party.color}"></span>
              ${escapeHtml(party.party)}
              <strong>${party.seats} seats</strong>
              <span>${formatPct(party.voteShare)} vote</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function buildAtlasStatusStrip(summary, options = {}) {
  if (!summary) {
    return "";
  }

  const quality = summary.quality ?? {};
  const tone = quality.tone ?? "pending";
  const secondaryNote = options.secondaryNote ? String(options.secondaryNote).trim() : "";
  const includeSourceCopy = options.includeSourceCopy !== false;
  const extraChips = Array.isArray(options.extraChips) ? options.extraChips : [];
  const chips = [...(quality.chips ?? []), ...extraChips].filter((chip) => chip?.label);
  const chipMarkup = chips
    .map(
      (chip) => `
        <span class="atlas-status-chip atlas-status-chip-${escapeHtml(chip.tone ?? "pending")}">
          ${escapeHtml(chip.label)}
        </span>
      `
    )
    .join("");
  const sourceCopy = includeSourceCopy ? summary.sourceLabel : "";
  const supplementalCopy = [sourceCopy, secondaryNote].filter(Boolean).join(" ");
  const metaItems = [
    summary.houseLabel,
    summary.geographyVersion?.shortLabel,
    quality.availableSources?.length > 0 ? `Sources ${quality.availableSources.map(formatAtlasSourceName).join(" + ")}` : "",
    quality.updatedAt ? `Updated ${formatTimestamp(quality.updatedAt)}` : ""
  ].filter(Boolean);

  return `
    <div class="atlas-note-bar atlas-note-bar-${escapeHtml(tone)}">
      <div class="atlas-note-copy">
        <p class="atlas-note-title">Launch status</p>
        <p class="atlas-note-lead">
          <strong>${escapeHtml(quality.statusLabel ?? "Atlas beta")}</strong>. ${escapeHtml(
            quality.note ?? "Slice status will appear once the live summary loads."
          )}
        </p>
        ${
          supplementalCopy
            ? `<p class="atlas-note-copy-secondary">${escapeHtml(supplementalCopy)}</p>`
            : ""
        }
      </div>
      <div class="atlas-note-side">
        ${chipMarkup ? `<div class="atlas-note-chips">${chipMarkup}</div>` : ""}
        ${
          metaItems.length > 0
            ? `
              <div class="atlas-note-meta">
                ${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function buildAtlasCoverageBanner(summary, options = {}) {
  if (!summary?.quality || summary.quality.tone === "ready") {
    return "";
  }

  const quality = summary.quality;
  const bannerTitle = quality.tone === "pending" ? "Fallback coverage" : "Coverage caveat";
  const bannerCopy =
    quality.tone === "pending"
      ? "This slice is still running on seed fallback because a live staged source slice is not available locally yet."
      : "This slice is live, but the staged overlap or detail layer still has a local gap. Treat it as beta intelligence until the gap is closed.";
  const note = [bannerCopy, options.secondaryNote ? String(options.secondaryNote).trim() : ""]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="atlas-coverage-banner atlas-coverage-banner-${escapeHtml(quality.tone)}">
      <div class="atlas-card-head atlas-card-head-stack atlas-card-head-compact">
        <div>
          <p class="eyebrow">Coverage Mode</p>
          <h3>${escapeHtml(bannerTitle)}</h3>
        </div>
        <p class="atlas-card-copy">${escapeHtml(note)}</p>
      </div>
      <div class="atlas-note-chips">
        <span class="atlas-status-chip atlas-status-chip-${escapeHtml(quality.tone)}">${escapeHtml(
          quality.statusLabel
        )}</span>
        <span class="atlas-status-chip atlas-status-chip-${escapeHtml(quality.tone)}">${escapeHtml(
          quality.primarySourceLabel
        )}</span>
      </div>
    </article>
  `;
}

function formatMetricState(value, positiveLabel, negativeLabel) {
  if (value === null || value === undefined) {
    return "Pending";
  }

  return value ? positiveLabel : negativeLabel;
}

function buildConstituencyDetailMarkup(model) {
  const detailState = model.constituencyDetail;

  if (!detailState) {
    return "";
  }

  const seat = detailState.seat ?? {};
  const detail = detailState.detail ?? {};
  const metrics = detailState.metrics ?? {};
  const sourceNative = metrics.sourceNative ?? {};
  const custom = metrics.custom ?? {};
  const candidateRows = detail.candidateRows ?? [];
  const partyVoteTotals = detail.partyVoteTotals ?? [];
  const leaderVotes =
    candidateRows.length > 0 && Number.isFinite(candidateRows[0]?.votes) ? candidateRows[0].votes : null;
  const partyVoteMarkup = partyVoteTotals.length > 0
    ? `
      <div class="atlas-detail-chip-list">
        ${partyVoteTotals
          .slice(0, 8)
          .map(
            (party) => `
              <span class="atlas-district-chip">
                ${escapeHtml(party.party)}
                <strong>${formatPct(party.voteShare)}</strong>
                <span>${formatNumber(party.votes)} votes</span>
              </span>
            `
          )
          .join("")}
      </div>
    `
    : '<p class="atlas-chart-helper">Party vote totals will appear here once the candidate table is available.</p>';
  const candidateMarkup = candidateRows.length > 0
    ? `
      <div class="atlas-table-scroll">
        <table class="atlas-table atlas-table-detail">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Candidate</th>
              <th>Party</th>
              <th>Status</th>
              <th>Votes</th>
              <th>Vote share</th>
              <th>Gap from leader</th>
            </tr>
          </thead>
          <tbody>
            ${candidateRows
              .map(
                (candidate) => `
                  <tr>
                    <td>${formatNumber(candidate.position)}</td>
                    <td>${escapeHtml(candidate.candidate)}</td>
                    <td>${escapeHtml(candidate.party)}</td>
                    <td>${
                      candidate.position === 1
                        ? "Winner"
                        : candidate.position === 2
                          ? "Runner-up"
                          : "Other"
                    }</td>
                    <td>${formatNumber(candidate.votes)}</td>
                    <td>${formatPct(candidate.voteShare)}</td>
                    <td>${
                      Number.isFinite(leaderVotes) && Number.isFinite(candidate.votes)
                        ? formatNumber(Math.max(leaderVotes - candidate.votes, 0))
                        : "Pending"
                    }</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : '<div class="atlas-empty-state"><h3>Candidate table pending</h3><p>Candidate-level rows for this seat are being prepared.</p></div>';
  const metricCardsMarkup = `
    <div class="atlas-detail-block">
      <p class="eyebrow">Seat Metrics</p>
      <h4>PC or AC performance read</h4>
      <div class="atlas-detail-grid">
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Electors</p>
          <p class="atlas-detail-title">${formatNumber(sourceNative.totalElectors)}</p>
          <p class="atlas-kpi-detail">${escapeHtml(sourceNative.reservationType ?? "GEN")} seat type</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Valid votes</p>
          <p class="atlas-detail-title">${formatNumber(sourceNative.totalVotes)}</p>
          <p class="atlas-kpi-detail">${formatPct(sourceNative.turnoutPct)} turnout</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Winner share</p>
          <p class="atlas-detail-title">${formatPct(sourceNative.winnerVoteShare)}</p>
          <p class="atlas-kpi-detail">${formatPct(sourceNative.runnerUpVoteShare)} runner-up share</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Vote gap</p>
          <p class="atlas-detail-title">${formatPct(custom.voteGapPct)}</p>
          <p class="atlas-kpi-detail">${formatNumber(custom.voteGapVotes)} votes</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">ENOP</p>
          <p class="atlas-detail-title">${formatNumber(sourceNative.enop)}</p>
          <p class="atlas-kpi-detail">${formatMetricState(custom.highFragmentation, "High-fragmentation seat", "Contained field")}</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Turnout delta</p>
          <p class="atlas-detail-title">${formatSignedPoints(custom.turnoutDeviationPct)}</p>
          <p class="atlas-kpi-detail">vs state median turnout</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Pressure score</p>
          <p class="atlas-detail-title">${formatScore(custom.fragmentationPressureScore)}</p>
          <p class="atlas-kpi-detail">${escapeHtml(formatPressureBand(custom.fragmentationPressureScore))}</p>
        </article>
        <article class="atlas-detail-card">
          <p class="atlas-kpi-label">Contest read</p>
          <p class="atlas-detail-title">${formatMetricState(custom.ultraClose, "Ultra-close", "Clearer result")}</p>
          <p class="atlas-kpi-detail">${formatMetricState(custom.lowPlurality, "Low plurality", "Broad lead")} · ${formatMetricState(custom.majorityWinner, "Majority winner", "Sub-50 winner")}</p>
        </article>
      </div>
    </div>
  `;

  return `
    <div class="atlas-detail-panel ${detailState.loading ? "is-loading" : ""}">
      <p class="atlas-card-copy">${escapeHtml(detailState.note ?? "Full candidate detail will appear here.")}</p>
      <div class="atlas-story-meta atlas-story-meta-compact">
        <span>${escapeHtml(seat.district ?? "District pending")}</span>
        <span>${escapeHtml(seat.reservationType ?? "GEN")}</span>
        <span>${formatPct(seat.turnoutPct)} turnout</span>
        <span>${formatPct(seat.marginPct)} margin</span>
      </div>
      ${
        detailState.loading
          ? '<p class="atlas-loading-block">Opening the candidate table...</p>'
          : `
            <div class="atlas-detail-grid">
              <article class="atlas-detail-card">
                <p class="atlas-kpi-label">Winner</p>
                <p class="atlas-detail-title">${escapeHtml(seat.winner ?? "Pending")}</p>
                <p class="atlas-kpi-detail">${escapeHtml(seat.winnerParty ?? "Pending")}</p>
                <p class="atlas-kpi-detail">${formatNumber(seat.winnerVotes)} votes · ${formatPct(seat.winnerVoteShare)}</p>
              </article>
              <article class="atlas-detail-card">
                <p class="atlas-kpi-label">Runner-up</p>
                <p class="atlas-detail-title">${escapeHtml(seat.runnerUp ?? "Pending")}</p>
                <p class="atlas-kpi-detail">${escapeHtml(seat.runnerUpParty ?? "Pending")}</p>
                <p class="atlas-kpi-detail">${formatNumber(seat.runnerUpVotes)} votes · ${formatPct(seat.runnerUpVoteShare)}</p>
              </article>
            </div>
            ${metricCardsMarkup}
            <div class="atlas-detail-block">
              <p class="eyebrow">Party Vote Table</p>
              <h4>Local vote share stack</h4>
              ${partyVoteMarkup}
            </div>
            <div class="atlas-detail-block">
              <p class="eyebrow">Candidate Field</p>
              <h4>Full candidate table</h4>
              ${candidateMarkup}
            </div>
          `
      }
    </div>
  `;
}

function buildAtlasDetailHeader(selection, title, subtitle = "", eyebrow = "Election Atlas Detail") {
  return `
    <div class="atlas-detail-hero">
      <div class="atlas-card-head atlas-card-head-stack">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <p class="atlas-card-copy">${escapeHtml(subtitle)}</p>
      </div>
      <div class="atlas-story-meta">
        <a class="atlas-inline-link" href="${buildAtlasOverviewPath(selection)}">Back to state overview</a>
        <span>${escapeHtml(getAtlasHouseLabel(selection.house))}</span>
        <span>${escapeHtml(String(selection.year))}</span>
      </div>
    </div>
  `;
}

function buildAtlasConstituencyPageMarkup(model) {
  const detailState = model.constituencyDetail ?? {};
  const selection = detailState.selection ?? model.selection;
  const seat = detailState.seat ?? {};
  const title = `${formatNumber(seat.constituencyNumber)} · ${seat.constituency ?? detailState.label ?? "Constituency"}`;
  const subtitle = `${model.routeState?.stateLabel ?? ""} · ${getAtlasHouseLabel(selection.house)} ${selection.year}`;
  const detailPanel = buildConstituencyDetailMarkup(model);

  return `
    <div class="atlas-route-page">
      ${buildAtlasDetailHeader(selection, title, subtitle, "Constituency Detail")}
      ${detailPanel}
    </div>
  `;
}

function buildAtlasDistrictPageMarkup(model) {
  const detailState = model.districtDetail ?? {};
  const selection = detailState.selection ?? model.selection;
  const district = detailState.district ?? null;
  const metrics = detailState.metrics ?? {};
  const overviewMetrics = metrics.overview ?? {};
  const advancedMetrics = metrics.advanced ?? {};
  const customMetrics = metrics.custom ?? {};
  const advancedSource = advancedMetrics.sourceNative ?? {};
  const advancedCustom = advancedMetrics.custom ?? {};
  const reservationMix = advancedCustom.reservationMix ?? {};
  const title = district?.district ?? model.routeState?.slug ?? "District";
  const subtitle = `${model.routeState?.stateLabel ?? ""} · ${getAtlasHouseLabel(selection.house)} ${selection.year}`;

  if (!district) {
    return `
      <div class="atlas-route-page">
        ${buildAtlasDetailHeader(selection, title, subtitle, "District Detail")}
        <div class="atlas-empty-state">
          <h3>District detail pending</h3>
          <p>${escapeHtml(detailState.note ?? "This district page is not staged locally yet.")}</p>
        </div>
      </div>
    `;
  }

  const constituencyRows = (district.constituencies ?? [])
    .map(
      (seat) => `
        <tr>
          <td>${formatNumber(seat.constituencyNumber)}</td>
          <td>
            <a class="atlas-table-link" href="${buildAtlasConstituencyPath(selection, seat)}">${escapeHtml(seat.constituency)}</a>
            <span class="atlas-table-sub">View constituency page</span>
          </td>
          <td>${escapeHtml(seat.reservationType ?? "GEN")}</td>
          <td>
            <strong>${escapeHtml(seat.winner)}</strong>
            <span class="atlas-table-sub">${escapeHtml(seat.winnerParty)}</span>
          </td>
          <td>${formatPct(seat.winnerVoteShare)}</td>
          <td>${formatPct(seat.marginPct)}</td>
          <td>${formatPct(seat.turnoutPct)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="atlas-route-page">
      ${buildAtlasDetailHeader(selection, title, subtitle, "District Detail")}
      <div class="atlas-story-grid atlas-story-grid-tight">
        <article class="atlas-story-card">
          <p class="eyebrow">District Read</p>
          <h3>${escapeHtml(district.district)}</h3>
          <p>${escapeHtml(detailState.note ?? "District detail remains fully local inside Election Atlas.")}</p>
          <div class="atlas-story-meta">
            <span>${formatNumber(district.totalSeats)} seats</span>
            <span>${formatPct(district.turnoutPct)} turnout</span>
            <span>${formatNumber(district.closeContests)} close seats</span>
            <span>${formatPct(district.medianMarginPct)} median margin</span>
          </div>
          ${buildDistrictPartyChips(district.topParties)}
        </article>
        <div class="atlas-detail-grid">
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Top seat tally</p>
            <p class="atlas-detail-title">${escapeHtml(district.winnerParty)}</p>
            <p class="atlas-kpi-detail">${formatNumber(district.winnerSeats)} of ${formatNumber(district.totalSeats)} seats</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Vote share</p>
            <p class="atlas-detail-title">${formatPct(district.winnerVoteShare)}</p>
            <p class="atlas-kpi-detail">${formatPct(district.winnerSeatShare)} seat share</p>
          </article>
        </div>
      </div>
      <div class="atlas-detail-block">
        <p class="eyebrow">District Metrics</p>
        <h4>Constituency pressure and structure</h4>
        <div class="atlas-detail-grid">
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Seats covered</p>
            <p class="atlas-detail-title">${formatNumber(overviewMetrics.totalSeats)}</p>
            <p class="atlas-kpi-detail">${formatNumber(overviewMetrics.totalElectors)} electors</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">District turnout</p>
            <p class="atlas-detail-title">${formatPct(overviewMetrics.turnoutPct)}</p>
            <p class="atlas-kpi-detail">${formatNumber(overviewMetrics.totalVotes)} valid votes</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Mean ENOP</p>
            <p class="atlas-detail-title">${formatNumber(advancedSource.meanEnop)}</p>
            <p class="atlas-kpi-detail">${formatNumber(advancedSource.highFragmentationSeats)} high-fragmentation seats</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Low plurality seats</p>
            <p class="atlas-detail-title">${formatNumber(advancedCustom.lowPluralitySeats)}</p>
            <p class="atlas-kpi-detail">${formatPct(advancedCustom.lowPluralitySeatShare)} of district seats</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Ultra-close seats</p>
            <p class="atlas-detail-title">${formatNumber(advancedCustom.ultraCloseSeats)}</p>
            <p class="atlas-kpi-detail">${formatPct(advancedCustom.ultraCloseSeatShare)} under 2% margin</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Turnout delta</p>
            <p class="atlas-detail-title">${formatSignedPoints(customMetrics.turnoutDeviationPct)}</p>
            <p class="atlas-kpi-detail">vs state median turnout</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Pressure score</p>
            <p class="atlas-detail-title">${formatScore(customMetrics.fragmentationPressureScore)}</p>
            <p class="atlas-kpi-detail">${escapeHtml(formatPressureBand(customMetrics.fragmentationPressureScore))}</p>
          </article>
          <article class="atlas-detail-card">
            <p class="atlas-kpi-label">Reserved mix</p>
            <p class="atlas-detail-title">${formatNumber(reservationMix.reservedSeats)}</p>
            <p class="atlas-kpi-detail">${formatNumber(reservationMix.scSeats)} SC · ${formatNumber(reservationMix.stSeats)} ST</p>
          </article>
        </div>
        <div class="atlas-story-meta atlas-story-meta-compact">
          <span>${formatPct(advancedCustom.turnoutMedian)} median turnout</span>
          <span>${formatPct(advancedCustom.turnoutIqr)} turnout spread</span>
          <span>${formatPct(advancedCustom.winnerVoteShareMedian)} median winner share</span>
          <span>${formatPct(overviewMetrics.medianMarginPct)} median margin</span>
        </div>
      </div>
      <article class="atlas-table-card atlas-table-card-wide">
        <div class="atlas-card-head">
          <div>
            <p class="eyebrow">District Constituencies</p>
            <h3>Canonical seat order</h3>
          </div>
          <p class="atlas-card-copy">Seats are listed by official constituency number so the district page behaves like a lookup surface first.</p>
        </div>
        <div class="atlas-table-meta">
          <p class="atlas-table-caption">
            Showing ${district.constituencies?.length ?? 0} constituencies in numbered order for ${escapeHtml(district.district)}.
          </p>
        </div>
        <div class="atlas-table-scroll">
          <table class="atlas-table atlas-table-district-detail">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Constituency</th>
                <th>Type</th>
                <th>Winner</th>
                <th>Vote share</th>
                <th>Margin %</th>
                <th>Turnout</th>
              </tr>
            </thead>
            <tbody>
              ${constituencyRows}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `;
}

function buildAtlasChart(series, key, metricLabel) {
  if (!Array.isArray(series) || series.length === 0) {
    return '<p class="atlas-chart-empty">Trend series will appear here once the dataset expands.</p>';
  }

  const renderableSeries = series
    .map((item, index) => ({
      ...item,
      seriesId: `series-${index + 1}`,
      points: (item[key] ?? []).filter(
        (point) => typeof point.value === "number" && !Number.isNaN(point.value)
      )
    }))
    .filter((item) => item.points.length > 0);

  if (renderableSeries.length === 0) {
    return '<p class="atlas-chart-empty">This metric will light up after the next ingestion layer lands.</p>';
  }

  const uniqueYears = [...new Set(renderableSeries.flatMap((item) => item.points.map((point) => point.year)))].sort(
    (left, right) => left - right
  );

  if (uniqueYears.length < 2) {
    const currentYear = uniqueYears[0];
    const bars = renderableSeries
      .map((item) => ({
        party: item.party,
        color: item.color,
        value: item.points[item.points.length - 1]?.value ?? 0
      }))
      .sort((left, right) => right.value - left.value)
      .map(
        (item) => `
          <div class="atlas-bar-row">
            <div class="atlas-bar-head">
              <span class="atlas-legend-item">
                <span class="atlas-legend-dot" style="background:${item.color}"></span>
                ${escapeHtml(item.party)}
              </span>
              <strong>${formatPct(item.value)}</strong>
            </div>
            <div class="atlas-bar-track">
              <span class="atlas-bar-fill" style="width:${Math.max(item.value, 2)}%; background:${item.color}"></span>
            </div>
          </div>
        `
      )
      .join("");

    return `
      <div class="atlas-chart-fallback">
        <p class="atlas-chart-helper">
          Only one indexed cycle is available for this selection, so the chart switches to a current-cycle party comparison for ${currentYear}.
        </p>
        <div class="atlas-bar-list">${bars}</div>
      </div>
    `;
  }

  const width = 620;
  const height = 240;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const years = uniqueYears;
  const values = renderableSeries.flatMap((item) => item.points.map((point) => point.value));
  const maxValue = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10);
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const xForIndex = (index) =>
    padLeft + (years.length === 1 ? chartWidth / 2 : (chartWidth / (years.length - 1)) * index);
  const yForValue = (value) => padTop + chartHeight - (value / maxValue) * chartHeight;

  const gridLevels = [0, maxValue / 2, maxValue];
  const grid = gridLevels
    .map((level) => {
      const y = yForValue(level);

      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="atlas-chart-grid-line"></line>
        <text x="${padLeft - 10}" y="${y + 4}" class="atlas-chart-grid-label">${level.toFixed(0)}</text>
      `;
    })
    .join("");

  const xAxis = years
    .map(
      (year, index) =>
        `<text x="${xForIndex(index)}" y="${height - 8}" text-anchor="middle" class="atlas-chart-year">${year}</text>`
    )
    .join("");

  const lines = renderableSeries
    .map((item) => {
      const points = item.points
        .map((point) => `${xForIndex(years.indexOf(point.year))},${yForValue(point.value)}`)
        .join(" ");
      const dots = item.points
        .map((point) => {
          const x = xForIndex(years.indexOf(point.year));
          const y = yForValue(point.value);

          return `
            <circle
              class="atlas-chart-point"
              cx="${x}"
              cy="${y}"
              r="4"
              fill="${item.color}"
              data-atlas-chart-point
              data-series-id="${item.seriesId}"
              data-party="${escapeHtml(item.party)}"
              data-year="${point.year}"
              data-value="${point.value}"
              data-color="${item.color}"
              data-metric-label="${escapeHtml(metricLabel)}"
              tabindex="0"
            >
              <title>${escapeHtml(item.party)} · ${point.year} · ${formatPct(point.value)}</title>
            </circle>
          `;
        })
        .join("");

      if (!points) {
        return "";
      }

      return `
        <g class="atlas-chart-series" data-series-id="${item.seriesId}">
          <polyline
            points="${points}"
            fill="none"
            stroke="${item.color}"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></polyline>
          ${dots}
        </g>
      `;
    })
    .join("");

  const legend = renderableSeries
    .map((item) => {
      const latestPoint = item.points[item.points.length - 1] ?? null;

      return `
        <button
          class="atlas-legend-item"
          type="button"
          data-atlas-chart-legend
          data-series-id="${item.seriesId}"
          aria-label="Highlight ${escapeHtml(item.party)}"
        >
          <span class="atlas-legend-dot" style="background:${item.color}"></span>
          <span class="atlas-legend-label">${escapeHtml(item.party)}</span>
          <span class="atlas-legend-value">${formatPct(latestPoint?.value)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="atlas-chart-frame" data-atlas-chart>
      <div class="atlas-chart-tooltip" hidden data-atlas-chart-tooltip></div>
      <svg viewBox="0 0 ${width} ${height}" class="atlas-chart-svg" role="img" aria-label="${escapeHtml(metricLabel)}">
        ${grid}
        ${lines}
        ${xAxis}
      </svg>
      <div class="atlas-chart-legend">${legend}</div>
    </div>
  `;
}

function buildAtlasDashboardMarkup(model) {
  const states = [...(model.states ?? [])].sort((left, right) => left.name.localeCompare(right.name));
  const years = getAtlasYears(states, model.selection.state, model.selection.house);
  const houseAvailability = {
    VS: getAtlasYears(states, model.selection.state, "VS").length > 0,
    LS: getAtlasYears(states, model.selection.state, "LS").length > 0
  };
  const summary = model.summary;
  const filteredRows = filterConstituencyRows(model);
  const electionRows = model.elections ?? [];
  const constituencyPage = paginateRows(
    filteredRows,
    model.pagination.constituencies,
    CONSTITUENCY_PAGE_SIZE
  );
  const historyPage = paginateRows(electionRows, model.pagination.history, HISTORY_PAGE_SIZE);
  const districtRows = filterDistrictRows(model);
  const districtPage = paginateRows(districtRows, model.pagination.districts, DISTRICT_PAGE_SIZE);
  const districtCoverage = model.districts?.coverage ?? { liveRows: 0, note: "" };
  const districtMetrics = model.districts?.metrics ?? {};
  const constituencyRowCount =
    model.constituencies.coverage.liveRows ?? model.constituencies.coverage.seededRows ?? 0;
  const fragmentationLabel =
    typeof summary.fragmentationIndex === "number" ? summary.fragmentationIndex.toFixed(2) : "Pending";
  const voteShareCopy = summary.voteShareAvailable
    ? "Vote share movement is separated from seat conversion so the page behaves like a campaign review board, not a directory."
    : "Vote share is intentionally blank until candidate-level ingestion lands. The current live layer is seat, turnout, and margin safe.";
  const electionTableCopy = summary.voteShareAvailable
    ? "Every available cycle stays in one structured table so the atlas can compare seats, vote share, turnout, and pressure points without changing the surface model."
    : "Every available extracted cycle stays in one structured table. Seat, turnout, and margin metrics are live; vote-share columns remain pending candidate-level normalization.";
  const constituencyCardTitle =
    model.constituencies.coverage.liveRows > 0 ? "Live constituency results" : "Seeded constituency sample";
  const constituencyCaptionSource =
    model.constituencies.coverage.liveRows > 0 ? "live rows" : "seeded rows";
  const districtCardTitle =
    districtCoverage.liveRows > 0 ? "District pressure board" : "District rollout status";
  const districtCardCopy =
    districtCoverage.liveRows > 0
      ? "District intelligence is staged as a pressure board: leadership, seat conversion, turnout, close-seat density, and the winning-seat map inside each district."
      : districtCoverage.note || "District intelligence is not staged for this selection yet.";
  const showDistrictSection = model.selection.house === "VS";
  const allianceSummary = summary.allianceSummary ?? { available: false, rows: [], note: "" };
  const allianceLineupEntries = allianceSummary.available
    ? allianceSummary.rows.flatMap((alliance) => {
        const allianceMembers = (alliance.parties ?? []).map((member) =>
          typeof member === "string" ? { party: member } : member
        );

        return allianceMembers.map((member, index) => ({
          alliance,
          member,
          showAlliance: index === 0
        }));
      })
    : [];
  const hasAllianceLineupMetrics = allianceLineupEntries.some(({ member }) =>
    ["won", "contested", "voteShare", "contestedVoteShare"].some(
      (key) => typeof member[key] === "number"
    )
  );
  const allianceLineupRows = hasAllianceLineupMetrics
    ? allianceLineupEntries
        .map(
          ({ alliance, member, showAlliance }) => `
            <tr>
              <td>
                ${
                  showAlliance
                    ? `
                      <div class="atlas-alliance-label-cell">
                        <span class="atlas-party-swatch" style="background:${alliance.color}"></span>
                        <strong>${escapeHtml(alliance.label)}</strong>
                      </div>
                    `
                    : ""
                }
              </td>
              <td>${escapeHtml(member.party)}</td>
              <td>${typeof member.won === "number" ? formatNumber(member.won) : "NA"}</td>
              <td>${typeof member.contested === "number" ? formatNumber(member.contested) : "NA"}</td>
              <td>${typeof member.voteShare === "number" ? formatPct(member.voteShare) : "NA"}</td>
              <td>${typeof member.contestedVoteShare === "number" ? formatPct(member.contestedVoteShare) : "NA"}</td>
            </tr>
          `
        )
        .join("")
    : "";
  const allianceCards = allianceSummary.available
    ? allianceSummary.rows
        .slice(0, 2)
        .map((alliance) => {
          const allianceMembers = (alliance.parties ?? []).map((member) =>
            typeof member === "string" ? { party: member } : member
          );
          const memberMarkup = allianceMembers.length > 0
            ? `
              <div class="atlas-alliance-members">
                ${allianceMembers
                  .slice(0, 4)
                  .map(
                    (member) => `
                      <span class="atlas-alliance-member">
                        <span class="atlas-alliance-member-label">${escapeHtml(member.party)}</span>
                        ${typeof member.won === "number" ? `<span class="atlas-alliance-member-stat">${formatNumber(member.won)} won</span>` : ""}
                      </span>
                    `
                  )
                  .join("")}
                ${
                  allianceMembers.length > 4
                    ? `<span class="atlas-alliance-member atlas-alliance-member-muted">+${allianceMembers.length - 4} more</span>`
                    : ""
                }
              </div>
            `
            : "";

          return `
            <article class="atlas-alliance-card">
              <div class="atlas-party-head">
                <span class="atlas-party-swatch" style="background:${alliance.color}"></span>
                <h3>${escapeHtml(alliance.label)}</h3>
              </div>
              <p class="atlas-party-value">${formatPct(alliance.seatShare)}</p>
              <p class="atlas-party-meta">${formatNumber(alliance.seats)} seats on the table</p>
              ${
                typeof alliance.voteShare === "number"
                  ? `<p class="atlas-party-meta">${formatPct(alliance.voteShare)} vote share</p>`
                  : ""
              }
              ${memberMarkup}
            </article>
          `
        })
        .join("")
    : "";
  const allianceLineupMarkup = allianceLineupRows
    ? `
      <div class="atlas-alliance-lineup">
        <div class="atlas-table-meta atlas-table-meta-tight">
          <p class="atlas-table-caption">Alliance party metrics appear only where coalition membership and partywise totals are both available.</p>
        </div>
        <div class="atlas-table-scroll">
          <table class="atlas-table atlas-table-alliances">
            <thead>
              <tr>
                <th>Alliance</th>
                <th>Party</th>
                <th>Won</th>
                <th>Contested</th>
                <th>Vote share</th>
                <th>Contested share</th>
              </tr>
            </thead>
            <tbody>
              ${allianceLineupRows}
            </tbody>
          </table>
        </div>
      </div>
    `
    : "";
  const allianceMarkup = allianceSummary.available
    ? `
      <div class="atlas-alliance-strip">
        <div class="atlas-card-head atlas-card-head-stack atlas-card-head-compact">
          <div>
            <p class="eyebrow">Alliance Read</p>
            <h3>${escapeHtml(allianceSummary.configured === false && allianceSummary.source === "indiavotes" ? "Sourced coalition pressure" : "Mapped coalition pressure")}</h3>
          </div>
          <p class="atlas-card-copy">${escapeHtml(allianceSummary.note || "Alliance mapping is explicit for this slice.")}</p>
        </div>
        <div class="atlas-alliance-grid">
          ${allianceCards}
        </div>
        ${allianceLineupMarkup}
      </div>
    `
    : "";
  const electionTableRows = historyPage.rows
    .map(
      (row) => `
        <tr class="${row.year === model.selection.year ? "is-selected" : ""}">
          <td>
            <button class="atlas-link-button" type="button" data-atlas-jump-year="${row.year}">
              ${row.year}
            </button>
          </td>
          <td>${escapeHtml(row.topTwo)}</td>
          <td>${escapeHtml(row.winnerParty)}</td>
          <td>${formatPct(row.winnerSeatShare)}</td>
          <td>${formatPct(row.winnerVoteShare)}</td>
          <td>${formatPct(row.turnoutPct)}</td>
          <td>${row.closeContests}</td>
          <td>${escapeHtml(row.geographyVersionLabel)}</td>
        </tr>
      `
    )
    .join("");
  const districtTableRows = districtPage.rows
    .map(
      (row) => `
        <tr>
          <td>
            <strong>${escapeHtml(row.district)}</strong>
            <span class="atlas-table-sub">${formatNumber(row.constituencies?.length ?? row.totalSeats)} constituencies</span>
          </td>
          <td>
            <strong>${escapeHtml(row.winnerParty)}</strong>
            <span class="atlas-table-sub">${formatNumber(row.winnerSeats)} of ${formatNumber(row.totalSeats)} seats</span>
          </td>
          <td>${formatNumber(row.totalSeats)}</td>
          <td>${formatPct(row.winnerSeatShare)}</td>
          <td>${formatPct(row.winnerVoteShare)}</td>
          <td>${formatNumber(row.closeContests)}</td>
          <td>${formatPct(row.turnoutPct)}</td>
          <td>${formatPct(row.medianMarginPct)}</td>
          <td>
            <a class="atlas-inline-link" href="${buildAtlasDistrictPath(model.selection, row)}">Open district</a>
          </td>
        </tr>
      `
    )
    .join("");
  const districtSectionMarkup = showDistrictSection
    ? `
      <article class="atlas-table-card atlas-table-card-wide">
        <div class="atlas-card-head atlas-card-head-stack">
          <div>
            <p class="eyebrow">District Intelligence</p>
            <h3>${escapeHtml(districtCardTitle)}</h3>
          </div>
          <label class="atlas-search">
            <span class="sr-only">Search districts</span>
            <input type="search" value="${escapeHtml(model.districtSearchTerm)}" placeholder="Search district, constituency, or party" data-atlas-district-search />
          </label>
        </div>
        <p class="atlas-card-copy">${escapeHtml(districtCardCopy)}</p>
        <div class="atlas-district-overview">
          <article class="atlas-district-metric">
            <p class="atlas-kpi-label">Districts live</p>
            <p class="atlas-district-value">${escapeHtml(String(districtMetrics.totalDistricts ?? 0))}</p>
            <p class="atlas-kpi-detail">District marts staged for this slice.</p>
          </article>
          <article class="atlas-district-metric">
            <p class="atlas-kpi-label">Seats covered</p>
            <p class="atlas-district-value">${escapeHtml(formatNumber(districtMetrics.totalSeats))}</p>
            <p class="atlas-kpi-detail">Assembly seats represented in the district rollup.</p>
          </article>
          <article class="atlas-district-metric">
            <p class="atlas-kpi-label">Turnout rollup</p>
            <p class="atlas-district-value">${escapeHtml(formatPct(districtMetrics.turnoutPct))}</p>
            <p class="atlas-kpi-detail">Weighted turnout across covered districts.</p>
          </article>
          <article class="atlas-district-metric">
            <p class="atlas-kpi-label">Votes indexed</p>
            <p class="atlas-district-value">${escapeHtml(formatNumber(districtMetrics.totalVotes))}</p>
            <p class="atlas-kpi-detail">${escapeHtml(districtCoverage.note || "District coverage note pending.")}</p>
          </article>
        </div>
        ${
          districtPage.totalRows > 0
            ? `
              <div class="atlas-table-meta">
                <p class="atlas-table-caption">
                  Showing ${districtPage.startIndex + 1}-${districtPage.endIndex} of ${districtPage.totalRows} filtered districts, from ${model.districts?.districts?.length ?? 0} total districts, ordered alphabetically.
                </p>
                ${buildPaginationMarkup("districts", districtPage)}
              </div>
              <div class="atlas-table-scroll">
                <table class="atlas-table atlas-table-districts">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th>Top seat tally</th>
                      <th>Seats</th>
                      <th>Seat share</th>
                      <th>Vote share</th>
                      <th>Close seats</th>
                      <th>Turnout</th>
                      <th>Median margin</th>
                      <th>Drilldown</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${districtTableRows}
                  </tbody>
                </table>
              </div>
            `
            : `
              <div class="atlas-empty-state">
                <p class="eyebrow">District coverage</p>
                <h3>Not staged for this selection</h3>
                <p>${escapeHtml(districtCoverage.note || "District marts are not available yet.")}</p>
              </div>
            `
        }
      </article>
    `
    : "";

  const topPartyCards = summary.topParties
    .slice(0, 5)
    .map(
      (party) => `
        <article class="atlas-party-card">
          <div class="atlas-party-head">
            <span class="atlas-party-swatch" style="background:${party.color}"></span>
            <h3>${escapeHtml(party.party)}</h3>
          </div>
          <p class="atlas-party-value">${party.seats} seats</p>
          <p class="atlas-party-meta">${formatPct(party.seatShare)} seat share</p>
          <p class="atlas-party-meta">${formatPct(party.voteShare)} vote share</p>
        </article>
      `
    )
    .join("");

  const kpiCards = summary.kpis
    .map(
      (item) => `
        <article class="atlas-kpi-card">
          <p class="atlas-kpi-label">${escapeHtml(item.label)}</p>
          <p class="atlas-kpi-value">${escapeHtml(item.value)}</p>
          <p class="atlas-kpi-detail">${escapeHtml(item.detail)}</p>
        </article>
      `
    )
    .join("");

  return `
    <div class="atlas-toolbar">
      <label class="atlas-control">
        <span>State</span>
        <select data-atlas-state>
          ${states
            .map(
              (state) =>
                `<option value="${escapeHtml(state.slug)}"${state.slug === model.selection.state ? " selected" : ""}>${escapeHtml(state.name)}</option>`
            )
            .join("")}
        </select>
      </label>
      <div class="atlas-control atlas-control-house">
        <span>House</span>
        <div class="atlas-segmented">
          <button
            class="${model.selection.house === "VS" ? "is-active" : ""}"
            type="button"
            data-atlas-house="VS"
            ${houseAvailability.VS ? "" : "disabled"}
          >
            VS
          </button>
          <button
            class="${model.selection.house === "LS" ? "is-active" : ""}"
            type="button"
            data-atlas-house="LS"
            ${houseAvailability.LS ? "" : "disabled"}
          >
            LS
          </button>
        </div>
      </div>
      <label class="atlas-control">
        <span>Year</span>
        <select data-atlas-year>
          ${years
            .map(
              (year) =>
                `<option value="${year}"${year === model.selection.year ? " selected" : ""}>${year}</option>`
            )
            .join("")}
        </select>
      </label>
      <div class="atlas-control atlas-control-action">
        <span>Export</span>
        <button class="atlas-export-button" type="button" data-atlas-export>CSV</button>
      </div>
    </div>

    <div class="atlas-kpi-grid">
      ${kpiCards}
    </div>

    <div class="atlas-story-grid">
      <article class="atlas-story-card">
        <p class="eyebrow">State Snapshot</p>
        <h2>${escapeHtml(model.selection.year)} ${escapeHtml(summary.houseLabel)} read</h2>
        <p>${escapeHtml(summary.snapshot)}</p>
        ${allianceMarkup}
        <div class="atlas-story-meta">
          <span>Fragmentation index ${escapeHtml(fragmentationLabel)}</span>
          <span>${escapeHtml(formatNumber(summary.closeContests))} close contests</span>
        </div>
      </article>
      <div class="atlas-party-grid">
        ${topPartyCards}
      </div>
    </div>

    <div class="atlas-chart-grid">
      <article class="atlas-chart-card">
        <div class="atlas-card-head">
          <div>
            <p class="eyebrow">Historical Timeline</p>
            <h3>Party seat share trend</h3>
          </div>
          <p class="atlas-card-copy">Selected top parties tracked across every available ${escapeHtml(summary.houseLabel)} cycle currently indexed for this state selection.</p>
        </div>
        ${buildAtlasChart(summary.trendSeries, "seatShare", "Party seat share trend")}
      </article>
      <article class="atlas-chart-card">
        <div class="atlas-card-head">
          <div>
            <p class="eyebrow">Historical Timeline</p>
            <h3>Party vote share trend</h3>
          </div>
          <p class="atlas-card-copy">${escapeHtml(voteShareCopy)}</p>
        </div>
        ${buildAtlasChart(summary.trendSeries, "voteShare", "Party vote share trend")}
      </article>
    </div>

    <div class="atlas-tables-stack">
      <article class="atlas-table-card atlas-table-card-wide">
        <div class="atlas-card-head">
          <div>
            <p class="eyebrow">Election Table</p>
            <h3>Cycle-by-cycle state history</h3>
          </div>
          <p class="atlas-card-copy">${escapeHtml(electionTableCopy)}</p>
        </div>
        <div class="atlas-table-meta">
          <p class="atlas-table-caption">
            Showing ${historyPage.totalRows === 0 ? 0 : historyPage.startIndex + 1}-${historyPage.endIndex} of ${historyPage.totalRows} indexed cycles.
          </p>
          ${buildPaginationMarkup("history", historyPage)}
        </div>
        <div class="atlas-table-scroll">
          <table class="atlas-table atlas-table-history">
            <thead>
              <tr>
                <th>Year</th>
                <th>Top two</th>
                <th>Top seat tally</th>
                <th>Seat share</th>
                <th>Vote share</th>
                <th>Turnout</th>
                <th>Close seats</th>
                <th>Geography</th>
              </tr>
            </thead>
            <tbody>
              ${electionTableRows}
            </tbody>
          </table>
        </div>
      </article>

      ${districtSectionMarkup}

      <article class="atlas-table-card atlas-table-card-wide">
        <div class="atlas-card-head atlas-card-head-stack">
          <div>
            <p class="eyebrow">Constituency Drilldown</p>
            <h3>${escapeHtml(constituencyCardTitle)}</h3>
          </div>
          <label class="atlas-search">
            <span class="sr-only">Search constituencies</span>
            <input type="search" value="${escapeHtml(model.searchTerm)}" placeholder="Search constituency, district, or party" data-atlas-search />
          </label>
        </div>
        <div class="atlas-table-meta">
          <p class="atlas-table-caption">
            Showing ${constituencyPage.totalRows === 0 ? 0 : constituencyPage.startIndex + 1}-${constituencyPage.endIndex} of ${filteredRows.length} filtered rows, from ${constituencyRowCount} total ${escapeHtml(constituencyCaptionSource)} for ${escapeHtml(summary.houseLabel)} ${model.selection.year}.
          </p>
          ${buildPaginationMarkup("constituencies", constituencyPage)}
        </div>
        <div class="atlas-table-scroll">
          <table class="atlas-table atlas-table-constituencies">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Constituency</th>
                <th>Type</th>
                <th>District</th>
                <th>Winner</th>
                <th>Runner-up</th>
                <th>Margin votes</th>
                <th>Margin %</th>
                <th>Turnout</th>
                <th>Electors</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              ${
                constituencyPage.rows.length > 0
                  ? constituencyPage.rows
                      .map(
                        (row) => `
                          <tr>
                            <td>${formatNumber(row.constituencyNumber)}</td>
                            <td>
                              <a
                                class="atlas-table-link"
                                href="${buildAtlasConstituencyPath(model.selection, row)}"
                              >
                                ${escapeHtml(row.constituency)}
                              </a>
                              <span class="atlas-table-sub">View constituency page</span>
                            </td>
                            <td>${escapeHtml(row.reservationType ?? "GEN")}</td>
                            <td>${escapeHtml(row.district)}</td>
                            <td>
                              <strong>${escapeHtml(row.winner)}</strong>
                              <span class="atlas-table-sub">${escapeHtml(row.winnerParty)}</span>
                            </td>
                            <td>
                              ${escapeHtml(row.runnerUp)}
                              <span class="atlas-table-sub">${escapeHtml(row.runnerUpParty)}</span>
                            </td>
                            <td>${formatNumber(row.marginVotes)}</td>
                            <td>${formatPct(row.marginPct)}</td>
                            <td>${formatPct(row.turnoutPct)}</td>
                            <td>${formatNumber(row.totalElectors)}</td>
                            <td>${formatNumber(row.totalVotes)}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : '<tr><td colspan="11">No rows match this search.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `;
}

function buildAtlasAppMarkup(model) {
  if (model.routeState?.type === "constituency") {
    return buildAtlasConstituencyPageMarkup(model);
  }

  if (model.routeState?.type === "district") {
    return buildAtlasDistrictPageMarkup(model);
  }

  return buildAtlasDashboardMarkup(model);
}

function downloadAtlasCsv(model) {
  const rows = filterConstituencyRows(model);
  const header = [
    "constituency",
    "district",
    "winner",
    "winner_party",
    "runner_up",
    "runner_up_party",
    "margin_votes",
    "margin_pct",
    "turnout_pct",
    "winner_vote_share"
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.constituency,
        row.district,
        row.winner,
        row.winnerParty,
        row.runnerUp,
        row.runnerUpParty,
        row.marginVotes,
        row.marginPct,
        row.turnoutPct,
        row.winnerVoteShare
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
  ];
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `election-atlas-${model.selection.state}-${model.selection.house}-${model.selection.year}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindAtlasChartInteractions(root) {
  const charts = root.querySelectorAll("[data-atlas-chart]");

  charts.forEach((chart) => {
    if (!(chart instanceof HTMLElement)) {
      return;
    }

    const tooltip = chart.querySelector("[data-atlas-chart-tooltip]");
    const seriesGroups = Array.from(chart.querySelectorAll(".atlas-chart-series"));
    const legendItems = Array.from(chart.querySelectorAll("[data-atlas-chart-legend]"));
    const points = Array.from(chart.querySelectorAll("[data-atlas-chart-point]"));

    const setActiveSeries = (seriesId) => {
      chart.classList.toggle("has-active-series", Boolean(seriesId));

      seriesGroups.forEach((group) => {
        if (!(group instanceof SVGGElement)) {
          return;
        }

        group.classList.toggle("is-active", group.dataset.seriesId === seriesId);
      });

      legendItems.forEach((item) => {
        if (!(item instanceof HTMLElement)) {
          return;
        }

        item.classList.toggle("is-active", item.dataset.seriesId === seriesId);
      });
    };

    const hideTooltip = () => {
      if (!(tooltip instanceof HTMLElement)) {
        return;
      }

      tooltip.hidden = true;
      tooltip.innerHTML = "";
    };

    const showTooltip = (point) => {
      if (!(tooltip instanceof HTMLElement) || !(point instanceof SVGCircleElement)) {
        return;
      }

      const frameBounds = chart.getBoundingClientRect();
      const pointBounds = point.getBoundingClientRect();
      const party = point.dataset.party ?? "Unknown";
      const year = point.dataset.year ?? "";
      const value = Number.parseFloat(point.dataset.value ?? "");
      const color = point.dataset.color ?? "#8aa4bf";
      const metric = point.dataset.metricLabel ?? "Value";
      const centerX = pointBounds.left - frameBounds.left + pointBounds.width / 2;
      const topY = pointBounds.top - frameBounds.top;

      tooltip.innerHTML = `
        <p class="atlas-tooltip-eyebrow">${escapeHtml(year)}</p>
        <p class="atlas-tooltip-value">
          <span class="atlas-legend-dot" style="background:${color}"></span>
          ${escapeHtml(party)}
        </p>
        <p class="atlas-tooltip-meta">${escapeHtml(metric)} · ${escapeHtml(formatPct(value))}</p>
      `;
      tooltip.hidden = false;
      tooltip.style.left = `${clamp(centerX, 96, frameBounds.width - 96)}px`;
      tooltip.style.top = `${Math.max(topY - 10, 20)}px`;
    };

    points.forEach((point) => {
      if (!(point instanceof SVGCircleElement)) {
        return;
      }

      const activatePoint = () => {
        setActiveSeries(point.dataset.seriesId ?? "");
        showTooltip(point);
      };

      point.addEventListener("mouseenter", activatePoint);
      point.addEventListener("mousemove", activatePoint);
      point.addEventListener("focus", activatePoint);
      point.addEventListener("mouseleave", () => {
        setActiveSeries(null);
        hideTooltip();
      });
      point.addEventListener("blur", () => {
        setActiveSeries(null);
        hideTooltip();
      });
    });

    legendItems.forEach((item) => {
      if (!(item instanceof HTMLButtonElement)) {
        return;
      }

      item.addEventListener("mouseenter", () => setActiveSeries(item.dataset.seriesId ?? ""));
      item.addEventListener("focus", () => setActiveSeries(item.dataset.seriesId ?? ""));
      item.addEventListener("mouseleave", () => setActiveSeries(null));
      item.addEventListener("blur", () => setActiveSeries(null));
    });

    chart.addEventListener("mouseleave", () => {
      setActiveSeries(null);
      hideTooltip();
    });
  });
}

function bindAtlasEvents(root, model, refresh, render) {
  const stateSelect = root.querySelector("[data-atlas-state]");
  const yearSelect = root.querySelector("[data-atlas-year]");
  const searchInput = root.querySelector("[data-atlas-search]");
  const districtSearchInput = root.querySelector("[data-atlas-district-search]");
  const exportButton = root.querySelector("[data-atlas-export]");
  const houseButtons = root.querySelectorAll("[data-atlas-house]");
  const jumpButtons = root.querySelectorAll("[data-atlas-jump-year]");
  const pageButtons = root.querySelectorAll("[data-atlas-page-target]");

  if (stateSelect instanceof HTMLSelectElement) {
    stateSelect.addEventListener("change", async () => {
      model.selection.state = stateSelect.value;
      const years = getAtlasYears(model.states, model.selection.state, model.selection.house);
      model.selection.year = years[0] ?? model.selection.year;
      model.pagination.history = 1;
      model.pagination.districts = 1;
      model.pagination.constituencies = 1;
      model.searchTerm = "";
      model.districtSearchTerm = "";
      await refresh();
    });
  }

  if (yearSelect instanceof HTMLSelectElement) {
    yearSelect.addEventListener("change", async () => {
      model.selection.year = Number.parseInt(yearSelect.value, 10);
      model.pagination.history = 1;
      model.pagination.districts = 1;
      model.pagination.constituencies = 1;
      model.searchTerm = "";
      model.districtSearchTerm = "";
      await refresh();
    });
  }

  houseButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener("click", async () => {
      const house = button.getAttribute("data-atlas-house");

      if (!house || house === model.selection.house) {
        return;
      }

      model.selection.house = house;
      const years = getAtlasYears(model.states, model.selection.state, house);
      model.selection.year = years[0] ?? model.selection.year;
      model.pagination.history = 1;
      model.pagination.districts = 1;
      model.pagination.constituencies = 1;
      model.searchTerm = "";
      model.districtSearchTerm = "";
      await refresh();
    });
  });

  jumpButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener("click", async () => {
      const nextYear = Number.parseInt(button.getAttribute("data-atlas-jump-year") ?? "", 10);

      if (Number.isNaN(nextYear) || nextYear === model.selection.year) {
        return;
      }

      model.selection.year = nextYear;
      model.pagination.history = 1;
      model.pagination.districts = 1;
      model.pagination.constituencies = 1;
      model.searchTerm = "";
      model.districtSearchTerm = "";
      await refresh();
    });
  });

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener("input", () => {
      model.searchTerm = searchInput.value;
      model.pagination.constituencies = 1;
      render({
        target: "constituency",
        selectionStart: searchInput.selectionStart ?? searchInput.value.length,
        selectionEnd: searchInput.selectionEnd ?? searchInput.value.length
      });
    });
  }

  if (districtSearchInput instanceof HTMLInputElement) {
    districtSearchInput.addEventListener("input", () => {
      model.districtSearchTerm = districtSearchInput.value;
      model.pagination.districts = 1;
      render({
        target: "district",
        selectionStart: districtSearchInput.selectionStart ?? districtSearchInput.value.length,
        selectionEnd: districtSearchInput.selectionEnd ?? districtSearchInput.value.length
      });
    });
  }

  pageButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener("click", () => {
      const target = button.getAttribute("data-atlas-page-target");
      const nextPage = Number.parseInt(button.getAttribute("data-atlas-page") ?? "", 10);

      if (
        (target !== "history" && target !== "districts" && target !== "constituencies") ||
        Number.isNaN(nextPage) ||
        nextPage < 1
      ) {
        return;
      }

      model.pagination[target] = nextPage;

      render();
    });
  });

  if (exportButton instanceof HTMLButtonElement) {
    exportButton.addEventListener("click", () => downloadAtlasCsv(model));
  }

  bindAtlasChartInteractions(root);
}

async function initElectionAtlas(root, bootstrap) {
  const defaultSelection = bootstrap.selection ?? { state: "bihar", house: "VS", year: 2020 };
  const getStateLabel = (stateSlug) =>
    bootstrap.states?.find((entry) => entry.slug === stateSlug)?.name ?? stateSlug;
  const model = {
    states: bootstrap.states ?? [],
    selection: defaultSelection,
    pipeline: bootstrap.pipeline,
    elections: bootstrap.elections ?? [],
    summary: bootstrap.summary,
    constituencies: bootstrap.constituencies,
    districts: bootstrap.districts,
    constituencyDetail: null,
    districtDetail: null,
    routeState: null,
    searchTerm: "",
    districtSearchTerm: "",
    pagination: {
      history: 1,
      districts: 1,
      constituencies: 1
    }
  };
  let requestSequence = 0;

  const render = (focusState = null) => {
    root.innerHTML = buildAtlasAppMarkup(model);
    bindAtlasEvents(root, model, refresh, render);

    if (!focusState?.target) {
      return;
    }

    const selector =
      focusState.target === "district" ? "[data-atlas-district-search]" : "[data-atlas-search]";
    const input = root.querySelector(selector);

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.focus();

    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number"
    ) {
      input.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  };

  const syncRouteState = (pathname = bootstrap.initialPath ?? window.location.pathname) => {
    const parsed = parseAtlasPath(pathname, model.selection);

    model.routeState = {
      ...parsed,
      stateLabel: getStateLabel(parsed.selection.state)
    };
    model.selection = parsed.selection;
  };

  const loadOverviewDistricts = async (params, activeRequest) => {
    if (model.selection.house !== "VS") {
      model.districts = {
        selection: model.selection,
        coverage: {
          liveRows: 0,
          note: "District intelligence is intentionally hidden for Lok Sabha overview."
        },
        metrics: {},
        districts: []
      };
      return;
    }

    try {
      const districtsResponse = await fetch(`/api/election-atlas/districts?${params.toString()}`);

      if (!districtsResponse.ok) {
        return;
      }

      const districtsData = await districtsResponse.json();

      if (activeRequest !== requestSequence) {
        return;
      }

      model.districts = districtsData;
      render();
    } catch {
      // Keep the already-rendered overview in place if district loading lags or fails.
    }
  };

  const refresh = async () => {
    requestSequence += 1;
    const activeRequest = requestSequence;
    root.classList.add("is-loading");

    try {
      const params = new URLSearchParams({
        state: model.selection.state,
        house: model.selection.house,
        year: String(model.selection.year)
      });

      let payloads;

      if (model.routeState?.type === "constituency") {
        const detailParams = new URLSearchParams({
          ...Object.fromEntries(params.entries()),
          seat: model.routeState.seat ?? "",
          slug: model.routeState.slug ?? ""
        });
        const [detailResponse, summaryResponse] = await Promise.all([
          fetch(`/api/election-atlas/constituency-detail?${detailParams.toString()}`),
          fetch(`/api/election-atlas/state-summary?${params.toString()}`)
        ]);

        if (!detailResponse.ok || !summaryResponse.ok) {
          throw new Error("Unable to load the constituency page.");
        }

        const [detailData, summaryData] = await Promise.all([
          detailResponse.json(),
          summaryResponse.json()
        ]);

        payloads = { detailData, summaryData };
      } else if (model.routeState?.type === "district") {
        const detailParams = new URLSearchParams({
          ...Object.fromEntries(params.entries()),
          slug: model.routeState.slug ?? ""
        });
        const [detailResponse, summaryResponse] = await Promise.all([
          fetch(`/api/election-atlas/district-detail?${detailParams.toString()}`),
          fetch(`/api/election-atlas/state-summary?${params.toString()}`)
        ]);

        if (!detailResponse.ok || !summaryResponse.ok) {
          throw new Error("Unable to load the district page.");
        }

        const [detailData, summaryData] = await Promise.all([
          detailResponse.json(),
          summaryResponse.json()
        ]);

        payloads = { detailData, summaryData };
      } else {
        const [electionsResponse, summaryResponse, constituenciesResponse] = await Promise.all([
          fetch(`/api/election-atlas/elections?${params.toString()}`),
          fetch(`/api/election-atlas/state-summary?${params.toString()}`),
          fetch(`/api/election-atlas/constituencies?${params.toString()}`)
        ]);

        if (!electionsResponse.ok || !summaryResponse.ok || !constituenciesResponse.ok) {
          throw new Error("Unable to refresh the election atlas beta.");
        }

        const [electionsData, summaryData, constituenciesData] = await Promise.all([
          electionsResponse.json(),
          summaryResponse.json(),
          constituenciesResponse.json()
        ]);

        payloads = { electionsData, summaryData, constituenciesData };
      }

      if (activeRequest !== requestSequence) {
        return;
      }

      model.selection = payloads.summaryData.selection;
      model.pipeline = payloads.summaryData.pipeline ?? model.pipeline;
      model.summary = payloads.summaryData.summary;
      model.routeState = {
        ...(model.routeState ?? { type: "overview" }),
        selection: model.selection,
        stateLabel: getStateLabel(model.selection.state)
      };

      if (model.routeState.type === "constituency") {
        model.constituencyDetail = payloads.detailData;
        model.districtDetail = null;
      } else if (model.routeState.type === "district") {
        model.districtDetail = payloads.detailData;
        model.constituencyDetail = null;
      } else {
        model.elections = payloads.electionsData.elections;
        model.constituencies = payloads.constituenciesData;
        model.constituencyDetail = null;
        model.districtDetail = null;
        const overviewPath = buildAtlasOverviewPath(model.selection);

        if (window.location.pathname !== overviewPath) {
          window.history.replaceState({}, "", overviewPath);
        }

        model.districts =
          model.selection.house === "VS"
            ? {
                selection: model.selection,
                coverage: {
                  liveRows: 0,
                  note: "Loading district intelligence..."
                },
                metrics: {},
                districts: []
              }
            : {
                selection: model.selection,
                coverage: {
                  liveRows: 0,
                  note: "District intelligence is intentionally hidden for Lok Sabha overview."
                },
                metrics: {},
                districts: []
              };
      }

      render();

      if (model.routeState.type === "overview") {
        loadOverviewDistricts(params, activeRequest);
      }
    } catch (error) {
      root.innerHTML = `
        <div class="atlas-error">
          <p class="eyebrow">Atlas error</p>
          <h3>Refresh failed</h3>
          <p>${escapeHtml(error?.message ?? "The election atlas beta could not load.")}</p>
        </div>
      `;
    } finally {
      root.classList.remove("is-loading");
    }
  };

  syncRouteState();

  if (model.routeState?.type === "overview") {
    render();
  }

  await refresh();
}

const atlasRoot = document.querySelector("[data-election-atlas]");
const atlasBootstrap = readJsonScript("election-atlas-bootstrap");

if (atlasRoot instanceof HTMLElement && atlasBootstrap) {
  initElectionAtlas(atlasRoot, atlasBootstrap);
}
