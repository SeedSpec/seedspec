# Implementation resources

> **Informative guidance.** Normative resource declarations, resolution state,
> and trust boundaries are defined by the protocol specification and schemas.

SeedSpec implementation resources let an author package or reference skills,
instructions, verification material, tools, and target profiles without turning
those materials into claims about the resulting realization.

They solve a different problem from capability contracts:

- a capability contract describes observable product behavior that packages
  expect or offer;
- an implementation resource helps an agent decide how to author, implement,
  integrate, or verify behavior; and
- the implementing agent still determines what exists in the actual code and
  whether any guidance fits the current project and end-user request.

## Core intent, implementation profiles, and skills

A SeedSpec package is the portable container. Its core intent describes the
particular solution outcome through the definition, configuration surface,
consequential decisions, capability contracts, constraints, and acceptance
material. Selecting and resolving the package changes what the implementing
agent is being asked to accomplish.

The same package may contain zero or more implementation profiles. Each profile
describes a package-specific way to implement the core intent, including its
prerequisites, blockers, tradeoffs, guidance, and relevant implementation
resources. Multiple profiles preserve alternative realizations without changing
the outcome they are intended to satisfy.

A skill describes a reusable way of performing work. It may teach an agent how
to make a class of decisions, use a technology, integrate a system, or verify an
outcome. Consulting a skill does not add behavior to the solution contract and
does not change how success is judged unless the package's core intent says so
independently.

| | Core intent | Implementation profile | Skill |
| --- | --- | --- | --- |
| Primary question | What should be accomplished, and how is success judged? | How could this package's core intent be implemented? | How can an agent perform a recurring kind of work well? |
| Typical scope | One portable solution or feature shape | One package-specific realization direction | A reusable method, domain practice, or tool workflow |
| Package cardinality | One coherent core intent | Zero or more alternatives | Zero or more bundled or referenced resources |
| Authority | Selected solution intent and recorded end-user decisions | Strong, conditional implementation guidance | Subordinate implementation guidance |
| Lifecycle | Validate, configure, resolve, realize, and verify | Compare, prefer, verify conditions, and apply or reconsider | Discover, resolve, consult or skip, and optionally record use |
| Effect on success | Defines or carries the acceptance target | Must satisfy the core intent; cannot redefine it | May help achieve or verify the target; cannot redefine it |

A package may carry or reference skills because a portable solution often needs
specialized implementation knowledge. The skill remains a distinct resource;
its Markdown does not become part of the core intent merely because it travels
with the package.

## Package-scoped skills

A SeedSpec resource with `kind: skill` is a **package-scoped skill**. Its
directory may be bundled in the package or retrieved from a canonical resource
manifest. SeedSpec validates and resolves that directory into the project
handoff, but does not install it into an agent environment's global or personal
skill registry.

An environment-installed skill may be registered with an agent harness and made
discoverable or automatically selected through its frontmatter. SeedSpec makes
no such assumption for a package-scoped skill. Its `SKILL.md` frontmatter is
descriptive metadata used for validation and review; it is not an automatic
invocation rule or execution authority.

For package-scoped resources, **consult** means that the implementing agent:

1. explicitly resolves the declared bytes through `seedspec resolve-resources`;
2. finds the verified resource root and entrypoint in
   `.seedspec/implementation-resource-state.yaml`;
3. reads `SKILL.md` and only the supporting files relevant to the task, resolving
   relative references from the resource root;
4. applies the useful guidance beneath system, end-user, project, and SeedSpec
   intent; and
5. records the resource as `consulted` or `skipped`, with a reason when useful.

Consulting does not install, register, automatically invoke, execute, or promise
to obey the skill. It records that the agent considered the verified guidance.
Any tool execution or external effect still needs its own authority.

## Author control

`implementation_resources` is optional. Omission means the package contains no
author statement about SeedSpec implementation guidance. It is not equivalent
to accepting or rejecting guidance.

When present, `additional_guidance` is explicit:

- `none` limits SeedSpec guidance to the resources the author declared; or
- `agent-delegated` allows the implementing agent to inspect relevant summaries
  from the declared public catalogs and decide whether any additional resource
  deserves consultation.

This policy controls additional SeedSpec implementation resources. It does not
prevent the implementing agent from applying its own engineering knowledge or
following stronger end-user and project direction.

An author-selected resource has one usage level:

- `expected` means the author explicitly expects the resource to be consulted for relevant
  implementation work;
- `recommended` means the agent should normally consult it when relevant, unless
  stronger project or user direction conflicts; and
- `available` means the agent should inspect its summary or frontmatter and
  decide whether the expected benefit justifies its context cost.

