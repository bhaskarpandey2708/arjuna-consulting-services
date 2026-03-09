import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir, projectRoot, readJson, writeArtifact } from "./shared.mjs";
import { slugify } from "./indiavotes-results-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");

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

  return {
    scope,
    house,
    years,
    states,
    limit: Number.isFinite(limit) ? limit : null
  };
}

function filterYears(years, version) {
  return years.filter((row) => {
    if (typeof version.validFromYear === "number" && row.year < version.validFromYear) {
      return false;
    }

    if (typeof version.validToYear === "number" && row.year > version.validToYear) {
      return false;
    }

    return true;
  });
}

function inferScope(version) {
  if (typeof version.validToYear === "number") {
    return "historic";
  }

  if (version.entityType === "historic") {
    return "historic";
  }

  return "current";
}

function limitYears(rows, mode) {
  if (mode === "all") {
    return rows;
  }

  return rows.slice(0, 1);
}

function includeVersion(version, scope, requestedStates) {
  const inferredScope = inferScope(version);

  if (scope === "current" && inferredScope !== "current") {
    return false;
  }

  if (scope === "historic" && inferredScope !== "historic") {
    return false;
  }

  if (requestedStates.length > 0) {
    return requestedStates.includes(version.canonicalStateSlug) || requestedStates.includes(slugify(version.sourceLabel));
  }

  return true;
}

function buildJobId(job) {
  return [
    job.selectionKey,
    job.house.toLowerCase(),
    job.year,
    job.stateId
  ].join("::");
}

function choosePreferredJob(left, right) {
  const leftSpecificity = typeof left.validFromYear === "number" ? left.validFromYear : -1;
  const rightSpecificity = typeof right.validFromYear === "number" ? right.validFromYear : -1;

  if (leftSpecificity !== rightSpecificity) {
    return leftSpecificity > rightSpecificity ? left : right;
  }

  if (left.stateLabel.length !== right.stateLabel.length) {
    return left.stateLabel.length > right.stateLabel.length ? left : right;
  }

  return left.stateId >= right.stateId ? left : right;
}

function buildPlan(catalog, options) {
  const jobs = [];

  for (const version of catalog.stateVersions ?? []) {
    if (!includeVersion(version, options.scope, options.states)) {
      continue;
    }

    const stateVersionSlug = slugify(version.sourceLabel);

    if ((options.house === "both" || options.house === "LS") && version.availability?.lokSabha) {
      const lsYears = limitYears(filterYears(catalog.globalElectionYears?.lokSabha ?? [], version), options.years);

      lsYears.forEach((yearRow) => {
        jobs.push({
          selectionKey: version.canonicalStateSlug,
          canonicalStateSlug: version.canonicalStateSlug,
          canonicalStateName: version.canonicalStateName,
          stateLabel: version.sourceLabel,
          stateVersionSlug,
          geographyVersionId: version.geographyVersionId,
          entityType: inferScope(version),
          validFromYear: version.validFromYear,
          validToYear: version.validToYear,
          house: "LS",
          year: yearRow.year,
          electionId: yearRow.electionId,
          stateId: version.sourceIds?.indiavotesStateId ?? null,
          priority: inferScope(version) === "current" ? 1 : 2
        });
      });
    }

    if ((options.house === "both" || options.house === "VS") && version.availability?.assembly) {
      const assemblyYears = limitYears(version.assemblyYears ?? [], options.years);

      assemblyYears.forEach((yearRow) => {
        jobs.push({
          selectionKey: version.canonicalStateSlug,
          canonicalStateSlug: version.canonicalStateSlug,
          canonicalStateName: version.canonicalStateName,
          stateLabel: version.sourceLabel,
          stateVersionSlug,
          geographyVersionId: version.geographyVersionId,
          entityType: inferScope(version),
          validFromYear: version.validFromYear,
          validToYear: version.validToYear,
          house: "VS",
          year: yearRow.year,
          electionId: yearRow.electionId,
          stateId: version.sourceIds?.indiavotesStateId ?? null,
          priority: inferScope(version) === "current" ? 1 : 2
        });
      });
    }
  }

  const dedupedJobs = [...jobs
    .filter((job) => Number.isFinite(job.stateId))
    .reduce((map, job) => {
      const dedupeKey = `${job.canonicalStateSlug}::${job.house}::${job.year}`;

      if (!map.has(dedupeKey)) {
        map.set(dedupeKey, job);
        return map;
      }

      map.set(dedupeKey, choosePreferredJob(map.get(dedupeKey), job));
      return map;
    }, new Map())
    .values()];

  const filteredJobs = dedupedJobs
    .filter((job) => Number.isFinite(job.stateId))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return (
        left.canonicalStateName.localeCompare(right.canonicalStateName) ||
        left.house.localeCompare(right.house) ||
        right.year - left.year
      );
    })
    .map((job) => ({
      ...job,
      jobId: buildJobId(job),
      fileStem: `${job.stateVersionSlug}-${job.house.toLowerCase()}-${job.year}`
    }));

  return options.limit ? filteredJobs.slice(0, options.limit) : filteredJobs;
}

export async function createIndiaVotesBatchPlan(options = {}) {
  const catalog = await readJson(path.join(stagingDir, "state-catalog.json"));
  const normalizedOptions = {
    scope: options.scope ?? "current",
    house: options.house ?? "both",
    years: options.years ?? "latest",
    states: options.states ?? [],
    limit: options.limit ?? null
  };
  const jobs = buildPlan(catalog, normalizedOptions);

  return {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    options: normalizedOptions,
    stats: {
      plannedJobs: jobs.length,
      uniqueSelectionKeys: new Set(jobs.map((job) => job.selectionKey)).size,
      lokSabhaJobs: jobs.filter((job) => job.house === "LS").length,
      vidhanSabhaJobs: jobs.filter((job) => job.house === "VS").length
    },
    jobs
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const plan = await createIndiaVotesBatchPlan(options);

  await ensureDir(stagingDir);
  const outputPath = await writeArtifact(stagingDir, "indiavotes-results-plan", plan);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats: plan.stats
      },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
}
