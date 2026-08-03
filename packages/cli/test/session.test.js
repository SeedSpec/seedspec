import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { computePackageDigest } from "@seedspec/runtime";
import { runInteractiveShell } from "../src/session/interactive.js";
import { runJsonlShell } from "../src/session/jsonl.js";
import { createShellSession } from "../src/session/session.js";
import { parseInteractiveRequest, tokenizeShellLine } from "../src/session/tokenize.js";
import { withPackageSource } from "../src/package-source.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const comprehensive = path.join(repositoryRoot, "conformance/fixtures/comprehensive-application");

async function temporaryPackage(t) {
  const root = await mkdtemp(path.join(tmpdir(), "seedspec-shell-"));
  const packagePath = path.join(root, "package");
  await cp(comprehensive, packagePath, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  return packagePath;
}

function outputCollector() {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    }
  });
  return { stream, text: () => text };
}

test("one session retains search results and uses one command engine", async () => {
  const before = await computePackageDigest(comprehensive);
  const session = await createShellSession(comprehensive, {
    implementingGuide: {
      path: "@seedspec/cli/docs/implementing.md",
      version: "test",
      text: "# Implementing\n\nResolve explicit adopter choices."
    }
  });
  const status = await session.execute("status", {});
  assert.equal(status.filesystem.matches_active_digest, true);
  const search = await session.execute("search", {
    query: "offline allowance history",
    scope: "package",
    limit: 5
  });
  assert(search.matches.length > 0);
  const read = await session.execute("read", { id: search.matches[0].id });
  assert.equal(read.id, search.matches[0].id);
  const history = await session.execute("history", {});
  assert.deepEqual(history.commands.map((item) => item.command), ["status", "search", "read"]);
  assert.equal(await computePackageDigest(comprehensive), before);
});

test("reload is atomic and changed bytes cannot enter bound operations implicitly", async (t) => {
  const packagePath = await temporaryPackage(t);
  const session = await createShellSession(packagePath);
  const originalIdentity = session.identity;
  const definitionPath = path.join(packagePath, "intent/allowance-tracker.md");
  const originalDefinition = await readFile(definitionPath, "utf8");
  await writeFile(definitionPath, `${originalDefinition}\n\nShell reload sentinel.\n`, "utf8");

  const stale = await session.execute("status", {});
  assert.equal(stale.filesystem.matches_active_digest, false);
  await assert.rejects(
    session.execute("validate", {}),
    (error) => error.code === "SHELL_SOURCE_CHANGED"
  );
  const beforeReload = await session.execute("search", { query: "sentinel" });
  assert.equal(beforeReload.matches.length, 0);

  const reloaded = await session.execute("reload", {});
  assert.notEqual(reloaded.package.digest, originalIdentity.digest);
  const afterReload = await session.execute("search", { query: "sentinel" });
  assert.equal(afterReload.matches[0].path, "intent/allowance-tracker.md");

  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, "not: [valid\n", "utf8");
  await assert.rejects(session.execute("reload", {}));
  assert.equal(session.identity.digest, reloaded.package.digest);
  const retained = await session.execute("search", { query: "sentinel" });
  assert.equal(retained.matches.length, 1);
  await writeFile(manifestPath, manifest, "utf8");
});

test("JSONL returns one structured response per request and survives command errors", async () => {
  const session = await createShellSession(comprehensive);
  const input = Readable.from([
    '{"id":"1","command":"search","args":{"query":"append-only","limit":1}}\n',
    '{"id":"2","command":"read","args":{"id":"#not-retained"}}\n',
    '{"id":"3","command":"status","args":{}}\n',
    '{"id":"4","command":"exit","args":{}}\n'
  ]);
  const output = outputCollector();
  await runJsonlShell(session, { input, output: output.stream });
  const responses = output.text().trim().split("\n").map(JSON.parse);

  assert.equal(responses.length, 4);
  assert.deepEqual(responses.map((response) => response.id), ["1", "2", "3", "4"]);
  assert.equal(responses[0].ok, true);
  assert.equal(responses[1].ok, false);
  assert.equal(responses[1].error.code, "SEARCH_RESULT_NOT_RETAINED");
  assert.equal(responses[2].ok, true);
  assert.equal(responses[3].result.exit, true);
});

test("interactive transport processes a complete non-terminal command stream", async () => {
  const session = await createShellSession(comprehensive);
  const input = Readable.from([
    "status\n",
    'search "append-only transaction" --scope package --limit 1\n',
    "exit\n"
  ]);
  const output = outputCollector();
  await runInteractiveShell(session, { input, output: output.stream, terminal: false });
  assert.match(output.text(), /Filesystem matches session: yes/u);
  assert.match(output.text(), /package\/product-intent\/authoritative/u);
  assert.match(output.text(), /Session closed\./u);
});

test("a remote package remains materialized for the session and cleans up afterward", async () => {
  let materializedPath;
  await withPackageSource(
    "https://github.com/SeedSpec/example-package",
    async ({ packagePath, source }) => {
      materializedPath = packagePath;
      const session = await createShellSession(packagePath, { source: source.original });
      assert.equal((await stat(packagePath)).isDirectory(), true);
      const result = await session.execute("search", { query: "allowance history", limit: 1 });
      assert.equal(result.matches.length, 1);
    },
    {
      clone: async (_source, checkoutDirectory) => {
        await cp(comprehensive, checkoutDirectory, { recursive: true });
      }
    }
  );
  await assert.rejects(stat(materializedPath));
});

test("interactive parsing preserves quoted phrases and filters", () => {
  assert.deepEqual(tokenizeShellLine('search "offline conflict" --limit 4'), [
    { value: "search", quoted: false },
    { value: "offline conflict", quoted: true },
    { value: "--limit", quoted: false },
    { value: "4", quoted: false }
  ]);
  assert.deepEqual(parseInteractiveRequest('search "offline conflict" --scope package --role acceptance --limit 4'), {
    command: "search",
    args: {
      query: '"offline conflict"',
      scope: "package",
      role: "acceptance",
      limit: 4
    }
  });
  assert.deepEqual(parseInteractiveRequest("quit"), { command: "exit", args: {} });
});
