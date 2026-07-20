# Implementation resources

SeedSpec implementation resources let an author package or reference skills,
instructions, verification material, tools, and target profiles without turning
those materials into claims about the resulting application.

They solve a different problem from capability contracts:

- a capability contract describes observable product behavior that packages
  expect or offer;
- an implementation resource helps an agent decide how to author, implement,
  integrate, or verify behavior; and
- the implementing agent still determines what exists in the actual code and
  whether any guidance fits the current project and end-user request.

## Author control

`implementation_resources` is optional. Omission means the package contains no
author statement about SeedSpec implementation guidance. It is not equivalent
to accepting or rejecting guidance.

When present, `additional_guidance` is explicit:

- `none` limits SeedSpec guidance to the resources the author declared; or
- `agent-delegated` allows the implementing agent to inspect relevant summaries
  from the declared public catalogs and decide whether any additional resource
  deserves loading.

This policy controls additional SeedSpec implementation resources. It does not
prevent the implementing agent from applying its own engineering knowledge or
following stronger end-user and project direction.

An author-selected resource has one usage level:

- `required` means the author expects the resource to be loaded for relevant
  implementation work;
- `recommended` means the agent should normally load it when relevant, unless
  stronger project or user direction conflicts; and
- `available` means the agent should inspect its summary or frontmatter and
  decide whether the expected benefit justifies its context cost.

These levels describe author intent. They do not authorize execution, network
changes, deployment, credential use, or other external effects. An agent that
skips even a required resource may do so when stronger direction or the actual
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
non-empty `name` and `description`. Agents inspect summaries first and load full
skill bodies selectively. The resource may include supporting files beneath its
root.

Tools remain untrusted executable content. Resolving or loading tool guidance
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
  recording online, bundled, fallback, unavailable, loaded, or skipped state;
  and
- `.seedspec/implementation-resources/`, containing bundled and resolved bytes.

After deciding whether a resolved resource helped, an implementing agent can
record optional telemetry without exporting it:

```bash
seedspec record-resource-use <project-path> <package-id> <resource-id> loaded \
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
proves that the final application is deployable to that target.
