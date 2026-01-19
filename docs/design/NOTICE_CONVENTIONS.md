# Notice Conventions

Booker uses Obsidian notices to report build progress and errors. Notices follow a consistent format so they are easy to scan.

## Notice levels and emoji

- **Info** → ℹ️
- **Success** → ✅
- **Warning** → ⚠️
- **Error** → ❌

Each notice includes a file label in brackets:

```
✅ [Chapter 1] Generation completed successfully.
```

## File label rules

Booker uses the frontmatter `title` as the label when present. If no title is set, it falls back to the file’s base name.

## Bundle streaming behavior

When you generate a bundle, Booker builds each target in order and streams notices from those child builds. After the build completes, Booker emits a summary notice for the bundle.

## Summary notices

Summary notices include counts of success, warning, and error outcomes, for example:

```
✅ [Book One] Completed (✅3 ⚠️1 ❌0)
```

Booker currently emits this summary after every bundle build.

Next: [TOC Rules](TOC_RULES.md)
