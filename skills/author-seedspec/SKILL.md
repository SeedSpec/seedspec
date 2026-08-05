---
name: author-seedspec
description: Co-author, review, or prepare a SeedSpec with the version-matched CLI, keeping the review structure private, the conversation concise, findings limited to active authored material, and every package edit under explicit human acceptance. This is the default authoring skill whenever the SeedSpec CLI can be run; use shape-solution-intent only when it cannot.
---

# Author a SeedSpec

The CLI operating brief is authoritative. This skill routes you to it and
carries the few habits that matter most; when the two ever differ, the brief
wins.

## Begin or resume

From the SeedSpec project, run:

```sh
npx @seedspec/cli author review
```

Follow the complete operating brief it returns. Do not search online guidance
or inspect the SeedSpec implementation to supplement that brief.

For a copyable starter, run:

```sh
npx @seedspec/cli author prompt
```

Default shaping develops a loose idea into a practical planning baseline. Use
`author prompt --deep` for a rigorous one-question-at-a-time decision-tree
interview. Use `author prompt --minimal` when the supplied material should be
treated literally with only necessary shaping. Expansion remains optional
until accepted.

Do not require a global install, PATH change, exact version, `--yes`, or
explicit path in the ordinary human flow.

## Keep the process behind the conversation

The review threads are private navigation and durable state. Do not announce
areas, explain the framework, enumerate the package, narrate tool activity, or
produce an audit report.

Default to a reflection of the product meaning and one question. For default
shaping, ask whether the author wants reasonable recommended defaults or deeper
discovery. Surface one grounded concern at a time. Keep filenames, citations, inventory, and
record fields in the workspace unless they are needed to discuss an exact
change.

Before responding, remove process narration and every mention of review-thread
names or counts, current focus, durable state, the operating brief, or the CLI.
The author-facing message should contain only the natural conversation.

`Source-bound` limits what may become a finding; it does not require searching
for sources. Use only the active package, active workspace, and explicitly
declared sources. Ignore archives, backups, old workspaces, git history, sibling
documents, and engine source unless the author directs otherwise.

When attached material contains detailed approved requirements, source
precedence, or unresolved author-owned choices, run:

```sh
npx @seedspec/cli author guidance --topic requirements
```

Use the returned version-matched guidance. Do not copy a fixed requirements
method into this routing skill.

## Preserve the seed and author authority

Absence is not a gap. Do not use kind or domain checklists to introduce missing
requirements. Broader ideation happens only when the author asks for it.

When an authored concept and the selected kind lens support materially
different products, record one clarification candidate before asking the author
to choose. Separate source claims from model inference. Give a recommended
answer. Retrieve available facts instead of asking the author; product decisions
remain theirs. Do not use candidates for routine direction checks, factual
questions, implementation-only forks, or unrelated expansion. After the author
responds, record their disposition. Accepted meaning enters the package only
through the normal proposal, decision, and application flow.

Use an approved roadmap or vision to bound scope. Do not grant authority to a
discovered file by filename alone. Keep product behavior separate from later
technical architecture.

Use a frozen clarification probe only when the author explicitly requests one
and an approved runner is available. Prepare the bundle, verify it immediately
before execution, and record the result. Do not call a model during preparation.
Do not retry a failed one-attempt probe without new authorization.

When a concern is grounded:

1. explain it briefly in product language;
2. ask whether the author wants to address it;
3. after they say yes, record the exact replacement with `author propose`;
4. show the proposal ID, path, and exact wording;
5. wait for explicit acceptance or rejection;
6. record that decision with `author decide`; and
7. apply only an accepted proposal with `author apply`.

Do not treat silence or continued conversation as acceptance. Declining an
improvement does not create configuration, a portable question, a task, or
future implementation work. Before application, the author can reject a
previously accepted proposal. The workspace retains both decisions.

## Record through the commands

Never hand-edit workspace files. Each mutation takes the workspace revision
from the review or previous receipt and returns the next revision. Run
mutations sequentially. Each command takes one JSON payload on stdin and
returns a compact receipt:

```sh
npx @seedspec/cli author record --json -         # findings, questions, inventory
npx @seedspec/cli author answer --json -         # the author's answer, or a decline
npx @seedspec/cli author attach-source --json -  # material the review may cite
npx @seedspec/cli author candidate --json -      # one consequential ambiguity
npx @seedspec/cli author candidate-decide --json - # author disposition
npx @seedspec/cli author probe-prepare --output <directory> --json - # freeze
npx @seedspec/cli author probe-check --bundle <directory> # preflight
npx @seedspec/cli author probe-record --json -   # retain the result
npx @seedspec/cli author propose --json -        # exact before and after text
npx @seedspec/cli author decide --json -         # explicit author decision
npx @seedspec/cli author apply --json -          # apply one accepted proposal
npx @seedspec/cli author reviewed --json -       # close the thread
```

`author reviewed` refuses to close a thread with an unsettled candidate,
accepted meaning not applied to the package, or an unsettled proposal. It then
runs validation, linting, and the digest itself. Run `author schema result`,
`author schema candidates`, `author schema probe-brief`, `author schema
probe-result`, `author schema probe-runs`, and `author schema changes` to inspect
the durable shapes.

Keep that bookkeeping out of the conversation.

The result summary is substantive state, not an activity log. Keep it empty
while awaiting the author. Record the current question under `questions.asked`;
when the thread is reviewed, summarize the product direction, clarification, or
choice the author confirmed—not the agent actions that produced it.
