import { createReadStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";

import { findLatestCaptureDir, projectRoot, readJson, writeJson } from "./shared.mjs";

const rawLokdhabaDir = path.join(projectRoot, "data", "raw", "lokdhaba");
const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const districtOutputDir = path.join(stagingDir, "district-marts");
const districtIndexPath = path.join(stagingDir, "district-marts-index.json");
const stateNormalizationPath = path.join(projectRoot, "config", "election-atlas", "state-normalization.json");
const indiaVotesIndexPath = path.join(stagingDir, "results-index.json");

function parseArgs(argv) {
  const args = {
    captureDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--capture-dir") {
      args.captureDir = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll(",", " ")
    .replaceAll("/", " ")
    .replaceAll("'", "")
    .replaceAll(".", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replaceAll("_", " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function prettifyLabel(rawValue) {
  const normalized = String(rawValue ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (/^[A-Z0-9\s().&/-]+$/.test(normalized)) {
    return normalized
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase());
  }

  return normalized;
}

function buildDistrictKey(value) {
  return prettifyLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function choosePreferredLabel(currentLabel, candidateLabel) {
  if (!currentLabel) {
    return candidateLabel;
  }

  const currentCompact = currentLabel.replace(/\s+/g, "");
  const candidateCompact = candidateLabel.replace(/\s+/g, "");

  if (currentCompact === candidateCompact) {
    return candidateLabel.length < currentLabel.length ? candidateLabel : currentLabel;
  }

  if (candidateLabel.includes("(") && !currentLabel.includes("(")) {
    return candidateLabel;
  }

  return currentLabel;
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
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

function quantile(values, percentile = 0.5) {
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

function buildAdvancedMetrics(rows) {
  if (rows.length === 0) {
    return null;
  }

  const turnoutValues = rows.map((row) => row.turnoutPct).filter(Number.isFinite);
  const marginValues = rows.map((row) => row.marginPct).filter(Number.isFinite);
  const winnerVoteShareValues = rows.map((row) => row.winnerVoteShare).filter(Number.isFinite);
  const enopValues = rows.map((row) => row.enop).filter(Number.isFinite);
  const totalSeats = rows.length;
  const scRows = rows.filter((row) => String(row.reservationType ?? "").trim().toUpperCase() === "SC");
  const stRows = rows.filter((row) => String(row.reservationType ?? "").trim().toUpperCase() === "ST");
  const reservedRows = rows.filter((row) => String(row.reservationType ?? "GEN").trim().toUpperCase() !== "GEN");
  const lowPluralitySeats = rows.filter((row) => Number.isFinite(row.winnerVoteShare) && row.winnerVoteShare < 40);
  const majorityWinnerSeats = rows.filter((row) => Number.isFinite(row.winnerVoteShare) && row.winnerVoteShare >= 50);
  const ultraCloseSeats = rows.filter((row) => Number.isFinite(row.marginPct) && row.marginPct < 2);
  const highFragmentationSeats = rows.filter((row) => Number.isFinite(row.enop) && row.enop >= 5);

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
        reservedSeats: reservedRows.length,
        reservedSeatShare:
          totalSeats > 0 ? toFixedNumber((reservedRows.length / totalSeats) * 100, 1) : null,
        scSeats: scRows.length,
        stSeats: stRows.length
      }
    }
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function buildRecord(headers, values) {
  const record = {};

  headers.forEach((header, index) => {
    record[header] = values[index] ?? "";
  });

  return record;
}

function buildSliceFileName(stateSlug, year) {
  return `${stateSlug}-vs-${year}.json`;
}

function canonicalizeState(rawStateName, mappings) {
  const prettyName = prettifyLabel(rawStateName);
  const aliasName = mappings.aliases.get(prettyName) ?? prettyName;
  const currentMatch = mappings.indiaVotesStatesByName.get(aliasName.toLowerCase());
  const displayName = currentMatch?.name ?? aliasName;
  const slug = currentMatch?.slug ?? slugify(displayName);
  const isHistoric = !mappings.currentStates.has(displayName);

  return {
    rawStateName,
    displayName,
    slug,
    isHistoric
  };
}

function createSelectionAccumulator({ stateInfo, year }) {
  return {
    selectionKey: `${stateInfo.slug}__VS__${year}`,
    state: stateInfo.slug,
    stateLabel: stateInfo.displayName,
    rawStateNames: new Set([stateInfo.rawStateName]),
    house: "VS",
    year,
    isHistoric: stateInfo.isHistoric,
    districtMap: new Map()
  };
}

function ensureDistrictAggregate(selection, record) {
  const rawDistrict = record.District_Name?.trim() || "Unknown District";
  const districtName = prettifyLabel(rawDistrict) || "Unknown District";
  const districtKey = buildDistrictKey(districtName) || "unknown-district";
  const district =
    selection.districtMap.get(districtKey) ?? {
      district: districtName,
      districtSlug: slugify(districtName) || "unknown-district",
      constituencyMap: new Map(),
      partyMap: new Map()
    };

  district.district = choosePreferredLabel(district.district, districtName);
  district.districtSlug = slugify(district.district) || district.districtSlug;
  selection.districtMap.set(districtKey, district);
  return district;
}

function updateDistrictAggregate(selection, record) {
  const position = parseNumber(record.Position);

  if (!position) {
    return;
  }

  const district = ensureDistrictAggregate(selection, record);
  const constituencyNo = parseNumber(record.Constituency_No);
  const constituencyName = prettifyLabel(record.Constituency_Name) || "Unknown Constituency";
  const pollNo = parseNumber(record.Poll_No) ?? 0;
  const constituencyKey = `${constituencyNo ?? constituencyName}__${pollNo}`;
  const constituency =
    district.constituencyMap.get(constituencyKey) ?? {
      constituency: constituencyName,
      constituencyNumber: constituencyNo,
      reservationType: record.Constituency_Type?.trim() || null,
      totalElectors: null,
      totalVotes: null,
      turnoutPct: null,
      marginVotes: null,
      marginPct: null,
      enop: null,
      winner: null,
      winnerParty: null,
      winnerVotes: null,
      winnerVoteShare: null
    };

  constituency.totalElectors = constituency.totalElectors ?? parseNumber(record.Electors);
  constituency.totalVotes = constituency.totalVotes ?? parseNumber(record.Valid_Votes);
  constituency.turnoutPct = constituency.turnoutPct ?? parseNumber(record.Turnout_Percentage);
  constituency.marginVotes = constituency.marginVotes ?? parseNumber(record.Margin);
  constituency.marginPct = constituency.marginPct ?? parseNumber(record.Margin_Percentage);
  constituency.enop = constituency.enop ?? parseNumber(record.ENOP);

  const candidateName = record.Candidate?.trim() || "Unknown Candidate";
  const partyName = record.Party?.trim() || "Independent/Unknown";
  const votes = parseNumber(record.Votes) ?? 0;
  const voteShare = parseNumber(record.Vote_Share_Percentage);

  if (position === 1 || (!constituency.winner && position > 0)) {
    constituency.winner = candidateName;
    constituency.winnerParty = partyName;
    constituency.winnerVotes = votes;
    constituency.winnerVoteShare = voteShare;
  }

  district.constituencyMap.set(constituencyKey, constituency);

  const partyKey = partyName.toLowerCase();
  const partyAggregate =
    district.partyMap.get(partyKey) ?? {
      party: partyName,
      seats: 0,
      votes: 0
    };

  partyAggregate.party = partyName;
  partyAggregate.votes += votes;

  if (position === 1) {
    partyAggregate.seats += 1;
  }

  district.partyMap.set(partyKey, partyAggregate);
}

function finalizeDistrictRow(district) {
  const constituencies = [...district.constituencyMap.values()].sort(
    (left, right) =>
      (left.constituencyNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.constituencyNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.constituency.localeCompare(right.constituency)
  );
  const totalSeats = constituencies.length;
  const totalElectors = constituencies.reduce((sum, row) => sum + (row.totalElectors ?? 0), 0);
  const totalVotes = constituencies.reduce((sum, row) => sum + (row.totalVotes ?? 0), 0);
  const turnoutPct = totalElectors > 0 ? toFixedNumber((totalVotes / totalElectors) * 100, 1) : null;
  const marginValues = constituencies
    .map((row) => row.marginPct)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const meanMarginPct = toFixedNumber(average(marginValues), 1);
  const medianMarginPct = toFixedNumber(median(marginValues), 1);
  const closeContests = constituencies.filter(
    (row) => typeof row.marginPct === "number" && row.marginPct < 5
  ).length;

  const topParties = [...district.partyMap.values()]
    .map((party) => ({
      party: party.party,
      seats: party.seats,
      seatShare: totalSeats > 0 ? toFixedNumber((party.seats / totalSeats) * 100, 1) : 0,
      voteShare: totalVotes > 0 ? toFixedNumber((party.votes / totalVotes) * 100, 1) : null
    }))
    .sort((left, right) => right.seats - left.seats || (right.voteShare ?? 0) - (left.voteShare ?? 0));

  return {
    district: district.district,
    districtSlug: district.districtSlug,
    totalSeats,
    turnoutPct,
    totalElectors,
    totalVotes,
    winnerParty: topParties[0]?.party ?? "Unknown",
    winnerSeats: topParties[0]?.seats ?? 0,
    winnerSeatShare: topParties[0]?.seatShare ?? 0,
    winnerVoteShare: topParties[0]?.voteShare ?? null,
    closeContests,
    meanMarginPct,
    medianMarginPct,
    advancedMetrics: buildAdvancedMetrics(constituencies),
    topParties: topParties.slice(0, 8),
    constituencies: constituencies.map((row) => ({
      constituency: row.constituency,
      constituencyNumber: row.constituencyNumber,
      reservationType: row.reservationType,
      totalElectors: row.totalElectors,
      totalVotes: row.totalVotes,
      enop: row.enop,
      winner: row.winner,
      winnerParty: row.winnerParty,
      winnerVotes: row.winnerVotes,
      winnerVoteShare: row.winnerVoteShare,
      marginVotes: row.marginVotes,
      marginPct: row.marginPct,
      turnoutPct: row.turnoutPct
    }))
  };
}

function finalizeSelection(selection) {
  const districts = [...selection.districtMap.values()]
    .map((district) => finalizeDistrictRow(district))
    .sort((left, right) => left.district.localeCompare(right.district));
  const totalSeats = districts.reduce((sum, district) => sum + district.totalSeats, 0);
  const totalElectors = districts.reduce((sum, district) => sum + (district.totalElectors ?? 0), 0);
  const totalVotes = districts.reduce((sum, district) => sum + (district.totalVotes ?? 0), 0);

  return {
    selectionKey: selection.selectionKey,
    state: selection.state,
    stateLabel: selection.stateLabel,
    house: selection.house,
    year: selection.year,
    isHistoric: selection.isHistoric,
    rawStateNames: [...selection.rawStateNames].sort(),
    rowCount: districts.length,
    metrics: {
      totalDistricts: districts.length,
      totalSeats,
      totalElectors,
      totalVotes,
      turnoutPct: totalElectors > 0 ? toFixedNumber((totalVotes / totalElectors) * 100, 1) : null,
      advancedMetrics: buildAdvancedMetrics(
        districts.flatMap((district) => district.constituencies ?? [])
      )
    },
    districts
  };
}

async function readAssemblyAggregate(filePath, mappings, selectionMap, stateInventory) {
  const input = createReadStream(filePath);
  const gunzip = createGunzip();
  const stream = input.pipe(gunzip);
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let headers = null;

  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    const record = buildRecord(headers, parseCsvLine(line));
    const year = parseNumber(record.Year);
    const pollNo = parseNumber(record.Poll_No) ?? 0;

    if (!year || pollNo !== 0) {
      continue;
    }

    const stateInfo = canonicalizeState(record.State_Name, mappings);
    const selectionKey = `${stateInfo.slug}__VS__${year}`;
    const selection =
      selectionMap.get(selectionKey) ??
      createSelectionAccumulator({
        stateInfo,
        year
      });

    selection.rawStateNames.add(stateInfo.rawStateName);
    selectionMap.set(selectionKey, selection);

    const inventory =
      stateInventory.get(stateInfo.slug) ?? {
        slug: stateInfo.slug,
        name: stateInfo.displayName,
        description: "LokDhaba district-level Assembly rollups derived from candidate rows.",
        defaultHouse: "VS",
        defaultYearByHouse: {
          LS: null,
          VS: null
        },
        yearsByHouse: {
          LS: new Set(),
          VS: new Set()
        },
        sourceLabels: ["LokDhaba District Marts"]
      };

    inventory.name = inventory.name || stateInfo.displayName;
    inventory.yearsByHouse.VS.add(year);
    stateInventory.set(stateInfo.slug, inventory);

    updateDistrictAggregate(selection, record);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const captureDir = args.captureDir
    ? path.resolve(args.captureDir)
    : await findLatestCaptureDir(rawLokdhabaDir);

  if (!captureDir) {
    throw new Error("No LokDhaba raw capture directory found.");
  }

  const stateNormalization = JSON.parse(await readFile(stateNormalizationPath, "utf8"));
  const indiaVotesIndex = (await readJson(indiaVotesIndexPath).catch(() => null)) ?? {
    inventoryStates: []
  };
  const mappings = {
    aliases: new Map(Object.entries(stateNormalization.nameAliases ?? {})),
    currentStates: new Set(stateNormalization.currentStates ?? []),
    indiaVotesStatesByName: new Map(
      (indiaVotesIndex.inventoryStates ?? []).map((state) => [state.name.toLowerCase(), state])
    )
  };

  const selectionMap = new Map();
  const stateInventory = new Map();
  const filesDir = path.join(captureDir, "files");
  const aggregateFile = path.join(filesDir, "All_States_AE.csv.gz");

  await readAssemblyAggregate(aggregateFile, mappings, selectionMap, stateInventory);

  await rm(districtOutputDir, { recursive: true, force: true });
  await mkdir(districtOutputDir, { recursive: true });

  const finalizedSelections = [...selectionMap.values()]
    .map((selection) => finalizeSelection(selection))
    .sort((left, right) => left.state.localeCompare(right.state) || right.year - left.year);

  for (const selection of finalizedSelections) {
    await writeJson(path.join(districtOutputDir, buildSliceFileName(selection.state, selection.year)), {
      generatedAt: new Date().toISOString(),
      source: "lokdhaba",
      coverage: "assembly-district-rollup",
      selection: {
        state: selection.state,
        house: selection.house,
        year: selection.year
      },
      metrics: selection.metrics,
      rowCount: selection.rowCount,
      rows: selection.districts
    });
  }

  const inventoryStates = [...stateInventory.values()]
    .map((state) => {
      const vsYears = [...state.yearsByHouse.VS].sort((left, right) => right - left);

      return {
        slug: state.slug,
        name: state.name,
        description: state.description,
        defaultHouse: "VS",
        defaultYearByHouse: {
          LS: null,
          VS: vsYears[0] ?? null
        },
        yearsByHouse: {
          LS: [],
          VS: vsYears
        },
        sourceLabels: state.sourceLabels
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const slices = finalizedSelections.map((selection) => ({
    selectionKey: selection.state,
    source: "lokdhaba",
    coverage: "assembly-district-rollup",
    fileName: buildSliceFileName(selection.state, selection.year),
    stateLabel: selection.stateLabel,
    geographyVersionId: selection.state,
    house: "VS",
    year: selection.year,
    rowCount: selection.rowCount,
    metrics: selection.metrics
  }));

  const indexPayload = {
    generatedAt: new Date().toISOString(),
    source: "lokdhaba",
    sourceCaptureDirectory: captureDir,
    stats: {
      states: inventoryStates.length,
      slices: slices.length,
      districtRows: finalizedSelections.reduce((sum, selection) => sum + selection.rowCount, 0),
      constituencyRows: finalizedSelections.reduce(
        (sum, selection) => sum + selection.districts.reduce((rowSum, district) => rowSum + district.totalSeats, 0),
        0
      )
    },
    inventoryStates,
    slices
  };

  await writeJson(districtIndexPath, indexPayload);

  console.log(
    JSON.stringify(
      {
        ok: true,
        captureDir,
        stats: indexPayload.stats,
        outputDir: districtOutputDir,
        indexPath: districtIndexPath
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
