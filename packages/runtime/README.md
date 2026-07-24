# `@seedspec/runtime`

Reference JavaScript runtime for authoring, validating, inspecting, resolving,
and verifying SeedSpec packages.

The runtime supports two deliberately separate results: protocol-aware tools
can determine whether a package is valid, while guided authoring can help a
person or agent examine semantic completeness without presenting that judgment
as protocol conformance.

## Install

```bash
npm install @seedspec/runtime@0.2.0
```

## Example

```js
import {
  auditPackage,
  createAuthorEvaluation,
  inspectCapabilityConformance,
  inspectPackage,
  packPackage,
  preparePackage,
  publishCheckPackage,
  validatePackage
} from "@seedspec/runtime";

const record = await validatePackage("./my-seedspec-package");
const inspection = await inspectPackage(record.root);

console.log(inspection.id, inspection.version, inspection.digest);

const audit = await auditPackage("./my-seedspec-package", {
  toolVersion: "my-authoring-tool@1.0.0"
});
console.log(audit.current?.instructions);

const capability = await inspectCapabilityConformance(
  "./my-seedspec-package",
  "org.example.product.transactions",
  "./transaction-conformance.yaml"
);
console.log(capability.status);
```

The preparation, publish-check, evaluation, and pack functions are headless
operations used by the CLI and suitable for a future web authoring interface.
Their JSON results are versioned, while semantic agent work remains explicit
and outside the runtime.

Validation establishes package structure and content identity. It does not
establish authorship, publisher identity, compatibility with an unseen
environment, semantic completeness, safety to execute, or permission for
external effects.

Resolution preserves package task runbooks in authored order, copies their
package-local references into the handoff, and surfaces them to the implementing
agent. It does not infer a task graph or treat task completion as conformance.

Protocol `0.2` is experimental. Pin exact versions when building interoperable
tools.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Authoring: [guide](https://github.com/SeedSpec/seedspec/blob/main/docs/authoring.md)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
