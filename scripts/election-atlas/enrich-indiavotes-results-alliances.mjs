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
  extractIndiaVotesAllianceFragment,
  extractIndiaVotesAlliancePartywiseDetail,
  slugify
} from "./indiavotes-results-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const resultsDir = path.join(stagingDir, "results");
const manifestPath = path.join(stagingDir, "indiavotes-alliance-enrichment-manifest.json");

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
    delayMs: Number.isFinite(delayMs) ? delayMs : 100,
    overwrite: argv.includes("--overwrite")
  };
}

function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
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

function getPayloadSelection(payload) {
  if (payload.selection) {
    return payload.selection;
  }

  const row = payload.rows?.[0];

  if (!row) {
    return null;
  }

  return {
    state: row.state,
    stateLabel: row.stateLabel ?? row.state,
    stateVersionSlug: row.stateVersionSlug ?? row.state,
    geographyVersionId: row.geographyVersionId ?? null,
    house: row.house,
    year: row.year,
    electionId: row.electionId,
    stateId: row.stateId
  };
}

function getOthersVoteShare(pie = null) {
  if (!pie || typeof pie !== "object") {
    return null;
  }

  const matchingKey = Object.keys(pie).find((key) => String(key).trim().toUpperCase() === "OTHERS");
  const value = matchingKey ? Number(pie[matchingKey]) : Number.NaN;

  return Number.isFinite(value) ? toFixedNumber(value, 1) : null;
}

function buildAllianceRows(parsed, totalSeats) {
  const baseRows = (parsed.rows ?? [])
    .filter((row) => row.label)
    .map((row) => ({
      id: slugify(row.label),
      label: row.label,
      seats: Number.isFinite(row.seats) ? row.seats : 0,
      seatShare:
        totalSeats > 0 && Number.isFinite(row.seats)
          ? toFixedNumber((row.seats / totalSeats) * 100, 1)
          : null,
      voteShare: Number.isFinite(row.voteShare) ? toFixedNumber(row.voteShare, 1) : null,
      contestedVoteShare: Number.isFinite(row.contestedVoteShare)
        ? toFixedNumber(row.contestedVoteShare, 1)
        : null,
      parties: [],
      standalone: false
    }));
  const totalMappedSeats = baseRows.reduce((sum, row) => sum + (row.seats ?? 0), 0);
  const otherSeats = Math.max(totalSeats - totalMappedSeats, 0);
  const othersVoteShare = getOthersVoteShare(parsed.pie);

  if ((otherSeats > 0 || Number.isFinite(othersVoteShare)) && !baseRows.some((row) => row.label === "Others")) {
    baseRows.push({
      id: "others",
      label: "Others",
      seats: otherSeats,
      seatShare: totalSeats > 0 ? toFixedNumber((otherSeats / totalSeats) * 100, 1) : null,
      voteShare: othersVoteShare,
      contestedVoteShare: null,
      parties: [],
      standalone: true
    });
  }

  return baseRows.sort(
    (left, right) =>
      right.seats - left.seats ||
      (right.voteShare ?? -1) - (left.voteShare ?? -1) ||
      left.label.localeCompare(right.label)
  );
}

function buildAllianceSummary(selection, parsed, totalSeats) {
  if (!parsed.available) {
    return {
      available: false,
      source: "indiavotes",
      detailsUrl: null,
      note: "IndiaVotes does not expose an alliance block for this slice yet.",
      rows: []
    };
  }

  const rows = buildAllianceRows(parsed, totalSeats);
  const leader = rows[0] ?? null;
  const challenger = rows[1] ?? null;
  const leadGap = leader && challenger ? leader.seats - challenger.seats : leader?.seats ?? 0;
  const namedSeats = rows
    .filter((row) => row.label !== "Others")
    .reduce((sum, row) => sum + (row.seats ?? 0), 0);
  const omittedSeats = Math.max(totalSeats - namedSeats, 0);
  const note = omittedSeats > 0
    ? `Alliance read is sourced from IndiaVotes for this slice. ${omittedSeats} seat${omittedSeats === 1 ? "" : "s"} ${omittedSeats === 1 ? "remains" : "remain"} outside the named alliance blocks and ${omittedSeats === 1 ? "stays" : "stay"} under Others.`
    : "Alliance read is sourced from IndiaVotes for this slice.";

  return {
    available: rows.length > 0,
    source: "indiavotes",
    detailsUrl: parsed.detailsUrl ?? null,
    leader,
    challenger,
    leadGap,
    note,
    rows
  };
}

function normalizeLabel(value) {
  return String(value ?? "").trim().toLowerCase();
}

