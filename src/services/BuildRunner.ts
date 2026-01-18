import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  BundleTargetInlinePlan,
  BundleTargetPlan,
  BundleTargetSourcePlan,
  BuildResult,
  CompileResult,
  TargetMode,
  TargetResult
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { Compiler, ContentChunk } from "./Compiler";
import { FrontmatterParser } from "./FrontmatterParser";
import { LinkResolver } from "./LinkResolver";
import { UserMessagePresenter } from "./UserMessagePresenter";

type BuildArtifact = {
  artifactPath: string;
  content: string;
};

type BuildOutcome = {
  artifactPath?: string;
  result?: BuildResult;
};

export class BuildRunner {
  constructor(
    private readonly compiler: Compiler,
    private readonly parser: FrontmatterParser,
    private readonly linkResolver: LinkResolver,
    private readonly presenter: UserMessagePresenter
  ) {}

  async buildCurrentFile(file: FileRef, callStack: string[] = []): Promise<BuildOutcome> {
    const frontmatter = this.parser.getFrontmatter(file) as BookerRecipeFrontmatter | null;
    if (!frontmatter) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"));
      return {};
    }

    const typeInfo = this.parser.normalizeType(frontmatter.type);
    if (!typeInfo.normalized) {
      this.handleError(new BookerError("INVALID_TYPE", "INVALID_TYPE"));
      return {};
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated);

