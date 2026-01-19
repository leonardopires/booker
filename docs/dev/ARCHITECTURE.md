# Architecture Overview

## High‑level architecture

Booker is a small, service‑oriented plugin. The main entry point registers commands and UI; the build pipeline lives in services that are wired together in the app context.

Key layers:

- **Entry point (`src/main.ts`)**: registers commands, panel view, and menus.
- **App context (`src/app/BookerContext.ts`)**: creates and wires services.
- **Services (`src/services/`)**: build pipeline and user‑facing behavior.
- **Adapters (`src/adapters/`)**: Obsidian UI integration and app context adapters.

## Main services and responsibilities

- **FrontmatterParser**: parses frontmatter, normalizes schema, and raises deprecation warnings.
- **LinkResolver**: resolves wikilinks/paths to files using Obsidian metadata.
- **Compiler**: concatenates content, applies transforms, and inserts TOCs.
- **MarkdownTransform**: strips frontmatter/H1, applies heading offsets, extracts headings.
- **TableOfContentsBuilder**: renders and inserts the TOC.
- **BuildRunner**: orchestrates recipes and bundles, emits notices, handles errors.

## Data flow: frontmatter → output

1. **Frontmatter is read** from Obsidian’s metadata cache.
2. **Frontmatter is parsed** into normalized recipe/bundle config objects.
3. **Order/targets are resolved** into file references.
4. **Content is compiled**: sources are read, transformed, and joined.
5. **TOC is inserted** (if enabled).
6. **Output is written** to the configured path.

## Why Booker avoids heavy abstractions

Booker favors direct, readable code over complex frameworks. The build pipeline is easier to reason about when each step is explicit and side effects are visible.

## Why explicit schemas are preferred

Booker treats frontmatter as the source of truth. Flat, prefixed keys keep the schema obvious, reduce ambiguity, and work well with Obsidian Properties. See [Frontmatter Schema](../design/FRONTMATTER_SCHEMA.md).

Next: [Testing](TESTING.md)
