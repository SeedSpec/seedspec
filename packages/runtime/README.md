# `@seedspec/runtime`

Reference JavaScript runtime for validating, inspecting, resolving, and
verifying SeedSpec packages.

## Install

```bash
npm install @seedspec/runtime@next
```

## Example

```js
import { auditPackage, inspectPackage, validatePackage } from "@seedspec/runtime";

const record = await validatePackage("./my-seedspec-package");
const inspection = await inspectPackage(record.root);

console.log(inspection.id, inspection.version, inspection.digest);

const audit = await auditPackage("./my-seedspec-package", {
  toolVersion: "my-authoring-tool@1.0.0"
});
console.log(audit.current?.instructions);
```

Validation establishes package structure and content identity. It does not
establish authorship, publisher identity, compatibility with an unseen
environment, safety to execute, or permission for external effects.

Protocol `0.1` is a design alpha. Pin exact prerelease versions when building
interoperable tools.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
