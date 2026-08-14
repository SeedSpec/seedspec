# `@seedspec/protocol`

Schemas, normative documents, release metadata, and the offline conformance
bundle for SeedSpec Protocol 0.4.

```bash
npm install @seedspec/protocol
```

```js
import {
  conformanceBundlePath,
  conformanceSuiteVersion,
  protocolDocumentDirectory,
  protocolPackageVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolReleasePath,
  protocolSchemaNames,
  protocolVersion,
  schemaDirectory
} from "@seedspec/protocol";
```

`protocolVersion` is the family. `protocolRelease.release_id` is the exact
release. `protocolReleaseDigest` is the digest of `protocol-release.json`.
`schemaDirectory` and `protocolDocumentDirectory` are on-disk paths in this
package. `conformanceBundlePath` is the digest-pinned suite.

Protocol 0.4 requires `SPEC.md`. It accepts optional root `seedspec.yaml` as a
base manifest. Required package fields are `id`, `name`, and `version`. `kind`
is optional. It does not parse previous protocol families.

Schemas are exported under `@seedspec/protocol/schemas/v0.4/`. Normative
documents are exported under `@seedspec/protocol/documents/`. The conformance
suite source is `conformance/` in this package; the digest-pinned bundle is
`conformance-bundle.json`.

The package is experimental. Pin exact versions and revalidate packages after
every update.
