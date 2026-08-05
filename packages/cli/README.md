# `@seedspec/cli`

Command-line interface for authoring and using portable, agent-ready SeedSpec
packages.

The CLI helps authors shape and review seeds, helps adopters inspect and
configure them, and prepares a provenance-preserving handoff for an implementing
agent. It does not embed a model or treat package validity as a guarantee of
semantic completeness or realization quality.

## Run without installing

```bash
npx @seedspec/cli author
npx @seedspec/cli version
```

Human-facing commands use npm's `latest` tag and allow npm to ask before the
first download. Pin the package version and add `--yes` for unattended tests or
automation.

## Optional global install

```bash
npm install --global @seedspec/cli
seedspec --help
```

Common entry points:

```bash
seedspec author
seedspec author prompt [--deep|--minimal]
seedspec author status
seedspec author review [--summary]
seedspec author guidance [--topic <topic>]
seedspec author questions
seedspec author candidates
seedspec author probes
seedspec author check
seedspec author history
seedspec author evaluate
seedspec author pack
seedspec author help
seedspec author create <package-path> [--target <depth>] [--state <directory>] [--json]
seedspec prepare <package-path> [--state <directory>]
seedspec review <package-path> [--area <area>]
seedspec publish-check <package-path> [--state <directory>]
seedspec eval <package-path> [--output <directory>]
seedspec pack <package-path> [--output <directory>]
seedspec skills list
seedspec skills export --output .agents/skills
seedspec upgrade <package-path> --to 0.3.1 --dry-run
seedspec validate <package-path>
seedspec version --json
seedspec doctor [--full] [--json]
seedspec review <package-path>
seedspec review <package-path> --area coherence
seedspec review <package-path> --status
seedspec docs authoring
seedspec inspect <package-path> --json
seedspec begin <package-path-or-github-url>
seedspec shell <package-path-or-github-url>
seedspec shell <package-path-or-github-url> --jsonl
seedspec digest <package-path>
seedspec capability-conformance <package-path> <capability-id> [--result <yaml>]
seedspec conformance [cases.yaml] [--json] [--output <report.json>]
seedspec context discover <package-path> --integration <path> [--json]
seedspec context validate <package-path> <module> --integration <path> [--adapter <id>] [--json]
seedspec context author <package-path> --integration <path> [--write] [--json]
seedspec context prepare <project-path> --request <yaml> --output <directory> [--integration <path>] [--json]
seedspec context record-use <prepared-context-path> --input <json> [--output <json>] [--json]
seedspec docs implementing
seedspec prompt [package-path-or-github-url]
```

`seedspec begin` is the read-only agent handoff. It validates the package and
surfaces package-author intent, applied-intent, configuration,
implementation-profile, context-module, ordered-task, supporting-material,
trust, and verification-plan choices before implementation begins.

`seedspec shell` keeps one validated package and its declared documentation
corpus active for repeated inspection and deterministic lexical search. The
interactive terminal and JSONL agent stream use the same read-only session
engine. Search results preserve source role, authority, path, heading, and line
metadata. See `seedspec docs shell` for commands and boundaries.

The `context` commands expose the Protocol 0.3 integration lifecycle.
`discover` reads inert integration descriptors. `validate` loads an adapter
only from an explicitly supplied integration. `author` proposes bridge Skills
and changes package files only with `--write`. `prepare` creates a
request-specific digest-bound bundle. `record-use` records consumer-reported
consultation separately.

`begin` and the root package input to `resolve` also accept public GitHub
repository URLs and GitHub `/tree/<ref>/<package-path>` URLs:

```bash
seedspec begin \
  https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec
```

The CLI acquires the selected repository revision into an isolated temporary
directory, validates the requested package, and removes the acquisition after
the command. It does not run package scripts, initialize submodules, load
package-provided skills, or activate package content. Remote acquisition
currently supports public `https://github.com` URLs only.

`seedspec author` is the human authoring front door. It discovers an existing
workspace or conventional `seedspec/` and `authoring/` layout from the current
directory, initializes adjacent authoring state when a package exists, and
shows the current work plus the most relevant next command. Paths are optional
for authoring commands when discovery finds one unambiguous project. It also
mentions the bundled `author-seedspec` skill and tells the agent to ask before
exporting it into the project. The skill is optional; declining it or using an
agent without skill support does not change the workflow.

