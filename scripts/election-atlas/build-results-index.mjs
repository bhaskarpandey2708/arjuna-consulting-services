import { readdir } from "node:fs/promises";
import path from "node:path";

import { ensureDir, projectRoot, readJson, writeArtifact } from "./shared.mjs";
import { slugify } from "./indiavotes-results-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const resultsDir = path.join(stagingDir, "results");

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function buildSliceSummary(payload, catalogMap) {
  const rows = payload.rows ?? [];

  if (rows.length === 0) {
    return null;
  }

  const selection = payload.selection ?? {
    state: rows[0].state,
    stateLabel: rows[0].stateLabel,
    stateVersionSlug: rows[0].stateVersionSlug ?? slugify(rows[0].stateLabel),
    geographyVersionId: rows[0].geographyVersionId ?? null,
    house: rows[0].house,
    year: rows[0].year,
    electionId: rows[0].electionId,
    stateId: rows[0].stateId
  };
  const margins = rows.map((row) => row.marginPct).filter(Number.isFinite);
  const validTurnoutRows = rows.filter(
    (row) =>
      Number.isFinite(row.totalElectors) &&
      row.totalElectors > 0 &&
      Number.isFinite(row.totalVotes) &&
      row.totalVotes >= 0 &&
      row.totalVotes <= row.totalElectors
  );
  const totalElectors = validTurnoutRows
    .map((row) => row.totalElectors)
    .reduce((sum, value) => sum + value, 0);
  const totalVotes = validTurnoutRows
    .map((row) => row.totalVotes)
    .reduce((sum, value) => sum + value, 0);
  const turnoutPct = totalElectors > 0 ? (totalVotes / totalElectors) * 100 : null;
  const seatCounts = new Map();
  const voteShareMap = new Map(
    (payload.partyVoteShares ?? [])
      .filter((entry) => entry.party)
      .map((entry) => [entry.party, entry.voteShare])
  );

  rows.forEach((row) => {
    if (!row.winnerParty) {
      return;
    }

    seatCounts.set(row.winnerParty, (seatCounts.get(row.winnerParty) ?? 0) + 1);
  });

  const totalSeats = rows.length;
  const topParties = [...seatCounts.entries()]
    .map(([party, seats]) => ({
      party,
      seats,
      seatShare: toFixedNumber((seats / totalSeats) * 100, 1),
      voteShare: voteShareMap.get(party) ?? null
    }))
    .sort((left, right) => right.seats - left.seats || left.party.localeCompare(right.party));
  const winner = topParties[0] ?? null;
  const versionMeta = catalogMap.get(selection.stateLabel) ?? null;
  const closeContests = margins.filter((value) => value <= 5).length;
  const fragmentationBase = topParties.reduce((sum, party) => {
    const share = (party.seatShare ?? 0) / 100;
    return sum + share * share;
  }, 0);

  return {
    ...selection,
    canonicalStateName: versionMeta?.canonicalStateName ?? selection.state,
    canonicalStateSlug: versionMeta?.canonicalStateSlug ?? selection.state,
    entityType: inferEntityType(versionMeta),
    validFromYear: versionMeta?.validFromYear ?? null,
    validToYear: versionMeta?.validToYear ?? null,
    rowCount: rows.length,
    source: payload.source ?? "indiavotes",
    generatedAt: payload.generatedAt ?? null,
    coverage: {
      hasRunnerUp: rows.some((row) => row.runnerUp && row.runnerUpParty),
      hasVoteShare:
        rows.some((row) => Number.isFinite(row.winnerVoteShare)) ||
        topParties.some((party) => Number.isFinite(party.voteShare)),
      hasAllianceSummary: Boolean(payload.sourceAllianceSummary?.available)
    },
    metrics: {
      totalSeats,
      totalElectors,
      totalVotes,
      turnoutPct: toFixedNumber(turnoutPct, 1),
      winnerParty: winner?.party ?? null,
      winnerSeats: winner?.seats ?? 0,
      winnerSeatShare: winner?.seatShare ?? null,
      winnerVoteShare: winner?.voteShare ?? null,
      closeContests,
      meanMarginPct: toFixedNumber(
        margins.reduce((sum, value) => sum + value, 0) / (margins.length || 1),
        1
      ),
      medianMarginPct: toFixedNumber(median(margins), 1),
      fragmentationIndex: fragmentationBase > 0 ? toFixedNumber(1 / fragmentationBase, 2) : null
    },
    topParties,
    sourceAllianceSummary: payload.sourceAllianceSummary ?? null,
    allianceEnrichment: payload.allianceEnrichment ?? null
  };
}

function buildCatalogMap(catalog) {
  return new Map((catalog.stateVersions ?? []).map((version) => [version.sourceLabel, version]));
}

function inferEntityType(versionMeta) {
  if (typeof versionMeta?.validToYear === "number") {
    return "historic";
  }

  if (versionMeta?.entityType === "historic") {
    return "historic";
  }

  return "current";
}

