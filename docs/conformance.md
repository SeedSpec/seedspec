# SeedSpec Protocol 0.1 conformance suite

> **Normative conformance contract.** Together with the protocol specification
> and versioned schemas, the indexed cases and fixtures form the Protocol 0.1
> design-alpha release bundle.

The suite is indexed by `conformance/cases.yaml`, validated by
`packages/protocol/schemas/v0.1/conformance.schema.json`, and bound to the
declared `protocol_version` and `suite_version`.

Run the reference implementation:

```bash
npm run conformance
```

The index and fixtures are self-contained and runtime-neutral. Paths are
relative to the index and MUST remain within the conformance directory. Each
case declares an operation, input packages, and expected success or stable
error code. Resolution cases may also assert deterministic addition order,
implementation-profile preferences, and project status. Resolved-state checks
include `artifacts.yaml` and `implementation-profile-state.yaml`.

Core SeedSpec conformance and adapter conformance are separate. The core suite verifies artifact declaration, references, relationships, materialization, and schema-valid indexing. Adapter tests verify native formats such as ProductSpec by invoking their upstream validators explicitly.

## What to record

A runtime experiment should record:

- runtime name and version;
- protocol version;
- conformance-suite version and commit;
- platform and YAML/JSON parser versions;
- passed, failed, and skipped cases;
- package digests produced for digest cases;
- any extension semantics enabled during the run.

The suite tests protocol interoperability. It is not a public certification, a
claim that agent execution is deterministic, or evidence that a realization
satisfies its core intent.

## Adding cases

A behavioral correction that changes whether an artifact passes, its error classification, digest, addition order, or resolved state requires both:

1. a new conformance case demonstrating the boundary; and
2. an explicit format-revision decision;

Fixtures should isolate one rule where practical. Negative cases assert stable error codes rather than implementation-specific prose.

## Operations in suite 1.9.0

- `validate` checks structural, referenced-file, configuration, artifact-reference, relationship, semantic, and content-safety behavior without invoking artifact adapters.
- `digest-stability` checks repeated calculation over identical package bytes.
- `resolve` checks deterministic declaration analysis, review records, and resolved project state.

Design-alpha corrections increment `suite_version` and may change expected
results. A conformance report is incomplete unless it identifies the exact
suite version and source revision used.
