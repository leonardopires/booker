# Novel With Acts and Scenes Example

This example is for fiction writers. Scenes are small, focused notes. Act recipes compile scenes, and the bundle compiles acts into the full novel.

## Files

- **Novel Bundle.md** — builds the full novel and generates a TOC.
- **Act I Recipe.md**, **Act II Recipe.md**, **Act III Recipe.md** — each recipe compiles the scenes for one act.
- **Act I - Opening.md**, **Act II - Reversal.md**, **Act III - Resolution.md** — short act headers.
- **Scene 01 - Harbor Morning.md** (and other scenes) — the actual story beats.

## Recommended Mental Model

Think in scenes. Each scene is a single note you can write and revise without worrying about the full manuscript.
When you’re ready, Booker compiles them into acts and then into the novel.

## Booker Stays Out of the Writing Process

There’s no project UI or hidden state. You just write notes and declare the order in frontmatter.
Booker only touches the build step.

## Longform‑Style Compilation

This replaces Longform projects: scenes are your notes, act recipes replace chapter builds, and the bundle replaces the final compile.

## How to Run

1. Open **Novel Bundle.md** in Obsidian.
2. Run **Booker: Generate current file**.

Booker will create `./output/novel-with-acts-and-scenes.md`.
