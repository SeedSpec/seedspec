# `@seedspec/runtime`

Reference runtime for SeedSpec Protocol 0.4 package validation, inspection,
flattening, content digests, and check reports.

```bash
npm install @seedspec/runtime
```

```js
import {
  checkPackage,
  flattenManifest,
  inspectPackage,
  validatePackage
} from "@seedspec/runtime";

const record = await validatePackage("./package");
const inspection = await inspectPackage(record.root);
const flattenedSpec = flattenManifest(record);
const check = await checkPackage(record.root);

console.log(inspection.id, inspection.version, inspection.digest, check.status);
```

Validation resolves `SPEC.md` frontmatter over optional `seedspec.yaml`, expands
one-level sections, checks local references, validates bundled children, and
records provenance. Inspection also reports success anchors and unanchored
criteria. `checkPackage` reports which claims are enforceable and, when given
external evidence or an evaluator, whether a trusted runner satisfied them.

None of these APIs execute package content or fetch format URLs. An evaluator
passed to `checkPackage` is caller-supplied and runs against a workspace.
