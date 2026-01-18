export type FileRef = {
  path: string;
  kind: "file" | "folder";
};

export type FileCache = {
  frontmatter?: Record<string, unknown>;
};

export interface IVault {
  read(file: FileRef): Promise<string>;
  modify(file: FileRef, content: string): Promise<void>;
  create(path: string, content: string): Promise<FileRef>;
  createFolder(path: string): Promise<void>;
  getFileByPath(path: string): FileRef | null;
}

export interface IMetadataCache {
  getFileCache(file: FileRef): FileCache | null;
  getFirstLinkpathDest(linkpath: string, fromPath: string): FileRef | null;
}

export interface INotice {
  notify(message: string): void;
}

export interface IAppContext {
  vault: IVault;
  metadataCache: IMetadataCache;
  notice: INotice;
}
