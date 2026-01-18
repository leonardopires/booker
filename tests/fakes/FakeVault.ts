import { FileRef, IVault } from "../../src/ports/IAppContext";
import { getDirname, normalizePath } from "../../src/utils/PathUtils";

export class FakeVault implements IVault {
  private readonly files = new Map<string, string>();
  private readonly folders = new Set<string>();

  constructor(initialFiles: Record<string, string> = {}) {
    Object.entries(initialFiles).forEach(([path, content]) => {
      this.files.set(normalizePath(path), content);
      const folder = getDirname(path);
      if (folder) {
        this.folders.add(normalizePath(folder));
      }
    });
  }

  listFilePaths(): string[] {
    return Array.from(this.files.keys());
  }

  async read(file: FileRef): Promise<string> {
    const content = this.files.get(normalizePath(file.path));
    if (content === undefined) {
      throw new Error(`Missing file: ${file.path}`);
    }
    return content;
  }

  async modify(file: FileRef, content: string): Promise<void> {
    this.files.set(normalizePath(file.path), content);
  }

  async create(path: string, content: string): Promise<FileRef> {
    const normalized = normalizePath(path);
    this.files.set(normalized, content);
    const folder = getDirname(normalized);
    if (folder) {
      this.folders.add(normalizePath(folder));
    }
    return { path: normalized, kind: "file" };
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(normalizePath(path));
  }

  getFileByPath(path: string): FileRef | null {
    const normalized = normalizePath(path);
    if (this.files.has(normalized)) {
      return { path: normalized, kind: "file" };
    }
    if (this.folders.has(normalized)) {
      return { path: normalized, kind: "folder" };
    }
    return null;
  }
}
