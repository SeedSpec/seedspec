# Implementing a SeedSpec package

This guide is bundled with the installed CLI so its commands and handoff model
match that exact tool version.

SeedSpec prepares intent and evidence boundaries. It does not execute the
package or choose an implementation architecture for you.

## Example 1: inspect safely before making choices

```bash
seedspec doctor
seedspec begin <package-path-or-github-url>
```

`doctor` verifies the installed release, schemas, bundled conformance corpus,
and an offline validation-and-digest smoke test.

`begin` validates the package and explains the package-author intent source,
configuration that still requires selection, consequential decisions,
supporting material, trust boundaries, and the inputs needed for resolution.

Read the primary definition and relevant early-review material. Do not execute
artifacts, install resources, or start implementation merely because they are
present.

## Example 2: resolve explicit adopter choices

Select the author example exactly:

```yaml
# configuration-selections.yaml
protocol_version: "0.2"
packages:
  - package: org.example.package
    selection: example
```

Affirm how package intent applies:

```yaml
# applied-intent.yaml
protocol_version: "0.2"
packages:
  - package: org.example.package
    use: as-authored
contributions: []
```

Then resolve:

```bash
seedspec resolve <package-path> \
  --configuration-selections configuration-selections.yaml \
  --applied-intent applied-intent.yaml \
  --output <project-path>
```

For a composition, add complete package directories explicitly:

```bash
seedspec resolve <root-package-path> \
  --add <addition-package-path> \
  --configuration-selections configuration-selections.yaml \
  --applied-intent applied-intent.yaml \
  --output <project-path>
```

Resolution is offline and atomic. It either publishes a complete `.seedspec/`
handoff or leaves the previous handoff unchanged. Review
`.seedspec/project.yaml` and `.seedspec/resolution-receipt.json`. A
`needs-input` project is inspectable, but consequential unresolved choices must
be addressed before implementation.

## Example 3: implement and record scoped evidence

Start with:

```text
.seedspec/agent-guide.md
.seedspec/resolved-intent.yaml
.seedspec/resolved-spec.md
.seedspec/completion-scope.yaml
```

The implementing agent should:

1. compare resolved intent with the actual project and user direction;
2. review preserved artifacts, profiles, resources, and task reminders at their
   declared review time;
3. choose implementation details from the real environment rather than
   treating package declarations as observations;
4. record mappings and deviations in `.seedspec/implementation-notes.md`;
5. record evidence in `.seedspec/verification-state.yaml` and
   `.seedspec/verification-report.md`; and
6. inspect the scoped result with:

```bash
seedspec completion <project-path>
```

If packages or adopter selections change, rerun `seedspec resolve`. The runtime
regenerates protocol-owned state while preserving designated project memory.
Changed completion scope makes existing evidence stale until it is reconciled.

## Optional implementation resources

Only use the explicit resource operation after reviewing the package's declared
policy:

```bash
seedspec resources <package-path>
seedspec resolve-resources <project-path>
```

This operation may use the network for declared HTTPS resource manifests. It
verifies downloaded bytes before exposing them. Resolution does not install,
activate, execute, or automatically consult a resource.

## Full installation proof

Run the complete bundled protocol suite when you need an exact installation
record:

```bash
seedspec doctor --full
seedspec conformance --json --output conformance-report.json
```

With no suite path, `conformance` uses the exact corpus bundled with the
installed protocol package. The report is bound to one exact protocol release.
It is evidence of protocol behavior, not certification of package quality or
project completion.
