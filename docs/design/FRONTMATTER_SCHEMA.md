# Frontmatter Schema

This document describes Booker’s frontmatter schema and how it is interpreted.

## Flat prefixed schema (primary)

Booker’s primary schema uses flat, prefixed keys so settings are compatible with Obsidian Properties and easy to scan in YAML.

### Recipe frontmatter (flat)

```yaml
---
type: booker-recipe
title: "Chapter 1"
output: "~/Output/Chapter 1.md"
order:
  - "[[Scene 01]]"
  - "[[Scene 02]]"

recipe_strip_frontmatter: true
recipe_strip_h1: false
recipe_strip_title: false
recipe_separator: "\n\n---\n\n"
recipe_heading_offset: 1

recipe_toc: false
recipe_toc_title: "Table of Contents"
recipe_toc_depth: 4
recipe_toc_include_h1: true
---
```

### Bundle frontmatter (flat)

```yaml
---
type: booker-bundle
title: "Book One"
targets:
  - "[[Act I]]"
  - "[[Act II]]"

aggregate_output: "~/Output/Book One.md"
aggregate_title: "Book One"
aggregate_strip_frontmatter: true
aggregate_strip_h1: false
aggregate_strip_title: false
aggregate_separator: "\n\n---\n\n"
aggregate_heading_offset: 1
aggregate_toc: true
aggregate_toc_scope: tree
aggregate_toc_depth: 4
aggregate_toc_include_h1: true

build_stop_on_error: true
build_continue_on_missing: false
build_dry_run: false
build_summary_notice: true
---
```

## Legacy nested schema (deprecated but supported)

Booker still recognizes older nested forms such as:

- `options:` under recipes (deprecated)
- `aggregate:` and `aggregate.options:` under bundles (deprecated)
- `build_options:` under bundles (deprecated)
- Unprefixed option keys (deprecated)

These forms produce deprecation warnings. Use flat prefixed keys for new content.

## Precedence rules

When the same option appears multiple times, Booker resolves values in this order:

1. **Prefixed keys** (`recipe_*` or `aggregate_*`)
2. **Nested options** (`options.*` or `aggregate.options.*`)
3. **Unprefixed keys** (`toc`, `strip_frontmatter`, etc.)

Build options follow the same pattern:

1. **Prefixed keys** (`build_*`)
2. **Nested options** (`build_options.*`)

## Defaults

If you omit an option, Booker applies defaults:

- `strip_frontmatter: true`
- `strip_h1: false`
- `strip_title: false`
- `separator: "\n\n---\n\n"`
- `heading_offset: 1`
- `toc: false`
- `toc_title: "Table of Contents"`
- `toc_scope: tree`
- `toc_depth: 4`
- `toc_include_h1: true`

Build defaults:

- `stop_on_error: true`
- `continue_on_missing: false`
- `dry_run: false`
- `summary_notice: true`

## Type values and deprecations

Valid types:
- `type: booker-recipe`
- `type: booker-bundle`

Deprecated aliases:
- `booker` → `booker-recipe`
- `booker-build` → `booker-bundle`

## Path resolution

- Paths starting with `~` are treated as vault‑relative.
- Other paths are resolved relative to the recipe or bundle file.

## Why flat schema works better with Obsidian Properties

Obsidian Properties surfaces flat keys cleanly. Prefixed keys avoid nested object editing and make each option explicit in the file UI.

Next: [Notice Conventions](NOTICE_CONVENTIONS.md)
