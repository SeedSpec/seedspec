# Preparing and publishing a SeedSpec package

> **Informative guidance.** These tools prepare portable package bytes and
> evidence about the preparation process. They do not certify package quality,
> publisher identity, or a future realization.

`seedspec prepare` is the resumable author entry point. It orchestrates
protocol checks and the existing guided review without embedding a model or
silently changing the package:

```bash
seedspec prepare <package-path>
seedspec prepare <package-path> --status
```

Run the same command after each agent pass or author decision. Durable state,
not an in-memory wizard cursor, determines what happens next.

## Preparation phases

1. **Baseline** validates package structure, referenced content, portable paths,
   and digest stability, then reports deterministic kind-aware diagnostics.
   This phase is automatic and does not claim semantic completeness.
2. **Guided review** emits one versioned work order at a time across concern
   separation, kind-aware discovery, material ambiguity, decision provenance,
   internal consistency, progressive hardening, and an independent handoff
   review. The author and their agent do the semantic work.
3. **Author resolution** keeps consequential questions outside the
   distributable package until the author answers, rejects, or deliberately
   defers them. The CLI never invents an answer to advance the workflow.
4. **Publish check** requires stable valid bytes, completed review records, and
   no open authoring questions. Lint findings remain visible advisories unless a
   publisher imposes a stricter policy.
5. **Agent evaluation** is optional. It creates a digest-bound workspace and
   instructions for a fresh agent to attempt an independent handoff, record
   blockers and deviations, and return narrowly classified package
   improvements to the author.
6. **Pack** writes a deterministic `tar+gzip` archive and sidecar inspection,
   publish-check, and pack-receipt JSON files outside the source package.

Every phase is available as a headless JSON operation. A CLI, web interface,
desktop application, or hosted service can render the same state without
reimplementing protocol rules.

## Review with an agent

`review` is the author-facing name for the existing `audit` operation; both
commands read and write the same state:

```bash
seedspec review <package-path> --state <authoring-state>
seedspec review <package-path> --status --json
```

The command prints the current work order and the exact result file the agent
must update. Completing a pass records that the area was examined; it is not a
score or certification.

## Run a publish check

```bash
seedspec publish-check <package-path> --state <authoring-state>
```

The process exits unsuccessfully when a blocking check fails. Its JSON form is
versioned and safe for a publishing UI to consume:

```bash
seedspec publish-check <package-path> \
  --state <authoring-state> \
  --json
```

## Evaluate the handoff

Create the optional harness outside the package:

```bash
seedspec eval <package-path> --output <evaluation-directory>
```

The workspace contains:

- `eval-request.json`, binding the exact package and protocol release;
- `agent-instructions.md`, describing a fresh-context evaluation procedure;
  and
- `eval-result.yaml`, a structured place to record scope, agent and model,
  observations, blockers, deviations, evidence, limitations, and proposed
  package improvements.

If the package digest changes, create a new workspace. A successful attempt
supports only the specific scenario and environment recorded in the result. A
failed attempt may expose a package problem, an agent limitation, a tool
failure, an environmental constraint, or a deliberately delegated decision;
the evaluator must distinguish them.

## Export bundled skills

The CLI archive includes the version-matched authoring and adoption skills:

```bash
seedspec skills list
seedspec skills export --output .agents/skills
seedspec skills export --skill create-application-package \
  --output .agents/skills
```

Export is explicit and refuses to overwrite a skill with the same ID.

## Pack

```bash
seedspec pack <package-path> \
  --state <authoring-state> \
  --output <release-directory>
```

Packing refuses to run until the publish check is ready. It also refuses to
write inside the package or overwrite an existing release artifact. The
receipt binds:

- seed ID, author-controlled version, protocol family, and package digest;
- exact protocol release and release-manifest digest;
- archive name, format, root, and digest; and
- the accompanying versioned inspection and publish-check records.

`pack` prepares artifacts only. It does not register or upload a package, set
commercial terms, or create third-party trust claims. The resulting archive can
be copied, stored, or shared through any channel without changing package
identity or conformance.
