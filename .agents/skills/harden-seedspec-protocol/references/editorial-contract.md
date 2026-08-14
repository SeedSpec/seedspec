# SeedSpec protocol editorial contract

Use this checklist for every public protocol review.

## Document classes

### Normative

Defines interoperable behavior. Current normative surfaces are
`docs/01-language.md`, `docs/protocol.md`, `docs/operations.md`, the versioned
JSON Schemas, and the conformance suite.

- Use BCP 14 terms deliberately.
- Make requirements observable by an independent implementation.
- State inputs, outputs, failure behavior, preservation requirements, and trust
  boundaries precisely.
- Treat conflicts among normative prose, schemas, and conformance cases as
  protocol defects.

### Informative

Explains architecture, principles, glossary, security, versioning, and how
package material is used.

- Label recommendations as guidance.
- Do not introduce requirements absent from normative surfaces.
- Permit concrete vendors and frameworks when they clarify an example.
- Do not imply that one example is the required realization.

### Private strategy

Contains experiments, market plans, unreconciled alternatives, and internal
decision work. It is not a public protocol source and must not be cited as one.

## Canonical terms

`docs/glossary.md` is the public terminology source. Update it when a protocol
change introduces or materially changes a public concept, then keep the
high-risk distinctions below aligned with it.

- **SeedSpec Protocol**: the interoperability rules.
- **SeedSpec package**: a folder whose entrypoint is `SPEC.md`.
- **destination / intent**: outcomes, invariants, authority, and latitude in
  the `SPEC.md` prose.
- **context module**: supporting readable material with a direct entrypoint.
- **implementation profile**: a context module describing one legitimate way to
  realize the intent.
- **project state**: adopter selections bound to a package path and digest. It
  must not be written into the package.
- **realization**: the software, configured system, workflow, or composite
  outcome produced from the destination.
- **package author**, **adopter**, **implementing agent**, and **runtime**: name
  the actor rather than using ambiguous `we`, `you`, or `system` when
  responsibility matters.

Do not use **applied intent**, **resolved handoff**, **capability contract**,
**implementation resource**, or **profile state** as protocol terms.

Use `buyer` only when a document genuinely describes a commercial transaction.
Use `application` or `software` only when the statement does not also apply to
configured systems, workflows, integrations, or other solution kinds.

## Claim boundaries

- **Valid** means the input satisfies the applicable schema and semantic
  validation rules.
- **Conformant** means an implementation satisfies the declared conformance
  contract; it does not mean every realization is correct.
- **Declared** describes package-author material, not observed implementation
  state.
- **Selected** records adopter or caller preference; it is not execution
  authority.
- **Compatible** requires scoped evidence. A capability or version declaration
  alone is review context.
- **Verified** applies only to the recorded completion scope and evidence.
- **Trusted**, **safe**, and **secure** require a named threat model and evidence;
  validation or a digest alone does not establish them.
- **Deterministic** may describe protocol tooling output for fixed inputs. Do not
  use it for an implementing agent's realization.

## Phrasing review

Flag and evaluate:

- first-person project narration such as `we decided`, `we believe`, or `our
  current thinking`;
- conversation residue such as `for now`, `maybe`, `eventually`, or unexplained
  future promises;
- commercial language such as `buyer`, `paid`, `commercial product`, or
  storefront positioning outside documents that genuinely concern commerce;
- audience judgments such as `beginner-facing` when a functional description is
  clearer;
- claims that a package makes an agent obey, guarantees an implementation, or
  proves external state;
- provider-specific examples in normative sections;
- long comparisons with adjacent products in protocol documentation; and
- rationale embedded in requirements instead of an informative document.

Do not mechanically delete every flagged word. Preserve it when the document
class and meaning justify it; otherwise rewrite or relocate it.

## Publication checklist

- State the protocol family and experimental status consistently.
- Define the normative release bundle and how defects among its parts are
  handled.
- Ensure every schema `$id` resolves to the corresponding JSON document.
- Ensure public repository, documentation, source, and installation links point
  to the current project.
- Ensure unqualified npm commands install a version that supports the
  documented command.
- Provide machine-readable CLI version and protocol family information.
- Keep the conformance suite self-contained and externally consumable.
- Keep first-party protocol, runtime, CLI, and conformance versions exact and
  coordinated.
- Label informative guides so their authority is unambiguous.
- Verify generated agent instructions use the same terminology and trust
  boundaries as the protocol.
- Run `npm run check`.
- Test the public journey from a clean environment before announcing a release.
