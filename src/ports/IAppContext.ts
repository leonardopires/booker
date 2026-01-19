/**
 * Lightweight reference to a vault file or folder.
 */
export type FileRef = {
  path: string;
  kind: "file" | "folder";
};

/**
 * Cached metadata for a file, including frontmatter.
 */
export type FileCache = {
  frontmatter?: Record<string, unknown>;
};

/**
 * Vault IO interface used by Booker services.
 */
export interface IVault {
  read(file: FileRef): Promise<string>;
  modify(file: FileRef, content: string): Promise<void>;
  create(path: string, content: string): Promise<FileRef>;
  createFolder(path: string): Promise<void>;
  getFileByPath(path: string): FileRef | null;
  /**
   * List file refs inside a folder, optionally including subfolders.
   */
  listFolderFiles(folder: FileRef, recursive: boolean): FileRef[];
}

/**
 * Metadata cache interface used to resolve links and frontmatter.
 */
export interface IMetadataCache {
  getFileCache(file: FileRef): FileCache | null;
  getFirstLinkpathDest(linkpath: string, fromPath: string): FileRef | null;
}

/**
 * Notice interface for user-facing messages.
 */
export interface INotice {
  notify(message: string): void;
}

/**
 * Aggregate Booker application context used by services.
 */
export interface IAppContext {
  vault: IVault;
  metadataCache: IMetadataCache;
  notice: INotice;
}
