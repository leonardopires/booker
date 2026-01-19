import { BookerRecipeConfig, CompileResult, TargetResult } from "../domain/types";
import { FileRef } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { LinkResolver } from "./LinkResolver";
import { MarkdownTransform } from "./MarkdownTransform";
import { VaultIO } from "./VaultIO";

/**
 * Shared BookerContext shape for Compiler dependencies.
 */
export type CompilerContext = {
  linkResolver: LinkResolver;
  vaultIO: VaultIO;
  markdownTransform: MarkdownTransform;
};

export type ContentChunk = {
  content: string;
  basename: string;
};

/**
 * Compiles recipes into combined Markdown output.
 */
export class Compiler {
  constructor(private readonly context: CompilerContext) {}

  /**
   * Compile a recipe into a single Markdown output string.
   *
   * @param config - Recipe configuration to compile.
   * @param contextPath - Path used to resolve relative links.
   * @returns Compilation result with content and diagnostics.
   */
  async compile(config: BookerRecipeConfig, contextPath: string): Promise<CompileResult> {
    const resolvedFiles: FileRef[] = [];
    const missingLinks: string[] = [];
    const skippedSelfIncludes: string[] = [];
    const normalizedOutput = normalizePath(config.outputPath);

    for (const item of config.order) {
      const linkpath = this.context.linkResolver.normalizeLinkString(item);
      const resolved = this.context.linkResolver.resolveToFile(linkpath, contextPath);
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

  /**
   * Compile a recipe and optionally persist the output.
   *
   * @param config - Recipe configuration to compile.
   * @param contextPath - Path used to resolve relative links.
   * @param dryRun - When true, skip writing output to the vault.
   * @returns Target result containing output status and diagnostics.
   */
  async compileAndWrite(
    config: BookerRecipeConfig,
    contextPath: string,
    dryRun: boolean
  ): Promise<TargetResult> {
    const result = await this.compile(config, contextPath);
    const success = result.resolvedCount > 0;

    if (success && !dryRun) {
      const outputFile = await this.context.vaultIO.ensureOutputFile(config.outputPath);
      await this.context.vaultIO.write(outputFile, result.content);
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

  /**
   * Compile Markdown chunks into a single output string.
   *
   * @param chunks - Ordered list of content chunks.
   * @param config - Recipe configuration used for transforms.
   * @returns Combined Markdown content.
   */
  compileFromChunks(chunks: ContentChunk[], config: BookerRecipeConfig): string {
    const pieces = chunks.map((chunk) => {
      let content = this.context.markdownTransform.apply(chunk.content, config.options);
      if (!config.options.strip_title) {
        content = this.ensureFilenameTitle(content, chunk.basename);
      }
      content = this.context.markdownTransform.applyHeadingOffset(content, config.options);
      return content.trim();
    });

    const titlePrefix = config.title ? `# ${config.title}\n\n` : "";
    const joined = this.context.markdownTransform.joinChunks(pieces, config.options.separator);
    return `${titlePrefix}${joined}`.trimEnd() + "\n";
  }

  /**
   * Persist content to the given vault path.
   *
   * @param path - Output file path.
   * @param content - Content to write.
   */
  async writeOutput(path: string, content: string): Promise<void> {
    const outputFile = await this.context.vaultIO.ensureOutputFile(path);
    await this.context.vaultIO.write(outputFile, content);
  }

  private async compileFromFiles(files: FileRef[], config: BookerRecipeConfig): Promise<string> {
    const chunks: ContentChunk[] = [];
    for (const file of files) {
      const content = await this.context.vaultIO.read(file);
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
