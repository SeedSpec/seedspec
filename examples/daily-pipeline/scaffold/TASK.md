# Implementation task

Implement the package in `spec/` as a small, executable integration adapter.
Read every file in `spec/` before you make implementation decisions. Treat the
package as the authority for product behavior and acceptance.

Write `src/pipeline-briefing.mjs`. Export this function:

```js
export function createPipelineBriefing(dependencies) {
  return {
    async setup() {},
    async deliver() {}
  };
}
```

The evaluator supplies these dependencies:

```text
clock.now() -> Date
resources.find(kind, identity) -> resource | null
resources.create(kind, identity, definition) -> resource
hubspot.qualifiedPipelineValue({ object, property, date, timezone })
  -> { status: "value", value: number } | { status: "no-data" }
hubspot.dashboardLink(name)
  -> { url: string, stable: boolean, authorized: boolean } | null
slack.hasMessage(idempotencyKey) -> boolean
slack.send({ channel, text, idempotencyKey }) -> message
operations.recordFailure(record) -> void
```

Every dependency method can return a Promise. Await every dependency call.

`resources.find` returns `{ kind, identity, definition }` when a resource
exists. Resource definitions are plain JSON objects. The adapter may select
stable resource identities. The supplied dependencies persist state between
calls.

Use only this workspace. Do not inspect parent directories or look for hidden
tests. Do not install dependencies. You may add visible tests. Run them before
you finish.
