# Writing Guide

This guide focuses on longform workflows: how to organize notes, keep headings consistent, and get predictable outputs.

## Recommended folder structures

Choose a structure that keeps source notes and outputs separate. Examples:

**Option A: Minimal**
```
Book Project/
  Scenes/
  Recipes/
  Output/
```

**Option B: Larger projects**
```
Book Project/
  Drafts/
    Scenes/
    Notes/
  Recipes/
  Bundles/
  Output/
```

Keeping outputs in their own folder makes it obvious what is generated versus what you write.

## One note per chapter vs block-based writing

**One note per chapter**
- Good for writers who outline heavily and draft in long stretches.
- Fewer moving parts, easier to scan and reorder.

**Block-based writing (one note per scene/section)**
- Good for iterative drafting and rearranging.
- Lets you replace or move small pieces without rewriting a full chapter.

Both approaches work. The difference is *how often you want to move pieces around*.

## Heading discipline (and why it matters)

Booker can generate a Table of Contents (TOC) based on headings. Clean headings lead to clean navigation.

Recommended practice:
- Use **H1** for chapter titles.
- Use **H2/H3** for sections inside a chapter.
- Keep heading levels consistent across notes.

By default, Booker adds an H1 with the note’s filename if it doesn’t already see one. This keeps outputs readable but can create duplicates if your note titles and H1s don’t match. If you prefer to control titles manually, set `recipe_strip_title: true` in your recipe and include your own headings.

## How the Table of Contents works (conceptually)

The TOC is built from your headings after Booker assembles the output. It is not a separate outline view; it is part of the generated file.

### When TOC should live at bundle level

If you are generating a whole book, add the TOC at the bundle level so you get one global TOC. This is easier to scan than multiple per‑chapter TOCs. (See [TOC Rules](../design/TOC_RULES.md) for the exact behavior.)

## Suggested defaults

These are simple starting points. Adjust to taste.

### Novels
- One recipe per chapter or act.
- One bundle for the full manuscript.
- Enable a single TOC on the bundle.

Example bundle frontmatter:
```yaml
---
type: booker-bundle
title: "Novel Draft"
targets:
  - "[[Act I]]"
  - "[[Act II]]"
  - "[[Act III]]"
aggregate_output: "~/Output/Novel Draft.md"
aggregate_toc: true
aggregate_toc_scope: tree
---
```

### Non‑fiction
- One recipe per chapter, one bundle for the book.
- Keep sections in a consistent heading hierarchy.

Example recipe frontmatter:
```yaml
---
type: booker-recipe
title: "Chapter 3"
output: "~/Output/Chapter 3.md"
order:
  - "[[03.01 Overview]]"
  - "[[03.02 Case Study]]"
recipe_heading_offset: 1
---
```

### Worldbuilding bibles
- Use one recipe per topic cluster (locations, characters, timelines).
- Use a bundle to produce a single reference file.
- Consider a deeper TOC depth for quick navigation.

Example bundle frontmatter:
```yaml
---
type: booker-bundle
title: "World Bible"
targets:
  - "[[Locations]]"
  - "[[Characters]]"
  - "[[Timeline]]"
aggregate_output: "~/Output/World Bible.md"
aggregate_toc: true
aggregate_toc_depth: 4
---
```

## Common mistakes (and how to avoid them)

- **Missing outputs**: Recipes require `output`, bundles require `aggregate_output`.
- **Empty order/targets lists**: Booker only compiles what you list.
- **Inconsistent headings**: Your TOC will look uneven if headings jump levels.
- **Mixing generated files with source notes**: Keep outputs in a separate folder.
- **Overusing per‑chapter TOCs**: Use one bundle‑level TOC for a cleaner result.

Next: [Writer FAQ](FAQ.md)
