import { createHash } from "node:crypto";
import { SeedSpecError } from "./errors.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_SECTION_CHARACTERS = 6000;

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeSearchText(value) {
  const tokens = [];
  for (const match of normalizedText(value).matchAll(/[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*/gu)) {
    const token = match[0];
    if (token.includes(".")) tokens.push(token);
    tokens.push(...token.split(/[._-]+/u).filter(Boolean));
  }
  return tokens;
}

function queryParts(query) {
  const phrases = [];
  let ordinary = "";
  const pattern = /"([^"]+)"|'([^']+)'|([^"']+)/gu;
  for (const match of String(query ?? "").matchAll(pattern)) {
    const phrase = match[1] ?? match[2];
    if (phrase !== undefined) phrases.push(normalizedText(phrase).trim());
    else ordinary += ` ${match[3]}`;
  }
  const terms = tokenizeSearchText([ordinary, ...phrases].join(" "));
  return { phrases: phrases.filter(Boolean), terms };
}

function lineCount(value) {
  return value === "" ? 0 : value.split("\n").length;
}

function splitLongSection(text, startLine) {
  if (text.length <= MAX_SECTION_CHARACTERS) {
    return [{ text, startLine, endLine: startLine + lineCount(text) - 1 }];
  }

  const parts = [];
  let offset = 0;
  let partStartLine = startLine;
  while (offset < text.length) {
    const remaining = text.length - offset;
    if (remaining <= MAX_SECTION_CHARACTERS) {
      const part = text.slice(offset);
      parts.push({
        text: part,
        startLine: partStartLine,
        endLine: partStartLine + lineCount(part) - 1
      });
      break;
    }

    const target = offset + MAX_SECTION_CHARACTERS;
    const paragraphCut = text.lastIndexOf("\n\n", target);
    const lineCut = text.lastIndexOf("\n", target);
    const minimum = offset + Math.floor(MAX_SECTION_CHARACTERS / 2);
    const cut = paragraphCut >= minimum
      ? paragraphCut + 2
      : lineCut >= minimum
        ? lineCut + 1
        : target;
    const part = text.slice(offset, cut).trimEnd();
    parts.push({
      text: part,
      startLine: partStartLine,
      endLine: partStartLine + lineCount(part) - 1
    });
    const consumed = text.slice(offset, cut);
    partStartLine += consumed.split("\n").length - 1;
    offset = cut;
    while (text[offset] === "\n") {
      offset += 1;
      partStartLine += 1;
    }
  }
  return parts;
}

function stableSectionId(source, heading, startLine, text) {
  const identity = [
    source.scope,
    source.package ?? "",
    source.path,
    heading,
    startLine,
    text
  ].join("\0");
  return `#${createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 12)}`;
}

