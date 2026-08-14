# `@seedspec/protocol`

Schemas, normative documents, release metadata, and the offline conformance
bundle for SeedSpec Protocol 0.4.

```bash
npm install @seedspec/protocol
```

```js
import {
  conformanceSuiteVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolSchemaNames,
  protocolVersion,
  schemaDirectory
} from "@seedspec/protocol";
```

Protocol 0.4 requires `SPEC.md`. It accepts optional root `seedspec.yaml` as a
base manifest. Required package fields are `id`, `name`, and `version`. `kind`
is optional. It does not parse previous protocol families.

Schemas are exported under `@seedspec/protocol/schemas/v0.4/`. Normative
documents are exported under `@seedspec/protocol/documents/`. The conformance
suite source is `conformance/` in this package; the digest-pinned bundle is
`conformance-bundle.json`.

The package is experimental. Pin exact versions and revalidate packages after
every update.
