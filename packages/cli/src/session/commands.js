import {
  SeedSpecError,
  beginPackage,
  computePackageDigest,
  formatArtifactListing,
  formatInspection,
  formatPackageBeginning,
  formatPackageLint,
  formatImplementationResourceListing,
  inspectPackage,
  lintPackage,
  listPackageArtifacts,
  listPackageImplementationResources,
  readSearchSection,
  searchIndex
} from "@seedspec/runtime";

function rejectArgs(args, allowed = []) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new SeedSpecError("Command arguments must be an object", {
      code: "INVALID_SHELL_ARGUMENTS"
    });
  }
  const allowedNames = new Set(allowed);
  const unknown = Object.keys(args).filter((name) => !allowedNames.has(name));
  if (unknown.length > 0) {
    throw new SeedSpecError(`Unknown command argument: ${unknown[0]}`, {
      code: "INVALID_SHELL_ARGUMENTS"
    });
  }
}

function requiredString(args, name) {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new SeedSpecError(`Command argument ${name} must be a non-empty string`, {
      code: "INVALID_SHELL_ARGUMENTS"
    });
  }
  return value;
}

async function currentFilesystemDigest(state) {
  try {
    return await computePackageDigest(state.record.root);
  } catch (error) {
    throw new SeedSpecError("The package filesystem no longer matches the active shell session", {
      code: "SHELL_SOURCE_CHANGED",
      details: [error.message, "Run reload to replace the active package only after it validates."]
    });
  }
}

async function assertActiveBytes(state) {
  const digest = await currentFilesystemDigest(state);
  if (digest !== state.record.digest) {
    throw new SeedSpecError("The package filesystem no longer matches the active shell session", {
      code: "SHELL_SOURCE_CHANGED",
      details: [
        `active ${state.record.digest}`,
        `filesystem ${digest}`,
        "Run reload to validate and activate the changed package."
      ]
    });
  }
}

async function activeOperation(state, operation) {
  await assertActiveBytes(state);
  const result = await operation(state.record.root);
  await assertActiveBytes(state);
  return result;
}

function descriptor(name, usage, summary, args, execute) {
  return { name, usage, summary, args, execute };
}

function publicDescriptors(registry) {
  return [...registry.values()].map(({ execute: _execute, ...command }) => command);
}

export function createShellCommandRegistry() {
  const registry = new Map();
  const add = (command) => registry.set(command.name, command);

  add(descriptor("status", "status", "Show the active package and corpus state.", {}, async (state, args) => {
    rejectArgs(args);
    let filesystemDigest = null;
    let filesystemMatches = false;
    let filesystemError = null;
    try {
      filesystemDigest = await computePackageDigest(state.record.root);
      filesystemMatches = filesystemDigest === state.record.digest;
    } catch (error) {
      filesystemError = error.message;
    }
    return {
      source: state.source,
      package: state.identity(),
      filesystem: {
        matches_active_digest: filesystemMatches,
        digest: filesystemDigest,
        error: filesystemError
      },
      protocol: state.corpus.protocol,
      corpus: {
        sources: state.corpus.source_count,
        sections: state.corpus.section_count,
        retained_results: state.availableResults.size
      },
      commands_run: state.history.length
    };
  }));

  add(descriptor("begin", "begin", "Show the validated pre-resolution work order.", {}, async (state, args) => {
    rejectArgs(args);
    const result = await activeOperation(state, beginPackage);
    if (state.source === state.packagePath) return result;
    return {
      ...result,
      package: { ...result.package, root: state.source },
      resolve_command: result.resolve_command.replace(JSON.stringify(state.record.root), JSON.stringify(state.source))
    };
  }));

  add(descriptor("validate", "validate", "Confirm the active package remains protocol-valid.", {}, async (state, args) => {
    rejectArgs(args);
    await assertActiveBytes(state);
    return { valid: true, package: state.identity() };
  }));

  add(descriptor("inspect", "inspect", "Inspect package declarations.", {}, async (state, args) => {
    rejectArgs(args);
    return activeOperation(state, inspectPackage);
  }));

  add(descriptor("lint", "lint", "Run source-bound package diagnostics.", {}, async (state, args) => {
    rejectArgs(args);
    return activeOperation(state, lintPackage);
  }));

  add(descriptor("digest", "digest", "Return the active package digest.", {}, async (state, args) => {
    rejectArgs(args);
    await assertActiveBytes(state);
    return { digest: state.record.digest };
  }));

  add(descriptor("artifacts", "artifacts", "List declared passive artifacts.", {}, async (state, args) => {
    rejectArgs(args);
    return activeOperation(state, listPackageArtifacts);
  }));

  add(descriptor("resources", "resources", "List implementation-resource declarations without loading their bodies.", {}, async (state, args) => {
    rejectArgs(args);
    const result = await activeOperation(state, listPackageImplementationResources);
    return { ...result, root: state.source };
  }));

  add(descriptor("docs", "docs [protocol|implementing]", "List indexed protocol and implementing documents.", {
    scope: { type: "string", enum: ["protocol", "implementing"] }
  }, async (state, args) => {
    rejectArgs(args, ["scope"]);
    if (args.scope !== undefined && !["protocol", "implementing"].includes(args.scope)) {
      throw new SeedSpecError("docs scope must be protocol or implementing", {
        code: "INVALID_SHELL_ARGUMENTS"
      });
    }
    return {
      documents: state.corpus.sources.filter((source) => (
        ["protocol", "implementing"].includes(source.scope)
        && (!args.scope || source.scope === args.scope)
      ))
    };
  }));

  add(descriptor("search", "search <query> [--scope <scope>] [--role <role>] [--limit <count>]", "Search the retained lexical corpus.", {
    query: { type: "string", required: true },
    scope: { type: "string" },
    role: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 50 }
  }, async (state, args) => {
    rejectArgs(args, ["query", "scope", "role", "limit"]);
    const query = requiredString(args, "query");
    if (args.scope !== undefined && typeof args.scope !== "string") {
      throw new SeedSpecError("Command argument scope must be a string", { code: "INVALID_SHELL_ARGUMENTS" });
    }
    if (args.role !== undefined && typeof args.role !== "string") {
      throw new SeedSpecError("Command argument role must be a string", { code: "INVALID_SHELL_ARGUMENTS" });
    }
    const result = searchIndex(state.corpus.index, query, {
      scope: args.scope,
      role: args.role,
      limit: args.limit
    });
    for (const match of result.matches) state.availableResults.add(match.id);
    return result;
  }));

  add(descriptor("read", "read <result-id>", "Read a section returned by search.", {
    id: { type: "string", required: true }
  }, async (state, args) => {
    rejectArgs(args, ["id"]);
    const id = requiredString(args, "id");
    if (!state.availableResults.has(id)) {
      throw new SeedSpecError(`Search result is not retained in this session: ${id}`, {
        code: "SEARCH_RESULT_NOT_RETAINED",
        details: ["Run search first, then read one of its result identifiers."]
      });
    }
    return readSearchSection(state.corpus.index, id);
  }));

  add(descriptor("reload", "reload", "Atomically validate and activate changed package bytes.", {}, async (state, args) => {
    rejectArgs(args);
    return state.reload();
  }));

  add(descriptor("history", "history", "Show process-local command history.", {}, async (state, args) => {
    rejectArgs(args);
    return { commands: state.history.map((item) => ({ ...item })) };
  }));

  add(descriptor("describe", "describe", "Describe commands and JSONL argument shapes.", {}, async (_state, args) => {
    rejectArgs(args);
    return { read_only: true, commands: publicDescriptors(registry) };
  }));

  add(descriptor("help", "help", "Show shell command help.", {}, async (_state, args) => {
    rejectArgs(args);
    return { read_only: true, commands: publicDescriptors(registry) };
  }));

  add(descriptor("exit", "exit", "Close the shell session.", {}, async (_state, args) => {
    rejectArgs(args);
    return { exit: true };
  }));

  return registry;
}

