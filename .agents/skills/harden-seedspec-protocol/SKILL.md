---
name: harden-seedspec-protocol
description: Audit and edit SeedSpec protocol documentation, schemas, conformance fixtures, CLI-generated agent guidance, and public protocol surfaces for precise normative language and publication readiness. Use when changing protocol concepts or terminology, preparing a SeedSpec release, reviewing wording for internal deliberation or marketing leakage, classifying normative versus informative material, or checking that public claims match enforceable behavior and tests.
---

# Harden SeedSpec Protocol

Keep SeedSpec precise enough for independent authors, implementers, and agents
to interpret without access to project history or private strategy.

## Load the editorial contract

Read [references/editorial-contract.md](references/editorial-contract.md) before
editing or approving any public protocol surface. Apply its document classes,
lexicon, claim boundaries, and publication checklist.

## Establish the change boundary

1. Identify every affected surface: normative prose, schemas, conformance cases,
   reference runtime behavior, generated agent text, informative guidance, ADRs,
   package READMEs, and public websites.
2. Classify each document before editing it.
3. Separate editorial clarification from semantic protocol change.
4. If wording changes what a conforming implementation accepts, produces, or
   guarantees, treat it as semantic: update schemas, runtime behavior,
   conformance cases, version notes, and tests together.
5. Keep distribution-service policy, product strategy, commercial plans, and
   exploratory reasoning outside normative protocol material.

## Audit from authority to presentation

Review in this order:

1. `docs/protocol.md` and the affected JSON Schemas.
2. Conformance cases and reference-runtime behavior.
3. Architecture, principles, security, authoring, runtime, and topic guides.
4. Generated CLI and agent-facing instructions.
5. ADRs and repository READMEs.
6. Public sites, schema URLs, installation commands, and discovery files such as
   `llms.txt` when they are in scope.

Do not repair a contradiction by making only the friendliest document agree.
Resolve the underlying contract and propagate the result outward.

## Apply protocol voice

- State requirements impersonally and testably.
- Use BCP 14 terms only for normative interoperability requirements.
- Name the responsible actor: package author, runtime, registry, implementing
  agent, or end user.
- Distinguish what tooling validates from what an agent may infer or choose.
- Distinguish a SeedSpec package, its core intent, its implementation profiles,
  and its implementation resources.
- Describe agent behavior as guidance unless the protocol can observe and test
  the behavior.
- Keep provider and framework examples in informative material unless the
  provider is genuinely part of the portable contract.
- Preserve useful rationale in clearly non-normative ADRs; remove diary-like
  deliberation, commercial speculation, and stale future-tense promises from
  public protocol guidance.

## Check claims against evidence

For every material claim, identify its evidence surface:

- schema validation;
- deterministic runtime behavior;
- conformance case;
- implementation evidence;
- author or registry assertion; or
- non-normative recommendation.

Narrow or relabel claims that lack the evidence they imply. Never equate
declared, selected, resolved, compatible, installed, verified, trusted, safe,
or complete.

## Sweep for drift

Use repository search to find old terminology, duplicated definitions, vendor
examples, installation commands, version strings, and generated phrases. Search
the whole repository, not only `docs/`, because CLI output and skills are public
agent interfaces.

Inspect the final diff for:

- one concept receiving multiple names;
- normative behavior documented only in guidance;
- guidance accidentally promoted to a requirement;
- historical or internal phrasing presented as protocol status;
- commands that do not exist in the published tool version; and
- links or schema identifiers that do not resolve to the claimed artifact.

## Verify

Run the narrowest relevant checks during iteration, then run before handoff:

```text
npm run check
npm run conformance
git diff --check
```

When public endpoints or npm instructions change, also test them from a clean,
external-consumer perspective. Report editorial changes separately from
semantic changes, identify any compatibility impact, and list unresolved policy
decisions rather than hiding them in prose.
