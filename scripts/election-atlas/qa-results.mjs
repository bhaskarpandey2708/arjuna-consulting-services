import { readdir } from "node:fs/promises";
import path from "node:path";

import { ensureDir, projectRoot, readJson, writeArtifact } from "./shared.mjs";

const resultsDir = path.join(projectRoot, "data", "staging", "election-atlas", "results");
const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const detailsDir = path.join(stagingDir, "details");
const constituencyDetailIndexPath = path.join(stagingDir, "constituency-detail-index.json");

function buildKey(row) {
  return [row.state, row.house, row.year, row.constituencyNumber ?? row.constituency].join("::");
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildOverlapLookup(indexPayload) {
  const lookup = new Map();

  for (const slice of indexPayload?.slices ?? []) {
    const key = [slice.state, slice.house, slice.year].join("::");
    const bucket = lookup.get(key) ?? [];
    bucket.push(slice);
    lookup.set(key, bucket);
  }

  return lookup;
}

function hasPrimaryWinnerFallback(row, overlapLookup) {
  const slices = overlapLookup.get([row.state, row.house, row.year].join("::")) ?? [];
  const primarySlice = slices.find((slice) => slice.source === "lokdhaba");

  if (!primarySlice) {
    return false;
  }

  const rowSlug = slugify(row.constituency);
  const seat = (primarySlice.seats ?? []).find((item) => {
    if (Number.isFinite(row.constituencyNumber) && Number.isFinite(item.constituencyNumber)) {
      return item.constituencyNumber === row.constituencyNumber;
    }

    return slugify(item.constituency) === rowSlug;
  });

  return Boolean(seat?.winner && seat?.winnerParty);
}

function isMultiMemberRunnerUpGap(detailPayload, row) {
  if (!row.runnerUp || row.runnerUpVotes !== null || row.runnerUpVoteShare !== null) {
    return false;
  }

  const candidateRows = detailPayload?.parsed?.candidateRows ?? [];
  const firstPositionRows = candidateRows.filter((candidate) => candidate.position === 1);

  return firstPositionRows.length > 1 && row.marginVotes === null && row.marginPct === null;
}

async function evaluateResultSet(fileName, rows, context) {
  const duplicateKeys = new Set();
  const seenKeys = new Set();
  const missingWinners = [];
  const turnoutOutOfRange = [];
  const marginOutOfRange = [];
  const voteShareOutOfRange = [];
  const winnerVotesOutOfRange = [];
  const runnerUpParityGaps = [];
  let primarySourceRescues = 0;
  let multiMemberRunnerUpExceptions = 0;

  for (const row of rows) {
    const key = buildKey(row);

    if (seenKeys.has(key)) {
      duplicateKeys.add(key);
    } else {
      seenKeys.add(key);
    }

    const rescuedByPrimarySource =
      (!row.winner || !row.winnerParty) && hasPrimaryWinnerFallback(row, context.overlapLookup);

    if (rescuedByPrimarySource) {
      primarySourceRescues += 1;
    }

    if ((!row.winner || !row.winnerParty) && !rescuedByPrimarySource) {
      missingWinners.push(row.constituency);
    }

    if (typeof row.turnoutPct === "number" && (row.turnoutPct < 0 || row.turnoutPct > 100)) {
      turnoutOutOfRange.push(row.constituency);
    }

    if (typeof row.marginPct === "number" && (row.marginPct < 0 || row.marginPct > 100)) {
      marginOutOfRange.push(row.constituency);
    }

    if (typeof row.winnerVoteShare === "number" && (row.winnerVoteShare < 0 || row.winnerVoteShare > 100)) {
      voteShareOutOfRange.push(row.constituency);
    }

    if (
      typeof row.winnerVotes === "number" &&
      typeof row.totalVotes === "number" &&
      (row.winnerVotes < 0 || row.winnerVotes > row.totalVotes)
    ) {
      winnerVotesOutOfRange.push(row.constituency);
    }

    const runnerUpFields = [row.runnerUp, row.runnerUpParty, row.runnerUpVotes, row.runnerUpVoteShare];
    const runnerUpPresent = runnerUpFields.filter((value) => value !== null && value !== undefined && value !== "").length;

    let detailPayload = null;

    if (runnerUpPresent > 0 && runnerUpPresent < 4 && row.detailFileName) {
      detailPayload = await readJson(path.join(detailsDir, row.detailFileName)).catch(() => null);
    }

    if (runnerUpPresent > 0 && runnerUpPresent < 4 && !isMultiMemberRunnerUpGap(detailPayload, row)) {
      runnerUpParityGaps.push(row.constituency);
    } else if (runnerUpPresent > 0 && runnerUpPresent < 4) {
      multiMemberRunnerUpExceptions += 1;
    }
  }

  return {
    file: fileName,
    rowCount: rows.length,
    duplicateCount: duplicateKeys.size,
    duplicates: [...duplicateKeys].slice(0, 10),
    missingWinnerCount: missingWinners.length,
    turnoutOutOfRangeCount: turnoutOutOfRange.length,
    marginOutOfRangeCount: marginOutOfRange.length,
    voteShareOutOfRangeCount: voteShareOutOfRange.length,
    winnerVotesOutOfRangeCount: winnerVotesOutOfRange.length,
    runnerUpParityGapCount: runnerUpParityGaps.length,
    primarySourceRescueCount: primarySourceRescues,
    multiMemberRunnerUpExceptionCount: multiMemberRunnerUpExceptions,
    ok:
      duplicateKeys.size === 0 &&
      missingWinners.length === 0 &&
      turnoutOutOfRange.length === 0 &&
      marginOutOfRange.length === 0 &&
      voteShareOutOfRange.length === 0 &&
      winnerVotesOutOfRange.length === 0 &&
      runnerUpParityGaps.length === 0
  };
}

async function main() {
  await ensureDir(stagingDir);
  const entries = await readdir(resultsDir).catch(() => []);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const reports = [];
  const overlapLookup = buildOverlapLookup(await readJson(constituencyDetailIndexPath).catch(() => ({ slices: [] })));

  for (const fileName of jsonFiles) {
    const payload = await readJson(path.join(resultsDir, fileName));
    reports.push(await evaluateResultSet(fileName, payload.rows ?? [], { overlapLookup }));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    filesChecked: reports.length,
    failingFiles: reports.filter((report) => !report.ok).map((report) => report.file),
    reports
  };

  const outputPath = await writeArtifact(stagingDir, "qa-results", summary);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        filesChecked: summary.filesChecked,
        failingFiles: summary.failingFiles
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
