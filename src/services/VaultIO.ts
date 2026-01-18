import { FileRef, IVault } from "../ports/IAppContext";
import { normalizePath } from "../utils/PathUtils";

export class VaultIO {
  constructor(private readonly vault: IVault) {}

  async ensureOutputFile(path: string): Promise<FileRef> {
    const outputPath = normalizePath(path);
    await this.ensureFolderForPath(outputPath);
    const existing = this.vault.getFileByPath(outputPath);
    if (existing) {
      return existing;
    }
    return this.vault.create(outputPath, "");
  }

  async read(file: FileRef): Promise<string> {
    return this.vault.read(file);
  }

  async write(file: FileRef, content: string): Promise<void> {
    await this.vault.modify(file, content);
  }

  private async ensureFolderForPath(path: string): Promise<void> {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) {
      return;
    }
    const folderPath = path.slice(0, lastSlash);
    if (!folderPath) {
      return;
    }
    const existing = this.vault.getFileByPath(folderPath);
    if (!existing || existing.kind !== "folder") {
      await this.vault.createFolder(folderPath);
    }
  }
}
