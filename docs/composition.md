# Package composition

The normative algorithm is `capability-graph-v1` in `docs/protocol.md`. Resolution begins with one application and an unordered selection of features.

```text
validated packages
      |
      v
unique provider map ----> declared conflict check
      |
      v
application capabilities
      |
      v
ready feature sets, sorted by package ID
      |
      v
capability review + resolved agent handoff
```

Resolution fails rather than guessing when:

- no selected provider exists;
- multiple packages provide one capability ID;
- a package declares a selected conflict;
- features form a capability cycle.

Application, feature, decision, and technical configuration stay in separate namespaces. Required unanswered product decisions produce a valid project with `status: needs-decisions`; they do not disappear into implementation assumptions.

Capability revision differences do not fail resolution. The handoff records what each feature was tested against, what the selected application provides, and whether the implementing agent should perform deeper review.

The dependency lock records exact package digests, deterministic feature order, the provider of every resulting capability, and revision-review bindings. It does not download dependencies or dictate how an agent must implement the result.
