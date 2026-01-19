# Writer FAQ

## Do I need to understand YAML?

Only a little. You edit a small frontmatter block at the top of a note. The examples in the [Quickstart](QUICKSTART.md) are enough to get started.

## Can I visually reorder chapters?

Not inside Booker. Reordering is done by editing the `order:` list in recipes or the `targets:` list in bundles.

## What happens if a note is missing?

Booker will warn you and skip missing notes. When running a bundle, build settings can stop the build if missing notes should block output.

## How does the TOC work?

The TOC is built from headings in your generated output. You can enable it at the recipe or bundle level. See [TOC Rules](../design/TOC_RULES.md).

## Can I compile only part of my book?

Yes. Generate a single recipe to compile one chapter or section.

## Is Booker destructive?

No. Booker only writes to output files you specify. Your source notes are not edited.

## How is this different from copy/paste?

Booker keeps your sources modular and repeatable. You update a scene once and regenerate, instead of manually pasting content into a single document.

## Is Booker opinionated?

Yes, in a small way: it is explicit and frontmatter‑driven. It does not try to manage your project for you.
