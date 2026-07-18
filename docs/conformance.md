# Alpha format checks

The alpha format suite is indexed by `conformance/cases.yaml` and validated by `packages/protocol/schemas/v0.1/conformance.schema.json`.

Run the reference implementation:

```bash
npm run conformance
```

The index is intentionally runtime-neutral. Paths are relative to the index. Each case declares an operation, input packages, and expected success or stable error code. Resolution cases may also assert deterministic feature order and project status. Resolved-state checks include `artifacts.yaml` when artifacts are present or absent.

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

The suite keeps the reference toolchain deterministic while the design is exercised. It is not a public certification or a claim that a generated application is correct.

## Adding cases

A behavioral correction that changes whether an artifact passes, its error classification, digest, feature order, or resolved state requires both:

1. a new conformance case demonstrating the boundary; and
2. an explicit format-revision decision;

Fixtures should isolate one rule where practical. Negative cases assert stable error codes rather than implementation-specific prose.

## Operations in suite 1.1.0

- `validate` checks structural, referenced-file, configuration, artifact-reference, relationship, semantic, and content-safety behavior without invoking artifact adapters.
- `digest-stability` checks repeated calculation over identical package bytes.
- `resolve` checks graph behavior and resolved project state.

Future suite versions may change as alpha experiments expose better package and handoff semantics.
