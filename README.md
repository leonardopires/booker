# Booker

A minimal/no-nonsense Obsidian plugin to compile multiple Markdown files into a single document.

## What it does

Booker reads a recipe or bundle note that has YAML frontmatter describing which notes to include, then concatenates them into one output Markdown note. Everything is driven by that frontmatter. No external config files.

## Example recipe note

```yaml
---
type: booker-recipe
title: "Livro 1"
output: "Longinus/Livro 1/Livro 1 - Compilado.md"
order:
  - "[[L1-A1-C001]]"
  - "[[Folder/Note Name|Alias]]"
  - "Folder/Note Name"
options:
  strip_frontmatter: true
  strip_h1: false
  strip_title: false
  separator: "\n\n---\n\n"
  heading_offset: 1
---
```

By default, Booker prefixes each compiled note with an H1 matching the file name.
Set `strip_title: true` to skip adding the filename title.

## Example bundle note (targets + aggregate)

```yaml
---
type: booker-bundle
targets:
  - "[[Ato I - Recipe]]"
  - "[[Ato II - Recipe]]"
aggregate:
  title: "Longinus — Livro 1"
  output: "Longinus/Livro 1/Livro 1 - Compilado.md"
  options:
    strip_frontmatter: true
    strip_h1: false
    separator: "\n\n"
    heading_offset: 1
build_options:
  stop_on_error: true
  continue_on_missing: false
  dry_run: false
  summary_notice: true
---
```

Bundle targets are an ordered list of wikilinks or paths to `booker-recipe` or `booker-bundle` notes. Aggregation concatenates successful target outputs in order, using the aggregate options.

Inline bundle targets and per-target overrides are deprecated. Update any older bundle YAML to the simple `targets:` list before generating.

### Heading offsets

Use `heading_offset` to shift Markdown headings down by N levels during concatenation. The default is `1`, and `0` disables shifting. Apply it per recipe (`options.heading_offset`) or per bundle aggregate (`aggregate.options.heading_offset`). Headings inside fenced code blocks are ignored.

## Backward-compatible types

Old 0.x frontmatter types still work, but show a warning Notice:

- `booker` → `booker-recipe`
- `booker-build` → `booker-bundle`

## Command

Run the command in the Command Palette:

```
Booker: Build current file
```

## Notes on link resolution

- `order` items can be full wikilinks (`[[Note]]` or `[[Folder/Note|Alias]]`) or plain link paths (`Folder/Note`).
- Booker resolves each item using Obsidian's `metadataCache.getFirstLinkpathDest`, so renames are handled by Obsidian's metadata cache.
- Missing files are reported in a Notice (count only) and logged to the console.

## Running tests

```bash
npm run typecheck
npm run test
```

## License

MIT
