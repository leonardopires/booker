import { BookerRecipeConfig, CompileResult, HeadingEntry, TargetResult } from "../domain/types";
import { FileRef } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { LinkResolver } from "./LinkResolver";
import { MarkdownTransform } from "./MarkdownTransform";
import { TableOfContentsBuilder } from "./TableOfContentsBuilder";
import { VaultIO } from "./VaultIO";

/**
 * Shared BookerContext shape for Compiler dependencies.
 */
export type CompilerContext = {
  linkResolver: LinkResolver;
  vaultIO: VaultIO;
  markdownTransform: MarkdownTransform;
  tocBuilder: TableOfContentsBuilder;
};

export type ContentChunk = {
  content: string;
  basename: string;
  sourcePath: string;
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

    const { content, headings } = await this.compileFromFiles(resolvedFiles, config);

    return {
      content,
      headings,
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
   * @param tocHeadingsOverride - Optional headings list to use for TOC rendering.
   * @returns Combined Markdown content and extracted headings.
   */
  compileFromChunks(
    chunks: ContentChunk[],
    config: BookerRecipeConfig,
    tocHeadingsOverride?: HeadingEntry[]
  ): { content: string; headings: HeadingEntry[] } {
    const headings: HeadingEntry[] = [];
    const pieces = chunks.map((chunk) => {
      let content = this.context.markdownTransform.apply(chunk.content, config.options);
      if (!config.options.strip_title) {
        content = this.ensureFilenameTitle(content, chunk.basename);
      }
      content = this.context.markdownTransform.applyHeadingOffset(content, config.options);
      headings.push(...this.context.markdownTransform.extractHeadings(content, chunk.sourcePath));
      return content.trim();
    });

    const titlePrefix = config.title ? `# ${config.title}` : "";
    if (titlePrefix) {
      headings.unshift({
        level: 1,
        text: config.title ?? "",
        sourcePath: config.outputPath
      });
    }

    const joined = this.context.markdownTransform.joinChunks(pieces, config.options.separator);
    const titleBlock = titlePrefix ? `${titlePrefix}\n\n` : "";
    const baseContent = `${titleBlock}${joined}`.trimEnd();
    const tocHeadings = tocHeadingsOverride
      ? [
          ...(titlePrefix
            ? [{ level: 1, text: config.title ?? "", sourcePath: config.outputPath }]
            : []),
          ...tocHeadingsOverride
        ]
      : headings;
    const contentWithToc = this.context.tocBuilder.apply(
      `${baseContent}\n`,
      tocHeadings,
      config.options,
      !!titlePrefix
    );

    return {
      content: contentWithToc,
      headings
    };
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

  private async compileFromFiles(
    files: FileRef[],
    config: BookerRecipeConfig
  ): Promise<{ content: string; headings: HeadingEntry[] }> {
    const chunks: ContentChunk[] = [];
    for (const file of files) {
      const content = await this.context.vaultIO.read(file);
      chunks.push({ content, basename: getBasename(file.path), sourcePath: file.path });
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
