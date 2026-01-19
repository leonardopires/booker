import { FileRef, IVault } from "../ports/IAppContext";
import { normalizePath } from "../utils/PathUtils";

/**
 * Provides file IO helpers for reading and writing vault files.
 */
export class VaultIO {
  constructor(private readonly vault: IVault) {}

  /**
   * Ensure the output file exists, creating parent folders as needed.
   *
   * @param path - Output file path.
   * @returns File reference to the output file.
   */
  async ensureOutputFile(path: string): Promise<FileRef> {
    const outputPath = normalizePath(path);
    await this.ensureFolderForPath(outputPath);
    const existing = this.vault.getFileByPath(outputPath);
    if (existing) {
      return existing;
    }
    return this.vault.create(outputPath, "");
  }

  /**
   * Read file contents from the vault.
   *
   * @param file - File reference to read.
   * @returns File contents.
   */
  async read(file: FileRef): Promise<string> {
    return this.vault.read(file);
  }

  /**
   * Write content to a vault file.
   *
   * @param file - File reference to write.
   * @param content - Content to write.
   */
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
