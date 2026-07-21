# SeedSpec glossary

> **Informative terminology.** This glossary gives public documents and tooling
> one vocabulary for concepts whose normative structures are defined by the
> protocol specification and schemas.

## Protocol and package

- **SeedSpec Protocol**: the interoperability rules for packages, composition,
  integrity, resolution, handoff state, and verification state.
- **SeedSpec package**: a portable directory rooted at `seedspec.yaml`. The
  package is the container for core intent, optional implementation profiles,
  optional implementation resources, and related artifacts.
- **core intent**: the intended outcome expressed collectively by a package's
  definition, configuration surface, decisions, capability contracts,
  constraints, and acceptance material. Core intent is a logical part of the
  package, not a required file named `core-spec`.
- **kind hint**: author-supplied metadata describing the likely realization
  shape. It guides tooling but does not determine composition role or required
  fields.
- **root package**: the first package selected for one resolution.
- **addition**: any other package selected into that resolution. Root and
  addition are resolution roles, not package kinds.

Use the unqualified word **specification** carefully. Public documentation
should identify whether it means a SeedSpec package, the package's core intent,
the normative protocol specification, or a resolved project specification.

## Realization guidance

- **implementation profile**: one package-authored way to implement the core
  intent. A package may contain zero or more profiles with prerequisites,
  blockers, tradeoffs, guidance, and implementation-resource references.
- **implementation profile state**: project-local state containing every
  selected package's candidate profiles and at most one preferred profile per
  package.
- **implementation resource**: independently versioned agent guidance or
  tooling declared by a package author. Core kinds include skills,
  instructions, verification material, tools, and target profiles.
- **package-scoped skill**: an implementation resource whose verified
  `SKILL.md` is explicitly consulted from the resolved handoff. SeedSpec
  resolution does not install it into a native skill registry or invoke it
  automatically.
- **artifact**: related material preserved in its native format. Discovery,
  materialization, and disposition do not activate the artifact's workflow.

An implementation profile is specific to implementing one package's core
intent. A skill is reusable knowledge for performing a class of work. A profile
may reference one or more skills without turning them into core intent.

## Handoff and outcome

- **resolved project specification** or **resolved handoff**: the project-local
  output created from selected packages and explicit end-user inputs. It
  includes resolved intent, configuration, profile state, resource state,
  artifacts, locks, guidance, and verification scaffolding.
- **realization**: the software, configured external state, workflow,
  automation, operational artifact, or composite outcome produced from the
  resolved core intent.
- **completion scope**: the explicit subset of package acceptance material and
  project-local criteria used for one completion claim.
- **verification state**: structured results and evidence references bound to
  the exact completion scope.

## Actors

- **package author**: creates and publishes a SeedSpec package.
- **end user**: supplies implementation direction and authorizes consequential
  choices and external effects.
- **implementing agent**: interprets the resolved handoff and realizes the
  selected outcome under the end user's direction.
- **runtime**: validates packages and produces or checks protocol state.
- **registry**: indexes or distributes packages without becoming the authority
  for their packaged intent.
