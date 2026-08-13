# Pipeline evaluation

This module names the independent checks a trusted runner must execute. The
checks live outside the package. Implementing agents may report coverage. They
cannot certify these claims.

Check IDs match success criteria:

- `contract`
- `setup-resources`
- `setup-idempotency`
- `reporting-query`
- `value-message`
- `message-idempotency`
- `unsafe-link`
- `no-data`
- `visible-retry`
- `conflict-safety`

Run the evaluator against a workspace that exports
`createPipelineBriefing(dependencies)` from `src/pipeline-briefing.mjs`.
