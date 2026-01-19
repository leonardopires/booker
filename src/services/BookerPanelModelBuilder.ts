import { BookerBundleFrontmatter, BookerRecipeFrontmatter } from "../domain/types";
import { FileRef } from "../ports/IAppContext";
import { resolveFileLabel } from "../utils/LabelUtils";
import { FrontmatterParser } from "./FrontmatterParser";
import { LinkResolver } from "./LinkResolver";
import { IVault, IMetadataCache } from "../ports/IAppContext";

/**
 * Shared BookerContext shape for panel model dependencies.
 */
export type BookerPanelModelContext = {
  vault: IVault;
  metadataCache: IMetadataCache;
  parser: FrontmatterParser;
  linkResolver: LinkResolver;
};

/**
 * Represents a single source/step entry rendered in the Booker panel list.
 */
export type BookerPanelItem = {
  label: string;
  resolved: boolean;
};

/**
 * View model describing the Booker panel's current state.
 */
export type BookerPanelViewModel =
  | { state: "empty" }
  | { state: "not-booker"; path: string }
  | {
      state: "booker";
      kind: "recipe" | "bundle";
      /** Label used for notices related to the active file. */
      fileLabel: string;
      outputPath: string | null;
      outputExists: boolean;
      summaryLabel: string;
      totalCount: number;
      missingCount: number;
      items: BookerPanelItem[];
      actionLabel: string;
      hint: string;
    };

/**
 * Builds a Booker panel view model for the active file without touching the DOM.
 */
export class BookerPanelModelBuilder {
  constructor(private readonly context: BookerPanelModelContext) {}

  /**
   * Build the panel view model for the provided file.
   *
   * @param file - Active file reference or null when no file is active.
   * @returns The view model describing what the panel should render.
   */
  build(file: FileRef | null): BookerPanelViewModel {
    if (!file) {
      return { state: "empty" };
    }

    const frontmatter = this.context.parser.getFrontmatter(file) as
      | BookerRecipeFrontmatter
      | BookerBundleFrontmatter
      | null;
    if (!frontmatter) {
      return { state: "not-booker", path: file.path };
    }

    const typeInfo = this.context.parser.normalizeType(frontmatter.type);
    if (!typeInfo.normalized) {
      return { state: "not-booker", path: file.path };
    }

    const kind = typeInfo.normalized === "booker-recipe" ? "recipe" : "bundle";
    const fileLabel = resolveFileLabel(file.path, frontmatter ?? null);
    const outputPath = this.getOutputPath(frontmatter, file.path, typeInfo.normalized);
    const outputExists = outputPath
      ? this.context.vault.getFileByPath(outputPath)?.kind === "file"
      : false;
    const { targets, missingCount } = this.getTargets(frontmatter, file.path, typeInfo.normalized);
    const summaryLabel = kind === "recipe" ? "Sources" : "Steps";
    const actionLabel = kind === "recipe" ? "📘 Generate recipe" : "📚 Generate bundle";
    const hint =
      missingCount > 0
        ? "⚠️ Some sources are missing. Fix the YAML in Source mode, then generate again."
        : `ℹ️ To change this ${kind}, edit the YAML in Source mode.`;

    return {
      state: "booker",
      kind,
      fileLabel,
      outputPath,
      outputExists,
      summaryLabel,
      totalCount: targets.length,
      missingCount,
      items: targets,
      actionLabel,
      hint
    };
  }

  /**
   * Resolve the output path for a recipe or bundle frontmatter block.
   */
  private getOutputPath(
    frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter,
    sourcePath: string,
    type: "booker-recipe" | "booker-bundle"
  ): string | null {
    if (type === "booker-recipe") {
      const recipeFrontmatter = frontmatter as BookerRecipeFrontmatter;
      if (!recipeFrontmatter.output) {
        return null;
      }
      return this.context.parser.resolveOutputPath(recipeFrontmatter.output, sourcePath);
    }
    const bundleFrontmatter = frontmatter as BookerBundleFrontmatter;
    const aggregateOutput =
      bundleFrontmatter.aggregate_output ?? bundleFrontmatter.aggregate?.output;
    if (!aggregateOutput) {
      return null;
    }
    return this.context.parser.resolveOutputPath(aggregateOutput, sourcePath);
  }

  /**
   * Build list entries and missing counts for the active file.
   */
  private getTargets(
    frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter,
    sourcePath: string,
    type: "booker-recipe" | "booker-bundle"
  ): { targets: BookerPanelItem[]; missingCount: number } {
    if (type === "booker-recipe") {
      const recipeFrontmatter = frontmatter as BookerRecipeFrontmatter;
      const order = this.context.parser.normalizeOrder(recipeFrontmatter.order ?? []);
      const targets = order.map((item) => {
        const resolved = this.resolveLink(item, sourcePath);
        return { label: this.formatLinkLabel(item), resolved };
      });
      const missingCount = targets.filter((target) => !target.resolved).length;
      return { targets, missingCount };
    }

    const bundleFrontmatter = frontmatter as BookerBundleFrontmatter;
    const rawTargets = Array.isArray(bundleFrontmatter.targets) ? bundleFrontmatter.targets : [];
    const targets = rawTargets.map((target, index) => {
      if (typeof target !== "string") {
        return { label: `Target ${index + 1}`, resolved: false };
      }
      return this.getBundleTarget(target, sourcePath);
    });
    const missingCount = targets.filter((target) => !target.resolved).length;
    return { targets, missingCount };
  }

  /**
   * Build a list entry for a bundle target.
   */
  private getBundleTarget(target: string, sourcePath: string): BookerPanelItem {
    const label = this.formatLinkLabel(target);
    const resolved = this.resolveLink(target, sourcePath);
    return { label, resolved };
  }

  /**
   * Normalize a link label for display.
   */
  private formatLinkLabel(raw: string): string {
    const normalized = this.context.linkResolver.normalizeLinkString(raw);
    return normalized || raw.trim();
  }

  /**
   * Resolve a link and return whether it exists.
   */
  private resolveLink(raw: string, sourcePath: string): boolean {
    const normalized = this.context.linkResolver.normalizeLinkString(raw);
    if (!normalized) {
      return false;
    }
    return this.context.metadataCache.getFirstLinkpathDest(normalized, sourcePath) !== null;
  }
}
