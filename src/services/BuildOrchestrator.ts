import { BookerBuildfileConfig, BuildResult, TargetResult } from "../domain/types";
import { INotice } from "../ports/IAppContext";
import { getBasename, normalizePath } from "../utils/PathUtils";
import { Compiler, ContentChunk } from "./Compiler";

export class BuildOrchestrator {
  constructor(
    private readonly compiler: Compiler,
    private readonly notice: INotice
  ) {}

  async runBuildfile(buildfileConfig: BookerBuildfileConfig, contextPath: string): Promise<BuildResult> {
    const results: TargetResult[] = [];
    const successfulChunks: ContentChunk[] = [];
    const allOutputPaths = buildfileConfig.targets
      .map((target) => target.config?.outputPath)
      .filter((path): path is string => !!path)
      .map((path) => normalizePath(path));

    this.notice.notify(`Booker: Building ${buildfileConfig.targets.length} target(s)…`);

    for (const targetPlan of buildfileConfig.targets) {
      if (!targetPlan.config) {
        const result: TargetResult = {
          name: targetPlan.name,
          outputPath: "",
          missingLinks: [],
          skippedSelfIncludes: [],
          success: false,
          resolvedCount: 0
        };
        results.push(result);
        console.warn(targetPlan.error ?? `Booker: Target "${targetPlan.name}" failed.`);
        this.notice.notify(`Booker: ${targetPlan.name} failed.`);
        if (buildfileConfig.buildOptions.stop_on_error) {
          break;
        }
        continue;
      }

      const target = targetPlan.config;
      const compileResult = await this.compiler.compile(target, contextPath);

      if (compileResult.missingLinks.length > 0) {
        console.warn(`Booker: Target "${target.name}" missing files:`, compileResult.missingLinks);
      }

      if (compileResult.skippedSelfIncludes.length > 0) {
        console.warn(`Booker: Target "${target.name}" skipped self-inclusion:`, compileResult.skippedSelfIncludes);
      }

      let success = compileResult.resolvedCount > 0;
      if (compileResult.missingLinks.length > 0 && !buildfileConfig.buildOptions.continue_on_missing) {
        success = false;
      }

      if (success && !buildfileConfig.buildOptions.dry_run) {
        await this.compiler.writeOutput(target.outputPath, compileResult.content);
      }

      if (success) {
        successfulChunks.push({
          content: compileResult.content,
          basename: getBasename(target.outputPath)
        });
      }

      const targetResult: TargetResult = {
        name: target.name,
        outputPath: target.outputPath,
        missingLinks: compileResult.missingLinks,
        skippedSelfIncludes: compileResult.skippedSelfIncludes,
        success,
        resolvedCount: compileResult.resolvedCount
      };

      results.push(targetResult);

      if (success) {
        this.notice.notify(`Booker: ${target.name} built.`);
      } else {
        this.notice.notify(`Booker: ${target.name} failed.`);
      }

      if (!success && buildfileConfig.buildOptions.stop_on_error) {
        break;
      }
    }

    let aggregateAttempted = false;
    let aggregateSuccess = false;
    const aggregateOutput = buildfileConfig.aggregate?.outputPath;

    if (buildfileConfig.aggregate) {
      aggregateAttempted = true;
      if (successfulChunks.length === 0) {
        this.notice.notify("Booker: No successful targets to aggregate.");
        console.warn("Booker: No successful targets to aggregate.");
      } else if (aggregateOutput && allOutputPaths.includes(normalizePath(aggregateOutput))) {
        this.notice.notify("Booker: Aggregate output matches a target output. Aggregation failed.");
        console.warn("Booker: Aggregate output matches a target output.");
      } else {
        const aggregateContent = this.compiler.compileFromChunks(successfulChunks, {
          title: buildfileConfig.aggregate.title,
          outputPath: aggregateOutput ?? "",
          order: [],
          options: buildfileConfig.aggregate.options
        });
        if (!buildfileConfig.buildOptions.dry_run && aggregateOutput) {
          await this.compiler.writeOutput(aggregateOutput, aggregateContent);
        }
        aggregateSuccess = true;
      }
    }

    const successes = results.filter((result) => result.success).length;
    const failures = results.filter((result) => !result.success).length;
    const missingTotal = results.reduce((total, result) => total + result.missingLinks.length, 0);

    if (buildfileConfig.buildOptions.summary_notice) {
      const aggregateSummary = buildfileConfig.aggregate
        ? aggregateSuccess
          ? "Aggregate: succeeded."
          : aggregateAttempted
            ? "Aggregate: failed/skipped."
            : "Aggregate: skipped."
        : "Aggregate: none.";
      this.notice.notify(
        `Booker: Build finished. ${successes} succeeded, ${failures} failed, ${missingTotal} missing. ${aggregateSummary}`
      );
    }

    return {
      targets: results,
      successes,
      failures,
      missingTotal,
      aggregate: {
        attempted: aggregateAttempted,
        success: aggregateSuccess,
        outputPath: aggregateOutput
      }
    };
  }
}
