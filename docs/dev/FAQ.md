# Developer FAQ

## Where should new features go?

Most functionality belongs in `src/services/` with wiring in `BookerContext`. UI elements live in `src/adapters/` or `src/main.ts`.

## How strict is backward compatibility?

Very. Existing frontmatter should keep working. Use deprecations instead of removals.

## Why flat prefixed frontmatter?

Flat keys map cleanly to Obsidian Properties and avoid ambiguous nesting. It also makes overrides explicit.

## Why so many explicit null checks?

Booker operates on cached metadata and user‑edited YAML. Null checks keep runtime behavior deterministic and avoid silent failures.

## How should new options be introduced?

Add prefixed keys to the schema, include defaults, and update docs and tests. Avoid adding new nested structures.

## What parts should not be refactored lightly?

- `FrontmatterParser` (schema compatibility)
- `BuildRunner` (build behavior + notices)
- `Compiler` and `MarkdownTransform` (output stability)
