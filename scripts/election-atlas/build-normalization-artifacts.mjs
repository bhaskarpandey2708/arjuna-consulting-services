import path from "node:path";

import { ensureDir, projectRoot, readJson, writeJson } from "./shared.mjs";
import {
  areCandidateLabelsCompatible,
  buildAlignedRowPairs,
  buildOverlapPairs,
  choosePreferredLabel,
  getSelectionFromSlice,
  prettifyLabel,
  resolvePartyAlias,
  slugifyText
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

function normalizePartyLabel(party, selection, partyAliases, partyNormalization) {
  const normalized = String(party ?? "").trim();

  if (!normalized) {
    return "Unknown";
  }

  return resolvePartyAlias(normalized, selection, partyAliases, partyNormalization) || "Unknown";
}

function addAliasGroup(groupMap, key, payload) {
  if (!groupMap.has(key)) {
    groupMap.set(key, {
      ...payload,
      aliases: []
    });
  }

  const group = groupMap.get(key);
  const aliasKey = `${payload.source}::${payload.alias}`;

  if (!group.aliases.some((entry) => `${entry.source}::${entry.name}` === aliasKey)) {
    group.aliases.push({
      source: payload.source,
      name: payload.alias
    });
  }
}

async function main() {
  await ensureDir(configDir);

  const partyNormalization = await readJson(partyNormalizationPath).catch(() => ({
    aliases: {}
  }));
  const partyAliases = partyNormalization.aliases ?? {};
  const resultsIndex = await readJson(resultsIndexPath);
  const lokdhabaIndex = await readJson(lokdhabaIndexPath);
  const overlapPairs = buildOverlapPairs(resultsIndex, lokdhabaIndex);
  const constituencyGroups = new Map();
  const candidateGroups = new Map();
  const observedCanonicalParties = new Map();

  overlapPairs.forEach((pair) => {
    [pair.indiavotes, pair.lokdhaba].forEach((slice) => {
      const parties = [
        slice.metrics?.winnerParty,
        ...(slice.topParties ?? []).map((row) => row.party)
      ].filter(Boolean);

      parties.forEach((party) => {
        const selection = getSelectionFromSlice(slice);
        const canonicalParty = normalizePartyLabel(party, selection, partyAliases, partyNormalization);

        if (!observedCanonicalParties.has(canonicalParty)) {
          observedCanonicalParties.set(canonicalParty, new Set());
        }

        observedCanonicalParties.get(canonicalParty).add(String(party).trim());
      });
    });
  });

  for (const pair of overlapPairs) {
    const indiaVotesPayload = await readJson(path.join(resultsDir, pair.indiavotes.fileName));
    const lokdhabaPayload = await readJson(path.join(lokdhabaDir, pair.lokdhaba.fileName));
    const selection = getSelectionFromSlice(pair.indiavotes);
    const { pairs: alignedRows } = buildAlignedRowPairs(
      selection,
      indiaVotesPayload.rows ?? [],
      lokdhabaPayload.rows ?? []
    );

    alignedRows.forEach(({ primary: indiaVotesRow, secondary: lokdhabaRow }) => {

      if (!indiaVotesRow || !lokdhabaRow) {
        return;
      }

      const canonicalSeatNumber = lokdhabaRow.constituencyNumber ?? indiaVotesRow.constituencyNumber ?? null;
      const canonicalConstituencyName = choosePreferredLabel(
        indiaVotesRow.constituency,
        lokdhabaRow.constituency
      );
      const seatKey = [
        selection.selectionKey,
        selection.house,
        selection.year,
        canonicalSeatNumber ?? slugifyText(canonicalConstituencyName)
      ].join("::");

      addAliasGroup(constituencyGroups, seatKey, {
        state: selection.state,
        selectionKey: selection.selectionKey,
        house: selection.house,
        year: selection.year,
        constituencyNumber: canonicalSeatNumber,
        canonicalName: canonicalConstituencyName,
        canonicalSlug: slugifyText(canonicalConstituencyName),
        source: "indiavotes",
        alias: indiaVotesRow.constituency
      });
      addAliasGroup(constituencyGroups, seatKey, {
        state: selection.state,
        selectionKey: selection.selectionKey,
        house: selection.house,
        year: selection.year,
        constituencyNumber: canonicalSeatNumber,
        canonicalName: canonicalConstituencyName,
        canonicalSlug: slugifyText(canonicalConstituencyName),
        source: "lokdhaba",
        alias: lokdhabaRow.constituency
      });

      [
        {
          source: "indiavotes",
          party: indiaVotesRow.winnerParty,
          candidate: indiaVotesRow.winner
        },
        {
          source: "lokdhaba",
          party: lokdhabaRow.winnerParty,
          candidate: lokdhabaRow.winner
        },
        {
          source: "indiavotes",
          party: indiaVotesRow.runnerUpParty,
          candidate: indiaVotesRow.runnerUp
        },
        {
          source: "lokdhaba",
          party: lokdhabaRow.runnerUpParty,
          candidate: lokdhabaRow.runnerUp
        }
      ].forEach((candidateRow) => {
        const candidateName = prettifyLabel(candidateRow.candidate);

        if (!candidateName) {
          return;
        }

        const canonicalParty = normalizePartyLabel(
          candidateRow.party,
          selection,
          partyAliases,
          partyNormalization
        );
        const seatGroups = [...candidateGroups.values()].filter(
          (group) =>
            group.selectionKey === selection.selectionKey &&
            group.house === selection.house &&
            group.year === selection.year &&
            group.constituencyNumber === canonicalSeatNumber &&
            group.party === canonicalParty
        );
        const compatibleGroup = seatGroups.find((group) =>
          group.aliases.some((entry) => areCandidateLabelsCompatible(entry.name, candidateName))
        );
        const canonicalCandidateName = choosePreferredLabel(
          candidateName,
          compatibleGroup?.canonicalName ?? ""
        );
        const candidateKey =
          compatibleGroup?.candidateKey ??
          [
            selection.selectionKey,
            selection.house,
            selection.year,
            canonicalSeatNumber ?? "na",
            canonicalParty,
            slugifyText(canonicalCandidateName)
          ].join("::");

        if (!candidateGroups.has(candidateKey)) {
          candidateGroups.set(candidateKey, {
            state: selection.state,
            selectionKey: selection.selectionKey,
            house: selection.house,
            year: selection.year,
            constituencyNumber: canonicalSeatNumber,
            constituencyName: canonicalConstituencyName,
            party: canonicalParty,
            candidateKey,
            canonicalName: canonicalCandidateName,
            aliases: []
          });
        }

        const group = candidateGroups.get(candidateKey);
        group.canonicalName = choosePreferredLabel(group.canonicalName, candidateName);

        if (!group.aliases.some((entry) => entry.source === candidateRow.source && entry.name === candidateRow.candidate)) {
          group.aliases.push({
            source: candidateRow.source,
            name: candidateRow.candidate
          });
        }
      });
    });
  }

  const partyAliasMap = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stats: {
      aliasCount: Object.keys(partyAliases).length,
      canonicalPartyCount: observedCanonicalParties.size
    },
    aliases: partyAliases,
    canonicalParties: [...observedCanonicalParties.entries()]
      .map(([canonical, aliases]) => ({
        canonical,
        aliases: [...aliases].sort()
      }))
      .sort((left, right) => left.canonical.localeCompare(right.canonical))
  };

  const constituencyEntries = [...constituencyGroups.values()]
    .map((group) => ({
      state: group.state,
      selectionKey: group.selectionKey,
      house: group.house,
      year: group.year,
      constituencyNumber: group.constituencyNumber,
      canonicalName: group.canonicalName,
      canonicalSlug: group.canonicalSlug,
      aliases: group.aliases.sort((left, right) => {
        return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      })
    }))
    .sort((left, right) => {
      return (
        left.selectionKey.localeCompare(right.selectionKey) ||
        left.house.localeCompare(right.house) ||
        left.year - right.year ||
        (left.constituencyNumber ?? Number.MAX_SAFE_INTEGER) - (right.constituencyNumber ?? Number.MAX_SAFE_INTEGER)
      );
    });
  const candidateEntries = [...candidateGroups.values()]
    .map((group) => ({
      state: group.state,
      selectionKey: group.selectionKey,
      house: group.house,
      year: group.year,
      constituencyNumber: group.constituencyNumber,
      constituencyName: group.constituencyName,
      party: group.party,
      canonicalName: group.canonicalName,
      aliases: group.aliases.sort((left, right) => {
        return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      })
    }))
    .sort((left, right) => {
      return (
        left.selectionKey.localeCompare(right.selectionKey) ||
        left.house.localeCompare(right.house) ||
        left.year - right.year ||
        (left.constituencyNumber ?? Number.MAX_SAFE_INTEGER) - (right.constituencyNumber ?? Number.MAX_SAFE_INTEGER) ||
        left.party.localeCompare(right.party) ||
        left.canonicalName.localeCompare(right.canonicalName)
      );
    });

  await writeJson(partyAliasMapPath, partyAliasMap);
  await writeJson(constituencyNameMapPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    stats: {
      overlapSlices: overlapPairs.length,
      entryCount: constituencyEntries.length,
      aliasCount: constituencyEntries.reduce((sum, entry) => sum + entry.aliases.length, 0)
    },
    entries: constituencyEntries
  });
  await writeJson(candidateAliasMapPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    stats: {
      overlapSlices: overlapPairs.length,
      entryCount: candidateEntries.length,
      aliasCount: candidateEntries.reduce((sum, entry) => sum + entry.aliases.length, 0)
    },
    entries: candidateEntries
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputs: {
          partyAliasMapPath,
          constituencyNameMapPath,
          candidateAliasMapPath
        },
        stats: {
          overlapSlices: overlapPairs.length,
          constituencyEntries: constituencyEntries.length,
          candidateEntries: candidateEntries.length
        }
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
