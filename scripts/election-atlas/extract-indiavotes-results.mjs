import { extractIndiaVotesResults, slugify } from "./indiavotes-results-lib.mjs";

function parseArgs(argv) {
  const get = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const house = get("--house");
  const year = Number.parseInt(get("--year") ?? "", 10);
  const electionId = Number.parseInt(get("--election-id") ?? "", 10);
  const stateId = Number.parseInt(get("--state-id") ?? "", 10);
  const stateLabel = get("--state-label");
  const stateSlug = get("--state-slug") ?? "state";

  if (!house || !stateLabel || !Number.isFinite(year) || !Number.isFinite(electionId) || !Number.isFinite(stateId)) {
    throw new Error(
      "Usage: node scripts/election-atlas/extract-indiavotes-results.mjs --house VS|LS --year 2020 --election-id 279 --state-id 58 --state-label 'Bihar [2000 Onwards]' --state-slug bihar"
    );
  }

  return {
    house,
    year,
    electionId,
    stateId,
    stateLabel,
    stateSlug
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const extracted = await extractIndiaVotesResults(
    {
      ...args,
      stateVersionSlug: slugify(args.stateLabel)
    },
    {
      fileStem: `${slugify(args.stateLabel)}-${args.house.toLowerCase()}-${args.year}`
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        rawPath: extracted.rawPath,
        stagingPath: extracted.stagingPath,
        rowCount: extracted.rowCount,
        headers: extracted.headers
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