These levels describe author intent. They do not authorize execution, network
changes, deployment, credential use, or other external effects. An agent that
skips even an expected resource may do so when stronger direction or the actual
project requires it, but should record the reason.

## Declaration example

```yaml
implementation_resources:
  additional_guidance: agent-delegated
  catalogs:
    - id: org.seedspec.guidance.catalog
      url: https://guidance.seedspec.org/catalog.json
      version: "1.0.0"
  resources:
    - id: org.example.guidance.authorization-decisions
      kind: skill
      description: Help the agent decide whether and how authorization belongs in this product.
      usage: recommended
      entrypoint: SKILL.md
      version: "1.2.0"
      update_policy: exact
      canonical:
        manifest_url: https://example.org/authorization/1.2.0/resource.json
        digest: sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      bundled:
        path: guidance/authorization/
        version: "1.2.0"
        digest: sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
        compatibility: exact
      applies_to:
        capabilities:
          - org.example.product.actors
        targets:
          - org.seedspec.target.nextjs
```

`applies_to` is matching context, not an implementation-state assertion. A
resource may still be useful when an existing application implements equivalent
behavior under another name, or when the end user requests new behavior after
the source package was published.

## Resource kinds

Core recognizes `skill`, `instructions`, `verification`, `tool`, and
`target-profile`. Recognition controls presentation and validation, not
automatic activation.

A skill entrypoint is named `SKILL.md` and has compact YAML frontmatter with a
non-empty `name` and `description`. Agents inspect summaries first and consult
full skill bodies selectively. For package-scoped skills, this is explicit
consultation rather than native skill installation or automatic activation. The
resource may include supporting files beneath its
root.

Tools remain untrusted executable content. Resolving or consulting tool guidance
does not grant permission to execute it.

## Version and fallback resolution

Resources evolve independently from the SeedSpec CLI, protocol, and package.
The package declares a requested version and one update policy:

- `exact` accepts only the exact requested version and requires a pinned
  canonical digest;
- `latest-compatible` accepts the requested version or a newer version with the
  same major version; and
- `latest` accepts the requested version or a newer published version.

`canonical.manifest_url` points to a published resource manifest. That manifest
identifies the resource, actual version, kind, entrypoint, aggregate digest, and
every file URL and digest. Canonical manifests and files must use HTTPS. The
reference resolver applies file-count and size limits and verifies every file
and aggregate digest before exposing the resource.

`bundled` is a package-local failsafe. `compatibility: exact` requires the
bundled and requested versions to match. A different fallback version must be
explicitly labeled `author-declared-compatible`; SeedSpec records that claim but
does not prove semantic compatibility. Validation checks that the bundled path
is a directory, its entrypoint exists, its declared digest matches its bytes,
and skill frontmatter is readable. The enclosing package digest also protects
the bundled copy.

Resolution follows this order:

1. Request the canonical manifest and verify its identity, version policy, file
   digests, and aggregate digest.
2. Use the canonical resource when all checks succeed.
3. When canonical resolution fails, use the declared bundled copy when one
   exists after re-verifying its entrypoint and digest at use time.
4. Record `bundled-fallback` and the exact failure reason. Never substitute it
   silently.
5. Record `unavailable` when neither source can be used. An unavailable required
   resource fails the resource-resolution command after state is written;
   optional resources leave the handoff in a visible degraded state.

Run:

```bash
seedspec resources <package-path>
seedspec resource-digest <bundled-resource-directory>
seedspec resolve-resources <project-path>
```

## Resolved handoff and use records

Resolution writes:

- `.seedspec/implementation-resources.yaml`, containing exact author policy,
  canonical references, applicability, and copied bundled fallbacks;
- `.seedspec/implementation-resource-state.yaml`, bound to the index digest and
  recording online, bundled, fallback, unavailable, consulted, or skipped state;
  and
- `.seedspec/implementation-resources/`, containing bundled and resolved bytes.

After deciding whether a resolved resource helped, an implementing agent can
record optional telemetry without exporting it:

```bash
seedspec record-resource-use <project-path> <package-id> <resource-id> consulted \
  --reason "Relevant to the selected target and persistence design."
```

The same command accepts `skipped`. This local record helps future agents and
can feed an evaluation only when the user or environment separately chooses to
share it. The protocol does not define telemetry transmission.

## Target profiles

Implementation targets may reference an author-declared implementation
resource in addition to package components or selected artifacts. A target
profile can therefore carry reusable Next.js, Expo, desktop, or hosting
guidance without placing provider-specific behavior in SeedSpec core.

Target guidance must be resolved before architecture choices that it can
affect. It remains guidance: neither its selection nor a successful download
proves that the final realization satisfies that target.
