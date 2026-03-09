import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildFetchMetadata,
  ensureDir,
  projectRoot,
  timestampSlug,
  writeArtifact
} from "./shared.mjs";

async function loadCrosswalk() {
  const filePath = path.join(projectRoot, "config", "election-atlas", "source-crosswalk.json");
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const query = process.argv.includes("--query")
    ? process.argv[process.argv.indexOf("--query") + 1]
    : "Bihar";
  const crosswalk = await loadCrosswalk();
  const timestamp = timestampSlug();
  const outputDir = path.join(projectRoot, "data", "raw", "lokdhaba", timestamp);
  const sourceConfig = crosswalk.sources.lokdhaba;
  const endpoint = `${sourceConfig.apiBaseUrl}${sourceConfig.discoveredEndpoints.searchResults}`;

  await ensureDir(outputDir);
  await writeArtifact(outputDir, "inventory", {
    capturedAt: new Date().toISOString(),
    source: "lokdhaba",
    siteUrl: sourceConfig.siteUrl,
    apiBaseUrl: sourceConfig.apiBaseUrl,
    repoUrl: sourceConfig.repoUrl,
    codebookUrl: sourceConfig.codebookUrl,
    discoveredEndpoints: sourceConfig.discoveredEndpoints
  });

  const payload = { Query: query };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: sourceConfig.siteUrl,
        Referer: sourceConfig.siteUrl
      },
      body: JSON.stringify(payload)
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    const filePath = await writeArtifact(outputDir, "search-bihar", {
      capturedAt: new Date().toISOString(),
      source: "lokdhaba",
      probe: "searchResults",
      request: {
        method: "POST",
        endpoint,
        payload
      },
      response: {
        ...buildFetchMetadata(response, endpoint),
        body
      }
    });

    console.log(
      JSON.stringify(
        {
          ok: response.ok,
          status: response.status,
          saved: filePath
        },
        null,
        2
      )
    );
  } catch (error) {
    const filePath = await writeArtifact(outputDir, "search-bihar-error", {
      capturedAt: new Date().toISOString(),
      source: "lokdhaba",
      probe: "searchResults",
      request: {
        method: "POST",
        endpoint,
        payload
      },
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    console.log(
      JSON.stringify(
        {
          ok: false,
          error: error.message,
          saved: filePath
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

main();
