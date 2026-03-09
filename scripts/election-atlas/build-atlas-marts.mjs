import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { ensureDir, projectRoot, readJson, writeJson } from "./shared.mjs";
import {
  buildAlignedRowIndex,
  buildOverlapPairs,
  createSeatKey,
  findAlignedRow,
  getSelectionFromSlice,
  prettifyLabel,
  resolvePartyAlias,
  slugifyText
} from "./build-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const rawIndiaVotesDir = path.join(projectRoot, "data", "raw", "indiavotes");
const resultsDir = path.join(stagingDir, "results");
const detailsDir = path.join(stagingDir, "details");
const lokdhabaDir = path.join(stagingDir, "lokdhaba-results");
const resultsIndexPath = path.join(stagingDir, "results-index.json");
const lokdhabaIndexPath = path.join(stagingDir, "lokdhaba-results-index.json");
const partyNormalizationPath = path.join(projectRoot, "config", "election-atlas", "party-normalization.json");
const partyAliasMapPath = path.join(projectRoot, "config", "election-atlas", "party-alias-map.json");
const constituencyNameMapPath = path.join(projectRoot, "config", "election-atlas", "constituency-name-map.json");
const stateSummaryMartsPath = path.join(stagingDir, "state-summary-marts.json");
const partyTrendMartsPath = path.join(stagingDir, "party-trend-marts.json");
const constituencyDetailIndexPath = path.join(stagingDir, "constituency-detail-index.json");

function normalizePartyLabel(value, selection, aliases, partyNormalization) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "Unknown";
  }

  return resolvePartyAlias(normalized, selection, aliases, partyNormalization) || "Unknown";
}

function buildConstituencyLookup(entries = []) {
  const bySeat = new Map();

  entries.forEach((entry) => {
    const key = `${entry.selectionKey}::${entry.house}::${entry.year}::${entry.constituencyNumber}`;
    bySeat.set(key, entry);
  });

  return bySeat;
}

function getCanonicalConstituency(selection, row, lookup) {
  const seatKey = `${selection.selectionKey}::${selection.house}::${selection.year}::${row.constituencyNumber}`;
  return lookup.get(seatKey)?.canonicalName ?? prettifyLabel(row.constituency);
}

function mergeMetricField(primaryValue, fallbackValue) {
  return primaryValue === null || primaryValue === undefined || primaryValue === ""
    ? fallbackValue ?? primaryValue
    : primaryValue;
}

function mergeTopPartyRows(primaryRows = [], fallbackRows = [], selection, partyAliases, partyNormalization) {
  const merged = new Map();

  [...fallbackRows, ...primaryRows].forEach((row) => {
    const party = normalizePartyLabel(row.party, selection, partyAliases, partyNormalization);
    const current = merged.get(party) ?? {
      party,
      seats: 0,
      seatShare: 0,
      voteShare: null
    };

    current.seats = Math.max(current.seats, Number(row.seats) || 0);
    current.seatShare = Math.max(current.seatShare, Number(row.seatShare) || 0);

    if (current.voteShare === null && Number.isFinite(row.voteShare)) {
      current.voteShare = row.voteShare;
    }

    merged.set(party, current);
  });

  return [...merged.values()].sort(
    (left, right) =>
      right.seats - left.seats ||
      (right.voteShare ?? -1) - (left.voteShare ?? -1) ||
      left.party.localeCompare(right.party)
  );
}

