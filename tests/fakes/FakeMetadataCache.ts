import { FileCache, FileRef, IMetadataCache } from "../../src/ports/IAppContext";
import { getBasename, normalizePath } from "../../src/utils/PathUtils";
import { FakeVault } from "./FakeVault";

export class FakeMetadataCache implements IMetadataCache {
  private readonly frontmatter = new Map<string, Record<string, unknown>>();

  constructor(private readonly vault: FakeVault) {}

  setFrontmatter(path: string, frontmatter: Record<string, unknown>): void {
    this.frontmatter.set(normalizePath(path), frontmatter);
  }

  getFileCache(file: FileRef): FileCache | null {
    const frontmatter = this.frontmatter.get(normalizePath(file.path));
    if (!frontmatter) {
      return null;
    }
    return { frontmatter };
  }

  getFirstLinkpathDest(linkpath: string, _fromPath: string): FileRef | null {
    const normalizedLink = normalizePath(linkpath);
    const candidates = normalizedLink.endsWith(".md")
      ? [normalizedLink]
      : [normalizedLink, `${normalizedLink}.md`];

    for (const candidate of candidates) {
      const found = this.vault.getFileByPath(candidate);
      if (found?.kind === "file") {
        return found;
      }
    }

    const targetBasename = getBasename(normalizedLink);
    for (const path of this.vault.listFilePaths()) {
      if (getBasename(path) === targetBasename) {
        return { path: normalizePath(path), kind: "file" };
      }
    }

    return null;
  }
}
