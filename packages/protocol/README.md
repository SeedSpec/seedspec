# `@seedspec/protocol`

Canonical schemas and version metadata for the SeedSpec Protocol.

SeedSpec packages describe intended outcomes, context, configuration,
capabilities, optional implementation resources, and observable success while
leaving execution to an implementing agent under the end user's direction.

## Install

```bash
npm install @seedspec/protocol
```

## Use

```js
import {
  protocolSchemaNames,
  protocolVersion,
  schemaDirectory
} from "@seedspec/protocol";
```

Individual schemas are exported beneath `@seedspec/protocol/schemas/v0.1/`.
The package contains declarative schemas and metadata only; it does not execute
SeedSpec package content.

Protocol `0.1` is a design alpha. Pin exact prerelease versions when building
interoperable tools.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
