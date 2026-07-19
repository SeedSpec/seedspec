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
- `feature` describes product behavior intended to be adapted into an
  application. Compatibility is decided against the actual implementation, not
  proven by package composition.

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

The revision is evidence, not a traditional package constraint. Exactly one
other-package declaration at the tested revision produces a `declared-aligned`
binding. Missing, multiple, self-provided, or different-revision declarations
produce `review` context and instruct the implementing agent to inspect the
actual application. These states describe package declarations only and never
reject composition by themselves.

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

When applying a partial override, the reference resolver uses this recursive merge:

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

Every `requires.capabilities` item declares an ID and a `tested_against` contract
revision. It records what the package author designed or tested against. The
implementing agent maps that behavioral lineage to the actual application's
code and concepts; absence of a provider declaration is not proof that the
behavior is absent.

Within one package, required capability IDs, provided capability IDs, decision IDs, and artifact IDs MUST be unique.

### 7.1 Feature compatibility scope

A feature declares `compatibility.scope` as `generic`, `domain`, or
`application`. Domain scope supplies a namespaced domain ID. Application scope
supplies one or more package IDs.

This is an author statement about intended, generalized, or tested context. A
runtime MAY use it to explain why a feature deserves review, but MUST NOT treat
the scope as proof of compatibility or incompatibility with an actual
implementation.

## 8. Declared conflicts

A package MAY declare conflicts with package IDs or capability IDs and MUST
supply a human-readable reason.

When a declaration matches selected packages or capability declarations,
resolution preserves a review record with the declaring author's reason. It
does not reject the handoff. The implementation agent must determine whether
the concern applies to the actual code and resolve consequential conflicts with
the end user.

Conflicts express known author concerns. Their presence is not proof of actual
incompatibility, and their absence is not proof of compatibility.

## 9. Product decisions

A package MAY declare product decisions containing local ID, question, required flag, and optional allowed answers.

Answers are supplied as a mapping from package ID to decision ID and non-empty string answer. Unknown packages, unknown decision IDs, non-string answers, and answers outside declared options are invalid.

Resolution preserves unanswered declarations. A project has:

- `status: ready` when no required decision is unanswered;
- `status: needs-decisions` when at least one required decision is unanswered.

Unanswered decisions do not disappear and are not silently defaulted. Execution engines SHOULD refuse consequential implementation choices while project status is `needs-decisions`.

### 9.1 Artifact dispositions

Artifact discovery, preservation, disposition, review timing, and activation are
separate concepts.

An optional artifact-selection input conforms to
`artifact-selections.schema.json`. It records a package ID, package-local
artifact ID, and one of:

- `selected`: the user intends the artifact to inform the implementation;
- `declined`: the user does not want the artifact applied;
- `deferred`: the user explicitly postponed the choice.

Every declared artifact omitted from the input resolves as `unreviewed`. This is
not equivalent to an explicit deferral. Unknown selected packages, unknown
artifact IDs, and duplicate package/artifact entries are invalid.

Disposition is project state, not authority. Even `selected` MUST NOT by itself
load a skill, execute a script or command, fetch a remote URL, invoke an
adapter, or adopt an external workflow. Those actions require specific user or
execution-environment direction outside core resolution.

### 9.2 Implementation targets

Technical preferences MAY contain `implementation_targets` conforming to
`technical-preferences.schema.json`. A target declares:

- a project-local ID;
- a namespaced target kind such as `org.seedspec.target.hosting`;
- a namespaced provider or product target ID; and
- one or more guidance references to components or artifacts in selected
  packages.

Every guidance reference MUST resolve. Referenced artifact guidance MUST have a
`selected` disposition. Component guidance is preserved package context and
does not require an artifact disposition.

An implementation target is strong user-supplied planning context. It does not
prove that generated software is compatible with, deployable to, or accepted
by that target. Providers remain independent of SeedSpec core, and the
implementing agent remains responsible for applying the guidance to the actual
implementation.

## 10. Composition: `declaration-review-v1`

Given one application and zero or more features, conforming runtimes perform
these steps in order:

1. Validate every package, referenced file, configuration example, semantic
   declaration, path, and digestability rule.
