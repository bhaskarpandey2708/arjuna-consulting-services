import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  ensureDir,
  findLatestCaptureDir,
  projectRoot,
  readJson,
  writeArtifact
} from "./shared.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickProbeArtifactName(availableNames) {
  if (availableNames.includes("search-bihar.json")) {
    return "search-bihar.json";
  }

  if (availableNames.includes("search-bihar-error.json")) {
    return "search-bihar-error.json";
  }

  const fallback = availableNames.find((name) => name.startsWith("search-"));
  return fallback ?? null;
}

async function readLatestArtifact(baseDir, fileName) {
  const latestDir = await findLatestCaptureDir(baseDir);

  if (!latestDir) {
    return null;
  }

  try {
    return {
      directory: latestDir,
      payload: await readJson(path.join(latestDir, fileName))
    };
  } catch {
    return null;
  }
}

async function readLatestLokdhabaArtifacts() {
  const latestDir = await findLatestCaptureDir(path.join(projectRoot, "data", "raw", "lokdhaba"));

  if (!latestDir) {
    return null;
  }

  const inventory = await readJson(path.join(latestDir, "inventory.json")).catch(() => null);
  const fileNames = await readdir(latestDir).catch(() => []);
  const probeName = pickProbeArtifactName(fileNames);
  const probe = probeName ? await readJson(path.join(latestDir, probeName)).catch(() => null) : null;

  return {
    directory: latestDir,
    inventory,
    probe
  };
}

function normalizeIndiavotesYears(rawRows = []) {
  return rawRows
    .filter((row) => /^\d{4}$/.test(String(row?.year ?? "")))
    .map((row) => ({
      electionId: Number.parseInt(String(row.id), 10),
      year: Number.parseInt(String(row.year), 10)
    }))
    .filter((row) => Number.isFinite(row.electionId) && Number.isFinite(row.year))
    .sort((left, right) => right.year - left.year);
}

function normalizeDistrictRows(rawRows = [], stateSlug, electionId, year) {
  return rawRows
    .filter((row) => (row?.districtid && row?.districtname) || (row?.id && row?.year !== "District"))
    .map((row) => ({
      districtId: Number.parseInt(String(row.districtid ?? row.id), 10),
      districtName: String(row.districtname ?? row.year).trim(),
      districtSlug: slugify(row.districtname ?? row.year),
      state: stateSlug,
      house: "VS",
      electionId,
      year
    }))
    .filter((row) => Number.isFinite(row.districtId));
}

function normalizeIndiavotesBootstrap(capture, crosswalk) {
  if (!capture?.payload) {
    return {
      available: false,
      statusLabel: "Not captured yet",
      detail:
        "Run the IndiaVotes bootstrap extractor to capture Bihar state ids, Assembly year ids, and district lookup data."
    };
  }

  const payload = capture.payload;
  const stateConfig = crosswalk.states.find((state) => state.canonical === "bihar") ?? crosswalk.states[0];
  const biharYears = normalizeIndiavotesYears(payload.helperProbes?.acYears?.body);
  const selectedElectionId = Number.parseInt(
    String(payload.helperProbes?.acDistricts?.electionId ?? ""),
    10
  );
  const selectedYear =
    biharYears.find((row) => row.electionId === selectedElectionId)?.year ??
    null;
  const districts = normalizeDistrictRows(
    payload.helperProbes?.acDistricts?.body,
    stateConfig.canonical,
    selectedElectionId,
    selectedYear
  );

  return {
    available: true,
    capturedAt: payload.capturedAt,
    captureDirectory: capture.directory,
    advancedSearch: {
      url: payload.advancedSearch?.url,
      status: payload.advancedSearch?.status,
      ok: payload.advancedSearch?.ok,
      formActions: payload.advancedSearch?.formActions ?? [],
      biharOptions: payload.advancedSearch?.biharOptions ?? []
    },
    assemblyElectionYears: biharYears,
    selectedElectionId,
    selectedYear,
    districts,
    geographyVersions: stateConfig.geographyVersions.map((version) => ({
      id: version.id,
      label: version.label,
      indiavotesStateId: version.sourceIds?.indiavotesStateId ?? null,
      houses: stateConfig.houses
    })),
    statusLabel: "Bootstrap captured",
    detail: selectedYear
      ? `Bihar post-2000 mapping is live with ${biharYears.length} discovered Assembly cycles and ${districts.length} district rows for ${selectedYear}.`
      : "IndiaVotes bootstrap captured, but the selected Bihar election year still needs validation."
  };
}

