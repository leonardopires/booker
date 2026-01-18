import { App, TFile } from "obsidian";

async function ensureFolderForPath(app: App, outputPath: string): Promise<void> {
  const lastSlash = outputPath.lastIndexOf("/");
  if (lastSlash === -1) {
    return;
  }
  const folderPath = outputPath.slice(0, lastSlash);
  if (!folderPath) {
    return;
  }
  const existing = app.vault.getAbstractFileByPath(folderPath);
  if (!existing) {
    await app.vault.createFolder(folderPath);
  }
}

export async function ensureOutputFile(app: App, outputPath: string): Promise<TFile> {
  await ensureFolderForPath(app, outputPath);
  const existing = app.vault.getAbstractFileByPath(outputPath);
  if (existing instanceof TFile) {
    return existing;
  }
  return app.vault.create(outputPath, "");
}

export async function readFile(app: App, file: TFile): Promise<string> {
  return app.vault.read(file);
}

export async function writeFile(app: App, file: TFile, content: string): Promise<void> {
  await app.vault.modify(file, content);
}
