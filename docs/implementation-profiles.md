# Implementation profiles and profile state

> **Informative guidance.** Normative profile and profile-state behavior is
> defined by the protocol specification and schemas.

SeedSpec separates durable intent from authored ways to realize it.

- **Core intent** is the package definition, behavioral configuration,
  capabilities, decisions, and success criteria.
- An **implementation profile** is a candidate direction shipped by the author.
- **Implementation profile state** is the single project-level resolution
  record for profiles declared by all selected packages.

The protocol does not market profile state as a separate product concept. Its
name is deliberately mechanical: it records state specifically about authored
implementation profiles.

## One state per resolved project

A resolved project has exactly one `implementation-profile-state.yaml`. It may
contain entries for the root and additions because each selected package can
declare profiles. Within that one state:

- every authored candidate remains visible;
- each selected package has at most one preferred profile;
- a package with multiple candidates and no preference is `review`;
- a sole candidate is `available`, not silently preferred; and
- the overall state is `review` if any package still needs a preference.

Evaluating several candidates does not create multiple states. The candidates
remain together in one state until a preference is recorded. If a user wants to
compare complete what-if implementations as independent alternatives, tooling
should create separate resolution runs or workspaces. A single implementation
handoff must not contain competing project-level profile states.

## Authored profile

```yaml
implementation_profiles:
  - id: hubspot-dashboard
    name: HubSpot-native dashboard
    description: Realize the outcome primarily with HubSpot reporting and workflows.
    guidance: implementation/hubspot-dashboard.md
    prerequisites:
      - id: uses-hubspot
        statement: The organization uses HubSpot as the relevant system of record.
        verification:
          method: user-confirmation
          evidence: optional
    blockers:
      - id: native-fidelity-gap
        statement: Native capabilities cannot satisfy the required calculation faithfully.
        verification:
          method: environment-inspection
          evidence: required
    tradeoffs:
      - Minimizes separately operated infrastructure but inherits native platform limits.
```

Profiles are guidance, not executable plans. Declaring or preferring one does
not authorize tools, external effects, secret access, or architecture changes.

## Preferred profile

`-i <profile-id>` and `--implementation <profile-id>` record a preference for
the root. An addition uses `<package-id>/<profile-id>`. The preference may come
from the author, a distributor, an internal platform team, a consultancy, or
the end user.

A preference is intentionally weaker than a locked selection. The implementing
agent verifies applicability against the actual environment. When the preferred
profile is blocked or contradicts core intent, the agent presents evidence and
asks for direction rather than silently choosing another candidate.

## Declarative conditions

Prerequisites state what must be true. Blockers state what, if true, makes a
profile unsuitable. Both use declarative assertions rather than fixed question
wording so an implementing agent can inspect evidence or ask an appropriate
question in context.

Core verification methods are:

| Method | Expected use |
|---|---|
| `user-confirmation` | Organizational facts, choices, authority, or ownership that a person must attest to |
| `environment-inspection` | Read-only inspection of code, configuration, accounts, capabilities, or existing state |
| `tool-check` | A non-mutating probe or validator whose result establishes the condition |
| `document-review` | Policy, contract, compliance, architecture, or other controlled documentation |
| `manual-observation` | A person observes a UI, physical result, delivered message, or behavior not reliably machine-checkable |

`evidence` is `none`, `optional`, or `required`. Optional `guidance` may explain
what to inspect without embedding credentials, secrets, executable commands, or
fixed conversational wording.

A condition method describes how to establish applicability. It does not
execute the check during package validation or profile resolution. `tool-check`
in particular does not authorize tool execution; normal trust and action-time
permission rules still apply.

## Adding verification methods

Publishers may experiment with namespaced methods. Generic tooling preserves an
unknown method and asks the agent to follow package guidance or obtain user
direction.

A method should enter the core enum only when:

1. multiple independent packages need the same verification behavior;
2. it is semantically distinct from existing methods rather than a product-
   specific alias;
3. a generic agent can understand its responsibility without vendor tooling;
4. its evidence expectation and trust boundary can be documented;
5. non-recognition has a safe fallback; and
6. schemas, positive and negative conformance cases, authoring diagnostics, and
   at least one end-to-end example cover it.

Core enum growth changes interoperability expectations. Namespaced experiments
should precede promotion whenever practical.

## Implementation preferences

Implementation profiles are authored supply; implementation preferences are
user or organization demand. Preferences may include approved platforms,
languages, hosting, cost boundaries, data residency, compliance requirements,
or operating constraints.

Protocol 0.1 records project-specific preferences through technical preferences
and implementation targets. Persistent user- or organization-level preference
stores are tooling concerns rather than portable package state. Tooling may use
those preferences to rank or explain profiles, but it must preserve authored
candidates and must not turn a ranking into a profile preference without making
that decision visible.