function choosePreferredSlice(currentSlice, nextSlice, partyAliases, partyNormalization) {
  if (!currentSlice) {
    return {
      ...nextSlice,
      freshness: {
        availableSources: [nextSlice.source],
        primaryGeneratedAt: nextSlice.generatedAt ?? null,
        secondaryGeneratedAt: null,
        martGeneratedAt: null
      }
    };
  }

  if (currentSlice.source === "lokdhaba" && nextSlice.source === "indiavotes") {
    return {
      ...currentSlice,
      coverage: {
        ...(currentSlice.coverage ?? {}),
        ...(nextSlice.coverage ?? {}),
        hasRunnerUp: currentSlice.coverage?.hasRunnerUp ?? nextSlice.coverage?.hasRunnerUp ?? false,
        hasVoteShare: currentSlice.coverage?.hasVoteShare ?? nextSlice.coverage?.hasVoteShare ?? false,
        hasAllianceSummary: currentSlice.coverage?.hasAllianceSummary ?? nextSlice.coverage?.hasAllianceSummary ?? false
      },
      metrics: {
        ...(currentSlice.metrics ?? {}),
        winnerVoteShare: mergeMetricField(currentSlice.metrics?.winnerVoteShare, nextSlice.metrics?.winnerVoteShare)
      },
      topParties: mergeTopPartyRows(
        currentSlice.topParties,
        nextSlice.topParties,
        getSelectionFromSlice(currentSlice),
        partyAliases,
        partyNormalization
      ),
      fallbackSource: nextSlice.source,
      fallbackFileName: nextSlice.fileName,
      sourceAllianceSummary: currentSlice.sourceAllianceSummary ?? nextSlice.sourceAllianceSummary ?? null,
      allianceEnrichment: currentSlice.allianceEnrichment ?? nextSlice.allianceEnrichment ?? null,
      freshness: {
        availableSources: [currentSlice.source, nextSlice.source],
        primaryGeneratedAt: currentSlice.generatedAt ?? null,
        secondaryGeneratedAt: nextSlice.generatedAt ?? null,
        martGeneratedAt: null
      }
    };
  }

  if (nextSlice.source === "lokdhaba" && currentSlice.source !== "lokdhaba") {
    return choosePreferredSlice(nextSlice, currentSlice, partyAliases, partyNormalization);
  }

  return currentSlice;
}

function buildDetailFileName(row) {
  const stateVersionSlug = row.stateVersionSlug ?? row.state ?? "";
  const seat = row.constituencyNumber ?? "na";
  return `${stateVersionSlug}-${String(row.house ?? "").toLowerCase()}-${row.year}-${seat}-${slugifyText(row.constituency)}-detail.json`;
}

