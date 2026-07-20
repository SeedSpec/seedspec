# SeedSpec Package Format 0.1 Alpha

Status: private design alpha

This document describes the current package and handoff format. The JSON Schemas in `packages/protocol/schemas/v0.1/` define what the reference tooling accepts. Everything remains open to reconsideration before a later public release.

Format validation constrains SeedSpec artifacts and deterministic runtime
output. It does not make agent execution deterministic or constrain the
architecture, vocabulary, tools, or implementation decisions used to realize
the packaged intent.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** describe interoperability requirements as defined by BCP 14 when shown in uppercase.

## Normative references

- [BCP 14 / RFC 2119](https://www.rfc-editor.org/info/rfc2119/) and its [RFC 8174 clarification](https://www.rfc-editor.org/info/rfc8174/) define requirement keywords.
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/) defines YAML syntax and data model used by protocol YAML documents.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) defines manifest-adjacent configuration and protocol schemas.
- [Semantic Versioning 2.0.0](https://semver.org/) defines package-version syntax and compatibility intent.
- [NIST FIPS 180-4, updated 2015](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) defines SHA-256.

## 1. Scope

The SeedSpec Protocol defines portable, agent-ready packages containing intent,
configuration, context, resources, success criteria, and related artifacts. A
package can help an agent produce software, adapt a feature, configure an
external system, establish an automation, generate an operational artifact, or
realize a composite solution. The protocol standardizes package identity,
discovery, configuration, capabilities, artifact relationships, composition,
decisions, integrity, and resolved project state.

It does not standardize programming languages, frameworks, data stores, clouds,
repository layouts, user interfaces, deployment, external-service operation,
marketplace policy, payment, licensing enforcement, or the substantive content
of agent guidance. It standardizes how authors declare, version, resolve, and
preserve optional implementation resources without granting them automatic
authority.

## 2. Package model

A SeedSpec package is a dedicated directory whose root contains
`seedspec.yaml`. Every manifest carries one author-supplied `kind` hint:

- `solution`: a compound outcome or one whose realization form is intentionally
  broad;
- `application`: a user-facing software system or product;
- `feature`: behavior intended to extend or change an existing solution;
- `workflow`: a coordinated process across people, agents, or systems;
- `automation`: scheduled or event-driven behavior intended to run with limited
  human involvement;
- `configuration`: desired state primarily realized inside an existing system;
  or
- `integration`: a connection or coordinated behavior across systems.

Publishers MAY use a namespaced custom hint when none of the core suggestions
communicates the outcome adequately. Generic tooling MUST preserve unknown
namespaced hints and SHOULD fall back to `solution`-style guidance.

`kind` is communicative metadata, not a type system. It guides authoring tools,
quality checks, discovery, and agent handoff, but it MUST NOT determine whether
a package may be selected as a composition root or addition and MUST NOT impose
kind-specific required fields. Authoring tools SHOULD request the hint early,
adapt their prompts and recommendations to it, and identify likely omissions or
scope mismatches. They MUST present those findings separately from protocol
validity, MUST NOT silently rewrite the package, and SHOULD let the author keep
an unusual but intentional shape. Generic tools receiving a namespaced custom
kind SHOULD apply `solution` guidance while preserving the declared value.

Resolution position establishes composition role: the first selected package
is the root and every other selected package is an addition. The expected
authoring lens and reference diagnostics for each core kind are defined in
`docs/kind-guidance.md`. See also
`docs/decisions/0009-kind-hints-and-implementation-profiles.md`.

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

Conformance is determined from the materialized declarative package. Authors
MAY use language-specific builders, forms, agentic workflows, or other
authoring frontends to produce that package, but consumers MUST NOT require or
implicitly execute the authoring frontend. No particular authoring frontend or
implementation language is part of package conformance.

Protocol paths use `/` regardless of host operating system. Every path segment MUST:

- begin with an ASCII letter or digit;
- contain only ASCII letters, digits, `.`, `_`, or `-` after its first character;
- not be `.` or `..`;
- match case exactly.

Directory references MAY end in `/`. Absolute paths, backslashes, empty segments, hidden leading-dot segments, control characters, symlinks, case-only collisions, devices, sockets, and other non-regular file types are forbidden.

A conforming runtime MUST verify all package contents, not only manifest-referenced files. This conservative rule makes the same package safe and addressable on common case-sensitive and case-insensitive filesystems.

## 4. Identity

Package, capability, implementation resource, resource catalog, target, domain, artifact type, concern, relationship, adapter, and extension identifiers use lowercase reverse-DNS form with at least three segments:

```text
org.seedspec.examples.allowance-tracker
org.seedspec.core.transactions
org.example.vendor-extension
```

Each segment begins with an alphanumeric character and may then contain lowercase alphanumerics or hyphens.

Publishers SHOULD use a DNS namespace they control. Namespace syntax prevents accidental global collisions; it does not prove ownership or trust.

Local decision, artifact, implementation-profile, and profile-condition IDs use
lowercase hyphenated form within one package.

## 5. Versions

Four version domains are independent:

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
actual realization. These states describe package declarations only and never
reject composition by themselves.

Older contract text may be retained in a package reference component or
external history so an agent can understand changes. Capability IDs act as
lineage identifiers and need not match the realized solution's user-facing
terminology.

### 5.4 Implementation resource version

Implementation resources use Semantic Versioning independently from the
protocol, CLI, package, and capability contracts. A package records a requested
version, update policy, canonical manifest URL, optional canonical digest, and
optional bundled fallback version and digest. Resolution MUST record the actual
version and source used.

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

Unknown top-level fields are forbidden. Publisher- or tool-specific data belongs under `extensions`.

### 6.1 Definition

`definition.entrypoint` references the primary Markdown intent definition. It
SHOULD describe what should be accomplished, why it matters, relevant actors
and permissions, concepts, workflows, state transitions, rules, configuration
behavior, failures, edge cases, and observable conformance without prescribing
an execution path that the intended outcome does not require.

### 6.2 Configuration

Every package declares:

- `configuration.schema`: JSON Schema Draft 2020-12;
- `configuration.example`: one complete valid configuration;
- optional `configuration.guide`.

The example MUST validate against the declared schema. Configuration describes
meaningful variations in intended solution behavior; technical implementation
preferences remain separate.

The example is author-supplied package material. It is not a default selected by
the user merely because the package was handed to an agent.

An optional resolution input conforming to
`configuration-selections.schema.json` records exactly one selection for every
selected root and addition package:

- `example` selects the package's exact validated example; or
- `custom` supplies a complete configuration object that MUST validate against
  the package schema.

Custom values are complete, not partial overrides. A runtime MUST NOT merge
omitted values from the example. Duplicate entries, entries for unselected
packages, and a selection file that omits a selected package are invalid.

When no configuration-selection input is supplied, resolution MAY preserve each
example as `example-unreviewed` so the handoff remains inspectable, but it MUST
set `configuration_status: review` and MUST NOT report the project as ready.

Root and addition configurations remain namespaced by package ID. A runtime MUST NOT flatten them into one keyspace.

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

Artifact declaration is discovery, not activation or authority. Protocol 0.1
deliberately has no artifact `authority`, `governing`, or `advisory` field.
Lineage or precedence claims may be recorded as descriptive relationships, but
they do not require an implementation agent to adopt the artifact's workflow,
keep a realized solution synchronized with it, or treat it as current system
truth. Adapter-specific behavior requires explicit invocation by a user or
execution environment.

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

### 6.7 Implementation resources

`implementation_resources` is an optional author declaration. When omitted,
the author's position on additional SeedSpec guidance is `unspecified`; a
runtime MUST NOT reinterpret omission as acceptance or rejection.

When present it declares `additional_guidance` as `none` or
`agent-delegated`, zero or more public versioned catalogs, and zero or more
author-selected resources. Catalogs are permitted only with
`agent-delegated`. Core defines catalog identity and discovery metadata but does
not define catalog search or ranking in protocol 0.1.

Every resource declares a namespaced ID, kind, description, usage, entrypoint,
requested version, update policy, and at least one canonical or bundled source.
Kinds are `skill`, `instructions`, `verification`, `tool`, and
`target-profile`. Usage is `required`, `recommended`, or `available` and
expresses author intent only.

An optional `applies_to` mapping may name capability and target IDs. Matching is
advisory context. It does not prove that a capability exists in an
implementation, that a target is selected, or that the resource is suitable.

Canonical sources point to HTTPS resource manifests conforming to
`implementation-resource-manifest.schema.json`. An `exact` policy MUST declare
the expected canonical digest. `latest-compatible` accepts no older version
with the same major version; `latest` accepts no version older than the
requested baseline.

Bundled sources are package-local directory fallbacks with an exact version,
digest, and `exact` or `author-declared-compatible` relationship to the
requested version. The latter is an author claim, not proof. The runtime MUST
validate the directory, entrypoint, digest, and skill
frontmatter when applicable. Bundled fallback use MUST be visible with the
canonical failure reason. A runtime MUST NOT silently present fallback bytes as
the requested online version.

Resource discovery, author usage, content loading, and tool activation are
separate. Resolving a resource MAY make verified instruction bytes available to
an agent. It MUST NOT execute a tool or grant permission for external effects.
See `docs/implementation-resources.md`.

### 6.8 Implementation profiles

The definition, configuration, capabilities, and acceptance material express
the package's **core intent**. An optional `implementation_profiles` array may
preserve materially different candidate directions for realizing that intent.
Each profile declares a package-local ID, name, and description and MAY declare:

- package-relative Markdown `guidance`;
- declarative `prerequisites` that must hold for the profile to be viable;
- declarative `blockers` whose presence prevents faithful use of the profile;
- human-readable `tradeoffs`; and
- references to implementation resources declared by the same package.

Every prerequisite and blocker has a local ID, a declarative statement, and a
`verification` object. The object declares a `method`, an `evidence`
expectation, and optional guidance. Core methods are `user-confirmation`,
`environment-inspection`, `tool-check`, `document-review`, and
`manual-observation`; `evidence` is `none`, `optional`, or `required`.
Publishers MAY use a namespaced custom method. Generic tooling MUST preserve
it and SHOULD ask the agent to follow supplied guidance or obtain user
direction.

These are conditions to establish, not predetermined question wording or
authorization to perform the check. An agent SHOULD use available read-only
evidence first and ask the user when confirmation, access, or consequential
interpretation is required. Package validation and profile resolution MUST NOT
execute a tool, access an account, or claim that a condition holds.

A new verification method belongs in the core enum only when it has recurring
use across independent packages, is semantically distinct from existing
methods, gives a generic agent a clear responsibility, has a documented
evidence and trust model, has safe fallback behavior, and is covered by schema,
conformance, authoring-diagnostic, and end-to-end example tests. Namespaced
experimentation SHOULD precede core promotion. See
`docs/implementation-profiles.md`.

Profile IDs MUST be unique within a package. Condition IDs MUST be unique within
one profile. Guidance paths MUST exist, and implementation-resource references
MUST resolve to resources declared by the same package.

An implementation-profile preference is a package/profile pair. A root profile
MAY be selected by local ID shorthand. The preference is strong implementation
guidance from whoever initiated resolution; it is not a change to core intent,
an authorization for external effects, proof that prerequisites hold, or an
irreversible execution command.

When a selected package declares multiple profiles and no preference is
recorded, resolution MUST set `implementation_profile_status: review`, MUST set project
`status: needs-input`, and MUST instruct the implementing agent to explain the
material differences and ask which direction to prefer. When a preference is
recorded, the handoff MUST preserve all candidates, emphasize the preferred
profile, and instruct the agent to verify its prerequisites and blocker
conditions. If the preference conflicts with the actual environment or core
intent, the agent MUST present the conflict and request direction rather than
silently switching profiles.

Resolution MUST produce exactly one project-level implementation profile state.
That state preserves the profiles from every selected package and records at
most one preferred profile for each package. It does not create a separate
state for every candidate. Comparing mutually exclusive project realizations
requires separate resolution runs or workspaces; one handoff MUST NOT contain
competing project-level profile states.

## 7. Capability contracts

A capability is an observable solution contract, not a screen, class, endpoint,
datastore, framework module, or vendor-specific implementation mechanism.

Every `provides.capabilities` item declares:

- globally namespaced `id`;
- exact contract `version`;
- Markdown `contract` path.

The contract MUST identify the capability and version and SHOULD define concepts, authorization expectations, invariants, state behavior, atomicity, retry behavior, failure behavior, and what consumers may rely upon.

Every `requires.capabilities` item declares an ID and a `tested_against` contract
revision. It records what the package author designed or tested against. The
implementing agent maps that behavioral lineage to the actual realization's
code, configuration, external state, and concepts; absence of a provider
declaration is not proof that the behavior is absent.

Within one package, required capability IDs, provided capability IDs, decision IDs, and artifact IDs MUST be unique.

### 7.1 Compatibility scope

Any package may declare `compatibility.scope` as `generic`, `domain`, or
`application`. Domain scope supplies a namespaced domain ID. Application scope
supplies one or more package IDs.

This is an author statement about intended, generalized, or tested context. A
runtime MAY use it to explain why a package deserves review, but MUST NOT treat
the scope as proof of compatibility or incompatibility with an actual
implementation.

## 8. Declared conflicts

A package MAY declare conflicts with package IDs or capability IDs and MUST
supply a human-readable reason.

When a declaration matches selected packages or capability declarations,
resolution preserves a review record with the declaring author's reason. It
does not reject the handoff. The implementation agent must determine whether
the concern applies to the actual code, configuration, or external state and
resolve consequential conflicts with the end user.

Conflicts express known author concerns. Their presence is not proof of actual
incompatibility, and their absence is not proof of compatibility.

## 9. Solution decisions

A package MAY declare solution decisions containing local ID, question,
required flag, and optional allowed answers.

Answers are supplied as a mapping from package ID to decision ID and non-empty string answer. Unknown packages, unknown decision IDs, non-string answers, and answers outside declared options are invalid.

Resolution preserves unanswered declarations. A project has:

- `configuration_status: selected` when every package has an explicit
  configuration selection;
- `configuration_status: review` when examples are only unreviewed placeholders;
- `status: ready` only when configuration is selected, no required decision is
  unanswered, and no implementation-profile choice requires review; and
- `status: needs-input` otherwise.

Unanswered decisions and unselected configuration do not disappear or silently
become defaults. Execution engines SHOULD refuse consequential implementation
choices while project status is `needs-input`.

### 9.1 Completion scope and verification

Implementation readiness and completion are independent. An optional input
conforming to `completion-scope-input.schema.json` records project-local scope
items for selected packages.

A component item references the package's declared `acceptance` component and
selects either all material or a named subset. A subset MUST name included
references and MAY record deferred or excluded references. A criterion item
states an observable project-local expectation and marks it `included`,
`deferred`, or `excluded`.

The runtime MUST validate selected package and component relationships,
project-local item ID uniqueness, and non-overlapping included, deferred, and
excluded references. Because acceptance components may be arbitrary Markdown,
the runtime does not claim that a named reference exists inside the prose.

Every selected package needs at least one included component or criterion item
for `completion_scope_status: recorded`. Otherwise the resolved scope lists the
package under `uncovered_packages` and reports `review`. Completion-scope review
does not change project input readiness, but an implementing agent MUST NOT
claim verified completion while selected packages remain uncovered.

Resolution creates `verification-state.yaml` only when missing. It binds to a
canonical digest of `completion-scope.yaml` and creates one result for every
included criterion or component item. Non-`not-run` results require evidence.
Runtimes MUST detect a stale scope digest, missing or extra item results, and a
recorded status that contradicts deterministic derivation.

Evidence MAY describe code and test results or observable external state such
as created resource identifiers, permission checks, queries against known data,
delivered messages, screenshots, or platform audit records. Protocol validity
does not establish that the evidence is truthful or sufficient.

Core derived completion statuses are `scope-review`, `not-started`,
`in-progress`, `failed`, `verified-with-gaps`, and `verified`. Any failure yields
`failed`; unfinished included items yield `not-started` or `in-progress`; a
partial result or explicit deferral yields `verified-with-gaps`; only all-pass
evidence with no deferral yields `verified`. Exclusions narrow the stated scope
and do not themselves create a verification gap.

### 9.2 Artifact dispositions

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

### 9.3 Implementation targets

Technical preferences MAY contain `implementation_targets` conforming to
`technical-preferences.schema.json`. A target declares:

- a project-local ID;
- a namespaced target kind such as `org.seedspec.target.hosting`;
- a namespaced provider or product target ID; and
- one or more guidance references to components, artifacts, or implementation
  resources in selected packages.

Every guidance reference MUST resolve. Referenced artifact guidance MUST have a
`selected` disposition. Component guidance is preserved package context and
does not require an artifact disposition. Implementation-resource guidance
MUST name an author-declared resource and MUST be resolved through the resource
lifecycle before its contents are loaded.

An implementation target is strong user-supplied planning context. It does not
prove that a realized solution is compatible with, deployable to, or accepted
by that target. Providers remain independent of SeedSpec core, and the
implementing agent remains responsible for applying the guidance to the actual
environment.

## 10. Composition: `declaration-review-v1`

Given one root package and zero or more additions, conforming runtimes perform
these steps in order:

1. Validate every package, referenced file, configuration example, semantic
   declaration, path, and digestability rule.
2. Require one root and unique selected package IDs. Package `kind` does not
   constrain composition position.
3. Sort selected additions by package ID using ascending UTF-8 byte order. This
   is deterministic recording order, not implementation or dependency order.
4. Record every provided capability declaration with its declaring package.
   Multiple declarations for one ID remain visible.
5. For every root or addition requirement, record zero or more declared
   provider candidates and compare each exact revision with `tested_against`.
6. Record `no-declared-provider`, `multiple-declared-providers`,
   `self-declared-provider`, and `revision-difference` issues as applicable.
7. Record matched package conflicts, capability conflicts, and deterministic
   declared requirement cycles as review context.
8. Resolve implementation-profile preferences. Preserve every candidate, make
   a recorded preference prominent, and require user review when a selected
   package has multiple candidates without a preference.
9. Generate the resolved handoff without treating those review records as
   installation gates.

CLI argument order has no semantic effect. Structural invalidity, unsafe
content and duplicate package selection remain errors.
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
├── implementation-resources.yaml
├── implementation-resource-state.yaml
├── implementation-resources/
├── implementation-profile-state.yaml
├── implementation-profiles/
├── implementation-notes.md
├── verification-report.md
├── completion-scope.yaml
├── verification-state.yaml
├── resolved-spec.md
├── resolved-config.yaml
├── dependencies.lock.yaml
└── additions/
```

`project.yaml` conforms to `packages/protocol/schemas/v0.1/project.schema.json`. It records combined readiness, `selected` or `review` configuration status, `not-declared`, `recorded`, or `review` implementation-profile status, independent `recorded` or `review` completion-scope status, `no-declared-concerns` or `review` declaration status, `recorded` or `review` artifact status, exact root and addition references, and handoff file locations. Declaration status summarizes package evidence only; it is not an implementation-compatibility verdict. Artifact status is `review` while any declared artifact remains `unreviewed`; it does not make every optional artifact a product-readiness gate.

`components.yaml` conforms to `packages/protocol/schemas/v0.1/component-index.schema.json`. It records every protocol-recognized optional component and its source and resolved paths. Resolution copies component files beneath `.seedspec/components/<package-id>/<component-name>/` and assigns deterministic review timing such as `before-planning` or `before-completion-claim`. Preservation and review timing do not activate component content or make author guidance authoritative.

`artifacts.yaml` conforms to `packages/protocol/schemas/v0.1/artifact-index.schema.json`. It records every selected package's artifact metadata, relationships, deterministic review timing, and `selected`, `declined`, `deferred`, or `unreviewed` disposition. Execution artifacts also record that activation requires specific user direction. Resolution copies package-local artifacts beneath `.seedspec/artifacts/<package-id>/<artifact-id>/` and records both the source package path and resolved path regardless of disposition. Remote URLs remain URLs and are not fetched. Materialization preserves auditability and later choice without activating an artifact-specific workflow.

`implementation-resources.yaml` conforms to
`implementation-resource-index.schema.json`. It preserves each selected
package's additional-guidance policy, catalogs, author-selected resource
metadata, canonical references, capability and target applicability, and copied
bundled fallbacks. `implementation-resource-state.yaml` conforms to
`implementation-resource-state.schema.json`, binds to the exact index digest,
and records canonical, bundled, fallback, unavailable, loaded, and skipped
state. Resource use state is local telemetry; the protocol does not transmit it.

`implementation-profile-state.yaml` conforms to
`implementation-profile-state.schema.json`. It is the single project-level
record for every selected package's kind hint, candidate profiles,
prerequisites, blockers, tradeoffs, and preferred profile when supplied. Each
package has at most one preferred profile. `implementation-profiles/` contains
copied profile guidance so the handoff remains durable without the source
package.

`dependencies.lock.yaml` conforms to `packages/protocol/schemas/v0.1/lock.schema.json`. It records exact package digests, deterministic addition order, every capability declaration, every requirement's declared provider candidates and revision comparisons, and all composition review records. It does not claim a provider is installed or that a capability exists in the actual realization.

`resolved-config.yaml` conforms to `packages/protocol/schemas/v0.1/resolved-config.schema.json`. It preserves root configuration, addition configurations keyed by package ID, and each configuration's `example-unreviewed`, `example`, or `custom` selection provenance. Answered decisions and technical preferences remain separate namespaces. Technical preferences remain extensible while the optional `implementation_targets` envelope receives core structural and reference validation.

`completion-scope.yaml` conforms to `completion-scope.schema.json` and records
included, deferred, excluded, and uncovered completion context.
`verification-state.yaml` conforms to `verification-state.schema.json`, remains
bound to the exact scope digest, and is created only when missing so resolution
does not erase implementation evidence. `verification-report.md` remains the
human-readable detailed evidence companion.

`resolved-spec.md` is human- and agent-readable solution intent.
`agent-guide.md` explains how to interpret it. `implementation-notes.md`,
`verification-report.md`, and `verification-state.yaml` are created only when
missing so later resolution does not erase project memory. Notes may record
code mappings, architecture, external resource identifiers, configured state,
and material deviations. A changed scope intentionally makes preserved
verification state stale until an agent reconciles it.

## 13. Conformance

The reference runtime's format checks:

1. pass every applicable case in `conformance/cases.yaml`;
2. produce schema-valid project and lock documents;
3. calculate identical package digests;
4. produce the declared deterministic addition order;
5. return the specified stable error code for negative cases.

Human-readable error wording may vary. Error codes used by the alpha suite keep the reference tooling testable.

Schema validation alone is insufficient because content safety, digests,
deterministic declaration analysis, review records, reference integrity, and
decisions require semantic validation.

## 14. Trust and non-goals

Protocol validity does not mean a package is safe, accurate, certified, legally usable, or faithfully implementable. Marketplaces may add review, certification, signatures, reputation, malware scanning, and policy, but those claims remain outside the neutral package format.

Protocol 0.1 does not define package registries, related-solution or
realization ranking, guidance-catalog search or ranking, signing, capability
delegation, provider selection, package dependency acquisition,
update/migration execution, eval execution, automatic artifact or tool
activation, telemetry transmission, continuous synchronization with code or
external systems, or code-generation adapters.
