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

function extractFormActions(html) {
  return [...html.matchAll(/<form[^>]+action="([^"]+)"/g)].map((match) => match[1]);
}

function extractBiharOptions(html) {
  const matches = [...html.matchAll(/<option value="([^"]+)">([^<]*Bihar[^<]*)<\/option>/g)];
  return matches.map((match) => ({
    value: match[1],
    label: match[2]
  }));
}

async function main() {
  const crosswalk = await loadCrosswalk();
  const sourceConfig = crosswalk.sources.indiavotes;
  const biharPost =
    crosswalk.states[0].geographyVersions.find((item) => item.id === "bihar_post_2000")?.sourceIds
      ?.indiavotesStateId ?? 58;
  const timestamp = timestampSlug();
  const outputDir = path.join(projectRoot, "data", "raw", "indiavotes", timestamp);

  await ensureDir(outputDir);

  const advancedSearchResponse = await fetch(sourceConfig.advancedSearchUrl);
  const advancedSearchHtml = await advancedSearchResponse.text();
  const formActions = extractFormActions(advancedSearchHtml);
  const biharOptions = extractBiharOptions(advancedSearchHtml);

  const yearsEndpoint = sourceConfig.helperEndpoints.acYears.replace(
    "{stateId}",
    String(biharPost)
  );
  const yearsResponse = await fetch(yearsEndpoint, { method: "POST" });
  const yearsBody = await yearsResponse.json();

  const bihar2020 = yearsBody.find((entry) => entry.year === "2020")?.id;
  const districtEndpoint = sourceConfig.helperEndpoints.acDistricts
    .replace("{stateId}", String(biharPost))
    .replace("{electionId}", String(bihar2020));
  const districtResponse = await fetch(districtEndpoint, { method: "POST" });
  const districtBody = await districtResponse.json();

  const filePath = await writeArtifact(outputDir, "bihar-bootstrap", {
    capturedAt: new Date().toISOString(),
    source: "indiavotes",
    advancedSearch: {
      ...buildFetchMetadata(advancedSearchResponse, sourceConfig.advancedSearchUrl),
      biharOptions,
      formActions
    },
    helperProbes: {
      acYears: {
        ...buildFetchMetadata(yearsResponse, yearsEndpoint),
        stateId: biharPost,
        body: yearsBody
      },
      acDistricts: {
        ...buildFetchMetadata(districtResponse, districtEndpoint),
        stateId: biharPost,
        electionId: bihar2020,
        body: districtBody
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        saved: filePath,
        biharStateId: biharPost,
        yearIds: yearsBody,
        districtCount: districtBody.length
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
