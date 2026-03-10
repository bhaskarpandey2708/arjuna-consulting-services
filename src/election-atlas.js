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

function isDeepAtlasRoute(currentPath) {
  return /^\/election-atlas\/[^/]+\/(VS|LS|vs|ls)\/\d{4}(?:\/.*)?$/i.test(String(currentPath ?? ""));
}

export function buildElectionAtlasPage(context = {}) {
  const defaultSelection = getElectionAtlasDefaultSelection();
  const initialSelection = resolveBootstrapSelection(context.currentPath, defaultSelection);
  const bootstrap = getElectionAtlasBootstrap(initialSelection, {
    minimal: true
  });
  const state = getElectionAtlasStateConfig(initialSelection.state);
  const deepRoute = isDeepAtlasRoute(context.currentPath);

  const hero = deepRoute
    ? ""
    : `
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
            A live election intelligence surface for state-level analysis, vote movement, seat pressure, constituency drilldown, and district rollups. The atlas runs inside the Arjuna shell so the product can improve continuously without breaking the main site experience.
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
            <li>Geography versioning and local-only drilldown are built directly into the atlas surface.</li>
          </ul>
          <div class="atlas-hero-meta">
            <span class="atlas-hero-badge">Default view: ${escapeHtml(state.name)}</span>
            <span class="atlas-hero-badge">Mode: Local drilldown with state and district intelligence</span>
          </div>
        </aside>
      </section>
    `;

  const body = deepRoute
    ? `
      <section class="section section-soft atlas-route-shell" id="atlas-app">
        <div class="atlas-app-shell atlas-app-shell-route">
          <div class="atlas-app" data-election-atlas>
            <p class="atlas-loading">Loading Election Atlas...</p>
          </div>
        </div>
        <script id="election-atlas-bootstrap" type="application/json">${serializeForHtml({
          ...bootstrap,
          initialPath: context.currentPath ?? "/election-atlas"
        })}</script>
      </section>
    `
    : `
      <section class="section section-soft" id="atlas-app">
        <div class="section-heading reveal">
          <p class="eyebrow">Election Atlas</p>
          <h2>Election Atlas</h2>
          <p>
            This section stays inside the Arjuna site shell so review, iteration, and release all happen on one product surface without forcing a separate shell.
          </p>
        </div>
        <div class="atlas-app-shell">
          <div class="atlas-app" data-election-atlas>
            <p class="atlas-loading">Loading Election Atlas...</p>
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
            <p class="eyebrow">Build With Arjuna</p>
            <h2>Move from election history to campaign decision support.</h2>
            <p>
              The atlas is designed to expand from state reading into district diagnostics, constituency drilldown, field intelligence, and custom campaign workflows without breaking the product surface.
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
