import { App, Notice, TFile, TFolder } from "obsidian";
import { FileRef, IAppContext, IMetadataCache, INotice, IVault } from "../ports/IAppContext";

/**
 * Convert an Obsidian TFile into a Booker file reference.
 */
const toFileRef = (file: TFile): FileRef => ({ path: file.path, kind: "file" });
/**
 * Convert an Obsidian TFolder into a Booker folder reference.
 */
const toFolderRef = (folder: TFolder): FileRef => ({ path: folder.path, kind: "folder" });

const toTFile = (app: App, file: FileRef): TFile => {
  const resolved = app.vault.getAbstractFileByPath(file.path);
  if (resolved instanceof TFile) {
    return resolved;
  }
  throw new Error(`Booker: File not found: ${file.path}`);
};

/**
 * Vault adapter backed by the Obsidian vault API.
 */
class ObsidianVault implements IVault {
  constructor(private readonly app: App) {}

  async read(file: FileRef): Promise<string> {
    return this.app.vault.read(toTFile(this.app, file));
  }

  async modify(file: FileRef, content: string): Promise<void> {
    await this.app.vault.modify(toTFile(this.app, file), content);
  }

  async create(path: string, content: string): Promise<FileRef> {
    const created = await this.app.vault.create(path, content);
    return toFileRef(created);
  }

  async createFolder(path: string): Promise<void> {
    await this.app.vault.createFolder(path);
  }

  getFileByPath(path: string): FileRef | null {
    const found = this.app.vault.getAbstractFileByPath(path);
    if (found instanceof TFile) {
      return toFileRef(found);
    }
    if (found instanceof TFolder) {
      return toFolderRef(found);
    }
    return null;
  }

  listFolderFiles(folder: FileRef, recursive: boolean): FileRef[] {
    const results: FileRef[] = [];
    const root = folder.path ? this.app.vault.getAbstractFileByPath(folder.path) : this.app.vault.getRoot();
    if (!(root instanceof TFolder)) {
      return results;
    }

    const walk = (current: TFolder): void => {
      for (const child of current.children) {
        if (child instanceof TFile) {
          results.push(toFileRef(child));
        } else if (recursive && child instanceof TFolder) {
          walk(child);
        }
      }
    };

    walk(root);
    return results;
  }
}

/**
 * Metadata cache adapter backed by the Obsidian metadata cache API.
 */
class ObsidianMetadataCache implements IMetadataCache {
  constructor(private readonly app: App) {}

  getFileCache(file: FileRef): { frontmatter?: Record<string, unknown> } | null {
    const cache = this.app.metadataCache.getFileCache(toTFile(this.app, file));
    return cache ? { frontmatter: cache.frontmatter ?? undefined } : null;
  }

  getFirstLinkpathDest(linkpath: string, fromPath: string): FileRef | null {
    const resolved = this.app.metadataCache.getFirstLinkpathDest(linkpath, fromPath);
    return resolved ? toFileRef(resolved) : null;
  }
}

/**
 * Notice adapter backed by Obsidian's Notice API.
 */
class ObsidianNotice implements INotice {
  notify(message: string): void {
    new Notice(message);
  }
}

/**
 * Adapter that exposes the Obsidian app as a Booker application context.
 */
export class ObsidianAppContext implements IAppContext {
  vault: IVault;
  metadataCache: IMetadataCache;
  notice: INotice;

  constructor(app: App) {
    this.vault = new ObsidianVault(app);
    this.metadataCache = new ObsidianMetadataCache(app);
    this.notice = new ObsidianNotice();
  }
}

/**
 * Create a Booker file reference from an Obsidian TFile.
 */
export const createFileRef = (file: TFile): FileRef => toFileRef(file);
