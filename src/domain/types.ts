export type BookerOptions = {
  strip_frontmatter: boolean;
  strip_h1: boolean;
  strip_title: boolean;
  separator: string;
  /**
   * Offset to apply to Markdown heading levels when concatenating content.
   * A value of 0 disables shifting.
   */
  heading_offset: number;
  /**
   * Whether to render a Markdown table of contents in the output.
   */
  toc: boolean;
  /**
   * Title label for the table of contents heading.
   */
  toc_title: string;
  /**
   * Scope for bundle table of contents aggregation.
   */
  toc_scope: "file" | "tree";
  /**
   * Maximum heading depth to include in the table of contents.
   */
  toc_depth: number;
  /**
   * Whether to include level-1 headings in the table of contents.
   */
  toc_include_h1: boolean;
};

/**
 * Supported levels for build notices.
 */
export type BuildEventLevel = "info" | "success" | "warning" | "error";

/**
 * A single build notice event with an associated file label.
 */
export type BuildEvent = {
  level: BuildEventLevel;
  fileLabel: string;
  message: string;
};

/**
 * Aggregated status for a build report.
 */
export type BuildReportStatus = "success" | "warning" | "error";

/**
 * Summary counts for build target outcomes.
 */
export type BuildReportCounts = {
  success: number;
  warning: number;
  error: number;
};

/**
 * Aggregated report for a build run.
 */
export type BuildReport = {
  status: BuildReportStatus;
  counts: BuildReportCounts;
  events: BuildEvent[];
};

export type BuildOptions = {
  stop_on_error: boolean;
  continue_on_missing: boolean;
  dry_run: boolean;
  summary_notice: boolean;
};

/**
 * Internal build execution controls that are not part of frontmatter schema.
 *
 * Used to control build-time behaviors like TOC emission without mutating user options.
 */
export type BuildExecutionOptions = {
  /**
   * Controls whether a build emits table-of-contents blocks.
   * Defaults to "emit" when omitted.
   */
  tocEmission?: "emit" | "suppress";
};

export type BookerRecipeFrontmatter = {
  type?: string;
  title?: string;
  output?: string;
  order?: string[];
  recipe_strip_frontmatter?: boolean;
  recipe_strip_h1?: boolean;
  recipe_strip_title?: boolean;
  recipe_separator?: string;
  recipe_heading_offset?: number;
  recipe_toc?: boolean;
  recipe_toc_title?: string;
  recipe_toc_scope?: "file" | "tree" | "self";
  recipe_toc_depth?: number;
  recipe_toc_include_h1?: boolean;
  strip_frontmatter?: boolean;
  strip_h1?: boolean;
  strip_title?: boolean;
  separator?: string;
  heading_offset?: number;
  toc?: boolean;
  toc_title?: string;
  toc_scope?: "file" | "tree" | "self";
  toc_depth?: number;
  toc_include_h1?: boolean;
  options?: Partial<BookerOptions>;
};

export type BuildAggregateFrontmatter = {
  title?: string;
  output?: string;
  options?: Partial<BookerOptions>;
};

export type BookerBundleFrontmatter = {
  type?: string;
  title?: string;
  targets?: string[];
  aggregate_title?: string;
  aggregate_output?: string;
  aggregate_strip_frontmatter?: boolean;
  aggregate_strip_h1?: boolean;
  aggregate_strip_title?: boolean;
  aggregate_separator?: string;
  aggregate_heading_offset?: number;
  aggregate_toc?: boolean;
  aggregate_toc_title?: string;
  aggregate_toc_scope?: "file" | "tree" | "self";
  aggregate_toc_depth?: number;
  aggregate_toc_include_h1?: boolean;
  build_stop_on_error?: boolean;
  build_continue_on_missing?: boolean;
  build_dry_run?: boolean;
  build_summary_notice?: boolean;
  strip_frontmatter?: boolean;
  strip_h1?: boolean;
  strip_title?: boolean;
  separator?: string;
  heading_offset?: number;
  toc?: boolean;
  toc_title?: string;
  toc_scope?: "file" | "tree" | "self";
  toc_depth?: number;
  toc_include_h1?: boolean;
  aggregate?: BuildAggregateFrontmatter;
  build_options?: Partial<BuildOptions>;
};

export type BookerRecipeConfig = {
  title?: string;
  outputPath: string;
  order: string[];
  options: BookerOptions;
};

export type AggregateConfig = {
  title?: string;
  outputPath: string;
  options: BookerOptions;
};

export type BookerBundleConfig = {
  targets: string[];
  aggregate?: AggregateConfig;
  buildOptions: BuildOptions;
};

export type CompileResult = {
  content: string;
  headings: HeadingEntry[];
  missingLinks: string[];
  skippedSelfIncludes: string[];
  resolvedCount: number;
};

export type TargetResult = {
  name: string;
  outputPath: string;
  missingLinks: string[];
  skippedSelfIncludes: string[];
  success: boolean;
  resolvedCount: number;
};

export type AggregateResult = {
  attempted: boolean;
  success: boolean;
  outputPath?: string;
};

export type BuildResult = {
  targets: TargetResult[];
  successes: number;
  failures: number;
  missingTotal: number;
  aggregate: AggregateResult;
};

export type HeadingEntry = {
  level: number;
  text: string;
  sourcePath: string;
};

export const DEFAULT_BOOKER_OPTIONS: BookerOptions = {
  strip_frontmatter: true,
  strip_h1: false,
  strip_title: false,
  separator: "\n\n---\n\n",
  heading_offset: 1,
  toc: false,
  toc_title: "Table of Contents",
  toc_scope: "tree",
  toc_depth: 4,
  toc_include_h1: true
};

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  stop_on_error: true,
  continue_on_missing: false,
  dry_run: false,
  summary_notice: true
};
