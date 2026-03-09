import path from "node:path";
import { access } from "node:fs/promises";

import {
  ensureDir,
  projectRoot,
  readJson,
  timestampSlug,
  writeArtifact,
  writeJson
} from "./shared.mjs";
import { createIndiaVotesBatchPlan } from "./plan-indiavotes-results-batch.mjs";
import {
  extractIndiaVotesConstituencyDetail,
  slugify
} from "./indiavotes-results-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const resultsDir = path.join(stagingDir, "results");
const stagedDetailsDir = path.join(stagingDir, "details");

function parseArgs(argv) {
  const get = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const scope = get("--scope") ?? "current";
  const house = get("--house") ?? "both";
  const years = get("--years") ?? "latest";
  const states = (get("--states") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const files = (get("--files") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const limit = Number.parseInt(get("--limit") ?? "", 10);
  const delayMs = Number.parseInt(get("--delay-ms") ?? "", 10);

  return {
    scope,
    house,
    years,
    states,
    files,
    limit: Number.isFinite(limit) ? limit : null,
    delayMs: Number.isFinite(delayMs) ? delayMs : 120,
    overwrite: argv.includes("--overwrite")
  };
}

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function normalizeName(value) {
  return slugify(String(value ?? "").replace(/\b[a-z]/gi, (character) => character.toLowerCase()));
}

function namesMatch(left, right) {
  return normalizeName(left) === normalizeName(right);
}

async function pause(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildJobList(plan, requestedFiles) {
  if (requestedFiles.length > 0) {
    return requestedFiles.map((fileName) => ({
      fileName,
      fileStem: fileName.replace(/\.json$/i, ""),
      requestedDirectly: true
    }));
  }

  return plan.jobs.map((job) => ({
    ...job,
    fileName: `${job.fileStem}.json`
  }));
}

function addPartyVotes(voteMap, partyVoteTotals) {
  (partyVoteTotals ?? []).forEach((entry) => {
    if (!entry.party || !Number.isFinite(entry.votes)) {
      return;
    }

    voteMap.set(entry.party, (voteMap.get(entry.party) ?? 0) + entry.votes);
  });
}

function buildPartyVoteShares(voteMap, totalVotes) {
  return [...voteMap.entries()]
    .map(([party, votes]) => ({
      party,
      votes,
      voteShare: totalVotes > 0 ? toFixedNumber((votes / totalVotes) * 100, 1) : null
    }))
    .sort((left, right) => right.votes - left.votes || left.party.localeCompare(right.party));
}

function buildDetailFileStem(payload, row, index) {
  const selection = payload.selection ?? {};
  const baseStem = [
    selection.stateVersionSlug ?? selection.state ?? slugify(selection.stateLabel ?? "state"),
    selection.house?.toLowerCase() ?? "house",
    selection.year ?? "year",
    row.constituencyNumber ?? index + 1,
    slugify(row.constituency ?? `row-${index + 1}`)
  ]
    .filter(Boolean)
    .join("-");

  return `${baseStem}-detail`;
}

async function enrichFile(fileName, options) {
  const stagingPath = path.join(resultsDir, fileName);

  if (!(await fileExists(stagingPath))) {
    return {
      fileName,
      status: "missing",
      error: "staged-result-missing"
    };
  }

  const payload = await readJson(stagingPath);

  if (
    !options.overwrite &&
    payload.detailEnrichment?.coverage?.rowsPending === 0 &&
    (payload.partyVoteShares?.length ?? 0) > 0
  ) {
    return {
      fileName,
      status: "skipped",
      reason: "detail-enrichment-exists",
      rowCount: payload.rows?.length ?? 0
    };
  }

  const rows = payload.rows ?? [];
  const detailVoteMap = new Map();
  const failures = [];
  const captureDir = path.join(
    projectRoot,
    "data",
    "raw",
    "indiavotes",
    options.captureTimestamp,
    "details"
  );
  await ensureDir(captureDir);
  await ensureDir(stagedDetailsDir);

  const enrichedRows = [];

  for (const [index, row] of rows.entries()) {
    if (!row.constituencyUrl) {
      failures.push({
        constituency: row.constituency,
        reason: "missing-constituency-url"
      });
      enrichedRows.push({
        ...row,
        detailAvailable: Boolean(row.detailAvailable),
        detailFileName: row.detailFileName ?? null
      });
      continue;
    }

    try {
      const detail = await extractIndiaVotesConstituencyDetail(row.constituencyUrl);
      addPartyVotes(detailVoteMap, detail.partyVoteTotals);
      const detailFileStem = buildDetailFileStem(payload, row, index);
      const detailFileName = `${detailFileStem}.json`;

      const winnerMismatch =
        detail.winner?.candidate && row.winner ? !namesMatch(detail.winner.candidate, row.winner) : false;
      const partyMismatch =
        detail.winner?.party && row.winnerParty ? !namesMatch(detail.winner.party, row.winnerParty) : false;

      await writeArtifact(captureDir, detailFileStem, {
        capturedAt: new Date().toISOString(),
        source: "indiavotes",
        parentSelection: payload.selection ?? null,
        constituency: row.constituency,
        constituencyNumber: row.constituencyNumber ?? null,
        request: {
          method: "POST",
          url: detail.url,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0"
          }
        },
        response: {
          ok: detail.response.ok,
          status: detail.response.status,
          statusText: detail.response.statusText,
          headers: Object.fromEntries(detail.response.headers.entries())
        },
        parsed: {
          winner: detail.winner ?? null,
          runnerUp: detail.runnerUp ?? null,
          partyVoteTotals: detail.partyVoteTotals ?? [],
          candidateRows: detail.candidateRows ?? []
        },
        html: detail.html
      });

      await writeJson(path.join(stagedDetailsDir, detailFileName), {
        generatedAt: new Date().toISOString(),
        source: "indiavotes",
        parentSelection: payload.selection ?? null,
        constituency: row.constituency,
        constituencyNumber: row.constituencyNumber ?? null,
        district: row.district ?? null,
        reservationType: row.reservationType ?? null,
        detailFileName,
        note:
          "Local constituency detail captured from IndiaVotes and staged inside Election Atlas so the atlas no longer needs an outbound click for this seat.",
        parsed: {
          winner: detail.winner ?? null,
          runnerUp: detail.runnerUp ?? null,
          partyVoteTotals: detail.partyVoteTotals ?? [],
          candidateRows: detail.candidateRows ?? []
        }
      });

      enrichedRows.push({
        ...row,
        winnerVotes: detail.winner?.votes ?? row.winnerVotes ?? null,
        winnerVoteShare: detail.winner?.voteShare ?? row.winnerVoteShare ?? null,
        runnerUp: detail.runnerUp?.candidate ?? row.runnerUp ?? null,
        runnerUpParty: detail.runnerUp?.party ?? row.runnerUpParty ?? null,
        runnerUpVotes: detail.runnerUp?.votes ?? row.runnerUpVotes ?? null,
        runnerUpVoteShare: detail.runnerUp?.voteShare ?? row.runnerUpVoteShare ?? null,
        detailAvailable: true,
        detailFileName,
        dataQualityFlags: [
          ...(row.dataQualityFlags ?? []),
          ...(winnerMismatch ? ["winner_name_mismatch"] : []),
          ...(partyMismatch ? ["winner_party_mismatch"] : [])
        ]
      });
    } catch (error) {
      failures.push({
        constituency: row.constituency,
        reason: error.message
      });
      enrichedRows.push({
        ...row,
        detailAvailable: Boolean(row.detailAvailable),
        detailFileName: row.detailFileName ?? null
      });
    }

    await pause(options.delayMs);
  }

  const totalVotes = enrichedRows
    .map((row) => row.totalVotes)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);
  const partyVoteShares = buildPartyVoteShares(detailVoteMap, totalVotes);
  const rowsWithRunnerUp = enrichedRows.filter((row) => row.runnerUp && row.runnerUpParty).length;
  const rowsWithVoteShare = enrichedRows.filter((row) => Number.isFinite(row.winnerVoteShare)).length;

  const nextPayload = {
    ...payload,
    partyVoteShares,
    rows: enrichedRows,
    detailEnrichment: {
      generatedAt: new Date().toISOString(),
      source: "indiavotes",
      captureTimestamp: options.captureTimestamp,
      coverage: {
        rowCount: rows.length,
        rowsWithRunnerUp,
        rowsWithVoteShare,
        rowsPending: rows.length - Math.min(rowsWithRunnerUp, rowsWithVoteShare),
        failedRows: failures.length
      },
      failures: failures.slice(0, 25)
    }
  };

  await writeJson(stagingPath, nextPayload);

  return {
    fileName,
    status: failures.length > 0 ? "partial" : "ok",
    rowCount: rows.length,
    rowsWithRunnerUp,
    rowsWithVoteShare,
    partyVoteShares: partyVoteShares.length,
    failedRows: failures.length
  };
}

export async function runIndiaVotesDetailEnrichment(options = {}) {
  await ensureDir(stagingDir);
  await ensureDir(resultsDir);

  const plan = await createIndiaVotesBatchPlan(options);
  const captureTimestamp = timestampSlug();
  const jobs = buildJobList(plan, options.files ?? []);
  const limitedJobs = options.limit ? jobs.slice(0, options.limit) : jobs;
  const results = [];

  for (const job of limitedJobs) {
    results.push(
      await enrichFile(job.fileName, {
        ...options,
        captureTimestamp
      })
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    captureTimestamp,
    options: {
      scope: options.scope ?? "current",
      house: options.house ?? "both",
      years: options.years ?? "latest",
      states: options.states ?? [],
      files: options.files ?? [],
      limit: options.limit ?? null,
      overwrite: Boolean(options.overwrite),
      delayMs: options.delayMs ?? 120
    },
    stats: {
      plannedFiles: limitedJobs.length,
      completedFiles: results.filter((item) => item.status === "ok").length,
      partialFiles: results.filter((item) => item.status === "partial").length,
      skippedFiles: results.filter((item) => item.status === "skipped").length,
      missingFiles: results.filter((item) => item.status === "missing").length,
      totalRows: results.reduce((sum, item) => sum + (item.rowCount ?? 0), 0),
      rowsWithRunnerUp: results.reduce((sum, item) => sum + (item.rowsWithRunnerUp ?? 0), 0),
      rowsWithVoteShare: results.reduce((sum, item) => sum + (item.rowsWithVoteShare ?? 0), 0),
      failedRows: results.reduce((sum, item) => sum + (item.failedRows ?? 0), 0)
    },
    files: results
  };

  const outputPath = await writeArtifact(stagingDir, "indiavotes-detail-enrichment-manifest", summary);

  return {
    outputPath,
    summary
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const { outputPath, summary } = await runIndiaVotesDetailEnrichment(options);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats: summary.stats
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
