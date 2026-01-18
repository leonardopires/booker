import { FileRef, IMetadataCache, IVault } from "../ports/IAppContext";
import { BookerBundleFrontmatter, BookerRecipeFrontmatter, BundleTargetFrontmatter } from "../domain/types";
import { FrontmatterParser } from "./FrontmatterParser";
import { LinkResolver } from "./LinkResolver";

type GenerateHandler = (file: FileRef) => Promise<void>;
type OpenFileHandler = (path: string) => void;

type InspectorTarget = {
  label: string;
  resolved: boolean;
};

export class BookerInspector {
  constructor(
    private readonly vault: IVault,
    private readonly metadataCache: IMetadataCache,
    private readonly parser: FrontmatterParser,
    private readonly linkResolver: LinkResolver,
    private readonly generate: GenerateHandler,
    private readonly openFile: OpenFileHandler
  ) {}

  render(container: HTMLElement, sourcePath: string): void {
    container.querySelectorAll(".booker-inspector").forEach((node) => node.remove());

    const file = this.vault.getFileByPath(sourcePath);
    if (!file || file.kind !== "file") {
      return;
    }

    const frontmatter = this.parser.getFrontmatter(file) as
      | BookerRecipeFrontmatter
      | BookerBundleFrontmatter
      | null;
    if (!frontmatter) {
      return;
    }

    const typeInfo = this.parser.normalizeType(frontmatter.type);
    if (!typeInfo.normalized) {
      return;
    }

    const wrapper = this.createElement(container, "div");
    wrapper.className = "booker-inspector";

    const header = this.createElement(wrapper, "div");
    header.className = "booker-inspector__header";

    const title = this.createElement(header, "span");
    title.textContent = "Booker";

    const badge = this.createElement(header, "span");
    badge.className = "booker-inspector__badge";
    badge.textContent = typeInfo.normalized === "booker-recipe" ? "Recipe" : "Bundle";

    const outputLine = this.createElement(wrapper, "div");
    const outputPath = this.getOutputPath(frontmatter, file.path, typeInfo.normalized);
    outputLine.append("Output: ");
    if (outputPath) {
      const outputFile = this.vault.getFileByPath(outputPath);
      if (outputFile?.kind === "file") {
        const link = this.createElement(outputLine, "a");
        link.href = "#";
        link.textContent = outputPath;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          this.openFile(outputPath);
        });
      } else {
        const span = this.createElement(outputLine, "span");
        span.textContent = outputPath;
      }
    } else {
      const span = this.createElement(outputLine, "span");
      span.textContent = "—";
    }

    const { targets, missingCount } = this.getTargets(frontmatter, file.path, typeInfo.normalized);
    const summary = this.createElement(wrapper, "div");
    summary.className = "booker-inspector__summary";
    const summaryLabel = typeInfo.normalized === "booker-recipe" ? "Sources" : "Steps";
    summary.textContent = `${summaryLabel}: ${targets.length} (missing: ${missingCount})`;

    const list = this.createElement(wrapper, "ul");
    list.className = "booker-inspector__list";
    targets.forEach((target) => {
      const item = this.createElement(list, "li");
      const icon = target.resolved ? "✅" : "❌";
      item.textContent = `${icon} ${target.label}`;
    });

    const actions = this.createElement(wrapper, "div");
    actions.className = "booker-inspector__actions";
    const button = this.createElement(actions, "button");
    button.type = "button";
    button.textContent = typeInfo.normalized === "booker-recipe" ? "📘 Generate recipe" : "📚 Generate bundle";
    button.addEventListener("click", () => {
      void this.generate(file);
    });

    const hint = this.createElement(wrapper, "div");
    hint.className = "booker-inspector__hint";
    if (missingCount > 0) {
      hint.textContent = "⚠️ Some sources are missing. Switch to Source mode and fix the YAML above.";
    } else {
      const label = typeInfo.normalized === "booker-recipe" ? "recipe" : "bundle";
      hint.textContent = `ℹ️ To change this ${label}, edit the YAML in Source mode.`;
    }
  }

  private getOutputPath(
    frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter,
    sourcePath: string,
    type: "booker-recipe" | "booker-bundle"
  ): string | null {
    if (type === "booker-recipe") {
      if (!frontmatter.output) {
        return null;
      }
      return this.parser.resolveOutputPath(frontmatter.output, sourcePath);
    }
    const aggregateOutput = frontmatter.aggregate?.output;
    if (!aggregateOutput) {
      return null;
    }
    return this.parser.resolveOutputPath(aggregateOutput, sourcePath);
  }

  private getTargets(
    frontmatter: BookerRecipeFrontmatter | BookerBundleFrontmatter,
    sourcePath: string,
    type: "booker-recipe" | "booker-bundle"
  ): { targets: InspectorTarget[]; missingCount: number } {
    if (type === "booker-recipe") {
      const order = this.parser.normalizeOrder(frontmatter.order ?? []);
      const targets = order.map((item) => {
        const resolved = this.resolveLink(item, sourcePath);
        return { label: this.formatLinkLabel(item), resolved };
      });
      const missingCount = targets.filter((target) => !target.resolved).length;
      return { targets, missingCount };
    }

    const targets = (frontmatter.targets ?? []).map((target, index) =>
      this.getBundleTarget(target, index, sourcePath)
    );
    const missingCount = targets.filter((target) => !target.resolved).length;
    return { targets, missingCount };
  }

  private getBundleTarget(
    target: BundleTargetFrontmatter | null | undefined,
    index: number,
    sourcePath: string
  ): InspectorTarget {
    if (!target || typeof target !== "object") {
      return { label: `Target ${index + 1}`, resolved: false };
    }

    const name = target.name?.trim() || `Target ${index + 1}`;
    const source = target.source ?? target.project;
    if (source) {
      return {
        label: `${name}: ${this.formatLinkLabel(source)}`,
        resolved: this.resolveLink(source, sourcePath)
      };
    }

    const order = this.parser.normalizeOrder(target.order ?? []);
    const hasMissing = order.some((item) => !this.resolveLink(item, sourcePath));
    const label = `${name} (inline)`;
    return { label, resolved: order.length > 0 && !hasMissing };
  }

  private formatLinkLabel(raw: string): string {
    const normalized = this.linkResolver.normalizeLinkString(raw);
    return normalized || raw.trim();
  }

  private resolveLink(raw: string, sourcePath: string): boolean {
    const normalized = this.linkResolver.normalizeLinkString(raw);
    if (!normalized) {
      return false;
    }
    return this.metadataCache.getFirstLinkpathDest(normalized, sourcePath) !== null;
  }

  private createElement<T extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: T
  ): HTMLElementTagNameMap[T] {
    const element = parent.ownerDocument.createElement(tag);
    parent.appendChild(element);
    return element;
  }
}
