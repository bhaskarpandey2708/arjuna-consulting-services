import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildFetchMetadata,
  ensureDir,
  projectRoot,
  timestampSlug,
  writeArtifact
} from "./shared.mjs";

const requestPauseMs = 120;

async function loadCrosswalk() {
  const filePath = path.join(projectRoot, "config", "election-atlas", "source-crosswalk.json");
  return JSON.parse(await readFile(filePath, "utf8"));
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .trim();
}

function extractSelectInnerHtml(html, id) {
  const pattern = new RegExp(`<select[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`, "i");
  return html.match(pattern)?.[1] ?? "";
}

function extractOptions(selectHtml) {
  const options = [...selectHtml.matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)].map(
    (match) => ({
      value: match[1],
      label: decodeHtml(match[2].replace(/<[^>]+>/g, " "))
    })
  );

  const unique = new Map();

  options.forEach((option) => {
    const key = `${option.value}::${option.label}`;

    if (!unique.has(key)) {
      unique.set(key, option);
    }
  });

  return [...unique.values()];
}

function normalizeYearOptions(options) {
  return options
    .filter((option) => /^\d+$/.test(option.value) && /^\d{4}$/.test(option.label))
    .map((option) => ({
      electionId: Number.parseInt(option.value, 10),
      year: Number.parseInt(option.label, 10)
    }))
    .sort((left, right) => right.year - left.year);
}

function normalizeStateOptions(options) {
  return options
    .filter((option) => /^\d+$/.test(option.value) && option.label && option.label !== "States" && option.label !== "State")
    .map((option) => ({
      stateId: Number.parseInt(option.value, 10),
      label: option.label
    }));
}

function normalizeDistrictOptions(rows = []) {
  return rows
    .filter((row) => row && row.id && row.year && row.year !== "District")
    .map((row) => ({
      districtId: Number.parseInt(String(row.id), 10),
      label: String(row.year).trim()
    }))
    .filter((row) => Number.isFinite(row.districtId));
}

async function pause(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();

  return {
    response,
    body
  };
}

async function discoverAssemblyState(sourceConfig, stateOption) {
  const yearsEndpoint = sourceConfig.helperEndpoints.acYears.replace(
    "{stateId}",
    String(stateOption.stateId)
  );

  try {
    const yearsFetch = await fetchJson(yearsEndpoint, { method: "POST" });
    const assemblyYears = yearsFetch.body
      .filter((row) => /^\d{4}$/.test(String(row?.year ?? "")))
      .map((row) => ({
        electionId: Number.parseInt(String(row.id), 10),
        year: Number.parseInt(String(row.year), 10)
      }))
      .filter((row) => Number.isFinite(row.electionId) && Number.isFinite(row.year))
      .sort((left, right) => right.year - left.year);

    let districtInventory = {
      status: "not_available",
      districtCount: 0,
      electionId: null,
      year: null,
      districts: []
    };

    for (const yearRow of assemblyYears) {
      await pause(requestPauseMs);

      try {
        const districtsEndpoint = sourceConfig.helperEndpoints.acDistricts
          .replace("{stateId}", String(stateOption.stateId))
          .replace("{electionId}", String(yearRow.electionId));
        const districtsFetch = await fetchJson(districtsEndpoint, { method: "POST" });
        const districts = normalizeDistrictOptions(districtsFetch.body);

        if (districts.length > 0) {
          districtInventory = {
            status: "ok",
            districtCount: districts.length,
            electionId: yearRow.electionId,
            year: yearRow.year,
            districts
          };
          break;
        }

        districtInventory = {
          status: "empty",
          districtCount: 0,
          electionId: yearRow.electionId,
          year: yearRow.year,
          districts: []
        };
      } catch (error) {
        districtInventory = {
          status: "error",
          districtCount: 0,
          electionId: yearRow.electionId,
          year: yearRow.year,
          districts: [],
          error: error.message
        };
      }
    }

    return {
      stateId: stateOption.stateId,
      label: stateOption.label,
      status: "ok",
      yearsRequest: buildFetchMetadata(yearsFetch.response, yearsEndpoint),
      years: assemblyYears,
      districtInventory
    };
  } catch (error) {
    return {
      stateId: stateOption.stateId,
      label: stateOption.label,
      status: "error",
      yearsRequest: null,
      years: [],
      districtInventory: {
        status: "not_available",
        districtCount: 0,
        electionId: null,
        year: null,
        districts: []
      },
      error: error.message
    };
  }
}

async function main() {
  const crosswalk = await loadCrosswalk();
  const sourceConfig = crosswalk.sources.indiavotes;
  const timestamp = timestampSlug();
  const outputDir = path.join(projectRoot, "data", "raw", "indiavotes", timestamp);

  await ensureDir(outputDir);

  const advancedSearchResponse = await fetch(sourceConfig.advancedSearchUrl);
  const advancedSearchHtml = await advancedSearchResponse.text();
  const selectCatalog = {
    lokSabhaStates: normalizeStateOptions(extractOptions(extractSelectInnerHtml(advancedSearchHtml, "state"))),
    assemblyDistrictStates: normalizeStateOptions(
      extractOptions(extractSelectInnerHtml(advancedSearchHtml, "state_ac_dist"))
    ),
    assemblyStates: normalizeStateOptions(extractOptions(extractSelectInnerHtml(advancedSearchHtml, "stateac"))),
    stateInfoStates: normalizeStateOptions(extractOptions(extractSelectInnerHtml(advancedSearchHtml, "state_id"))),
    stateSummaryStates: normalizeStateOptions(
      extractOptions(extractSelectInnerHtml(advancedSearchHtml, "state_summary"))
    ),
    lokSabhaYears: normalizeYearOptions(extractOptions(extractSelectInnerHtml(advancedSearchHtml, "year"))),
    assemblyYears: normalizeYearOptions(extractOptions(extractSelectInnerHtml(advancedSearchHtml, "yearac")))
  };

  const assemblyStateDiscovery = [];

  for (const stateOption of selectCatalog.assemblyStates) {
    await pause(requestPauseMs);
    assemblyStateDiscovery.push(await discoverAssemblyState(sourceConfig, stateOption));
  }

  const saved = await writeArtifact(outputDir, "all-states-catalog", {
    capturedAt: new Date().toISOString(),
    source: "indiavotes",
    advancedSearch: {
      ...buildFetchMetadata(advancedSearchResponse, sourceConfig.advancedSearchUrl)
    },
    catalog: selectCatalog,
    assemblyStateDiscovery
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        saved,
        lokSabhaStateVersions: selectCatalog.lokSabhaStates.length,
        assemblyStateVersions: selectCatalog.assemblyStates.length,
        assemblyDiscoveries: assemblyStateDiscovery.length
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
