import path from "node:path";

import {
  ensureDir,
  projectRoot,
  timestampSlug,
  writeArtifact,
  writeJson
} from "./shared.mjs";

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

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildStateSegment(label) {
  return encodeURIComponent(String(label).trim().replace(/\s+/g, "-").toLowerCase());
}

export function buildResultsUrl({ house, year, electionId, stateId, stateLabel }) {
  const section = house === "VS" ? "vidhan-sabha" : "lok-sabha";
  return `https://www.indiavotes.com/${section}/${year}/${buildStateSegment(stateLabel)}/${electionId}/${stateId}?cache=yes`;
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " "));
}

function toNumber(value) {
  const normalized = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function extractTableHtml(html) {
  return html.match(/<table[^>]*class="[^"]*grid sortable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? null;
}

function extractHref(value) {
  const match = String(value).match(/href=(?:"([^"]+)"|'([^']+)'|([^ >]+))/i);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function extractNamedTableHtml(html, options = {}) {
  const idPattern = options.id ? `(?=[^>]*id="${options.id}")` : "";
  const classPattern = options.className ? `(?=[^>]*class="[^"]*${options.className}[^"]*")` : "";
  const pattern = new RegExp(`<table${idPattern}${classPattern}[^>]*>[\\s\\S]*?<\\/table>`, "i");

  return html.match(pattern)?.[0] ?? null;
}

function removeHtmlComments(value) {
  return String(value).replace(/<!--[\s\S]*?-->/g, "");
}

function extractHeaders(tableHtml) {
  const sanitized = removeHtmlComments(tableHtml);
  return [...sanitized.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => stripTags(match[1]));
}

function extractRows(tableHtml) {
  const sanitized = removeHtmlComments(tableHtml);
  const body = sanitized.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? sanitized;

  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((rowHtml) => !/<th\b/i.test(rowHtml));
}

function extractCells(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => {
    const cellHtml = match[1];
    return {
      text: stripTags(cellHtml),
      href: cellHtml.match(/href="([^"]+)"/i)?.[1] ?? null
    };
  });
}

