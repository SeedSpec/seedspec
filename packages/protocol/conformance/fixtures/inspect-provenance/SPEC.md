---
id: inspect-provenance
name: Inspect provenance
version: "1.0.0"
success:
  criteria:
    - id: anchored
      description: The anchored outcome is visible.
    - id: unanchored
      description: The unanchored outcome is visible.
bundled_packages:
  - id: inspect-child
    version: "2.0.0"
    digest: sha256:4dc5c67e8b09579b7e93ebf90ba86d59a9ce7708488a5625d86b74bda3dfa44a
    path: bundled-packages/child/SPEC.md
    optional: true
---
# Inspect provenance [success:anchored]