export function formatShellCommand(command, result) {
  switch (command) {
    case "status":
      return [
        `${result.package.name} (${result.package.id}@${result.package.version})`,
        `Kind: ${result.package.kind}`,
        `Digest: ${result.package.digest}`,
        `Protocol: ${result.package.protocol_version} (${result.protocol.release})`,
        `Source: ${result.source}`,
        `Filesystem matches session: ${result.filesystem.matches_active_digest ? "yes" : "no"}`,
        `Corpus: ${result.corpus.sources} sources, ${result.corpus.sections} sections`
      ].join("\n");
    case "begin":
      return formatPackageBeginning(result);
    case "validate":
      return `Valid SeedSpec package: ${result.package.id}@${result.package.version}\nDigest: ${result.package.digest}`;
    case "inspect":
      return formatInspection(result);
    case "lint":
      return formatPackageLint(result);
    case "digest":
      return result.digest;
    case "artifacts":
      return formatArtifactListing(result);
    case "resources":
      return formatImplementationResourceListing(result);
    case "docs":
      return result.documents.length === 0
        ? "No matching documentation is indexed."
        : ["Indexed documentation:", ...result.documents.map((document) => (
          `- ${document.path} (${document.scope}; ${document.authority})`
        ))].join("\n");
    case "search":
      return result.matches.length === 0
        ? `No results for ${JSON.stringify(result.query)}.`
        : result.matches.map((match) => [
          `${match.id}  ${match.heading}`,
          `  ${match.scope}/${match.role}/${match.authority}  ${match.package ? `${match.package}:` : ""}${match.path}:${match.start_line}`,
          `  ${match.snippet}`
        ].join("\n")).join("\n\n");
    case "read":
      return [
        `${result.id}  ${result.heading}`,
        `${result.scope}/${result.role}/${result.authority}  ${result.package ? `${result.package}:` : ""}${result.path}:${result.start_line}-${result.end_line}`,
        "",
        result.content
      ].join("\n");
    case "reload":
      return `Reloaded ${result.package.id}@${result.package.version}\nDigest: ${result.package.digest}\nCorpus: ${result.corpus.sources} sources, ${result.corpus.sections} sections`;
    case "history":
      return result.commands.length === 0
        ? "No commands have completed in this session."
        : result.commands.map((item) => `${item.sequence}. ${item.command} ${JSON.stringify(item.args)}`).join("\n");
    case "describe":
    case "help":
      return [
        "Read-only SeedSpec shell commands:",
        ...result.commands.map((item) => `  ${item.usage.padEnd(64)} ${item.summary}`)
      ].join("\n");
    case "exit":
      return "Session closed.";
    default:
      return JSON.stringify(result, null, 2);
  }
}
