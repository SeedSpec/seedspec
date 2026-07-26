---
name: create-application-package
description: Turn supplied software-product intent into a valid, portable SeedSpec application seed with separate observable success. Use when creating or substantially revising an application package without inventing product requirements or aiming for specification completeness.
---

# Create a SeedSpec application package

Create a useful starting seed, not a finished product design or implementation
plan. Starting material may be one sentence, a detailed document, or an
existing application.

## Source boundary

Use only intent the author supplied or explicitly accepts.

- Absence is not a gap.
- Do not add actors, permissions, workflows, failures, policies, edge cases,
  or technical requirements merely because applications often have them.
- An authored claim may be clarified or compared with another authored claim.
- A domain concept the author introduces may be evaluated with relevant
  expertise.
- Broader product ideation happens only when the author asks for it. Keep those
  ideas optional until accepted.

If two authored claims conflict, cite both and help the author resolve them.
Do not hide the contradiction behind implementation freedom.

## Create the practical minimum

Run:

```bash
npx @seedspec/cli init application --output <package-path>
```

Then replace the scaffold with:

- `seed.md`, stating what should exist or change, who it is for, and why it
  matters; and
- `success.md`, stating at least one observable result supported by the seed.

Protocol 0.2 also requires the generated manifest and configuration schema and
example. Keep the configuration surface empty unless the author deliberately
offers product variation.

A sparse seed is valid. Do not manufacture capabilities, tasks, profiles,
artifacts, skills, or reference code to make the package appear mature.

## Add only authored structure

When the supplied intent already introduces a concern, represent it in the
smallest appropriate place:

- fixed product intent or boundaries stay in the primary seed;
- deliberately selectable product behavior belongs in configuration;
- optional composable behavior may be an addition;
- materially different realization directions may be implementation profiles;
- useful native source material may be an artifact;
- agent guidance or code may be an implementation resource; and
- ordered implementation reminders may be a task runbook.

Configuration is not a destination for unresolved questions. For each declared
option, make its meaning, effect, valid values, and relevant success observation
clear.

Do not ask the author to decide manifest syntax, directories, schema mechanics,
frameworks, databases, hosting, or other implementation choices unless their
supplied intent makes one a genuine outcome constraint.

## Co-author through private review threads

Use the version-matched work order:

```bash
npx @seedspec/cli author review
```

Treat the four threads as private navigation, not a visible conversation
outline. Do not announce areas, explain the framework, enumerate the package,
or present an audit report. Start with a short reflection of the intended
application and one question. Surface one grounded concern at a time.

`Source-bound` limits findings to the active package and declared sources; it
does not require searching archives, history, sibling files, or implementation
code for more context.

Show an exact package edit only after the author says they want to address the
concern, then wait for explicit acceptance before applying it.

Questions recorded in the local authoring workspace belong to this conversation.
Declining a suggestion does not create configuration, a portable question, a
future task, or an implementation obligation.

## Validate and package

Run:

```bash
npx @seedspec/cli validate <package-path>
npx @seedspec/cli lint <package-path>
npx @seedspec/cli digest <package-path>
npx @seedspec/cli publish-check <package-path>
```

Repair protocol, path, schema, configuration, and broken-reference errors.
Treat lint as source-bound advice, not a missing-feature checklist.

Publish readiness requires stable valid bytes and a declared, non-placeholder
success component. Completing all guided review threads is useful evidence of
co-authoring, but is not required and does not certify quality or completeness.

Use `npx @seedspec/cli pack <package-path>` to create the digest-bound archive and
receipt when the publish check is ready.
