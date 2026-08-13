# Approved provider options

The approved catalog contains three plausible candidates for
`org.seedspec.evals.incident-notifications`:

- `org.example.providers.incident-room-relay` delivers only to an authenticated
  incident room.
- `org.example.providers.immutable-mail-archive` delivers email with an
  immutable archive and receipt.
- `org.example.providers.dual-delivery-broker` delivers to the room and the
  email archive.

The catalog establishes candidates, not a selection. Each candidate conflicts
with at least one approved control. Provider selection needs a compliance
steering-group decision. No current source gives either control precedence.
