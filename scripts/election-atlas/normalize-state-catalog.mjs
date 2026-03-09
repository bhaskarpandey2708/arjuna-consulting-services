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

function parseLabel(label, normalizationConfig) {
  const versionMatch = String(label).match(/\[([^\]]+)\]/);
  const versionText = versionMatch?.[1]?.trim() ?? null;
  const baseLabel = String(label).replace(/\s*\[[^\]]+\]\s*/g, "").trim();
  const canonicalStateName = normalizationConfig.nameAliases[baseLabel] ?? baseLabel;
  const currentStates = new Set(normalizationConfig.currentStates);
  const entityType = currentStates.has(canonicalStateName) ? "current" : "historic";

  let validFromYear = null;
  let validToYear = null;

  if (versionText) {
    const rangeMatch = versionText.match(/(\d{4})\s*-\s*(\d{4})/);
    const onwardsMatch = versionText.match(/(\d{4})\s*Onwards/i);

    if (rangeMatch) {
      validFromYear = Number.parseInt(rangeMatch[1], 10);
      validToYear = Number.parseInt(rangeMatch[2], 10);
    } else if (onwardsMatch) {
      validFromYear = Number.parseInt(onwardsMatch[1], 10);
    }
  }

  return {
    sourceLabel: label,
    baseLabel,
    canonicalStateName,
    canonicalStateSlug: slugify(canonicalStateName),
    versionLabel: versionText,
    geographyVersionId: versionText
      ? `${slugify(canonicalStateName)}-${slugify(versionText)}`
      : `${slugify(canonicalStateName)}-default`,
    entityType,
    validFromYear,
    validToYear
  };
}

function buildSurfaceMaps(catalog) {
  const surfaces = {
    lokSabha: new Map(),
    assembly: new Map(),
    assemblyDistrict: new Map(),
    stateInfo: new Map(),
    stateSummary: new Map()
  };

  const addOptions = (target, options) => {
    options.forEach((option) => {
      target.set(option.label, option.stateId);
    });
  };

  addOptions(surfaces.lokSabha, catalog.lokSabhaStates ?? []);
  addOptions(surfaces.assembly, catalog.assemblyStates ?? []);
  addOptions(surfaces.assemblyDistrict, catalog.assemblyDistrictStates ?? []);
  addOptions(surfaces.stateInfo, catalog.stateInfoStates ?? []);
  addOptions(surfaces.stateSummary, catalog.stateSummaryStates ?? []);

  return surfaces;
}

function buildAssemblyDiscoveryMap(discoveryRows = []) {
  const discoveryMap = new Map();

  discoveryRows.forEach((row) => {
    discoveryMap.set(row.label, row);
  });

  return discoveryMap;
}

function normalizeStateVersions(rawCatalog, normalizationConfig) {
  const surfaces = buildSurfaceMaps(rawCatalog.catalog);
  const assemblyDiscovery = buildAssemblyDiscoveryMap(rawCatalog.assemblyStateDiscovery);
  const labels = new Set();

  Object.values(surfaces).forEach((surface) => {
    [...surface.keys()].forEach((label) => labels.add(label));
  });

  return [...labels]
    .sort((left, right) => left.localeCompare(right))
    .map((label) => {
      const parsed = parseLabel(label, normalizationConfig);
      const discovery = assemblyDiscovery.get(label);
      const latestDistrictInventory =
        discovery?.districtInventory?.status === "ok"
          ? {
              year: discovery.districtInventory.year,
              electionId: discovery.districtInventory.electionId,
              districtCount: discovery.districtInventory.districtCount
            }
          : null;

      return {
        ...parsed,
        sourceIds: {
          indiavotesStateId:
            surfaces.assembly.get(label) ??
            surfaces.lokSabha.get(label) ??
            surfaces.stateSummary.get(label) ??
            surfaces.stateInfo.get(label) ??
            surfaces.assemblyDistrict.get(label) ??
            null
        },
        availability: {
          lokSabha: surfaces.lokSabha.has(label),
          assembly: surfaces.assembly.has(label),
          assemblyDistrict: surfaces.assemblyDistrict.has(label),
          stateInfo: surfaces.stateInfo.has(label),
          stateSummary: surfaces.stateSummary.has(label)
        },
        assemblyYears: discovery?.years ?? [],
        latestAssemblyElection: discovery?.years?.[0] ?? null,
        latestDistrictInventory,
        discoveryStatus: discovery ? "captured" : "not-captured"
      };
    });
}

function groupCanonicalStates(stateVersions) {
  const grouped = new Map();

  stateVersions.forEach((version) => {
    if (!grouped.has(version.canonicalStateSlug)) {
      grouped.set(version.canonicalStateSlug, {
        slug: version.canonicalStateSlug,
        name: version.canonicalStateName,
        entityType: version.entityType,
        versions: []
      });
    }

    grouped.get(version.canonicalStateSlug).versions.push({
      sourceLabel: version.sourceLabel,
      geographyVersionId: version.geographyVersionId,
      versionLabel: version.versionLabel,
      sourceIds: version.sourceIds,
      availability: version.availability,
      latestAssemblyElection: version.latestAssemblyElection,
      latestDistrictInventory: version.latestDistrictInventory
    });
  });

  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildStats(rawCatalog, stateVersions, canonicalStates) {
  return {
    lokSabhaStateVersions: rawCatalog.catalog?.lokSabhaStates?.length ?? 0,
    assemblyStateVersions: rawCatalog.catalog?.assemblyStates?.length ?? 0,
    stateSummaryVersions: rawCatalog.catalog?.stateSummaryStates?.length ?? 0,
    canonicalStates: canonicalStates.length,
    currentCanonicalStates: canonicalStates.filter((state) => state.entityType === "current").length,
    historicCanonicalEntities: canonicalStates.filter((state) => state.entityType === "historic").length,
    assemblyVersionsWithYearInventory: stateVersions.filter((version) => version.assemblyYears.length > 0)
      .length,
    versionsWithDistrictInventory: stateVersions.filter((version) => version.latestDistrictInventory).length
  };
}

async function loadLatestCatalog() {
  const latestDir = await findLatestCaptureDir(path.join(projectRoot, "data", "raw", "indiavotes"));

  if (!latestDir) {
    return null;
  }

  const payload = await readJson(path.join(latestDir, "all-states-catalog.json")).catch(() => null);

  if (!payload) {
    return null;
  }

  return {
    directory: latestDir,
    payload
  };
}

async function loadNormalizationConfig() {
  return readJson(path.join(projectRoot, "config", "election-atlas", "state-normalization.json"));
}

async function main() {
  const latestCatalog = await loadLatestCatalog();

  if (!latestCatalog) {
    throw new Error("No IndiaVotes all-states catalog artifact was found. Run atlas:extract:indiavotes:catalog first.");
  }

  const normalizationConfig = await loadNormalizationConfig();
  const stateVersions = normalizeStateVersions(latestCatalog.payload, normalizationConfig);
  const canonicalStates = groupCanonicalStates(stateVersions);
  const stats = buildStats(latestCatalog.payload, stateVersions, canonicalStates);

  await ensureDir(stagingDir);

  const outputPath = await writeArtifact(stagingDir, "state-catalog", {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    sourceCaptureDirectory: latestCatalog.directory,
    sourceCapturedAt: latestCatalog.payload.capturedAt,
    normalizationVersion: normalizationConfig.version,
    stats,
    globalElectionYears: {
      lokSabha: latestCatalog.payload.catalog?.lokSabhaYears ?? [],
      assembly: latestCatalog.payload.catalog?.assemblyYears ?? []
    },
    canonicalStates,
    stateVersions
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats
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
