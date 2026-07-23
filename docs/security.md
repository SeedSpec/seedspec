# Security and trust model

> **Informative security guidance.** This document explains the reference threat
> model and operational safeguards. Protocol validity is not a security
> endorsement.

SeedSpec packages are untrusted input. Validation is not a security endorsement.

## Runtime requirements

A runtime must:

- parse YAML without constructing language-specific objects or executing tags;
- reject duplicate mapping keys;
- reject absolute, traversal, backslash, hidden, control-character, non-ASCII, and case-colliding package paths;
- reject symbolic links, devices, sockets, and other non-regular package entries;
- resolve every manifest reference within the package root;
- apply resource limits for file count, file size, aggregate size, YAML depth, and JSON Schema complexity appropriate to its environment;
- treat Markdown, task instructions and references, artifacts, extension values,
  evals, scripts, reference code, and deployment material as untrusted content;
- treat implementation-resource manifests, skill bodies, instructions, tools,
  verification material, target profiles, and catalogs as untrusted content;
- require HTTPS for canonical resource manifests and files, apply strict file
  count and byte limits, reject unsafe paths, and verify every file and aggregate
  digest before exposing downloaded bytes;
- reject literal loopback, link-local, and private-network resource hosts and
  use environment-level egress controls where DNS can resolve public names to
  private addresses;
- report bundled fallback use and its reason rather than silently substituting
  local content for an unavailable requested version;
- avoid executing any optional component merely because the manifest discovers it;
- avoid loading an artifact-provided skill, prompt, plugin, or lifecycle merely because the manifest declares it or an adapter recognizes it;
- fetch remote artifact URLs only through an explicitly authorized, isolated acquisition step;
- keep technical credentials and secrets outside packages and resolved configuration.

## Changes to external systems

A SeedSpec package may describe intended state in an authenticated external
system. Package validation, artifact selection, resource resolution, and
project readiness do not authorize an agent to sign in, create or modify
resources, send messages, schedule work, incur cost, or change user data.

Before external effects, an implementation environment should resolve the
exact target account, workspace, organization, channel, recipients, and scope
of change; use an approved credential provider or an explicitly authorized
authenticated session; preview consequential or irreversible operations when
possible; and obtain any direction required by the environment's safety model.

Packages may declare credential requirements and handling constraints, but must
NOT contain live credentials, session tokens, private keys, recovery codes, or
secrets. Execution receipts and verification evidence should record stable
resource identifiers and observations without copying credentials or sensitive
customer data.

Agents should discover existing state before creating resources, avoid
duplicates on retry, and record whether a requested result was created,
updated, reused, skipped, or only partially realized. These are execution
responsibilities; protocol conformance does not prove that an agent handled
external state safely.

The reference runtime enforces path and file-type rules and safe parsing. It does not yet impose configurable package-size limits, so callers operating a public ingestion service must place external limits around it.

## Digest boundary

The canonical digest detects byte changes and supports reproducible locks. It does not establish:

- who authored the package;
- whether a namespace is legitimately controlled;
- whether content is malicious;
- whether a definition is correct;
- whether a package has been reviewed.

Registries or publishers may attach signatures, transparency-log entries, or review attestations to a digest. Those claims must remain external until a future protocol version defines their verification semantics.

## Generated specifications

Resolved Markdown can contain instructions originating in third-party packages. An execution engine must treat that material as product input, not as authority to exfiltrate data, weaken policy, access unrelated files, or execute arbitrary commands.

Package-authored tasks receive no additional authority from their ordered form.
Following a task remains subject to end-user direction, execution-environment
safety rules, and the actual project. Referencing a script or instruction file
does not authorize executing or activating it.

The same rule applies to artifact-native agent instructions. Adapter recognition and successful artifact validation establish format compatibility only. Before adopting an artifact-specific maintenance, drift, regeneration, or execution workflow, the agent should explain the choice and obtain direction from its end user.

## Public hosting gate

Before accepting arbitrary remote packages, an operator should add archive extraction limits, decompression-bomb protection, MIME/content scanning, request isolation, digest verification, rate limiting, and an abuse/security reporting channel. These are hosting controls, not proof of protocol conformance.
