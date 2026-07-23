# SeedSpec use cases

> **Informative examples.** These scenarios illustrate how the SeedSpec system
> may be authored, distributed, adopted, and realized without requiring a
> particular implementation or market.

SeedSpec helps people turn reusable product and domain expertise into portable,
agent-ready starting points. Guided authoring helps make important intent,
choices, unknowns, and success criteria explicit. The protocol then gives that
material identity and stable semantic roles so it can be distributed,
configured, and handed to different agents without requiring one implementation
stack.

The package kind hints in the 0.1 alpha help tools recognize applications,
features, workflows, automations, configurations, integrations, and compound
solutions without defining separate protocols. A SeedSpec realization may create
source code, change an authenticated external system, establish an automation,
produce an operational artifact, or combine several of those results.

Use cases have two independent dimensions:

- **Realization:** what an implementing agent produces or configures.
- **Distribution:** who authors the reusable seed, how an adopter obtains it,
  and which separate authority recommends or approves an exact version.

## Realization use cases

### New application

An author packages the behavior, actors, configuration, supporting artifacts,
an optional ordered implementation task runbook, optional implementation
resources, and acceptance criteria for an application.
The user chooses technical preferences and an agent selects an architecture,
creates the implementation, and records verification evidence.

Example: a family allowance tracker that can be implemented with different web
frameworks, data stores, identity systems, and hosting providers.

### Feature adapted into an existing product

An author describes reusable behavior and the host capabilities it expects.
The agent inspects the actual product, maps equivalent concepts, resolves
integration differences, and adapts the feature without forcing the source
package's architecture or terminology.

Example: savings goals added to an existing allowance, budgeting, or financial
education product.

### Configured SaaS solution

The intended result is durable state inside an existing product rather than a
new codebase. The package supplies platform context, required permissions,
configuration, examples, implementation resources, safety constraints, and
observable success criteria. The agent may use an API, MCP server, authenticated
browser, or another user-authorized mechanism.

Example: create a HubSpot property and a dashboard that visualizes the property
for a defined sales audience. Verification may include the created property and
dashboard identifiers, permission checks, a known-data calculation, and a
captured view of the resulting dashboard.

### Cross-system automation

The package describes an outcome spanning multiple existing products. It
defines the trigger, schedule, data meaning, recipients, authorization
boundaries, failure behavior, and evidence without requiring one orchestration
technology.

Example: create a HubSpot property, build reporting around it, calculate its
daily average, and send that average to a configured Slack channel each morning.
Implementation profiles might use a HubSpot-native workflow, an existing
automation platform, or a small scheduled service. When no preference is
recorded, the agent explains their conditions and tradeoffs and asks the user
which direction to prefer after inspecting the actual environment.

### Composite enterprise solution

The result combines a new application, embedded platform extensions, configured
external systems, and recurring operations.

Example: a sales-performance command center that combines CRM and web analytics
in a customer-owned dashboard, adds a widget inside the CRM, and emails a rich
HTML summary of the previous sales day. A vendor-authored package may be deeply
optimized for HubSpot while a user directs an agent to adapt the same intent to
Salesforce where practical.

### Disposable or on-demand software

An agent uses a higher-level package of proven solution primitives to create a
short-lived tool for a particular decision or workflow. The implementation may
be disposable while the intent, configuration, and accumulated solution
knowledge remain reusable.

Example: generate a temporary operations dashboard for an incident, campaign,
or executive review using existing dashboard, ingestion, and notification
realizations.

## Authoring and distribution patterns

The neutral protocol makes a package identifiable and portable. It does not
decide which package is authoritative for an organization, certify publisher
expertise, set commercial terms, or guarantee fit for a particular adopter.
Libraries, vendors, consultancies, and marketplaces add those policies and
claims around ordinary SeedSpec packages.

### Internal enterprise seed library

An organization packages recurring solution knowledge that would otherwise
live in shared documents, tickets, example repositories, and a few employees'
memories. Internal authors can preserve company terminology, security and data
rules, approved integration patterns, configuration choices, domain skills,
examples, and verification practices without forcing every team onto one
framework.

For example, an enterprise may maintain one approved customer-support widget
seed. Product intent defines the widget behavior and boundaries; configuration
captures brand, region, and deployment choices; implementation resources carry
platform guidance; and acceptance material defines the release checks. An
internal catalog or governance system designates the approved package ID,
version, and digest.

