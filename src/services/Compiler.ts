import { BookerProjectConfig, CompileResult, TargetResult } from "../domain/types";
import { FileRef } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { LinkResolver } from "./LinkResolver";
import { MarkdownTransform } from "./MarkdownTransform";
import { VaultIO } from "./VaultIO";

export type ContentChunk = {
  content: string;
  basename: string;
};

export class Compiler {
  constructor(
    private readonly linkResolver: LinkResolver,
    private readonly vaultIO: VaultIO,
    private readonly markdownTransform: MarkdownTransform
  ) {}

  async compile(config: BookerProjectConfig, contextPath: string): Promise<CompileResult> {
    const resolvedFiles: FileRef[] = [];
    const missingLinks: string[] = [];
    const skippedSelfIncludes: string[] = [];
    const normalizedOutput = normalizePath(config.outputPath);

    for (const item of config.order) {
      const linkpath = this.linkResolver.normalizeLinkString(item);
      const resolved = this.linkResolver.resolveToFile(linkpath, contextPath);
      if (!resolved) {
        missingLinks.push(linkpath);
        continue;
      }
      const resolvedPath = normalizePath(resolved.path);
      if (resolvedPath === normalizedOutput) {
        skippedSelfIncludes.push(resolvedPath);
        continue;
      }
      resolvedFiles.push(resolved);
    }

    const content = await this.compileFromFiles(resolvedFiles, config);

    return {
      content,
      missingLinks,
      skippedSelfIncludes,
      resolvedCount: resolvedFiles.length
    };
  }

  async compileAndWrite(
    config: BookerProjectConfig,
    contextPath: string,
    dryRun: boolean
  ): Promise<TargetResult> {
    const result = await this.compile(config, contextPath);
    const success = result.resolvedCount > 0;

    if (success && !dryRun) {
      const outputFile = await this.vaultIO.ensureOutputFile(config.outputPath);
      await this.vaultIO.write(outputFile, result.content);
    }

    return {
      name: config.title ?? "Booker Project",
      outputPath: config.outputPath,
      missingLinks: result.missingLinks,
      skippedSelfIncludes: result.skippedSelfIncludes,
      success,
      resolvedCount: result.resolvedCount
    };
  }

  compileFromChunks(chunks: ContentChunk[], config: BookerProjectConfig): string {
    const pieces = chunks.map((chunk) => {
      let content = this.markdownTransform.apply(chunk.content, config.options);
      if (!config.options.strip_title) {
        content = this.ensureFilenameTitle(content, chunk.basename);
      }
      return content.trim();
    });

    const titlePrefix = config.title ? `# ${config.title}\n\n` : "";
    const joined = this.markdownTransform.joinChunks(pieces, config.options.separator);
    return `${titlePrefix}${joined}`.trimEnd() + "\n";
  }

  async writeOutput(path: string, content: string): Promise<void> {
    const outputFile = await this.vaultIO.ensureOutputFile(path);
    await this.vaultIO.write(outputFile, content);
  }

  private async compileFromFiles(files: FileRef[], config: BookerProjectConfig): Promise<string> {
    const chunks: ContentChunk[] = [];
    for (const file of files) {
      const content = await this.vaultIO.read(file);
      chunks.push({ content, basename: getBasename(file.path) });
    }
    return this.compileFromChunks(chunks, config);
  }

  private ensureFilenameTitle(content: string, filename: string): string {
    const titleLine = `# ${filename}`;
    const trimmed = content.trimStart();
    if (trimmed.startsWith(`${titleLine}\n`) || trimmed === titleLine) {
      return content;
    }
    return `${titleLine}\n\n${content.trimStart()}`;
  }
}
