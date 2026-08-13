# SeedSpec documentation

SeedSpec Protocol 0.4 is an experimental reset. Start with these documents:

- [Language definition](01-language.md)
- [Protocol specification](protocol.md)
- [Operations](operations.md)
- [Migration policy](migrations.md)
- [0.4 reset decision](decisions/0023-protocol-0.4-package-reset.md)

The 0.4 schema and conformance suite are the executable contract:

- [`seedspec.schema.json`](../packages/protocol/schemas/v0.4/seedspec.schema.json)
- [Conformance cases](../conformance/v0.4/cases.yaml)

Runtime tooling on that contract:

- [`seedspec check`](operations.md)
- [`seedspec init`](operations.md), [`project`](operations.md), and [`skill`](operations.md)
- [Daily pipeline example](../examples/daily-pipeline/README.md)

Other documents in this directory describe earlier authoring, runtime, and
composition experiments. They are design history, not Protocol 0.4 behavior.
Update or replace them before treating them as current product documentation.
