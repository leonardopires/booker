import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  DEFAULT_BOOKER_OPTIONS,
  DEFAULT_BUILD_OPTIONS
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef, IMetadataCache } from "../ports/IAppContext";
import { getDirname, normalizePath } from "../utils/PathUtils";

type NormalizedType = "booker-recipe" | "booker-bundle";

/**
 * Parses Booker frontmatter into normalized configuration objects.
 */
export class FrontmatterParser {
  constructor(private readonly metadataCache: IMetadataCache) {}

  /**
   * Fetch cached frontmatter for a file when available.
   *
   * @param file - File reference to look up.
   * @returns Parsed frontmatter or null when missing.
   */
  getFrontmatter(file: FileRef): Record<string, unknown> | null {
    const cache = this.metadataCache.getFileCache(file);
    return (cache?.frontmatter ?? null) as Record<string, unknown> | null;
  }

  /**
   * Normalize Booker frontmatter types and mark deprecated aliases.
   */
  normalizeType(rawType: unknown): { normalized?: NormalizedType; deprecated: boolean } {
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

  /**
   * Parse a Booker recipe configuration from frontmatter.
   */
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

  /**
   * Parse a Booker bundle configuration from frontmatter.
   */
  parseBundleConfig(frontmatter: BookerBundleFrontmatter, file: FileRef): BookerBundleConfig {
    if (!frontmatter.targets || !Array.isArray(frontmatter.targets) || frontmatter.targets.length === 0) {
      throw new BookerError("MISSING_TARGETS", "MISSING_TARGETS");
    }

    const targets = this.parseBundleTargets(frontmatter.targets);

    return {
      targets,
      aggregate: this.normalizeAggregateConfig(frontmatter.aggregate, file),
      buildOptions: {
        ...DEFAULT_BUILD_OPTIONS,
        ...(frontmatter.build_options ?? {})
      }
    };
  }

  /**
   * Resolve bundle/recipe output paths relative to the active file.
   */
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

  /**
   * Normalize and filter a recipe order list.
   */
  normalizeOrder(order?: string[]): string[] {
    if (!order || !Array.isArray(order)) {
      return [];
    }
    return order.filter((item): item is string => typeof item === "string");
  }

  private normalizeAggregateConfig(
    aggregate: BookerBundleFrontmatter["aggregate"],
    file: FileRef
  ): AggregateConfig | undefined {
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

  private parseBundleTargets(targets: BookerBundleFrontmatter["targets"]): string[] {
    if (!targets) {
      return [];
    }

    const invalid = targets.some((target) => typeof target !== "string");
    if (invalid) {
      throw new BookerError("DEPRECATED_BUNDLE_SCHEMA", "DEPRECATED_BUNDLE_SCHEMA");
    }

    const normalized = targets
      .map((target) => target.trim())
      .filter((target) => target.length > 0);
    if (normalized.length === 0) {
      throw new BookerError("MISSING_TARGETS", "MISSING_TARGETS");
    }
    return normalized;
  }
}
