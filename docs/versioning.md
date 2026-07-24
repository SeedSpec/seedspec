# SeedSpec versioning

> **Informative release guidance.** Normative compatibility requirements are
> defined by the protocol specification and schemas.

SeedSpec keeps distinct identity domains because a protocol contract, a package
authored by somebody else, and implementation evidence mean different things.
For coordinated first-party releases before `1.0.0`, the protocol bundle,
conformance suite, runtime, and CLI share one release version.

Not every audience needs every identifier. A package adopter normally needs the
package version and a compatible CLI; an author also needs the declared protocol
family; an independent tool implementer or evaluator records the exact schema,
conformance-suite, runtime, and CLI versions. The domains remain separate even
when a user interface presents a simpler compatibility summary.

| Version | Identifies | Current value |
| --- | --- | --- |
| Protocol family | The package and handoff vocabulary declared in protocol documents | `0.2` |
| Exact protocol release | The release manifest binding language, schemas, operations, conformance, and compatibility | `0.2.0` |
| Schema package | The exact schemas and protocol metadata in `@seedspec/protocol` | `0.2.0` |
| Conformance suite | The exact indexed cases, fixtures, and expected results | `0.2.0` |
| Runtime | One release of the reference JavaScript implementation | `0.2.0` |
| CLI | One release of the public command-line interface | `0.2.0` |
| SeedSpec package | One author-controlled version of a portable solution package | Declared in `seedspec.yaml` |

`protocol_version: "0.2"` states that a package uses the Protocol 0.2 family.
It does not identify the exact release bytes. Reproducible tooling should
pin the exact `@seedspec/protocol` release and record the digest of its
`protocol-release.json`. That manifest binds the schemas, normative documents,
operation set, complete conformance corpus, compatible first-party tooling, and
predecessor compatibility in one identity.

Run the first-party CLI to obtain the complete implementation version record:

```bash
npx --yes @seedspec/cli@0.2.0 version --json
```

Numeric releases use npm's default `latest` distribution tag. Integrations
should still use exact package versions and record the full version output with
conformance results.

Exact-release compatibility and migration requirements are defined in
`docs/migrations.md`. A shared protocol family does not imply that exact
releases can be substituted without revalidation.

Pre-1.0 releases may contain incompatible corrections. A release that
changes schema acceptance, semantic validation, stable error classification,
deterministic output, or conformance expectations must increment the affected
coordinated release version. Editorial corrections that do not alter the
contract may be published with the next patch release.
