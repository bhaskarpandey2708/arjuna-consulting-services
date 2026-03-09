export function slugifyText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function compactText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function looksUppercase(value) {
  const letters = String(value ?? "").replace(/[^A-Za-z]/g, "");

  if (!letters) {
    return false;
  }

  return letters === letters.toUpperCase();
}

export function prettifyLabel(value) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (!looksUppercase(normalized)) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, "the");
}

function scoreLabel(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  const prettified = prettifyLabel(trimmed);

  if (!prettified) {
    return -1;
  }

  let score = 0;

  if (/[a-z]/.test(trimmed)) {
    score += 4;
  }

  if (!looksUppercase(trimmed)) {
    score += 2;
  }

  score += Math.min(prettified.length, 80) / 80;
  score += Math.min(prettified.split(/\s+/).length, 6) / 10;
  return score;
}

export function choosePreferredLabel(...values) {
  const uniqueValues = [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

  if (uniqueValues.length === 0) {
    return "";
  }

  return uniqueValues
    .slice()
    .sort((left, right) => {
      const scoreDelta = scoreLabel(right) - scoreLabel(left);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return prettifyLabel(right).length - prettifyLabel(left).length;
    })
    .map((value) => prettifyLabel(value))[0];
}

export function getSelectionPartyAliasOverrides(selection = {}, partyNormalization = {}) {
  return (partyNormalization.selectionOverrides ?? []).reduce((merged, override) => {
    const matchesSelection =
      (!override.selectionKey || override.selectionKey === selection.selectionKey || override.selectionKey === selection.state) &&
      (!override.house || override.house === selection.house) &&
      (!override.year || Number(override.year) === Number(selection.year));

    if (matchesSelection) {
      Object.assign(merged, override.aliases ?? {});
    }

    return merged;
  }, {});
}

export function resolvePartyAlias(value, selection = {}, aliases = {}, partyNormalization = {}) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return normalized;
  }

  const selectionOverrides = getSelectionPartyAliasOverrides(selection, partyNormalization);
  return selectionOverrides[normalized] ?? aliases[normalized] ?? normalized;
}

export function toFixedNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toFixed(digits));
}