function normalizeLokdhabaArtifacts(capture, crosswalk) {
  if (!capture?.inventory) {
    return {
      available: false,
      statusLabel: "Not captured yet",
      detail:
        "Run the LokDhaba extractor to save endpoint inventory and a live probe response for Bihar."
    };
  }

  const sourceConfig = crosswalk.sources.lokdhaba;
  const probeResponse = capture.probe?.response;
  const probeError = capture.probe?.error;
  const probeStatus = probeResponse?.status ?? null;
  const probeOk = Boolean(probeResponse?.ok);

  let detail = "Endpoint inventory captured.";

  if (probeResponse) {
    detail = probeOk
      ? `Search probe responded successfully with HTTP ${probeStatus}.`
      : `Search probe reached the public endpoint but returned HTTP ${probeStatus}. This source needs fallback handling before constituency ingestion.`;
  } else if (probeError) {
    detail = `Search probe failed before a response was returned: ${probeError.message}.`;
  }

  return {
    available: true,
    capturedAt: capture.inventory.capturedAt,
    captureDirectory: capture.directory,
    apiBaseUrl: sourceConfig.apiBaseUrl,
    downloadBaseUrl: sourceConfig.downloadBaseUrl,
    discoveredEndpoints: capture.inventory.discoveredEndpoints ?? sourceConfig.discoveredEndpoints,
    searchProbe: {
      endpoint: capture.probe?.request?.endpoint ?? null,
      ok: probeOk,
      status: probeStatus,
      error: probeError?.message ?? null
    },
    statusLabel: probeOk ? "Probe responded" : "Probe needs follow-through",
    detail
  };
}

function buildPipeline(indiavotes, lokdhaba) {
  const latestCapture = [indiavotes.capturedAt, lokdhaba.capturedAt]
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const stage = indiavotes.available ? "normalized-bootstrap" : "discovery-pending";
  const assemblyYears = indiavotes.assemblyElectionYears?.map((row) => row.year) ?? [];
  const districtCount = indiavotes.districts?.length ?? 0;

  return {
    stage,
    stageLabel:
      stage === "normalized-bootstrap" ? "Discovery captured and normalized" : "Seed surface with discovery pending",
    generatedAt: new Date().toISOString(),
    lastCaptureAt: latestCapture,
    sourceLabel: indiavotes.available
      ? "Seed-backed atlas with live Bihar discovery and normalization wired underneath"
      : "Illustrative Bihar seed for interface development",
    coverageNote: indiavotes.available
      ? `The UI still runs on seeded election facts, but the source layer now has real Bihar bootstrap captures, ${assemblyYears.length} discovered Assembly cycles, and ${districtCount} normalized district rows.`
      : "Seeded sample rows only. Full constituency ingestion comes in the next stage.",
    summary: indiavotes.available
      ? `Measured step 1 is complete: Bihar discovery is captured from IndiaVotes and normalized into staging while LokDhaba endpoint behavior is logged for the next adapter pass.`
      : "The atlas remains seed-backed until the first real-source bootstrap is captured.",
    nextStep:
      "Capture Bihar constituency-result surfaces next, then map party and constituency aliases before materializing canonical staging tables.",
    sources: [
      {
        key: "indiavotes",
        name: "IndiaVotes",
        statusLabel: indiavotes.statusLabel,
        tone: indiavotes.available ? "ready" : "pending",
        detail: indiavotes.detail
      },
      {
        key: "lokdhaba",
        name: "LokDhaba",
        statusLabel: lokdhaba.statusLabel,
        tone:
          lokdhaba.available && lokdhaba.searchProbe?.ok
            ? "ready"
            : lokdhaba.available
              ? "warning"
              : "pending",
        detail: lokdhaba.detail
      }
    ],
    stats: {
      discoveredAssemblyYears: assemblyYears,
      normalizedDistrictCount: districtCount,
      lokdhabaProbeStatus: lokdhaba.searchProbe?.status ?? null
    }
  };
}

async function loadCrosswalk() {
  return readJson(path.join(projectRoot, "config", "election-atlas", "source-crosswalk.json"));
}

async function main() {
  const crosswalk = await loadCrosswalk();
  const [indiavotesCapture, lokdhabaCapture] = await Promise.all([
    readLatestArtifact(path.join(projectRoot, "data", "raw", "indiavotes"), "bihar-bootstrap.json"),
    readLatestLokdhabaArtifacts()
  ]);

  const indiavotes = normalizeIndiavotesBootstrap(indiavotesCapture, crosswalk);
  const lokdhaba = normalizeLokdhabaArtifacts(lokdhabaCapture, crosswalk);
  const pipeline = buildPipeline(indiavotes, lokdhaba);

  await ensureDir(stagingDir);

  const bootstrapPath = await writeArtifact(stagingDir, "bihar-bootstrap", {
    state: "bihar",
    normalizedAt: new Date().toISOString(),
    crosswalkVersion: crosswalk.version,
    indiavotes,
    lokdhaba,
    pipeline
  });

  const statusPath = await writeArtifact(stagingDir, "pipeline-status", pipeline);

  console.log(
    JSON.stringify(
      {
        ok: true,
        bootstrapPath,
        statusPath,
        stage: pipeline.stage,
        discoveredAssemblyYears: pipeline.stats.discoveredAssemblyYears,
        districtCount: pipeline.stats.normalizedDistrictCount,
        lokdhabaProbeStatus: pipeline.stats.lokdhabaProbeStatus
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
