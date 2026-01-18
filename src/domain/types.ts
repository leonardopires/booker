export type BookerOptions = {
  strip_frontmatter: boolean;
  strip_h1: boolean;
  strip_title: boolean;
  separator: string;
};

export type BuildOptions = {
  stop_on_error: boolean;
  continue_on_missing: boolean;
  dry_run: boolean;
  summary_notice: boolean;
};

export type BookerRecipeFrontmatter = {
  type?: string;
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
};

export type BundleTargetOverrides = {
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
};

export type BundleTargetFrontmatter = {
  name?: string;
  source?: string;
  mode?: TargetMode;
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
  overrides?: BundleTargetOverrides;
  project?: string;
};

export type BuildAggregateFrontmatter = {
  title?: string;
  output?: string;
  options?: Partial<BookerOptions>;
};

export type BookerBundleFrontmatter = {
  type?: string;
  title?: string;
  targets?: BundleTargetFrontmatter[];
  aggregate?: BuildAggregateFrontmatter;
  build_options?: Partial<BuildOptions>;
};

export type BookerRecipeConfig = {
  title?: string;
  outputPath: string;
  order: string[];
  options: BookerOptions;
};

export type TargetMode = "auto" | "recipe" | "bundle";

export type BundleTargetSourcePlan = {
  name: string;
  source: string;
  mode: TargetMode;
  overrides?: BundleTargetOverrides;
  title?: string;
};

export type BundleTargetInlinePlan = {
  name: string;
  inlineConfig: BookerRecipeConfig;
};

export type BundleTargetPlan = BundleTargetSourcePlan | BundleTargetInlinePlan;

export type AggregateConfig = {
  title?: string;
  outputPath: string;
  options: BookerOptions;
};

export type BookerBundleConfig = {
  targets: BundleTargetPlan[];
  aggregate?: AggregateConfig;
  buildOptions: BuildOptions;
};

export type CompileResult = {
  content: string;
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

export const DEFAULT_BOOKER_OPTIONS: BookerOptions = {
  strip_frontmatter: true,
  strip_h1: false,
  strip_title: false,
  separator: "\n\n---\n\n"
};

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  stop_on_error: true,
  continue_on_missing: false,
  dry_run: false,
  summary_notice: true
};
