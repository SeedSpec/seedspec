# `org.seedspec.core.chores` 1.1.0

A provider supplies reusable descriptions of work. “Chore” is the capability's lineage name; applications may use different local or user-facing terminology.

## Observable concepts

A work description has:

- a provider-scoped identity that remains stable when descriptive fields change;
- a non-empty title;
- optional instructions;
- an optional suggested non-negative reward in the host's allowance unit;
- an active or archived state.

## Behavior consumers may rely upon

- An authorized host actor can create, read, revise, and archive work descriptions.
- Archived descriptions cannot be selected for new assignments.
- Revision affects future use and does not rewrite the description or reward captured by an existing assignment occurrence.
- Identity is not reused after archival.
- Historical references remain recognizable even when the current description is archived or renamed.
- Authorization and visibility remain bounded by the host household or equivalent ownership boundary.

## Host choices

The host controls local terminology, storage, interface design, search, ordering, and whether additional descriptive fields exist. Assignment scheduling, completion, approval, and accounting belong to separate capabilities.

Revision 1.1.0 expands the observable contract and explicitly recognizes local terminology. The prior revision is retained under `reference/capabilities/chores-1.0.0.md`.
