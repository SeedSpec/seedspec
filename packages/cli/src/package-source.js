import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const GITHUB_HOST = "github.com";
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/u;

function decodePathSegment(segment, label) {
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new Error(`Invalid percent encoding in GitHub ${label}`);
  }
  if (
    !decoded
    || decoded === "."
    || decoded === ".."
    || decoded.includes("/")
    || decoded.includes("\\")
    || decoded.includes("\0")
  ) {
    throw new Error(`Invalid GitHub ${label}`);
  }
  return decoded;
}

export function parseGitHubPackageUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//iu.test(value)) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid remote package URL");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== GITHUB_HOST) {
    throw new Error("Remote package acquisition currently supports public https://github.com URLs only");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("GitHub package URLs must not contain credentials, query parameters, or fragments");
  }

  const rawSegments = url.pathname.split("/").filter(Boolean);
  if (rawSegments.length < 2) {
    throw new Error("GitHub package URL must identify an owner and repository");
  }

  const owner = decodePathSegment(rawSegments[0], "owner");
  const repositoryWithSuffix = decodePathSegment(rawSegments[1], "repository");
  const repository = repositoryWithSuffix.endsWith(".git")
    ? repositoryWithSuffix.slice(0, -4)
    : repositoryWithSuffix;

  if (
    !SAFE_SEGMENT.test(owner)
    || !SAFE_SEGMENT.test(repository)
    || owner === "."
    || owner === ".."
    || repository === "."
    || repository === ".."
  ) {
    throw new Error("GitHub owner and repository must use ordinary GitHub name characters");
  }

  let ref = null;
  let subdirectorySegments = [];
  if (rawSegments.length > 2) {
    if (rawSegments[2] !== "tree" || rawSegments.length < 4) {
      throw new Error("Use a GitHub repository URL or a /tree/<ref>/<package-path> URL");
    }
    ref = decodePathSegment(rawSegments[3], "ref");
    subdirectorySegments = rawSegments.slice(4).map((segment) => decodePathSegment(segment, "package path"));
  }

  return {
    original: value,
    repositoryUrl: `https://${GITHUB_HOST}/${owner}/${repository}.git`,
    owner,
    repository,
    ref,
    subdirectorySegments
  };
}

async function cloneGitHubRepository(source, checkoutDirectory) {
  const args = [
    "-c",
    "core.hooksPath=/dev/null",
    "clone",
    "--depth",
    "1",
    "--single-branch",
    "--no-recurse-submodules"
  ];
  if (source.ref) args.push("--branch", source.ref);
  args.push("--", source.repositoryUrl, checkoutDirectory);

  try {
    await execFileAsync("git", args, {
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_SYSTEM: os.devNull,
        GIT_CONFIG_GLOBAL: os.devNull,
        GIT_TERMINAL_PROMPT: "0"
      },
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const detail = error?.stderr?.trim();
    throw new Error(`Unable to acquire GitHub package${detail ? `: ${detail}` : ""}`);
  }
}

export async function withPackageSource(input, operation, options = {}) {
  const source = parseGitHubPackageUrl(input);
  if (!source) return operation({ packagePath: input, source: null });

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "seedspec-package-"));
  const checkoutDirectory = path.join(temporaryRoot, "checkout");
  try {
    const clone = options.clone ?? cloneGitHubRepository;
    await clone(source, checkoutDirectory);

    const checkoutRoot = await realpath(checkoutDirectory);
    const requestedPath = path.join(checkoutRoot, ...source.subdirectorySegments);
    let packagePath;
    try {
      packagePath = await realpath(requestedPath);
      const packageStats = await stat(packagePath);
      if (!packageStats.isDirectory()) throw new Error("not a directory");
    } catch {
      throw new Error("The GitHub URL does not resolve to a package directory in the acquired repository");
    }

    if (packagePath !== checkoutRoot && !packagePath.startsWith(`${checkoutRoot}${path.sep}`)) {
      throw new Error("The GitHub package path resolves outside the acquired repository");
    }

    return await operation({ packagePath, source });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
