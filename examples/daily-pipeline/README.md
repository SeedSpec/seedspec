# Daily pipeline briefing example

Protocol 0.4 package, independent evaluator, and known-good / known-weak
workspaces for `seedspec check`.

```bash
node packages/cli/bin/seedspec.js check examples/daily-pipeline/package
node packages/cli/bin/seedspec.js check examples/daily-pipeline/package \
  --evaluate examples/daily-pipeline/evaluator/evaluate.mjs \
  --workspace examples/daily-pipeline/fixtures/reference
node packages/cli/bin/seedspec.js preview examples/daily-pipeline/package \
  --evaluate examples/daily-pipeline/evaluator/evaluate.mjs \
  --workspace examples/daily-pipeline/fixtures/reference
npm run bakeoff
```

`package/` is condition B: structured criteria, anchors, evaluation module, and
a spec-first skill. `package-markdown/` is condition A: the same prose without
those hooks. The evaluator is outside the package and is the verification
authority.
