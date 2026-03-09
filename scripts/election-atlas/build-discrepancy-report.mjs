import path from "node:path";

import { projectRoot, readJson, writeJson } from "./shared.mjs";
import {
  areCandidateLabelsCompatible,
  buildAlignedRowPairs,
  buildOverlapPairs,
  getSelectionFromSlice,
  prettifyLabel,
  resolvePartyAlias,
  toFixedNumber
} from "./build-lib.mjs";

const stagingDir = path.join(projectRoot, "data", "staging", "election-atlas");
const configDir = path.join(projectRoot, "config", "election-atlas");
const resultsDir = path.join(stagingDir, "results");
const lokdhabaDir = path.join(stagingDir, "lokdhaba-results");
const resultsIndexPath = path.join(stagingDir, "results-index.json");
const lokdhabaIndexPath = path.join(stagingDir, "lokdhaba-results-index.json");
const partyNormalizationPath = path.join(configDir, "party-normalization.json");
const partyAliasMapPath = path.join(configDir, "party-alias-map.json");
const constituencyNameMapPath = path.join(configDir, "constituency-name-map.json");
const candidateAliasMapPath = path.join(configDir, "candidate-alias-map.json");
const discrepancyPolicyPath = path.join(configDir, "discrepancy-policy.json");
const manualSeatAdjudicationsPath = path.join(configDir, "manual-seat-adjudications.json");
const outputPath = path.join(stagingDir, "discrepancy-report.json");

const defaultPolicy = {
  thresholds: {
    turnoutInfo: 2,
    turnoutActionable: 5,
    turnoutElectorateBaseVotesPctMax: 6,
    turnoutElectorateBaseElectorsPctMin: 3,
    turnoutSourceVarianceVotesPctMax: 10,
    voteShareInfo: 1,
    voteShareActionable: 2,
    voteShareWinnerVotesPctMax: 1,
    voteShareTotalVotesPctMin: 2,
    voteShareFormulaVarianceVotesPctMax: 0.1,
    voteShareFormulaVarianceTotalVotesPctMax: 0.1
  },
  notes: {
    sourceCoverageGap:
      "Rows missing from one source while present in the other are tracked as coverage gaps, not winner conflicts. The atlas keeps the primary-source row and marks the secondary gap separately.",
    turnout:
      "Seat-level turnout differences under the actionable threshold are tracked as source variance, not launch blockers.",
    turnoutElectorateBase:
      "Large turnout deltas with near-matching votes polled but materially different elector totals are tracked as electorate-base variance between sources, not ballot-count conflicts.",
    turnoutSourceVariance:
      "Turnout deltas above the headline threshold but with the same electorate base and only moderate total-vote drift are tracked as source variance, not manual-review blockers.",
    voteShare:
      "Winner vote-share differences under the actionable threshold are tracked as source variance, not launch blockers.",
    voteShareDenominator:
      "Large winner vote-share deltas with near-matching winner votes but materially different total-vote denominators are tracked as denominator variance, not winner-vote conflicts.",
    voteShareFormula:
      "Winner vote-share deltas with matching winner-vote and total-vote counts are treated as source percentage-calculation variance, not manual-review blockers."
  }
};

function normalizePartyLabel(value, selection, aliases, partyNormalization) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  return resolvePartyAlias(normalized, selection, aliases, partyNormalization);
}

function buildConstituencyLookup(entries = []) {
  const bySeat = new Map();

  entries.forEach((entry) => {
    const key = `${entry.selectionKey}::${entry.house}::${entry.year}::${entry.constituencyNumber}`;
    bySeat.set(key, entry);
  });

  return bySeat;
}

function buildCandidateLookup(entries = []) {
  const bySeat = new Map();

  entries.forEach((entry) => {
    const key = `${entry.selectionKey}::${entry.house}::${entry.year}::${entry.constituencyNumber}`;

    if (!bySeat.has(key)) {
      bySeat.set(key, []);
    }

    bySeat.get(key).push(entry);
  });

  return bySeat;
}

