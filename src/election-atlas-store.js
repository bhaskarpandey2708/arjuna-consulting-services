import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { electionAtlasSeed } from "../data/election-atlas/bihar.seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stagingDir = path.join(__dirname, "..", "data", "staging", "election-atlas");
const rawIndiaVotesDir = path.join(__dirname, "..", "data", "raw", "indiavotes");
const stagedBootstrapPath = path.join(stagingDir, "bihar-bootstrap.json");
const stagedCatalogPath = path.join(stagingDir, "state-catalog.json");
const stagedResultsDir = path.join(stagingDir, "results");
const stagedDetailsDir = path.join(stagingDir, "details");
const stagedResultsIndexPath = path.join(stagingDir, "results-index.json");
const stagedResultsManifestPath = path.join(stagingDir, "indiavotes-results-manifest.json");
const stagedDetailEnrichmentManifestPath = path.join(
  stagingDir,
  "indiavotes-detail-enrichment-manifest.json"
);
const stagedLokdhabaResultsDir = path.join(stagingDir, "lokdhaba-results");
const stagedLokdhabaResultsIndexPath = path.join(stagingDir, "lokdhaba-results-index.json");
const stagedDistrictMartsDir = path.join(stagingDir, "district-marts");
const stagedDistrictMartsIndexPath = path.join(stagingDir, "district-marts-index.json");
const partyNormalizationPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "party-normalization.json"
);
const partyAliasMapPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "party-alias-map.json"
);
const constituencyNameMapPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "constituency-name-map.json"
);
const candidateAliasMapPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "candidate-alias-map.json"
);
const discrepancyPolicyPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "discrepancy-policy.json"
);
const manualSeatAdjudicationsPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "manual-seat-adjudications.json"
);
const allianceMappingPath = path.join(
  __dirname,
  "..",
  "config",
  "election-atlas",
  "alliance-mapping.json"
);
const stagedDiscrepancyReportPath = path.join(stagingDir, "discrepancy-report.json");
const stagedManualReviewQueuePath = path.join(stagingDir, "manual-review-queue.json");
const stagedStateSummaryMartsPath = path.join(stagingDir, "state-summary-marts.json");
const stagedPartyTrendMartsPath = path.join(stagingDir, "party-trend-marts.json");
const stagedConstituencyDetailIndexPath = path.join(stagingDir, "constituency-detail-index.json");

const {
  coverageNote,
  defaultSelection,
  factConstituencySummary,
  factPartyStateTrend,
  factStateElectionSummary,
  geographyVersions,
  houseLabels,
  meta,
  partyPalette,
  states
} = electionAtlasSeed;

const defaultPipeline = {
  stage: "seed-only",
  stageLabel: "Seed surface only",
  generatedAt: null,
  lastCaptureAt: null,
  sourceLabel: "Illustrative Bihar seed for interface development",
  coverageNote,
  summary:
    "The atlas remains seed-backed until the first real-source bootstrap is captured and normalized.",
  nextStep:
    "Run the Bihar discovery extractors, normalize the raw payloads into staging, then begin constituency-level ingestion.",
  sources: [
    {
      key: "indiavotes",
      name: "IndiaVotes",
      statusLabel: "Pending",
      tone: "pending",
      detail: "No raw Bihar bootstrap capture has been normalized yet."
    },
    {
      key: "lokdhaba",
      name: "LokDhaba",
      statusLabel: "Pending",
      tone: "pending",
      detail: "No endpoint inventory or Bihar probe has been normalized yet."
    }
  ],
  stats: {
    discoveredAssemblyYears: [],
    normalizedDistrictCount: 0,
    lokdhabaProbeStatus: null
  }
};

const defaultCatalog = {
  generatedAt: null,
  source: "indiavotes",
  sourceCaptureDirectory: null,
  sourceCapturedAt: null,
  normalizationVersion: null,
  stats: {
    lokSabhaStateVersions: 0,
    assemblyStateVersions: 0,
    stateSummaryVersions: 0,
    canonicalStates: 0,
    currentCanonicalStates: 0,
    historicCanonicalEntities: 0,
    assemblyVersionsWithYearInventory: 0,
    versionsWithDistrictInventory: 0
  },
  globalElectionYears: {
    lokSabha: [],
    assembly: []
  },
  canonicalStates: [],
  stateVersions: []
};

const defaultResultsIndex = {
  generatedAt: null,
  source: "indiavotes",
  stats: {
    slices: 0,
    inventoryStates: 0,
    uniqueCanonicalStates: 0,
    ambiguousCanonicalStates: []
  },
  inventoryStates: [],
  slices: []
};

const defaultLokdhabaResultsIndex = {
  generatedAt: null,
  source: "lokdhaba",
  sourceCaptureDirectory: null,
  stats: {
    states: 0,
    slices: 0,
    lokSabhaSlices: 0,
    vidhanSabhaSlices: 0,
    constituencyRows: 0
  },
  inventoryStates: [],
  slices: []
};

const defaultPartyNormalization = {
  version: 1,
  aliases: {},
  display: {}
};

const defaultPartyAliasMap = {
  version: 1,
  aliases: {}
};

const defaultConstituencyNameMap = {
  version: 1,
  entries: []
};

const defaultCandidateAliasMap = {
  version: 1,
  entries: []
};

const defaultAllianceMapping = {
  version: 1,
  slices: []
};

const defaultManualSeatAdjudications = {
  version: 1,
  entries: []
};

const alliancePalette = {
  NDA: "#c47451",
  INDIA: "#95b9c7",
  UPA: "#95b9c7",
  MGB: "#4f7f6a",
  MVA: "#7f96b7",
  MAHAYUTI: "#c47451",
  "SP+": "#6f915f",
  OTHERS: "#8aa4bf",
  OTHERS_PARTIES: "#8aa4bf"
};

const defaultDistrictMartsIndex = {
  generatedAt: null,
  source: "lokdhaba",
  sourceCaptureDirectory: null,
  stats: {
    states: 0,
    slices: 0,
    districtRows: 0,
    constituencyRows: 0
  },
  inventoryStates: [],
  slices: []
};

const defaultDiscrepancyReport = {
  generatedAt: null,
  thresholds: {
    turnoutInfo: 2,
    turnoutActionable: 5,
    turnoutElectorateBaseVotesPctMax: 3,
    turnoutElectorateBaseElectorsPctMin: 5,
    voteShareInfo: 1,
    voteShareActionable: 2,
    voteShareWinnerVotesPctMax: 1,
    voteShareTotalVotesPctMin: 2
  },
  notes: {},
  stats: {
    overlappingSlices: 0,
    comparedSeats: 0,
    cleanSlices: 0,
    discrepancySlices: 0,
    counts: {}
  },
  slices: []
};

const defaultStateSummaryMarts = {
  generatedAt: null,
  stats: {
    slices: 0
  },
  slices: []
};

const defaultManualReviewQueue = {
  generatedAt: null,
  sourceReportGeneratedAt: null,
  stats: {
    hardConflicts: 0,
    winnerMismatch: 0,
    turnoutMismatch: 0,
    voteShareMismatch: 0
  },
  queue: []
};

const defaultPartyTrendMarts = {
  generatedAt: null,
  stats: {
    groups: 0
  },
  groups: []
};

const defaultConstituencyDetailIndex = {
  generatedAt: null,
  stats: {
    slices: 0,
    seats: 0,
    seatsWithDetail: 0
  },
  slices: []
};

let rawConstituencyDetailFileNamesCache = null;
let stagedConstituencyDetailFileNamesCache = null;
const jsonFileCache = new Map();
let constituencyAliasIndexCache = null;
let candidateAliasIndexCache = null;
let stateSummaryMartLookupCache = null;
let partyTrendMartLookupCache = null;
let detailIndexSliceLookupCache = null;
let detailIndexSeatLookupCache = null;

function readJsonFile(filePath, options = {}) {
  const useCache = options.cache !== false;

  if (!existsSync(filePath)) {
    jsonFileCache.delete(filePath);
    return null;
  }

  try {
    if (useCache) {
      const mtimeMs = statSync(filePath).mtimeMs;
      const cached = jsonFileCache.get(filePath);

      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.value;
      }

      const value = JSON.parse(readFileSync(filePath, "utf8"));
      jsonFileCache.set(filePath, { mtimeMs, value });
      return value;
    }

    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    jsonFileCache.delete(filePath);
    return null;
  }
}

const partyNormalization = readJsonFile(partyNormalizationPath) ?? defaultPartyNormalization;
const partyAliasMap = readJsonFile(partyAliasMapPath) ?? {
  ...defaultPartyAliasMap,
  aliases: partyNormalization.aliases ?? {}
};
const constituencyNameMap = readJsonFile(constituencyNameMapPath) ?? defaultConstituencyNameMap;
const candidateAliasMap = readJsonFile(candidateAliasMapPath) ?? defaultCandidateAliasMap;
const discrepancyPolicy = readJsonFile(discrepancyPolicyPath) ?? {
  thresholds: defaultDiscrepancyReport.thresholds,
  notes: {}
};
const manualSeatAdjudications =
  readJsonFile(manualSeatAdjudicationsPath) ?? defaultManualSeatAdjudications;
