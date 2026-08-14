# Glossary

> Informative. Normative shapes are in the protocol specification.

## Package

- **SeedSpec package**: a folder whose entrypoint is `SPEC.md`. Optional
  `seedspec.yaml` is a base manifest. Frontmatter wins.
- **digest**: lowercase `sha256:` of authored portable bytes. Identifies
  content. Does not prove publisher, safety, or quality.
- **kind**: optional shape hint. Does not change validity or composition.
- **target_protocol**: optional family label. The
  installed runtime supplies the exact schema.

## Meaning

- **destination / intent**: outcomes, invariants, authority, and latitude
  in the `SPEC.md` prose.
- **configuration**: selectable inputs with behavioral effect. An example
  is not a selection.
- **success criterion**: an acceptance claim. An anchor traces prose to a
  criterion. Neither is verification evidence.
- **capability**: package-local observable behavior. Not a dependency
  graph. Not proof that current code has the behavior.
- **task**: ordered implementation guidance. Advisory. Not a workflow the
  protocol runs. Completing tasks does not prove success.
- **context module**: supporting readable material with a direct
  entrypoint. Visibility is not mutation or execution.
- **implementation profile**: a context module describing one legitimate
  way to realize the intent. Selecting it does not prove compatibility.
- **bundled child**: another package included by exact id, version,
  digest, and path. Optional children are project selection.

## Claims

- **validity**: the bytes are a well-formed package for one runtime
  release.
- **quality**: the spec captures intended meaning without inventing or
  overconstraining.
- **verification**: independent evidence that this digest held up in some
  environment.

## Actors

- **author**: owns package meaning.
- **adopter**: chooses configuration, optional children, and profile for
  one project. Those choices live outside the package.
- **implementing agent**: realizes the destination under the adopter's
  direction, inspecting actual code and environment.

## Project state

- **project**: adopter selections bound to a package path and digest.
  Must not be written into the package.

Do not use **applied intent**, **resolved handoff**, **capability
contract**, or **profile state** as protocol terms.