`seedspec author prompt` prints the copyable default shaping prompt for a person
to give an agent. It asks whether the author wants a practical first
specification with recommended defaults or deeper discovery. `--deep` starts
the rigorous decision-tree posture directly. `--minimal` treats the supplied
material as the authoring boundary. Suggestions remain outside package meaning
until acceptance.
`author review` prints the complete self-contained operating brief:
role, kind-aware exploration, active context boundary, natural conversation
behavior, private review model, change authority, and durable record rules. The
agent retrieves available facts and asks the author for decisions. It keeps
product behavior separate from later technical architecture.
`author guidance` lists optional depth topics. The `requirements` topic helps an
agent classify supplied requirements, preserve portable meaning, and resolve
explicit author-owned choices without inventing completeness. The `composition`
topic supplies a removable Markdown shape for a declared parent-to-child
integration seam; it does not make those headings protocol requirements.

The `status`, `review`, `questions`, `candidates`, `probes`, `changes`, `check`,
`history`, `evaluate`, and `pack` actions place authoring capabilities under one
discoverable namespace. Exact paths, state directories, revisions, and JSON are
available for agents and automation without defining the beginner experience.

`candidate` records one consequential ambiguity with source claims separated
from model inference. `candidate-decide` records author acceptance, decline,
delegation, deferral, or a decision to retain ambient latitude. Accepted meaning
still requires the ordinary revision-bound document proposal before it becomes
package intent. Candidate IDs are opaque engine-assigned handles. Ordinary
candidate input can omit classification fields; the engine supplies safe
defaults while probe evidence retains richer classification.

`probe-prepare` creates an external, content-addressed clarification bundle
without calling a model. `probe-check` verifies exact package, workspace,
instruction, visibility, and budget identity before execution. `probe-record`
imports one run as a candidate occurrence, no-action result, or quarantined
failure. `probes` shows retained run evidence. No probe mutates package bytes or
asserts semantic equivalence with another run.

The `propose`, `decide`, and `apply` actions keep document mutation behind an
inspectable before/after record and explicit author authority. Applying a stale,
rejected, or undecided proposal fails without changing package bytes. An author
can reject an accepted but unapplied proposal without losing its earlier
decision record. Every CLI mutation requires the latest workspace revision and
runs under a local workspace lock. Its compact receipt returns the next
revision; complete proposal and candidate history remains on disk.

`seedspec prepare` reports deterministic baseline checks, optional guided
review, publish readiness, an optional fresh-agent evaluation, and packing. The
command is resumable from durable state and does not require review completion
or local question closure before a valid seed can be packed.

`seedspec author create` assigns an opaque workspace identity and initializes
portable authoring state around an existing, empty, or invalid draft directory.
It does not require a conforming package and is idempotent for an existing
workspace.

`seedspec author status` returns a versioned, path-independent authoring
workspace snapshot. It includes an opaque workspace identity when state has
been created, a content-derived revision, draft document inventory,
deterministic package status, questions, clarification candidates, and review
passes. It remains readable while ordinary draft content is invalid. Human text
omits opaque IDs and digests unless they are needed; `--json` retains the
complete machine contract.

`seedspec review`
creates or continues a source-bound authoring review outside the distributable
package and prints versioned Markdown instructions for a capable agent. Its
four review threads are private scaffolding, not author-facing wizard steps or
report headings. The same command advances after a reviewed thread; `--area`
targets seed, coherence, success, or supporting-material state. The complete
operating brief is the default output.
`--summary` starts or continues the same pass but emits a shorter human-facing
view, while `--status` is read-only. The CLI does not embed a model or modify
package content. See `seedspec docs authoring` for guidance bundled with the
installed version.

`seedspec publish-check` blocks only on protocol integrity, stable bytes, and a
separate non-placeholder success component. Guided review and local session
questions are advisories. Undecided clarification candidates are advisory;
author-accepted meaning must reach package bytes before publication.
`seedspec eval` creates a digest-bound independent-handoff workspace and agent
instructions without running a model. `seedspec pack` emits the source archive,
versioned inspection and publish-check records, and a digest-bound receipt.
`seedspec skills export` makes the version-matched skills in the CLI package
available to an author's agent.

`seedspec doctor` verifies that the installed CLI, runtime, exact protocol
release, schemas, and bundled conformance corpus agree. `--full` runs every
release-bound conformance case. `seedspec docs implementing` prints the
version-matched package-to-handoff workflow bundled with the CLI.

`seedspec prompt [package-path-or-github-url]` prints a portable prompt for a
human to paste into a tool-capable agent. The prompt directs the agent to run
`npx @seedspec/cli begin ...`; no global install or SeedSpec skill is required.

The protocol is experimental. Discovery or validation never authorizes
package activation or execution.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Why semantic structure matters: [guide](https://github.com/SeedSpec/seedspec/blob/main/docs/semantic-structure.md)
- Context modules: [guide](https://github.com/SeedSpec/seedspec/blob/main/docs/context-modules.md)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
