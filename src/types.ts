export type BookerOptions = {
  strip_frontmatter: boolean;
  strip_h1: boolean;
  strip_title: boolean;
  separator: string;
};

export type BookerProjectFrontmatter = {
  type?: string;
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
};

export type BuildTargetInlineFrontmatter = {
  name?: string;
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
};

export type BuildTargetProjectFrontmatter = {
  name?: string;
  project?: string;
  title?: string;
  output?: string;
  options?: Partial<BookerOptions>;
};

export type BuildTargetFrontmatter = BuildTargetInlineFrontmatter | BuildTargetProjectFrontmatter;

export type BuildAggregateFrontmatter = {
  title?: string;
  output?: string;
  options?: Partial<BookerOptions>;
};

export type BookerBuildfileFrontmatter = {
  type?: string;
  title?: string;
  targets?: BuildTargetFrontmatter[];
  aggregate?: BuildAggregateFrontmatter;
  build_options?: Partial<BuildOptions>;
};

export type BuildOptions = {
  stop_on_error: boolean;
  continue_on_missing: boolean;
  dry_run: boolean;
  summary_notice: boolean;
};

export type CompileConfig = {
  title?: string;
  outputPath: string;
  order: string[];
  options: BookerOptions;
};

export type BookerProjectConfig = CompileConfig;

export type BuildTargetConfig = CompileConfig & {
  name: string;
};

export type BuildTargetPlan = {
  name: string;
  config?: BuildTargetConfig;
  error?: string;
};

export type BuildAggregateConfig = {
  title?: string;
  outputPath: string;
  options: BookerOptions;
};

export type BuildfileConfig = {
  targets: BuildTargetPlan[];
  aggregate?: BuildAggregateConfig;
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
