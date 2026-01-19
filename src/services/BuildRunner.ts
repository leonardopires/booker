import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  BuildResult,
  CompileResult,
  TargetResult
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
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
};

type BuildArtifact = {
  artifactPath: string;
  content: string;
};

type BuildOutcome = {
  artifactPath?: string;
  result?: BuildResult;
};

/**
 * Runs Booker generation for recipes and bundles, producing outputs and summaries.
 */
export class BuildRunner {
  constructor(
    private readonly context: BuildRunnerContext
  ) {}

  async buildCurrentFile(file: FileRef, callStack: string[] = []): Promise<BuildOutcome> {
    const frontmatter = this.context.parser.getFrontmatter(file) as BookerRecipeFrontmatter | null;
    if (!frontmatter) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"));
      return {};
    }

    const typeInfo = this.context.parser.normalizeType(frontmatter.type);
    if (!typeInfo.normalized) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"));
      return {};
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated);

    try {
      if (typeInfo.normalized === "booker-recipe") {
        const artifact = await this.buildRecipe(file, frontmatter);
        if (artifact) {
          this.context.presenter.showSuccess("Generation completed successfully.");
          return { artifactPath: artifact.artifactPath };
        }
        return {};
      }

      const bundleOutcome = await this.buildBundle(file, callStack);
      if (bundleOutcome.artifact) {
        this.context.presenter.showSuccess("Generation completed successfully.");
        return { artifactPath: bundleOutcome.artifact.artifactPath, result: bundleOutcome.result };
      }
      return { result: bundleOutcome.result };
    } catch (error) {
      this.handleError(error);
      return {};
    }
  }

  private async buildBundle(
    file: FileRef,
    callStack: string[]
  ): Promise<{ artifact: BuildArtifact | null; result: BuildResult }> {
    const normalizedPath = normalizePath(file.path);
    if (callStack.includes(normalizedPath)) {
      throw this.createCycleError([...callStack, normalizedPath]);
    }

    const frontmatter = this.context.parser.getFrontmatter(file) as BookerRecipeFrontmatter | null;
    if (!frontmatter) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    const typeInfo = this.context.parser.normalizeType(frontmatter.type);
    if (typeInfo.normalized !== "booker-bundle") {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated);

    const bundleConfig = this.context.parser.parseBundleConfig(frontmatter as BookerBundleFrontmatter, file);
    const bundleName = getBasename(file.path);
    if (!bundleConfig.aggregate?.outputPath) {
      throw new BookerError("BUNDLE_MISSING_AGGREGATE_OUTPUT", bundleName);
    }

    const stack = [...callStack, normalizedPath];
    const results: TargetResult[] = [];
    const successfulChunks: ContentChunk[] = [];
    const outputPaths: string[] = [];

    for (const target of bundleConfig.targets) {
      const targetResult = await this.buildBundleTarget(target, file, stack, bundleConfig.buildOptions);
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
    buildOptions: BookerBundleConfig["buildOptions"]
  ): Promise<{ result: TargetResult; artifact?: BuildArtifact }> {
    const resolved = this.resolveSourceFile(target, bundleFile.path);
    const targetName = getBasename(resolved.path);

    const sourceFrontmatter = this.context.parser.getFrontmatter(resolved) as BookerRecipeFrontmatter | null;
    if (!sourceFrontmatter) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    const typeInfo = this.context.parser.normalizeType(sourceFrontmatter.type);
    if (!typeInfo.normalized) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    this.warnIfDeprecated(resolved.path, sourceFrontmatter.type, typeInfo.deprecated);

    if (typeInfo.normalized === "booker-recipe") {
      const recipeConfig = this.context.parser.parseRecipeConfig(
        sourceFrontmatter as BookerRecipeFrontmatter,
        resolved
      );
      const compileResult = await this.context.compiler.compile(recipeConfig, resolved.path);
      const targetResult = this.createTargetResult(targetName, recipeConfig.outputPath, compileResult);
      return this.handleCompileResult(
        recipeConfig,
        compileResult,
        buildOptions,
        targetResult
      );
    }

    const bundleOutcome = await this.buildBundle(resolved, callStack);
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
    targetResult: TargetResult
  ): Promise<{ result: TargetResult; artifact?: BuildArtifact }> {
    if (compileResult.missingLinks.length > 0) {
      console.warn(`Booker: Missing files for ${config.outputPath}:`, compileResult.missingLinks);
    }

    if (compileResult.skippedSelfIncludes.length > 0) {
      console.warn(`Booker: Skipped self-inclusion for ${config.outputPath}:`, compileResult.skippedSelfIncludes);
      this.context.presenter.showWarning(
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

  private buildRecipe(file: FileRef, frontmatter: BookerRecipeFrontmatter): Promise<BuildArtifact | null> {
    const config = this.context.parser.parseRecipeConfig(frontmatter, file);
    return this.context.compiler.compile(config, file.path).then(async (result) => {
      if (result.skippedSelfIncludes.length > 0) {
        console.warn(`Booker: Skipped self-inclusion for ${file.path}:`, result.skippedSelfIncludes);
        this.context.presenter.showWarning(
          "I skipped one step to avoid a loop.\nA file tried to include its own output."
        );
      }

      if (result.missingLinks.length > 0) {
        console.warn(`Booker: Missing files for ${file.path}:`, result.missingLinks);
      }

      if (result.resolvedCount === 0) {
        return null;
      }

      await this.context.compiler.writeOutput(config.outputPath, result.content);
      return { artifactPath: config.outputPath, content: result.content };
    });
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

  private warnIfDeprecated(path: string, rawType: unknown, deprecated: boolean): void {
    if (!deprecated) {
      return;
    }
    const message = "This note uses a deprecated Booker type. Update to `type: booker-recipe` or `type: booker-bundle`.";
    this.context.presenter.showWarning(message);
    console.warn(`Booker: Deprecated type "${String(rawType)}" in ${path}.`);
  }

  private createCycleError(callStack: string[]): BookerError {
    const cycle = callStack.map((path) => getBasename(path)).join(" → ");
    return new BookerError("CYCLE_DETECTED", cycle);
  }

  private handleError(error: unknown): void {
    const { message, severity } = this.formatUserMessage(error);
    if (severity === "warning") {
      this.context.presenter.showWarning(message);
      return;
    }
    this.context.presenter.showError(message);
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
}
