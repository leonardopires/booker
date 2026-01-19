# Booker Documentation

Booker is an Obsidian plugin that compiles multiple Markdown notes into a single, ordered output using frontmatter stored inside your notes. It is intentionally simple and declarative: what you write in frontmatter is exactly what Booker builds, without hidden project state or extra config files.

## Who this documentation is for

- **Writers / longform authors** who want to assemble drafts from many notes in Obsidian.
- **Developers / contributors** who want to work on the TypeScript codebase and keep behavior deterministic.

## Documentation map

### For Writers

- [Writer Quickstart](writers/QUICKSTART.md)
- [Writing Guide](writers/WRITING_GUIDE.md)
- [Migrating from Longform](writers/MIGRATING_FROM_LONGFORM.md)
- [Writer FAQ](writers/FAQ.md)

### For Developers

- [Developer Quickstart](dev/QUICKSTART.md)
- [Architecture Overview](dev/ARCHITECTURE.md)
- [Contributing](dev/CONTRIBUTING.md)
- [Developer FAQ](dev/FAQ.md)

## Design references

- [Frontmatter Schema](design/FRONTMATTER_SCHEMA.md)
- [Notice Conventions](design/NOTICE_CONVENTIONS.md)
- [TOC Rules](design/TOC_RULES.md)

---

Booker is deliberately small and explicit. If something is not described in frontmatter, Booker does not guess for you. That simplicity is a feature, not a missing part.