function detectAmbiguousCanonicalStates(slices) {
  const collisions = new Map();

  slices.forEach((slice) => {
    const key = `${slice.canonicalStateSlug}::${slice.house}::${slice.year}`;

    if (!collisions.has(key)) {
      collisions.set(key, new Set());
    }

    collisions.get(key).add(slice.stateLabel);
  });

  const ambiguous = new Set();

  collisions.forEach((labels, key) => {
    if (labels.size > 1) {
      ambiguous.add(key.split("::")[0]);
    }
  });

  return ambiguous;
}

function buildInventoryStates(slices, ambiguousCanonicalStates) {
  const grouped = new Map();

  slices.forEach((slice) => {
    const selectionKey = ambiguousCanonicalStates.has(slice.canonicalStateSlug)
      ? slice.stateVersionSlug
      : slice.canonicalStateSlug;
    const displayName = ambiguousCanonicalStates.has(slice.canonicalStateSlug)
      ? slice.stateLabel
      : slice.canonicalStateName;

    if (!grouped.has(selectionKey)) {
      grouped.set(selectionKey, {
        slug: selectionKey,
        name: displayName,
        description: `IndiaVotes constituency-result coverage for ${displayName}.`,
        defaultHouse: slice.house,
        defaultYearByHouse: {},
        yearsByHouse: {
          VS: [],
          LS: []
        },
        sourceLabels: new Set(),
        ambiguousCanonicalGroup: ambiguousCanonicalStates.has(slice.canonicalStateSlug)
      });
    }

    const group = grouped.get(selectionKey);
    group.sourceLabels.add(slice.stateLabel);

    if (!group.yearsByHouse[slice.house].includes(slice.year)) {
      group.yearsByHouse[slice.house].push(slice.year);
    }
  });

  return [...grouped.values()]
    .map((state) => {
      const yearsByHouse = {
        VS: state.yearsByHouse.VS.slice().sort((left, right) => right - left),
        LS: state.yearsByHouse.LS.slice().sort((left, right) => right - left)
      };
      const defaultHouse = yearsByHouse.VS.length > 0 ? "VS" : "LS";

      return {
        slug: state.slug,
        name: state.name,
        description: state.description,
        defaultHouse,
        defaultYearByHouse: {
          VS: yearsByHouse.VS[0] ?? null,
          LS: yearsByHouse.LS[0] ?? null
        },
        yearsByHouse,
        sourceLabels: [...state.sourceLabels].sort(),
        ambiguousCanonicalGroup: state.ambiguousCanonicalGroup
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function dedupeSlices(slices) {
  return [...slices
    .reduce((map, slice) => {
      const key = `${slice.stateLabel}::${slice.house}::${slice.year}`;

      if (!map.has(key)) {
        map.set(key, slice);
        return map;
      }

      const current = map.get(key);
      const currentTime = Date.parse(current.generatedAt ?? "") || 0;
      const nextTime = Date.parse(slice.generatedAt ?? "") || 0;
      map.set(key, nextTime >= currentTime ? slice : current);
      return map;
    }, new Map())
    .values()];
}

async function main() {
  await ensureDir(stagingDir);
  const catalog = await readJson(path.join(stagingDir, "state-catalog.json")).catch(() => null);
  const catalogMap = buildCatalogMap(catalog ?? { stateVersions: [] });
  const entries = await readdir(resultsDir).catch(() => []);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const slices = [];

  for (const fileName of jsonFiles) {
    const payload = await readJson(path.join(resultsDir, fileName));
    const slice = buildSliceSummary(payload, catalogMap);

    if (!slice) {
      continue;
    }

    slices.push({
      ...slice,
      fileName
    });
  }

  const uniqueSlices = dedupeSlices(slices);

  uniqueSlices.sort((left, right) => {
    return (
      left.canonicalStateName.localeCompare(right.canonicalStateName) ||
      left.house.localeCompare(right.house) ||
      right.year - left.year
    );
  });

  const ambiguousCanonicalStates = detectAmbiguousCanonicalStates(uniqueSlices);
  const indexedSlices = uniqueSlices.map((slice) => ({
    ...slice,
    selectionKey: ambiguousCanonicalStates.has(slice.canonicalStateSlug)
      ? slice.stateVersionSlug
      : slice.canonicalStateSlug
  }));
  const inventoryStates = buildInventoryStates(indexedSlices, ambiguousCanonicalStates);

  const outputPath = await writeArtifact(stagingDir, "results-index", {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    stats: {
      slices: indexedSlices.length,
      inventoryStates: inventoryStates.length,
      uniqueCanonicalStates: new Set(indexedSlices.map((slice) => slice.canonicalStateSlug)).size,
      ambiguousCanonicalStates: [...ambiguousCanonicalStates].sort(),
      allianceSlices: indexedSlices.filter((slice) => slice.coverage?.hasAllianceSummary).length
    },
    inventoryStates,
    slices: indexedSlices
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats: {
          slices: indexedSlices.length,
          inventoryStates: inventoryStates.length,
          ambiguousCanonicalStates: [...ambiguousCanonicalStates].sort()
        }
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
