import { siteContent } from "./site-content.js";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/surveys", label: "Surveys" },
  { href: "/track-record", label: "Track Record" },
  { href: "/leadership", label: "Leadership" },
  { href: "/contact", label: "Contact" }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/index.html") {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function renderNav(currentPath) {
  return navItems
    .map((item) => {
      const activeClass = currentPath === item.href ? "is-active" : "";

      return `<a class="${activeClass}" href="${item.href}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderBrandLogo() {
  return `
    <svg
      class="brand-logo"
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="128" cy="128" r="122" fill="#111216" />
      <path
        d="M34 176 C78 183 55 102 108 74 C141 57 169 75 183 107"
        fill="none"
        stroke="#efe5d6"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="18"
      />
      <path
        d="M103 150 C129 146 157 144 192 145"
        fill="none"
        stroke="#efe5d6"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="15"
      />
      <path
        d="M152 84 L224 151"
        fill="none"
        stroke="#efe5d6"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="15"
      />
      <path
        d="M199 132 L224 151 L198 161"
        fill="none"
        stroke="#efe5d6"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="12"
      />
    </svg>
  `;
}

function renderPremiumBar() {
  return siteContent.focusAreas
    .map(
      (item) => `
        <span class="premium-chip">
          <span class="premium-dot"></span>
          ${escapeHtml(item)}
        </span>
      `
    )
    .join("");
}

function renderStatCards(stats = siteContent.stats) {
  return stats
    .map(
      (stat) => `
        <article class="stat-card reveal">
          <p class="stat-value">${escapeHtml(stat.value)}</p>
          <p class="stat-label">${escapeHtml(stat.label)}</p>
        </article>
      `
    )
    .join("");
}

function renderCards(items, className = "info-card") {
  return items
    .map(
      (item) => `
        <article class="${className} reveal">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderListItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderSurveyOpsCards() {
  return siteContent.surveyOperationalModes
    .map(
      (mode) => `
        <article class="ops-card reveal">
          <div class="ops-head">
            <h3>${escapeHtml(mode.title)}</h3>
            <p class="ops-tag">Best for: ${escapeHtml(mode.bestFor)}</p>
          </div>
          <div class="ops-block">
            <p class="ops-label">Use when</p>
            <ul class="ops-list">
              ${renderListItems(mode.useWhen)}
            </ul>
          </div>
          <div class="ops-block">
            <p class="ops-label">Strengths</p>
            <ul class="ops-list">
              ${renderListItems(mode.strengths)}
            </ul>
          </div>
          <div class="ops-grid-meta">
            <div class="ops-block">
              <p class="ops-label">Risks</p>
              <ul class="ops-list">
                ${renderListItems(mode.risks)}
              </ul>
            </div>
            <div class="ops-block">
              <p class="ops-label">Controls</p>
              <ul class="ops-list">
                ${renderListItems(mode.controls)}
              </ul>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderBiasCards() {
  return siteContent.surveyBiasControls
    .map(
      (item) => `
        <article class="bias-card reveal">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="bias-issue"><strong>Issue:</strong> ${escapeHtml(item.issue)}</p>
          <p class="bias-control"><strong>Control:</strong> ${escapeHtml(item.control)}</p>
        </article>
      `
    )
    .join("");
}

function renderPartnerships() {
  return siteContent.partnerships
    .map(
      (partner) => `
        <article class="partner-card reveal">
          <p class="eyebrow">Strategic Alliance</p>
          <h3>${escapeHtml(partner.name)}</h3>
          <p>${escapeHtml(partner.summary)}</p>
        </article>
      `
    )
    .join("");
}

function renderTrackRecord(includeDetail = false) {
  return siteContent.trackRecord
    .map(
      (entry) => `
        <article class="track-card reveal">
          <div class="track-head">
            <span class="track-cycle">${escapeHtml(entry.cycle)}</span>
            <span class="track-result">${escapeHtml(entry.result)}</span>
          </div>
          <h3>${escapeHtml(entry.geography)}</h3>
          <p class="track-scope">${escapeHtml(entry.scope)}</p>
          ${includeDetail ? `<p class="track-detail">${escapeHtml(entry.detail)}</p>` : ""}
        </article>
      `
    )
    .join("");
}

function renderOperatingModel() {
  return siteContent.operatingModel
    .map(
      (item) => `
        <article class="phase-card reveal">
          <span class="phase-index">${escapeHtml(item.phase)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderLeaderProfiles() {
  return siteContent.leaders
    .map(
      (leader) => `
        <article class="leader-card reveal">
          <p class="eyebrow">Founding Team</p>
          <h3>${escapeHtml(leader.name)}</h3>
          <a
            class="leader-link"
            href="${escapeHtml(leader.linkedin)}"
            target="_blank"
            rel="noreferrer"
          >
            View LinkedIn Profile
          </a>
        </article>
      `
    )
    .join("");
}

function renderOrigins() {
  return siteContent.teamOrigins
    .map((origin) => `<span class="origin-pill">${escapeHtml(origin)}</span>`)
    .join("");
}

function renderPillList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderRouteCards() {
  const routes = [
    {
      href: "/capabilities",
      title: "Capabilities",
      text: "See the full consulting stack across strategy, data, field operations, and delivery."
    },
    {
      href: "/surveys",
      title: "Surveys",
      text: "Review the survey application, methodology, sample design, and reporting backbone."
    },
    {
      href: "/track-record",
      title: "Track Record",
      text: "Review constituency-level wins, scale programs, and execution outcomes."
    },
    {
      href: "/leadership",
      title: "Leadership",
      text: "Connect directly with the founding team through dedicated profile links."
    },
    {
      href: "/contact",
      title: "Contact",
      text: "Send a campaign brief and start a focused strategy conversation."
    }
  ];

  return routes
    .map(
      (item) => `
        <a class="route-card reveal" href="${item.href}">
          <span class="route-card-title">${escapeHtml(item.title)}</span>
          <span class="route-card-text">${escapeHtml(item.text)}</span>
          <span class="route-card-link">Open Page</span>
        </a>
      `
    )
    .join("");
}

function renderSummaryList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderContactForm() {
  return `
    <form class="contact-form reveal" id="contact-form" novalidate>
      <label>
        Name
        <input type="text" name="name" placeholder="Full name" required />
      </label>
      <label>
        Work Email
        <input type="email" name="email" placeholder="name@campaign.org" required />
      </label>
      <label>
        Organization
        <input type="text" name="organization" placeholder="Candidate, party, PAC, or advisory group" />
      </label>
      <label>
        Phone
        <input type="tel" name="phone" placeholder="+91 ..." />
      </label>
      <label>
        Constituency / Region
        <input type="text" name="constituency" placeholder="AC, district, or state" />
      </label>
      <label>
        Engagement Type
        <select name="campaignType">
          <option value="">Select a focus area</option>
          <option>Election strategy</option>
          <option>Research and surveys</option>
          <option>Digital outreach</option>
          <option>War-room setup</option>
          <option>Grassroots operations</option>
          <option>Full campaign consulting</option>
        </select>
      </label>
      <label class="form-span">
        Campaign Goals
        <textarea
          name="goals"
          rows="5"
          placeholder="Describe the challenge, election cycle, timeline, or support you need."
          required
        ></textarea>
      </label>
      <button class="button button-primary" type="submit">Submit Consultation Request</button>
      <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
    </form>
  `;
}

function renderContactDetails() {
  const { phones, email } = siteContent.contact.details;

  return `
    <div class="contact-direct reveal">
      <p class="eyebrow">Direct Contact</p>
      <div class="contact-direct-grid">
        <a href="tel:+917042113797">+91 ${escapeHtml(phones[0])}</a>
        <a href="tel:+918210235445">+91 ${escapeHtml(phones[1])}</a>
        <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
      </div>
    </div>
  `;
}

function renderLayout(currentPath, page) {
  const canonicalPath = currentPath === "/" ? "" : currentPath;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="theme-color" content="#0f1b27" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600;6..96,700;6..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Arjuna Strategy Consulting",
        "description": ${JSON.stringify(page.description)},
        "url": ${JSON.stringify(`http://localhost:3000${canonicalPath}`)},
        "knowsAbout": ["Political strategy", "Campaign management", "Voter analytics", "Survey operations", "Digital outreach"]
      }
    </script>
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <a class="brand-mark" href="/">
          ${renderBrandLogo()}
          <span class="brand-text">${escapeHtml(siteContent.brand.name)}</span>
        </a>
        <nav class="site-nav" aria-label="Primary">
          ${renderNav(currentPath)}
        </nav>
      </header>

      <section class="premium-strip reveal" aria-label="Premium capability bar">
        <div class="premium-label">
          <span class="premium-label-line"></span>
          <span>Premium Campaign Stack</span>
        </div>
        <div class="premium-track">
          ${renderPremiumBar()}
        </div>
      </section>

      <main class="page-main">
        ${page.hero}
        ${page.body}
      </main>

      <footer class="site-footer">
        <p>Arjuna Strategy Consulting</p>
        <p>Political strategy, campaign intelligence, and execution-led consulting.</p>
        <p>+91 ${escapeHtml(siteContent.contact.details.phones[0])} · +91 ${escapeHtml(siteContent.contact.details.phones[1])} · ${escapeHtml(siteContent.contact.details.email)}</p>
      </footer>
    </div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}

function buildHomePage() {
  const title = siteContent.meta.title;
  const description = siteContent.meta.description;

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Political Strategy. Campaign Intelligence. Ground Execution.</p>
        <h1>${escapeHtml(siteContent.brand.tagline)}</h1>
        <p class="page-intro">${escapeHtml(siteContent.brand.narrative)}</p>
        <div class="page-actions">
          <a class="button button-primary" href="/contact">${escapeHtml(siteContent.brand.primaryCta)}</a>
          <a class="button button-secondary" href="/capabilities">${escapeHtml(siteContent.brand.secondaryCta)}</a>
        </div>
      </div>
      <div class="page-stack">
        <aside class="page-panel reveal">
          <p class="eyebrow">Electoral Metrics</p>
          <h2 class="page-panel-title">Execution measured in constituencies, not headlines.</h2>
          <div class="metric-grid">
            ${renderStatCards()}
          </div>
        </aside>
      </div>
    </section>
  `;

  const body = `
    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Overview</p>
          <h2>Campaign architecture built for speed and control.</h2>
          <p>
            Arjuna Strategy Consulting combines strategy, analytics, and field execution into one operating system.
          </p>
        </div>
        <div class="card-grid card-grid-three">
          ${renderCards(siteContent.pillars)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Survey Backbone</p>
          <h2>${escapeHtml(siteContent.surveyOverview.headline)}</h2>
          <p>
            The survey layer powers constituency diagnostics, field validation, sentiment measurement, and downstream consulting recommendations.
          </p>
          <div class="page-actions">
            <a class="button button-secondary" href="/surveys">Explore Survey Systems</a>
          </div>
        </div>
        <div class="page-stack">
          <aside class="page-panel reveal">
            <p class="eyebrow">What It Handles</p>
            <ul class="page-note-list">
              ${renderSummaryList([
                "CATI and call-centre-based research flows",
                "CAPI and field-led enumerator collection",
                "Technical, subjective, objective, and mixed questionnaires"
              ])}
            </ul>
          </aside>
          <aside class="page-panel reveal">
            <p class="eyebrow">Why It Matters</p>
            <ul class="page-note-list">
              ${renderSummaryList([
                "Correct sample-size calculation before field deployment",
                "Validation rules and QA during live collection",
                "Statistical reporting that directly feeds consulting decisions"
              ])}
            </ul>
          </aside>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Structured Navigation</p>
          <h2>Each menu item now leads to a dedicated page.</h2>
          <p>
            The site is distributed by intent so visitors can review capabilities, proof, leadership, or contact without scrolling through everything at once.
          </p>
        </div>
        <div class="route-card-grid">
          ${renderRouteCards()}
        </div>
      </div>
    </section>

    <section class="section section-contrast">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Credibility Layer</p>
          <h2>Backed by specialist alliances and institutional campaign experience.</h2>
          <p>
            Technology, content, and campaign execution are supported by cross-functional partnerships and deep exposure to fast-moving political environments.
          </p>
        </div>
        <div class="page-stack">
          <div class="card-grid card-grid-three">
            ${renderPartnerships()}
          </div>
          <div class="origin-row reveal">
            ${renderOrigins()}
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="cta-band reveal">
        <div>
          <p class="eyebrow">Next Step</p>
          <h2>Move from overview to a campaign-specific conversation.</h2>
          <p>
            Use the contact page to send a constituency brief, immediate challenge, or scoping request.
          </p>
        </div>
        <a class="button button-primary" href="/contact">Open Contact Page</a>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

function buildCapabilitiesPage() {
  const title = `Capabilities | ${siteContent.brand.name}`;
  const description =
    "Review Arjuna Strategy Consulting's campaign capabilities across strategy, data systems, field operations, and political execution.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Capabilities</p>
        <h1>Integrated campaign capability from diagnosis to turnout.</h1>
        <p class="page-intro">
          This page is focused only on what Arjuna can build, run, and optimise across strategy, data, media, and operations.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="/contact">Discuss Scope</a>
          <a class="button button-secondary" href="/surveys">Survey Systems</a>
        </div>
      </div>
      <aside class="page-panel reveal">
        <p class="eyebrow">Coverage</p>
        <h2 class="page-panel-title">A full consulting stack, not isolated support modules.</h2>
        <ul class="pill-list">
          ${renderPillList(siteContent.focusAreas)}
        </ul>
      </aside>
    </section>
  `;

  const body = `
    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Core Expertise</p>
          <h2>Strategy systems designed for political complexity.</h2>
          <p>
            The consulting layer is structured around sharper targeting, stronger decision support, and faster execution loops.
          </p>
        </div>
        <div class="card-grid card-grid-three">
          ${renderCards(siteContent.pillars)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Core Strengths</p>
          <h2>Capabilities that strengthen both message and machinery.</h2>
          <p>
            Data systems, field intelligence, and execution workflows are aligned to reduce friction inside the campaign.
          </p>
        </div>
        <div class="card-grid card-grid-two">
          ${renderCards(siteContent.strengths)}
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Services</p>
          <h2>Operational support across research, outreach, and media execution.</h2>
          <p>
            The service mix covers campaign communication, survey systems, field execution, analytics, and campaign technology, with a dedicated survey application sitting underneath the research layer.
          </p>
        </div>
        <div class="card-grid card-grid-two">
          ${renderCards(siteContent.services)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="cta-band reveal">
        <div>
          <p class="eyebrow">Survey Systems</p>
          <h2>Our survey application deserves its own page because it supports the full consulting pipeline.</h2>
          <p>
            Review how we run CATI, CAPI, technical, subjective, and objective studies with correct sample planning and statistical reporting.
          </p>
        </div>
        <a class="button button-primary" href="/surveys">Open Surveys Page</a>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Deliverables</p>
          <h2>Consulting outputs designed to move from insight to action.</h2>
          <p>
            Engagements can be modular, but the deliverables always stay tied to execution, measurement, and decision-making.
          </p>
        </div>
        <div class="card-grid card-grid-two">
          ${renderCards(siteContent.deliverables)}
        </div>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

function buildSurveysPage() {
  const title = `Surveys | ${siteContent.brand.name}`;
  const description =
    "Detailed overview of Arjuna Strategy Consulting's survey application, including CATI, CAPI, sample-size calculation, software controls, and statistical reporting.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Surveys</p>
        <h1>${escapeHtml(siteContent.surveyOverview.headline)}</h1>
        <p class="page-intro">${escapeHtml(siteContent.surveyOverview.summary)}</p>
        <div class="page-actions">
          <a class="button button-primary" href="/contact">Discuss A Survey Program</a>
          <a class="button button-secondary" href="/capabilities">Back To Capabilities</a>
        </div>
      </div>
      <div class="page-stack survey-visual-grid">
        <aside class="page-panel reveal">
          <p class="eyebrow">Survey Stack</p>
          <h2 class="page-panel-title">One controlled application for collection, quality control, and reporting.</h2>
          <div class="metric-grid">
            ${renderStatCards(siteContent.surveyStats)}
          </div>
        </aside>
        <figure class="diagram-panel reveal">
          <figcaption class="diagram-caption">Survey system tree</figcaption>
          <img class="diagram-image" src="/survey-ops-map.svg" alt="Tree diagram showing sampling, instrument, field operations, quality control, weighting, and insight." />
        </figure>
        <figure class="diagram-panel reveal">
          <figcaption class="diagram-caption">People and control loop</figcaption>
          <img class="diagram-image" src="/survey-team-loop.svg" alt="Workflow diagram showing supervisor, caller, enumerator, respondent, and quality review loop." />
        </figure>
      </div>
    </section>
  `;

  const body = `
    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Operational Methods</p>
          <h2>Choose the mode based on speed, depth, supervision, and risk.</h2>
          <p>
            Reliable survey operations are not one-mode by default. We choose CATI, CAPI, CAWI, or hybrid execution based on coverage, respondent behavior, and deadline constraints.
          </p>
        </div>
        <div class="ops-grid">
          ${renderSurveyOpsCards()}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Statistical Methods</p>
          <h2>So the results do not lie, drift, or overstate weak segments.</h2>
          <p>
            Sampling design, sample-size calculation, margin of error, weighting, trend control, and model-assisted estimation are built into the methodology layer before interpretation starts.
          </p>
          <ul class="pill-list">
            ${renderPillList(siteContent.surveySamplingKeywords)}
          </ul>
        </div>
        <div class="page-stack">
          <figure class="diagram-panel reveal">
            <figcaption class="diagram-caption">Sampling and estimation map</figcaption>
            <img class="diagram-image" src="/survey-sampling-map.svg" alt="Diagram showing sampling approaches, margin of error, weighting, significance testing, and estimation flow." />
          </figure>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.surveyStatMethodsDetailed)}
          </div>
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Survey Flow Engineering</p>
          <h2>We build the flow carefully and correct it when live signals show drift.</h2>
          <p>
            A survey is a funnel. If the funnel leaks through bad sequencing, skip failures, or fatigue, the sample shifts and the estimate drifts. We treat flow like a product system.
          </p>
          <ul class="summary-list">
            ${renderSummaryList(siteContent.surveyFlowPrinciples)}
          </ul>
        </div>
        <div class="page-stack">
          <figure class="diagram-panel reveal">
            <figcaption class="diagram-caption">Flow correction loop</figcaption>
            <img class="diagram-image" src="/survey-flow-loop.svg" alt="Diagram showing live signal detection, wording revisions, skip updates, retraining, and version control." />
          </figure>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.surveyFlowControls)}
          </div>
          <aside class="page-panel reveal">
            <p class="eyebrow">Live Signals We Watch</p>
            <ul class="page-note-list">
              ${renderSummaryList(siteContent.surveyCorrectionSignals)}
            </ul>
          </aside>
          <aside class="page-panel reveal">
            <p class="eyebrow">Correction Loop</p>
            <ul class="page-note-list">
              ${renderSummaryList(siteContent.surveyCorrectionLoop)}
            </ul>
          </aside>
        </div>
      </div>
    </section>

    <section class="section section-contrast">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Quality System</p>
          <h2>Controls at design, field, and data layers keep the survey honest.</h2>
          <p>
            Quality is not a checklist. It is a prevention, detection, and correction system that reduces avoidable error before, during, and after fieldwork.
          </p>
        </div>
        <div class="page-stack">
          <figure class="diagram-panel reveal">
            <figcaption class="diagram-caption">Quality timeline</figcaption>
            <img class="diagram-image" src="/survey-quality-system.svg" alt="Timeline diagram showing prevention before field, detection during field, and correction after field." />
          </figure>
          <div class="card-grid card-grid-three">
            ${renderCards(siteContent.surveyQualityStages)}
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Bias Control</p>
          <h2>Bias is managed actively, not assumed away.</h2>
          <p>
            We actively reduce interviewer, questionnaire, sampling, routing, coverage, recall, translation, and processing bias through design discipline and audit-led controls.
          </p>
          <ul class="summary-list">
            ${renderSummaryList([
              "Agent behavior is monitored and standardized",
              "Questionnaire design is tested before scale",
              "Weighting and processing choices are documented and auditable"
            ])}
          </ul>
        </div>
        <div class="page-stack">
          <figure class="diagram-panel reveal">
            <figcaption class="diagram-caption">Bias matrix</figcaption>
            <img class="diagram-image" src="/survey-bias-matrix.svg" alt="Matrix diagram showing survey bias sources and the corresponding control mechanisms." />
          </figure>
          <div class="bias-grid">
            ${renderBiasCards()}
          </div>
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Deliverables</p>
          <h2>What you get at the end of the survey program.</h2>
          <p>
            The output is not just a dataset. We deliver the instrument, operations structure, methodology note, reporting layers, and a documented integrity view.
          </p>
        </div>
        <div class="check-grid">
          <aside class="page-panel reveal">
            <p class="eyebrow">Deliverables</p>
            <ul class="page-note-list">
              ${renderSummaryList(siteContent.surveyDeliverablesDetailed)}
            </ul>
          </aside>
          <aside class="page-panel reveal">
            <p class="eyebrow">Non-Negotiables</p>
            <ul class="page-note-list">
              ${renderSummaryList(siteContent.surveyNonNegotiables)}
            </ul>
          </aside>
          <aside class="page-panel reveal">
            <p class="eyebrow">Consulting Impact</p>
            <h2 class="page-panel-title">This is why survey operations anchor the full consulting recommendation.</h2>
            <p>
              Once sampling, field controls, and reporting are clean, campaign advice becomes sharper because the consulting layer is built on observed data rather than intuition alone.
            </p>
          </aside>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.surveyOutputs)}
          </div>
        </div>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

function buildTrackRecordPage() {
  const title = `Track Record | ${siteContent.brand.name}`;
  const description =
    "Explore Arjuna Strategy Consulting's constituency-level campaign track record, scaled execution programs, and operating model.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Track Record</p>
        <h1>Execution that scales from targeted AC contests to statewide systems.</h1>
        <p class="page-intro">
          This page isolates proof: wins, scale, execution patterns, and the operating model used to keep campaigns responsive.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="/contact">Request A Review</a>
          <a class="button button-secondary" href="/capabilities">See Capabilities</a>
        </div>
      </div>
      <div class="page-stack">
        <aside class="page-panel reveal">
          <p class="eyebrow">Performance Snapshot</p>
          <h2 class="page-panel-title">Focused wins supported by scalable operating infrastructure.</h2>
          <div class="metric-grid">
            ${renderStatCards(siteContent.stats.slice(0, 4))}
          </div>
        </aside>
      </div>
    </section>
  `;

  const body = `
    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Election Cycles</p>
          <h2>AC-level work with state-by-state execution depth.</h2>
          <p>
            The portfolio covers targeted contests, multi-seat operations, and scaled intelligence infrastructure.
          </p>
          <ul class="summary-list">
            ${renderSummaryList([
              "Winner-led execution in Uttar Pradesh, Uttarakhand, Jharkhand, J&K, and Haryana",
              "66% strike rate across the 2025 Delhi AC portfolio",
              "Scaled data and outreach systems across 94 ACs in Bihar"
            ])}
          </ul>
        </div>
        <div class="card-grid card-grid-two track-grid-detail">
          ${renderTrackRecord(true)}
        </div>
      </div>
    </section>

    <section class="section section-contrast">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Operating Model</p>
          <h2>A repeatable campaign rhythm built for adjustment under pressure.</h2>
          <p>
            Diagnostics, mobilisation, and continuous optimisation keep the campaign aligned from field input to leadership action.
          </p>
        </div>
        <div class="phase-grid">
          ${renderOperatingModel()}
        </div>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

function buildLeadershipPage() {
  const title = `Leadership | ${siteContent.brand.name}`;
  const description =
    "Connect with the Arjuna Strategy Consulting leadership team and review the institutional campaign environments that shaped the firm.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Leadership</p>
        <h1>Direct access to the founding team, without a cluttered profile wall.</h1>
        <p class="page-intro">
          This page keeps leadership simple: names, access, and the institutional environments that shaped the consulting practice.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="/contact">Start A Conversation</a>
          <a class="button button-secondary" href="/track-record">See Track Record</a>
        </div>
      </div>
      <aside class="page-panel reveal">
        <p class="eyebrow">Institutional Background</p>
        <h2 class="page-panel-title">Built inside campaign, analytics, and political execution systems.</h2>
        <div class="origin-row">
          ${renderOrigins()}
        </div>
      </aside>
    </section>
  `;

  const body = `
    <section class="section section-contrast">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Founding Team</p>
          <h2>Use the dedicated links to connect directly.</h2>
          <p>
            Leadership is intentionally presented without long bios so the page stays clean and direct.
          </p>
        </div>
        <div class="leader-stack">
          ${renderLeaderProfiles()}
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Partnership Context</p>
          <h2>Leadership is supported by external capability depth where needed.</h2>
          <p>
            AI, media, and technology partners extend specialist execution without diluting strategic control.
          </p>
        </div>
        <div class="card-grid card-grid-three">
          ${renderPartnerships()}
        </div>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

function buildContactPage() {
  const title = `Contact | ${siteContent.brand.name}`;
  const description =
    "Send a campaign brief to Arjuna Strategy Consulting through the dedicated contact page and Node.js enquiry form.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Contact</p>
        <h1>${escapeHtml(siteContent.contact.heading)}</h1>
        <p class="page-intro">${escapeHtml(siteContent.contact.text)}</p>
      </div>
      <aside class="page-panel reveal">
        <p class="eyebrow">What To Send</p>
        <h2 class="page-panel-title">A concise brief helps us scope faster.</h2>
        <ul class="page-note-list">
          ${renderSummaryList([
            "Constituency, district, or state",
            "Immediate challenge or campaign objective",
            "Expected support window or election timeline"
          ])}
        </ul>
      </aside>
    </section>
  `;

  const body = `
    <section class="section section-contrast">
      <div class="contact-page-grid">
        <aside class="contact-side-panel reveal">
          <p class="eyebrow">Consultation Intake</p>
          <h2 class="page-panel-title">The enquiry form writes directly into the project’s local intake pipeline.</h2>
          <p>
            Use this page for campaign briefs, diagnostic reviews, war-room setup requests, or constituency support needs.
          </p>
          <ul class="pill-list">
            ${renderPillList(siteContent.focusAreas)}
          </ul>
        </aside>
        <div class="contact-stack">
          ${renderContactDetails()}
          ${renderContactForm()}
        </div>
      </div>
    </section>
  `;

  return { title, description, hero, body };
}

const pageBuilders = {
  "/": buildHomePage,
  "/capabilities": buildCapabilitiesPage,
  "/surveys": buildSurveysPage,
  "/track-record": buildTrackRecordPage,
  "/leadership": buildLeadershipPage,
  "/contact": buildContactPage
};

export function renderPage(pathname = "/") {
  const currentPath = normalizePath(pathname);
  const builder = pageBuilders[currentPath] ?? pageBuilders["/"];
  const page = builder();

  return renderLayout(currentPath, page);
}
