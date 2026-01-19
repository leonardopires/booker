# Book With Chapters Example

This example models a small non‑fiction book with three chapters.
Each chapter is built by its own recipe, and a bundle combines the chapters into one book.

## Files

- **Book Bundle.md** — the bundle that builds the full book and generates a TOC.
- **Chapter 01 Recipe.md** — recipe for Chapter 1.
- **Chapter 02 Recipe.md** — recipe for Chapter 2.
- **Chapter 03 Recipe.md** — recipe for Chapter 3.
- **Chapter 01 - Problem Framing.md** / **Chapter 01 - Checklist.md** — Chapter 1 content.
- **Chapter 02 - Requirements.md** / **Chapter 02 - Tradeoffs.md** — Chapter 2 content.
- **Chapter 03 - Feedback Loops.md** / **Chapter 03 - Release Notes.md** — Chapter 3 content.

## Why Recipes Map to Chapters

Each recipe outputs one chapter file. This keeps chapter builds fast and makes it easy to work on a single chapter in isolation.

## Why the Bundle Generates the TOC

The bundle compiles all chapters and builds a single table of contents for the whole book. This keeps TOC management in one place.

## Heading Offset

The bundle uses `aggregate_heading_offset: 1` so chapter headings sit under the book title when the full book is generated.

## How to Run

1. Open **Book Bundle.md** in Obsidian.
2. Run **Booker: Generate current file**.

Booker will create `./output/book-with-chapters.md` with all chapter outputs merged in order.
