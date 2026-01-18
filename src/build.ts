import { App, Notice, normalizePath } from "obsidian";
import { compileFromChunks, compileProject, ContentChunk, writeCompiledOutput } from "./compiler";
import { BuildfileConfig, BuildResult, TargetResult } from "./types";

function getBasename(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  const filename = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
  return filename.endsWith(".md") ? filename.slice(0, -3) : filename;
}

export async function buildFromBuildfile(
  app: App,
  buildfileConfig: BuildfileConfig,
  contextFilePath: string
): Promise<BuildResult> {
  const results: TargetResult[] = [];
  const successfulChunks: ContentChunk[] = [];
  const allOutputPaths = buildfileConfig.targets
    .map((target) => target.config?.outputPath)
    .filter((path): path is string => !!path)
    .map((path) => normalizePath(path));

  new Notice(`Booker: Building ${buildfileConfig.targets.length} target(s)…`);

  for (const targetPlan of buildfileConfig.targets) {
    if (!targetPlan.config) {
      const outputPath = "";
      const result: TargetResult = {
        name: targetPlan.name,
        outputPath,
        missingLinks: [],
        skippedSelfIncludes: [],
        success: false,
        resolvedCount: 0
      };
      results.push(result);
      console.warn(targetPlan.error ?? `Booker: Target "${targetPlan.name}" failed.`);
      new Notice(`Booker: ${targetPlan.name} failed.`);
      if (buildfileConfig.buildOptions.stop_on_error) {
        break;
      }
      continue;
    }

    const target = targetPlan.config;
    const compileResult = await compileProject(app, target, contextFilePath);

    if (compileResult.missingLinks.length > 0) {
      console.warn(`Booker: Target "${target.name}" missing files:`, compileResult.missingLinks);
    }

    if (compileResult.skippedSelfIncludes.length > 0) {
      console.warn(
        `Booker: Target "${target.name}" skipped self-inclusion:`,
        compileResult.skippedSelfIncludes
      );
    }

    let success = compileResult.resolvedCount > 0;
    if (compileResult.missingLinks.length > 0 && !buildfileConfig.buildOptions.continue_on_missing) {
      success = false;
    }

    if (success && !buildfileConfig.buildOptions.dry_run) {
      await writeCompiledOutput(app, target.outputPath, compileResult.content);
    }

    if (success) {
      successfulChunks.push({ content: compileResult.content, basename: getBasename(target.outputPath) });
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
      new Notice(`Booker: ${target.name} built.`);
    } else {
      new Notice(`Booker: ${target.name} failed.`);
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
      new Notice("Booker: No successful targets to aggregate.");
      console.warn("Booker: No successful targets to aggregate.");
    } else if (aggregateOutput && allOutputPaths.includes(normalizePath(aggregateOutput))) {
      new Notice("Booker: Aggregate output matches a target output. Aggregation failed.");
      console.warn("Booker: Aggregate output matches a target output.");
    } else {
      const aggregateContent = compileFromChunks(
        successfulChunks,
        buildfileConfig.aggregate.options,
        buildfileConfig.aggregate.title
      );
      if (!buildfileConfig.buildOptions.dry_run) {
        await writeCompiledOutput(app, buildfileConfig.aggregate.outputPath, aggregateContent);
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
    new Notice(
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
