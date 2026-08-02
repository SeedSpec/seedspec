# Format integrations and context adapters

> **Informative guidance.** Normative integration and adapter boundaries are
> defined in `docs/protocol.md` and the release-bound schemas.

SeedSpec integrates external semantic formats through independently versioned
format integrations. The protocol preserves module identity and lifecycle. The
integration supplies deeper format knowledge.

This keeps four claims separate:

- package validation establishes SeedSpec structure;
- native validation establishes external-format conformance;
- context preparation selects content for one request; and
- a harness or user authorizes any later execution or external effect.

## Integration descriptor

An integration root contains `seedspec-integration.json`.

```json
{
  "integration_descriptor_version": "1",
  "id": "org.example.agent-behavior-integration",
  "version": "1.2.0",
  "formats": [
    {
      "id": "dev.agentbehavior.behavior",
      "versions": ["1.0.0"],
      "entrypoints": ["BEHAVIOR.md"]
    }
  ],
  "adapter": {
    "id": "org.example.agent-behavior-adapter",
    "version": "1.2.0",
    "adapter_api_version": "1",
    "entrypoint": "adapter.mjs",
    "digest": "sha256:<64-lowercase-hex>",
    "capabilities": ["inspect", "validate", "prepare"]
  },
  "bridges": []
}
```

The descriptor is metadata. Discovery validates its schema, checks duplicate
claims, verifies adapter and bridge digests, and reports compatibility. It does
not import adapter code.

## Registry boundary

An adapter registry belongs to one runtime or command invocation. It is not a
package field or process-wide global.

The host decides which integration sources it trusts. It then loads adapters
explicitly. Loading verifies:

- adapter file digest;
- adapter API version;
- adapter ID and version;
- advertised capabilities; and
- advertised format coverage.

Duplicate adapter IDs fail. Ambiguous matches fail unless the context request
selects one adapter for the module.

## Adapter contract

An adapter entrypoint is an ECMAScript module. Its relative path must end in
`.mjs`, which makes module loading independent of ambient package metadata.
Adapter API version 1 uses this shape:

```js
export const adapter = {
  adapter_api_version: "1",
  id: "org.example.agent-behavior-adapter",
  version: "1.2.0",
  formats: [{
    id: "dev.agentbehavior.behavior",
    versions: ["1.0.0"]
  }],
  capabilities: ["inspect", "validate", "prepare"],

  async inspect(input) {},
  async validate(input) {},
  async prepare(input) {}
};
```

The runtime passes verified package or resolved module paths. An adapter must
stay inside the supplied module root.

`validate` returns:

```js
{
  valid: true,
  issues: [],
  summary: {}
}
```

`prepare` returns:

```js
{
  text: "# Prepared context\n",
  supporting_files: ["references/example.md"]
}
```

Supporting files must resolve inside the module root. The bundle copies them
and records each digest.

## Bridge packages

An integration can publish default bridge Skills without an adapter. Each
bridge declares compatible formats, applicability, a `SKILL.md` directory, and
an exact directory digest.

Authoring discovery proposes compatible defaults. It never mutates a package.
Applying a plan copies selected bridge bytes and writes explicit module
bindings. Existing author-selected bridges suppress default proposals.

The resulting SeedSpec package no longer depends on the integration source for
resolution. The integration repository remains provenance for authoring and
future updates.

## CLI surfaces

```text
seedspec context adapters --integration <path>
seedspec context discover <package> --integration <path>
seedspec context validate <package> <module> --integration <path>
seedspec context author <package> --integration <path> [--write]
seedspec context prepare <project> --request <yaml> --output <directory> [--integration <path>]
seedspec context record-use <prepared-context> --input <json>
```

`context author` is dry-run first. `--write` applies verified bridge assets.
`context prepare` loads only adapters from explicitly supplied integration
sources. Omitting integrations permits bridge or plain-Markdown fallback.

## Security requirements

- Treat integration descriptors and adapter code as untrusted input.
- Keep discovery inert.
- Verify code bytes before import.
- Reject symbolic-link integration sources, descriptors, adapter entrypoints,
  bridge roots, and bridge entrypoints.
- Keep adapter registration instance-scoped.
- Reject ambiguous adapter selection.
- Recheck the resolution receipt, protocol-owned handoff bytes, module digests,
  and prepared bundle files at their use boundaries.
- Do not treat validation or preparation as execution authority.
- Do not grant network, credentials, tools, or external effects implicitly.
