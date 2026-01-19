# Changelog Policy

## What goes into the changelog

Include user‑visible changes such as:
- Frontmatter schema updates or deprecations.
- Output formatting changes (TOC, heading offsets, separators).
- New or removed commands.
- Behavior changes in build success/failure rules.

## Breaking vs non‑breaking changes

- **Breaking**: requires user changes to existing frontmatter or alters output structure.
- **Non‑breaking**: additive options or internal changes with identical outputs.

## How deprecations are communicated

- Keep legacy schemas supported while emitting warnings.
- Document the replacement keys clearly in the changelog.
- Provide migration guidance in documentation.
