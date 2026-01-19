import {
  AggregateConfig,
  BookerBundleConfig,
  BookerBundleFrontmatter,
  BookerOptions,
  BookerRecipeConfig,
  BookerRecipeFrontmatter,
  BuildOptions,
  DEFAULT_BOOKER_OPTIONS,
  DEFAULT_BUILD_OPTIONS
} from "../domain/types";
import { BookerError } from "../domain/errors";
import { FileRef, IMetadataCache } from "../ports/IAppContext";
import { getDirname, normalizePath } from "../utils/PathUtils";

type NormalizedType = "booker-recipe" | "booker-bundle";

const OPTION_KEYS = [
  "strip_frontmatter",
  "strip_h1",
  "strip_title",
  "separator",
  "heading_offset",
  "toc",
  "toc_title",
  "toc_scope",
  "toc_depth",
  "toc_include_h1"
] as const;

type OptionKey = (typeof OPTION_KEYS)[number];

/**
 * Best-effort frontmatter location metadata for deprecation warnings.
 */
export type FrontmatterLocation = {
  line: number;
  column: number | null;
};

/**
 * Deprecated schema metadata surfaced to build warnings.
 */
export type FrontmatterDeprecation = {
  category: string;
  keys: string[];
  location?: FrontmatterLocation;
  hint: string;
};

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
   * Parse a Booker recipe configuration from frontmatter, including legacy schemas.
   */
  parseRecipeConfig(frontmatter: BookerRecipeFrontmatter, file: FileRef): BookerRecipeConfig {
    const output = this.readString(frontmatter.output);
    if (!output) {
      throw new BookerError("MISSING_OUTPUT", "MISSING_OUTPUT");
    }

    const order = this.normalizeOrder(frontmatter.order);
    if (order.length === 0) {
      throw new BookerError("MISSING_ORDER", "MISSING_ORDER");
    }

    const options = this.resolveRecipeOptions(frontmatter);

    return {
      title: frontmatter.title,
      outputPath: this.resolveOutputPath(output, file.path),
      order,
      options: {
        ...DEFAULT_BOOKER_OPTIONS,
        ...options
      }
    };
  }

  /**
   * Parse a Booker bundle configuration from frontmatter, including legacy schemas.
   */
  parseBundleConfig(frontmatter: BookerBundleFrontmatter, file: FileRef): BookerBundleConfig {
    if (!Array.isArray(frontmatter.targets) || frontmatter.targets.length === 0) {
      throw new BookerError("MISSING_TARGETS", "MISSING_TARGETS");
    }

    const targets = this.parseBundleTargets(frontmatter.targets);
    const aggregate = this.normalizeAggregateConfig(frontmatter, file);
    const buildOptions = this.resolveBuildOptions(frontmatter);

    return {
      targets,
      aggregate,
      buildOptions: {
        ...DEFAULT_BUILD_OPTIONS,
        ...buildOptions
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
  normalizeOrder(order?: unknown): string[] {
    if (!Array.isArray(order)) {
      return [];
    }
    return order.filter((item): item is string => typeof item === "string");
  }

  private normalizeAggregateConfig(
    frontmatter: BookerBundleFrontmatter,
    file: FileRef
  ): AggregateConfig | undefined {
    const hasAggregateBlock = !!frontmatter.aggregate;
    const hasAggregateFields =
      typeof frontmatter.aggregate_output === "string" ||
      typeof frontmatter.aggregate_title === "string" ||
      this.hasAggregateOptionOverrides(frontmatter);
    const output =
      this.readString(frontmatter.aggregate_output) ?? this.readString(frontmatter.aggregate?.output);
    if (!output) {
      if (hasAggregateBlock || hasAggregateFields) {
        throw new BookerError("MISSING_AGGREGATE_OUTPUT", "MISSING_AGGREGATE_OUTPUT");
      }
      return undefined;
    }

    const title =
      this.readString(frontmatter.aggregate_title) ?? this.readString(frontmatter.aggregate?.title);
    const prefixedOptions = this.readAggregatePrefixedOptions(frontmatter);
    const nestedOptions = this.readOptionsFromObject(frontmatter.aggregate?.options);
    const unprefixedOptions = this.readOptionsFromObject(frontmatter);
    const resolvedOptions = this.resolveOptionSources(prefixedOptions, nestedOptions, unprefixedOptions);

    return {
      title,
      outputPath: this.resolveOutputPath(output, file.path),
      options: {
        ...DEFAULT_BOOKER_OPTIONS,
        ...resolvedOptions
      }
    };
  }

  private parseBundleTargets(targets: BookerBundleFrontmatter["targets"]): string[] {
    if (!Array.isArray(targets)) {
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

  /**
   * Return deprecation warnings for legacy Booker frontmatter structures.
   */
  getDeprecationWarnings(
    frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter,
    type: NormalizedType,
    rawFrontmatter?: string
  ): FrontmatterDeprecation[] {
    const warnings: FrontmatterDeprecation[] = [];
    if (type === "booker-recipe") {
      const recipeWarnings = this.getRecipeDeprecations(frontmatter as BookerRecipeFrontmatter, rawFrontmatter);
      warnings.push(...recipeWarnings);
    } else {
      const bundleWarnings = this.getBundleDeprecations(frontmatter as BookerBundleFrontmatter, rawFrontmatter);
      warnings.push(...bundleWarnings);
    }
    return warnings;
  }

  private getRecipeDeprecations(
    frontmatter: BookerRecipeFrontmatter,
    rawFrontmatter?: string
  ): FrontmatterDeprecation[] {
    const warnings: FrontmatterDeprecation[] = [];
    if (frontmatter.options && typeof frontmatter.options === "object") {
      const optionKeys = this.collectOptionKeys(frontmatter.options);
      const keyed = optionKeys.length > 0 ? optionKeys.map((key) => `options.${key}`) : ["options"];
      const hint =
        optionKeys.length > 0
          ? this.formatOptionHint("recipe", keyed)
          : "Move nested `options` values to `recipe_*` keys.";
      warnings.push(this.createDeprecation(
        "Deprecated recipe schema",
        keyed,
        ["options"],
        rawFrontmatter,
        hint
      ));
    }

    const unprefixedKeys = this.collectOptionKeys(frontmatter);
    if (unprefixedKeys.length > 0) {
      warnings.push(this.createDeprecation(
        "Deprecated unprefixed keys",
        unprefixedKeys,
        unprefixedKeys,
        rawFrontmatter,
        this.formatOptionHint("recipe", unprefixedKeys)
      ));
    }

    return warnings;
  }

  private getBundleDeprecations(
    frontmatter: BookerBundleFrontmatter,
    rawFrontmatter?: string
  ): FrontmatterDeprecation[] {
    const warnings: FrontmatterDeprecation[] = [];
    const bundleKeys: string[] = [];
    const locationKeys: string[] = [];

    if (frontmatter.aggregate) {
      bundleKeys.push("aggregate");
      locationKeys.push("aggregate");
      const aggregateOptionKeys = this.collectOptionKeys(frontmatter.aggregate.options);
      if (aggregateOptionKeys.length > 0) {
        bundleKeys.push(...aggregateOptionKeys.map((key) => `aggregate.options.${key}`));
      }
    }

    if (frontmatter.build_options) {
      bundleKeys.push("build_options");
      locationKeys.push("build_options");
    }

    if (bundleKeys.length > 0) {
      warnings.push(this.createDeprecation(
        "Deprecated bundle schema",
        bundleKeys,
        locationKeys,
        rawFrontmatter,
        this.formatBundleHint(bundleKeys)
      ));
    }

    const unprefixedKeys = this.collectOptionKeys(frontmatter);
    if (unprefixedKeys.length > 0) {
      warnings.push(this.createDeprecation(
        "Deprecated unprefixed keys",
        unprefixedKeys,
        unprefixedKeys,
        rawFrontmatter,
        this.formatOptionHint("aggregate", unprefixedKeys)
      ));
    }

    const targets = frontmatter.targets;
    const invalidTargets = Array.isArray(targets) && targets.some((target) => typeof target !== "string");
    if (invalidTargets) {
      warnings.push(this.createDeprecation(
        "Deprecated bundle target schema",
        ["targets"],
        ["targets"],
        rawFrontmatter,
        "Replace inline target objects with a plain list of strings under `targets`."
      ));
    }

    return warnings;
  }

  private resolveRecipeOptions(frontmatter: BookerRecipeFrontmatter): Partial<BookerOptions> {
    const prefixed = this.readRecipePrefixedOptions(frontmatter);
    const nested = this.readOptionsFromObject(frontmatter.options);
    const unprefixed = this.readOptionsFromObject(frontmatter);
    return this.resolveOptionSources(prefixed, nested, unprefixed);
  }

  private resolveBuildOptions(frontmatter: BookerBundleFrontmatter): Partial<BuildOptions> {
    const prefixed = this.readBuildPrefixedOptions(frontmatter);
    const nested = this.readBuildOptionsFromObject(frontmatter.build_options);
    const resolved: Partial<BuildOptions> = {};
    const stopOnError = prefixed.stop_on_error ?? nested.stop_on_error;
    if (stopOnError !== undefined) {
      resolved.stop_on_error = stopOnError;
    }
    const continueOnMissing = prefixed.continue_on_missing ?? nested.continue_on_missing;
    if (continueOnMissing !== undefined) {
      resolved.continue_on_missing = continueOnMissing;
    }
    const dryRun = prefixed.dry_run ?? nested.dry_run;
    if (dryRun !== undefined) {
      resolved.dry_run = dryRun;
    }
    const summaryNotice = prefixed.summary_notice ?? nested.summary_notice;
    if (summaryNotice !== undefined) {
      resolved.summary_notice = summaryNotice;
    }
    return resolved;
  }

  private readOptionsFromObject(source: Record<string, unknown> | null | undefined): Partial<BookerOptions> {
    if (!source || typeof source !== "object") {
      return {};
    }
    const record = source as Record<string, unknown>;
    const options: Partial<BookerOptions> = {};
    const stripFrontmatter = this.readBoolean(record.strip_frontmatter);
    if (stripFrontmatter !== undefined) {
      options.strip_frontmatter = stripFrontmatter;
    }
    const stripH1 = this.readBoolean(record.strip_h1);
    if (stripH1 !== undefined) {
      options.strip_h1 = stripH1;
    }
    const stripTitle = this.readBoolean(record.strip_title);
    if (stripTitle !== undefined) {
      options.strip_title = stripTitle;
    }
    const separator = this.readString(record.separator);
    if (separator !== undefined) {
      options.separator = separator;
    }
    const headingOffset = this.readNumber(record.heading_offset);
    if (headingOffset !== undefined) {
      options.heading_offset = headingOffset;
    }
    const toc = this.readBoolean(record.toc);
    if (toc !== undefined) {
      options.toc = toc;
    }
    const tocTitle = this.readString(record.toc_title);
    if (tocTitle !== undefined) {
      options.toc_title = tocTitle;
    }
    const tocScope = this.readTocScope(record.toc_scope);
    if (tocScope !== undefined) {
      options.toc_scope = tocScope;
    }
    const tocDepth = this.readNumber(record.toc_depth);
    if (tocDepth !== undefined) {
      options.toc_depth = tocDepth;
    }
    const tocIncludeH1 = this.readBoolean(record.toc_include_h1);
    if (tocIncludeH1 !== undefined) {
      options.toc_include_h1 = tocIncludeH1;
    }
    return options;
  }

  private readRecipePrefixedOptions(frontmatter: BookerRecipeFrontmatter): Partial<BookerOptions> {
    return this.readPrefixedOptions(frontmatter, "recipe_");
  }

  private readAggregatePrefixedOptions(frontmatter: BookerBundleFrontmatter): Partial<BookerOptions> {
    return this.readPrefixedOptions(frontmatter, "aggregate_");
  }

  private readPrefixedOptions(frontmatter: Record<string, unknown>, prefix: string): Partial<BookerOptions> {
    const options: Partial<BookerOptions> = {};
    const stripFrontmatter = this.readBoolean(frontmatter[`${prefix}strip_frontmatter`]);
    if (stripFrontmatter !== undefined) {
      options.strip_frontmatter = stripFrontmatter;
    }
    const stripH1 = this.readBoolean(frontmatter[`${prefix}strip_h1`]);
    if (stripH1 !== undefined) {
      options.strip_h1 = stripH1;
    }
    const stripTitle = this.readBoolean(frontmatter[`${prefix}strip_title`]);
    if (stripTitle !== undefined) {
      options.strip_title = stripTitle;
    }
    const separator = this.readString(frontmatter[`${prefix}separator`]);
    if (separator !== undefined) {
      options.separator = separator;
    }
    const headingOffset = this.readNumber(frontmatter[`${prefix}heading_offset`]);
    if (headingOffset !== undefined) {
      options.heading_offset = headingOffset;
    }
    const toc = this.readBoolean(frontmatter[`${prefix}toc`]);
    if (toc !== undefined) {
      options.toc = toc;
    }
    const tocTitle = this.readString(frontmatter[`${prefix}toc_title`]);
    if (tocTitle !== undefined) {
      options.toc_title = tocTitle;
    }
    const tocScope = this.readTocScope(frontmatter[`${prefix}toc_scope`]);
    if (tocScope !== undefined) {
      options.toc_scope = tocScope;
    }
    const tocDepth = this.readNumber(frontmatter[`${prefix}toc_depth`]);
    if (tocDepth !== undefined) {
      options.toc_depth = tocDepth;
    }
    const tocIncludeH1 = this.readBoolean(frontmatter[`${prefix}toc_include_h1`]);
    if (tocIncludeH1 !== undefined) {
      options.toc_include_h1 = tocIncludeH1;
    }
    return options;
  }

  private resolveOptionSources(
    prefixed: Partial<BookerOptions>,
    nested: Partial<BookerOptions>,
    unprefixed: Partial<BookerOptions>
  ): Partial<BookerOptions> {
    const resolved: Partial<BookerOptions> = {};
    for (const key of OPTION_KEYS) {
      const value = prefixed[key] ?? nested[key] ?? unprefixed[key];
      if (value !== undefined) {
        this.assignOption(resolved, key, value as BookerOptions[typeof key]);
      }
    }
    return resolved;
  }

  private assignOption<K extends OptionKey>(
    target: Partial<BookerOptions>,
    key: K,
    value: BookerOptions[K]
  ): void {
    target[key] = value;
  }

  private readBuildPrefixedOptions(frontmatter: BookerBundleFrontmatter): Partial<BuildOptions> {
    const options: Partial<BuildOptions> = {};
    const stopOnError = this.readBoolean(frontmatter.build_stop_on_error);
    if (stopOnError !== undefined) {
      options.stop_on_error = stopOnError;
    }
    const continueOnMissing = this.readBoolean(frontmatter.build_continue_on_missing);
    if (continueOnMissing !== undefined) {
      options.continue_on_missing = continueOnMissing;
    }
    const dryRun = this.readBoolean(frontmatter.build_dry_run);
    if (dryRun !== undefined) {
      options.dry_run = dryRun;
    }
    const summaryNotice = this.readBoolean(frontmatter.build_summary_notice);
    if (summaryNotice !== undefined) {
      options.summary_notice = summaryNotice;
    }
    return options;
  }

  private readBuildOptionsFromObject(
    source: Record<string, unknown> | null | undefined
  ): Partial<BuildOptions> {
    if (!source || typeof source !== "object") {
      return {};
    }
    const record = source as Record<string, unknown>;
    const options: Partial<BuildOptions> = {};
    const stopOnError = this.readBoolean(record.stop_on_error);
    if (stopOnError !== undefined) {
      options.stop_on_error = stopOnError;
    }
    const continueOnMissing = this.readBoolean(record.continue_on_missing);
    if (continueOnMissing !== undefined) {
      options.continue_on_missing = continueOnMissing;
    }
    const dryRun = this.readBoolean(record.dry_run);
    if (dryRun !== undefined) {
      options.dry_run = dryRun;
    }
    const summaryNotice = this.readBoolean(record.summary_notice);
    if (summaryNotice !== undefined) {
      options.summary_notice = summaryNotice;
    }
    return options;
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    return value;
  }

  private readBoolean(value: unknown): boolean | undefined {
    if (typeof value !== "boolean") {
      return undefined;
    }
    return value;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return undefined;
    }
    return value;
  }

  private readTocScope(value: unknown): BookerOptions["toc_scope"] | undefined {
    if (value === "self") {
      return "file";
    }
    if (value === "file" || value === "tree") {
      return value;
    }
    return undefined;
  }

  private collectOptionKeys(source: Record<string, unknown> | null | undefined): OptionKey[] {
    if (!source || typeof source !== "object") {
      return [];
    }
    const record = source as Record<string, unknown>;
    return OPTION_KEYS.filter((key) => key in record);
  }

  private hasAggregateOptionOverrides(frontmatter: BookerBundleFrontmatter): boolean {
    return [
      frontmatter.aggregate_strip_frontmatter,
      frontmatter.aggregate_strip_h1,
      frontmatter.aggregate_strip_title,
      frontmatter.aggregate_separator,
      frontmatter.aggregate_heading_offset,
      frontmatter.aggregate_toc,
      frontmatter.aggregate_toc_title,
      frontmatter.aggregate_toc_scope,
      frontmatter.aggregate_toc_depth,
      frontmatter.aggregate_toc_include_h1
    ].some((value) => value !== undefined);
  }

  private createDeprecation(
    category: string,
    keys: string[],
    locationKeys: string[],
    rawFrontmatter: string | undefined,
    hint: string
  ): FrontmatterDeprecation {
    const location = rawFrontmatter
      ? this.findLocation(rawFrontmatter, locationKeys)
      : undefined;
    return {
      category,
      keys,
      location,
      hint
    };
  }

  private formatOptionHint(scope: "recipe" | "aggregate", keys: string[]): string {
    const prefix = scope === "recipe" ? "recipe_" : "aggregate_";
    const mapped = keys.map((key) => {
      const suffix = key.includes(".") ? key.split(".").pop() ?? key : key;
      return `${prefix}${suffix}`;
    });
    const from = keys.join(", ");
    const to = mapped.join(", ");
    return `Move ${from} to ${to}.`;
  }

  private formatBundleHint(keys: string[]): string {
    const hints: string[] = [];
    if (keys.some((key) => key.startsWith("aggregate"))) {
      hints.push("Move `aggregate.output` to `aggregate_output` and `aggregate.options.*` to `aggregate_*` keys.");
    }
    if (keys.some((key) => key.startsWith("build_options"))) {
      hints.push("Move `build_options.*` to `build_*` keys.");
    }
    return hints.length > 0
      ? hints.join(" ")
      : "Update aggregate and build configuration to the flat `aggregate_*` and `build_*` keys.";
  }

  private findLocation(rawFrontmatter: string, keys: string[]): FrontmatterLocation | undefined {
    if (keys.length === 0) {
      return undefined;
    }
    const lines = rawFrontmatter.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined) {
        continue;
      }
      for (const key of keys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = line.match(new RegExp(`^(\\s*)${escaped}\\s*:`));
        if (match) {
          const indent = match[1]?.length ?? 0;
          return { line: index + 1, column: indent + 1 };
        }
      }
    }
    return undefined;
  }
}
