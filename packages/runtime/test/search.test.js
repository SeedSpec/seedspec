import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildSearchCorpus,
  readSearchSection,
  searchIndex,
  validatePackage
} from "../src/index.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const comprehensive = path.join(repositoryRoot, "conformance/fixtures/comprehensive-application");
const composed = path.join(repositoryRoot, "conformance/fixtures/bundled-family-hub");
const contextModules = path.join(repositoryRoot, "conformance/fixtures/context-modules");

test("search corpus contains declared package material and exact release documentation", async () => {
  const record = await validatePackage(comprehensive);
  const corpus = await buildSearchCorpus(record, {
    implementingGuide: {
      path: "@seedspec/cli/docs/implementing.md",
      version: "test",
      text: "# Implementing guide\n\nInspect the package before resolving it."
    }
  });

  assert.equal(corpus.package.digest, record.digest);
  assert.equal(corpus.protocol.release, "0.3.0");
  assert.equal(corpus.protocol.documents.length, 4);
  assert(corpus.sources.some((source) => source.path === "intent/allowance-tracker.md"));
  assert(corpus.sources.some((source) => source.path === "acceptance/criteria.md"));
  assert(corpus.sources.some((source) => source.path === "capabilities/chores.md"));
  assert(corpus.sources.some((source) => source.path === "@seedspec/protocol/documents/protocol.md"));
  assert(corpus.sources.some((source) => source.path === "@seedspec/cli/docs/implementing.md"));
  assert(!corpus.sources.some((source) => source.path === "definition/app.md"));
  assert(!corpus.sources.some((source) => source.path.includes("capabilities/conformance")));
});

test("lexical search ranks phrases and identifiers with stable source metadata", async () => {
  const record = await validatePackage(comprehensive);
  const firstCorpus = await buildSearchCorpus(record);
  const secondCorpus = await buildSearchCorpus(record);
  const first = searchIndex(firstCorpus.index, '"append-only" transaction', {
    scope: "package",
    limit: 5
  });
  const second = searchIndex(secondCorpus.index, '"append-only" transaction', {
    scope: "package",
    limit: 5
  });

  assert(first.matches.length > 0);
  assert.deepEqual(first.matches.map((match) => match.id), second.matches.map((match) => match.id));
  assert.equal(first.matches[0].package, record.manifest.id);
  assert.equal(first.matches[0].authority, "authoritative");
  assert.match(first.matches[0].path, /\.md$/u);
  assert(Number.isInteger(first.matches[0].start_line));

  const capability = searchIndex(firstCorpus.index, "org.seedspec.core.chores", {
    role: "capability-contract",
    limit: 3
  });
  assert.equal(capability.matches[0].path, "capabilities/chores.md");
  const section = readSearchSection(firstCorpus.index, capability.matches[0].id);
  assert.match(section.content, /org\.seedspec\.core\.chores/u);
});

test("corpus includes composed package intent and integration seams", async () => {
  const corpus = await buildSearchCorpus(await validatePackage(composed));
  const integration = searchIndex(corpus.index, '"emits requests"', {
    role: "composition-integration"
  });
  assert.equal(integration.matches.length, 1);
  assert.equal(integration.matches[0].path, "integrations/shared-agenda-widget.md");

  const child = searchIndex(corpus.index, '"ordered agenda entries"', {
    role: "product-intent"
  });
  assert.equal(child.matches[0].package, "org.seedspec.fixtures.shared-agenda-widget");
});

test("supporting context bodies stay excluded until prepared", async () => {
  const corpus = await buildSearchCorpus(await validatePackage(contextModules));
  const summary = searchIndex(corpus.index, '"Expected refund-agent conduct"', {
    role: "context-summary"
  });
  assert.equal(summary.matches.length, 1);
  const restrictedBody = searchIndex(corpus.index, '"external change"', { scope: "package" });
  assert.equal(restrictedBody.matches.length, 0);
});