The catalog creates organizational authority. The SeedSpec Protocol supplies
the exact, inspectable object about which that authority can be expressed. A
team can therefore say “use this widget seed at this version” instead of relying
on whichever Google Doc, copied prompt, or starter repository a person happens
to find.

### Consultancy- and agency-authored seeds

A consultancy captures repeated horizontal solution expertise while adapting
each realization to the customer's stack, systems, compliance obligations, and
operating model. One package might produce a Vercel-hosted Next.js application
for one customer and a Rails application on Azure for another while preserving
the same intended outcome.

The package separates the consultancy's reusable product and domain knowledge
from one engagement's applied intent and technical preferences. A consultancy
may attach its own support, review, and evidence claims; those claims do not
become protocol conformance.

### Vendor-produced seeds

A platform vendor publishes high-quality solution examples that use its own
data model, APIs, extension points, and operational guidance. The package may be
provider-specific by design. Agents can implement it faithfully for the
vendor's customers or adapt the intent when an end user explicitly chooses a
different provider.

Example: HubSpot publishes its best sales-dashboard package with HubSpot object
mappings, API guidance, UI-extension options, examples, and verification. The
package can describe a solution larger than HubSpot's native interface without
requiring HubSpot to ship every possible customer application.

Vendor authorship gives the package a valuable source of domain knowledge. It
does not give discovered content automatic execution authority, and adaptation
to another provider must remain explicit rather than being represented as the
vendor-authored package unchanged.

### Software and component ecosystem seeds

A library or framework distributes more than snippets. Its package can preserve
use cases, composition patterns, constraints, examples, skills, and acceptance
behavior so an agent can adapt the ideas into the user's application.

Example: a UI component ecosystem publishes complete dashboard realizations
that demonstrate accessibility, data loading, responsive behavior, and
customization rather than only distributing one component invocation.

An ecosystem can publish small feature seeds, complete solution seeds, or
implementation resources. Capability declarations and evidence help an agent
prioritize review, but actual compatibility still depends on the target
project.

### Independent authors and marketplaces

Authors may distribute or sell packages representing valuable solution
knowledge. Commercial terms, payments, publisher reputation, and licensing
enforcement stay outside the neutral protocol. Buyers receive ordinary
SeedSpec packages that remain inspectable and independently validatable.

A marketplace can add discovery, curation, reviews, update policy, provenance,
support, and evidence requirements. It may label a package recommended or
approved under its own stated criteria. Marketplace selection is not a new
package kind and does not change what protocol validity establishes.

### Public and open-source libraries

Communities may maintain free collections of reusable applications, features,
workflows, or configuration seeds. Versioned packages let maintainers improve
shared intent without requiring every adopter to copy a document and lose its
lineage. Community review and maintainership remain social or registry claims;
the protocol preserves their artifacts and exact identities but does not infer
their trustworthiness.

## Related realizations and registries

A mature package may preserve several implementation profiles for the same
core intent:

```text
Sales performance solution
├── Native CRM dashboard
├── Embedded CRM extension
├── Standalone web application
├── Regulated-cloud deployment
└── Scheduled briefing without a persistent UI
```

The preferred profile receives the implementing agent's primary attention.
Other approaches remain useful decision context: they can expose tradeoffs,
prevent accidental drift into a declined architecture, provide reusable ideas,
or justify asking the user to reconsider a choice that conflicts with the
actual environment. They do not authorize the agent to override the user.

Independent registries can compound this knowledge by relating core intent,
derived packages, features, realization approaches, provider adaptations,
implementation resources, tested environments, verification evidence, and
known limitations. Agents can retrieve and compare that graph rather than
re-derive every solution from a prompt. Registry selection remains discovery,
not activation or proof.

## Where SeedSpec adds the most value

Capable agents can solve many common, well-bounded tasks without a SeedSpec.
The value grows when the result crosses systems, depends on unfamiliar or
private platforms, contains important edge cases, carries regulatory or
security consequences, or represents expertise worth reusing.

SeedSpec is not a substitute for agent intelligence. It gives an intelligent
agent a better starting state: authored intent, accumulated context, explored
approaches, relevant resources, and explicit evidence of success.

See [why semantic structure matters](semantic-structure.md) for the handoff and
distribution rationale and [evaluation findings](evaluations.md) for the
current evidence about guided authoring, standalone Markdown, and specialized
package guidance.
