# Writer Quickstart (10 minutes)

This guide gets you generating a clean output in under 10 minutes.

## What a recipe is

A **recipe** is a note that lists the source notes you want to merge, in the exact order you want to read them. It produces one output file.

## What a bundle is

A **bundle** is a note that lists multiple recipes (or other bundles). It produces a larger output by merging those recipe outputs.

## When to use a recipe vs a bundle

- Use a **recipe** for a chapter, section, or any single unit you want as one file.
- Use a **bundle** when you want several recipes combined into a larger document.

## Minimal recipe example

Create a new note (for example, `Act I`) and add:

```yaml
---
type: booker-recipe
title: "Act I"
output: "~/Output/Act I.md"
order:
  - "[[Scene 01]]"
  - "[[Scene 02]]"
  - "[[Scene 03]]"
---
```

## Minimal bundle example

Create another note (for example, `Book One`) and add:

```yaml
---
type: booker-bundle
title: "Book One"
targets:
  - "[[Act I]]"
  - "[[Act II]]"
aggregate_output: "~/Output/Book One.md"
---
```

## Run generation

1. Open the recipe or bundle note.
2. Use **Command Palette → Booker: Generate current file**.

## Where the output appears

- `output` (for recipes) and `aggregate_output` (for bundles) are the output paths.
- If a path starts with `~`, it is relative to your vault root. Otherwise it is relative to the recipe or bundle note.

## What Booker does NOT do

- It does **not** change your source notes.
- It does **not** auto‑reorder chapters for you.
- It does **not** manage projects or hidden metadata.
- It does **not** guess what should be included; the order list is the source of truth.

Next: [Writing Guide](WRITING_GUIDE.md)
