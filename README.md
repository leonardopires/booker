# Booker

**Booker** is a minimal, no‑nonsense Obsidian plugin for compiling long‑form writing projects made of many Markdown notes into clean, structured documents.

It is designed for:
- writers (novels, non‑fiction, academic work, long essays)
- users migrating from **Longform**
- developers who want deterministic, frontmatter‑driven builds

No external config files.  
No UI‑heavy workflows.  
Everything lives inside your notes.

---

## What Booker Does (In Plain English)

Booker lets you:

- Write your project as **many small notes**
- Define *how they are assembled* using YAML frontmatter
- Generate **one clean output file** (or many)
- Build **hierarchies** (chapters → acts → books → trilogies)
- Control headings, separators, tables of contents, and build behavior

You never leave Obsidian.
You never leave Markdown.

---

## Core Concepts

### Recipe

A **recipe** is a note that says:

> “Take these notes, in this order, and merge them into one document.”

Think of it as:
- a chapter
- an act
- a section
- a standalone document

Recipes generate **one output file**.

### Bundle

A **bundle** is a note that says:

> “Run these recipes (or other bundles), then merge *their outputs* into a larger document.”

Think of it as:
- a full book
- a collection of acts
- a trilogy
- an omnibus

Bundles can build **trees**, not just lists.

---

## Quick Start (Writers)

### 1. Create a Recipe

Create a new note and add:

```yaml
---
type: booker-recipe
title: "Act I – Order"
output: "~/output/Act I.md"
order:
  - "[[Scene 01]]"
  - "[[Scene 02]]"
  - "[[Scene 03]]"
recipe_strip_frontmatter: true
recipe_heading_offset: 1
---
```

Now run:

**Command Palette → Booker: Generate current file**

You’ll get `Act I.md` with all scenes merged.

---

### 2. Create a Bundle

Create another note:

```yaml
---
type: booker-bundle
title: "Book One"
targets:
  - "[[Act I – Order]]"
  - "[[Act II – Crossing]]"
  - "[[Act III – Rupture]]"

aggregate_output: "~/output/Book One.md"
aggregate_strip_title: true
---
```

Run the command again.

You now have a **book built from acts**, built from scenes.

---

## Table of Contents (TOC)

Booker can generate a Table of Contents automatically.

### Defaults

```yaml
toc: false
toc_title: "Table of Contents"
toc_scope: tree
toc_depth: 4
toc_include_h1: true
```

### Enable TOC in a Recipe

```yaml
recipe_toc: true
recipe_toc_depth: 3
```

### Enable TOC in a Bundle (recommended)

```yaml
aggregate_toc: true
aggregate_toc_scope: tree
```

This generates **one global TOC** for the whole book, even if child recipes disable TOC.

TOC entries:
- are nested
- link to headings
- ignore fenced code blocks
- handle duplicate headings safely

---

## For Longform Users

If you are coming from **Longform**, here is how to think about Booker:

| Longform | Booker |
|--------|--------|
| Project | Bundle |
| Chapter | Recipe |
| Scene | Regular note |
| Compile | Generate |
| Sidebar UI | YAML + Command |
| Metadata | Frontmatter |

Key differences:

- Booker is **explicit** (you always see what’s built)
- No hidden project state
- No plugin‑owned files
- Fully Git‑friendly

Once you get used to recipes and bundles, Booker scales better for large works.

---

## Frontmatter Schema (Flat & Property‑Friendly)

Booker uses **flat, prefixed keys** so everything works well with Obsidian Properties.

### Recipe Keys

```yaml
type: booker-recipe
title: string
output: string
order: string[]

recipe_strip_frontmatter: boolean
recipe_strip_h1: boolean
recipe_strip_title: boolean
recipe_separator: string
recipe_heading_offset: number

recipe_toc: boolean
recipe_toc_title: string
recipe_toc_depth: number
recipe_toc_include_h1: boolean
```

### Bundle Keys

```yaml
type: booker-bundle
title: string
targets: string[]

aggregate_output: string
aggregate_title: string
aggregate_strip_frontmatter: boolean
aggregate_strip_h1: boolean
aggregate_strip_title: boolean
aggregate_heading_offset: number

aggregate_toc: boolean
aggregate_toc_scope: "file" | "tree"
aggregate_toc_depth: number
aggregate_toc_include_h1: boolean

build_stop_on_error: boolean
build_continue_on_missing: boolean
build_summary_notice: boolean
```

---

## Notices & Build Feedback

Booker reports progress clearly:

- ℹ️ `[File]` info
- ✅ `[File]` success
- ⚠️ `[File]` warning
- ❌ `[File]` error

Bundles stream notices from child builds and finish with a summary:

```
✅ [Book One] Completed (✅3 ⚠️1 ❌0)
```

---

## YAML Error Help

If your YAML is invalid, Booker will tell you:
- which file failed
- where (line/column if possible)
- how to fix common mistakes

No stack traces.
No cryptic errors.

---

## Commands & UI

- **Booker: Generate current file**
- **Booker: Toggle panel**
- Right‑click → Booker → New recipe / New bundle
- Ribbon icon opens the Booker panel

The panel is read‑only and reflects the active file.

---

## Philosophy

Booker is opinionated:

- Markdown first
- Files over UI state
- Deterministic builds
- Explicit structure
- Scales from short essays to multi‑book sagas

If you write long things, Booker stays out of your way.

---

## License

MIT
