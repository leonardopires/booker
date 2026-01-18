import {
  BookerBuildfileConfig,
  BookerBuildfileFrontmatter,
  BookerProjectConfig,
  BookerProjectFrontmatter,
  BuildTargetConfig,
  BuildTargetFrontmatter,
  BuildTargetPlan,
  DEFAULT_BOOKER_OPTIONS,
  DEFAULT_BUILD_OPTIONS,
  AggregateConfig
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef, IMetadataCache } from "../ports/IAppContext";
import { LinkResolver } from "./LinkResolver";
import { getDirname, normalizePath } from "../utils/PathUtils";

export class FrontmatterParser {
  constructor(
    private readonly metadataCache: IMetadataCache,
    private readonly linkResolver: LinkResolver
  ) {}

  parseBookerProject(file: FileRef): BookerProjectConfig {
    const frontmatter = this.getFrontmatter(file) as BookerProjectFrontmatter | null;
    if (!frontmatter || frontmatter.type !== "booker") {
      throw new BookerError("INVALID_FRONTMATTER", "Booker: Active file is missing frontmatter type: booker.");
    }
    return this.normalizeProjectConfig(frontmatter, file);
  }

  parseBuildfile(file: FileRef): BookerBuildfileConfig {
    const frontmatter = this.getFrontmatter(file) as BookerBuildfileFrontmatter | null;
    if (!frontmatter || frontmatter.type !== "booker-build") {
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
      return this.parseTarget(file, target, index);
    });

    if (targets.length === 0) {
      throw new BookerError("MISSING_TARGETS", "Booker: No valid targets found in buildfile.");
    }

    return {
      targets,
      aggregate: this.normalizeAggregateConfig(frontmatter.aggregate, file),
      buildOptions: {
        ...DEFAULT_BUILD_OPTIONS,
        ...(frontmatter.build_options ?? {})
      }
    };
  }

  private getFrontmatter(file: FileRef): Record<string, unknown> | null {
    const cache = this.metadataCache.getFileCache(file);
    return (cache?.frontmatter ?? null) as Record<string, unknown> | null;
  }

  private normalizeProjectConfig(frontmatter: BookerProjectFrontmatter, file: FileRef): BookerProjectConfig {
    if (!frontmatter.output) {
      throw new BookerError("MISSING_OUTPUT", "Booker: Missing required frontmatter key: output.");
    }

    if (!frontmatter.order || !Array.isArray(frontmatter.order) || frontmatter.order.length === 0) {
      throw new BookerError("MISSING_ORDER", "Booker: Missing required frontmatter key: order.");
    }

    const order = this.normalizeOrder(frontmatter.order);
    if (order.length === 0) {
      throw new BookerError("MISSING_ORDER", "Booker: Missing valid order entries.");
    }

    return {
      title: frontmatter.title,
      outputPath: this.resolveOutputPath(frontmatter.output, file.path),
      order,
      options: {
        ...DEFAULT_BOOKER_OPTIONS,
        ...(frontmatter.options ?? {})
      }
    };
  }

  private normalizeAggregateConfig(aggregate: BookerBuildfileFrontmatter["aggregate"], file: FileRef):
    | AggregateConfig
    | undefined {
    if (!aggregate) {
      return undefined;
    }

    if (!aggregate.output) {
      throw new BookerError("MISSING_AGGREGATE_OUTPUT", "Booker: Aggregate requires output.");
    }

    return {
      title: aggregate.title,
      outputPath: this.resolveOutputPath(aggregate.output, file.path),
      options: {
        ...DEFAULT_BOOKER_OPTIONS,
        ...(aggregate.options ?? {})
      }
    };
  }

  private normalizeOrder(order?: string[]): string[] {
    if (!order || !Array.isArray(order)) {
      return [];
    }
    return order.filter((item): item is string => typeof item === "string");
  }

  private resolveOutputPath(output: string, activePath: string): string {
    const trimmed = output.trim();
    if (trimmed.startsWith("~")) {
      const rootPath = trimmed.slice(1);
      const normalizedRoot = rootPath.startsWith("/") ? rootPath.slice(1) : rootPath;
      return normalizePath(normalizedRoot);
    }

    const dir = getDirname(activePath);
    if (!dir) {
      return normalizePath(trimmed);
    }
    return normalizePath(`${dir}/${trimmed}`);
  }

  private parseTarget(file: FileRef, target: BuildTargetFrontmatter, index: number): BuildTargetPlan {
    const name = target.name?.trim() || `Target ${index + 1}`;

    if ("project" in target && target.project) {
      const linkpath = this.linkResolver.normalizeLinkString(target.project);
      const resolved = this.linkResolver.resolveToFile(linkpath, file.path);
      if (!resolved) {
        return {
          name,
          error: `Booker: Target "${name}" project not found: ${linkpath}`
        };
      }

      try {
        const projectConfig = this.parseBookerProject(resolved);

        const overrides = target.overrides ?? {};
        const orderOverride = overrides.order ? this.normalizeOrder(overrides.order) : undefined;
        if (overrides.order && (!orderOverride || orderOverride.length === 0)) {
          return { name, error: `Booker: Target "${name}" overrides missing valid order entries.` };
        }

        const outputOverride = overrides.output ?? target.output;
        const outputPath = outputOverride
          ? this.resolveOutputPath(outputOverride, file.path)
          : projectConfig.outputPath;

        const config: BuildTargetConfig = {
          name,
          title: overrides.title ?? target.title ?? projectConfig.title,
          outputPath,
          order: orderOverride ?? projectConfig.order,
          options: {
            ...projectConfig.options,
            ...(target.options ?? {}),
            ...(overrides.options ?? {})
          }
        };
        return { name, config };
      } catch (error) {
        const message = error instanceof BookerError ? error.message : "Booker: Invalid project target.";
        return { name, error: message };
      }
    }

    if ("output" in target && "order" in target && target.output && target.order) {
      const order = this.normalizeOrder(target.order);
      if (order.length === 0) {
        return { name, error: `Booker: Target "${name}" missing valid order entries.` };
      }

      return {
        name,
        config: {
          name,
          title: target.title,
          outputPath: this.resolveOutputPath(target.output, file.path),
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
}
