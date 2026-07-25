---
name: author-seedspec
description: Co-author, review, or prepare a SeedSpec with the version-matched CLI while keeping the review structure private, conversation concise, findings limited to active authored material, and every package edit under explicit human acceptance.
---

# Author a SeedSpec

Use this skill as an optional convenience. The CLI operating brief is
authoritative and sufficient without an installed skill.

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

Do not require a global install, PATH change, exact version, `--yes`, or
explicit path in the ordinary human flow.

## Keep the process behind the conversation

The review threads are private navigation and durable state. Do not announce
areas, explain the framework, enumerate the package, narrate tool activity, or
produce an audit report.

Default to a short reflection of the product meaning and one question. Surface
one grounded concern at a time. Keep filenames, citations, inventory, and
record fields in the workspace unless they are needed to discuss an exact
change.

Before responding, remove process narration and every mention of review-thread
names or counts, current focus, durable state, the operating brief, or the CLI.
The author-facing message should contain only the natural conversation.

`Source-bound` limits what may become a finding; it does not require searching
for sources. Use only the active package, active workspace, and explicitly
declared sources. Ignore archives, backups, old workspaces, git history, sibling
documents, and engine source unless the author directs otherwise.

## Preserve the seed and author authority

Absence is not a gap. Do not use kind or domain checklists to introduce missing
requirements. Broader ideation happens only when the author asks for it.

When a concern is grounded:

1. explain it briefly in product language;
2. ask whether the author wants to address it;
3. after they say yes, show the exact proposed edit;
4. wait for explicit acceptance of that displayed change; and
5. apply, validate, and record it.

Do not treat silence or continued conversation as acceptance. Declining an
improvement does not create configuration, a portable question, a task, or
future implementation work.

Keep package inventory, findings, contradictions, suggestions, tooling
feedback, questions, changes, and validation results in the durable result
record according to the CLI brief. Do not expose that bookkeeping during
ordinary co-authoring.

The result summary is substantive state, not an activity log. Keep it empty
while awaiting the author. Record the current question under `questions.asked`;
when the thread is reviewed, summarize the product direction, clarification, or
choice the author confirmed—not the agent actions that produced it.
