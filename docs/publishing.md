# Preparing and publishing a SeedSpec package

> **Informative guidance.** These tools prepare portable package bytes and
> evidence about preparation. They do not certify completeness, package
> quality, publisher identity, or a future realization.

The reference publishing floor is deliberately small:

1. the package is structurally valid;
2. two consecutive validations produce the same package digest; and
3. the package declares a separate, non-placeholder Markdown success
   component.

Guided authoring review and local authoring-session questions are reported as
advisories. They do not block a valid seed from being packed.

## Inspect readiness

```bash
npx @seedspec/cli author check
```

Or with explicit paths:

```bash
seedspec publish-check <package-path> --state <authoring-state>
```

The JSON result separates blocking checks from advisories:

- `protocol-valid` is blocking;
- `digest-stable` is blocking;
- `success-material` is blocking;
- `authoring-review` is advisory when some guided areas remain;
- `open-authoring-questions` is advisory because those questions belong to the
  current session; and
- deterministic lint findings are advisory.

An organization or catalog may require a stronger review profile. That policy
belongs to that publisher and must not be presented as universal SeedSpec
validity.

## Guided review

Use the source-bound co-authoring review when it adds value:

```bash
npx @seedspec/cli author review
```

Four private threads organize the agent's attention and durable record without
becoming author-facing steps. The author may improve a thread, accept its
material as good enough, or mark it irrelevant. Review records help explain how
the seed was considered; they are not a score. See
[SeedSpec Authoring](authoring.md).

## Evaluate an independent handoff

A fresh-agent evaluation remains optional:

```bash
seedspec eval <package-path> --output <evaluation-directory>
```

The workspace contains:

- `eval-request.json`, binding the exact package and protocol release;
- `agent-instructions.md`, describing a fresh-context evaluation procedure;
  and
- `eval-result.yaml`, recording the scenario, agent, observations, evidence,
  limitations, and proposed improvements.

An evaluation finding must distinguish a package defect from an implementing
agent limitation, environment constraint, deliberately unconstrained choice,
or tool failure. Evaluation may deliberately explore beyond the authored
surface because the author explicitly requested an implementation handoff test;
its proposals still require author acceptance.

## Pack

```bash
npx @seedspec/cli author pack
```

Or:

```bash
seedspec pack <package-path> \
  --state <authoring-state> \
  --output <release-directory>
```

Packing refuses to write inside the package or overwrite an existing release
artifact. It writes:

- a deterministic `tar+gzip` package archive;
- a package inspection record;
- the publish-check result; and
- a digest-bound receipt.

The receipt binds the package ID, author-controlled version, protocol release,
package digest, archive digest, and output names. It does not register or upload
the package, set commercial terms, activate packaged content, or claim that a
realization exists.

## Optional bundled skill

The CLI archive contains a version-matched `author-seedspec` skill:

```bash
seedspec skills list
seedspec skills export --skill author-seedspec --output .agents/skills
```

Export is explicit and refuses to overwrite a skill with the same ID. The
skill is a convenience; the full CLI work order remains sufficient by itself.
