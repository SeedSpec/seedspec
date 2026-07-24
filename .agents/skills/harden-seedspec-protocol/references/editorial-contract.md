# SeedSpec protocol editorial contract

Use this checklist for every public protocol review.

## Document classes

### Normative

Defines interoperable behavior. Current normative surfaces are the versioned
protocol specification, JSON Schemas, and conformance contract.

- Use BCP 14 terms deliberately.
- Make requirements observable by an independent implementation.
- State inputs, outputs, failure behavior, preservation requirements, and trust
  boundaries precisely.
- Treat conflicts among normative prose, schemas, and conformance cases as
  protocol defects.

### Informative

Explains authoring, runtime use, security posture, examples, and design patterns.

- Label recommendations as guidance.
- Do not introduce requirements absent from normative surfaces.
- Permit concrete vendors and frameworks when they clarify an example.
- Do not imply that one example is the required realization.

### Rationale

Records accepted architectural decisions and their consequences.

- Keep ADRs explicitly non-normative.
- Preserve rationale that helps future protocol work.
- Exclude private commercial planning, conversation residue, and obsolete
  speculation that does not explain the accepted contract.

### Private strategy

Contains experiments, market plans, unreconciled alternatives, and internal
decision work. It is not a public protocol source and must not be cited as one.

## Canonical terms

`docs/glossary.md` is the public terminology source. Update it when a protocol
change introduces or materially changes a public concept, then keep the
high-risk distinctions below aligned with it.

- **SeedSpec Protocol**: the interoperability rules.
- **SeedSpec package**: the portable container governed by the protocol.
- **core intent**: the package's intended outcome, expressed collectively by its
  definition, configuration surface, decisions, capability contracts,
  constraints, and acceptance material.
- **implementation profile**: one package-authored way to implement the core
  intent, with conditions, tradeoffs, guidance, and resource references. A
  package may contain zero or more profiles.
- **implementation profile state**: project-local state recording candidates and
  at most one preferred profile per selected package.
- **implementation resource**: independently versioned agent guidance or tooling
  declared by an author.
- **package-scoped skill**: an implementation resource whose verified
  `SKILL.md` is explicitly consulted from the handoff, not installed or
  automatically invoked.
- **artifact**: related material preserved in its native format; discovery and
  disposition do not activate its workflow.
- **resolved project specification** or **resolved handoff**: the project-local
  result of combining selected packages with explicit user inputs and state.
- **realization**: the software, configured system, workflow, operational
  artifact, or composite outcome produced from the resolved intent.
- **package author**, **end user**, **implementing agent**, **runtime**, and
  **registry**: name the actor rather than using ambiguous `we`, `you`, or
  `system` when responsibility matters.

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
- **Selected** records user or caller preference; it is not execution authority.
- **Resolved** means exact material and state were produced or acquired as
  recorded; it is not proof that guidance was followed.
- **Compatible** requires scoped evidence. A capability or version declaration
  alone is review context.
- **Consulted** means an agent considered an implementation resource. It does not
  mean installed, automatically invoked, followed, or effective.
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
- rationale embedded in requirements instead of a linked ADR.

Do not mechanically delete every flagged word. Preserve it when the document
class and meaning justify it; otherwise rewrite or relocate it.

## Publication checklist

- State the protocol version and stability level consistently.
- Define the normative release bundle and how defects among its parts are
  handled.
- Ensure every schema `$id` resolves to the corresponding JSON document.
- Ensure public repository, documentation, source, and installation links point
  to the current project.
- Ensure unqualified and tagged npm commands install a version that supports the
  documented command.
- Provide machine-readable CLI version and protocol compatibility information.
- Keep the conformance suite self-contained and externally consumable.
- Distinguish protocol releases from CLI, runtime, schema-package, and
  conformance-suite versions.
- Label informative guides and ADRs so their authority is unambiguous.
- Verify generated agent instructions use the same terminology and trust
  boundaries as the protocol.
- Run repository tests and conformance cases.
- Test the public journey from a clean environment before announcing a release.
