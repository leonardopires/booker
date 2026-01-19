# Developer Quickstart

This guide orients you to the Booker codebase and how to run it locally.

## Repository overview

- `src/` — plugin source code (TypeScript)
- `tests/` — unit tests (Vitest)
- `esbuild.config.mjs` — build configuration
- `manifest.json` — Obsidian plugin manifest
- `scripts/install-to-vault.mjs` — local install helper

## How the plugin is structured

Booker is organized by responsibility:

- **Entry point:** `src/main.ts` registers commands, the panel view, and menus.
- **App wiring:** `src/app/BookerContext.ts` constructs services and adapters.
- **Services:** `src/services/` holds the core build pipeline (parser, compiler, build runner, TOC, notices).
- **Adapters:** `src/adapters/` integrate with Obsidian APIs and UI.
- **Domain types:** `src/domain/` defines configuration and build types.

## Where the main entry point is

- `src/main.ts` is the plugin entry class that Obsidian loads.

## How to run typecheck and tests

```bash
npm run typecheck
npm test
```

## How to test changes in Obsidian

1. Build the plugin:
   ```bash
   npm run build
   ```
2. Install it into a vault:
   ```bash
   node scripts/install-to-vault.mjs "/path/to/Vault"
   ```
3. Restart Obsidian or toggle the plugin.

For iterative work, run `npm run dev` to keep inline sourcemaps for debugging.

## Where most logic lives

Most logic is in `src/services/`, especially:
- `FrontmatterParser` (schema parsing + deprecations)
- `Compiler` (content assembly)
- `BuildRunner` (build orchestration + notices)

Next: [Architecture Overview](ARCHITECTURE.md)
