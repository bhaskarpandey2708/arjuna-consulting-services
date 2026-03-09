import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { ensureDir, timestampSlug, writeArtifact, writeJson, projectRoot } from "./shared.mjs";

const lokDhabaBaseUrl = "https://lokdhaba.ashoka.edu.in";
const bundleUrl = `${lokDhabaBaseUrl}/static/js/main.chunk.js`;
const downloadUrl = `${lokDhabaBaseUrl}/downloads`;
const supportedElectionTypes = ["AE", "GE", "GA"];

function parseArgs(argv) {
  const args = {
    concurrency: 4,
    limit: null,
    electionTypes: [...supportedElectionTypes],
    states: [],
    includeAllStates: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--concurrency") {
      args.concurrency = Number.parseInt(argv[index + 1] ?? "4", 10) || 4;
      index += 1;
      continue;
    }

    if (value === "--limit") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      args.limit = Number.isFinite(parsed) ? parsed : null;
      index += 1;
      continue;
    }

    if (value === "--types") {
      const selected = String(argv[index + 1] ?? "")
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean);
      args.electionTypes = selected.filter((entry) => supportedElectionTypes.includes(entry));
      index += 1;
      continue;
    }

    if (value === "--states") {
      args.states = String(argv[index + 1] ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (value === "--exclude-all-states") {
      args.includeAllStates = false;
    }
  }

  if (args.electionTypes.length === 0) {
    args.electionTypes = [...supportedElectionTypes];
  }

  return args;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain,application/javascript,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status} ${response.statusText})`);
  }

  return response.text();
}

function extractJsonModule(bundle, moduleName) {
  const moduleMarker = `/***/ "./src/Assets/Data/${moduleName}.json":`;
  const moduleStart = bundle.indexOf(moduleMarker);

  if (moduleStart === -1) {
    throw new Error(`Could not locate ${moduleName}.json in LokDhaba bundle`);
  }

  const exportsMarker = "module.exports = ";
  const exportsStart = bundle.indexOf(exportsMarker, moduleStart);

  if (exportsStart === -1) {
    throw new Error(`Could not locate module.exports for ${moduleName}.json`);
  }

  const jsonStart = bundle.indexOf("[", exportsStart);
  const moduleEnd = bundle.indexOf("\n\n/***/ })", jsonStart);

  if (jsonStart === -1 || moduleEnd === -1) {
    throw new Error(`Could not isolate JSON payload for ${moduleName}.json`);
  }

  const jsonText = bundle.slice(jsonStart, moduleEnd).trim().replace(/;$/, "");
  return JSON.parse(jsonText);
}

function compareStateNames(left, right) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function buildJobs({ lokSabhaRows, vidhanSabhaRows, electionTypes, states, includeAllStates }) {
  const geStates = [...new Set(lokSabhaRows.map((row) => row.State_Name))].sort(compareStateNames);
  const aeStates = [...new Set(vidhanSabhaRows.map((row) => row.State_Name))].sort(compareStateNames);
  const requestedStates = new Set(states);
  const jobs = [];

  function addJob(stateName, electionType, family) {
    if (requestedStates.size > 0 && !requestedStates.has(stateName)) {
      return;
    }

    jobs.push({
      key: `${stateName}__${electionType}`,
      stateName,
      electionType,
      family,
      remotePath: `${stateName}/${stateName}_${electionType}.csv.gz`,
      url: `${downloadUrl}/${stateName}/${stateName}_${electionType}.csv.gz`
    });
  }

  if (includeAllStates) {
    electionTypes.forEach((electionType) => {
      addJob("All_States", electionType, electionType === "AE" ? "assembly" : "loksabha");
    });
  }

  if (electionTypes.includes("AE")) {
    aeStates.forEach((stateName) => addJob(stateName, "AE", "assembly"));
  }

  if (electionTypes.includes("GE")) {
    geStates.forEach((stateName) => addJob(stateName, "GE", "loksabha"));
  }

  if (electionTypes.includes("GA")) {
    geStates.forEach((stateName) => addJob(stateName, "GA", "assembly-segment"));
  }

  return jobs;
}

async function downloadJob(job, outputFilesDir) {
  const response = await fetch(job.url);
  const record = {
    key: job.key,
    stateName: job.stateName,
    electionType: job.electionType,
    family: job.family,
    url: job.url,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries())
  };

  if (!response.ok || !response.body) {
    return record;
  }

  const fileName = `${job.stateName}_${job.electionType}.csv.gz`;
  const filePath = path.join(outputFilesDir, fileName);
  const readable = Readable.fromWeb(response.body);
  const writable = createWriteStream(filePath);

  await pipeline(readable, writable);

  const fileStat = await stat(filePath);

  return {
    ...record,
    fileName,
    filePath,
    fileSize: fileStat.size
  };
}

async function runJobQueue(jobs, outputFilesDir, concurrency) {
  const pending = [...jobs];
  const results = [];

  async function worker() {
    while (pending.length > 0) {
      const job = pending.shift();

      if (!job) {
        return;
      }

      const result = await downloadJob(job, outputFilesDir).catch((error) => ({
        key: job.key,
        stateName: job.stateName,
        electionType: job.electionType,
        family: job.family,
        url: job.url,
        ok: false,
        error: {
          name: error.name,
          message: error.message
        }
      }));

      results.push(result);
      const summary = result.ok
        ? `${result.stateName}_${result.electionType}.csv.gz (${result.fileSize} bytes)`
        : `${result.stateName}_${result.electionType}.csv.gz failed (${result.status ?? result.error?.message})`;
      console.log(summary);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  );

  return results.sort((left, right) => left.key.localeCompare(right.key));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timestamp = timestampSlug();
  const outputDir = path.join(projectRoot, "data", "raw", "lokdhaba", timestamp);
  const outputFilesDir = path.join(outputDir, "files");

  await ensureDir(outputFilesDir);

  const bundle = await fetchText(bundleUrl);
  const lokSabhaRows = extractJsonModule(bundle, "LokSabhaNumber");
  const vidhanSabhaRows = extractJsonModule(bundle, "VidhanSabhaNumber");
  let jobs = buildJobs({
    lokSabhaRows,
    vidhanSabhaRows,
    electionTypes: args.electionTypes,
    states: args.states,
    includeAllStates: args.includeAllStates
  });

  if (Number.isInteger(args.limit) && args.limit > 0) {
    jobs = jobs.slice(0, args.limit);
  }

  await writeArtifact(outputDir, "inventory", {
    capturedAt: new Date().toISOString(),
    source: "lokdhaba",
    mode: "bulk-download",
    bundleUrl,
    downloadUrl,
    args,
    stats: {
      lokSabhaRows: lokSabhaRows.length,
      vidhanSabhaRows: vidhanSabhaRows.length,
      uniqueLokSabhaStates: [...new Set(lokSabhaRows.map((row) => row.State_Name))].length,
      uniqueVidhanSabhaStates: [...new Set(vidhanSabhaRows.map((row) => row.State_Name))].length,
      plannedFiles: jobs.length
    }
  });

  const results = await runJobQueue(jobs, outputFilesDir, args.concurrency);
  const okResults = results.filter((entry) => entry.ok);
  const failedResults = results.filter((entry) => !entry.ok);
  const totalBytes = okResults.reduce((sum, entry) => sum + (entry.fileSize ?? 0), 0);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "lokdhaba",
    mode: "bulk-download",
    bundleUrl,
    downloadUrl,
    args,
    stats: {
      plannedFiles: jobs.length,
      downloadedFiles: okResults.length,
      failedFiles: failedResults.length,
      totalBytes
    },
    results
  };

  await writeJson(path.join(outputDir, "downloads-manifest.json"), manifest);

  console.log(
    JSON.stringify(
      {
        ok: failedResults.length === 0,
        outputDir,
        downloadedFiles: okResults.length,
        failedFiles: failedResults.length,
        totalBytes
      },
      null,
      2
    )
  );

  if (failedResults.length > 0) {
    process.exitCode = 1;
  }
}

main();