function mergePartywiseMembership(summary, partywise) {
  if (!summary?.available || !partywise?.rows?.length) {
    return summary;
  }

  const membership = partywise.rows.reduce((map, row) => {
    const key = normalizeLabel(row.alliance);

    if (!map.has(key)) {
      map.set(key, {
        color: row.allianceColor ?? null,
        parties: []
      });
    }

    map.get(key).parties.push({
      party: row.party,
      partyUrl: row.partyUrl ?? null,
      contested: row.contested,
      won: row.won,
      voteShare: row.voteShare,
      contestedVoteShare: row.contestedVoteShare
    });
    return map;
  }, new Map());

  const rows = summary.rows.map((row) => {
    const details = membership.get(normalizeLabel(row.label));

    if (!details) {
      return row;
    }

    const parties = details.parties.sort(
      (left, right) =>
        (right.won ?? -1) - (left.won ?? -1) ||
        (right.contested ?? -1) - (left.contested ?? -1) ||
        left.party.localeCompare(right.party)
    );

    return {
      ...row,
      color: row.color ?? details.color ?? null,
      parties
    };
  });

  const note = summary.note.replace(
    "Alliance read is sourced from IndiaVotes",
    "Alliance read and party makeup are sourced from IndiaVotes"
  );

  return {
    ...summary,
    note,
    rows,
    leader: rows.find((row) => row.id === summary.leader?.id) ?? summary.leader,
    challenger: rows.find((row) => row.id === summary.challenger?.id) ?? summary.challenger
  };
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
  const selection = getPayloadSelection(payload);

  if (!options.overwrite && payload.allianceEnrichment?.source === "indiavotes") {
    return {
      fileName,
      status: "skipped",
      reason: "alliance-enrichment-exists",
      available: Boolean(payload.sourceAllianceSummary?.available)
    };
  }

  const captureDir = path.join(
    projectRoot,
    "data",
    "raw",
    "indiavotes",
    options.captureTimestamp,
    "alliances"
  );
  await ensureDir(captureDir);

  try {
    const extracted = await extractIndiaVotesAllianceFragment(selection ?? {});
    const totalSeats = payload.rows?.length ?? 0;
    let sourceAllianceSummary = buildAllianceSummary(selection, extracted, totalSeats);
    let partywise = null;

    if (sourceAllianceSummary.available && sourceAllianceSummary.detailsUrl) {
      try {
        partywise = await extractIndiaVotesAlliancePartywiseDetail(sourceAllianceSummary.detailsUrl);
        sourceAllianceSummary = mergePartywiseMembership(sourceAllianceSummary, partywise);
      } catch {
        partywise = null;
      }
    }

    const mappedSeatTotal = sourceAllianceSummary.rows
      .filter((row) => row.label !== "Others")
      .reduce((sum, row) => sum + (row.seats ?? 0), 0);

    await writeArtifact(captureDir, `${fileName.replace(/\.json$/i, "")}-alliances`, {
      capturedAt: new Date().toISOString(),
      source: "indiavotes",
      selection,
      request: {
        method: "POST",
        url: extracted.url,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0"
        }
      },
      response: {
        ok: extracted.response.ok,
        status: extracted.response.status,
        statusText: extracted.response.statusText,
        headers: Object.fromEntries(extracted.response.headers.entries())
      },
      parsed: {
        available: sourceAllianceSummary.available,
        status: extracted.status,
        detailsUrl: sourceAllianceSummary.detailsUrl,
        rows: sourceAllianceSummary.rows,
        partywiseRows: partywise?.rows ?? []
      },
      raw: extracted.raw,
      body: extracted.body,
      detailHtml: partywise?.html ?? null
    });

    const nextPayload = {
      ...payload,
      selection,
      sourceAllianceSummary,
      allianceEnrichment: {
        generatedAt: new Date().toISOString(),
        source: "indiavotes",
        captureTimestamp: options.captureTimestamp,
        status: extracted.status,
        available: sourceAllianceSummary.available,
        rowCount: sourceAllianceSummary.rows.length,
        partyRowCount: partywise?.rows?.length ?? 0,
        mappedSeatTotal,
        omittedSeats: Math.max(totalSeats - mappedSeatTotal, 0),
        detailsUrl: sourceAllianceSummary.detailsUrl ?? null
      }
    };

    await writeJson(stagingPath, nextPayload);

    return {
      fileName,
      status: sourceAllianceSummary.available ? "ok" : "unavailable",
      available: sourceAllianceSummary.available,
      rowCount: sourceAllianceSummary.rows.length,
      mappedSeatTotal,
      omittedSeats: Math.max(totalSeats - mappedSeatTotal, 0)
    };
  } catch (error) {
    return {
      fileName,
      status: "error",
      error: error.message
    };
  } finally {
    await pause(options.delayMs);
  }
}

export async function runIndiaVotesAllianceEnrichment(options = {}) {
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
      delayMs: options.delayMs ?? 100
    },
    stats: {
      jobs: results.length,
      ok: results.filter((result) => result.status === "ok").length,
      unavailable: results.filter((result) => result.status === "unavailable").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      missing: results.filter((result) => result.status === "missing").length,
      errors: results.filter((result) => result.status === "error").length
    },
    results
  };

  await writeJson(manifestPath, summary);
  return summary;
}

const isDirectExecution = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  runIndiaVotesAllianceEnrichment(parseArgs(process.argv.slice(2)))
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
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
}
