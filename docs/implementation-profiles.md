# Implementation profiles

> Informative. Normative shape is in `protocol.md`.

A profile is one legitimate way to realize the destination. In 0.4 it is
a context module (`type: implementation-profile`, `PROFILE.md`).

It is not product intent. Selecting it does not prove the result is
hostable or compatible. Unselected profiles may remain useful as
decision context. They must not silently override the spec.

## Where the choice lives

The adopter's preferred profile is project state (`seedspec project`).
Writing it into the package would change the digest and freeze one
realization as the destination.

One profile is enough until someone actually has two simultaneous
targets, a migration, or a real provider deployment.
