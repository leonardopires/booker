# Testing

## Test stack

- **Vitest** for unit tests.
- **Node environment** (no browser).

## Where tests live

- `tests/**/*.test.ts` for test files.
- `tests/__mocks__/obsidian.ts` for the Obsidian API mock.
- `tests/fakes/` for helper fakes.

Vitest is configured to alias `obsidian` to the mock so services can be tested in isolation.

## How to run tests

```bash
npm test
```

## How to mock Obsidian APIs

Use the mock in `tests/__mocks__/obsidian.ts` and add new stubs there when you need additional API behavior. Keep mocks minimal and deterministic.

## What changes require tests

- Frontmatter parsing and validation changes.
- Output formatting changes (TOC, headings, separators).
- Build logic that affects success/failure behavior.

## Common testing pitfalls

- Forgetting to update mock behavior after adding new Obsidian API usage.
- Writing tests that depend on the filesystem rather than faked vault data.
- Assuming TOC ordering without matching the heading extraction rules.

Next: [Debugging](DEBUGGING.md)
