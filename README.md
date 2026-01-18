# Booker

A minimal/no-nonsense Obsidian plugin to compile multiple Markdown files into a single document.

## What it does

Booker reads a "project" note that has YAML frontmatter describing which notes to include, then concatenates them into one output Markdown note. Everything is driven by that frontmatter. No external config files.

## Example project note

```yaml
---
type: booker
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
---
```

By default, Booker prefixes each compiled note with an H1 matching the file name.
Set `strip_title: true` to skip adding the filename title.

## Example buildfile note (mixed targets + aggregate)

```yaml
---
type: booker-build
targets:
  - name: "Ato I"
    project: "[[Ato I - Projeto]]"
  - name: "Ato II (inline)"
    title: "Ato II — Travessia"
    output: "Longinus/Livro 1/Ato II - Compilado.md"
    order:
      - "[[L1-A2-C001]]"
      - "[[L1-A2-C002]]"
    options:
      strip_frontmatter: true
      strip_h1: true
      separator: "\n\n---\n\n"
aggregate:
  title: "Longinus — Livro 1"
  output: "Longinus/Livro 1/Livro 1 - Compilado.md"
  options:
    strip_frontmatter: true
    strip_h1: false
    separator: "\n\n"
build_options:
  stop_on_error: true
  continue_on_missing: false
  dry_run: false
  summary_notice: true
---
```

Targets can be inline or reference a `type: booker` project note. Aggregation concatenates successful target outputs in order, using the aggregate options.

## Command

Run the command in the Command Palette:

```
Booker: Compile from YAML
Booker: Build from buildfile
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
