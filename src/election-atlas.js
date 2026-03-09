import {
  getElectionAtlasBootstrap,
  getElectionAtlasCatalog,
  getElectionAtlasDefaultSelection,
  getElectionAtlasPipeline,
  getElectionAtlasStateConfig,
  getElectionAtlasStagedResults,
  getElectionAtlasSummary,
  getElectionAtlasConstituencyDetail,
  getElectionAtlasDistrictDetail,
  getElectionAtlasDiscrepancies,
  listElectionAtlasDistricts,
  listElectionAtlasConstituencies,
  listElectionAtlasElections,
  listElectionAtlasStates,
  getElectionAtlasStateSummaryMartData,
  getElectionAtlasPartyTrendData,
  prewarmElectionAtlasStore
} from "./election-atlas-store.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export {
  getElectionAtlasCatalog,
  getElectionAtlasSummary,
  getElectionAtlasConstituencyDetail,
  getElectionAtlasDistrictDetail,
  getElectionAtlasDiscrepancies,
  getElectionAtlasPipeline,
  getElectionAtlasPartyTrendData,
  prewarmElectionAtlasStore,
  getElectionAtlasStateSummaryMartData,
  getElectionAtlasStagedResults,
  listElectionAtlasConstituencies,
  listElectionAtlasDistricts,
  listElectionAtlasElections,
  listElectionAtlasStates
};

function resolveBootstrapSelection(currentPath, fallbackSelection) {
  const match = String(currentPath ?? "").match(
    /^\/election-atlas\/([^/]+)\/(VS|LS|vs|ls)\/(\d{4})(?:\/.*)?$/i
  );

  if (!match) {
    return fallbackSelection;
  }

  const [, state, house, year] = match;
  return {
    state: decodeURIComponent(state),
    house: String(house).toUpperCase(),
    year: Number.parseInt(year, 10)
  };
}

export function buildElectionAtlasPage(context = {}) {
  const defaultSelection = getElectionAtlasDefaultSelection();
  const initialSelection = resolveBootstrapSelection(context.currentPath, defaultSelection);
  const bootstrap = getElectionAtlasBootstrap(initialSelection, {
    minimal: true
  });
  const state = getElectionAtlasStateConfig(initialSelection.state);

  const hero = `
    <section class="page-hero page-hero-compact atlas-hero">
      <div class="page-hero-copy page-hero-copy-compact atlas-hero-copy">
        <p class="eyebrow">Election Atlas</p>
        <h1>
          <span class="page-hero-line">Analytics-first</span>
          <span class="page-hero-line">election atlas</span>
          <span class="page-hero-line">for the Arjuna</span>
          <span class="page-hero-line">campaign stack.</span>
        </h1>
        <p class="page-intro">
          A live review surface for state-level election analysis, vote movement, seat pressure, constituency drilldown, and staged district rollups. The atlas now runs inside the Arjuna shell so beta rollout, daily improvements, and deeper normalization can happen without splitting the product too early.
        </p>
        <div class="page-actions">
          <a class="button button-primary" href="#atlas-app">Open Election Atlas</a>
          <a class="button button-secondary" href="/leadership#contact-intake">Request A Custom Build</a>
        </div>
      </div>
      <aside class="atlas-hero-panel reveal">
        <p class="eyebrow">Why This Format</p>
        <h2 class="atlas-hero-panel-title">Designed for campaign review, not just archive browsing.</h2>
        <ul class="atlas-hero-list">
          <li>State-first read with turnout, vote movement, seat pressure, and margin diagnostics.</li>
          <li>Trend-ready model that can absorb district, AC, alliance, and later booth layers.</li>
          <li>Geography versioning, source reconciliation, and local-only drilldown are baked in from the beta itself.</li>
        </ul>
        <div class="atlas-hero-meta">
          <span class="atlas-hero-badge">Default beta slice: ${escapeHtml(state.name)}</span>
          <span class="atlas-hero-badge">Mode: Reconciled staged coverage with local-only drilldown</span>
        </div>
      </aside>
    </section>
  `;

  const body = `
    <section class="section section-soft" id="atlas-app">
      <div class="section-heading reveal">
        <p class="eyebrow">Live Beta</p>
        <h2>Election Atlas beta surface</h2>
        <p>
          This section stays inside the Arjuna site shell so rollout, source refresh, normalization, QA, and daily improvement all happen on one product surface without forcing a separate shell too early.
        </p>
      </div>
      <div class="atlas-app-shell">
        <div class="atlas-app" data-election-atlas>
          <p class="atlas-loading">Loading the live beta election atlas...</p>
        </div>
      </div>
      <script id="election-atlas-bootstrap" type="application/json">${serializeForHtml({
        ...bootstrap,
        initialPath: context.currentPath ?? "/election-atlas"
      })}</script>
    </section>

    <section class="section">
      <div class="cta-band reveal">
        <div>
          <p class="eyebrow">Next Stage</p>
          <h2>National extraction is staged. The next stage is launch hardening, trust signaling, and daily release quality.</h2>
          <p>
            The layout, local routing, constituency detail capture, district marts, mart-backed summaries, and source reconciliation are already live. The remaining work is visible launch status, broader historical enrichment, alliance coverage where sources expose it, and portal hardening without breaking the embedded atlas surface.
          </p>
        </div>
        <div class="page-actions">
          <a class="button button-primary" href="/leadership#contact-intake">Send Remarks</a>
          <a class="button button-secondary" href="/surveys">See Survey Systems</a>
        </div>
      </div>
    </section>
  `;

  return {
    title: "Election Atlas | State Results Intelligence | Arjuna Strategy Consulting",
    description:
      "Election Atlas is Arjuna Strategy Consulting's analytics-first surface for state-level election intelligence, live current-state result coverage, margin diagnostics, and constituency drilldown.",
    hero,
    body,
    faqs: [],
    schemaTypes: ["WebPage"]
  };
}