    try {
      if (typeInfo.normalized === "booker-recipe") {
        const artifact = await this.buildRecipe(file, frontmatter, undefined);
        if (artifact) {
          this.presenter.showSuccess("Generation completed successfully.");
          return { artifactPath: artifact.artifactPath };
        }
        return {};
      }

      const bundleOutcome = await this.buildBundle(file, callStack);
      if (bundleOutcome.artifact) {
        this.presenter.showSuccess("Generation completed successfully.");
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

    const frontmatter = this.parser.getFrontmatter(file) as BookerRecipeFrontmatter | null;
    if (!frontmatter) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    const typeInfo = this.parser.normalizeType(frontmatter.type);
    if (typeInfo.normalized !== "booker-bundle") {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    this.warnIfDeprecated(file.path, frontmatter.type, typeInfo.deprecated);

    const bundleConfig = this.parser.parseBundleConfig(frontmatter as BookerBundleFrontmatter, file);
    const bundleName = getBasename(file.path);
    if (!bundleConfig.aggregate?.outputPath) {
      throw new BookerError("BUNDLE_MISSING_AGGREGATE_OUTPUT", bundleName);
    }

    const stack = [...callStack, normalizedPath];
    const results: TargetResult[] = [];
    const successfulChunks: ContentChunk[] = [];
    const outputPaths: string[] = [];

    for (const targetPlan of bundleConfig.targets) {
      const targetResult = await this.buildBundleTarget(targetPlan, file, stack, bundleConfig.buildOptions);
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
    targetPlan: BundleTargetPlan,
    bundleFile: FileRef,
    callStack: string[],
    buildOptions: BookerBundleConfig["buildOptions"]
  ): Promise<{ result: TargetResult; artifact?: BuildArtifact }> {
    if (this.isInlineTarget(targetPlan)) {
      const compileResult = await this.compiler.compile(targetPlan.inlineConfig, bundleFile.path);
      const targetResult = this.createTargetResult(targetPlan.name, targetPlan.inlineConfig.outputPath, compileResult);

      return this.handleCompileResult(
        targetPlan.inlineConfig,
        compileResult,
        buildOptions,
        targetResult
      );
    }

    const resolved = this.resolveSourceFile(targetPlan.source, bundleFile.path);
    const mode = targetPlan.mode;
    const targetName = targetPlan.name;

    const sourceFrontmatter = this.parser.getFrontmatter(resolved) as BookerRecipeFrontmatter | null;
    if (!sourceFrontmatter) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    const typeInfo = this.parser.normalizeType(sourceFrontmatter.type);
    if (!typeInfo.normalized) {
      throw new BookerError("INVALID_TYPE", "INVALID_TYPE");
    }

    this.warnIfDeprecated(resolved.path, sourceFrontmatter.type, typeInfo.deprecated);

    const resolvedType = this.resolveTargetMode(mode, typeInfo.normalized);
    if (resolvedType === "booker-recipe") {
      const recipeConfig = this.applyOverrides(
        this.parser.parseRecipeConfig(sourceFrontmatter as BookerRecipeFrontmatter, resolved),
        targetPlan,
        bundleFile
      );
      const compileResult = await this.compiler.compile(recipeConfig, resolved.path);
      const targetResult = this.createTargetResult(targetName, recipeConfig.outputPath, compileResult);
      return this.handleCompileResult(recipeConfig, compileResult, buildOptions, targetResult);
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
      this.presenter.showWarning(
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
      await this.compiler.writeOutput(config.outputPath, compileResult.content);
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

    const aggregateContent = this.compiler.compileFromChunks(successfulChunks, {
      title: aggregate.title,
      outputPath: aggregate.outputPath,
      order: [],
      options: aggregate.options
    });

    if (!bundleConfig.buildOptions.dry_run) {
      await this.compiler.writeOutput(aggregate.outputPath, aggregateContent);
    }

    return { outputPath: aggregate.outputPath, content: aggregateContent };
  }

  private buildRecipe(file: FileRef, frontmatter: BookerRecipeFrontmatter, mode?: TargetMode): Promise<BuildArtifact | null> {
    if (mode === "bundle") {
      throw new BookerError("MODE_MISMATCH", "MODE_MISMATCH");
    }
    const config = this.parser.parseRecipeConfig(frontmatter, file);
    return this.compiler.compile(config, file.path).then(async (result) => {
      if (result.skippedSelfIncludes.length > 0) {
        console.warn(`Booker: Skipped self-inclusion for ${file.path}:`, result.skippedSelfIncludes);
        this.presenter.showWarning(
          "I skipped one step to avoid a loop.\nA file tried to include its own output."
        );
      }

      if (result.missingLinks.length > 0) {
        console.warn(`Booker: Missing files for ${file.path}:`, result.missingLinks);
      }

      if (result.resolvedCount === 0) {
        return null;
      }

      await this.compiler.writeOutput(config.outputPath, result.content);
      return { artifactPath: config.outputPath, content: result.content };
    });
  }

  private resolveSourceFile(source: string, fromPath: string): FileRef {
    const linkpath = this.linkResolver.normalizeLinkString(source);
    const resolved = this.linkResolver.resolveToFile(linkpath, fromPath);
    if (!resolved) {
      throw new BookerError("SOURCE_NOT_FOUND", linkpath);
    }
    return resolved;
  }

  private resolveTargetMode(mode: TargetMode, normalizedType: "booker-recipe" | "booker-bundle"): "booker-recipe" | "booker-bundle" {
    if (mode === "auto") {
      return normalizedType;
    }
    if (mode === "recipe") {
      if (normalizedType === "booker-bundle") {
        throw new BookerError("MODE_MISMATCH", "recipe");
      }
      return "booker-recipe";
    }
    if (mode === "bundle") {
      if (normalizedType === "booker-recipe") {
        throw new BookerError("MODE_MISMATCH", "bundle");
      }
      return "booker-bundle";
    }
    return normalizedType;
  }

  private applyOverrides(
    config: BookerRecipeConfig,
    targetPlan: BundleTargetSourcePlan,
    bundleFile: FileRef
  ): BookerRecipeConfig {
    const overrides = targetPlan.overrides ?? {};
    const orderOverride = overrides.order ? this.parser.normalizeOrder(overrides.order) : undefined;
    if (overrides.order && (!orderOverride || orderOverride.length === 0)) {
      throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
    }

    const outputOverride = overrides.output;
    const outputPath = outputOverride
      ? this.parser.resolveOutputPath(outputOverride, bundleFile.path)
      : config.outputPath;

    return {
      ...config,
      title: overrides.title ?? targetPlan.title ?? config.title,
      outputPath,
      order: orderOverride ?? config.order,
      options: {
        ...config.options,
        ...(overrides.options ?? {})
      }
    };
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

  private isInlineTarget(target: BundleTargetPlan): target is BundleTargetInlinePlan {
    return (target as BundleTargetInlinePlan).inlineConfig !== undefined;
  }

  private warnIfDeprecated(path: string, rawType: unknown, deprecated: boolean): void {
    if (!deprecated) {
      return;
    }
    const message = "This note uses a deprecated Booker type. Update to `type: booker-recipe` or `type: booker-bundle`.";
    this.presenter.showWarning(message);
    console.warn(`Booker: Deprecated type "${String(rawType)}" in ${path}.`);
  }

  private createCycleError(callStack: string[]): BookerError {
    const cycle = callStack.map((path) => getBasename(path)).join(" → ");
    return new BookerError("CYCLE_DETECTED", cycle);
  }

  private handleError(error: unknown): void {
    const { message, severity } = this.formatUserMessage(error);
    if (severity === "warning") {
      this.presenter.showWarning(message);
      return;
    }
    this.presenter.showError(message);
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
        case "MISSING_TARGET_DEFINITION":
          return {
            message:
              "One step in this bundle is incomplete.\nEach target needs either `source:` or an inline `output` + `order`.",
            severity: "error"
          };
        case "SOURCE_NOT_FOUND":
          return {
            message: `I couldn’t find the note ‘${error.message}’.\nCheck the name or create the note.`,
            severity: "error"
          };
        case "MODE_MISMATCH":
          if (error.message === "bundle") {
            return {
              message: "This step is set to bundle, but the source is a recipe.\nChange `mode` or remove it.",
              severity: "error"
            };
          }
          return {
            message: "This step is set to recipe, but the source is a bundle.\nChange `mode` or remove it.",
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
