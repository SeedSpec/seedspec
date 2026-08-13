# SeedSpec Think harness

This is a Cloudflare Think agent that calls the same `seedspec check` report as
the CLI and Pi extension. It does not execute package scripts.

Workers cannot spawn the Node evaluator. Run the local preview server as the
check authority, then point the agent at it:

```bash
npx seedspec preview ./examples/daily-pipeline/package \
  --evaluate ./examples/daily-pipeline/evaluator/evaluate.mjs \
  --workspace ./examples/daily-pipeline/fixtures/reference \
  --port 8787
```

Set `CHECK_URL=http://127.0.0.1:8787` for the Think agent. Completion tools
refuse to finish unless `GET /api/check` returns `"status": "pass"`.

The protocol and CLI stay usable without this app. Think is one consumer of
the open check interface.
