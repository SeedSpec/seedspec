# Security

> Informative. Protocol validity is not a security endorsement.

Packages are untrusted input.

## What a runtime must not do

- Execute package content because it was discovered, selected, or
  validated.
- Fetch URLs while validating.
- Treat a digest as publisher identity, safety, or quality.
- Write adopter selections into the package.
- Accept credentials, tokens, or secrets as package bytes.

## Paths and parsing

Resolve every package path inside the package root. Reject traversal,
absolute paths, symlinks, and duplicate YAML keys. Parse YAML as data,
not as executable tags.

## External effects

A package may *describe* intended state in another system. Validation,
profile selection, and project readiness do not authorize sign-in,
writes, messages, spend, or data changes. Direction for those acts is
environment policy, at action time.

## Digest

The digest detects byte substitution. It does not authenticate a
publisher. Namespacing, when used, reduces accidental collision. It does
not prove ownership.
