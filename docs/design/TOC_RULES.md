# Table of Contents (TOC) Rules

This document describes how Booker detects headings and builds TOCs.

## How headings are detected

- Headings are parsed from Markdown lines that start with `#` through `######`.
- Fenced code blocks (``` or ~~~) are ignored when extracting headings.
- Heading levels reflect the content after heading offsets are applied.

## Anchor generation rules

Each TOC entry is a Markdown list item that links to a heading using Obsidian’s heading link format:

```
- [[#Heading Text]]
```

Booker uses the heading text exactly as it appears in the output. It does not rename or deduplicate headings.

## Duplicate handling

If multiple headings share the same text, the TOC will include repeated entries with the same link text. Obsidian’s own heading resolution determines which heading is opened.

## Depth and include_h1 logic

TOC entries are filtered by:

- `toc_depth` (maximum heading level included)
- `toc_include_h1` (when false, H1 headings are excluded)

## Bundle tree‑scope behavior

When generating a bundle TOC:

- `aggregate_toc_scope: tree` uses headings aggregated from all child targets.
- `aggregate_toc_scope: file` uses headings from the bundle’s final output only.

## Why bundle‑level TOC is recommended

A single bundle‑level TOC provides a clear, global view of the final output structure. It avoids repeated per‑chapter TOCs and makes navigation more consistent for long documents.
