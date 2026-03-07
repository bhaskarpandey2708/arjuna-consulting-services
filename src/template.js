import { siteContent } from "./site-content.js";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/capabilities", label: "Work" },
  { href: "/surveys", label: "Surveys" },
  { href: "/leadership", label: "Connect" }
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

function renderLeaderProfiles(className = "leader-card") {
  return siteContent.leaders
    .map(
      (leader) => `
        <article class="${className} reveal">
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
    .map((origin) => {
      const label = typeof origin === "string" ? origin : origin.label;
      const url = typeof origin === "string" ? "" : origin.url ?? "";

      if (url) {
        return `
          <a class="origin-pill origin-pill-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(label)}
          </a>
        `;
      }

      return `<span class="origin-pill">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function renderReferenceLinks() {
  return siteContent.references
    .map(
      (reference) => `
        <a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(reference.name)}
        </a>
      `
    )
    .join("");
}

function renderPillList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderProofHighlights() {
  return siteContent.proofHighlights
    .map(
      (item) => `
        <article class="signal-card reveal">
          <p class="signal-value">${escapeHtml(item.value)}</p>
          <p class="signal-label">${escapeHtml(item.label)}</p>
          <p class="signal-text">${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderAnswerCards(items) {
  return items
    .map(
      (item) => `
        <article class="answer-card reveal">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderCapabilityProofs() {
  return siteContent.capabilityProofs
    .map(
      (item) => `
        <article class="proof-note-card reveal">
          <p class="eyebrow">Capability In Action</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="proof-note-strong">${escapeHtml(item.proof)}</p>
          <p>${escapeHtml(item.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderFaqCards(items) {
  return items
    .map(
      (item) => `
        <article class="faq-card reveal">
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `
    )
    .join("");
}

function renderFaqSection({ eyebrow = "FAQs", title, intro, items = [], sectionClass = "section section-soft" }) {
  if (!items.length) {
    return "";
  }

  return `
    <section class="${sectionClass}">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(intro)}</p>
        </div>
        <div class="faq-grid">
          ${renderFaqCards(items)}
        </div>
      </div>
    </section>
  `;
}

function renderEngagementSteps() {
  return siteContent.engagementSteps
    .map(
      (item) => `
        <article class="engagement-card reveal">
          <span class="engagement-step">${escapeHtml(item.phase)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderRouteCards() {
  const routes = [
    {
      href: "/capabilities",
      title: "Work",
      text: "See the political consulting stack together with the wins, scale programs, and operating proof behind it."
    },
    {
      href: "/surveys",
      title: "Surveys",
      text: "Review the political survey research application, methodology, sample design, and reporting backbone."
    },
    {
      href: "/leadership",
      title: "Connect",
      text: "Meet the founders, review the operating context, and send a campaign brief in one place."
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
      <label class="honeypot-field" aria-hidden="true">
        Website
        <input type="text" name="website" tabindex="-1" autocomplete="off" />
      </label>
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
      <button class="button button-primary" type="submit">Send Campaign Brief</button>
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

function createPersonId(baseUrl, name) {
  return `${baseUrl}#person-${String(name)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}`;
}

function buildAbsoluteUrl(baseUrl, pathname = "") {
  const normalizedBase = String(baseUrl || "http://127.0.0.1:3000").replace(/\/+$/, "");

  if (!pathname || pathname === "/") {
    return normalizedBase;
  }

  return `${normalizedBase}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function getCanonicalPath(pathname) {
  return pathname === "/" ? "" : pathname;
}

function getPageLabel(pathname) {
  return navItems.find((item) => item.href === pathname)?.label ?? "Home";
}

function buildBreadcrumbSchema(currentPath, baseUrl) {
  const items = [{ name: "Home", url: buildAbsoluteUrl(baseUrl, "/") }];

  if (currentPath !== "/") {
    items.push({
      name: getPageLabel(currentPath),
      url: buildAbsoluteUrl(baseUrl, currentPath)
    });
  }

  return {
    "@type": "BreadcrumbList",
    "@id": `${buildAbsoluteUrl(baseUrl, currentPath || "/")}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function buildPersonSchemas(baseUrl) {
  return siteContent.leaders.map((leader) => ({
    "@type": "Person",
    "@id": createPersonId(baseUrl, leader.name),
    name: leader.name,
    url: buildAbsoluteUrl(baseUrl, "/leadership"),
    sameAs: [leader.linkedin],
    worksFor: { "@id": `${baseUrl}#organization` }
  }));
}

function buildProfessionalServiceSchema(baseUrl, ogImageUrl) {
  const { phones, email } = siteContent.contact.details;

  return {
    "@type": "ProfessionalService",
    "@id": `${baseUrl}#organization`,
    name: siteContent.brand.name,
    url: baseUrl,
    description: siteContent.meta.description,
    image: ogImageUrl,
    logo: buildAbsoluteUrl(baseUrl, "/logo-arjuna.svg"),
    areaServed: {
      "@type": "Country",
      name: siteContent.seo.serviceArea
    },
    serviceArea: {
      "@type": "Country",
      name: siteContent.seo.serviceArea
    },
    telephone: [
      `+91${phones[0].replaceAll(/\s+/g, "")}`,
      `+91${phones[1].replaceAll(/\s+/g, "")}`
    ],
    email,
    knowsAbout: siteContent.seo.serviceCatalog,
    audience: siteContent.seo.audiences.map((name) => ({
      "@type": "Audience",
      audienceType: name
    })),
    founder: siteContent.leaders.map((leader) => ({
      "@id": createPersonId(baseUrl, leader.name)
    })),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        areaServed: siteContent.seo.serviceArea,
        email
      },
      ...phones.map((phone) => ({
        "@type": "ContactPoint",
        contactType: "sales",
        areaServed: siteContent.seo.serviceArea,
        telephone: `+91${phone.replaceAll(/\s+/g, "")}`
      }))
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Political consulting services",
      itemListElement: siteContent.seo.serviceCatalog.map((name) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name
        }
      }))
    }
  };
}

function buildServiceSchema(currentPath, canonicalUrl, baseUrl) {
  if (currentPath === "/capabilities") {
    return {
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: "Political consulting and campaign strategy in India",
      serviceType: [
        "Political consulting",
        "Campaign strategy",
        "Field operations",
        "Digital outreach",
        "War-room systems"
      ],
      provider: { "@id": `${baseUrl}#organization` },
      areaServed: {
        "@type": "Country",
        name: siteContent.seo.serviceArea
      },
      url: canonicalUrl,
      description:
        "Political consulting services covering campaign strategy, voter intelligence, field operations, digital outreach, and reporting systems for Indian election campaigns."
    };
  }

  if (currentPath === "/surveys") {
    return {
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: "Political survey research and voter intelligence in India",
      serviceType: [
        "Political survey research",
        "CATI surveys",
        "CAPI surveys",
        "Sampling and weighting",
        "Voter intelligence"
      ],
      provider: { "@id": `${baseUrl}#organization` },
      areaServed: {
        "@type": "Country",
        name: siteContent.seo.serviceArea
      },
      url: canonicalUrl,
      description:
        "Political survey research, voter intelligence, CATI, CAPI, sample design, QA, weighting, and reporting for campaign decisions in India."
    };
  }

  return null;
}

function buildFaqSchema(canonicalUrl, faqs = []) {
  if (!faqs.length) {
    return null;
  }

  return {
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

function buildStructuredData(currentPath, page, context) {
  const baseUrl = context.baseUrl;
  const canonicalUrl = buildAbsoluteUrl(baseUrl, getCanonicalPath(currentPath));
  const ogImageUrl = buildAbsoluteUrl(baseUrl, siteContent.seo.ogImagePath);
  const pageSchema = {
    "@type": page.schemaTypes ?? ["WebPage"],
    "@id": `${canonicalUrl}#webpage`,
    name: page.title,
    url: canonicalUrl,
    description: page.description,
    inLanguage: "en-IN",
    isPartOf: { "@id": `${baseUrl}#website` },
    about: { "@id": `${baseUrl}#organization` },
    breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: ogImageUrl
    }
  };

  if (currentPath === "/leadership") {
    pageSchema.mainEntity = siteContent.leaders.map((leader) => ({
      "@id": createPersonId(baseUrl, leader.name)
    }));
  }

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${baseUrl}#website`,
      name: siteContent.brand.name,
      url: baseUrl,
      inLanguage: "en-IN",
      description: siteContent.meta.description,
      publisher: { "@id": `${baseUrl}#organization` }
    },
    buildProfessionalServiceSchema(baseUrl, ogImageUrl),
    ...buildPersonSchemas(baseUrl),
    buildBreadcrumbSchema(currentPath, baseUrl),
    pageSchema
  ];

  const serviceSchema = buildServiceSchema(currentPath, canonicalUrl, baseUrl);
  if (serviceSchema) {
    graph.push(serviceSchema);
  }

  const faqSchema = buildFaqSchema(canonicalUrl, page.faqs);
  if (faqSchema) {
    graph.push(faqSchema);
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph
  });
}

function renderLayout(currentPath, page, context) {
  const canonicalPath = getCanonicalPath(currentPath);
  const canonicalUrl = buildAbsoluteUrl(context.baseUrl, canonicalPath);
  const ogImageUrl = buildAbsoluteUrl(context.baseUrl, siteContent.seo.ogImagePath);
  const robots = context.allowIndexing ? "index, follow" : "noindex, nofollow";
  const structuredData = buildStructuredData(currentPath, page, context);

  return `<!DOCTYPE html>
<html lang="en-IN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <meta name="theme-color" content="#0f1b27" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(siteContent.seo.siteName)}" />
    <meta property="og:locale" content="${escapeHtml(siteContent.seo.siteLocale)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(siteContent.seo.ogImageAlt)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(siteContent.seo.ogImageAlt)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="icon" href="/logo-arjuna.svg" type="image/svg+xml" />
    <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600;6..96,700;6..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="application/ld+json" nonce="${escapeHtml(context.cspNonce ?? "")}">
      ${structuredData}
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
        <p class="eyebrow">Political Consulting In India. Campaign Intelligence. Ground Execution.</p>
        <h1>${escapeHtml(siteContent.brand.tagline)}</h1>
        <p class="page-intro">${escapeHtml(siteContent.brand.narrative)}</p>
        <div class="page-actions">
          <a class="button button-primary" href="/leadership#contact-intake">${escapeHtml(siteContent.brand.primaryCta)}</a>
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
          <h2>Political consulting architecture built for speed and control.</h2>
          <p>
            Arjuna Strategy Consulting combines campaign strategy, political survey research, voter intelligence, and field execution into one operating system for Indian election campaigns.
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
          <p class="eyebrow">Quick Answers</p>
          <h2>What campaigns need to know before they reach out.</h2>
          <p>
            These are the basic questions search engines, AI overviews, and campaign teams ask first when they evaluate a political consulting partner in India.
          </p>
        </div>
        <div class="answer-grid">
          ${renderAnswerCards(siteContent.answerBlocks)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Survey Backbone</p>
          <h2>${escapeHtml(siteContent.surveyOverview.headline)}</h2>
          <p>
            The survey layer powers constituency diagnostics, political survey research, field validation, sentiment measurement, and downstream consulting recommendations.
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
          <h2>Fewer pages, clearer paths.</h2>
          <p>
            The site now routes visitors into home, work, surveys, and founder-led contact so people can move directly from search intent to the right decision surface.
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
            Technology, content, and campaign execution are supported by cross-functional partnerships and campaign environments that matter in India-wide political consulting.
          </p>
        </div>
        <div class="page-stack">
          <div class="card-grid card-grid-three">
            ${renderPartnerships()}
          </div>
          <div class="origin-row reveal">
            ${renderOrigins()}
          </div>
          <aside class="page-panel reveal">
            <p class="eyebrow">Public References</p>
            <h2 class="page-panel-title">Verifiable institutions and campaign ecosystems referenced on the page.</h2>
            <div class="reference-links">
              ${renderReferenceLinks()}
            </div>
          </aside>
        </div>
      </div>
    </section>

    ${renderFaqSection({
      eyebrow: "Home FAQs",
      title: "Clear answers for campaign teams evaluating Arjuna.",
      intro:
        "These FAQs are written for search visibility and fast human review, so the site explains the political consulting model without vague agency language.",
      items: siteContent.faqs.home,
      sectionClass: "section section-soft"
    })}

    <section class="section">
      <div class="cta-band reveal">
        <div>
          <p class="eyebrow">Next Step</p>
          <h2>Move from overview to a campaign-specific conversation.</h2>
          <p>
            Use the leadership and contact page to send a constituency brief, immediate challenge, or scoping request.
          </p>
        </div>
        <a class="button button-primary" href="/leadership#contact-intake">Open Connect</a>
      </div>
    </section>
  `;

  return { title, description, hero, body, faqs: siteContent.faqs.home, schemaTypes: ["WebPage"] };
}

function buildCapabilitiesPage() {
  const title = `Work | Political Consulting and Campaign Strategy in India | ${siteContent.brand.name}`;
  const description =
    "Review Arjuna Strategy Consulting's political consulting services in India across campaign strategy, voter intelligence, field operations, digital outreach, and execution proof.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Work</p>
        <h1>What Arjuna can build,<br />prove, and deliver.</h1>
        <p class="page-intro">
          Political consulting capability and campaign proof now sit on one page so visitors can move from the consulting stack to live execution outcomes without switching context.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="/leadership#contact-intake">Discuss Scope</a>
          <a class="button button-secondary" href="/surveys">Survey Systems</a>
        </div>
      </div>
      <div class="page-stack">
        <div class="signal-grid">
          ${renderProofHighlights()}
        </div>
        <aside class="page-panel reveal">
          <p class="eyebrow">Coverage</p>
          <h2 class="page-panel-title">A consulting stack tied to measurable field proof.</h2>
          <ul class="pill-list">
            ${renderPillList(siteContent.focusAreas)}
          </ul>
        </aside>
      </div>
    </section>
  `;

  const body = `
    <section class="section section-soft">
      <div class="section-stack">
        <div class="page-split">
          <div class="section-heading reveal">
            <p class="eyebrow">Core Expertise</p>
            <h2>Strategy systems designed for political complexity.</h2>
            <p>
              The consulting layer is structured around sharper targeting, stronger decision support, and faster execution loops for campaigns operating in India.
            </p>
          </div>
          <div class="card-grid card-grid-three">
            ${renderCards(siteContent.pillars)}
          </div>
        </div>
        <div class="page-split section-divider">
          <div class="section-heading reveal">
            <p class="eyebrow">Core Strengths</p>
            <h2>Capabilities that strengthen both message and machinery.</h2>
            <p>
              Data systems, voter intelligence, field operations, and digital outreach workflows are aligned to reduce friction inside the campaign.
            </p>
          </div>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.strengths)}
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="track-record">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Capability In Action</p>
          <h2>Proof is built into the delivery story.</h2>
          <p>
            We merged the track record here because political consulting claims only matter when they are anchored to live campaign outcomes, named geographies, and operating scale.
          </p>
          <ul class="summary-list">
            ${renderSummaryList([
              "Winner-led execution in Uttar Pradesh, Uttarakhand, Jharkhand, Jammu & Kashmir, and Haryana",
              "66% strike rate across the 2025 Delhi AC portfolio",
              "Scaled data and outreach systems across 94 ACs in Bihar"
            ])}
          </ul>
        </div>
        <div class="proof-note-grid">
          ${renderCapabilityProofs()}
        </div>
      </div>
    </section>

    <section class="section section-contrast">
      <div class="section-stack">
        <div class="page-split">
          <div class="section-heading reveal">
            <p class="eyebrow">Services</p>
            <h2>Operational support across research, outreach, media, and campaign systems.</h2>
            <p>
              The service mix covers campaign communication, survey systems, field execution, analytics, and campaign technology, with a dedicated survey application sitting underneath the research layer.
            </p>
          </div>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.services)}
          </div>
        </div>
        <div class="page-split section-divider">
          <div class="section-heading reveal">
            <p class="eyebrow">Track Record</p>
            <h2>Execution ranges from targeted AC contests to scale programs.</h2>
            <p>
              The portfolio covers focused fights, multi-seat operations, and statewide systems that demand reporting discipline under pressure across India.
            </p>
          </div>
          <div class="card-grid card-grid-two track-grid-detail">
            ${renderTrackRecord(true)}
          </div>
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="section-stack">
        <div class="page-split">
          <div class="section-heading reveal">
            <p class="eyebrow">Operating Model</p>
            <h2>A repeatable campaign rhythm built for adjustment under pressure.</h2>
            <p>
              Diagnostics, mobilisation, and continuous optimisation keep the campaign aligned from field input to leadership action across campaign strategy, surveys, and field operations.
            </p>
          </div>
          <div class="phase-grid">
            ${renderOperatingModel()}
          </div>
        </div>
        <div class="page-split section-divider">
          <div class="section-heading reveal">
            <p class="eyebrow">Deliverables</p>
            <h2>Outputs designed to move from insight to action.</h2>
            <p>
              Engagements can be modular, but the output always stays tied to execution, measurement, and decision-making.
            </p>
          </div>
          <div class="card-grid card-grid-two">
            ${renderCards(siteContent.deliverables)}
          </div>
        </div>
      </div>
    </section>

    ${renderFaqSection({
      eyebrow: "Work FAQs",
      title: "Common questions about Arjuna's political consulting services.",
      intro:
        "These answers clarify the scope of work so campaign teams can see whether they need strategy only, execution support, or a combined operating model.",
      items: siteContent.faqs.capabilities,
      sectionClass: "section section-contrast"
    })}

    <section class="section">
      <div class="cta-band reveal">
        <div>
          <p class="eyebrow">Next Step</p>
          <h2>Meet the founders and send the brief directly.</h2>
          <p>
            The leadership page now carries the contact flow as well, so the handoff from credibility to conversation is faster.
          </p>
        </div>
        <a class="button button-primary" href="/leadership#contact-intake">Open Connect</a>
      </div>
    </section>
  `;

  return { title, description, hero, body, faqs: siteContent.faqs.capabilities, schemaTypes: ["WebPage"] };
}

function buildSurveysPage() {
  const title = `Surveys | Political Survey Research in India | ${siteContent.brand.name}`;
  const description =
    "Detailed overview of Arjuna Strategy Consulting's political survey research stack in India, including CATI, CAPI, sample-size calculation, voter intelligence controls, and statistical reporting.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Surveys</p>
        <h1>${escapeHtml(siteContent.surveyOverview.headline)}</h1>
        <p class="page-intro">${escapeHtml(siteContent.surveyOverview.summary)}</p>
        <div class="page-actions">
          <a class="button button-primary" href="/leadership#contact-intake">Discuss A Survey Program</a>
          <a class="button button-secondary" href="/capabilities#track-record">Back To Work</a>
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
    <section class="section section-contrast">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Why This Stack</p>
          <h2>What makes the political survey research stack different.</h2>
          <p>
            This system is built for voter intelligence and campaign decisions, not just survey operations in isolation.
          </p>
        </div>
        <div class="card-grid card-grid-three">
          ${renderAnswerCards(siteContent.surveyDifferentiators)}
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">Operational Methods</p>
          <h2>Choose the mode based on speed, depth, supervision, and risk.</h2>
          <p>
            Reliable political survey research is not one-mode by default. We choose CATI, CAPI, CAWI, or hybrid execution based on coverage, respondent behavior, and deadline constraints.
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
            The output is not just a dataset. We deliver the instrument, operations structure, methodology note, reporting layers, and a documented integrity view that can feed campaign strategy directly.
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

    ${renderFaqSection({
      eyebrow: "Survey FAQs",
      title: "Answers for teams comparing political survey research options.",
      intro:
        "These FAQs explain how the survey system supports campaign decisions, methodology control, and voter intelligence quality.",
      items: siteContent.faqs.surveys,
      sectionClass: "section section-soft"
    })}
  `;

  return { title, description, hero, body, faqs: siteContent.faqs.surveys, schemaTypes: ["WebPage"] };
}