export function extractMarkdownSections(source) {
  const text = String(source.text ?? "").replace(/\r\n?/gu, "\n");
  const lines = text.split("\n");
  const sections = [];
  const hierarchy = [];
  let sectionStart = 0;
  let sectionHeading = source.title ?? pathLabel(source.path);

  function appendSection(endExclusive) {
    const sectionText = lines.slice(sectionStart, endExclusive).join("\n").trimEnd();
    if (!sectionText.trim()) return;
    for (const part of splitLongSection(sectionText, sectionStart + 1)) {
      const heading = sectionHeading || source.title || pathLabel(source.path);
      sections.push({
        id: stableSectionId(source, heading, part.startLine, part.text),
        scope: source.scope,
        role: source.role,
        authority: source.authority,
        package: source.package ?? null,
        path: source.path,
        heading,
        start_line: part.startLine,
        end_line: part.endLine,
        identifiers: [...new Set(source.identifiers ?? [])].sort(),
        content: part.text
      });
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(lines[index]);
    if (!match) continue;
    if (index > sectionStart) appendSection(index);
    const depth = match[1].length;
    hierarchy.length = depth - 1;
    hierarchy[depth - 1] = match[2].trim();
    sectionStart = index;
    sectionHeading = hierarchy.filter(Boolean).join(" > ");
  }
  appendSection(lines.length);
  return sections;
}

function pathLabel(sourcePath) {
  const name = String(sourcePath).split("/").at(-1) ?? String(sourcePath);
  return name.replace(/\.[^.]+$/u, "");
}

function termFrequency(tokens) {
  const frequencies = new Map();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  return frequencies;
}

export function createSearchIndex(sources) {
  const sections = sources.flatMap(extractMarkdownSections);
  const documents = sections.map((section) => {
    const contentTokens = tokenizeSearchText(section.content);
    const headingTokens = tokenizeSearchText(section.heading);
    const identifierTokens = tokenizeSearchText(section.identifiers.join(" "));
    const tokens = [
      ...contentTokens,
      ...headingTokens,
      ...headingTokens,
      ...identifierTokens,
      ...identifierTokens,
      ...identifierTokens
    ];
    return {
      section,
      normalized: normalizedText(`${section.heading}\n${section.content}`),
      frequencies: termFrequency(tokens),
      length: Math.max(tokens.length, 1)
    };
  });
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.frequencies.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const averageLength = documents.length === 0
    ? 1
    : documents.reduce((sum, document) => sum + document.length, 0) / documents.length;
  return { sources, sections, documents, documentFrequency, averageLength };
}

function bm25Score(index, document, terms) {
  const total = index.documents.length;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const term of new Set(terms)) {
    const frequency = document.frequencies.get(term) ?? 0;
    if (frequency === 0) continue;
    const containing = index.documentFrequency.get(term) ?? 0;
    const inverseDocumentFrequency = Math.log(1 + ((total - containing + 0.5) / (containing + 0.5)));
    const numerator = frequency * (k1 + 1);
    const denominator = frequency + k1 * (1 - b + b * (document.length / index.averageLength));
    score += inverseDocumentFrequency * (numerator / denominator);
  }
  return score;
}

function snippetFor(document, terms, phrases) {
  const text = document.section.content.replace(/\s+/gu, " ").trim();
  if (text.length <= 280) return text;
  const haystack = normalizedText(text);
  const candidates = [...phrases, ...terms].filter(Boolean);
  const first = candidates
    .map((candidate) => haystack.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, first - 90);
  const end = Math.min(text.length, start + 280);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function searchIndex(index, query, options = {}) {
  const { phrases, terms } = queryParts(query);
  if (terms.length === 0) {
    throw new SeedSpecError("Search query must contain at least one searchable term", {
      code: "INVALID_SEARCH_QUERY"
    });
  }
  const limit = options.limit === undefined ? DEFAULT_LIMIT : Number(options.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new SeedSpecError(`Search limit must be an integer from 1 to ${MAX_LIMIT}`, {
      code: "INVALID_SEARCH_LIMIT"
    });
  }

  const matches = [];
  for (const document of index.documents) {
    if (options.scope && document.section.scope !== options.scope) continue;
    if (options.role && document.section.role !== options.role) continue;
    if (phrases.some((phrase) => !document.normalized.includes(phrase))) continue;
    let score = bm25Score(index, document, terms);
    if (score <= 0) continue;
    score += phrases.length * 4;
    matches.push({
      id: document.section.id,
      scope: document.section.scope,
      role: document.section.role,
      authority: document.section.authority,
      package: document.section.package,
      path: document.section.path,
      heading: document.section.heading,
      start_line: document.section.start_line,
      end_line: document.section.end_line,
      score: Number(score.toFixed(6)),
      snippet: snippetFor(document, terms, phrases)
    });
  }
  matches.sort((left, right) => (
    right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  ));
  return {
    query,
    filters: {
      scope: options.scope ?? null,
      role: options.role ?? null
    },
    limit,
    matches: matches.slice(0, limit)
  };
}

export function readSearchSection(index, id) {
  const section = index.sections.find((candidate) => candidate.id === id);
  if (!section) {
    throw new SeedSpecError(`Unknown search result: ${id}`, {
      code: "SEARCH_RESULT_NOT_FOUND"
    });
  }
  return { ...section };
}