function normalizeConstituencyLabel(selection, row, lookup) {
  const seatKey = `${selection.selectionKey}::${selection.house}::${selection.year}::${row.constituencyNumber}`;
  return lookup.get(seatKey)?.canonicalName ?? prettifyLabel(row.constituency);
}

function normalizeCandidateLabel(selection, row, name, lookup) {
  const seatKey = `${selection.selectionKey}::${selection.house}::${selection.year}::${row.constituencyNumber}`;
  const candidates = lookup.get(seatKey) ?? [];
  const prettified = prettifyLabel(name);
  const match = candidates.find((entry) =>
    entry.aliases.some((alias) => areCandidateLabelsCompatible(alias.name, prettified))
  );

  return match?.canonicalName ?? prettified;
}

function hasDetail(row) {
  return Boolean(
    row?.runnerUp ||
    row?.runnerUpParty ||
    Number.isFinite(row?.winnerVotes) ||
    Number.isFinite(row?.winnerVoteShare) ||
    Number.isFinite(row?.runnerUpVotes) ||
    Number.isFinite(row?.runnerUpVoteShare)
  );
}

function getRelativeDelta(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right));

  if (scale <= 0) {
    return 0;
  }

  return (Math.abs(left - right) / scale) * 100;
}

function pushFinding(findings, type, seat, constituency, detail) {
  findings.push({
    type,
    seat,
    constituency,
    ...detail
  });
}

function buildAdjudicationLookup(entries = []) {
  const map = new Map();

  entries.forEach((entry) => {
    const key = `${entry.selectionKey}::${entry.house}::${entry.year}::${entry.seat}`;
    map.set(key, entry);
  });

  return map;
}

