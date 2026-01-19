# Migrating from Longform

This guide helps Longform users map existing workflows to Booker without surprises.

## Concept mapping

| Longform concept | Booker concept |
| --- | --- |
| Project | Recipe or bundle (depending on size) |
| Outline | Recipe order list |
| Scene | Regular note |
| Compile | Generate |

## What Booker replaces

- The compile step (Booker generates outputs on demand).
- Outline ordering (explicit `order:` lists in recipes).
- Project state (frontmatter is the source of truth).

## What Booker intentionally does not replace

- A sidebar project UI.
- Auto‑created project files.
- Implicit ordering or hidden metadata.

If you prefer explicit control, Booker is a good fit.

## Step‑by‑step migration example

1. **Pick one Longform project** you want to migrate first.
2. **Create a recipe** note that lists your existing scenes in order.
3. **Generate the recipe** to validate the flow.
4. **Create a bundle** if you need multiple recipes in one output.

Example recipe:
```yaml
---
type: booker-recipe
title: "Chapter 1"
output: "~/Output/Chapter 1.md"
order:
  - "[[Scene 01]]"
  - "[[Scene 02]]"
  - "[[Scene 03]]"
---
```

Example bundle:
```yaml
---
type: booker-bundle
title: "My Novel"
targets:
  - "[[Chapter 1]]"
  - "[[Chapter 2]]"
aggregate_output: "~/Output/My Novel.md"
aggregate_toc: true
aggregate_toc_scope: tree
---
```

## Feature comparison (Longform vs Booker)

| Feature | Longform | Booker |
| --- | --- | --- |
| Project tracking | Built‑in UI | Frontmatter in notes |
| Outline ordering | Sidebar drag‑and‑drop | Explicit `order:` lists |
| Compile output | Yes | Yes |
| Auto‑created project files | Yes | No |
| Hidden state | Some | None |

## Explicit over implicit (Booker’s philosophy)

Booker favors explicit lists and output paths so you can always see what will be built. This makes workflows more transparent and easier to version‑control.

## Simpler by design

Booker’s goal is not to replicate every Longform feature. It aims to stay small, reliable, and predictable so your writing workflow is stable over time.

Next: [Writer FAQ](FAQ.md)