function extractRichCells(rowHtml) {
  return [...rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => {
    const attrs = match[1] ?? "";
    const cellHtml = match[2];
    const rawBgColor = attrs.match(/bgcolor=['"]?([^'"\s>]+)/i)?.[1] ?? null;

    return {
      attrs,
      html: cellHtml,
      text: stripTags(cellHtml),
      href: extractHref(match[0]) ?? extractHref(cellHtml),
      bgcolor: normalizeColor(rawBgColor),
      style: attrs.match(/style=['"]([^'"]*)['"]/i)?.[1] ?? null
    };
  });
}

function normalizeHeader(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, " ");
}

function mapCellsToRecord(headers, cells, context) {
  const values = Object.fromEntries(
    headers.map((header, index) => [normalizeHeader(header), cells[index] ?? { text: "", href: null }])
  );

  const constituencyCell = values["ac name"] ?? values["pc name"] ?? { text: "", href: null };
  const districtCell = values.district ?? { text: "", href: null };
  const partyCell = values.party ?? { text: "", href: null };
  const marginCell = values.margin ?? { text: "", href: null };
  const electorsCell = values["total electors"] ?? values.electors ?? { text: "", href: null };
  const votesCell = values["total votes"] ?? values.votes ?? { text: "", href: null };
  const turnoutCell = values["poll%"] ?? values.turnout ?? { text: "", href: null };
  const numberCell = values["ac no."] ?? values["pc no."] ?? values.no ?? { text: "" };

  return {
    state: context.stateSlug,
    stateLabel: context.stateLabel,
    stateVersionSlug: context.stateVersionSlug ?? context.stateSlug,
    geographyVersionId: context.geographyVersionId ?? null,
    house: context.house,
    year: context.year,
    electionId: context.electionId,
    stateId: context.stateId,
    constituency: constituencyCell.text,
    constituencyNumber: toNumber(numberCell.text),
    reservationType: (values.type ?? { text: "" }).text || null,
    district: districtCell.text,
    winner: (values["winning candidate"] ?? { text: "" }).text,
    winnerParty: partyCell.text,
    totalElectors: toNumber(electorsCell.text),
    totalVotes: toNumber(votesCell.text),
    turnoutPct: toNumber(turnoutCell.text),
    marginVotes: toNumber(marginCell.text),
    marginPct: toNumber((values["margin %"] ?? { text: "" }).text),
    constituencyUrl: constituencyCell.href,
    districtUrl: districtCell.href,
    partyUrl: partyCell.href,
    marginUrl: marginCell.href
  };
}

function buildFileStem(context) {
  return `${context.stateVersionSlug ?? context.stateSlug ?? slugify(context.stateLabel)}-${context.house.toLowerCase()}-${context.year}`;
}

export function buildCachedUrl(url) {
  const withCache = String(url).includes("?") ? `${url}&cache=yes` : `${url}?cache=yes`;

  try {
    const parsed = new URL(withCache);
    parsed.pathname = parsed.pathname
      .split("/")
      .map((segment, index) => {
        if (index === 0 || !segment) {
          return segment;
        }

        const decodedSegment = (() => {
          try {
            return decodeURIComponent(segment);
          } catch {
            return segment;
          }
        })();

        return encodeURIComponent(decodedSegment).replace(/[!'()*]/g, (character) => {
          return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
        });
      })
      .join("/");

    return parsed.toString();
  } catch {
    return withCache;
  }
}

function dedupeRows(rows) {
  const unique = new Map();

  rows.forEach((row) => {
    const key = [
      row.state,
      row.house,
      row.year,
      row.constituencyNumber ?? row.constituency,
      row.winner,
      row.winnerParty,
      row.totalVotes,
      row.marginVotes
    ].join("::");

    if (!unique.has(key)) {
      unique.set(key, row);
    }
  });

  return [...unique.values()];
}

function cleanRow(row) {
  if (/^no data available/i.test(row.constituency ?? "") && !row.winner && !row.winnerParty) {
    return null;
  }

  const nextRow = { ...row };
  const flags = [];

  if (
    Number.isFinite(nextRow.totalElectors) &&
    Number.isFinite(nextRow.totalVotes) &&
    nextRow.totalVotes > nextRow.totalElectors
  ) {
    flags.push("vote_total_exceeds_electors");
    nextRow.turnoutPct = null;
  }

  if (
    Number.isFinite(nextRow.turnoutPct) &&
    (nextRow.turnoutPct < 0 || nextRow.turnoutPct > 100)
  ) {
    flags.push("turnout_out_of_range");
    nextRow.turnoutPct = null;
  }

  if (flags.length > 0) {
    nextRow.dataQualityFlags = flags;
  }

  return nextRow;
}

function mapDetailCellsToRecord(headers, cells) {
  const values = Object.fromEntries(
    headers.map((header, index) => [normalizeHeader(header), cells[index] ?? { text: "", href: null }])
  );
  const candidateCell = values.name ?? values["candidate name"] ?? { text: "", href: null };
  const partyCell = values.party ?? { text: "", href: null };

  return {
    position: toNumber((values.position ?? { text: "" }).text),
    candidate: candidateCell.text,
    votes: toNumber((values.votes ?? { text: "" }).text),
    voteShare: toNumber((values["votes %"] ?? { text: "" }).text),
    party: partyCell.text,
    partyUrl: partyCell.href
  };
}

function cleanCandidateRecord(record) {
  if (!record.candidate || /^no data/i.test(record.candidate)) {
    return null;
  }

  return record;
}

function normalizeColor(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (/^#[0-9a-f]{3}([0-9a-f]{3}){0,1}$/i.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return `#${normalized}`;
  }

  if (/^(rgb|rgba|hsl|hsla)\(/i.test(normalized)) {
    return normalized;
  }

  if (/^[a-z]+$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function extractBackgroundColor(style) {
  return normalizeColor(style?.match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim() ?? null);
}

function mapAllianceCellsToRecord(headers, cells) {
  const values = Object.fromEntries(
    headers.map((header, index) => [normalizeHeader(header), cells[index] ?? { text: "", href: null }])
  );
  const allianceCell = values.alliance ?? { text: "", href: null };

  return {
    label: allianceCell.text,
    seats: toNumber((values.seats ?? { text: "" }).text),
    voteShare: toNumber(
      (values["votes %"] ?? values["vote %"] ?? values["vote share"] ?? { text: "" }).text
    ),
    contestedVoteShare: toNumber(
      (
        values["contested voteshare"] ??
        values["contested vote share"] ??
        values["contested vote %"] ??
        { text: "" }
      ).text
    )
  };
}

function summarizeCandidateDetail(candidateRows) {
  const sortedRows = candidateRows
    .filter(Boolean)
    .slice()
    .sort((left, right) => {
      const leftPosition = Number.isFinite(left.position) ? left.position : Number.MAX_SAFE_INTEGER;
      const rightPosition = Number.isFinite(right.position) ? right.position : Number.MAX_SAFE_INTEGER;

      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      const leftVotes = Number.isFinite(left.votes) ? left.votes : -1;
      const rightVotes = Number.isFinite(right.votes) ? right.votes : -1;
      return rightVotes - leftVotes;
    });

  const winner = sortedRows[0] ?? null;
  const runnerUp = sortedRows[1] ?? null;
  const partyVoteTotals = [...sortedRows.reduce((map, row) => {
    if (!row.party || !Number.isFinite(row.votes)) {
      return map;
    }

    map.set(row.party, (map.get(row.party) ?? 0) + row.votes);
    return map;
  }, new Map()).entries()]
    .map(([party, votes]) => ({ party, votes }))
    .sort((left, right) => right.votes - left.votes || left.party.localeCompare(right.party));

  return {
    winner,
    runnerUp,
    candidateRows: sortedRows,
    partyVoteTotals
  };
}

export async function fetchIndiaVotesDetailFragment(url, options = {}) {
  const detailUrl = buildCachedUrl(url);
  const response = await fetch(detailUrl, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": options.userAgent ?? "Mozilla/5.0"
    }
  });

  const html = await response.text();

  return {
    url: detailUrl,
    response,
    html
  };
}

export function parseIndiaVotesConstituencyDetail(html) {
  const tableHtml =
    extractNamedTableHtml(html, { id: "resultTable", className: "grid sortable" }) ??
    extractNamedTableHtml(html, { id: "resultTable" }) ??
    extractTableHtml(html);

  if (!tableHtml) {
    return null;
  }

  const headers = extractHeaders(tableHtml);
  const candidateRows = extractRows(tableHtml)
    .map((rowHtml) => mapDetailCellsToRecord(headers, extractCells(rowHtml)))
    .map((row) => cleanCandidateRecord(row))
    .filter(Boolean);

  if (candidateRows.length === 0) {
    return null;
  }

  return {
    headers,
    ...summarizeCandidateDetail(candidateRows)
  };
}

export async function extractIndiaVotesConstituencyDetail(url, options = {}) {
  const fetched = await fetchIndiaVotesDetailFragment(url, options);
  const parsed = parseIndiaVotesConstituencyDetail(fetched.html);

  if (!parsed) {
    throw new Error(`No constituency detail table found for ${url}`);
  }

  return {
    url: fetched.url,
    response: fetched.response,
    html: fetched.html,
    ...parsed
  };
}

export async function fetchIndiaVotesAllianceFragment(selection, options = {}) {
  const prefix = selection.house === "LS" ? "pc/pc_graph" : "ac/ac_graph";
  const url = `https://www.indiavotes.com/${prefix}/alliance_table/${selection.stateId}/${selection.electionId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": options.userAgent ?? "Mozilla/5.0"
    }
  });
  const body = await response.text();

  return {
    url,
    response,
    body
  };
}

export function parseIndiaVotesAllianceFragment(payload) {
  const value = typeof payload === "string" ? JSON.parse(payload) : payload;

  if (!value || value.msg !== "ok" || value.table === "none") {
    return {
      available: false,
      status: value?.msg ?? "unknown",
      rows: [],
      pie: value?.pie ?? null,
      bar: value?.bar ?? null,
      tableHtml: value?.table ?? null,
      detailsUrl: null
    };
  }

  const headers = extractHeaders(value.table);
  const rows = extractRows(value.table)
    .map((rowHtml) => mapAllianceCellsToRecord(headers, extractCells(rowHtml)))
    .filter((row) => row.label);

  return {
    available: rows.length > 0,
    status: value.msg,
    headers,
    rows,
    pie: value.pie ?? null,
    bar: value.bar ?? null,
    tableHtml: value.table,
    detailsUrl: extractHref(value.table)
  };
}

export async function extractIndiaVotesAllianceFragment(selection, options = {}) {
  const fetched = await fetchIndiaVotesAllianceFragment(selection, options);
  let parsedPayload;

  try {
    parsedPayload = JSON.parse(fetched.body);
  } catch (error) {
    throw new Error(`Invalid IndiaVotes alliance payload for ${selection.stateLabel} ${selection.year}`);
  }

  return {
    url: fetched.url,
    response: fetched.response,
    body: fetched.body,
    raw: parsedPayload,
    ...parseIndiaVotesAllianceFragment(parsedPayload)
  };
}

export async function fetchIndiaVotesAlliancePartywiseDetail(url, options = {}) {
  const detailUrl = buildCachedUrl(url);
  const response = await fetch(detailUrl, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": options.userAgent ?? "Mozilla/5.0"
    }
  });
  const html = await response.text();

  return {
    url: detailUrl,
    response,
    html
  };
}

export function parseIndiaVotesAlliancePartywiseDetail(html) {
  const tableHtml =
    html.match(/<table[^>]*id="fixedHeaders"[^>]*class="[^"]*grid[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ??
    html.match(/<table[^>]*class="[^"]*grid[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ??
    null;

  if (!tableHtml) {
    return null;
  }

  const headers = extractHeaders(tableHtml);
  const rows = [];
  let currentAlliance = null;
  let currentAllianceColor = null;

  extractRows(tableHtml).forEach((rowHtml) => {
    const cells = extractRichCells(rowHtml);

    if (cells.length === 0) {
      return;
    }

    const hasAllianceCell = cells.length === headers.length;
    const allianceCell = hasAllianceCell ? cells[0] : null;
    const offset = hasAllianceCell ? 1 : 0;

    if (allianceCell?.text) {
      currentAlliance = allianceCell.text;
      currentAllianceColor =
        allianceCell.bgcolor ??
        extractBackgroundColor(allianceCell.style) ??
        currentAllianceColor;
    }

    const partyCell = cells[offset];
    const contestedCell = cells[offset + 1];
    const wonCell = cells[offset + 2];
    const voteShareCell = cells[offset + 3];
    const contestedVoteShareCell = cells[offset + 4];

    if (!currentAlliance || !partyCell?.text) {
      return;
    }

    rows.push({
      alliance: currentAlliance,
      allianceColor: currentAllianceColor,
      party: partyCell.text,
      partyUrl: partyCell.href,
      contested: toNumber(contestedCell?.text ?? ""),
      won: toNumber(wonCell?.text ?? ""),
      voteShare: toNumber(voteShareCell?.text ?? ""),
      contestedVoteShare: toNumber(contestedVoteShareCell?.text ?? "")
    });
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    headers,
    rows
  };
}

export async function extractIndiaVotesAlliancePartywiseDetail(url, options = {}) {
  const fetched = await fetchIndiaVotesAlliancePartywiseDetail(url, options);
  const parsed = parseIndiaVotesAlliancePartywiseDetail(fetched.html);

  if (!parsed) {
    throw new Error(`No alliance partywise detail table found for ${url}`);
  }

  return {
    url: fetched.url,
    response: fetched.response,
    html: fetched.html,
    ...parsed
  };
}

export async function extractIndiaVotesResults(context, options = {}) {
  const timestamp = options.timestamp ?? timestampSlug();
  const outputDir =
    options.outputDir ?? path.join(projectRoot, "data", "raw", "indiavotes", timestamp);
  const stagingDir =
    options.stagingDir ?? path.join(projectRoot, "data", "staging", "election-atlas", "results");
  const url = buildResultsUrl(context);
  const fileStem = options.fileStem ?? buildFileStem(context);

  await ensureDir(outputDir);
  await ensureDir(stagingDir);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  const html = await response.text();
  const tableHtml = extractTableHtml(html);

  if (!tableHtml) {
    throw new Error(`No sortable results table found for ${context.house} ${context.stateLabel} ${context.year}.`);
  }

  const headers = extractHeaders(tableHtml);
  const rows = extractRows(tableHtml);
  const parsedRows = dedupeRows(
    rows
      .map((rowHtml) => mapCellsToRecord(headers, extractCells(rowHtml), context))
      .map((row) => cleanRow(row))
      .filter(Boolean)
  );

  const rawPath = await writeArtifact(outputDir, fileStem, {
    capturedAt: new Date().toISOString(),
    source: "indiavotes",
    request: {
      method: "POST",
      url,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    },
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    },
    selection: {
      state: context.stateSlug,
      stateLabel: context.stateLabel,
      stateVersionSlug: context.stateVersionSlug ?? context.stateSlug,
      geographyVersionId: context.geographyVersionId ?? null,
      house: context.house,
      year: context.year,
      electionId: context.electionId,
      stateId: context.stateId
    },
    headers,
    html
  });

  const stagingPath = path.join(stagingDir, `${fileStem}.json`);
  await writeJson(stagingPath, {
    generatedAt: new Date().toISOString(),
    source: "indiavotes",
    selection: {
      state: context.stateSlug,
      stateLabel: context.stateLabel,
      stateVersionSlug: context.stateVersionSlug ?? context.stateSlug,
      geographyVersionId: context.geographyVersionId ?? null,
      house: context.house,
      year: context.year,
      electionId: context.electionId,
      stateId: context.stateId
    },
    headers,
    rows: parsedRows
  });

  return {
    rawPath,
    stagingPath,
    headers,
    rowCount: parsedRows.length,
    rows: parsedRows
  };
}
