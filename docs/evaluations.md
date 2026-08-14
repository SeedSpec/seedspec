# Evaluation findings

> Informative. Scoped to the runs that produced them. Not conformance.

Evaluations ask whether making intent explicit gives an independent agent
a better starting state.

## What the runs show

**Explicit intent reduces invention.** When important product policy was
left implicit, agents invented custody, disagreement, and time-zone
behavior. When those answers were in the spec, they were preserved more
often.

**Ordinary Markdown is a strong baseline.** Strong specification prose
captured tested boundaries well. Multiple files, a manifest, and schema
validity did not automatically produce better product intent.

**Validity is not quality.** A package can pass structural checks and
still omit material behavior.

**Only un-inferable knowledge earns its place.** Package-scoped guidance
covering a specialized contract reached 33/36 obligations versus 14/36
without it. Putting the same text inline was nearly as strong. The file
format was not the cause. A capable model cannot recover a contract it
was never given. Redundant generic audit material can reduce coverage.

**An integrity gate is not a quality score.** A deterministic check can
pass while an independent look still finds a serious defect.

**A small spec works and leaves work to the agent.** Architecture,
display of unspecified terminal states, and verification scope were
agent-supplied. The spec must not pretend it decided what it left open.

**Ceremony crowds out the destination.** Generated handoff text once grew
to more than twice the package, including empty “not declared” sections.
The implementing agent should mostly read product intent.

## What this does not show

It does not show that SeedSpec structure beats a good Markdown file.
It does not show that a skill file is magical.
It does not certify how much implementation work a package saves.
It does not make demand: that someone will spend real time authoring a
package so a stranger can implement it.