const allianceMapping = readJsonFile(allianceMappingPath) ?? defaultAllianceMapping;

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function clampMetric(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function buildFragmentationPressureScore({
  marginPct = null,
  winnerVoteShare = null,
  enop = null,
  lowPlurality = null,
  ultraClose = null,
  highFragmentation = null,
  lowPluralitySeatShare = null,
  ultraCloseSeatShare = null,
  highFragmentationSeatShare = null
} = {}) {
  const seatMode =
    Number.isFinite(marginPct) || Number.isFinite(winnerVoteShare) || Number.isFinite(enop);

  if (seatMode) {
    const marginComponent = Number.isFinite(marginPct)
      ? clampMetric((8 - marginPct) / 8, 0, 1) * 40
      : ultraClose
        ? 40
        : 0;
    const pluralityComponent = Number.isFinite(winnerVoteShare)
      ? clampMetric((45 - winnerVoteShare) / 15, 0, 1) * 30
      : lowPlurality
        ? 30
        : 0;
    const enopComponent = Number.isFinite(enop)
      ? clampMetric((enop - 2) / 3, 0, 1) * 30
      : highFragmentation
        ? 30
        : 0;

    return toFixedNumber(marginComponent + pluralityComponent + enopComponent, 0);
  }

  const districtComponent =
    (Number.isFinite(lowPluralitySeatShare) ? lowPluralitySeatShare * 0.35 : 0) +
    (Number.isFinite(ultraCloseSeatShare) ? ultraCloseSeatShare * 0.35 : 0) +
    (Number.isFinite(highFragmentationSeatShare) ? highFragmentationSeatShare * 0.3 : 0);

  if (!Number.isFinite(districtComponent)) {
    return null;
  }

  return toFixedNumber(districtComponent, 0);
}

function buildConstituencyMetricBundle(row = {}, selection = null) {
  const winnerVoteShare = Number.isFinite(row.winnerVoteShare) ? row.winnerVoteShare : null;
  const runnerUpVoteShare = Number.isFinite(row.runnerUpVoteShare) ? row.runnerUpVoteShare : null;
  const voteGapVotes =
    Number.isFinite(row.winnerVotes) && Number.isFinite(row.runnerUpVotes)
      ? row.winnerVotes - row.runnerUpVotes
      : Number.isFinite(row.marginVotes)
        ? row.marginVotes
        : null;
  const voteGapPct =
    winnerVoteShare !== null && runnerUpVoteShare !== null
      ? toFixedNumber(winnerVoteShare - runnerUpVoteShare, 1)
      : Number.isFinite(row.marginPct)
        ? row.marginPct
        : null;
  const enop = Number.isFinite(row.enop) ? row.enop : null;
  const stateMart = selection ? getStateSummaryMart(selection) : null;
  const stateTurnoutMedian = stateMart?.advancedMetrics?.custom?.turnoutMedian ?? null;
  const turnoutDeviationPct =
    Number.isFinite(row.turnoutPct) && Number.isFinite(stateTurnoutMedian)
      ? toFixedNumber(row.turnoutPct - stateTurnoutMedian, 1)
      : null;
  const lowPlurality = winnerVoteShare !== null ? winnerVoteShare < 40 : null;
  const majorityWinner = winnerVoteShare !== null ? winnerVoteShare >= 50 : null;
  const ultraClose = Number.isFinite(row.marginPct) ? row.marginPct < 2 : null;
  const highFragmentation = enop !== null ? enop >= 5 : null;
  const fragmentationPressureScore = buildFragmentationPressureScore({
    marginPct: row.marginPct,
    winnerVoteShare,
    enop,
    lowPlurality,
    ultraClose,
    highFragmentation
  });

  return {
    sourceNative: {
      totalElectors: Number.isFinite(row.totalElectors) ? row.totalElectors : null,
      totalVotes: Number.isFinite(row.totalVotes) ? row.totalVotes : null,
      turnoutPct: Number.isFinite(row.turnoutPct) ? row.turnoutPct : null,
      marginVotes: Number.isFinite(row.marginVotes) ? row.marginVotes : null,
      marginPct: Number.isFinite(row.marginPct) ? row.marginPct : null,
      winnerVoteShare,
      runnerUpVoteShare,
      enop,
      reservationType: row.reservationType ?? null
    },
    custom: {
      voteGapVotes,
      voteGapPct,
      lowPlurality,
      majorityWinner,
      ultraClose,
      highFragmentation,
      turnoutDeviationPct,
      fragmentationPressureScore
    }
  };
}

function buildDistrictMetricBundle(district = {}, selection = null) {
  const advancedMetrics = district.advancedMetrics ?? null;
  const advancedSource = advancedMetrics?.sourceNative ?? {};
  const advancedCustom = advancedMetrics?.custom ?? {};
  const stateMart = selection ? getStateSummaryMart(selection) : null;
  const stateTurnoutMedian = stateMart?.advancedMetrics?.custom?.turnoutMedian ?? null;
  const turnoutDeviationPct =
    Number.isFinite(district.turnoutPct) && Number.isFinite(stateTurnoutMedian)
      ? toFixedNumber(district.turnoutPct - stateTurnoutMedian, 1)
      : null;
  const fragmentationPressureScore = buildFragmentationPressureScore({
    lowPluralitySeatShare: advancedCustom.lowPluralitySeatShare,
    ultraCloseSeatShare: advancedCustom.ultraCloseSeatShare,
    highFragmentationSeatShare: advancedSource.highFragmentationSeatShare
  });

  return {
    overview: {
      totalSeats: Number.isFinite(district.totalSeats) ? district.totalSeats : null,
      totalElectors: Number.isFinite(district.totalElectors) ? district.totalElectors : null,
      totalVotes: Number.isFinite(district.totalVotes) ? district.totalVotes : null,
      turnoutPct: Number.isFinite(district.turnoutPct) ? district.turnoutPct : null,
      winnerSeats: Number.isFinite(district.winnerSeats) ? district.winnerSeats : null,
      winnerSeatShare: Number.isFinite(district.winnerSeatShare) ? district.winnerSeatShare : null,
      winnerVoteShare: Number.isFinite(district.winnerVoteShare) ? district.winnerVoteShare : null,
      closeContests: Number.isFinite(district.closeContests) ? district.closeContests : null,
      meanMarginPct: Number.isFinite(district.meanMarginPct) ? district.meanMarginPct : null,
      medianMarginPct: Number.isFinite(district.medianMarginPct) ? district.medianMarginPct : null
    },
    advanced: advancedMetrics,
    custom: {
      turnoutDeviationPct,
      fragmentationPressureScore
    }
  };
}

function normalizeAtlasColor(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (/^#[0-9a-f]{3}([0-9a-f]{3}){0,1}$/i.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return `#${normalized}`;
  }

  if (/^(rgb|rgba|hsl|hsla)\(/i.test(normalized)) {
    return normalized;
  }

  if (/^[a-z]+$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function slugifyText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactAtlasText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function looksUppercase(value) {
  const letters = String(value ?? "").replace(/[^A-Za-z]/g, "");

  if (!letters) {
    return false;
  }

  return letters === letters.toUpperCase();
}

function prettifyAtlasLabel(value) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (!looksUppercase(normalized)) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, "the");
}

function buildSelectionSeatKey(selection, seatNumber) {
  return `${selection.state}::${selection.house}::${selection.year}::${seatNumber}`;
}

function buildSelectionKey(selection) {
  return `${selection.state}::${selection.house}::${selection.year}`;
}

function getConstituencyAliasIndexes() {
  if (constituencyAliasIndexCache) {
    return constituencyAliasIndexCache;
  }

  const bySeatKey = new Map();
  const byAliasKey = new Map();

  (constituencyNameMap.entries ?? []).forEach((entry) => {
    const selection = {
      state: entry.selectionKey ?? entry.state,
      house: entry.house,
      year: entry.year
    };
    const selectionKey = buildSelectionKey(selection);

    if (Number.isFinite(entry.constituencyNumber)) {
      bySeatKey.set(buildSelectionSeatKey(selection, entry.constituencyNumber), entry);
    }

    (entry.aliases ?? []).forEach((alias) => {
      byAliasKey.set(`${selectionKey}::${compactAtlasText(alias.name)}`, entry);
    });
  });

  constituencyAliasIndexCache = { bySeatKey, byAliasKey };
  return constituencyAliasIndexCache;
}

function getCandidateAliasIndex() {
  if (candidateAliasIndexCache) {
    return candidateAliasIndexCache;
  }

  const bySelectionSeat = new Map();

  (candidateAliasMap.entries ?? []).forEach((entry) => {
    const key = buildSelectionSeatKey(
      {
        state: entry.selectionKey,
        house: entry.house,
        year: entry.year
      },
      entry.constituencyNumber
    );

    if (!bySelectionSeat.has(key)) {
      bySelectionSeat.set(key, []);
    }

    bySelectionSeat.get(key).push(entry);
  });

  candidateAliasIndexCache = bySelectionSeat;
  return candidateAliasIndexCache;
}

function findConstituencyAliasEntry(selection, row = {}) {
  const seatNumber = Number.parseInt(
    String(row.constituencyNumber ?? row.seat ?? ""),
    10
  );
  const indexes = getConstituencyAliasIndexes();

  if (Number.isFinite(seatNumber)) {
    return indexes.bySeatKey.get(buildSelectionSeatKey(selection, seatNumber)) ?? null;
  }

  const aliasKey = compactAtlasText(row.constituency ?? row.slug ?? "");
  return indexes.byAliasKey.get(`${buildSelectionKey(selection)}::${aliasKey}`) ?? null;
}

function getCanonicalConstituencyLabel(selection, row = {}) {
  const entry = findConstituencyAliasEntry(selection, row);
  return entry?.canonicalName ?? prettifyAtlasLabel(row.constituency ?? row.slug ?? "");
}

function getCanonicalConstituencySlug(selection, row = {}) {
  const entry = findConstituencyAliasEntry(selection, row);
  return entry?.canonicalSlug ?? slugifyText(getCanonicalConstituencyLabel(selection, row));
}

function areCandidateNamesCompatible(left, right) {
  const leftCompact = compactAtlasText(left);
  const rightCompact = compactAtlasText(right);

  if (!leftCompact || !rightCompact) {
    return false;
  }

  if (leftCompact === rightCompact) {
    return true;
  }

  const leftTokens = prettifyAtlasLabel(left).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const rightTokens = prettifyAtlasLabel(right).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const overlap = leftTokens.filter((token) => rightTokens.includes(token));

  if (overlap.length === 0) {
    return false;
  }

  return overlap.length / Math.min(leftTokens.length, rightTokens.length) >= 0.5;
}

function normalizeCandidateLabel(selection, row = {}, candidate) {
  const normalizedCandidate = prettifyAtlasLabel(candidate);

  if (!normalizedCandidate) {
    return "";
  }

  const seatNumber = Number.parseInt(
    String(row.constituencyNumber ?? row.seat ?? ""),
    10
  );

  const candidates = Number.isFinite(seatNumber)
    ? getCandidateAliasIndex().get(buildSelectionSeatKey(selection, seatNumber)) ?? []
    : [];
  const match = candidates.find((entry) =>
    entry.aliases?.some((alias) => areCandidateNamesCompatible(alias.name, normalizedCandidate))
  );

  return match?.canonicalName ?? normalizedCandidate;
}

function getElectionAtlasResultsIndex() {
  return readJsonFile(stagedResultsIndexPath) ?? defaultResultsIndex;
}

function getElectionAtlasResultsManifest() {
  return readJsonFile(stagedResultsManifestPath) ?? null;
}

function getElectionAtlasDetailEnrichmentManifest() {
  return readJsonFile(stagedDetailEnrichmentManifestPath) ?? null;
}

function getElectionAtlasDetailCoverageStats() {
  try {
    const files = readdirSync(stagedResultsDir).filter((fileName) => fileName.endsWith(".json"));

    return files.reduce((stats, fileName) => {
      const payload = readJsonFile(path.join(stagedResultsDir, fileName));
      const coverage = payload?.detailEnrichment?.coverage;

      if (!coverage) {
        return stats;
      }

      stats.filesWithDetail += 1;

      if ((coverage.rowsWithVoteShare ?? 0) > 0) {
        stats.filesWithVoteShare += 1;
      }

      if ((coverage.failedRows ?? 0) > 0 || (coverage.rowsPending ?? 0) > 0) {
        stats.partialFiles += 1;
      }

      stats.rowsWithVoteShare += coverage.rowsWithVoteShare ?? 0;
      stats.failedRows += coverage.failedRows ?? 0;
      return stats;
    }, {
      filesWithDetail: 0,
      filesWithVoteShare: 0,
      partialFiles: 0,
      rowsWithVoteShare: 0,
      failedRows: 0
    });
  } catch {
    const manifest = getElectionAtlasDetailEnrichmentManifest();

    return {
      filesWithDetail: manifest?.stats?.completedFiles ?? 0,
      filesWithVoteShare: manifest?.stats?.completedFiles ?? 0,
      partialFiles: manifest?.stats?.partialFiles ?? 0,
      rowsWithVoteShare: manifest?.stats?.rowsWithVoteShare ?? 0,
      failedRows: manifest?.stats?.failedRows ?? 0
    };
  }
}

function getLokDhabaResultsIndex() {
  return readJsonFile(stagedLokdhabaResultsIndexPath) ?? defaultLokdhabaResultsIndex;
}

function getDistrictMartsIndex() {
  return readJsonFile(stagedDistrictMartsIndexPath) ?? defaultDistrictMartsIndex;
}

function getElectionAtlasDiscrepancyReport() {
  const report = readJsonFile(stagedDiscrepancyReportPath) ?? defaultDiscrepancyReport;

  return {
    ...defaultDiscrepancyReport,
    ...report,
    thresholds: report.thresholds ?? discrepancyPolicy.thresholds ?? defaultDiscrepancyReport.thresholds,
    notes: report.notes ?? discrepancyPolicy.notes ?? {}
  };
}

function getElectionAtlasStateSummaryMarts() {
  return readJsonFile(stagedStateSummaryMartsPath) ?? defaultStateSummaryMarts;
}

function getElectionAtlasManualReviewQueue() {
  return readJsonFile(stagedManualReviewQueuePath) ?? defaultManualReviewQueue;
}

function getElectionAtlasPartyTrendMarts() {
  return readJsonFile(stagedPartyTrendMartsPath) ?? defaultPartyTrendMarts;
}

function getElectionAtlasConstituencyDetailIndex() {
  return readJsonFile(stagedConstituencyDetailIndexPath) ?? defaultConstituencyDetailIndex;
}

function hasRealCoverage() {
  return getElectionAtlasResultsIndex().inventoryStates.length > 0;
}

function hasLokDhabaCoverage() {
  return getLokDhabaResultsIndex().inventoryStates.length > 0;
}

function hasSourceCoverage() {
  return hasRealCoverage() || hasLokDhabaCoverage();
}

function getStateSummaryMart(selection) {
  const marts = getElectionAtlasStateSummaryMarts();

  if (!stateSummaryMartLookupCache || stateSummaryMartLookupCache.source !== marts) {
    stateSummaryMartLookupCache = {
      source: marts,
      map: new Map(
        (marts.slices ?? []).map((slice) => [
          buildSelectionKey({
            state: slice.selectionKey,
            house: slice.house,
            year: slice.year
          }),
          slice
        ])
      )
    };
  }

  return stateSummaryMartLookupCache.map.get(buildSelectionKey(selection)) ?? null;
}

function getPartyTrendMart(selection) {
  const trendMarts = getElectionAtlasPartyTrendMarts();

  if (!partyTrendMartLookupCache || partyTrendMartLookupCache.source !== trendMarts) {
    partyTrendMartLookupCache = {
      source: trendMarts,
      map: new Map(
        (trendMarts.groups ?? []).map((group) => [`${group.state}::${group.house}`, group])
      )
    };
  }

  return partyTrendMartLookupCache.map.get(`${selection.state}::${selection.house}`) ?? null;
}

function getDetailIndexSlice(selection) {
  const detailIndex = getElectionAtlasConstituencyDetailIndex();

  if (!detailIndexSliceLookupCache || detailIndexSliceLookupCache.source !== detailIndex) {
    detailIndexSliceLookupCache = {
      source: detailIndex,
      map: new Map(
        (detailIndex.slices ?? []).map((slice) => [
          buildSelectionKey({
            state: slice.selectionKey,
            house: slice.house,
            year: slice.year
          }),
          slice
        ])
      )
    };
    detailIndexSeatLookupCache = new WeakMap();
  }

  return detailIndexSliceLookupCache.map.get(buildSelectionKey(selection)) ?? null;
}

function getDetailIndexSeat(selection, row = {}) {
  const seatNumber = Number.parseInt(
    String(row.constituencyNumber ?? row.seat ?? ""),
    10
  );
  const detailSlice = getDetailIndexSlice(selection);

  if (!detailSlice) {
    return null;
  }

  let seatLookup = detailIndexSeatLookupCache?.get(detailSlice);

  if (!seatLookup) {
    const byNumber = new Map();
    const bySlug = new Map();

    (detailSlice.seats ?? []).forEach((seat) => {
      if (Number.isFinite(seat.constituencyNumber)) {
        byNumber.set(seat.constituencyNumber, seat);
      }

      if (seat.constituencySlug) {
        bySlug.set(seat.constituencySlug, seat);
      }
    });

    seatLookup = { byNumber, bySlug };
    detailIndexSeatLookupCache?.set(detailSlice, seatLookup);
  }

  if (Number.isFinite(seatNumber)) {
    return seatLookup.byNumber.get(seatNumber) ?? null;
  }

  return seatLookup.bySlug.get(getCanonicalConstituencySlug(selection, row)) ?? null;
}

function getSelectionFreshness(selection) {
  const mart = getStateSummaryMart(selection);

  if (mart?.freshness) {
    return mart.freshness;
  }

  const slice = findRealSlice(selection);

  if (!slice) {
    return {
      availableSources: ["seed"],
      primaryGeneratedAt: null,
      secondaryGeneratedAt: null,
      martGeneratedAt: null
    };
  }

  return {
    availableSources: [slice.source],
    primaryGeneratedAt: slice.generatedAt ?? null,
    secondaryGeneratedAt: null,
    martGeneratedAt: null
  };
}

function getSelectionDiscrepancySlice(selection) {
  return (
    getElectionAtlasDiscrepancyReport().slices.find(
      (slice) =>
        slice.selection?.state === selection.state &&
        slice.selection?.house === selection.house &&
        slice.selection?.year === selection.year
    ) ?? null
  );
}

function sumDiscrepancyCounts(counts = {}, keys = []) {
  return keys.reduce((total, key) => total + (Number.isFinite(counts[key]) ? counts[key] : 0), 0);
}

function buildSelectionQuality(selection, sourceSlice = null, pipeline = defaultPipeline) {
  const freshness = sourceSlice?.freshness ?? getSelectionFreshness(selection);
  const discrepancySlice = sourceSlice ? getSelectionDiscrepancySlice(selection) : null;
  const counts = discrepancySlice?.counts ?? {};
  const hardConflictCount = sumDiscrepancyCounts(counts, [
    "winnerMismatch",
    "turnoutMismatch",
    "voteShareMismatch",
    "unmatchedSeat"
  ]);
  const coverageGapCount = sumDiscrepancyCounts(counts, ["sourceCoverageGap", "missingDetail"]);
  const varianceCount = sumDiscrepancyCounts(counts, [
    "winnerLabelVariation",
    "turnoutVariance",
    "turnoutElectorateBaseVariance",
    "voteShareVariance",
    "voteShareDenominatorVariance"
  ]);
  const detailIndexSlice = sourceSlice ? getDetailIndexSlice(selection) : null;
  const detailSeats = detailIndexSlice?.seatsWithDetail ?? 0;
  const detailTotalSeats = detailIndexSlice?.rowCount ?? sourceSlice?.rowCount ?? 0;
  const detailComplete = detailTotalSeats > 0 && detailSeats >= detailTotalSeats;
  const districtMart = selection.house === "VS" ? getElectionAtlasDistrictMart(selection) : null;
  const districtLive = Boolean(districtMart?.available && districtMart?.rowCount > 0);
  const updatedAt =
    freshness.martGeneratedAt ??
    freshness.primaryGeneratedAt ??
    freshness.secondaryGeneratedAt ??
    null;
  const primarySourceLabel =
    sourceSlice?.source === "lokdhaba"
      ? "Primary dataset"
      : sourceSlice?.source === "indiavotes"
        ? "Supplementary dataset"
        : "Reference dataset";
  const martBacked = Boolean(getStateSummaryMart(selection));
  let tone = "pending";
  let statusLabel = "Reference view";
  let note =
    pipeline.sourceLabel ??
    "This selection is available as a reference view while the full cycle expands.";

  if (sourceSlice) {
    if (hardConflictCount > 0) {
      tone = "warning";
      statusLabel = "Under review";
      note = `This selection still has ${hardConflictCount} data issue${hardConflictCount === 1 ? "" : "s"} under review.`;
    } else if (coverageGapCount > 0) {
      tone = "warning";
      statusLabel = "Coverage gap";
      note = `This selection still has ${coverageGapCount} data gap${coverageGapCount === 1 ? "" : "s"} being filled.`;
    } else if (discrepancySlice) {
      tone = "ready";
      statusLabel = "Ready";
      note =
        varianceCount > 0
          ? "This selection is available with no blocking data conflicts."
          : "This selection is available with complete internal coverage checks.";
    } else {
      tone = "ready";
      statusLabel = "Ready";
      note = "This selection is available with local drilldown and internal coverage support.";
    }
  }

  const chips = [
    {
      label: "Election Atlas",
      tone: "pending"
    },
    {
      label: primarySourceLabel,
      tone: sourceSlice ? "ready" : "pending"
    },
    {
      label: sourceSlice ? (martBacked ? "Analytics ready" : "Live") : "Reference",
      tone: sourceSlice ? "ready" : "pending"
    }
  ];

  if (sourceSlice) {
    chips.push({
      label:
        hardConflictCount > 0
          ? `Review ${hardConflictCount}`
          : coverageGapCount > 0
            ? `Coverage gap ${coverageGapCount}`
          : discrepancySlice
            ? varianceCount > 0
              ? `Variance ${varianceCount}`
              : "Checked"
            : "Live",
      tone: hardConflictCount > 0 || coverageGapCount > 0 ? "warning" : "ready"
    });

    if (detailTotalSeats > 0) {
      chips.push({
        label: detailComplete ? `Detail ${detailSeats}/${detailTotalSeats}` : `Detail ${detailSeats}/${detailTotalSeats}`,
        tone: detailComplete ? "ready" : "warning"
      });
    }

    if (selection.house === "VS") {
      chips.push({
        label: districtLive ? "District live" : "District pending",
        tone: districtLive ? "ready" : "pending"
      });
    }

    if (sourceSlice.sourceAllianceSummary?.available) {
      chips.push({
        label: "Alliance view",
        tone: "ready"
      });
    }
  } else {
    chips.push({
      label: "Selection pending",
      tone: "pending"
    });
  }

  return {
    tone,
    statusLabel,
    note,
    primarySourceLabel,
    martBacked,
    updatedAt,
    availableSources: freshness.availableSources ?? [],
    hardConflictCount,
    coverageGapCount,
    varianceCount,
    manualAdjudications: Number.isFinite(counts.manualAdjudication) ? counts.manualAdjudication : 0,
    detailSeats,
    detailTotalSeats,
    detailComplete,
    districtLive,
    chips
  };
}

function getSelectionPartyAliasOverrides(selection) {
  if (!selection) {
    return {};
  }

  return (partyNormalization.selectionOverrides ?? []).reduce((merged, override) => {
    const matchesSelection =
      (!override.selectionKey || override.selectionKey === selection.selectionKey || override.selectionKey === selection.state) &&
      (!override.house || override.house === selection.house) &&
      (!override.year || Number(override.year) === Number(selection.year));

    if (matchesSelection) {
      Object.assign(merged, override.aliases ?? {});
    }

    return merged;
  }, {});
}

function normalizePartyLabel(party, selection = null) {
  const normalized = String(party ?? "").trim();

  if (!normalized) {
    return "Unknown";
  }

  const selectionAliases = getSelectionPartyAliasOverrides(selection);
  return selectionAliases[normalized] ?? partyAliasMap.aliases?.[normalized] ?? partyNormalization.aliases[normalized] ?? normalized;
}

function getSliceSelectionContext(slice) {
  if (!slice) {
    return null;
  }

  return {
    state: slice.selectionKey ?? slice.state ?? null,
    selectionKey: slice.selectionKey ?? slice.state ?? null,
    house: slice.house ?? null,
    year: slice.year ?? null
  };
}

function getPartyColor(party, selection = null) {
  const normalizedParty = normalizePartyLabel(party, selection);

  return (
    partyNormalization.display?.[normalizedParty]?.color ??
    partyPalette[normalizedParty] ??
    partyPalette[party] ??
    "#8aa4bf"
  );
}

function getAllianceSliceConfig(selection) {
  return (
    allianceMapping.slices.find(
      (slice) =>
        slice.state === selection.state &&
        slice.house === selection.house &&
        slice.year === selection.year
    ) ?? null
  );
}

function getConfiguredAllianceColor(selection, label) {
  const configuredRow = getAllianceSliceConfig(selection)?.alliances?.find(
    (alliance) => String(alliance.label ?? "").trim().toLowerCase() === String(label ?? "").trim().toLowerCase()
  );

  return configuredRow?.color ?? null;
}

function getAllianceColor(selection, label) {
  const normalized = String(label ?? "").trim();
  const configuredColor = getConfiguredAllianceColor(selection, normalized);

  if (configuredColor) {
    return configuredColor;
  }

  return alliancePalette[normalized.toUpperCase()] ?? "#8aa4bf";
}

function buildSourceAllianceSummary(selection, sourceAllianceSummary, totalSeats = null) {
  if (!sourceAllianceSummary?.available || !Array.isArray(sourceAllianceSummary.rows)) {
    return null;
  }

  const rows = sourceAllianceSummary.rows
    .filter((row) => row.label)
    .map((row) => ({
      id: row.id ?? slugifyText(row.label),
      label: row.label,
      color: normalizeAtlasColor(row.color) ?? getAllianceColor(selection, row.label),
      seats: Number.isFinite(row.seats) ? row.seats : 0,
      seatShare:
        Number.isFinite(row.seatShare)
          ? row.seatShare
          : Number.isFinite(totalSeats) && totalSeats > 0 && Number.isFinite(row.seats)
            ? toFixedNumber((row.seats / totalSeats) * 100, 1)
            : null,
      voteShare: Number.isFinite(row.voteShare) ? row.voteShare : null,
      contestedVoteShare: Number.isFinite(row.contestedVoteShare) ? row.contestedVoteShare : null,
      parties: row.parties ?? [],
      standalone: Boolean(row.standalone)
    }))
    .sort(
      (left, right) =>
        right.seats - left.seats ||
        (right.voteShare ?? -1) - (left.voteShare ?? -1) ||
        left.label.localeCompare(right.label)
    );

  if (rows.length === 0) {
    return null;
  }

  const leader = rows[0] ?? null;
  const challenger = rows[1] ?? null;
  const leadGap = leader && challenger ? leader.seats - challenger.seats : leader?.seats ?? 0;

  return {
    available: true,
    configured: false,
    source: sourceAllianceSummary.source ?? "indiavotes",
    leader,
    challenger,
    leadGap,
    note: "Coalition performance is available for this selection.",
    rows
  };
}

function buildAllianceSummary(selection, partyRows = [], sourceAllianceSummary = null, totalSeats = null) {
  const sourcedSummary = buildSourceAllianceSummary(selection, sourceAllianceSummary, totalSeats);

  if (sourcedSummary) {
    return sourcedSummary;
  }

  const sliceConfig = getAllianceSliceConfig(selection);

  if (!sliceConfig?.alliances?.length) {
    return {
      available: false,
      rows: [],
      note: "Alliance mapping has not been configured for this slice yet."
    };
  }

  const normalizedRows = normalizePartyRows(partyRows, {
    selection,
    maximumRows: 48,
    minimumVoteShare: 0,
    minimumSeats: 0
  });
  const partyMap = new Map(normalizedRows.map((row) => [normalizePartyLabel(row.party, selection), row]));
  const claimedParties = new Set();
  const rows = [];

  sliceConfig.alliances.forEach((alliance) => {
    const matchedRows = (alliance.parties ?? [])
      .map((party) => normalizePartyLabel(party, selection))
      .map((party) => partyMap.get(party))
      .filter(Boolean);

    if (matchedRows.length === 0) {
      return;
    }

    matchedRows.forEach((row) => claimedParties.add(row.party));

    const voteShares = matchedRows
      .map((row) => row.voteShare)
      .filter((value) => typeof value === "number" && value > 0);

    rows.push({
      id: alliance.id ?? slugifyText(alliance.label),
      label: alliance.label,
      color: alliance.color ?? matchedRows[0]?.color ?? "#8aa4bf",
      seats: matchedRows.reduce((sum, row) => sum + (row.seats ?? 0), 0),
      seatShare: toFixedNumber(
        matchedRows.reduce((sum, row) => sum + (row.seatShare ?? 0), 0),
        1
      ),
      voteShare:
        voteShares.length > 0
          ? toFixedNumber(voteShares.reduce((sum, value) => sum + value, 0), 1)
          : null,
      parties: matchedRows.map((row) => row.party),
      standalone: false
    });
  });

  normalizedRows
    .filter((row) => !claimedParties.has(row.party) && (row.seats ?? 0) > 0)
    .forEach((row) => {
      rows.push({
        id: `party-${slugifyText(row.party)}`,
        label: row.party,
        color: row.color,
        seats: row.seats,
        seatShare: row.seatShare,
        voteShare: row.voteShare,
        parties: [row.party],
        standalone: true
      });
    });

  const rankedRows = rows.sort(
    (left, right) =>
      right.seats - left.seats ||
      (right.voteShare ?? -1) - (left.voteShare ?? -1) ||
      left.label.localeCompare(right.label)
  );
  const leader = rankedRows[0] ?? null;
  const challenger = rankedRows[1] ?? null;
  const leadGap = leader && challenger ? leader.seats - challenger.seats : leader?.seats ?? 0;
  const unmatchedSeatWinners = rankedRows
    .filter((row) => row.standalone)
    .map((row) => row.label);
  const note = unmatchedSeatWinners.length > 0
    ? `Coalition performance is available for this selection, with unmapped winning parties still shown separately: ${unmatchedSeatWinners.join(", ")}.`
    : "Coalition performance is available for this selection.";

  return {
    available: rankedRows.length > 0,
    configured: true,
    leader,
    challenger,
    leadGap,
    note,
    rows: rankedRows
  };
}

function normalizePartyRows(rows = [], options = {}) {
  const selection = options.selection ?? null;
  const includeParties = new Set((options.includeParties ?? []).map((party) => normalizePartyLabel(party, selection)));
  const maximumRows = options.maximumRows ?? 16;
  const minimumVoteShare = options.minimumVoteShare ?? 1;
  const minimumSeats = options.minimumSeats ?? 1;
  const mergedRows = new Map();

  rows.forEach((row) => {
    const party = normalizePartyLabel(row.party, selection);
    const seats = Number(row.seats);
    const seatShare = Number(row.seatShare);
    const voteShare = Number(row.voteShare);
    const existing = mergedRows.get(party) ?? {
      party,
      seats: 0,
      seatShare: 0,
      voteShare: 0,
      hasVoteShare: false,
      color: getPartyColor(party, selection)
    };

    if (Number.isFinite(seats)) {
      existing.seats += seats;
    }

    if (Number.isFinite(seatShare)) {
      existing.seatShare += seatShare;
    }

    if (Number.isFinite(voteShare)) {
      existing.voteShare += voteShare;
      existing.hasVoteShare = true;
    }

    mergedRows.set(party, existing);
  });

  const normalizedRows = [...mergedRows.values()]
    .map((row) => ({
      party: row.party,
      seats: row.seats,
      seatShare: toFixedNumber(row.seatShare, 1) ?? 0,
      voteShare: row.hasVoteShare ? toFixedNumber(row.voteShare, 1) : null,
      color: row.color
    }))
    .filter(
      (row) =>
        row.seats >= minimumSeats ||
        (typeof row.voteShare === "number" && row.voteShare >= minimumVoteShare) ||
        includeParties.has(row.party)
    )
    .sort(
      (left, right) =>
        right.seats - left.seats ||
        (right.voteShare ?? -1) - (left.voteShare ?? -1) ||
        right.seatShare - left.seatShare ||
        left.party.localeCompare(right.party)
    );

  return normalizedRows.slice(0, maximumRows);
}

function pickFocusParties(slices, currentParties, limit = 4) {
  const excludedParties = new Set(["IND", "NOTA"]);
  const forcedParties = currentParties
    .map((row) => row.party)
    .filter((party) => !excludedParties.has(party))
    .slice(0, 2);
  const scores = new Map();

  slices.forEach((slice, sliceIndex) => {
    const recencyWeight = slices.length - sliceIndex;
    const sliceSelection = getSliceSelectionContext(slice);
    const parties = normalizePartyRows(slice.topParties, {
      selection: sliceSelection,
      includeParties: forcedParties,
      maximumRows: 8,
      minimumVoteShare: 2
    });

    parties.forEach((row, partyIndex) => {
      if (excludedParties.has(row.party)) {
        return;
      }

      const score =
        row.seatShare * 4 +
        (row.voteShare ?? 0) * 2 +
        row.seats * 0.5 +
        Math.max(0, 8 - partyIndex) +
        recencyWeight;

      scores.set(row.party, (scores.get(row.party) ?? 0) + score);
    });
  });

  const rankedParties = [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([party]) => party);

  return [...new Set([...forcedParties, ...rankedParties])].slice(0, limit);
}

function getSeedStateConfig(stateSlug) {
  return states.find((state) => state.slug === stateSlug) ?? states[0];
}

function getRealStateConfig(stateSlug) {
  return getElectionAtlasResultsIndex().inventoryStates.find((state) => state.slug === stateSlug) ?? null;
}

function mergeStateConfig(target, incoming) {
  const mergedYears = {
    LS: [...new Set([...(target.yearsByHouse?.LS ?? []), ...(incoming.yearsByHouse?.LS ?? [])])].sort(
      (left, right) => right - left
    ),
    VS: [...new Set([...(target.yearsByHouse?.VS ?? []), ...(incoming.yearsByHouse?.VS ?? [])])].sort(
      (left, right) => right - left
    )
  };
  const defaultHouse = mergedYears[target.defaultHouse]?.length
    ? target.defaultHouse
    : mergedYears[incoming.defaultHouse]?.length
      ? incoming.defaultHouse
      : mergedYears.VS.length > 0
        ? "VS"
        : "LS";

  return {
    ...target,
    ...incoming,
    description: incoming.description ?? target.description,
    yearsByHouse: mergedYears,
    defaultHouse,
    defaultYearByHouse: {
      LS: mergedYears.LS[0] ?? null,
      VS: mergedYears.VS[0] ?? null
    },
    sourceLabels: [...new Set([...(target.sourceLabels ?? []), ...(incoming.sourceLabels ?? [])])]
  };
}

function getAvailableStateConfigs() {
  if (!hasSourceCoverage()) {
    return states;
  }

  const mergedConfigs = new Map();

  getLokDhabaResultsIndex().inventoryStates.forEach((state) => {
    const existing = mergedConfigs.get(state.slug) ?? {
      slug: state.slug,
      name: state.name,
      description: state.description,
      defaultHouse: state.defaultHouse,
      defaultYearByHouse: state.defaultYearByHouse,
      yearsByHouse: state.yearsByHouse,
      sourceLabels: []
    };
    mergedConfigs.set(state.slug, mergeStateConfig(existing, state));
  });

  getElectionAtlasResultsIndex().inventoryStates.forEach((state) => {
    const existing = mergedConfigs.get(state.slug) ?? {
      slug: state.slug,
      name: state.name,
      description: state.description,
      defaultHouse: state.defaultHouse,
      defaultYearByHouse: state.defaultYearByHouse,
      yearsByHouse: state.yearsByHouse,
      sourceLabels: []
    };
    mergedConfigs.set(state.slug, mergeStateConfig(existing, state));
  });

  states.forEach((state) => {
    if (mergedConfigs.has(state.slug)) {
      return;
    }

    mergedConfigs.set(
      state.slug,
      mergeStateConfig(
        {
          slug: state.slug,
          name: state.name,
          description: state.description,
          defaultHouse: state.defaultHouse,
          defaultYearByHouse: state.defaultYearByHouse,
          yearsByHouse: state.yearsByHouse,
          sourceLabels: ["Seed"]
        },
        {}
      )
    );
  });

  return [...mergedConfigs.values()]
    .map((state) => {
      const hasNonSeedSources = (state.sourceLabels ?? []).some((label) => label !== "Seed");

      return {
        ...state,
        sourceLabels: hasNonSeedSources
          ? state.sourceLabels.filter((label) => label !== "Seed")
          : state.sourceLabels
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getStateConfig(stateSlug) {
  const configs = getAvailableStateConfigs();
  return configs.find((state) => state.slug === stateSlug) ?? configs.find((state) => state.slug === defaultSelection.state) ?? configs[0];
}

function getGeographyVersion(versionId, fallbackLabel = "Version-aware geography") {
  return (
    geographyVersions.find((item) => item.id === versionId) ?? {
      id: versionId ?? "source-version",
      state: null,
      label: fallbackLabel,
      shortLabel: fallbackLabel,
      validFromYear: null,
      validToYear: null,
      notes: "Derived from staged source labels."
    }
  );
}

function getAvailableYears(stateSlug, house) {
  const state = getStateConfig(stateSlug);
  return state.yearsByHouse?.[house] ?? state.yearsByHouse?.[state.defaultHouse] ?? [];
}

function normalizeSelection(input = {}) {
  const stateConfig = getStateConfig(input.state);
  let house = input.house === "LS" ? "LS" : "VS";

  if (!stateConfig.yearsByHouse?.[house]?.length) {
    house = stateConfig.defaultHouse;
  }

  const availableYears = getAvailableYears(stateConfig.slug, house);
  const numericYear = Number.parseInt(String(input.year ?? ""), 10);
  const year = availableYears.includes(numericYear)
    ? numericYear
    : stateConfig.defaultYearByHouse?.[house] ?? availableYears[0];

  return {
    state: stateConfig.slug,
    house,
    year
  };
}

function getTopPartiesForSeedElection(state, house, year) {
  return factPartyStateTrend
    .filter((row) => row.state === state && row.house === house && row.year === year)
    .sort((left, right) => right.seats - left.seats || right.voteShare - left.voteShare)
    .map((row) => ({
      ...row,
      color: partyPalette[row.party] ?? "#8aa4bf"
    }));
}

function getSeedSummaryRecord(state, house, year) {
  return factStateElectionSummary.find(
    (row) => row.state === state && row.house === house && row.year === year
  );
}

function getLokDhabaSlicesForSelection(stateSlug, house) {
  return getLokDhabaResultsIndex().slices
    .filter((slice) => slice.selectionKey === stateSlug && slice.house === house)
    .sort((left, right) => right.year - left.year);
}

function findIndexedSliceBySource(selection, source) {
  const index = source === "lokdhaba" ? getLokDhabaResultsIndex() : getElectionAtlasResultsIndex();

  return index.slices.find(
    (slice) =>
      slice.selectionKey === selection.state &&
      slice.house === selection.house &&
      slice.year === selection.year
  ) ?? null;
}

function readSlicePayload(slice) {
  if (!slice?.fileName) {
    return null;
  }

  const dir = slice.source === "lokdhaba" ? stagedLokdhabaResultsDir : stagedResultsDir;
  return readJsonFile(path.join(dir, slice.fileName));
}

function mergeMetricField(primaryValue, fallbackValue) {
  return primaryValue === null || primaryValue === undefined || primaryValue === ""
    ? fallbackValue ?? primaryValue
    : primaryValue;
}

function mergeTopPartyRows(primaryRows = [], fallbackRows = [], selection = null) {
  const fallbackByParty = new Map(
    fallbackRows.map((row) => [normalizePartyLabel(row.party, selection), row])
  );

  return primaryRows.map((row) => {
    const fallbackRow = fallbackByParty.get(normalizePartyLabel(row.party, selection));

    return {
      ...row,
      voteShare: mergeMetricField(row.voteShare, fallbackRow?.voteShare)
    };
  });
}

function mergeSlices(primarySlice, fallbackSlice) {
  const selection = getSliceSelectionContext(primarySlice) ?? getSliceSelectionContext(fallbackSlice);
  return {
    ...primarySlice,
    coverage: {
      ...(primarySlice.coverage ?? {}),
      ...(fallbackSlice.coverage ?? {}),
      hasRunnerUp:
        primarySlice.coverage?.hasRunnerUp ??
        fallbackSlice.coverage?.hasRunnerUp ??
        false,
      hasVoteShare:
        primarySlice.coverage?.hasVoteShare ??
        fallbackSlice.coverage?.hasVoteShare ??
        false
    },
    metrics: {
      ...(fallbackSlice.metrics ?? {}),
      ...(primarySlice.metrics ?? {}),
      winnerVoteShare: mergeMetricField(
        primarySlice.metrics?.winnerVoteShare,
        fallbackSlice.metrics?.winnerVoteShare
      )
    },
    topParties: mergeTopPartyRows(primarySlice.topParties, fallbackSlice.topParties, selection),
    sourceAllianceSummary:
      primarySlice.sourceAllianceSummary ??
      fallbackSlice.sourceAllianceSummary ??
      null,
    allianceEnrichment:
      primarySlice.allianceEnrichment ??
      fallbackSlice.allianceEnrichment ??
      null,
    fallbackSource: fallbackSlice.source ?? null,
    fallbackFileName: fallbackSlice.fileName ?? null
  };
}

function buildConstituencyRowKey(selection, row) {
  const seatNumber = Number.parseInt(
    String(row.constituencyNumber ?? row.seat ?? ""),
    10
  );

  if (Number.isFinite(seatNumber)) {
    return `seat::${seatNumber}`;
  }

  return `slug::${getCanonicalConstituencySlug(selection, row)}`;
}

function sortConstituenciesCanonically(rows = []) {
  return [...rows].sort((left, right) => {
    const leftNumber = Number.isFinite(left.constituencyNumber) ? left.constituencyNumber : Number.MAX_SAFE_INTEGER;
    const rightNumber = Number.isFinite(right.constituencyNumber) ? right.constituencyNumber : Number.MAX_SAFE_INTEGER;

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return String(left.constituency ?? "").localeCompare(String(right.constituency ?? ""));
  });
}

function sortDistrictsCanonically(rows = []) {
  return [...rows].sort((left, right) =>
    String(left.district ?? "").localeCompare(String(right.district ?? ""))
  );
}

function buildConstituencyDetailFileStem(selection, row) {
  return [
    row.stateVersionSlug ?? selection.state,
    selection.house.toLowerCase(),
    selection.year,
    row.constituencyNumber ?? "na",
    slugifyText(row.constituency),
    "detail"
  ]
    .filter(Boolean)
    .join("-");
}

function buildConstituencyDetailFileName(selection, row) {
  return (
    row.detailFileName ??
    getDetailIndexSeat(selection, row)?.detailFileName ??
    `${buildConstituencyDetailFileStem(selection, row)}.json`
  );
}

function readLatestRawConstituencyDetail(fileName) {
  try {
    const captureDirs = readdirSync(rawIndiaVotesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left));

    for (const dirName of captureDirs) {
      const filePath = path.join(rawIndiaVotesDir, dirName, "details", fileName);

      if (existsSync(filePath)) {
        return readJsonFile(filePath);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getRawConstituencyDetailFileNames() {
  if (rawConstituencyDetailFileNamesCache) {
    return rawConstituencyDetailFileNamesCache;
  }

  const fileNames = new Set();

  try {
    const captureDirs = readdirSync(rawIndiaVotesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    captureDirs.forEach((dirName) => {
      const detailsDir = path.join(rawIndiaVotesDir, dirName, "details");

      if (!existsSync(detailsDir)) {
        return;
      }

      readdirSync(detailsDir)
        .filter((fileName) => fileName.endsWith(".json"))
        .forEach((fileName) => {
          fileNames.add(fileName);
        });
    });
  } catch {
    rawConstituencyDetailFileNamesCache = fileNames;
    return rawConstituencyDetailFileNamesCache;
  }

  rawConstituencyDetailFileNamesCache = fileNames;
  return rawConstituencyDetailFileNamesCache;
}

function getStagedConstituencyDetailFileNames() {
  if (stagedConstituencyDetailFileNamesCache) {
    return stagedConstituencyDetailFileNamesCache;
  }

  const fileNames = new Set();

  try {
    if (!existsSync(stagedDetailsDir)) {
      stagedConstituencyDetailFileNamesCache = fileNames;
      return stagedConstituencyDetailFileNamesCache;
    }

    readdirSync(stagedDetailsDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .forEach((fileName) => {
        fileNames.add(fileName);
      });
  } catch {
    stagedConstituencyDetailFileNamesCache = fileNames;
    return stagedConstituencyDetailFileNamesCache;
  }

  stagedConstituencyDetailFileNamesCache = fileNames;
  return stagedConstituencyDetailFileNamesCache;
}

function hasLocalConstituencyDetail(selection, row, options = {}) {
  const detailIndexSeat = getDetailIndexSeat(selection, row);

  if (detailIndexSeat?.detailAvailable) {
    return true;
  }

  const fileName = detailIndexSeat?.detailFileName ?? buildConstituencyDetailFileName(selection, row);

  if (getStagedConstituencyDetailFileNames().has(fileName)) {
    return true;
  }

  if (options.includeRaw === false) {
    return false;
  }

  return getRawConstituencyDetailFileNames().has(fileName);
}

function normalizeDistrictSeat(selection, seat, options = {}) {
  return {
    ...seat,
    constituency: getCanonicalConstituencyLabel(selection, seat),
    constituencySlug: getCanonicalConstituencySlug(selection, seat),
    winner: normalizeCandidateLabel(selection, seat, seat.winner),
    winnerParty: normalizePartyLabel(seat.winnerParty, selection),
    detailAvailable: hasLocalConstituencyDetail(selection, seat, {
      includeRaw: options.includeRaw ?? false
    })
  };
}

function normalizeDistrictRow(selection, row, options = {}) {
  return {
    ...row,
    winnerParty: normalizePartyLabel(row.winnerParty, selection),
    constituencies: sortConstituenciesCanonically(
      (row.constituencies ?? []).map((seat) => normalizeDistrictSeat(selection, seat, options))
    ),
    topParties: (row.topParties ?? []).map((party) => ({
      ...party,
      party: normalizePartyLabel(party.party, selection),
      color: getPartyColor(party.party, selection)
    }))
  };
}

function mergeConstituencyRows(selection, primaryRows = [], fallbackRows = []) {
  const fallbackByKey = new Map(
    fallbackRows.map((row) => [buildConstituencyRowKey(selection, row), row])
  );

  return primaryRows.map((row) => {
    const fallbackRow = fallbackByKey.get(buildConstituencyRowKey(selection, row));

    if (!fallbackRow) {
      return row;
    }

    return {
      ...row,
      winnerVotes: mergeMetricField(row.winnerVotes, fallbackRow.winnerVotes),
      winnerVoteShare: mergeMetricField(row.winnerVoteShare, fallbackRow.winnerVoteShare),
      runnerUp: mergeMetricField(row.runnerUp, fallbackRow.runnerUp),
      runnerUpParty: mergeMetricField(row.runnerUpParty, fallbackRow.runnerUpParty),
      runnerUpVotes: mergeMetricField(row.runnerUpVotes, fallbackRow.runnerUpVotes),
      runnerUpVoteShare: mergeMetricField(row.runnerUpVoteShare, fallbackRow.runnerUpVoteShare),
      detailAvailable: Boolean(row.detailAvailable || fallbackRow.detailAvailable),
      detailFileName: row.detailFileName ?? fallbackRow.detailFileName ?? null,
      constituencyUrl: mergeMetricField(row.constituencyUrl, fallbackRow.constituencyUrl),
      districtUrl: mergeMetricField(row.districtUrl, fallbackRow.districtUrl),
      partyUrl: mergeMetricField(row.partyUrl, fallbackRow.partyUrl),
      marginUrl: mergeMetricField(row.marginUrl, fallbackRow.marginUrl)
    };
  });
}

function applyManualSeatSourceOverrides(
  selection,
  rows = [],
  { primaryRows = [], primarySource = null, secondaryRows = [], secondarySource = null } = {}
) {
  const primaryByKey = new Map(
    primaryRows.map((row) => [buildConstituencyRowKey(selection, row), row])
  );
  const secondaryByKey = new Map(
    secondaryRows.map((row) => [buildConstituencyRowKey(selection, row), row])
  );

  return rows.map((row) => {
    const manualAdjudication = getManualSeatAdjudication(selection, row);

    if (!manualAdjudication?.preferredSource) {
      return row;
    }

    const rowKey = buildConstituencyRowKey(selection, row);
    const preferredRow =
      manualAdjudication.preferredSource === primarySource
        ? primaryByKey.get(rowKey)
        : manualAdjudication.preferredSource === secondarySource
          ? secondaryByKey.get(rowKey)
          : null;

    if (!preferredRow) {
      return row;
    }

    const alternateRow =
      manualAdjudication.preferredSource === primarySource
        ? secondaryByKey.get(rowKey)
        : primaryByKey.get(rowKey);

    return {
      ...(alternateRow ?? {}),
      ...preferredRow,
      detailAvailable: Boolean(
        preferredRow.detailAvailable ||
        preferredRow.detailFileName ||
        alternateRow?.detailAvailable ||
        alternateRow?.detailFileName
      )
    };
  });
}

function preferSlice(currentSlice, candidateSlice) {
  if (!currentSlice) {
    return candidateSlice;
  }

  if (currentSlice.source === "lokdhaba" && candidateSlice.source === "indiavotes") {
    return mergeSlices(currentSlice, candidateSlice);
  }

  if (candidateSlice.source === "lokdhaba" && currentSlice.source !== "lokdhaba") {
    return mergeSlices(candidateSlice, currentSlice);
  }

  return currentSlice;
}

function getRealSlicesForSelection(stateSlug, house) {
  const slicesByYear = new Map();

  getLokDhabaSlicesForSelection(stateSlug, house).forEach((slice) => {
    slicesByYear.set(slice.year, slice);
  });

  getElectionAtlasResultsIndex()
    .slices.filter((slice) => slice.selectionKey === stateSlug && slice.house === house)
    .forEach((slice) => {
      slicesByYear.set(slice.year, preferSlice(slicesByYear.get(slice.year), slice));
    });

  return [...slicesByYear.values()].sort((left, right) => right.year - left.year);
}

function findRealSlice(selection) {
  return getRealSlicesForSelection(selection.state, selection.house).find(
    (slice) => slice.year === selection.year
  );
}

function findDistrictMartIndexSlice(stateSlug, house, year) {
  return (
    getDistrictMartsIndex().slices.find(
      (slice) => slice.selectionKey === stateSlug && slice.house === house && slice.year === year
    ) ?? null
  );
}

function getManualSeatAdjudication(selection, rowOrSeat) {
  const seatNumber =
    typeof rowOrSeat === "number"
      ? rowOrSeat
      : Number.parseInt(String(rowOrSeat?.constituencyNumber ?? rowOrSeat?.seat ?? ""), 10);

  if (!Number.isFinite(seatNumber)) {
    return null;
  }

  return (
    manualSeatAdjudications.entries.find(
      (entry) =>
        entry.selectionKey === selection.state &&
        entry.house === selection.house &&
        entry.year === selection.year &&
        entry.seat === seatNumber
    ) ?? null
  );
}

function buildSyntheticAdjudicatedDetail(selection, row, manualAdjudication) {
  if (!manualAdjudication || !row) {
    return null;
  }

  const candidateRows = [];

  if (row.winner) {
    candidateRows.push({
      position: 1,
      candidate: row.winner,
      votes: row.winnerVotes ?? null,
      voteShare: row.winnerVoteShare ?? null,
      party: row.winnerParty ?? null
    });
  }

  if (row.runnerUp) {
    candidateRows.push({
      position: 2,
      candidate: row.runnerUp,
      votes: row.runnerUpVotes ?? null,
      voteShare: row.runnerUpVoteShare ?? null,
      party: row.runnerUpParty ?? null
    });
  }

  if (candidateRows.length === 0) {
    return null;
  }

  return {
    generatedAt: manualAdjudication.generatedAt ?? new Date().toISOString(),
    source: "manual-adjudication",
    note:
      manualAdjudication.note ??
      "This constituency stays fully local. The detail shown here has been reviewed and resolved for this seat.",
    parsed: {
      winner: candidateRows[0] ?? null,
      runnerUp: candidateRows[1] ?? null,
      partyVoteTotals: candidateRows
        .filter((candidate) => candidate.party && Number.isFinite(candidate.votes))
        .map((candidate) => ({
          party: candidate.party,
          votes: candidate.votes
        })),
      candidateRows
    },
    parentSelection: {
      state: selection.state,
      house: selection.house,
      year: selection.year
    },
    constituency: row.constituency,
    constituencyNumber: row.constituencyNumber,
    reservationType: row.reservationType ?? null,
    district: row.district ?? ""
  };
}

function getSeatManualReviewItems(selection, row) {
  const seatNumber = Number.parseInt(String(row?.constituencyNumber ?? row?.seat ?? ""), 10);

  if (!Number.isFinite(seatNumber)) {
    return [];
  }

  if (getManualSeatAdjudication(selection, seatNumber)) {
    return [];
  }

  return getElectionAtlasManualReviewQueue().queue.filter(
    (item) =>
      item.selection?.selectionKey === selection.state &&
      item.selection?.house === selection.house &&
      item.selection?.year === selection.year &&
      item.seat === seatNumber
  );
}

function scoreDefaultSlice(slice, stateConfig) {
  const districtSlice = findDistrictMartIndexSlice(slice.selectionKey, slice.house, slice.year);

  return (
    (districtSlice?.rowCount ?? 0) * 6 +
    (districtSlice ? 140 : 0) +
    (slice.source === "lokdhaba" ? 55 : 0) +
    (slice.coverage?.hasVoteShare ? 28 : 0) +
    (slice.coverage?.hasRunnerUp ? 12 : 0) +
    Math.min(slice.rowCount ?? 0, 400) / 16 +
    (slice.house === stateConfig.defaultHouse ? 8 : 0) +
    ((slice.year ?? 0) - 1900) / 10
  );
}

function pickPreferredRealSlice(stateSlug) {
  const stateConfig = getStateConfig(stateSlug);
  const candidates = ["VS", "LS"].flatMap((house) => getRealSlicesForSelection(stateSlug, house));

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const scoreDelta = scoreDefaultSlice(right, stateConfig) - scoreDefaultSlice(left, stateConfig);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    if (right.year !== left.year) {
      return right.year - left.year;
    }

    if (right.house !== left.house) {
      return right.house === stateConfig.defaultHouse ? 1 : -1;
    }

    return 0;
  })[0];
}

function pickGlobalPreferredRealSlice() {
  const candidates = getAvailableStateConfigs().flatMap((stateConfig) =>
    ["VS", "LS"]
      .flatMap((house) => getRealSlicesForSelection(stateConfig.slug, house))
      .map((slice) => ({ slice, stateConfig }))
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const scoreDelta = scoreDefaultSlice(right.slice, right.stateConfig) - scoreDefaultSlice(left.slice, left.stateConfig);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    if (right.slice.year !== left.slice.year) {
      return right.slice.year - left.slice.year;
    }

    if (right.slice.house !== left.slice.house) {
      return right.slice.house === right.stateConfig.defaultHouse ? 1 : -1;
    }

    return left.stateConfig.name.localeCompare(right.stateConfig.name);
  })[0]?.slice ?? null;
}

function getSelectionDisplayName(selection) {
  return getStateConfig(selection.state)?.name ?? selection.state;
}

function buildSeatTableLeaderLine(summary, challenger) {
  const leaderLine = `${summary.winnerParty} currently holds the most seats with ${summary.winnerSeats} wins`;

  if (!challenger) {
    return `${leaderLine}.`;
  }

  return `${leaderLine}, ahead of ${challenger.party}.`;
}

function buildSeedElectionRows(state, house) {
  return factStateElectionSummary
    .filter((row) => row.state === state && row.house === house)
    .sort((left, right) => right.year - left.year)
    .map((row) => {
      const topParties = getTopPartiesForSeedElection(state, house, row.year);
      const geographyVersion = getGeographyVersion(row.geographyVersionId);
      const challenger = topParties[1];

      return {
        year: row.year,
        house: row.house,
        houseLabel: houseLabels[row.house],
        totalSeats: row.totalSeats,
        turnoutPct: row.turnoutPct,
        winnerParty: row.winnerParty,
        winnerSeats: row.winnerSeats,
        winnerSeatShare: row.winnerSeatShare,
        winnerVoteShare: row.winnerVoteShare,
        closeContests: row.closeContests,
        meanMarginPct: row.meanMarginPct,
        medianMarginPct: row.medianMarginPct,
        geographyVersionLabel: geographyVersion.shortLabel,
        topTwo: challenger ? `${row.winnerParty} vs ${challenger.party}` : row.winnerParty
      };
    });
}

function buildRealElectionRows(state, house) {
  return getRealSlicesForSelection(state, house).map((slice) => {
    const sliceSelection = getSliceSelectionContext(slice);
    const topParties = normalizePartyRows(slice.topParties, {
      selection: sliceSelection,
      maximumRows: 6,
      minimumVoteShare: 1
    });
    const challenger = topParties[1];
    const winnerParty = topParties[0]?.party ?? normalizePartyLabel(slice.metrics.winnerParty, sliceSelection);

    return {
      year: slice.year,
      house: slice.house,
      houseLabel: houseLabels[slice.house],
      totalSeats: slice.metrics.totalSeats,
      turnoutPct: slice.metrics.turnoutPct,
      winnerParty,
      winnerSeats: slice.metrics.winnerSeats,
      winnerSeatShare: slice.metrics.winnerSeatShare,
      winnerVoteShare: slice.metrics.winnerVoteShare,
      closeContests: slice.metrics.closeContests,
      meanMarginPct: slice.metrics.meanMarginPct,
      medianMarginPct: slice.metrics.medianMarginPct,
      geographyVersionLabel: slice.stateLabel,
      topTwo: challenger ? `${winnerParty} vs ${challenger.party}` : winnerParty
    };
  });
}

function buildSeedTrendSeries(state, house, focusParties) {
  const years = getAvailableYears(state, house).slice().sort((left, right) => left - right);

  return focusParties.map((party) => ({
    party,
    color: partyPalette[party] ?? "#8aa4bf",
    seatShare: years.map((year) => {
      const record = factPartyStateTrend.find(
        (row) => row.state === state && row.house === house && row.year === year && row.party === party
      );

      return { year, value: record?.seatShare ?? 0 };
    }),
    voteShare: years.map((year) => {
      const record = factPartyStateTrend.find(
        (row) => row.state === state && row.house === house && row.year === year && row.party === party
      );

      return { year, value: record?.voteShare ?? 0 };
    })
  }));
}

function buildRealTrendSeries(state, house, focusParties) {
  const trendMart = getPartyTrendMart({ state, house });
  const defaultSelection = {
    state,
    house,
    year: trendMart?.years?.at(-1) ?? null
  };

  if (trendMart) {
    return focusParties.map((party) => {
      const partySeries = trendMart.parties.find((entry) => entry.party === party);

      return {
        party,
        color: getPartyColor(party, defaultSelection),
        seatShare: partySeries?.seatShare ?? trendMart.years.map((year) => ({ year, value: 0 })),
        voteShare:
          partySeries?.voteShare ??
          trendMart.years.map((year) => ({ year, value: null }))
      };
    });
  }

  const slices = getRealSlicesForSelection(state, house).slice().sort((left, right) => left.year - right.year);
  const curatedSlices = slices.map((slice) => ({
    ...slice,
    atlasTopParties: normalizePartyRows(slice.topParties, {
      selection: getSliceSelectionContext(slice),
      includeParties: focusParties,
      maximumRows: 16,
      minimumVoteShare: 1
    })
  }));

  return focusParties.map((party) => ({
    party,
    color: getPartyColor(party, defaultSelection),
    seatShare: curatedSlices.map((slice) => ({
      year: slice.year,
      value: slice.atlasTopParties.find((item) => item.party === party)?.seatShare ?? 0
    })),
    voteShare: curatedSlices.map((slice) => ({
      year: slice.year,
      value: slice.atlasTopParties.find((item) => item.party === party)?.voteShare ?? null
    }))
  }));
}

function buildKpis(summary, topParties, mode = "seed", allianceSummary = null) {
  const challenger = topParties[1];
  const leadGap = challenger ? summary.winnerSeats - challenger.seats : summary.winnerSeats;
  const allianceLeader = allianceSummary?.leader ?? null;
  const allianceChallenger = allianceSummary?.challenger ?? null;
  const allianceLeadGap = allianceSummary?.leadGap ?? null;

  return [
    {
      label: "Total seats",
      value: String(summary.totalSeats),
      detail: "Constituencies in the selected election map"
    },
    {
      label: "Most seats secured",
      value: `${summary.winnerSeatShare.toFixed(1)}%`,
      detail: buildSeatTableLeaderLine(summary, challenger)
    },
    {
      label: "Turnout",
      value: `${summary.turnoutPct.toFixed(1)}%`,
      detail: "Participation across the selected map"
    },
    {
      label: "Close contests",
      value: String(summary.closeContests),
      detail: "Seats with margin under a five-point threshold"
    },
    {
      label: allianceLeader ? "Alliance edge" : "Lead over #2",
      value: `${(allianceLeader ? allianceLeadGap : leadGap) >= 0 ? "+" : ""}${allianceLeader ? allianceLeadGap : leadGap}`,
      detail: allianceLeader
        ? allianceChallenger
          ? `${allianceLeader.label} vs ${allianceChallenger.label}`
          : `${allianceLeader.label} is the only mapped formation`
        : challenger
          ? `Against ${challenger.party} on party seat count`
          : "Single-party seat-table lead"
    },
    {
      label: "Median margin",
      value: `${summary.medianMarginPct.toFixed(1)} pts`,
      detail: "Win margin pressure in the selected cycle"
    }
  ];
}

function buildAllianceSnapshotLine(allianceSummary) {
  const leader = allianceSummary?.leader ?? null;
  const challenger = allianceSummary?.challenger ?? null;

  if (!leader) {
    return "";
  }

  if (!challenger) {
    return ` Coalition balance currently favors ${leader.label} on ${leader.seatShare.toFixed(1)}% of seats.`;
  }

  return ` Coalition balance currently puts ${leader.label} at ${leader.seatShare.toFixed(1)}% of seats versus ${challenger.label} at ${challenger.seatShare.toFixed(1)}%.`;
}

function buildSeedSnapshot(summary, topParties, geographyVersion, allianceSummary = null) {
  const challenger = topParties[1];
  const swingDirection = summary.swingPoints > 0 ? "up" : summary.swingPoints < 0 ? "down" : "flat";
  const swingAbs = Math.abs(summary.swingPoints).toFixed(1);

  return `${getSeedStateConfig(summary.state).name}'s ${summary.year} ${houseLabels[summary.house]} read opens with a party-led seat picture. ${buildSeatTableLeaderLine(summary, challenger)}${buildAllianceSnapshotLine(allianceSummary)} That converts to ${summary.winnerSeatShare.toFixed(1)}% seat share and ${summary.winnerVoteShare.toFixed(1)}% vote share.${challenger ? ` ${summary.closeContests} contests still sit inside the tight-margin bucket, with ${challenger.party} as the nearest pressure point.` : ""} Turnout reads ${summary.turnoutPct.toFixed(1)}%, the median winning margin is ${summary.medianMarginPct.toFixed(1)} points, and momentum is ${swingDirection}${summary.swingPoints === 0 ? "" : ` by ${swingAbs} points`} versus the prior cycle.`;
}

function buildRealSnapshot(summary, topParties, geographyVersion, allianceSummary = null) {
  const challenger = topParties[1];
  const swingPrefix =
    typeof summary.swingPoints === "number"
      ? summary.swingPoints > 0
        ? `up ${Math.abs(summary.swingPoints).toFixed(1)} points`
        : summary.swingPoints < 0
          ? `down ${Math.abs(summary.swingPoints).toFixed(1)} points`
          : "flat versus the prior extracted cycle"
      : "not yet comparable across a prior extracted cycle";

  return `${getSelectionDisplayName(summary)}'s ${summary.year} ${houseLabels[summary.house]} read opens with the clearest seat picture first. ${buildSeatTableLeaderLine(summary, challenger)}${buildAllianceSnapshotLine(allianceSummary)} That converts to ${summary.winnerSeatShare.toFixed(1)}% seat share across ${summary.totalSeats} constituencies.${challenger ? ` ${summary.closeContests} contests remain inside the tight-margin bucket.` : ""} Turnout reads ${summary.turnoutPct.toFixed(1)}%, the median winning margin is ${summary.medianMarginPct.toFixed(1)} points, and momentum currently reads ${swingPrefix}.`;
}

function buildRealSummary(selection, slice) {
  if (!slice) {
    return null;
  }

  const mart = getStateSummaryMart(selection);
  const sourceSlice = mart ?? slice;
  const slices = getRealSlicesForSelection(selection.state, selection.house);
  const topParties = normalizePartyRows(sourceSlice.topParties, {
    selection,
    maximumRows: 12,
    minimumVoteShare: 1
  });
  const allianceSummary = buildAllianceSummary(
    selection,
    sourceSlice.topParties,
    sourceSlice.sourceAllianceSummary,
    sourceSlice.metrics.totalSeats
  );
  const winnerParty = topParties[0]?.party ?? normalizePartyLabel(sourceSlice.metrics.winnerParty, selection);
  const focusParties = pickFocusParties(slices, topParties, 4);
  const trendSeries = buildRealTrendSeries(selection.state, selection.house, focusParties);
  const currentIndex = slices.findIndex((item) => item.year === slice.year);
  const priorSlice = currentIndex >= 0 ? slices[currentIndex + 1] : null;
  const priorTopParties = priorSlice
    ? normalizePartyRows(priorSlice.topParties, {
        selection: getSliceSelectionContext(priorSlice),
        includeParties: [winnerParty],
        maximumRows: 12,
        minimumVoteShare: 1
      })
    : [];
  const priorWinnerSeatShare =
    priorTopParties.find((item) => item.party === winnerParty)?.seatShare ?? null;
  const swingPoints =
    typeof priorWinnerSeatShare === "number" && typeof sourceSlice.metrics.winnerSeatShare === "number"
      ? toFixedNumber(sourceSlice.metrics.winnerSeatShare - priorWinnerSeatShare, 1)
      : null;
  const geographyVersion = getGeographyVersion(sourceSlice.geographyVersionId, sourceSlice.stateLabel);

  const summary = {
    state: selection.state,
    house: selection.house,
    year: selection.year,
    source: sourceSlice.source,
    totalSeats: sourceSlice.metrics.totalSeats,
    turnoutPct: sourceSlice.metrics.turnoutPct,
    winnerParty,
    winnerSeats: sourceSlice.metrics.winnerSeats,
    winnerSeatShare: sourceSlice.metrics.winnerSeatShare,
    winnerVoteShare: sourceSlice.metrics.winnerVoteShare,
    closeContests: sourceSlice.metrics.closeContests,
    meanMarginPct: sourceSlice.metrics.meanMarginPct,
    medianMarginPct: sourceSlice.metrics.medianMarginPct,
    swingPoints,
    fragmentationIndex: sourceSlice.metrics.fragmentationIndex,
    advancedMetrics: sourceSlice.advancedMetrics ?? null,
    houseLabel: houseLabels[selection.house],
    geographyVersion,
    kpis: buildKpis(
      {
        ...sourceSlice.metrics,
        winnerParty,
        house: selection.house
      },
      topParties,
      sourceSlice.source === "lokdhaba" ? "lokdhaba" : "indiavotes"
      ,
      allianceSummary
    ),
    topParties,
    allianceSummary,
    trendSeries,
    snapshot: buildRealSnapshot(
      {
        ...sourceSlice.metrics,
        ...selection,
        winnerParty,
        source: sourceSlice.source,
        swingPoints
      },
      topParties,
      geographyVersion,
      allianceSummary
    ),
    sourceLabel:
      topParties.some((row) => typeof row.voteShare === "number")
        ? "Seats, turnout, margins, runner-up detail, and party vote share are available for this selection."
        : "Seats, turnout, and margins are available for this selection. Additional vote-share depth continues to expand.",
    voteShareAvailable: topParties.some((row) => typeof row.voteShare === "number"),
    liveCoverage: {
      rowCount: sourceSlice.rowCount,
      stateLabel: sourceSlice.stateLabel
    },
    freshness: sourceSlice.freshness ?? getSelectionFreshness(selection),
    quality: buildSelectionQuality(selection, sourceSlice)
  };

  return summary;
}

function buildSeedSummary(selection, pipeline) {
  const summary = getSeedSummaryRecord(selection.state, selection.house, selection.year);

  if (!summary) {
    return null;
  }

  const topParties = getTopPartiesForSeedElection(selection.state, selection.house, selection.year);
  const allianceSummary = buildAllianceSummary(selection, topParties, null, summary.totalSeats);
  const geographyVersion = getGeographyVersion(summary.geographyVersionId);
  const focusParties = topParties.slice(0, 4).map((row) => row.party);
  const trendSeries = buildSeedTrendSeries(selection.state, selection.house, focusParties);

  return {
    ...summary,
    houseLabel: houseLabels[summary.house],
    geographyVersion,
    kpis: buildKpis(summary, topParties, "seed", allianceSummary),
    topParties,
    allianceSummary,
    trendSeries,
    advancedMetrics: null,
    snapshot: buildSeedSnapshot(summary, topParties, geographyVersion, allianceSummary),
    sourceLabel: "Reference coverage is shown for this selection while deeper local detail continues to expand.",
    voteShareAvailable: true,
    freshness: getSelectionFreshness(selection),
    quality: buildSelectionQuality(selection, null, pipeline)
  };
}

function buildHybridPipeline() {
  const basePipeline = readJsonFile(stagedBootstrapPath)?.pipeline ?? defaultPipeline;
  const resultsIndex = getElectionAtlasResultsIndex();
  const manifest = getElectionAtlasResultsManifest();
  const detailCoverage = getElectionAtlasDetailCoverageStats();
  const lokdhabaIndex = getLokDhabaResultsIndex();
  const districtIndex = getDistrictMartsIndex();

  if (resultsIndex.stats.slices === 0 && lokdhabaIndex.stats.slices === 0 && districtIndex.stats.slices === 0) {
    return basePipeline;
  }

  const latestBatchCompletedJobs = manifest?.stats?.completedJobs ?? 0;
  const failedJobs = manifest?.stats?.failedJobs ?? 0;
  const skippedJobs = manifest?.stats?.skippedJobs ?? 0;
  const detailFilesCompleted = detailCoverage.filesWithVoteShare ?? 0;
  const detailFilesPartial = detailCoverage.partialFiles ?? 0;
  const detailRowsWithVoteShare = detailCoverage.rowsWithVoteShare ?? 0;
  const detailFailedRows = detailCoverage.failedRows ?? 0;
  const lokdhabaReady = lokdhabaIndex.stats.slices > 0;

  return {
    ...basePipeline,
    stage: "hybrid-national-atlas",
    stageLabel: "Hybrid national atlas staging",
    generatedAt: resultsIndex.generatedAt ?? lokdhabaIndex.generatedAt ?? basePipeline.generatedAt,
    lastCaptureAt:
      manifest?.generatedAt ??
      resultsIndex.generatedAt ??
      lokdhabaIndex.generatedAt ??
      basePipeline.lastCaptureAt,
    sourceLabel:
      "Election Atlas blends multiple internal data layers so each selection can open with local drilldown and structured analytics.",
    coverageNote:
      "Coverage expands cycle by cycle, with local drilldown and structured analytics across the atlas surface.",
    summary: `${resultsIndex.stats.slices} live result slices and ${lokdhabaIndex.stats.slices} historical slices are available across ${Math.max(resultsIndex.stats.inventoryStates, lokdhabaIndex.stats.states)} atlas states/entities.`,
    nextStep:
      failedJobs > 0
        ? "Complete the remaining extraction jobs, then continue party and geography harmonization."
        : "Extend district intelligence and candidate-detail parity across more atlas surfaces.",
    sources: [
      {
        key: "indiavotes",
        name: "IndiaVotes",
        statusLabel: failedJobs > 0 ? "Partial" : "Live",
        tone: failedJobs > 0 ? "warning" : "ready",
        detail:
          detailRowsWithVoteShare > 0
            ? `${resultsIndex.stats.slices} live slices are staged across ${resultsIndex.stats.inventoryStates} selection-ready states. Latest batch: ${latestBatchCompletedJobs} completed, ${skippedJobs} skipped, ${failedJobs} failed. Detail parity: ${detailFilesCompleted} completed files, ${detailFilesPartial} partial files, ${detailRowsWithVoteShare} constituency rows with vote share, ${detailFailedRows} failed rows.`
            : `${resultsIndex.stats.slices} live slices are staged across ${resultsIndex.stats.inventoryStates} selection-ready states. Latest batch: ${latestBatchCompletedJobs} completed, ${skippedJobs} skipped, ${failedJobs} failed.`
      },
      {
        key: "lokdhaba",
        name: "LokDhaba",
        statusLabel: lokdhabaReady ? "Normalized" : "Pending",
        tone: lokdhabaReady ? "ready" : "pending",
        detail: lokdhabaReady
          ? `${lokdhabaIndex.stats.slices} staged historical slices across ${lokdhabaIndex.stats.states} states/entities, with ${lokdhabaIndex.stats.constituencyRows} normalized constituency rows.`
          : "The LokDhaba aggregate downloads have not been normalized yet."
      },
      {
        key: "district-marts",
        name: "District Marts",
        statusLabel: districtIndex.stats.slices > 0 ? "Ready" : "Pending",
        tone: districtIndex.stats.slices > 0 ? "ready" : "pending",
        detail:
          districtIndex.stats.slices > 0
            ? `${districtIndex.stats.slices} Assembly district rollup slices are staged across ${districtIndex.stats.states} states/entities, with ${districtIndex.stats.districtRows} district rows.`
            : "Assembly district rollups have not been materialized yet."
      }
    ],
    stats: {
      ...basePipeline.stats,
      stagedResultSlices: resultsIndex.stats.slices,
      selectionReadyStates: resultsIndex.stats.inventoryStates,
      lokdhabaStates: lokdhabaIndex.stats.states,
      lokdhabaSlices: lokdhabaIndex.stats.slices,
      lokdhabaConstituencyRows: lokdhabaIndex.stats.constituencyRows,
      districtMartStates: districtIndex.stats.states,
      districtMartSlices: districtIndex.stats.slices,
      districtMartRows: districtIndex.stats.districtRows,
      failedJobs,
      completedJobs: resultsIndex.stats.slices,
      skippedJobs,
      detailFilesCompleted,
      detailFilesPartial,
      detailRowsWithVoteShare,
      detailFailedRows
    }
  };
}

export function getElectionAtlasPipeline() {
  return buildHybridPipeline();
}

export function getElectionAtlasCatalog() {
  return readJsonFile(stagedCatalogPath) ?? defaultCatalog;
}

export function getElectionAtlasStagedResults(filters = {}) {
  const selection = normalizeSelection(filters);
  const slice = findRealSlice(selection);
  const payload = readSlicePayload(slice);
  const fallbackSlice =
    slice?.source === "lokdhaba" ? findIndexedSliceBySource(selection, "indiavotes") : null;
  const fallbackPayload = readSlicePayload(fallbackSlice);
  const mergedRows =
    slice?.source === "lokdhaba" && fallbackPayload?.rows?.length
      ? mergeConstituencyRows(selection, payload?.rows ?? [], fallbackPayload.rows)
      : payload?.rows ?? [];
  const rows = applyManualSeatSourceOverrides(selection, mergedRows, {
    primaryRows: payload?.rows ?? [],
    primarySource: payload?.source ?? slice?.source ?? null,
    secondaryRows: fallbackPayload?.rows ?? [],
    secondarySource: fallbackPayload?.source ?? fallbackSlice?.source ?? null
  });

  return {
    selection,
    available: Boolean(payload),
    source: payload?.source ?? null,
    generatedAt: payload?.generatedAt ?? null,
    headers: payload?.headers ?? [],
    rowCount: rows.length,
    rows
  };
}

function getElectionAtlasDistrictMart(filters = {}) {
  const selection = normalizeSelection(filters);
  const filePath = path.join(
    stagedDistrictMartsDir,
    `${selection.state}-${selection.house.toLowerCase()}-${selection.year}.json`
  );
  const payload = readJsonFile(filePath);

  return {
    selection,
    available: Boolean(payload),
    source: payload?.source ?? null,
    coverage: payload?.coverage ?? null,
    generatedAt: payload?.generatedAt ?? null,
    metrics: payload?.metrics ?? null,
    rowCount: payload?.rows?.length ?? 0,
    rows: payload?.rows ?? []
  };
}

export function getElectionAtlasDefaultSelection() {
  if (hasSourceCoverage()) {
    const preferredSlice = pickGlobalPreferredRealSlice();

    if (preferredSlice) {
      return normalizeSelection({
        state: preferredSlice.selectionKey,
        house: preferredSlice.house,
        year: preferredSlice.year
      });
    }

    const preferredState = getStateConfig(defaultSelection.state);
    const preferredStateSlice = pickPreferredRealSlice(preferredState.slug);

    if (preferredStateSlice) {
      return normalizeSelection({
        state: preferredStateSlice.selectionKey,
        house: preferredStateSlice.house,
        year: preferredStateSlice.year
      });
    }

    return normalizeSelection({
      state: getAvailableStateConfigs()[0]?.slug ?? defaultSelection.state,
      house: getAvailableStateConfigs()[0]?.defaultHouse ?? defaultSelection.house
    });
  }

  return { ...defaultSelection };
}

export function getElectionAtlasStateConfig(stateSlug) {
  return getStateConfig(stateSlug);
}

export function listElectionAtlasStates() {
  if (hasSourceCoverage()) {
    return getAvailableStateConfigs().map((state) => ({
      slug: state.slug,
      name: state.name,
      description: state.description,
      defaultHouse: state.defaultHouse,
      defaultYearByHouse: state.defaultYearByHouse,
      yearsByHouse: state.yearsByHouse,
      geographyVersions: [],
      sourceLabels: state.sourceLabels,
      ambiguousCanonicalGroup: state.ambiguousCanonicalGroup
    }));
  }

  return states.map((state) => ({
    slug: state.slug,
    name: state.name,
    description: state.description,
    defaultHouse: state.defaultHouse,
    defaultYearByHouse: state.defaultYearByHouse,
    yearsByHouse: state.yearsByHouse,
    geographyVersions: state.geographyVersionIds.map((versionId) => getGeographyVersion(versionId))
  }));
}

export function listElectionAtlasElections(filters = {}) {
  const selection = normalizeSelection(filters);
  const elections = hasSourceCoverage() && getRealSlicesForSelection(selection.state, selection.house).length > 0
    ? buildRealElectionRows(selection.state, selection.house)
    : buildSeedElectionRows(selection.state, selection.house);

  return {
    selection,
    elections
  };
}

export function getElectionAtlasSummary(filters = {}) {
  const selection = normalizeSelection(filters);
  const pipeline = getElectionAtlasPipeline();
  const realSlice = hasSourceCoverage() ? findRealSlice(selection) : null;
  const summary = realSlice ? buildRealSummary(selection, realSlice) : buildSeedSummary(selection, pipeline);

  return {
    selection,
    pipeline,
    summary
  };
}

export function listElectionAtlasConstituencies(filters = {}) {
  const selection = normalizeSelection(filters);
  const staged = getElectionAtlasStagedResults(selection);

  if (staged.available && staged.rowCount > 0) {
    const constituencies = sortConstituenciesCanonically(
      staged.rows
      .map((row) => ({
        ...row,
        constituency: getCanonicalConstituencyLabel(selection, row),
        constituencySlug: getCanonicalConstituencySlug(selection, row),
        detailAvailable: Boolean(
          row.detailAvailable || row.detailFileName || hasLocalConstituencyDetail(selection, row, { includeRaw: false })
        ),
        winnerParty: normalizePartyLabel(row.winnerParty, selection),
        winner: normalizeCandidateLabel(selection, row, row.winner),
        runnerUp: row.runnerUp
          ? normalizeCandidateLabel(selection, row, row.runnerUp)
          : "Detail extraction pending",
        runnerUpParty: row.runnerUpParty
          ? normalizePartyLabel(row.runnerUpParty, selection)
          : "Candidate layer pending"
      }))
    );

    return {
      selection,
      coverage: {
        liveRows: constituencies.length,
        seededRows: 0,
        note:
          typeof staged.rows?.[0]?.winnerVoteShare === "number"
            ? "Winner, turnout, electors, margin, and vote-share detail are available for these constituency rows."
            : "Winner, turnout, electors, and margin are available for these constituency rows while additional vote-share detail continues to expand."
      },
      constituencies
    };
  }

  const constituencies = sortConstituenciesCanonically(
    factConstituencySummary
    .filter(
      (row) =>
        row.state === selection.state && row.house === selection.house && row.year === selection.year
    )
    .map((row) => ({
      ...row,
      constituency: getCanonicalConstituencyLabel(selection, row),
      constituencySlug: getCanonicalConstituencySlug(selection, row),
      detailAvailable: false,
      winner: normalizeCandidateLabel(selection, row, row.winner),
      winnerParty: normalizePartyLabel(row.winnerParty, selection),
      runnerUp: normalizeCandidateLabel(selection, row, row.runnerUp),
      runnerUpParty: normalizePartyLabel(row.runnerUpParty, selection)
    }))
  );

  return {
    selection,
    coverage: {
      seededRows: constituencies.length,
      note: getElectionAtlasPipeline().coverageNote
    },
    constituencies
  };
}

export function getElectionAtlasConstituencyDetail(filters = {}) {
  const selection = normalizeSelection(filters);
  const staged = getElectionAtlasStagedResults(selection);
  const constituencyNumber = Number.parseInt(
    String(filters.constituencyNumber ?? filters.seat ?? ""),
    10
  );
  const constituencySlug = slugifyText(filters.constituency ?? filters.slug ?? "");

  if (!staged.available || staged.rowCount === 0) {
    return {
      selection,
      available: false,
      note: "This constituency page is not available for the selected cycle yet."
    };
  }

  const row = staged.rows.find((candidate) => {
    if (Number.isFinite(constituencyNumber) && candidate.constituencyNumber === constituencyNumber) {
      return true;
    }

    return constituencySlug !== "" && getCanonicalConstituencySlug(selection, candidate) === constituencySlug;
  });

  if (!row) {
    return {
      selection,
      available: false,
      note: "The requested constituency was not found for this selection."
    };
  }

  const detailFileName = buildConstituencyDetailFileName(selection, row);
  const detailFilePath = path.join(stagedDetailsDir, detailFileName);
  const manualAdjudication = getManualSeatAdjudication(selection, row);
  const detailPayload =
    manualAdjudication?.detail ??
    readJsonFile(detailFilePath) ??
    readLatestRawConstituencyDetail(detailFileName) ??
    buildSyntheticAdjudicatedDetail(selection, row, manualAdjudication);
  const normalizedRow = {
    ...row,
    constituency: getCanonicalConstituencyLabel(selection, row),
    constituencySlug: getCanonicalConstituencySlug(selection, row),
    detailAvailable: Boolean(row.detailAvailable || row.detailFileName || detailPayload),
    winner: normalizeCandidateLabel(selection, row, row.winner),
    winnerParty: normalizePartyLabel(row.winnerParty, selection),
    runnerUp: row.runnerUp ? normalizeCandidateLabel(selection, row, row.runnerUp) : row.runnerUp,
    runnerUpParty: row.runnerUpParty ? normalizePartyLabel(row.runnerUpParty, selection) : row.runnerUpParty
  };
  const manualReviewItems = getSeatManualReviewItems(selection, row);

  if (manualReviewItems.length > 0) {
    const reviewLabels = manualReviewItems.map((item) => item.type.replaceAll("-", " ")).join(", ");

    return {
      selection,
      available: false,
      note: `Candidate detail for this seat is temporarily unavailable while ${manualReviewItems.length} issue${manualReviewItems.length > 1 ? "s are" : " is"} reviewed: ${reviewLabels}.`,
      seat: normalizedRow,
      metrics: buildConstituencyMetricBundle(normalizedRow, selection),
      reviewStatus: "manual-review",
      reviewItems: manualReviewItems,
      detail: null
    };
  }

  return {
    selection,
    available: Boolean(detailPayload),
    note: detailPayload
      ? detailPayload.note ??
        "Full candidate detail is available on this seat page."
      : "Candidate detail for this seat is being prepared.",
    seat: normalizedRow,
    metrics: buildConstituencyMetricBundle(normalizedRow, selection),
    adjudication: manualAdjudication
      ? {
          status: manualAdjudication.status ?? "resolved",
          preferredSource: manualAdjudication.preferredSource ?? "lokdhaba",
          rationale: manualAdjudication.rationale ?? null,
          references: manualAdjudication.references ?? []
        }
      : null,
    detail: detailPayload
      ? {
          generatedAt: detailPayload.generatedAt ?? null,
          source: detailPayload.source ?? "indiavotes",
          candidateRows: (detailPayload.parsed?.candidateRows ?? []).map((candidate) => ({
            ...candidate,
            candidate: normalizeCandidateLabel(selection, row, candidate.candidate),
            party: normalizePartyLabel(candidate.party, selection),
            voteShare:
              Number.isFinite(candidate.votes) &&
              Number.isFinite(normalizedRow.totalVotes) &&
              normalizedRow.totalVotes > 0
                ? toFixedNumber((candidate.votes / normalizedRow.totalVotes) * 100, 1)
                : candidate.voteShare
          })),
          partyVoteTotals: (detailPayload.parsed?.partyVoteTotals ?? []).map((candidate) => ({
            ...candidate,
            party: normalizePartyLabel(candidate.party, selection)
          })),
          winner: detailPayload.parsed?.winner
            ? {
                ...detailPayload.parsed.winner,
                candidate: normalizeCandidateLabel(selection, row, detailPayload.parsed.winner.candidate),
                party: normalizePartyLabel(detailPayload.parsed.winner.party, selection),
                voteShare:
                  Number.isFinite(detailPayload.parsed.winner.votes) &&
                  Number.isFinite(normalizedRow.totalVotes) &&
                  normalizedRow.totalVotes > 0
                    ? toFixedNumber((detailPayload.parsed.winner.votes / normalizedRow.totalVotes) * 100, 1)
                    : detailPayload.parsed.winner.voteShare
              }
            : null,
          runnerUp: detailPayload.parsed?.runnerUp
            ? {
                ...detailPayload.parsed.runnerUp,
                candidate: normalizeCandidateLabel(selection, row, detailPayload.parsed.runnerUp.candidate),
                party: normalizePartyLabel(detailPayload.parsed.runnerUp.party, selection),
                voteShare:
                  Number.isFinite(detailPayload.parsed.runnerUp.votes) &&
                  Number.isFinite(normalizedRow.totalVotes) &&
                  normalizedRow.totalVotes > 0
                    ? toFixedNumber((detailPayload.parsed.runnerUp.votes / normalizedRow.totalVotes) * 100, 1)
                    : detailPayload.parsed.runnerUp.voteShare
              }
            : null
        }
      : null
  };
}

export function getElectionAtlasDistrictDetail(filters = {}) {
  const selection = normalizeSelection(filters);

  if (selection.house !== "VS") {
    return {
      selection,
      available: false,
      note: "District detail is available for Vidhan Sabha selections only."
    };
  }

  const staged = getElectionAtlasDistrictMart(selection);
  const districtSlug = slugifyText(filters.slug ?? filters.district ?? "");

  if (!staged.available || staged.rowCount === 0) {
    return {
      selection,
      available: false,
      note: "District detail is not available for this selection yet."
    };
  }

  const stagedDistrict = staged.rows.find((candidate) => {
    return candidate.districtSlug === districtSlug || slugifyText(candidate.district) === districtSlug;
  });

  if (!stagedDistrict) {
    return {
      selection,
      available: false,
      note: "The requested district was not found for this selection."
    };
  }

  const district = normalizeDistrictRow(selection, stagedDistrict, {
    includeRaw: false
  });

  return {
    selection,
    available: true,
    note:
      "District detail is available on this page, with direct constituency drilldown.",
    district,
    metrics: buildDistrictMetricBundle(district, selection)
  };
}

export function listElectionAtlasDistricts(filters = {}) {
  const selection = normalizeSelection(filters);

  if (selection.house !== "VS") {
    return {
      selection,
      coverage: {
        liveRows: 0,
        note: "District detail is available for Vidhan Sabha selections only."
      },
      districts: []
    };
  }

  const staged = getElectionAtlasDistrictMart(selection);

  if (!staged.available || staged.rowCount === 0) {
    return {
      selection,
      coverage: {
        liveRows: 0,
        note: "District detail is not available for this selection yet."
      },
      districts: []
    };
  }

  return {
    selection,
    coverage: {
      liveRows: staged.rowCount,
      note:
        "District seat conversion, turnout, margin pressure, and party concentration are available for this selection."
    },
    metrics: staged.metrics,
    districts: sortDistrictsCanonically(
      staged.rows.map((row) =>
        normalizeDistrictRow(selection, row, {
          includeRaw: false
        })
      )
    )
  };
}

export function getElectionAtlasDiscrepancies(filters = {}) {
  const selection = normalizeSelection(filters);
  const report = getElectionAtlasDiscrepancyReport();
  const slices = report.slices.filter((slice) => {
    if (slice.selection?.state !== selection.state) {
      return false;
    }

    if (slice.selection?.house !== selection.house) {
      return false;
    }

    if (Number.isFinite(selection.year) && slice.selection?.year !== selection.year) {
      return false;
    }

    return true;
  });

  return {
    selection,
    generatedAt: report.generatedAt,
    thresholds: report.thresholds,
    stats: report.stats,
    slices
  };
}

export function getElectionAtlasStateSummaryMartData(filters = {}) {
  const selection = normalizeSelection(filters);
  const mart = getStateSummaryMart(selection);

  return {
    selection,
    available: Boolean(mart),
    mart: mart ?? null
  };
}

export function getElectionAtlasPartyTrendData(filters = {}) {
  const selection = normalizeSelection(filters);
  const mart = getPartyTrendMart(selection);

  return {
    selection,
    available: Boolean(mart),
    mart: mart ?? null
  };
}

export function getElectionAtlasBootstrap(filters = {}, options = {}) {
  const selection = normalizeSelection(filters);
  const pipeline = getElectionAtlasPipeline();
  const minimal = options.minimal !== false;

  if (minimal) {
    const summaryResponse = getElectionAtlasSummary(selection);

    return {
      meta: {
        ...meta,
        lastUpdated: new Date(meta.lastUpdated).toISOString()
      },
      states: listElectionAtlasStates(),
      selection: summaryResponse.selection,
      pipeline,
      elections: listElectionAtlasElections(selection).elections,
      summary: summaryResponse.summary,
      constituencies: {
        selection,
        coverage: {
          liveRows: 0,
          seededRows: 0,
          note: pipeline.coverageNote
        },
        constituencies: []
      },
      districts: {
        selection,
        coverage: {
          liveRows: 0,
          note:
            selection.house === "VS"
              ? "District intelligence will load after the initial route refresh."
              : "District intelligence is intentionally hidden for Lok Sabha overview."
        },
        metrics: {},
        districts: []
      }
    };
  }

  const summaryResponse = getElectionAtlasSummary(selection);

  return {
    meta: {
      ...meta,
      lastUpdated: new Date(meta.lastUpdated).toISOString()
    },
    states: listElectionAtlasStates(),
    selection: summaryResponse.selection,
    pipeline: summaryResponse.pipeline,
    elections: listElectionAtlasElections(selection).elections,
    summary: summaryResponse.summary,
    constituencies: listElectionAtlasConstituencies(selection),
    districts: listElectionAtlasDistricts(selection)
  };
}

export function prewarmElectionAtlasStore() {
  const selection = getElectionAtlasDefaultSelection();

  getElectionAtlasPipeline();
  listElectionAtlasStates();
  listElectionAtlasElections(selection);
  getElectionAtlasSummary(selection);
  listElectionAtlasConstituencies(selection);

  if (selection.house === "VS") {
    listElectionAtlasDistricts(selection);
  }
}
