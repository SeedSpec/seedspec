---
name: create-feature-package
description: Turn supplied feature intent into a valid SeedSpec feature seed for an existing project or standalone reuse. Use when defining or revising a feature package without inventing host requirements, integration behavior, or product completeness.
---

# Create a SeedSpec feature package

Capture the feature behavior the author actually wants. A one-sentence feature
can be a useful seed. Do not require it to become a generalized capability,
integration design, or exhaustive product contract before it can be shared.

## Establish the authored context

For an existing resolved SeedSpec project, inspect its local `.seedspec` state
and host package before asking about concepts already defined there. Treat that
material as context, not permission to enlarge the requested feature.

For a standalone feature, keep host assumptions abstract only when the author
actually wants reuse. Do not invent required capabilities or integration
guarantees to make the feature appear portable.

Review only the supplied surface:

- Absence is not a gap.
- Evaluate actors, permissions, workflows, state, failures, retries,
  concurrency, deletion, or history only when the author introduces them.
- A finding must cite authored material that creates ambiguity, contradiction,
  a broken dependency, or an incomplete declared option.
- Broader feature or reuse brainstorming is opt-in and remains optional until
  the author accepts it.

## Create the practical minimum

Run:

```bash
npx @seedspec/cli init feature --output <package-path>
```

Then replace the scaffold with:

- `seed.md`, describing the behavior added or changed and, when supplied, the
  host context; and
- `success.md`, describing at least one observable result supported by that
  seed.

Keep the generated configuration empty unless the author deliberately offers
variation. Keep the generated compatibility scope honest, but do not treat it
as proof that a realization is compatible.

Capabilities, integration material, decisions, profiles, tasks, artifacts,
skills, reference code, and conformance suites are optional. Add one only when
the supplied intent or existing project already depends on it, or when the
author accepts it during explicit brainstorming.

## Represent declared relationships

When the author does introduce reusable or host-dependent behavior:

- require only host capabilities the feature actually uses;
- provide only durable behavior the feature actually adds;
- use stable namespaced capability IDs and the protocol's declared revision
  semantics;
- describe host mappings or atomicity only when they are part of the authored
  feature boundary;
- place deliberately selectable product behavior in configuration; and
- keep framework, hosting, repository layout, and other implementation
  preferences outside portable feature intent.

Configuration is not an unresolved-question bucket. A declared option needs a
meaning, effect, valid boundary, and relevant success observation.

When generalizing an existing feature, propose each removal or abstraction and
wait for author acceptance. Generalization must not silently change the
feature's outcome merely to broaden its compatibility label.

## Co-author and validate

Run the version-matched guided review:

```bash
npx @seedspec/cli author review
```

Keep the review threads private rather than presenting them as headings or an
audit report. Default to a brief reflection of the feature and one question,
with one grounded concern at a time.

Do not search archived workspaces, history, sibling documents, or engine code
for additional sources. After the author agrees to address a concern, record
the exact replacement with `author propose`. Record explicit acceptance or
rejection with `author decide`. Apply only an accepted proposal with
`author apply`. Before application, the author can reject a previously accepted
proposal without losing its earlier decision record.

Then run:

```bash
npx @seedspec/cli validate <package-path>
npx @seedspec/cli lint <package-path>
npx @seedspec/cli digest <package-path>
npx @seedspec/cli publish-check <package-path>
```

When a host is available, an optional temporary `npx @seedspec/cli resolve` can reveal
real integration questions. Those observed questions may inform the seed; a
generic feature checklist may not.

Publish readiness requires stable valid bytes and separate, non-placeholder
success material. The four private review threads and a fresh-agent evaluation are
optional tools, not completeness gates.
