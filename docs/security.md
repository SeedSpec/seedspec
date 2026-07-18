# Security and trust model

SeedSpec packages are untrusted input. Validation is not a security endorsement.

## Runtime requirements

A runtime must:

- parse YAML without constructing language-specific objects or executing tags;
- reject duplicate mapping keys;
- reject absolute, traversal, backslash, hidden, control-character, non-ASCII, and case-colliding package paths;
- reject symbolic links, devices, sockets, and other non-regular package entries;
- resolve every manifest reference within the package root;
- apply resource limits for file count, file size, aggregate size, YAML depth, and JSON Schema complexity appropriate to its environment;
- treat Markdown, artifacts, extension values, evals, scripts, reference code, and deployment material as untrusted content;
- avoid executing any optional component merely because the manifest discovers it;
- avoid loading an artifact-provided skill, prompt, plugin, or lifecycle merely because the manifest declares it or an adapter recognizes it;
- fetch remote artifact URLs only through an explicitly authorized, isolated acquisition step;
- keep technical credentials and secrets outside packages and resolved configuration.

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

The same rule applies to artifact-native agent instructions. Adapter recognition and successful artifact validation establish format compatibility only. Before adopting an artifact-specific maintenance, drift, regeneration, or execution workflow, the agent should explain the choice and obtain direction from its end user.

## Public hosting gate

Before accepting arbitrary remote packages, an operator should add archive extraction limits, decompression-bomb protection, MIME/content scanning, request isolation, digest verification, rate limiting, and an abuse/security reporting channel. These are hosting controls, not proof of protocol conformance.
