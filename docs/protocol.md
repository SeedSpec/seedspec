# SeedSpec Package Format 0.1 Alpha

Status: private design alpha

This document describes the current package and handoff format. The JSON Schemas in `packages/protocol/schemas/v0.1/` define what the reference tooling accepts. Everything remains open to reconsideration before a later public release.

Format validation constrains SeedSpec artifacts and deterministic tool output. It does not constrain the architecture, vocabulary, or implementation decisions of an application built from those artifacts.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** describe interoperability requirements as defined by BCP 14 when shown in uppercase.

## Normative references

- [BCP 14 / RFC 2119](https://www.rfc-editor.org/info/rfc2119/) and its [RFC 8174 clarification](https://www.rfc-editor.org/info/rfc8174/) define requirement keywords.
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/) defines YAML syntax and data model used by protocol YAML documents.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) defines manifest-adjacent configuration and protocol schemas.
- [Semantic Versioning 2.0.0](https://semver.org/) defines package-version syntax and compatibility intent.
- [NIST FIPS 180-4, updated 2015](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) defines SHA-256.

## 1. Scope

The SeedSpec Protocol defines portable packages containing ideas, product intent, and related artifacts that can help people and tools produce software. It standardizes package identity, discovery, configuration, capabilities, artifact relationships, composition, decisions, integrity, and resolved project state.

It does not standardize programming languages, frameworks, data stores, clouds, repository layouts, user interfaces, deployment, marketplace policy, payment, licensing enforcement, or coding-agent prompts.

## 2. Package model

A SeedSpec package is a dedicated directory whose root contains `seedspec.yaml`. A package has one kind:

- `application` is the root product definition in a resolution.
- `feature` adds product behavior to a compatible application or feature graph.

Every package MUST contain:

```text
package/
├── seedspec.yaml
├── definition/
│   └── <entrypoint>.md
└── configuration/
    ├── schema.json
    └── example.yaml
```

The manifest MAY discover optional components. Empty directories have no protocol meaning.

## 3. Serialization and paths

`seedspec.yaml`, package configuration, decision answers, and resolved YAML documents MUST be UTF-8 YAML 1.2 mappings. Duplicate mapping keys MUST be rejected. JSON documents MUST be UTF-8 JSON.

Protocol paths use `/` regardless of host operating system. Every path segment MUST:

- begin with an ASCII letter or digit;
- contain only ASCII letters, digits, `.`, `_`, or `-` after its first character;
- not be `.` or `..`;
- match case exactly.

Directory references MAY end in `/`. Absolute paths, backslashes, empty segments, hidden leading-dot segments, control characters, symlinks, case-only collisions, devices, sockets, and other non-regular file types are forbidden.

A conforming runtime MUST verify all package contents, not only manifest-referenced files. This conservative rule makes the same package safe and addressable on common case-sensitive and case-insensitive filesystems.

## 4. Identity

Package, capability, domain, artifact type, concern, relationship, adapter, and extension identifiers use lowercase reverse-DNS form with at least three segments:

```text
org.seedspec.examples.allowance-tracker
org.seedspec.core.transactions
org.example.vendor-extension
```

Each segment begins with an alphanumeric character and may then contain lowercase alphanumerics or hyphens.

Publishers SHOULD use a DNS namespace they control. Namespace syntax prevents accidental global collisions; it does not prove ownership or trust.

Local decision and artifact IDs use lowercase hyphenated form within one package.

## 5. Versions

Three version domains are independent:

### 5.1 Protocol version

`protocol_version` selects the manifest, composition, integrity, and resolved-state rules. This alpha requires the string `"0.1"`.

A runtime MUST reject an unsupported protocol version with `UNSUPPORTED_PROTOCOL_VERSION`. It MUST NOT guess compatibility from a numerically close version.

Within the alpha, a schema path identifies the format revision used for testing. Pre-release revisions may still change before a durable public contract exists.

### 5.2 Package version

`version` is the package's Semantic Version. It may contain prerelease and build identifiers. Package versioning communicates product-definition evolution and is independent of capability contract versions.

### 5.3 Capability revision

A provider publishes the exact `major.minor.patch` revision of its current Markdown capability contract. A consumer records the exact revision it was designed or tested against through `tested_against`.

The revision is evidence, not a traditional package constraint. Matching revisions produce an `aligned` binding. Different revisions produce a `review` binding and instruct the implementing agent to inspect the contracts and current application before planning integration. A mismatch alone never rejects composition.

Older contract text may be retained in a package reference component or external history so an agent can understand changes. Capability IDs act as lineage identifiers and need not match the application's user-facing terminology.

## 6. Manifest

The normative shape is `packages/protocol/schemas/v0.1/seedspec.schema.json`.

Required fields are:

- `protocol_version`
- `id`
- `name`
- `version`
- `kind`
- `definition`
- `configuration`
- `provides`

Feature packages additionally require `requires` and `compatibility`.

Unknown top-level fields are forbidden. Publisher- or tool-specific data belongs under `extensions`.

### 6.1 Definition

`definition.entrypoint` references the primary Markdown product definition. It SHOULD describe purpose, actors, permissions, concepts, workflows, state transitions, business rules, configuration behavior, failures, edge cases, and observable conformance without prescribing implementation technology.

### 6.2 Configuration

Every package declares:

- `configuration.schema`: JSON Schema Draft 2020-12;
- `configuration.example`: one complete valid configuration;
- optional `configuration.guide`.

The example MUST validate against the declared schema. Configuration describes product behavior; technical implementation preferences remain separate.

When applying a partial override, `capability-graph-v1` uses this recursive merge:

1. If base and override values are both mappings, merge their keys recursively.
2. Otherwise the override replaces the base value.
3. Arrays are replaced, never concatenated.
4. Explicit `null` replaces the base value and must then pass the package schema.
5. The merged result MUST validate before resolution output is written.

Application and feature configurations remain namespaced by package ID. A runtime MUST NOT flatten them into one keyspace.

### 6.3 Optional components

`components` discovers protocol-recognized files or directories: acceptance, integration, evals, examples, reference, deployment, maintenance, migration, compatibility, assets, security, and generation reports.

Presence makes a component discoverable but does not imply a standardized execution contract unless another protocol document defines one.

### 6.4 Related artifacts

`artifacts` declares optional material in its native format. Every artifact has:

- a package-local `id`;
- a globally namespaced `type`;
- exactly one package-relative `path` or absolute `url`.

An artifact MAY also declare a label, description, media type, native format version, conformance URI, and namespaced `concerns`. Concern identifiers are descriptive classification. Core conventions include:

- `org.seedspec.concern.intent`
- `org.seedspec.concern.design`
- `org.seedspec.concern.execution`
- `org.seedspec.concern.infrastructure`
- `org.seedspec.concern.evidence`

A package-local artifact path MUST exist and may reference a regular file or directory. Core package validation verifies the reference but MUST NOT invoke a format-specific parser, load instructions or skills contained by the artifact, or fetch a remote artifact URL.

`relationships` MAY connect two artifact IDs declared by the same package. The relationship `type` is globally namespaced and descriptive. Examples such as `org.seedspec.relation.derived-from`, `org.seedspec.relation.implements`, and `org.seedspec.relation.validates` communicate traceability but have no automatic execution semantics in protocol 0.1. Both endpoints MUST exist.

Artifact declaration is discovery, not activation or authority. Protocol 0.1 deliberately has no artifact `authority`, `governing`, or `advisory` field. Lineage or precedence claims may be recorded as descriptive relationships, but they do not require an implementation agent to adopt the artifact's workflow, keep generated software synchronized with it, or treat it as current application truth. Adapter-specific behavior requires explicit invocation by a user or execution environment.

### 6.5 Metadata

`metadata` MAY declare license and URI links. These values are self-asserted. They do not establish package authenticity or publisher authority.

### 6.6 Extensions

`extensions` is a mapping keyed by reverse-DNS identifiers. Values may contain any YAML/JSON-compatible data.

Core runtimes:

- MUST ignore extension semantics they do not understand;
- MUST retain extension data when copying or recording the source manifest;
- MUST include extension bytes in the package digest;
- MUST NOT promote an extension into core behavior without a protocol revision.

An extension cannot relax core validation or override a core field.

## 7. Capability contracts

A capability is an observable product contract, not a screen, class, endpoint, datastore, or framework module.

Every `provides.capabilities` item declares:

- globally namespaced `id`;
- exact contract `version`;
- Markdown `contract` path.

The contract MUST identify the capability and version and SHOULD define concepts, authorization expectations, invariants, state behavior, atomicity, retry behavior, failure behavior, and what consumers may rely upon.

Every `requires.capabilities` item declares an ID and a `tested_against` contract revision. The implementing agent depends on the behavior described by that lineage, not the provider's internal API or local vocabulary.

Within one package, required capability IDs, provided capability IDs, decision IDs, and artifact IDs MUST be unique.

## 8. Declared conflicts

A package MAY declare conflicts with package IDs or capability IDs and MUST supply a human-readable reason.

If any selected package names another selected package, resolution fails with `DECLARED_CONFLICT`. If it names a capability provided by another selected package, resolution also fails. Conflicts are symmetric in effect even when declared by only one side.

Conflicts express known incompatibility. Their absence is not proof that two definitions are semantically compatible.

## 9. Product decisions

A package MAY declare product decisions containing local ID, question, required flag, and optional allowed answers.

Answers are supplied as a mapping from package ID to decision ID and non-empty string answer. Unknown packages, unknown decision IDs, non-string answers, and answers outside declared options are invalid.

Resolution preserves unanswered declarations. A project has:

- `status: ready` when no required decision is unanswered;
- `status: needs-decisions` when at least one required decision is unanswered.

Unanswered decisions do not disappear and are not silently defaulted. Execution engines SHOULD refuse consequential implementation choices while project status is `needs-decisions`.

## 10. Composition: `capability-graph-v1`

Given one application and zero or more features, conforming runtimes perform these steps in order:

1. Validate every package, referenced file, configuration example, semantic declaration, path, and digestability rule.
2. Require one application and unique package IDs.
3. Build a provider map from every declared provided capability.
4. Fail with `AMBIGUOUS_CAPABILITY_PROVIDER` when more than one selected package provides the same capability ID. Version differences do not select a winner.
5. Enforce declared package and capability conflicts.
6. Make application-provided capabilities initially available. A root application cannot require external capabilities in this algorithm.
7. Find every remaining feature whose required capability IDs are available. Compare each provider revision with the consumer's `tested_against` revision and record `aligned` or `review` without blocking composition.
8. Sort that ready set by package ID using ascending UTF-8 byte order; append the whole set and add its provisions.
9. Repeat until no features remain.
10. If no feature is ready, classify the failure as either `MISSING_CAPABILITIES` when no selected provider exists or `CAPABILITY_CYCLE` when selected features wait on one another.

CLI argument order has no semantic effect. This algorithm is deliberately strict about duplicate providers; explicit provider selection or replacement belongs to a future algorithm version.

## 11. Package integrity

The canonical package digest is `sha256:<lowercase hex>` and ignores timestamps, permissions, and empty directories.

To calculate it:

1. Recursively enumerate every regular file under the package root, including `seedspec.yaml` and unreferenced files.
2. Reject forbidden paths, symlinks, case-only collisions, and non-regular entries.
3. Express each relative path with `/` and sort paths by ascending UTF-8 byte order.
4. For each file, calculate the lowercase hexadecimal SHA-256 of its exact bytes.
5. Feed the package SHA-256 stream these UTF-8/ASCII bytes for each sorted file:

```text
<relative-path> NUL <64-character-file-sha256> LF
```

6. Prefix the resulting lowercase hexadecimal digest with `sha256:`.

Formatting changes are byte changes and therefore change the digest. A resolved lock MUST record exact package versions and digests.

The digest proves content identity, not publisher identity, safety, or trust. Signing and registry attestations are outside this alpha.

## 12. Resolved project state

Resolution writes a `.seedspec/` workspace without modifying source packages:

```text
.seedspec/
├── project.yaml
├── agent-guide.md
├── components.yaml
├── components/
├── artifacts.yaml
├── artifacts/
├── implementation-notes.md
├── verification-report.md
├── resolved-spec.md
├── resolved-config.yaml
├── dependencies.lock.yaml
└── features/
```

`project.yaml` conforms to `packages/protocol/schemas/v0.1/project.schema.json`. It records decision status, `aligned` or `review` integration status, exact package references, and handoff file locations.

`components.yaml` conforms to `packages/protocol/schemas/v0.1/component-index.schema.json`. It records every protocol-recognized optional component and its source and resolved paths. Resolution copies component files beneath `.seedspec/components/<package-id>/<component-name>/` and assigns deterministic review timing such as `before-planning` or `before-completion-claim`. Preservation and review timing do not activate component content or make author guidance authoritative.

`artifacts.yaml` conforms to `packages/protocol/schemas/v0.1/artifact-index.schema.json`. It records every selected package's artifact metadata, relationships, and deterministic review timing. Resolution copies package-local artifacts beneath `.seedspec/artifacts/<package-id>/<artifact-id>/` and records both the source package path and resolved path. Remote URLs remain URLs and are not fetched. Materialization preserves access for downstream tools without activating an artifact-specific workflow.

`dependencies.lock.yaml` conforms to `packages/protocol/schemas/v0.1/lock.schema.json`. It records exact package digests, deterministic feature order, capability providers, each consumer's `tested_against` revision, the selected provider revision, and the resulting review status.

`resolved-config.yaml` conforms to `packages/protocol/schemas/v0.1/resolved-config.schema.json`. It preserves application configuration, feature configurations keyed by package ID, answered decisions, and technical preferences as separate namespaces.

`resolved-spec.md` is human- and agent-readable product intent. `agent-guide.md` explains how to interpret it. `implementation-notes.md` and `verification-report.md` are created only when missing so later resolution does not erase project memory.

## 13. Conformance

The reference runtime's format checks:

1. pass every applicable case in `conformance/cases.yaml`;
2. produce schema-valid project and lock documents;
3. calculate identical package digests;
4. produce the declared deterministic feature order;
5. return the specified stable error code for negative cases.

Human-readable error wording may vary. Error codes used by the alpha suite keep the reference tooling testable.

Schema validation alone is insufficient because capability uniqueness, content safety, digests, graph ordering, review bindings, conflicts, and decisions require semantic validation.

## 14. Trust and non-goals

Protocol validity does not mean a package is safe, accurate, certified, legally usable, or faithfully implementable. Marketplaces may add review, certification, signatures, reputation, malware scanning, and policy, but those claims remain outside the neutral package format.

Protocol 0.1 does not define registries, package archives, signing, capability delegation, provider selection, dependency acquisition, update/migration execution, eval execution, automatic artifact workflow activation, continuous source/code synchronization, or code-generation adapters.
