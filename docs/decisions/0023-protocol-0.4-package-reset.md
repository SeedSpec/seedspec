# 0023: Protocol 0.4 resets and simplifies the package contract

Status: accepted

## Decision

Protocol 0.4 replaces the 0.3 package model. It does not provide a compatibility
parser or automatic migration.

The structural core is:

- `SPEC.md` is the required package entrypoint and prose specification.
- Root `seedspec.yaml` is an optional base manifest.
- `SPEC.md` frontmatter overrides the base manifest.
- Structured collections use inline values or one-level YAML sections.
- Package digests protect every authored package file.
- Bundled children retain independent identity, version, and digest.
- Context modules remain readable without a recognized format integration.

## Package identity

Required root fields are:

- `id`;
- `name`; and
- `version`.

`kind`, `target_protocol`, `description`, and `metadata` are optional. `version`
and `target_protocol` are separate strings.

Package IDs allow lowercase letters, numbers, hyphens, and periods. Namespacing
is permitted but not required. A package ID never proves publisher authority.
Registry distribution records can add verified publisher identity later.

When present, `kind` is an authoring and presentation hint. Built-in and custom
kinds do not impose kind-specific package requirements. Omitting `kind` is
valid.

## Structured declarations

Configuration variables declare selectable inputs. Success criteria declare
acceptance claims. Capabilities describe package-local observable behavior.
Tasks provide ordered implementation guidance.

Capabilities do not use `provides`, `requires`, or independent versions. Their
provenance is the declaring package ID, package version, and package digest.

Tasks and capabilities can reference local criteria. Tasks can reference local
capabilities.

## Success anchors

`[success:<criterion-id>]` connects specification prose to a structured success
criterion. Unknown anchors are invalid. Unanchored criteria remain valid and
produce review information.

Anchors establish authored traceability. They do not direct code placement or
provide verification evidence.

## Context modules

Context modules use a direct Markdown entrypoint path. They have a closed core
type vocabulary for grouping and optional format metadata for deeper
interpretation.

Applicability can select by lifecycle stage, local capability, or local success
criterion. Audiences, purposes, targets, tasks, packages, profiles, and
integration points are not applicability dimensions.

Implementation profiles are context modules with `type:
implementation-profile` and a `PROFILE.md` entrypoint. Profile Markdown has no
required headings or structured section semantics.

## Bundled packages

A bundled child declaration records `id`, `version`, `digest`, and `path`.
Optional children add `optional: true`. Selection is project state and does not
modify the authored package.

## Removed root concepts

Protocol 0.4 does not define root fields for compatibility, decisions,
conflicts, integration points, or implementation profiles.

Compatibility, decisions, conflicts, and integration needs remain ordinary
specification prose. The protocol can reconsider a structured concept after a
concrete target demonstrates value.

## Extensions

Protocol-owned objects reject unknown fields. Experimental values belong under
root `extensions` with namespaced keys.

## Patch releases

Optional `target_protocol: "0.4"` identifies the intended family. The installed
runtime supplies the exact 0.4.x schema. Alpha patch releases can change the
accepted contract. Authors must revalidate packages when they change runtime
releases.

## Normalized artifacts

`inspect --json` exposes the resolved manifest, source files, overrides,
section expansion, success anchors, unanchored criteria, and bundled
provenance. `flatten` emits the resolved manifest as `SPEC.md` frontmatter and
includes the source package digest in a YAML comment.

These artifacts report source resolution. They do not become independent
semantic authorities.
