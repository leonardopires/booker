import { parseYaml } from "obsidian";
import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  BuildReport,
  BuildResult,
  CompileResult,
  TargetResult
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef, IVault } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { resolveFileLabel } from "../utils/LabelUtils";
import { BuildReporter } from "./BuildReporter";
import { Compiler, ContentChunk } from "./Compiler";
import { FrontmatterParser } from "./FrontmatterParser";
import { LinkResolver } from "./LinkResolver";
import { UserMessagePresenter } from "./UserMessagePresenter";

/**
 * Shared BookerContext shape for BuildRunner dependencies.
 */
export type BuildRunnerContext = {
  compiler: Compiler;
  parser: FrontmatterParser;
  linkResolver: LinkResolver;
  presenter: UserMessagePresenter;
  vault: IVault;
};

type BuildArtifact = {
  artifactPath: string;
  content: string;
};

type BuildOutcome = {
  artifactPath?: string;
  result?: BuildResult;
  report?: BuildReport;
};

/**
 * Runs Booker generation for recipes and bundles, producing outputs and summaries.
 */
export class BuildRunner {
  constructor(
    private readonly context: BuildRunnerContext
  ) {}

  /**
   * Build the provided file as a Booker recipe or bundle.
   *
   * @param file - The file reference to build.
   * @param callStack - Optional call stack used to detect bundle cycles.
   * @returns The build outcome, including any generated artifact and report.
   */
  async buildCurrentFile(file: FileRef, callStack: string[] = []): Promise<BuildOutcome> {
    const reporter = new BuildReporter(this.context.presenter);
    const frontmatterResult = await this.getFrontmatterWithDiagnostics(file);
    if (frontmatterResult.error) {
      this.reportYamlError(file, frontmatterResult.error, reporter);
      return { report: reporter.getReport() };
    }

    const frontmatter = frontmatterResult.frontmatter;
    const fileLabel = resolveFileLabel(file.path, frontmatter ?? null);
    if (!frontmatter) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"), fileLabel, reporter);
      return { report: reporter.getReport() };
    }

