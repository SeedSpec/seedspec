# Versioning

> Informative. Family-to-family compatibility is project strategy, not a
> protocol guarantee. See the repository [README](../README.md).

Keep these identities separate even when a UI shows one number:

| Identity | What it names |
| --- | --- |
| Protocol family | `target_protocol` when present |
| Exact runtime / schema | The installed contract that accepted the package |
| Package version | The author's `version` in `SPEC.md` |
| Package digest | The exact authored bytes |

A shared family does not mean two exact runtimes are interchangeable.
While the protocol is experimental, patch releases can change accepted
structure. Revalidate after a runtime change.

A family does not parse a previous family. Reauthor.

Do not put project state, receipts, or verification results in the
package version. Those are different objects.
