import { App, TFile, normalizePath } from "obsidian";
import {
  BookerBuildfileFrontmatter,
  BookerProjectConfig,
  BookerProjectFrontmatter,
  BuildAggregateConfig,
  BuildAggregateFrontmatter,
  BuildTargetConfig,
  BuildTargetFrontmatter,
  BuildTargetPlan,
  BuildfileConfig,
  DEFAULT_BOOKER_OPTIONS,
  DEFAULT_BUILD_OPTIONS
} from "./types";
import { BookerError } from "./errors";
import { normalizeLinkString, resolveLinkToFile } from "./links";

function resolveOutputPath(output: string, activeFile: TFile): string {
  const trimmed = output.trim();
  if (trimmed.startsWith("~")) {
    const rootPath = trimmed.slice(1);
    const normalizedRoot = rootPath.startsWith("/") ? rootPath.slice(1) : rootPath;
    return normalizePath(normalizedRoot);
  }

  const lastSlash = activeFile.path.lastIndexOf("/");
  const currentDir = lastSlash === -1 ? "" : activeFile.path.slice(0, lastSlash);
  if (!currentDir) {
    return normalizePath(trimmed);
  }
  return normalizePath(`${currentDir}/${trimmed}`);
}

function getFrontmatter(app: App, file: TFile): Record<string, unknown> | null {
  const cache = app.metadataCache.getFileCache(file);
  return (cache?.frontmatter ?? null) as Record<string, unknown> | null;
}

function isBookerProject(frontmatter: BookerProjectFrontmatter | null): frontmatter is BookerProjectFrontmatter {
  return !!frontmatter && frontmatter.type === "booker";
}

function isBuildfile(frontmatter: BookerBuildfileFrontmatter | null): frontmatter is BookerBuildfileFrontmatter {
  return !!frontmatter && frontmatter.type === "booker-build";
}

function normalizeProjectConfig(frontmatter: BookerProjectFrontmatter, file: TFile): BookerProjectConfig {
  if (!frontmatter.output) {
    throw new BookerError("MISSING_OUTPUT", "Booker: Missing required frontmatter key: output.");
  }

  if (!frontmatter.order || !Array.isArray(frontmatter.order) || frontmatter.order.length === 0) {
    throw new BookerError("MISSING_ORDER", "Booker: Missing required frontmatter key: order.");
  }

  const order = frontmatter.order.filter((item): item is string => typeof item === "string");
  if (order.length === 0) {
    throw new BookerError("MISSING_ORDER", "Booker: Missing valid order entries.");
  }

  return {
    title: frontmatter.title,
    outputPath: resolveOutputPath(frontmatter.output, file),
    order,
    options: {
      ...DEFAULT_BOOKER_OPTIONS,
      ...(frontmatter.options ?? {})
    }
  };
}

function normalizeAggregateConfig(
  aggregate: BuildAggregateFrontmatter | undefined,
  file: TFile
): BuildAggregateConfig | undefined {
  if (!aggregate) {
    return undefined;
  }
  if (!aggregate.output) {
    throw new BookerError("MISSING_AGGREGATE_OUTPUT", "Booker: Aggregate requires output.");
  }
  return {
    title: aggregate.title,
    outputPath: resolveOutputPath(aggregate.output, file),
    options: {
      ...DEFAULT_BOOKER_OPTIONS,
      ...(aggregate.options ?? {})
    }
  };
}

export function parseBookerProject(app: App, file: TFile): BookerProjectConfig {
  const frontmatter = getFrontmatter(app, file) as BookerProjectFrontmatter | null;
  if (!isBookerProject(frontmatter)) {
    throw new BookerError("INVALID_FRONTMATTER", "Booker: Active file is missing frontmatter type: booker.");
  }

  return normalizeProjectConfig(frontmatter, file);
}

function parseTarget(
  app: App,
  file: TFile,
  target: BuildTargetFrontmatter,
  index: number
): BuildTargetPlan {
  const name = target.name?.trim() || `Target ${index + 1}`;

  if ("project" in target && target.project) {
    const linkpath = normalizeLinkString(target.project);
    const resolved = resolveLinkToFile(app, linkpath, file.path);
    if (!resolved) {
      return {
        name,
        error: `Booker: Target "${name}" project not found: ${linkpath}`
      };
    }

    try {
      const projectConfig = parseBookerProject(app, resolved);
      const config: BuildTargetConfig = {
        name,
        title: target.title ?? projectConfig.title,
        outputPath: target.output ? resolveOutputPath(target.output, file) : projectConfig.outputPath,
        order: projectConfig.order,
        options: {
          ...projectConfig.options,
          ...(target.options ?? {})
        }
      };
      return { name, config };
    } catch (error) {
      const message = error instanceof BookerError ? error.message : "Booker: Invalid project target.";
      return { name, error: message };
    }
  }

  if ("output" in target && "order" in target && target.output && target.order) {
    const order = target.order.filter((item): item is string => typeof item === "string");
    if (order.length === 0) {
      return {
        name,
        error: `Booker: Target "${name}" missing valid order entries.`
      };
    }
    return {
      name,
      config: {
        name,
        title: target.title,
        outputPath: resolveOutputPath(target.output, file),
        order,
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          ...(target.options ?? {})
        }
      }
    };
  }

  return {
    name,
    error: `Booker: Target "${name}" is missing required fields.`
  };
}

export function parseBuildfile(app: App, file: TFile): BuildfileConfig {
  const frontmatter = getFrontmatter(app, file) as BookerBuildfileFrontmatter | null;
  if (!isBuildfile(frontmatter)) {
    throw new BookerError(
      "INVALID_FRONTMATTER",
      "Booker: Active file is missing frontmatter type: booker-build."
    );
  }

  if (!frontmatter.targets || !Array.isArray(frontmatter.targets) || frontmatter.targets.length === 0) {
    throw new BookerError("MISSING_TARGETS", "Booker: Missing required frontmatter key: targets.");
  }

  const targets: BuildTargetPlan[] = frontmatter.targets.map((target, index) => {
    if (!target || typeof target !== "object") {
      return {
        name: `Target ${index + 1}`,
        error: "Booker: Target is invalid."
      };
    }
    return parseTarget(app, file, target, index);
  });

  if (targets.length === 0) {
    throw new BookerError("MISSING_TARGETS", "Booker: No valid targets found in buildfile.");
  }

  const aggregateConfig = normalizeAggregateConfig(frontmatter.aggregate, file);

  return {
    targets,
    aggregate: aggregateConfig,
    buildOptions: {
      ...DEFAULT_BUILD_OPTIONS,
      ...(frontmatter.build_options ?? {})
    }
  };
}