    const typeInfo = this.context.parser.normalizeType(frontmatter.type);
    if (!typeInfo.normalized) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"), fileLabel, reporter);
      return { report: reporter.getReport() };
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated, fileLabel, reporter);

    try {
      if (typeInfo.normalized === "booker-recipe") {
        const recipeFrontmatter = frontmatter as BookerRecipeFrontmatter;
        const artifact = await this.buildRecipe(file, recipeFrontmatter, fileLabel, reporter);
        if (artifact) {
          reporter.success(fileLabel, "Generation completed successfully.");
          return { artifactPath: artifact.artifactPath, report: reporter.getReport() };
        }
        return { report: reporter.getReport() };
      }

      const bundleFrontmatter = frontmatter as BookerBundleFrontmatter;
      const bundleOutcome = await this.buildBundle(file, callStack, reporter, fileLabel, bundleFrontmatter);
      if (bundleOutcome.artifact) {
        return {
          artifactPath: bundleOutcome.artifact.artifactPath,
          result: bundleOutcome.result,
          report: reporter.getReport()
        };
      }
      return { result: bundleOutcome.result, report: reporter.getReport() };
    } catch (error) {
      this.handleError(error, fileLabel, reporter);
      return { report: reporter.getReport() };
    }
  }

  private async buildBundle(
    file: FileRef,
    callStack: string[],
    reporter: BuildReporter,
    bundleLabel: string,
    frontmatter: BookerBundleFrontmatter
  ): Promise<{ artifact: BuildArtifact | null; result: BuildResult }> {
    const normalizedPath = normalizePath(file.path);
    if (callStack.includes(normalizedPath)) {
      throw this.createCycleError([...callStack, normalizedPath]);
    }

    const typeInfo = this.context.parser.normalizeType(frontmatter.type);
    if (typeInfo.normalized !== "booker-bundle") {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated, bundleLabel, reporter);

    const bundleConfig = this.context.parser.parseBundleConfig(frontmatter as BookerBundleFrontmatter, file);
    const bundleName = getBasename(file.path);
    if (!bundleConfig.aggregate?.outputPath) {
      throw new BookerError("BUNDLE_MISSING_AGGREGATE_OUTPUT", bundleName);
    }

    reporter.info(bundleLabel, `Running ${bundleConfig.targets.length} targets…`);

    const stack = [...callStack, normalizedPath];
    const results: TargetResult[] = [];
    const successfulChunks: ContentChunk[] = [];
    const outputPaths: string[] = [];
    const summaryCounts = { success: 0, warning: 0, error: 0 };

    for (const target of bundleConfig.targets) {
      const targetStartCounts = reporter.getReport().counts;
      const targetResult = await this.buildBundleTarget(target, file, stack, bundleConfig.buildOptions, reporter);
      const targetEndCounts = reporter.getReport().counts;
      const targetDelta = this.diffCounts(targetEndCounts, targetStartCounts);
      const targetStatus = this.getStatusFromCounts(targetDelta);
      summaryCounts[targetStatus] += 1;
      results.push(targetResult.result);
      if (targetResult.artifact) {
        successfulChunks.push({
          content: targetResult.artifact.content,
          basename: getBasename(targetResult.artifact.artifactPath)
        });
        outputPaths.push(normalizePath(targetResult.artifact.artifactPath));
      }

      if (!targetResult.result.success && bundleConfig.buildOptions.stop_on_error) {
        break;
      }
    }

    const aggregate = await this.aggregateBundleOutputs(
      bundleConfig.aggregate,
      outputPaths,
      successfulChunks,
      bundleConfig,
      bundleName
    );

    const successes = results.filter((result) => result.success).length;
    const failures = results.filter((result) => !result.success).length;
    const missingTotal = results.reduce((total, result) => total + result.missingLinks.length, 0);

    const buildResult: BuildResult = {
      targets: results,
      successes,
      failures,
      missingTotal,
      aggregate: {
        attempted: true,
        success: !!aggregate,
        outputPath: aggregate?.outputPath
      }
    };

    const bundleStatus = this.getStatusFromCounts(summaryCounts);
    this.reportBundleSummary(bundleLabel, reporter, summaryCounts, bundleStatus);

    return {
      artifact: aggregate
        ? {
            artifactPath: aggregate.outputPath,
            content: aggregate.content
          }
        : null,
      result: buildResult
    };
  }

  private async buildBundleTarget(
    target: string,
    bundleFile: FileRef,
    callStack: string[],
    buildOptions: BookerBundleConfig["buildOptions"],
    reporter: BuildReporter
  ): Promise<{ result: TargetResult; artifact?: BuildArtifact }> {
    const resolved = this.resolveSourceFile(target, bundleFile.path);
    const targetName = getBasename(resolved.path);

    const frontmatterResult = await this.getFrontmatterWithDiagnostics(resolved);
    const targetFrontmatter = frontmatterResult.frontmatter;
    const targetLabel = resolveFileLabel(resolved.path, targetFrontmatter ?? null);
    if (frontmatterResult.error) {
      this.reportYamlError(resolved, frontmatterResult.error, reporter);
      return {
        result: {
          name: targetName,
          outputPath: "",
          missingLinks: [],
          skippedSelfIncludes: [],
          success: false,
          resolvedCount: 0
        }
      };
    }
    if (!targetFrontmatter) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"), targetLabel, reporter);
      return {
        result: {
          name: targetName,
          outputPath: "",
          missingLinks: [],
          skippedSelfIncludes: [],
          success: false,
          resolvedCount: 0
        }
      };
    }

    const typeInfo = this.context.parser.normalizeType(targetFrontmatter.type);
    if (!typeInfo.normalized) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"), targetLabel, reporter);
      return {
        result: {
          name: targetName,
          outputPath: "",
          missingLinks: [],
          skippedSelfIncludes: [],
          success: false,
          resolvedCount: 0
        }
      };
    }

    this.warnIfDeprecated(resolved.path, targetFrontmatter.type, typeInfo.deprecated, targetLabel, reporter);

    if (typeInfo.normalized === "booker-recipe") {
      try {
        const recipeConfig = this.context.parser.parseRecipeConfig(
          targetFrontmatter as BookerRecipeFrontmatter,
          resolved
        );
        const compileResult = await this.context.compiler.compile(recipeConfig, resolved.path);
        const targetResult = this.createTargetResult(targetName, recipeConfig.outputPath, compileResult);
        return this.handleCompileResult(
          recipeConfig,
          compileResult,
          buildOptions,
          targetResult,
          targetLabel,
          reporter
        );
      } catch (error) {
        this.handleError(error, targetLabel, reporter);
        return {
          result: {
            name: targetName,
            outputPath: "",
            missingLinks: [],
            skippedSelfIncludes: [],
            success: false,
            resolvedCount: 0
          }
        };
      }
    }

    const bundleFrontmatter = targetFrontmatter as BookerBundleFrontmatter;
    const bundleOutcome = await this.buildBundle(resolved, callStack, reporter, targetLabel, bundleFrontmatter);
    if (!bundleOutcome.artifact) {
      const targetResult: TargetResult = {
        name: targetName,
        outputPath: "",
        missingLinks: [],
        skippedSelfIncludes: [],
        success: false,
        resolvedCount: 0
      };
      return { result: targetResult };
    }

    return {
      result: {
        name: targetName,
        outputPath: bundleOutcome.artifact.artifactPath,
        missingLinks: [],
        skippedSelfIncludes: [],
        success: true,
        resolvedCount: 1
      },
      artifact: bundleOutcome.artifact
    };
  }

  private async handleCompileResult(
    config: BookerRecipeConfig,
    compileResult: CompileResult,
    buildOptions: BookerBundleConfig["buildOptions"],
    targetResult: TargetResult,
    fileLabel: string,
    reporter: BuildReporter
  ): Promise<{ result: TargetResult; artifact?: BuildArtifact }> {
    if (compileResult.missingLinks.length > 0) {
      console.warn(`Booker: Missing files for ${config.outputPath}:`, compileResult.missingLinks);
    }

    if (compileResult.skippedSelfIncludes.length > 0) {
      console.warn(`Booker: Skipped self-inclusion for ${config.outputPath}:`, compileResult.skippedSelfIncludes);
      reporter.warning(
        fileLabel,
        "I skipped one step to avoid a loop.\nA file tried to include its own output."
      );
    }

    let success = compileResult.resolvedCount > 0;
    if (compileResult.missingLinks.length > 0 && !buildOptions.continue_on_missing) {
      success = false;
    }

    const result: TargetResult = {
      ...targetResult,
      success
    };

    if (success && !buildOptions.dry_run) {
      await this.context.compiler.writeOutput(config.outputPath, compileResult.content);
    }

    if (success) {
      reporter.success(fileLabel, "Generation completed successfully.");
    } else {
      reporter.error(fileLabel, "Generation failed.");
    }

    return success
      ? {
          result,
          artifact: {
            artifactPath: config.outputPath,
            content: compileResult.content
          }
        }
      : { result };
  }

  private async aggregateBundleOutputs(
    aggregate: AggregateConfig | undefined,
    outputPaths: string[],
    successfulChunks: ContentChunk[],
    bundleConfig: BookerBundleConfig,
    bundleName: string
  ): Promise<{ outputPath: string; content: string } | null> {
    if (!aggregate) {
      throw new BookerError("BUNDLE_MISSING_AGGREGATE_OUTPUT", bundleName);
    }

    if (successfulChunks.length === 0) {
      return null;
    }

    if (outputPaths.includes(normalizePath(aggregate.outputPath))) {
      throw new BookerError("AGGREGATE_OUTPUT_CONFLICT", "AGGREGATE_OUTPUT_CONFLICT");
    }

    const aggregateContent = this.context.compiler.compileFromChunks(successfulChunks, {
      title: aggregate.title,
      outputPath: aggregate.outputPath,
      order: [],
      options: aggregate.options
    });

    if (!bundleConfig.buildOptions.dry_run) {
      await this.context.compiler.writeOutput(aggregate.outputPath, aggregateContent);
    }

    return { outputPath: aggregate.outputPath, content: aggregateContent };
  }

  private async buildRecipe(
    file: FileRef,
    frontmatter: BookerRecipeFrontmatter,
    fileLabel: string,
    reporter: BuildReporter
  ): Promise<BuildArtifact | null> {
    const config = this.context.parser.parseRecipeConfig(frontmatter, file);
    const result = await this.context.compiler.compile(config, file.path);
    if (result.skippedSelfIncludes.length > 0) {
      console.warn(`Booker: Skipped self-inclusion for ${file.path}:`, result.skippedSelfIncludes);
      reporter.warning(
        fileLabel,
        "I skipped one step to avoid a loop.\nA file tried to include its own output."
      );
    }

    if (result.missingLinks.length > 0) {
      console.warn(`Booker: Missing files for ${file.path}:`, result.missingLinks);
    }

    if (result.resolvedCount === 0) {
      reporter.error(fileLabel, "Generation failed.");
      return null;
    }

    await this.context.compiler.writeOutput(config.outputPath, result.content);
    return { artifactPath: config.outputPath, content: result.content };
  }

  private resolveSourceFile(source: string, fromPath: string): FileRef {
    const linkpath = this.context.linkResolver.normalizeLinkString(source);
    const resolved = this.context.linkResolver.resolveToFile(linkpath, fromPath);
    if (!resolved) {
      throw new BookerError("SOURCE_NOT_FOUND", linkpath);
    }
    return resolved;
  }

  private createTargetResult(name: string, outputPath: string, compileResult: CompileResult): TargetResult {
    return {
      name,
      outputPath,
      missingLinks: compileResult.missingLinks,
      skippedSelfIncludes: compileResult.skippedSelfIncludes,
      success: false,
      resolvedCount: compileResult.resolvedCount
    };
  }

  private warnIfDeprecated(
    path: string,
    rawType: unknown,
    deprecated: boolean,
    fileLabel: string,
    reporter: BuildReporter
  ): void {
    if (!deprecated) {
      return;
    }
    const message = "This note uses a deprecated Booker type. Update to `type: booker-recipe` or `type: booker-bundle`.";
    reporter.warning(fileLabel, message);
    console.warn(`Booker: Deprecated type "${String(rawType)}" in ${path}.`);
  }

  private createCycleError(callStack: string[]): BookerError {
    const cycle = callStack.map((path) => getBasename(path)).join(" → ");
    return new BookerError("CYCLE_DETECTED", cycle);
  }

  private handleError(error: unknown, fileLabel: string, reporter: BuildReporter): void {
    const { message, severity } = this.formatUserMessage(error);
    if (severity === "warning") {
      reporter.warning(fileLabel, message);
      return;
    }
    reporter.error(fileLabel, message);
  }

  private formatUserMessage(error: unknown): { message: string; severity: "error" | "warning" } {
    if (error instanceof BookerError) {
      switch (error.code) {
        case "INVALID_TYPE":
          return {
            message:
              "This note isn’t a Booker recipe or bundle.\nAdd `type: booker-recipe` or `type: booker-bundle` at the top.",
            severity: "error"
          };
        case "DEPRECATED_BUNDLE_SCHEMA":
          return {
            message:
              "This bundle uses the deprecated target schema.\nUpdate `targets` to a simple list of wikilinks or paths, then generate again.",
            severity: "warning"
          };
        case "MISSING_OUTPUT":
          return {
            message: "This recipe has no output file.\nAdd `output: \"path/to/file.md\"` to the YAML.",
            severity: "error"
          };
        case "MISSING_ORDER":
          return {
            message: "This recipe has no sources yet.\nAdd an `order:` list with note links.",
            severity: "error"
          };
        case "MISSING_TARGETS":
          return {
            message: "This bundle has no targets yet.\nAdd a `targets:` list with note links.",
            severity: "error"
          };
        case "SOURCE_NOT_FOUND":
          return {
            message: `I couldn’t find the note ‘${error.message}’.\nCheck the name or create the note.`,
            severity: "error"
          };
        case "BUNDLE_MISSING_AGGREGATE_OUTPUT":
          return {
            message: `The bundle ‘${error.message}’ has no final output.\nAdd \`aggregate.output\` so it can be used here.`,
            severity: "error"
          };
        case "CYCLE_DETECTED":
          return {
            message: `These bundles reference each other in a loop:\n${error.message}.\nBreak the loop to continue.`,
            severity: "error"
          };
        case "AGGREGATE_OUTPUT_CONFLICT":
          return {
            message: "This bundle’s final output conflicts with one of its targets.\nChoose a different `aggregate.output`.",
            severity: "error"
          };
        default:
          break;
      }
    }
    console.error("Booker: Unhandled error", error);
    return {
      message: "Something went wrong while generating.\nCheck the console for details.",
      severity: "error"
    };
  }

  private reportBundleSummary(
    bundleLabel: string,
    reporter: BuildReporter,
    counts: { success: number; warning: number; error: number },
    status: "success" | "warning" | "error"
  ): void {
    if (status === "error") {
      reporter.announce(
        "error",
        bundleLabel,
        `Failed (✅${counts.success} ⚠️${counts.warning} ❌${counts.error})`
      );
      return;
    }
    if (status === "warning") {
      reporter.announce(
        "warning",
        bundleLabel,
        `Completed with warnings (✅${counts.success} ⚠️${counts.warning} ❌${counts.error})`
      );
      return;
    }
    reporter.announce(
      "success",
      bundleLabel,
      `Completed (✅${counts.success} ⚠️${counts.warning} ❌${counts.error})`
    );
  }

  private diffCounts(
    current: { success: number; warning: number; error: number },
    baseline: { success: number; warning: number; error: number }
  ): { success: number; warning: number; error: number } {
    return {
      success: Math.max(0, current.success - baseline.success),
      warning: Math.max(0, current.warning - baseline.warning),
      error: Math.max(0, current.error - baseline.error)
    };
  }

  private getStatusFromCounts(counts: { success: number; warning: number; error: number }): "success" | "warning" | "error" {
    if (counts.error > 0) {
      return "error";
    }
    if (counts.warning > 0) {
      return "warning";
    }
    return "success";
  }

  private async getFrontmatterWithDiagnostics(
    file: FileRef
  ): Promise<{ frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter | null; error: YamlErrorInfo | null }> {
    const frontmatter = this.context.parser.getFrontmatter(file) as
      | BookerRecipeFrontmatter
      | BookerBundleFrontmatter
      | null;
    if (frontmatter) {
      return { frontmatter, error: null };
    }

    const content = await this.context.vault.read(file);
    const extracted = this.extractFrontmatter(content);
    if (!extracted) {
      return { frontmatter: null, error: null };
    }
    if (extracted.error) {
      return { frontmatter: null, error: extracted.error };
    }

    try {
      const parsed = parseYaml(extracted.content);
      return {
        frontmatter: (parsed ?? null) as BookerRecipeFrontmatter | BookerBundleFrontmatter | null,
        error: null
      };
    } catch (error) {
      return {
        frontmatter: null,
        error: this.formatYamlError(error)
      };
    }
  }

  private reportYamlError(file: FileRef, error: YamlErrorInfo, reporter: BuildReporter): void {
    const label = resolveFileLabel(file.path, null);
    const location =
      error.line !== null
        ? ` (line ${error.line}${error.column !== null ? `, col ${error.column}` : ""})`
        : "";
    reporter.error(label, `YAML syntax error${location}: ${error.reason}`);
    reporter.info(
      label,
      "Hint: Check indentation, ensure each key has a ':' and list items start with '-'."
    );
  }

  private extractFrontmatter(
    content: string
  ): { content: string; error: null } | { content: null; error: YamlErrorInfo } | null {
    const lines = content.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") {
      return null;
    }
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      if (line.trim() === "---" || line.trim() === "...") {
        return { content: lines.slice(1, index).join("\n"), error: null };
      }
    }
    const lastContentIndex = [...lines].reverse().findIndex((line) => line.trim().length > 0);
    const lastLineNumber = lastContentIndex >= 0 ? lines.length - lastContentIndex : lines.length;
    return {
      content: null,
      error: {
        reason: "Missing closing '---' for YAML frontmatter.",
        line: lastLineNumber,
        column: null
      }
    };
  }

  private formatYamlError(error: unknown): YamlErrorInfo {
    const errorObject = error as {
      message?: string;
      line?: number;
      column?: number;
      mark?: { line?: number; column?: number };
    };
    const rawMessage = typeof errorObject.message === "string" ? errorObject.message : "Invalid YAML.";
    const trimmedMessage = rawMessage.split("\n")[0]?.replace(/^YAMLException:\s*/u, "") ?? "Invalid YAML.";
    const markLine = errorObject.mark?.line ?? errorObject.line;
    const markColumn = errorObject.mark?.column ?? errorObject.column;
    const line = typeof markLine === "number" ? markLine + 1 : null;
    const column = typeof markColumn === "number" ? markColumn + 1 : null;
    return {
      reason: trimmedMessage || "Invalid YAML.",
      line,
      column
    };
  }
}

type YamlErrorInfo = {
  reason: string;
  line: number | null;
  column: number | null;
};
