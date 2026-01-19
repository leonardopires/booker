# Build and Release

## How builds work (conceptually)

- Booker uses **esbuild** to bundle `src/main.ts` into `dist/main.js`.
- The build output is CommonJS and targets ES2018.
- Development builds include inline sourcemaps.

## How to build

```bash
npm run build
```

## How releases are prepared

A release typically includes:
- `dist/main.js` from `npm run build`
- `manifest.json`
- `README.md` (if required by your release process)

## What must be checked before release

- Tests pass (`npm test`).
- Typecheck passes (`npm run typecheck`).
- `manifest.json` and `package.json` versions are aligned.
- Frontmatter schema changes are documented.

## Versioning expectations

Booker follows standard semantic versioning:
- **Patch**: fixes or small behavior corrections.
- **Minor**: additive behavior or new options (with docs).
- **Major**: breaking schema or output changes.