function buildLeadershipPage() {
  const title = `Connect | Founder-Led Political Consulting in India | ${siteContent.brand.name}`;
  const description =
    "Meet the Arjuna Strategy Consulting founders, review the operating context, and start a founder-led political consulting conversation for campaigns in India.";

  const hero = `
    <section class="page-hero">
      <div class="page-hero-copy">
        <p class="eyebrow">Connect</p>
        <h1>Meet the founders.<br />Start the conversation.</h1>
        <p class="page-intro">
          Leadership context and contact now live on one page so the move from credibility to conversation is immediate, founder-led, and built for campaign teams in India.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="#contact-intake">Send A Brief</a>
          <a class="button button-secondary" href="/capabilities#track-record">See Work</a>
        </div>
      </div>
      <div class="page-stack">
        <div class="founder-grid">
          ${renderLeaderProfiles("founder-hero-card")}
        </div>
        <aside class="page-panel reveal">
          <p class="eyebrow">Institutional Background</p>
          <h2 class="page-panel-title">Built inside campaign, analytics, and political execution systems.</h2>
          <div class="origin-row">
            ${renderOrigins()}
          </div>
        </aside>
      </div>
    </section>
  `;

  const body = `
    <section class="section section-contrast">
      <div class="section-stack">
        <div class="page-split">
          <div class="section-heading reveal">
            <p class="eyebrow">How Leadership Works</p>
            <h2>Access stays close to the people shaping the campaign architecture.</h2>
            <p>
              The page explains who leads the work and why the first conversation stays tightly connected to campaign realities rather than a generic agency intake.
            </p>
          </div>
          <div class="card-grid card-grid-three">
            ${renderCards(siteContent.leadershipNotes, "note-card")}
          </div>
        </div>
        <div class="page-split section-divider">
          <div class="section-heading reveal">
            <p class="eyebrow">Partnership Context</p>
            <h2>Leadership is supported by external specialist depth where needed.</h2>
            <p>
              AI, media, and technology partners extend execution capacity without diluting strategic control.
            </p>
          </div>
          <div class="page-stack">
            <div class="card-grid card-grid-three">
              ${renderPartnerships()}
            </div>
            <div class="reference-links reveal">
              ${renderReferenceLinks()}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="page-split">
        <div class="section-heading reveal">
          <p class="eyebrow">First Conversation</p>
          <h2>Simple intake, fast founder review, clear next move.</h2>
          <p>
            The redesigned page reduces friction. A visitor can understand the leadership context, see how the first review works, and send the brief without switching pages.
          </p>
        </div>
        <div class="engagement-grid">
          ${renderEngagementSteps()}
        </div>
      </div>
    </section>

    ${renderFaqSection({
      eyebrow: "Connect FAQs",
      title: "What happens after a campaign team sends the brief.",
      intro:
        "This FAQ makes the founder-led intake process explicit so the contact page works for both search and direct outreach.",
      items: siteContent.faqs.leadership,
      sectionClass: "section section-contrast"
    })}

    <section class="section" id="contact-intake">
      <div class="contact-page-grid">
        <aside class="contact-side-panel reveal">
          <p class="eyebrow">Campaign Intake</p>
          <h2 class="page-panel-title">${escapeHtml(siteContent.contact.heading)}</h2>
          <p>${escapeHtml(siteContent.contact.text)}</p>
          <ul class="page-note-list">
            ${renderSummaryList([
              "Constituency, district, or state",
              "Immediate challenge or campaign objective",
              "Expected support window or election timeline"
            ])}
          </ul>
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

  return {
    title,
    description,
    hero,
    body,
    faqs: siteContent.faqs.leadership,
    schemaTypes: ["WebPage", "AboutPage", "ContactPage"]
  };
}

const pageBuilders = {
  "/": buildHomePage,
  "/capabilities": buildCapabilitiesPage,
  "/surveys": buildSurveysPage,
  "/leadership": buildLeadershipPage
};

export function getCanonicalPageMetadata() {
  return Object.keys(pageBuilders).map((pathname) => {
    const page = pageBuilders[pathname]();

    return {
      pathname,
      title: page.title,
      description: page.description
    };
  });
}

export function renderPage(pathname = "/", context = {}) {
  const currentPath = normalizePath(pathname);
  const builder = pageBuilders[currentPath] ?? pageBuilders["/"];
  const page = builder();
  const resolvedContext = {
    baseUrl: context.baseUrl ?? "http://127.0.0.1:3000",
    allowIndexing: context.allowIndexing ?? false,
    cspNonce: context.cspNonce ?? ""
  };

  return renderLayout(currentPath, page, resolvedContext);
}
