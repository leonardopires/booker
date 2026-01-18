import { App, TFile } from "obsidian";

export function normalizeLinkString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const inner = trimmed.slice(2, -2);
    const [target] = inner.split("|");
    return target.trim();
  }
  return trimmed;
}

export function resolveLinkToFile(app: App, linkpath: string, fromPath: string): TFile | null {
  return app.metadataCache.getFirstLinkpathDest(linkpath, fromPath);
}