export function median(values = []) {
  if (values.length === 0) {
    return null;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export function createSeatKey(selection, row = {}) {
  const seatNumber = Number.parseInt(String(row.constituencyNumber ?? row.seat ?? ""), 10);

  if (Number.isFinite(seatNumber)) {
    return `${selection.selectionKey ?? selection.state}::${selection.house}::${selection.year}::${seatNumber}`;
  }

  return [
    selection.selectionKey ?? selection.state,
    selection.house,
    selection.year,
    slugifyText(row.constituency ?? row.slug ?? "")
  ].join("::");
}

export function createConstituencyNameKey(selection, row = {}) {
  return [
    selection.selectionKey ?? selection.state,
    selection.house,
    selection.year,
    slugifyText(prettifyLabel(row.constituency ?? row.slug ?? ""))
  ].join("::");
}

export function buildAlignedRowIndex(selection, rows = []) {
  const bySeat = new Map();
  const byName = new Map();

  rows.forEach((row) => {
    const seatKey = createSeatKey(selection, row);
    const nameKey = createConstituencyNameKey(selection, row);

    bySeat.set(seatKey, row);

    if (!byName.has(nameKey)) {
      byName.set(nameKey, []);
    }

    byName.get(nameKey).push(row);
  });

  return {
    bySeat,
    byName
  };
}

export function shouldPreferNameAlignment(selection, primaryRows = [], secondaryRows = []) {
  const primarySeatKeys = new Set(
    primaryRows
      .map((row) => Number.parseInt(String(row.constituencyNumber ?? row.seat ?? ""), 10))
      .filter(Number.isFinite)
  );
  const secondarySeatKeys = new Set(
    secondaryRows
      .map((row) => Number.parseInt(String(row.constituencyNumber ?? row.seat ?? ""), 10))
      .filter(Number.isFinite)
  );
  const primaryNameKeys = new Set(primaryRows.map((row) => createConstituencyNameKey(selection, row)));
  const secondaryNameKeys = new Set(secondaryRows.map((row) => createConstituencyNameKey(selection, row)));
  const smallerCount = Math.min(primaryRows.length, secondaryRows.length);

  if (smallerCount === 0) {
    return false;
  }

  const seatOverlap = [...primarySeatKeys].filter((key) => secondarySeatKeys.has(key)).length;
  const nameOverlap = [...primaryNameKeys].filter((key) => secondaryNameKeys.has(key)).length;

  return nameOverlap >= Math.floor(smallerCount * 0.8) && seatOverlap <= Math.floor(smallerCount * 0.6);
}

export function findAlignedRow(selection, row, index, options = {}) {
  if (!row) {
    return null;
  }

  const preferName = options.preferName ?? false;
  const nameMatches = index.byName.get(createConstituencyNameKey(selection, row)) ?? [];
  const nameMatch = nameMatches.length === 1 ? nameMatches[0] : null;
  const seatMatch = index.bySeat.get(createSeatKey(selection, row));

  if (preferName && nameMatch) {
    return nameMatch;
  }

  if (seatMatch) {
    return seatMatch;
  }

  return nameMatch;
}

export function buildAlignedRowPairs(selection, primaryRows = [], secondaryRows = []) {
  const secondaryIndex = buildAlignedRowIndex(selection, secondaryRows);
  const matchedSecondary = new Set();
  const pairs = [];
  const preferName = shouldPreferNameAlignment(selection, primaryRows, secondaryRows);

  primaryRows.forEach((row) => {
    const match = findAlignedRow(selection, row, secondaryIndex, { preferName });

    if (match) {
      matchedSecondary.add(match);
    }

    pairs.push({
      primary: row,
      secondary: match
    });
  });

  secondaryRows.forEach((row) => {
    if (!matchedSecondary.has(row)) {
      pairs.push({
        primary: null,
        secondary: row
      });
    }
  });

  return {
    preferName,
    pairs
  };
}

export function buildOverlapPairs(indiavotesIndex, lokdhabaIndex) {
  const pairs = new Map();

  (indiavotesIndex?.slices ?? []).forEach((slice) => {
    const key = `${slice.selectionKey}::${slice.house}::${slice.year}`;
    const current = pairs.get(key) ?? { selectionKey: slice.selectionKey, house: slice.house, year: slice.year };
    current.indiavotes = slice;
    pairs.set(key, current);
  });

  (lokdhabaIndex?.slices ?? []).forEach((slice) => {
    const key = `${slice.selectionKey}::${slice.house}::${slice.year}`;
    const current = pairs.get(key) ?? { selectionKey: slice.selectionKey, house: slice.house, year: slice.year };
    current.lokdhaba = slice;
    pairs.set(key, current);
  });

  return [...pairs.values()].filter((pair) => pair.indiavotes && pair.lokdhaba);
}

export function getSelectionFromSlice(slice = {}) {
  return {
    state: slice.selectionKey ?? slice.state,
    selectionKey: slice.selectionKey ?? slice.state,
    house: slice.house,
    year: slice.year
  };
}

export function compactTokens(value) {
  return prettifyLabel(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function commonPrefixLength(left, right) {
  const limit = Math.min(left.length, right.length);
  let index = 0;

  while (index < limit && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function levenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let index = 0; index <= right.length; index += 1) {
    previous[index] = index;
  }

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function areNameTokensCompatible(leftToken, rightToken) {
  const left = compactText(leftToken);
  const right = compactText(rightToken);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const shorter = Math.min(left.length, right.length);
  const longer = Math.max(left.length, right.length);

  if (shorter >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }

  const prefixLength = commonPrefixLength(left, right);

  if (prefixLength >= Math.min(5, shorter) && prefixLength / longer >= 0.55) {
    return true;
  }

  if (longer >= 5) {
    const distance = levenshteinDistance(left, right);
    const allowedDistance = Math.max(1, Math.floor(longer * 0.25));

    if (distance <= allowedDistance) {
      return true;
    }
  }

  return false;
}

export function areCandidateLabelsCompatible(left, right) {
  const leftTokens = compactTokens(left);
  const rightTokens = compactTokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  if (compactText(left) === compactText(right)) {
    return true;
  }

  const remainingRightTokens = [...rightTokens];
  let overlapCount = 0;

  leftTokens.forEach((token) => {
    const matchIndex = remainingRightTokens.findIndex((candidate) => areNameTokensCompatible(token, candidate));

    if (matchIndex >= 0) {
      overlapCount += 1;
      remainingRightTokens.splice(matchIndex, 1);
    }
  });

  if (overlapCount === 0) {
    return false;
  }

  const shorter = Math.min(leftTokens.length, rightTokens.length);

  if (shorter === 1) {
    return overlapCount === 1;
  }

  if (shorter === 2) {
    return overlapCount === 2;
  }

  const leftLongTokens = leftTokens.filter((token) => token.length >= 4);
  const rightLongTokens = rightTokens.filter((token) => token.length >= 4);

  if (Math.min(leftLongTokens.length, rightLongTokens.length) >= 3) {
    const remainingLongRightTokens = [...rightLongTokens];
    let longOverlapCount = 0;

    leftLongTokens.forEach((token) => {
      const matchIndex = remainingLongRightTokens.findIndex((candidate) =>
        areNameTokensCompatible(token, candidate)
      );

      if (matchIndex >= 0) {
        longOverlapCount += 1;
        remainingLongRightTokens.splice(matchIndex, 1);
      }
    });

    if (longOverlapCount >= 3) {
      return true;
    }
  }

  return overlapCount / shorter >= 2 / 3;
}
