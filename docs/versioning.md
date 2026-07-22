# SeedSpec versioning

> **Informative release guidance.** Normative compatibility requirements are
> defined by the protocol specification and schemas.

SeedSpec uses separate version domains so that a protocol contract, its test
suite, and first-party implementations can evolve without implying false
compatibility.

| Version | Identifies | Current value |
| --- | --- | --- |
| Protocol family | The package and handoff vocabulary declared in protocol documents | `0.1` |
| Schema package | The exact schemas and protocol metadata in `@seedspec/protocol` | `0.1.0-alpha.4` |
| Conformance suite | The exact indexed cases, fixtures, and expected results | `2.0.0` |
| Runtime | One release of the reference JavaScript implementation | `0.1.0-alpha.5` |
| CLI | One release of the public command-line interface | `0.1.0-alpha.6` |
| SeedSpec package | One author-controlled version of a portable solution package | Declared in `seedspec.yaml` |

`protocol_version: "0.1"` states that a package uses the Protocol 0.1 family.
It does not identify every design-alpha correction. Reproducible tooling should
also pin the exact `@seedspec/protocol` and conformance-suite versions it
supports.

Run the first-party CLI to obtain the complete implementation version record:

```bash
npx --yes @seedspec/cli@next version --json
```

The `next` npm distribution tag tracks the current public design-alpha
packages. It is convenient for evaluation, not a reproducibility boundary.
Integrations should use exact prerelease package versions and record the full
version output with conformance results.

Design-alpha revisions may contain incompatible corrections. A release that
changes schema acceptance, semantic validation, stable error classification,
deterministic output, or conformance expectations must increment the affected
package and suite versions. Editorial corrections that do not alter the
contract need not change the protocol family.
