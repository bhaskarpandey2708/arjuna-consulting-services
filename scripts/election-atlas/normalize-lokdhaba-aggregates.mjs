import { createReadStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";

import { findLatestCaptureDir, projectRoot, readJson, writeJson } from "./shared.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const lokdhabaOutputDir = path.join(stagingDir, "lokdhaba-results");
const lokdhabaIndexPath = path.join(stagingDir, "lokdhaba-results-index.json");
const rawLokdhabaDir = path.join(projectRoot, "data", "raw", "lokdhaba");
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

function prettifyStateName(rawValue) {
  return String(rawValue ?? "")
    .replaceAll("_", " ")
    .replaceAll(" ,", ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replaceAll(",", "");
  const parsed = Number.parseFloat(normalized);
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

function buildSelectionKey(stateSlug, house, year) {
  return `${stateSlug}__${house}__${year}`;
}

function buildSliceFileName(stateSlug, house, year) {
  return `${stateSlug}-${house.toLowerCase()}-${year}.json`;
}

function canonicalizeState(rawStateName, mappings) {
  const prettyName = prettifyStateName(rawStateName);
  const aliasName = mappings.aliases.get(prettyName) ?? prettyName;
  const currentMatch = mappings.indiaVotesStatesByName.get(aliasName.toLowerCase());
  const displayName = currentMatch?.name ?? aliasName;
  const slug = currentMatch?.slug ?? slugify(displayName);
  const isHistoric = !mappings.currentStates.has(displayName);

  return {
    rawStateName,
    prettyName,
    displayName,
    slug,
    isHistoric
  };
}

function createSelectionAccumulator({ stateInfo, house, year }) {
  return {
    selectionKey: buildSelectionKey(stateInfo.slug, house, year),
    state: stateInfo.slug,
    stateLabel: stateInfo.displayName,
    rawStateNames: new Set([stateInfo.rawStateName]),
    isHistoric: stateInfo.isHistoric,
    house,
    year,
    constituencyMap: new Map(),
    partyMap: new Map()
  };
}

function updatePartyAggregate(selection, record, position) {
  const partyName = record.Party?.trim() || "Independent/Unknown";
  const votes = parseNumber(record.Votes) ?? 0;
  const partyKey = partyName.toLowerCase();
  const aggregate =
    selection.partyMap.get(partyKey) ?? {
      party: partyName,
      seats: 0,
      votes: 0
    };

  aggregate.party = partyName;
  aggregate.votes += votes;

  if (position === 1) {
    aggregate.seats += 1;
  }

  selection.partyMap.set(partyKey, aggregate);
}

function updateConstituencyAggregate(selection, record, position) {
  const constituencyNo = parseNumber(record.Constituency_No);
  const pollNo = parseNumber(record.Poll_No) ?? 0;
  const constituencyName = record.Constituency_Name?.trim() || "Unknown Constituency";
  const constituencyKey = `${constituencyNo ?? constituencyName}__${pollNo}`;
  const aggregate =
    selection.constituencyMap.get(constituencyKey) ?? {
      state: selection.state,
      stateLabel: selection.stateLabel,
      house: selection.house,
      year: selection.year,
      constituency: constituencyName,
      constituencyNumber: constituencyNo,
      reservationType: record.Constituency_Type?.trim() || null,
      district: record.District_Name?.trim() || null,
      totalElectors: null,
      totalVotes: null,
      turnoutPct: null,
      marginVotes: null,
      marginPct: null,
      winner: null,
      winnerParty: null,
      winnerVotes: null,
      winnerVoteShare: null,
      runnerUp: null,
      runnerUpParty: null,
      runnerUpVotes: null,
      pollNo,
      enop: null
    };

  aggregate.constituency = aggregate.constituency || constituencyName;
  aggregate.constituencyNumber = aggregate.constituencyNumber ?? constituencyNo;
  aggregate.reservationType = aggregate.reservationType || record.Constituency_Type?.trim() || null;
  aggregate.district = aggregate.district || record.District_Name?.trim() || null;
  aggregate.totalElectors = aggregate.totalElectors ?? parseNumber(record.Electors);
  aggregate.totalVotes = aggregate.totalVotes ?? parseNumber(record.Valid_Votes);
  aggregate.turnoutPct = aggregate.turnoutPct ?? parseNumber(record.Turnout_Percentage);
  aggregate.marginVotes = aggregate.marginVotes ?? parseNumber(record.Margin);
  aggregate.marginPct = aggregate.marginPct ?? parseNumber(record.Margin_Percentage);
  aggregate.enop = aggregate.enop ?? parseNumber(record.ENOP);

  const candidateName = record.Candidate?.trim() || "Unknown Candidate";
  const partyName = record.Party?.trim() || "Independent/Unknown";
  const votes = parseNumber(record.Votes);
  const voteShare = parseNumber(record.Vote_Share_Percentage);

  if (position === 1 || (aggregate.winnerVotes === null && position !== 2)) {
    aggregate.winner = candidateName;
    aggregate.winnerParty = partyName;
    aggregate.winnerVotes = votes;
    aggregate.winnerVoteShare = voteShare;
  } else if (position === 2 || (aggregate.runnerUpVotes === null && position > 1)) {
    aggregate.runnerUp = candidateName;
    aggregate.runnerUpParty = partyName;
    aggregate.runnerUpVotes = votes;
  }

  selection.constituencyMap.set(constituencyKey, aggregate);
}

function finalizeSelection(selection) {
  const constituencies = [...selection.constituencyMap.values()].sort(
    (left, right) =>
      (left.constituencyNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.constituencyNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.constituency.localeCompare(right.constituency)
  );
  const totalSeats = constituencies.length;
  const totalElectors = constituencies.reduce((sum, row) => sum + (row.totalElectors ?? 0), 0);
  const totalVotes = constituencies.reduce((sum, row) => sum + (row.totalVotes ?? 0), 0);
  const turnoutPct =
    totalElectors > 0 ? toFixedNumber((totalVotes / totalElectors) * 100, 1) : null;
  const marginValues = constituencies
    .map((row) => row.marginPct)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const meanMarginPct = toFixedNumber(average(marginValues), 1);
  const medianMarginPct = toFixedNumber(median(marginValues), 1);
  const closeContests = constituencies.filter(
    (row) => typeof row.marginPct === "number" && row.marginPct < 5
  ).length;

  const topParties = [...selection.partyMap.values()]
    .map((party) => ({
      party: party.party,
      seats: party.seats,
      seatShare: totalSeats > 0 ? toFixedNumber((party.seats / totalSeats) * 100, 1) : 0,
      voteShare: totalVotes > 0 ? toFixedNumber((party.votes / totalVotes) * 100, 1) : null
    }))
    .sort((left, right) => right.seats - left.seats || (right.voteShare ?? 0) - (left.voteShare ?? 0));

  const winnerParty = topParties[0]?.party ?? "Unknown";
  const winnerSeats = topParties[0]?.seats ?? 0;
  const winnerSeatShare = topParties[0]?.seatShare ?? 0;
  const winnerVoteShare = topParties[0]?.voteShare ?? null;
  const fragmentationIndex =
    totalVotes > 0
      ? toFixedNumber(
          1 /
            topParties.reduce((sum, party) => {
              const share = (party.voteShare ?? 0) / 100;
              return sum + share * share;
            }, 0),
          2
        )
      : null;

  return {
    selectionKey: selection.selectionKey,
    state: selection.state,
    stateLabel: selection.stateLabel,
    house: selection.house,
    year: selection.year,
    rowCount: constituencies.length,
    isHistoric: selection.isHistoric,
    rawStateNames: [...selection.rawStateNames].sort(),
    metrics: {
      totalSeats,
      turnoutPct,
      winnerParty,
      winnerSeats,
      winnerSeatShare,
      winnerVoteShare,
      closeContests,
      meanMarginPct,
      medianMarginPct,
      fragmentationIndex
    },
    topParties,
    constituencies
  };
}

async function readAggregateFile(filePath, house, mappings, selectionMap, stateInventory) {
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

    const values = parseCsvLine(line);
    const record = buildRecord(headers, values);
    const year = parseNumber(record.Year);
    const pollNo = parseNumber(record.Poll_No) ?? 0;

    if (!year || pollNo !== 0) {
      continue;
    }

    const stateInfo = canonicalizeState(record.State_Name, mappings);
    const selectionKey = buildSelectionKey(stateInfo.slug, house, year);
    const selection =
      selectionMap.get(selectionKey) ??
      createSelectionAccumulator({
        stateInfo,
        house,
        year
      });

    selection.rawStateNames.add(stateInfo.rawStateName);
    selectionMap.set(selectionKey, selection);

    const inventory =
      stateInventory.get(stateInfo.slug) ?? {
        slug: stateInfo.slug,
        name: stateInfo.displayName,
        description: "LokDhaba historical candidate-level election coverage.",
        defaultHouse: house,
        defaultYearByHouse: {
          LS: null,
          VS: null
        },
        yearsByHouse: {
          LS: new Set(),
          VS: new Set()
        },
        sourceLabels: ["LokDhaba"]
      };

    inventory.name = inventory.name || stateInfo.displayName;
    inventory.defaultHouse = inventory.defaultHouse || house;
    inventory.yearsByHouse[house].add(year);
    stateInventory.set(stateInfo.slug, inventory);

    const position = parseNumber(record.Position);
    updateConstituencyAggregate(selection, record, position);
    updatePartyAggregate(selection, record, position);
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
    inventoryStates: [],
    stats: {}
  };

  const mappings = {
    aliases: new Map(Object.entries(stateNormalization.nameAliases ?? {})),
    currentStates: new Set(stateNormalization.currentStates ?? []),
    indiaVotesStatesByName: new Map(
      (indiaVotesIndex.inventoryStates ?? []).map((state) => [state.name.toLowerCase(), state])
    )
  };

  const filesDir = path.join(captureDir, "files");
  const aggregateFiles = [
    {
      house: "VS",
      filePath: path.join(filesDir, "All_States_AE.csv.gz")
    },
    {
      house: "LS",
      filePath: path.join(filesDir, "All_States_GE.csv.gz")
    }
  ];

  const selectionMap = new Map();
  const stateInventory = new Map();

  for (const aggregateFile of aggregateFiles) {
    await readAggregateFile(
      aggregateFile.filePath,
      aggregateFile.house,
      mappings,
      selectionMap,
      stateInventory
    );
  }

  await rm(lokdhabaOutputDir, { recursive: true, force: true });
  await mkdir(lokdhabaOutputDir, { recursive: true });

  const finalizedSelections = [...selectionMap.values()]
    .map((selection) => finalizeSelection(selection))
    .sort((left, right) =>
      left.state.localeCompare(right.state) || left.house.localeCompare(right.house) || right.year - left.year
    );

  for (const selection of finalizedSelections) {
    const fileName = buildSliceFileName(selection.state, selection.house, selection.year);
    await writeJson(path.join(lokdhabaOutputDir, fileName), {
      generatedAt: new Date().toISOString(),
      source: "lokdhaba",
      selection: {
        state: selection.state,
        house: selection.house,
        year: selection.year
      },
      rowCount: selection.constituencies.length,
      rows: selection.constituencies
    });
  }

  const inventoryStates = [...stateInventory.values()]
    .map((state) => {
      const lsYears = [...state.yearsByHouse.LS].sort((left, right) => right - left);
      const vsYears = [...state.yearsByHouse.VS].sort((left, right) => right - left);
      const defaultHouse = vsYears.length > 0 ? "VS" : "LS";

      return {
        slug: state.slug,
        name: state.name,
        description: state.description,
        defaultHouse,
        defaultYearByHouse: {
          LS: lsYears[0] ?? null,
          VS: vsYears[0] ?? null
        },
        yearsByHouse: {
          LS: lsYears,
          VS: vsYears
        },
        sourceLabels: state.sourceLabels
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const selectionSummaries = finalizedSelections.map((selection) => ({
    selectionKey: selection.state,
    source: "lokdhaba",
    fileName: buildSliceFileName(selection.state, selection.house, selection.year),
    stateLabel: selection.stateLabel,
    geographyVersionId: selection.state,
    house: selection.house,
    year: selection.year,
    rowCount: selection.rowCount,
    metrics: selection.metrics,
    topParties: selection.topParties
  }));

  const indexPayload = {
    generatedAt: new Date().toISOString(),
    source: "lokdhaba",
    sourceCaptureDirectory: captureDir,
    stats: {
      states: inventoryStates.length,
      slices: selectionSummaries.length,
      lokSabhaSlices: selectionSummaries.filter((slice) => slice.house === "LS").length,
      vidhanSabhaSlices: selectionSummaries.filter((slice) => slice.house === "VS").length,
      constituencyRows: finalizedSelections.reduce((sum, selection) => sum + selection.constituencies.length, 0)
    },
    inventoryStates,
    slices: selectionSummaries
  };

  await writeJson(lokdhabaIndexPath, indexPayload);

  console.log(
    JSON.stringify(
      {
        ok: true,
        captureDir,
        stats: indexPayload.stats,
        outputDir: lokdhabaOutputDir,
        indexPath: lokdhabaIndexPath
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
