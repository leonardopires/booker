# Debugging

## How to debug notices

Booker uses Obsidian notices for user‑facing errors and build progress. Notices follow a consistent emoji + label format (see [Notice Conventions](../design/NOTICE_CONVENTIONS.md)).

If you need more detail:
- Check the developer console for warnings (Booker logs missing links and deprecations).
- Inspect the raw frontmatter in the note for schema mismatches.

## How to inspect build output

- Use the `output` or `aggregate_output` path in frontmatter to locate the generated file.
- Output is written only on successful builds (or when at least one source resolves, depending on the build path).
- For bundles, failed targets can be skipped depending on build options.

## Common error sources

- Missing `output` or `aggregate_output` paths.
- Empty `order` or `targets` lists.
- Invalid YAML frontmatter (missing closing `---`).
- Deprecated schema keys that no longer map cleanly.

## Reasoning about frontmatter parsing issues

- Booker reads cached frontmatter first; if it is missing, it parses YAML directly from the file.
- Legacy schemas are supported but emit warnings.
- Prefixed keys override nested or unprefixed keys.

If behavior looks wrong, compare your frontmatter with the canonical schema in [Frontmatter Schema](../design/FRONTMATTER_SCHEMA.md).
