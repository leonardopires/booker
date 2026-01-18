import { IMetadataCache, FileRef } from "../ports/IAppContext";

export class LinkResolver {
  constructor(private readonly metadataCache: IMetadataCache) {}

  normalizeLinkString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
      const inner = trimmed.slice(2, -2);
      const [target = ""] = inner.split("|");
      return target.trim();
    }
    return trimmed;
  }

  resolveToFile(linkpath: string, fromPath: string): FileRef | null {
    return this.metadataCache.getFirstLinkpathDest(linkpath, fromPath);
  }
}
