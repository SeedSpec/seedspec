# Daily pipeline check fixture

A Protocol 0.4 package plus an independent evaluator and two workspaces.
This is a `seedspec check` fixture, not a product example and not protocol
conformance.

- `package/` — authored spec. Validation does not execute it.
- `evaluator/evaluate.mjs` — caller-supplied evidence. Lives outside the package.
- `fixtures/reference/` — known-good workspace. Check must pass.
- `fixtures/weak/` — known-weak workspace. Check must fail.

```bash
node packages/cli/bin/seedspec.js check packages/runtime/test/daily-pipeline/package \
  --evaluate packages/runtime/test/daily-pipeline/evaluator/evaluate.mjs \
  --workspace packages/runtime/test/daily-pipeline/fixtures/reference
```