async function main() {
  const resultsIndex = await readJson(resultsIndexPath);
  const lokdhabaIndex = await readJson(lokdhabaIndexPath);
  const partyNormalization = await readJson(partyNormalizationPath).catch(() => ({ aliases: {}, selectionOverrides: [] }));
  const partyAliasMap = await readJson(partyAliasMapPath).catch(() => ({ aliases: {} }));
  const constituencyMap = await readJson(constituencyNameMapPath).catch(() => ({ entries: [] }));
  const candidateMap = await readJson(candidateAliasMapPath).catch(() => ({ entries: [] }));
  const discrepancyPolicy = await readJson(discrepancyPolicyPath).catch(() => defaultPolicy);
  const manualSeatAdjudications = await readJson(manualSeatAdjudicationsPath).catch(() => ({ entries: [] }));
  const thresholds = discrepancyPolicy.thresholds ?? defaultPolicy.thresholds;
  const overlapPairs = buildOverlapPairs(resultsIndex, lokdhabaIndex);
  const constituencyLookup = buildConstituencyLookup(constituencyMap.entries);
  const candidateLookup = buildCandidateLookup(candidateMap.entries);
  const adjudicationLookup = buildAdjudicationLookup(manualSeatAdjudications.entries);
  const slices = [];

  for (const pair of overlapPairs) {
    const indiaVotesPayload = await readJson(path.join(resultsDir, pair.indiavotes.fileName));
    const lokdhabaPayload = await readJson(path.join(lokdhabaDir, pair.lokdhaba.fileName));
    const selection = getSelectionFromSlice(pair.indiavotes);
    const { pairs: alignedRows } = buildAlignedRowPairs(
      selection,
      indiaVotesPayload.rows ?? [],
      lokdhabaPayload.rows ?? []
    );
    const findings = [];
    const counts = {
      manualAdjudication: 0,
      sourceCoverageGap: 0,
      unmatchedSeat: 0,
      winnerLabelVariation: 0,
      winnerMismatch: 0,
      turnoutMismatch: 0,
      turnoutVariance: 0,
      turnoutElectorateBaseVariance: 0,
      voteShareMismatch: 0,
      voteShareVariance: 0,
      voteShareDenominatorVariance: 0,
      missingDetail: 0
    };

    alignedRows.forEach(({ primary: indiaVotesRow, secondary: lokdhabaRow }) => {
      const referenceRow = indiaVotesRow ?? lokdhabaRow;
      const constituency = normalizeConstituencyLabel(selection, referenceRow, constituencyLookup);
      const seat = referenceRow?.constituencyNumber ?? null;
      const adjudication = adjudicationLookup.get(
        `${selection.selectionKey}::${selection.house}::${selection.year}::${seat}`
      );

      if (adjudication) {
        counts.manualAdjudication += 1;
        pushFinding(findings, "manual-adjudication", seat, constituency, {
          severity: "info",
          preferredSource: adjudication.preferredSource ?? "lokdhaba",
          rationale: adjudication.rationale ?? null
        });
        return;
      }

      if (!indiaVotesRow || !lokdhabaRow) {
        counts.sourceCoverageGap += 1;
        pushFinding(findings, "source-coverage-gap", seat, constituency, {
          severity: "info",
          sourcesPresent: [indiaVotesRow ? "indiavotes" : null, lokdhabaRow ? "lokdhaba" : null].filter(Boolean)
        });
        return;
      }

      const indiaVotesParty = normalizePartyLabel(
        indiaVotesRow.winnerParty,
        selection,
        partyAliasMap.aliases ?? {},
        partyNormalization
      );
      const lokdhabaParty = normalizePartyLabel(
        lokdhabaRow.winnerParty,
        selection,
        partyAliasMap.aliases ?? {},
        partyNormalization
      );
      const indiaVotesWinner = normalizeCandidateLabel(selection, indiaVotesRow, indiaVotesRow.winner, candidateLookup);
      const lokdhabaWinner = normalizeCandidateLabel(selection, lokdhabaRow, lokdhabaRow.winner, candidateLookup);
      const sameWinner = areCandidateLabelsCompatible(indiaVotesWinner, lokdhabaWinner);
      const sameParty =
        (!indiaVotesParty && !lokdhabaParty) ||
        (Boolean(indiaVotesParty) && Boolean(lokdhabaParty) && indiaVotesParty === lokdhabaParty);
      const sameWinnerVotes =
        Number.isFinite(indiaVotesRow.winnerVotes) &&
        Number.isFinite(lokdhabaRow.winnerVotes) &&
        indiaVotesRow.winnerVotes === lokdhabaRow.winnerVotes;

      if (!sameWinner && sameParty && sameWinnerVotes) {
        counts.winnerLabelVariation += 1;
        pushFinding(findings, "winner-label-variation", seat, constituency, {
          severity: "info",
          indiavotes: {
            winner: indiaVotesWinner,
            party: indiaVotesParty,
            winnerVotes: indiaVotesRow.winnerVotes
          },
          lokdhaba: {
            winner: lokdhabaWinner,
            party: lokdhabaParty,
            winnerVotes: lokdhabaRow.winnerVotes
          }
        });
      } else if (!sameWinner || !sameParty) {
        counts.winnerMismatch += 1;
        pushFinding(findings, "winner-mismatch", seat, constituency, {
          severity: "critical",
          indiavotes: {
            winner: indiaVotesWinner,
            party: indiaVotesParty
          },
          lokdhaba: {
            winner: lokdhabaWinner,
            party: lokdhabaParty
          }
        });
      }

      if (Number.isFinite(indiaVotesRow.turnoutPct) && Number.isFinite(lokdhabaRow.turnoutPct)) {
        const delta = Math.abs(indiaVotesRow.turnoutPct - lokdhabaRow.turnoutPct);
        const votesDeltaPct = getRelativeDelta(indiaVotesRow.totalVotes, lokdhabaRow.totalVotes);
        const electorsDeltaPct = getRelativeDelta(indiaVotesRow.totalElectors, lokdhabaRow.totalElectors);
        const electorateBaseVariance =
          delta >= thresholds.turnoutActionable &&
          Number.isFinite(votesDeltaPct) &&
          votesDeltaPct <= thresholds.turnoutElectorateBaseVotesPctMax &&
          Number.isFinite(electorsDeltaPct) &&
          electorsDeltaPct >= thresholds.turnoutElectorateBaseElectorsPctMin;
        const sourceVariance =
          delta >= thresholds.turnoutActionable &&
          Number.isFinite(votesDeltaPct) &&
          votesDeltaPct <= thresholds.turnoutSourceVarianceVotesPctMax &&
          (!Number.isFinite(electorsDeltaPct) || electorsDeltaPct < thresholds.turnoutElectorateBaseElectorsPctMin);

        if (delta > thresholds.turnoutInfo) {
          if (electorateBaseVariance) {
            counts.turnoutElectorateBaseVariance += 1;
            pushFinding(findings, "turnout-electorate-base-variance", seat, constituency, {
              severity: "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.turnoutPct,
              lokdhaba: lokdhabaRow.turnoutPct,
              indiavotesVotes: indiaVotesRow.totalVotes,
              lokdhabaVotes: lokdhabaRow.totalVotes,
              votesDeltaPct: toFixedNumber(votesDeltaPct, 2),
              indiavotesElectors: indiaVotesRow.totalElectors,
              lokdhabaElectors: lokdhabaRow.totalElectors,
              electorsDeltaPct: toFixedNumber(electorsDeltaPct, 2)
            });
          } else if (sourceVariance) {
            counts.turnoutVariance += 1;
            pushFinding(findings, "turnout-variance", seat, constituency, {
              severity: "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.turnoutPct,
              lokdhaba: lokdhabaRow.turnoutPct,
              indiavotesVotes: indiaVotesRow.totalVotes,
              lokdhabaVotes: lokdhabaRow.totalVotes,
              votesDeltaPct: toFixedNumber(votesDeltaPct, 2),
              indiavotesElectors: indiaVotesRow.totalElectors,
              lokdhabaElectors: lokdhabaRow.totalElectors,
              electorsDeltaPct: toFixedNumber(electorsDeltaPct, 2)
            });
          } else {
            const actionable = delta >= thresholds.turnoutActionable;
            counts[actionable ? "turnoutMismatch" : "turnoutVariance"] += 1;
            pushFinding(findings, actionable ? "turnout-mismatch" : "turnout-variance", seat, constituency, {
              severity: actionable ? "warning" : "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.turnoutPct,
              lokdhaba: lokdhabaRow.turnoutPct,
              indiavotesVotes: indiaVotesRow.totalVotes,
              lokdhabaVotes: lokdhabaRow.totalVotes,
              votesDeltaPct: toFixedNumber(votesDeltaPct, 2),
              indiavotesElectors: indiaVotesRow.totalElectors,
              lokdhabaElectors: lokdhabaRow.totalElectors,
              electorsDeltaPct: toFixedNumber(electorsDeltaPct, 2)
            });
          }
        }
      }

      if (Number.isFinite(indiaVotesRow.winnerVoteShare) && Number.isFinite(lokdhabaRow.winnerVoteShare)) {
        const delta = Math.abs(indiaVotesRow.winnerVoteShare - lokdhabaRow.winnerVoteShare);
        const winnerVotesDeltaPct = getRelativeDelta(indiaVotesRow.winnerVotes, lokdhabaRow.winnerVotes);
        const totalVotesDeltaPct = getRelativeDelta(indiaVotesRow.totalVotes, lokdhabaRow.totalVotes);
        const formulaVariance =
          delta >= thresholds.voteShareActionable &&
          Number.isFinite(winnerVotesDeltaPct) &&
          winnerVotesDeltaPct <= thresholds.voteShareFormulaVarianceVotesPctMax &&
          Number.isFinite(totalVotesDeltaPct) &&
          totalVotesDeltaPct <= thresholds.voteShareFormulaVarianceTotalVotesPctMax;
        const denominatorVariance =
          delta >= thresholds.voteShareActionable &&
          Number.isFinite(winnerVotesDeltaPct) &&
          winnerVotesDeltaPct <= thresholds.voteShareWinnerVotesPctMax &&
          Number.isFinite(totalVotesDeltaPct) &&
          totalVotesDeltaPct >= thresholds.voteShareTotalVotesPctMin;

        if (delta > thresholds.voteShareInfo) {
          if (formulaVariance) {
            counts.voteShareVariance += 1;
            pushFinding(findings, "vote-share-variance", seat, constituency, {
              severity: "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.winnerVoteShare,
              lokdhaba: lokdhabaRow.winnerVoteShare,
              indiavotesWinnerVotes: indiaVotesRow.winnerVotes,
              lokdhabaWinnerVotes: lokdhabaRow.winnerVotes,
              winnerVotesDeltaPct: toFixedNumber(winnerVotesDeltaPct, 2),
              indiavotesTotalVotes: indiaVotesRow.totalVotes,
              lokdhabaTotalVotes: lokdhabaRow.totalVotes,
              totalVotesDeltaPct: toFixedNumber(totalVotesDeltaPct, 2)
            });
          } else if (denominatorVariance) {
            counts.voteShareDenominatorVariance += 1;
            pushFinding(findings, "vote-share-denominator-variance", seat, constituency, {
              severity: "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.winnerVoteShare,
              lokdhaba: lokdhabaRow.winnerVoteShare,
              indiavotesWinnerVotes: indiaVotesRow.winnerVotes,
              lokdhabaWinnerVotes: lokdhabaRow.winnerVotes,
              winnerVotesDeltaPct: toFixedNumber(winnerVotesDeltaPct, 2),
              indiavotesTotalVotes: indiaVotesRow.totalVotes,
              lokdhabaTotalVotes: lokdhabaRow.totalVotes,
              totalVotesDeltaPct: toFixedNumber(totalVotesDeltaPct, 2)
            });
          } else {
            const actionable = delta >= thresholds.voteShareActionable;
            counts[actionable ? "voteShareMismatch" : "voteShareVariance"] += 1;
            pushFinding(findings, actionable ? "vote-share-mismatch" : "vote-share-variance", seat, constituency, {
              severity: actionable ? "warning" : "info",
              delta: toFixedNumber(delta, 2),
              indiavotes: indiaVotesRow.winnerVoteShare,
              lokdhaba: lokdhabaRow.winnerVoteShare,
              indiavotesWinnerVotes: indiaVotesRow.winnerVotes,
              lokdhabaWinnerVotes: lokdhabaRow.winnerVotes,
              winnerVotesDeltaPct: toFixedNumber(winnerVotesDeltaPct, 2),
              indiavotesTotalVotes: indiaVotesRow.totalVotes,
              lokdhabaTotalVotes: lokdhabaRow.totalVotes,
              totalVotesDeltaPct: toFixedNumber(totalVotesDeltaPct, 2)
            });
          }
        }
      }

      if (hasDetail(indiaVotesRow) !== hasDetail(lokdhabaRow)) {
        counts.missingDetail += 1;
        pushFinding(findings, "missing-detail", seat, constituency, {
          severity: "info",
          indiavotesHasDetail: hasDetail(indiaVotesRow),
          lokdhabaHasDetail: hasDetail(lokdhabaRow)
        });
      }
    });

    slices.push({
      selection,
      sources: {
        primary: "lokdhaba",
        secondary: "indiavotes"
      },
      coverage: {
        indiavotesRows: indiaVotesPayload.rows?.length ?? 0,
        lokdhabaRows: lokdhabaPayload.rows?.length ?? 0,
        comparedSeats: alignedRows.length
      },
      counts,
      clean: Object.values(counts).every((value) => value === 0),
      findings
    });
  }

  const totals = slices.reduce(
    (aggregate, slice) => {
      aggregate.overlappingSlices += 1;
      aggregate.comparedSeats += slice.coverage.comparedSeats;
      aggregate.cleanSlices += slice.clean ? 1 : 0;
      aggregate.discrepancySlices += slice.clean ? 0 : 1;
      Object.entries(slice.counts).forEach(([key, value]) => {
        aggregate.counts[key] = (aggregate.counts[key] ?? 0) + value;
      });
      return aggregate;
    },
    {
      overlappingSlices: 0,
      comparedSeats: 0,
      cleanSlices: 0,
      discrepancySlices: 0,
      counts: {}
    }
  );

  await writeJson(outputPath, {
    generatedAt: new Date().toISOString(),
    thresholds,
    notes: discrepancyPolicy.notes ?? defaultPolicy.notes,
    stats: totals,
    slices
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        stats: totals
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
