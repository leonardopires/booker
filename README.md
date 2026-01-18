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
  separator: "\n\n---\n\n"
---
```

## Command

Run the command in the Command Palette:

```
Booker: Compile from YAML
```

## Notes on link resolution

- `order` items can be full wikilinks (`[[Note]]` or `[[Folder/Note|Alias]]`) or plain link paths (`Folder/Note`).
- Booker resolves each item using Obsidian's `metadataCache.getFirstLinkpathDest`, so renames are handled by Obsidian's metadata cache.
- Missing files are reported in a Notice (count only) and logged to the console.

## License

MIT
