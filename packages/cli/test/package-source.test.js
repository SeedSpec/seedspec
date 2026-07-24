import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseGitHubPackageUrl, withPackageSource } from "../src/package-source.js";

test("parses a GitHub repository URL", () => {
  assert.deepEqual(
    parseGitHubPackageUrl("https://github.com/SeedSpec/reference-solutions"),
    {
      original: "https://github.com/SeedSpec/reference-solutions",
      repositoryUrl: "https://github.com/SeedSpec/reference-solutions.git",
      owner: "SeedSpec",
      repository: "reference-solutions",
      ref: null,
      subdirectorySegments: []
    }
  );
});

test("parses a GitHub tree URL with a package subdirectory", () => {
  assert.deepEqual(
    parseGitHubPackageUrl("https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec"),
    {
      original: "https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec",
      repositoryUrl: "https://github.com/SeedSpec/reference-solutions.git",
      owner: "SeedSpec",
      repository: "reference-solutions",
      ref: "main",
      subdirectorySegments: ["solutions", "family-hub", "seedspec"]
    }
  );
});

test("leaves local package paths unchanged", () => {
  assert.equal(parseGitHubPackageUrl("./examples/family-hub"), null);
});

test("rejects unsupported remote hosts and ambiguous GitHub paths", () => {
  assert.throws(
    () => parseGitHubPackageUrl("https://example.com/SeedSpec/reference-solutions"),
    /public https:\/\/github\.com URLs only/u
  );
  assert.throws(
    () => parseGitHubPackageUrl("https://github.com/SeedSpec/reference-solutions/blob/main/seedspec.yaml"),
    /repository URL or a \/tree/u
  );
});

test("materializes the requested subdirectory and removes it after the operation", async () => {
  let observedPath;
  const result = await withPackageSource(
    "https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec",
    async ({ packagePath, source }) => {
      observedPath = packagePath;
      assert.equal(source.ref, "main");
      assert.equal(await statExists(path.join(packagePath, "seedspec.yaml")), true);
      return "complete";
    },
    {
      clone: async (_source, checkoutDirectory) => {
        const packageDirectory = path.join(checkoutDirectory, "solutions", "family-hub", "seedspec");
        await mkdir(packageDirectory, { recursive: true });
        await writeFile(path.join(packageDirectory, "seedspec.yaml"), "protocol_version: \"0.2\"\n");
      }
    }
  );

  assert.equal(result, "complete");
  assert.equal(await statExists(observedPath), false);
});

test("rejects a requested package path that does not exist", async () => {
  await assert.rejects(
    withPackageSource(
      "https://github.com/SeedSpec/reference-solutions/tree/main/missing",
      async () => "unreachable",
      {
        clone: async (_source, checkoutDirectory) => {
          await mkdir(checkoutDirectory, { recursive: true });
        }
      }
    ),
    /does not resolve to a package directory/u
  );
});

async function statExists(target) {
  try {
    await import("node:fs/promises").then(({ stat }) => stat(target));
    return true;
  } catch {
    return false;
  }
}