function getRawDetailFileNames() {
  const fileNames = new Set();

  try {
    const captureDirs = readdirSync(rawIndiaVotesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    captureDirs.forEach((dirName) => {
      const detailsCaptureDir = path.join(rawIndiaVotesDir, dirName, "details");

      if (!existsSync(detailsCaptureDir)) {
        return;
      }

      readdirSync(detailsCaptureDir)
        .filter((fileName) => fileName.endsWith(".json"))
        .forEach((fileName) => fileNames.add(fileName));
    });
  } catch {
    return fileNames;
  }

  return fileNames;
}

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function average(values = []) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values = []) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function quantile(values = [], percentile = 0.5) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function buildAdvancedMetrics(rows = []) {
  if (rows.length === 0) {
    return null;
  }

  const turnoutValues = rows.map((row) => row.turnoutPct).filter(Number.isFinite);
  const marginValues = rows.map((row) => row.marginPct).filter(Number.isFinite);
  const winnerVoteShareValues = rows.map((row) => row.winnerVoteShare).filter(Number.isFinite);
  const enopValues = rows.map((row) => row.enop).filter(Number.isFinite);
  const totalSeats = rows.length;
  const reservationRows = rows.filter((row) => String(row.reservationType ?? "GEN").trim().toUpperCase() !== "GEN");
  const scRows = rows.filter((row) => String(row.reservationType ?? "").trim().toUpperCase() === "SC");
  const stRows = rows.filter((row) => String(row.reservationType ?? "").trim().toUpperCase() === "ST");
  const lowPluralitySeats = rows.filter((row) => Number.isFinite(row.winnerVoteShare) && row.winnerVoteShare < 40);
  const majorityWinnerSeats = rows.filter((row) => Number.isFinite(row.winnerVoteShare) && row.winnerVoteShare >= 50);
  const ultraCloseSeats = rows.filter((row) => Number.isFinite(row.marginPct) && row.marginPct < 2);
  const highFragmentationSeats = rows.filter((row) => Number.isFinite(row.enop) && row.enop >= 5);
  const reservedTurnoutValues = reservationRows.map((row) => row.turnoutPct).filter(Number.isFinite);
  const scTurnoutValues = scRows.map((row) => row.turnoutPct).filter(Number.isFinite);
  const stTurnoutValues = stRows.map((row) => row.turnoutPct).filter(Number.isFinite);
  const generalTurnoutValues = rows
    .filter((row) => String(row.reservationType ?? "GEN").trim().toUpperCase() === "GEN")
    .map((row) => row.turnoutPct)
    .filter(Number.isFinite);

  return {
    sourceNative: {
      enopAvailable: enopValues.length > 0,
      meanEnop: toFixedNumber(average(enopValues), 2),
      medianEnop: toFixedNumber(median(enopValues), 2),
      highFragmentationSeats: highFragmentationSeats.length,
      highFragmentationSeatShare:
        totalSeats > 0 ? toFixedNumber((highFragmentationSeats.length / totalSeats) * 100, 1) : null
    },
    custom: {
      lowPluralitySeats: lowPluralitySeats.length,
      lowPluralitySeatShare:
        totalSeats > 0 ? toFixedNumber((lowPluralitySeats.length / totalSeats) * 100, 1) : null,
      majorityWinnerSeats: majorityWinnerSeats.length,
      majorityWinnerSeatShare:
        totalSeats > 0 ? toFixedNumber((majorityWinnerSeats.length / totalSeats) * 100, 1) : null,
      ultraCloseSeats: ultraCloseSeats.length,
      ultraCloseSeatShare:
        totalSeats > 0 ? toFixedNumber((ultraCloseSeats.length / totalSeats) * 100, 1) : null,
      turnoutMedian: toFixedNumber(median(turnoutValues), 1),
      turnoutIqr:
        turnoutValues.length > 0
          ? toFixedNumber((quantile(turnoutValues, 0.75) ?? 0) - (quantile(turnoutValues, 0.25) ?? 0), 1)
          : null,
      turnoutRange:
        turnoutValues.length > 0
          ? toFixedNumber(Math.max(...turnoutValues) - Math.min(...turnoutValues), 1)
          : null,
      winnerVoteShareMedian: toFixedNumber(median(winnerVoteShareValues), 1),
      marginMedian: toFixedNumber(median(marginValues), 1),
      reservationMix: {
        reservedSeats: reservationRows.length,
        reservedSeatShare:
          totalSeats > 0 ? toFixedNumber((reservationRows.length / totalSeats) * 100, 1) : null,
        scSeats: scRows.length,
        stSeats: stRows.length,
        reservedTurnoutPct: toFixedNumber(average(reservedTurnoutValues), 1),
        scTurnoutPct: toFixedNumber(average(scTurnoutValues), 1),
        stTurnoutPct: toFixedNumber(average(stTurnoutValues), 1),
        generalTurnoutPct: toFixedNumber(average(generalTurnoutValues), 1)
      }
    }
  };
}

