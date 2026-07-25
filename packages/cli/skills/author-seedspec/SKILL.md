---
name: author-seedspec
description: Guide collaborative SeedSpec creation, review, and preparation by driving the version-matched `npx @seedspec/cli author` workflow beside a human author. Use when an agent is asked to create, co-author, review, improve, harden, or prepare a SeedSpec package while preserving explicit author authority over proposed document changes.
---

# Author a SeedSpec

Use this skill as an optional convenience layer over the SeedSpec CLI. The CLI's
current work order is authoritative and sufficient by itself; never make this
skill a prerequisite for authoring.

## Begin or resume

From the project containing the SeedSpec package, run:

```sh
npx @seedspec/cli author
```

Follow the `Next:` command it returns. Usually this is:

```sh
npx @seedspec/cli author review
```

Read the complete output before proposing work. It contains the
version-matched instructions and current package state. Use `--summary` only
when the user explicitly wants a shorter human-facing status; it intentionally
hides instructions the agent needs.

If the CLI cannot locate the package, inspect the reported candidates or pass
the package directory once. Do not require the user to modify their PATH or
install the package globally.

## Preserve author authority

Treat the human as the author and the agent as a co-author.

- Inspect the supplied sources and current package before recommending changes.
- Clearly distinguish supplied source material, author decisions, mechanical
  transformations, and agent-proposed content.
- Ask no more than three material questions at a time.
- Explain the consequence of each unresolved decision.
- Do not write agent-proposed document changes until the author explicitly
  accepts them.
- Keep speculative candidates outside the deliverable package.
- Never imply that silence, continued conversation, or approval of one change
  accepts unrelated changes.

Mechanical state updates required by the CLI are not authored content. Keep
them narrowly scoped and do not use them to smuggle in document changes.

## Work through the CLI

Use the command named by the current work order. The authoring surface includes:

```sh
npx @seedspec/cli author
npx @seedspec/cli author review
npx @seedspec/cli author questions
npx @seedspec/cli author check
npx @seedspec/cli author history
npx @seedspec/cli author evaluate
npx @seedspec/cli author pack
npx @seedspec/cli author help
```

Do not substitute remembered procedures for the instructions emitted by the
installed CLI version. When a command asks for a pass result, record decisions,
evidence, accepted changes, open questions, and the resulting state in that
result. Validate the package after accepted edits.

The package is the durable source of truth. Conversation context may help make
decisions, but it does not replace recorded artifacts.

## Use specialized guidance only when available

Some projects may also provide skills for shaping intent or creating particular
package kinds. Use those when relevant and already available. Their absence
must not block the CLI-led authoring workflow.

Do not install skills, run package-provided executable material, upload package
contents, or invoke external model services unless the user has separately
authorized that action.

## Hand back clearly

At the end of a working session, tell the author:

- what was inspected;
- which changes they accepted and were written;
- which decisions remain open;
- the exact next `npx @seedspec/cli author ...` command.
