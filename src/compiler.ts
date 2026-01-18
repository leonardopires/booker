import { App, TFile, normalizePath } from "obsidian";
import { normalizeLinkString, resolveLinkToFile } from "./links";
import { applyTransforms, joinChunks } from "./markdown";
import { ensureOutputFile, readFile, writeFile } from "./vault";
import { CompileConfig, CompileResult, TargetResult } from "./types";

export type ContentChunk = {
  content: string;
  basename: string;
};

function ensureFilenameTitle(content: string, filename: string): string {
  const titleLine = `# ${filename}`;
  const trimmed = content.trimStart();
  if (trimmed.startsWith(`${titleLine}\n`) || trimmed === titleLine) {
    return content;
  }
  return `${titleLine}\n\n${content.trimStart()}`;
}

export function compileFromChunks(
  chunks: ContentChunk[],
  options: CompileConfig["options"],
  title?: string
): string {
  const pieces = chunks.map((chunk) => {
    let content = chunk.content;
    if (!options.strip_title) {
      content = ensureFilenameTitle(content, chunk.basename);
    }
    content = applyTransforms(content, options);
    return content.trim();
  });

  const titlePrefix = title ? `# ${title}\n\n` : "";
  const joined = joinChunks(pieces, options.separator);
  return `${titlePrefix}${joined}`.trimEnd() + "\n";
}

async function compileFromFiles(
  app: App,
  files: TFile[],
  options: CompileConfig["options"],
  title?: string
): Promise<string> {
  const chunks: ContentChunk[] = [];
  for (const file of files) {
    const content = await readFile(app, file);
    chunks.push({ content, basename: file.basename });
  }
  return compileFromChunks(chunks, options, title);
}

export async function compileProject(
  app: App,
  projectConfig: CompileConfig,
  contextFilePath: string
): Promise<CompileResult> {
  const resolvedFiles: TFile[] = [];
  const missingLinks: string[] = [];
  const skippedSelfIncludes: string[] = [];

  for (const item of projectConfig.order) {
    const linkpath = normalizeLinkString(item);
    const resolved = resolveLinkToFile(app, linkpath, contextFilePath);
    if (!resolved) {
      missingLinks.push(linkpath);
      continue;
    }
    const resolvedPath = normalizePath(resolved.path);
    if (resolvedPath === projectConfig.outputPath) {
      skippedSelfIncludes.push(resolvedPath);
      continue;
    }
    resolvedFiles.push(resolved);
  }

  const content = await compileFromFiles(app, resolvedFiles, projectConfig.options, projectConfig.title);

  return {
    content,
    missingLinks,
    skippedSelfIncludes,
    resolvedCount: resolvedFiles.length
  };
}

export async function compileFromTFiles(
  app: App,
  files: TFile[],
  options: CompileConfig["options"],
  title?: string
): Promise<string> {
  return compileFromFiles(app, files, options, title);
}

export async function writeCompiledOutput(
  app: App,
  outputPath: string,
  content: string
): Promise<void> {
  const outputFile = await ensureOutputFile(app, outputPath);
  await writeFile(app, outputFile, content);
}

export async function compileAndWriteProject(
  app: App,
  projectConfig: CompileConfig,
  contextFilePath: string,
  dryRun: boolean
): Promise<TargetResult> {
  const result = await compileProject(app, projectConfig, contextFilePath);
  const success = result.resolvedCount > 0;

  if (success && !dryRun) {
    await writeCompiledOutput(app, projectConfig.outputPath, result.content);
  }

  return {
    name: projectConfig.title ?? "Booker Project",
    outputPath: projectConfig.outputPath,
    missingLinks: result.missingLinks,
    skippedSelfIncludes: result.skippedSelfIncludes,
    success,
    resolvedCount: result.resolvedCount
  };
}