async function main() {
  await ensureDir(stagingDir);

  const resultsIndex = await readJson(resultsIndexPath);
  const lokdhabaIndex = await readJson(lokdhabaIndexPath);
  const partyNormalization = await readJson(partyNormalizationPath).catch(() => ({ aliases: {}, selectionOverrides: [] }));
  const partyAliasMap = await readJson(partyAliasMapPath).catch(() => ({ aliases: {} }));
  const constituencyNameMap = await readJson(constituencyNameMapPath).catch(() => ({ entries: [] }));
  const constituencyLookup = buildConstituencyLookup(constituencyNameMap.entries);
  const rawDetailFileNames = getRawDetailFileNames();
  const slicesByKey = new Map();

  [...(lokdhabaIndex.slices ?? []), ...(resultsIndex.slices ?? [])].forEach((slice) => {
    const key = `${slice.selectionKey}::${slice.house}::${slice.year}`;
    slicesByKey.set(
      key,
      choosePreferredSlice(
        slicesByKey.get(key),
        slice,
        partyAliasMap.aliases ?? {},
        partyNormalization
      )
    );
  });

  const stateSummarySlices = [...slicesByKey.values()]
    .map((slice) => ({
      ...slice,
      generatedAt:
        slice.generatedAt ??
        (slice.source === "lokdhaba" ? lokdhabaIndex.generatedAt : resultsIndex.generatedAt) ??
        null,
      topParties: mergeTopPartyRows(
        slice.topParties,
        [],
        getSelectionFromSlice(slice),
        partyAliasMap.aliases ?? {},
        partyNormalization
      ),
      metrics: {
        ...(slice.metrics ?? {}),
        winnerParty: normalizePartyLabel(
          slice.metrics?.winnerParty,
          getSelectionFromSlice(slice),
          partyAliasMap.aliases ?? {},
          partyNormalization
        )
      },
      freshness: {
        ...(slice.freshness ?? {}),
        primaryGeneratedAt:
          slice.freshness?.primaryGeneratedAt ??
          slice.generatedAt ??
          (slice.source === "lokdhaba" ? lokdhabaIndex.generatedAt : resultsIndex.generatedAt) ??
          null,
        secondaryGeneratedAt:
          slice.freshness?.secondaryGeneratedAt ??
          (slice.fallbackSource === "indiavotes" ? resultsIndex.generatedAt : null),
        martGeneratedAt: new Date().toISOString()
      }
    }))
    .sort((left, right) => {
      return (
        left.selectionKey.localeCompare(right.selectionKey) ||
        left.house.localeCompare(right.house) ||
        right.year - left.year
      );
    });

  const trendGroups = [...stateSummarySlices.reduce((grouped, slice) => {
    const key = `${slice.selectionKey}::${slice.house}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        state: slice.selectionKey,
        house: slice.house,
        slices: []
      });
    }

    grouped.get(key).slices.push(slice);
    return grouped;
  }, new Map()).values()]
    .map((group) => {
      const sortedSlices = group.slices.slice().sort((left, right) => left.year - right.year);
      const parties = new Map();

      sortedSlices.forEach((slice) => {
        const selection = getSelectionFromSlice(slice);

        (slice.topParties ?? []).forEach((row) => {
          const party = normalizePartyLabel(
            row.party,
            selection,
            partyAliasMap.aliases ?? {},
            partyNormalization
          );

          if (!parties.has(party)) {
            parties.set(party, {
              party,
              seatShare: [],
              voteShare: []
            });
          }

          parties.get(party).seatShare.push({
            year: slice.year,
            value: Number.isFinite(row.seatShare) ? row.seatShare : 0
          });
          parties.get(party).voteShare.push({
            year: slice.year,
            value: Number.isFinite(row.voteShare) ? row.voteShare : null
          });
        });
      });

      return {
        state: group.state,
        house: group.house,
        generatedAt: new Date().toISOString(),
        years: sortedSlices.map((slice) => slice.year),
        slices: sortedSlices.map((slice) => ({
          year: slice.year,
          source: slice.source,
          topParties: slice.topParties,
          metrics: slice.metrics,
          freshness: slice.freshness
        })),
        parties: [...parties.values()].sort((left, right) => left.party.localeCompare(right.party))
      };
    })
    .sort((left, right) => left.state.localeCompare(right.state) || left.house.localeCompare(right.house));

  const overlapMap = new Map(
    buildOverlapPairs(resultsIndex, lokdhabaIndex).map((pair) => [
      `${pair.selectionKey}::${pair.house}::${pair.year}`,
      pair.indiavotes
    ])
  );
  const detailIndexSlices = [];

  for (const slice of stateSummarySlices) {
    const payloadDir = slice.source === "lokdhaba" ? lokdhabaDir : resultsDir;
    const payload = await readJson(path.join(payloadDir, slice.fileName));
    const selection = getSelectionFromSlice(slice);
    slice.advancedMetrics = buildAdvancedMetrics(payload.rows ?? []);
    let fallbackRows = [];

    if (slice.source === "lokdhaba") {
      const fallbackSlice = overlapMap.get(`${slice.selectionKey}::${slice.house}::${slice.year}`);

      if (fallbackSlice?.fileName) {
        fallbackRows = (await readJson(path.join(resultsDir, fallbackSlice.fileName))).rows ?? [];
      }
    }

    const fallbackIndex = buildAlignedRowIndex(selection, fallbackRows);
    const seats = (payload.rows ?? [])
      .map((row) => {
        const fallbackRow = findAlignedRow(selection, row, fallbackIndex);
        const detailFileName = fallbackRow?.detailFileName ?? buildDetailFileName({
          ...fallbackRow,
          ...row,
          stateVersionSlug: fallbackRow?.stateVersionSlug ?? row.stateVersionSlug ?? slice.stateVersionSlug ?? slice.selectionKey,
          house: selection.house,
          year: selection.year
        });

        return {
          constituencyNumber: row.constituencyNumber ?? null,
          constituency: getCanonicalConstituency(selection, row, constituencyLookup),
          constituencySlug: slugifyText(getCanonicalConstituency(selection, row, constituencyLookup)),
          winner: prettifyLabel(row.winner),
          winnerParty: normalizePartyLabel(
            row.winnerParty,
            selection,
            partyAliasMap.aliases ?? {},
            partyNormalization
          ),
          detailFileName,
          detailAvailable:
            existsSync(path.join(detailsDir, detailFileName)) || rawDetailFileNames.has(detailFileName)
        };
      })
      .sort((left, right) => {
        return (
          (left.constituencyNumber ?? Number.MAX_SAFE_INTEGER) - (right.constituencyNumber ?? Number.MAX_SAFE_INTEGER) ||
          left.constituency.localeCompare(right.constituency)
        );
      });

    detailIndexSlices.push({
      selectionKey: slice.selectionKey,
      state: slice.selectionKey,
      house: slice.house,
      year: slice.year,
      source: slice.source,
      fileName: slice.fileName,
      stateLabel: slice.stateLabel,
      generatedAt: slice.generatedAt ?? null,
      seatsWithDetail: seats.filter((seat) => seat.detailAvailable).length,
      rowCount: seats.length,
      seats
    });
  }

  await writeJson(stateSummaryMartsPath, {
    generatedAt: new Date().toISOString(),
    stats: {
      slices: stateSummarySlices.length
    },
    slices: stateSummarySlices
  });
  await writeJson(partyTrendMartsPath, {
    generatedAt: new Date().toISOString(),
    stats: {
      groups: trendGroups.length
    },
    groups: trendGroups
  });
  await writeJson(constituencyDetailIndexPath, {
    generatedAt: new Date().toISOString(),
    stats: {
      slices: detailIndexSlices.length,
      seats: detailIndexSlices.reduce((sum, slice) => sum + slice.rowCount, 0),
      seatsWithDetail: detailIndexSlices.reduce((sum, slice) => sum + slice.seatsWithDetail, 0)
    },
    slices: detailIndexSlices
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputs: {
          stateSummaryMartsPath,
          partyTrendMartsPath,
          constituencyDetailIndexPath
        },
        stats: {
          slices: stateSummarySlices.length,
          trendGroups: trendGroups.length,
          detailSlices: detailIndexSlices.length
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