2. Require one application, feature kinds for feature inputs, and unique
   selected package IDs.
3. Sort selected features by package ID using ascending UTF-8 byte order. This
   is deterministic recording order, not implementation or dependency order.
4. Record every provided capability declaration with its declaring package.
   Multiple declarations for one ID remain visible.
5. For every application or feature requirement, record zero or more declared
   provider candidates and compare each exact revision with `tested_against`.
6. Record `no-declared-provider`, `multiple-declared-providers`,
   `self-declared-provider`, and `revision-difference` issues as applicable.
7. Record matched package conflicts, capability conflicts, and deterministic
   declared requirement cycles as review context.
8. Generate the resolved handoff without treating those review records as
   installation gates.

CLI argument order has no semantic effect. Structural invalidity, unsafe
content, wrong package kinds, and duplicate package selection remain errors.
Capability, compatibility, conflict, and cycle declarations are author-supplied
evidence. SeedSpec does not inspect the implementation and therefore cannot use
them to prove that a feature is compatible, incompatible, present, or absent.

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

`project.yaml` conforms to `packages/protocol/schemas/v0.1/project.schema.json`. It records decision status, `no-declared-concerns` or `review` declaration status, `recorded` or `review` artifact status, exact package references, and handoff file locations. Declaration status summarizes package evidence only; it is not an implementation-compatibility verdict. Artifact status is `review` while any declared artifact remains `unreviewed`; it does not make every optional artifact a product-readiness gate.

`components.yaml` conforms to `packages/protocol/schemas/v0.1/component-index.schema.json`. It records every protocol-recognized optional component and its source and resolved paths. Resolution copies component files beneath `.seedspec/components/<package-id>/<component-name>/` and assigns deterministic review timing such as `before-planning` or `before-completion-claim`. Preservation and review timing do not activate component content or make author guidance authoritative.

`artifacts.yaml` conforms to `packages/protocol/schemas/v0.1/artifact-index.schema.json`. It records every selected package's artifact metadata, relationships, deterministic review timing, and `selected`, `declined`, `deferred`, or `unreviewed` disposition. Execution artifacts also record that activation requires specific user direction. Resolution copies package-local artifacts beneath `.seedspec/artifacts/<package-id>/<artifact-id>/` and records both the source package path and resolved path regardless of disposition. Remote URLs remain URLs and are not fetched. Materialization preserves auditability and later choice without activating an artifact-specific workflow.

`dependencies.lock.yaml` conforms to `packages/protocol/schemas/v0.1/lock.schema.json`. It records exact package digests, deterministic feature order, every capability declaration, every requirement's declared provider candidates and revision comparisons, and all composition review records. It does not claim a provider is installed or that a capability exists in the actual application.

`resolved-config.yaml` conforms to `packages/protocol/schemas/v0.1/resolved-config.schema.json`. It preserves application configuration, feature configurations keyed by package ID, answered decisions, and technical preferences as separate namespaces. Technical preferences remain extensible while the optional `implementation_targets` envelope receives core structural and reference validation.

`resolved-spec.md` is human- and agent-readable product intent. `agent-guide.md` explains how to interpret it. `implementation-notes.md` and `verification-report.md` are created only when missing so later resolution does not erase project memory.

## 13. Conformance

The reference runtime's format checks:

1. pass every applicable case in `conformance/cases.yaml`;
2. produce schema-valid project and lock documents;
3. calculate identical package digests;
4. produce the declared deterministic feature order;
5. return the specified stable error code for negative cases.

Human-readable error wording may vary. Error codes used by the alpha suite keep the reference tooling testable.

Schema validation alone is insufficient because content safety, digests,
deterministic declaration analysis, review records, reference integrity, and
decisions require semantic validation.

## 14. Trust and non-goals

Protocol validity does not mean a package is safe, accurate, certified, legally usable, or faithfully implementable. Marketplaces may add review, certification, signatures, reputation, malware scanning, and policy, but those claims remain outside the neutral package format.

Protocol 0.1 does not define registries, package archives, signing, capability delegation, provider selection, dependency acquisition, update/migration execution, eval execution, automatic artifact workflow activation, continuous source/code synchronization, or code-generation adapters.
