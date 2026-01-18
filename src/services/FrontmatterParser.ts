import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  BundleTargetFrontmatter,
  BundleTargetInlinePlan,
  BundleTargetPlan,
  BundleTargetSourcePlan,
  DEFAULT_BOOKER_OPTIONS,
  DEFAULT_BUILD_OPTIONS,
  TargetMode
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

  getFrontmatter(file: FileRef): Record<string, unknown> | null {
    const cache = this.metadataCache.getFileCache(file);
    return (cache?.frontmatter ?? null) as Record<string, unknown> | null;
  }

  normalizeType(rawType: unknown): { normalized?: "booker-recipe" | "booker-bundle"; deprecated: boolean } {
    if (typeof rawType !== "string") {
      return { deprecated: false };
    }
    if (rawType === "booker-recipe") {
      return { normalized: "booker-recipe", deprecated: false };
    }
    if (rawType === "booker-bundle") {
      return { normalized: "booker-bundle", deprecated: false };
    }
    if (rawType === "booker") {
      return { normalized: "booker-recipe", deprecated: true };
    }
    if (rawType === "booker-build") {
      return { normalized: "booker-bundle", deprecated: true };
    }
    return { deprecated: false };
  }

  parseRecipeConfig(frontmatter: BookerRecipeFrontmatter, file: FileRef): BookerRecipeConfig {
    if (!frontmatter.output) {
      throw new BookerError("MISSING_OUTPUT", "MISSING_OUTPUT");
    }

    if (!frontmatter.order || !Array.isArray(frontmatter.order) || frontmatter.order.length === 0) {
      throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
    }

    const order = this.normalizeOrder(frontmatter.order);
    if (order.length === 0) {
      throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
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

  parseBundleConfig(frontmatter: BookerBundleFrontmatter, file: FileRef): BookerBundleConfig {
    if (!frontmatter.targets || !Array.isArray(frontmatter.targets) || frontmatter.targets.length === 0) {
      throw new BookerError("MISSING_TARGETS", "MISSING_TARGETS");
    }

    const targets = frontmatter.targets.map((target, index) => this.parseTarget(file, target, index));

    return {
      targets,
      aggregate: this.normalizeAggregateConfig(frontmatter.aggregate, file),
      buildOptions: {
        ...DEFAULT_BUILD_OPTIONS,
        ...(frontmatter.build_options ?? {})
      }
    };
  }

  resolveOutputPath(output: string, activePath: string): string {
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

  normalizeOrder(order?: string[]): string[] {
    if (!order || !Array.isArray(order)) {
      return [];
    }
    return order.filter((item): item is string => typeof item === "string");
  }

  private normalizeAggregateConfig(aggregate: BookerBundleFrontmatter["aggregate"], file: FileRef):
    | AggregateConfig
    | undefined {
    if (!aggregate) {
      return undefined;
    }

    if (!aggregate.output) {
      throw new BookerError("MISSING_AGGREGATE_OUTPUT", "MISSING_AGGREGATE_OUTPUT");
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

  private parseTarget(file: FileRef, target: BundleTargetFrontmatter, index: number): BundleTargetPlan {
    if (!target || typeof target !== "object") {
      throw new BookerError("MISSING_TARGET_DEFINITION", "MISSING_TARGET_DEFINITION");
    }

    const name = target.name?.trim() || `Target ${index + 1}`;
    const source = target.source ?? target.project;
    const mode = target.mode ?? "auto";

    if (source) {
      const plan: BundleTargetSourcePlan = {
        name,
        source,
        mode: this.normalizeMode(mode),
        overrides: target.overrides,
        title: target.title
      };
      return plan;
    }

    if (target.output) {
      if (!target.order || !Array.isArray(target.order) || target.order.length === 0) {
        throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
      }

      const order = this.normalizeOrder(target.order);
      if (order.length === 0) {
        throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
      }

      const inlineConfig: BookerRecipeConfig = {
        title: target.title,
        outputPath: this.resolveOutputPath(target.output, file.path),
        order,
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          ...(target.options ?? {})
        }
      };

      const inlinePlan: BundleTargetInlinePlan = {
        name,
        inlineConfig
      };
      return inlinePlan;
    }

    if (target.order) {
      throw new BookerError("MISSING_OUTPUT", "MISSING_OUTPUT");
    }

    throw new BookerError("MISSING_TARGET_DEFINITION", "MISSING_TARGET_DEFINITION");
  }

  private normalizeMode(mode: string): TargetMode {
    if (mode === "recipe" || mode === "bundle" || mode === "auto") {
      return mode;
    }
    return "auto";
  }
}
