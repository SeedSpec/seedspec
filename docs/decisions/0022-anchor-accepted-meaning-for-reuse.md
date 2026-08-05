# Decision 0022: Anchor accepted meaning for coordinated reuse

- Status: accepted for the reference authoring product
- Date: 2026-08-04

## Context

A clarification candidate binds an author's consequential decision to the
package draft that produced the question. That freshness check prevents an old
question from changing a materially different package.

The first applied proposal can change the package digest. Earlier behavior then
rejected the same accepted candidate when a coordinated proposal needed to add
matching success, configuration, or other package wording. Agents had to create
a redundant question or cite a weaker record even though the author's meaning
was already present in unchanged package bytes.

## Decision

1. An open candidate still requires its original package draft when the author
   accepts, delegates, or retains its meaning.
2. The first proposal that uses accepted candidate meaning still requires the
   candidate's original package draft.
3. Applying that proposal creates a deterministic meaning anchor: its target
   path, complete after-content, and after-digest already exist in the proposal
   ledger.
4. A later coordinated proposal can reuse the candidate ID when at least one
   applied proposal that references it still matches the current target
   document exactly.
5. Unrelated package edits do not revoke the author's accepted meaning.
6. If every applied anchor changes, disappears, or stops being text, reuse
   fails with `AUTHORING_CANDIDATE_STALE`.
7. Reuse remains `author-answer` authority. It does not let agent inference
   enter package bytes.
8. No new candidate state, portable protocol field, or command is required.
   Existing applied proposal records supply the anchor.

## Consequences

- One author decision can coordinate intent, success, configuration, and other
  package documents without duplicate questioning.
- Reuse is grounded in current package bytes rather than the mere existence of
  historical authoring state.
- Changing the only document that carries accepted meaning removes the reuse
  shortcut. The agent must establish how the current package represents that
  meaning before continuing.
- Proposal creation performs bounded reads of applied anchor documents for each
  referenced accepted candidate.
