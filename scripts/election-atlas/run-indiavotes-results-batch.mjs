import path from "node:path";

import { ensureDir, projectRoot, timestampSlug, writeArtifact } from "./shared.mjs";
import { extractIndiaVotesResults } from "./indiavotes-results-lib.mjs";
import { createIndiaVotesBatchPlan } from "./plan-indiavotes-results-batch.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const resultsDir = path.join(stagingDir, "results");

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
  const limit = Number.parseInt(get("--limit") ?? "", 10);
  const delayMs = Number.parseInt(get("--delay-ms") ?? "", 10);

  return {
    scope,
    house,
    years,
    states,
    limit: Number.isFinite(limit) ? limit : null,
    delayMs: Number.isFinite(delayMs) ? delayMs : 180,
    overwrite: argv.includes("--overwrite")
  };
}

async function pause(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fileExists(filePath) {
  try {
    await import("node:fs/promises").then(({ access }) => access(filePath));
    return true;
  } catch {
    return false;
  }
}

export async function runIndiaVotesBatch(options = {}) {
  await ensureDir(stagingDir);
  await ensureDir(resultsDir);

  const plan = await createIndiaVotesBatchPlan(options);
  const captureTimestamp = timestampSlug();
  const captureDir = path.join(projectRoot, "data", "raw", "indiavotes", captureTimestamp);
  await ensureDir(captureDir);

  const results = [];

  for (const job of plan.jobs) {
    const stagingPath = path.join(resultsDir, `${job.fileStem}.json`);
    const result = {
      ...job,
      stagingPath,
      startedAt: new Date().toISOString(),
      status: "pending"
    };

    if (!options.overwrite && (await fileExists(stagingPath))) {
      result.status = "skipped";
      result.reason = "staged-result-exists";
      result.finishedAt = new Date().toISOString();
      results.push(result);
      continue;
    }

    try {
      const extracted = await extractIndiaVotesResults(
        {
          house: job.house,
          year: job.year,
          electionId: job.electionId,
          stateId: job.stateId,
          stateLabel: job.stateLabel,
          stateSlug: job.canonicalStateSlug,
          stateVersionSlug: job.stateVersionSlug,
          geographyVersionId: job.geographyVersionId
        },
        {
          timestamp: captureTimestamp,
          outputDir: captureDir,
          stagingDir: resultsDir,
          fileStem: job.fileStem
        }
      );

      result.status = "ok";
      result.finishedAt = new Date().toISOString();
      result.rowCount = extracted.rowCount;
      result.rawPath = extracted.rawPath;
      results.push(result);
    } catch (error) {
      result.status = "error";
      result.finishedAt = new Date().toISOString();
      result.error = {
        name: error.name,
        message: error.message
      };
      results.push(result);
    }

    await pause(options.delayMs ?? 180);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    captureDirectory: captureDir,
    options: {
      scope: options.scope ?? "current",
      house: options.house ?? "both",
      years: options.years ?? "latest",
      states: options.states ?? [],
      limit: options.limit ?? null,
      overwrite: Boolean(options.overwrite),
      delayMs: options.delayMs ?? 180
    },
    stats: {
      plannedJobs: plan.jobs.length,
      completedJobs: results.filter((item) => item.status === "ok").length,
      skippedJobs: results.filter((item) => item.status === "skipped").length,
      failedJobs: results.filter((item) => item.status === "error").length,
      uniqueSelectionKeys: new Set(results.map((item) => item.selectionKey)).size
    },
    jobs: results
  };

  const outputPath = await writeArtifact(stagingDir, "indiavotes-results-manifest", summary);

  return {
    outputPath,
    summary
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const { outputPath, summary } = await runIndiaVotesBatch(options);

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
