# SeedSpec Protocol 0.4 migration policy

Protocol 0.4 resets the package contract around `SPEC.md`.

Protocol 0.3 packages are unsupported inputs. The 0.4 runtime does not contain
a compatibility parser or automatic migration.

To move a package forward:

1. Create root `SPEC.md`.
2. Move primary specification prose into its Markdown body.
3. Add `id`, `name`, and `version`. Optional `kind` is a presentation hint.
4. Add optional `target_protocol`, description, and metadata when useful.
5. Reauthor structured declarations against the 0.4 schema.
6. Move implementation profiles into context modules with `PROFILE.md`.
7. Add success anchors when prose should trace to structured criteria.
8. Validate every local path and cross-reference.
9. Recompute bundled-child digests.
10. Validate the complete package with the exact target runtime.

Do not transform old fields mechanically when their 0.4 semantics differ.
Retain old packages in version control when historical comparison is useful.

During the alpha, 0.4.x patch releases can change accepted structure. No
cross-patch compatibility guarantee applies. Revalidate and revise sources as
needed.
