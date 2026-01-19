# Contributing

## Contribution philosophy

- Keep Booker small and explicit.
- Prefer clear, linear code over clever abstractions.
- Favor deterministic behavior over convenience.

## Code style expectations

- Use the existing patterns in `src/services/` and `src/app/`.
- Avoid introducing new layers unless they reduce complexity.
- Keep names descriptive and side effects obvious.

## TypeScript strictness expectations

- Preserve strict typing; avoid `any` unless a boundary requires it.
- Prefer explicit types at public boundaries and service interfaces.

## Backward compatibility rules

- The flat, prefixed frontmatter schema is primary, but legacy schemas are still supported.
- Do not remove or rename schema keys without a deprecation path.
- Avoid changes that alter output formatting without a clear reason and documentation.

## When to add tests

Add or update tests when you:
- Change frontmatter parsing behavior.
- Change build output structure or TOC behavior.
- Add new build or notice rules.

## When to add documentation

Update docs whenever you:
- Add or deprecate frontmatter keys.
- Change output behavior or defaults.
- Introduce new commands or UI entry points.

Next: [Testing](TESTING.md)
