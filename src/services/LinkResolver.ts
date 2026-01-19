import { IMetadataCache, FileRef } from "../ports/IAppContext";

/**
 * Resolves Obsidian-style links to normalized paths and file references.
 */
export class LinkResolver {
  constructor(private readonly metadataCache: IMetadataCache) {}

  /**
   * Normalize a link string by trimming and extracting wikilink targets.
   *
   * @param raw - Raw link or path string.
   * @returns Normalized link target or trimmed path.
   */
  normalizeLinkString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
      const inner = trimmed.slice(2, -2);
      const [target = ""] = inner.split("|");
      return target.trim();
    }
    return trimmed;
  }

  /**
   * Resolve a normalized link to a file reference.
   *
   * @param linkpath - Normalized link path.
   * @param fromPath - Source path for relative resolution.
   * @returns File reference when found, otherwise null.
   */
  resolveToFile(linkpath: string, fromPath: string): FileRef | null {
    return this.metadataCache.getFirstLinkpathDest(linkpath, fromPath);
  }
}
