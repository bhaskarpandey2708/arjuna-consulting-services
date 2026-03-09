import path from "node:path";

import { projectRoot, readJson, writeJson } from "./shared.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const discrepancyReportPath = path.join(stagingDir, "discrepancy-report.json");
const outputPath = path.join(stagingDir, "manual-review-queue.json");

const hardFindingOrder = new Map([
  ["winner-mismatch", 0],
  ["turnout-mismatch", 1],
  ["vote-share-mismatch", 2]
]);

function sortQueue(left, right) {
  const typeOrder =
    (hardFindingOrder.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
    (hardFindingOrder.get(right.type) ?? Number.MAX_SAFE_INTEGER);

  if (typeOrder !== 0) {
    return typeOrder;
  }

  if (left.selection.state !== right.selection.state) {
    return left.selection.state.localeCompare(right.selection.state);
  }

  if (left.selection.house !== right.selection.house) {
    return left.selection.house.localeCompare(right.selection.house);
  }

  if (left.selection.year !== right.selection.year) {
    return right.selection.year - left.selection.year;
  }

  return (left.seat ?? 0) - (right.seat ?? 0);
}

async function main() {
  const report = await readJson(discrepancyReportPath);
  const queue = (report.slices ?? [])
    .flatMap((slice) =>
      (slice.findings ?? [])
        .filter((finding) => hardFindingOrder.has(finding.type))
        .map((finding) => ({
          selection: slice.selection,
          primarySource: slice.sources?.primary ?? "lokdhaba",
          secondarySource: slice.sources?.secondary ?? "indiavotes",
          ...finding
        }))
    )
    .sort(sortQueue);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceReportGeneratedAt: report.generatedAt ?? null,
    stats: {
      hardConflicts: queue.length,
      winnerMismatch: queue.filter((item) => item.type === "winner-mismatch").length,
      turnoutMismatch: queue.filter((item) => item.type === "turnout-mismatch").length,
      voteShareMismatch: queue.filter((item) => item.type === "vote-share-mismatch").length
    },
    queue
  };

  await writeJson(outputPath, payload);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats: payload.stats
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
