import { FileRef, IVault } from "../ports/IAppContext";
import { FilenamePromptResult } from "../ports/PromptTypes";
import { getDirname, normalizePath } from "../utils/PathUtils";
import { FrontmatterParser } from "./FrontmatterParser";
import { UserMessagePresenter } from "./UserMessagePresenter";

/**
 * Supported template types for new Booker files.
 */
export type BookerTemplateKind = "recipe" | "bundle";

type PromptFunction = (message: string, defaultValue?: string) => Promise<FilenamePromptResult | null>;
type OpenFileFunction = (file: FileRef) => void;

const RECIPE_TEMPLATE = `---
type: booker-recipe
title: "$FILENAME$"
output: "output/$FILENAME$.md"
order:
  - "[[]]"
recipe_strip_frontmatter: true
recipe_strip_h1: true
recipe_heading_offset: 1
---

# New Recipe

Describe what this recipe generates.

ℹ️ Edit the YAML above in Source mode.
`;

const BUNDLE_TEMPLATE = `---
type: booker-bundle
title: "$FILENAME$"
targets:
  - "[[]]"
aggregate_output: "output/$FILENAME$.md"
---

# New Bundle

This bundle combines multiple recipes or bundles.

ℹ️ Edit the YAML above in Source mode.
`;

/**
 * Creates Booker recipe or bundle files after prompting for a filename and prefill options.
 */
export class BookerFileCreator {
  constructor(
    private readonly context: {
      vault: IVault;
      presenter: UserMessagePresenter;
      parser: FrontmatterParser;
      prompt: PromptFunction;
      openFile: OpenFileFunction;
    }
  ) {}

  /**
   * Create a new recipe in the target folder or alongside the target file.
   *
   * @param target - Target folder or file reference.
   * @returns The created file ref, or null if creation is canceled.
   */
  async createRecipe(target: FileRef): Promise<FileRef | null> {
    return this.createFromTemplate(target, "recipe");
  }

  /**
   * Create a new bundle in the target folder or alongside the target file.
   *
   * @param target - Target folder or file reference.
   * @returns The created file ref, or null if creation is canceled.
   */
  async createBundle(target: FileRef): Promise<FileRef | null> {
    return this.createFromTemplate(target, "bundle");
  }

  /**
   * Prompt for a filename, validate it, and create the requested template.
   *
   * @param target - Target folder or file reference.
   * @param kind - Template kind to create.
   * @returns The created file ref, or null if creation is canceled or invalid.
   */
  private async createFromTemplate(target: FileRef, kind: BookerTemplateKind): Promise<FileRef | null> {
    const folder = normalizePath(
      target.kind === "folder" ? target.path : getDirname(target.path) ?? ""
    );
    const defaultName = `New ${kind === "recipe" ? "recipe" : "bundle"}`;
    const promptResult = await this.context.prompt(
      `New ${kind === "recipe" ? "recipe" : "bundle"} filename`,
      defaultName
    );
    if (promptResult === null) {
      return null;
    }

    const trimmed = promptResult.filename.trim();
    if (!trimmed) {
      this.context.presenter.showWarning("Please enter a filename.");
      return null;
    }

    const filename = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    const path = normalizePath(folder ? `${folder}/${filename}` : filename);
    const existing = this.context.vault.getFileByPath(path);
    if (existing) {
      this.context.presenter.showWarning("That file already exists. Choose a new name.");
      return null;
    }

    const filenameNoExt = filename.endsWith(".md") ? filename.substring(0, filename.length - 3) : filename;

    const template = kind === "recipe" ? RECIPE_TEMPLATE : BUNDLE_TEMPLATE;
    const content = template.replace(/\$FILENAME\$/gm, filenameNoExt);
    const finalContent = promptResult.prefillFromFolder
      ? await this.applyPrefill(content, {
          folder,
          kind,
          includeSubfolders: promptResult.includeSubfolders,
          excludePath: path
        })
      : content;
    const created = await this.context.vault.create(path, finalContent);
    this.context.openFile(created);
    return created;
  }

  /**
   * Replace the order/targets list with a filtered set of wikilinks from the target folder.
   */
  private async applyPrefill(
    content: string,
    options: {
      folder: string;
      kind: BookerTemplateKind;
      includeSubfolders: boolean;
      excludePath: string;
    }
  ): Promise<string> {
    const items = await this.collectPrefillTargets(options);
    const listLines = items.length > 0 ? items : ['  - "[[]]"'];
    const listKey = options.kind === "recipe" ? "order" : "targets";
    const listBlock = `${listKey}:\n${listLines.join("\n")}`;
    const placeholder = new RegExp(`${listKey}:\\n  - "\\[\\[\\]\\]"`);
    return content.replace(placeholder, listBlock);
  }

  /**
   * Collect and format wikilinks from the target folder based on the template kind.
   */
  private collectPrefillTargets(options: {
    folder: string;
    kind: BookerTemplateKind;
    includeSubfolders: boolean;
    excludePath: string;
  }): string[] {
    const folderRef: FileRef = { path: options.folder, kind: "folder" };
    const candidates = this.context.vault.listFolderFiles(folderRef, options.includeSubfolders);
    const normalizedExclude = normalizePath(options.excludePath);
    const filtered = candidates
      .map((file) => normalizePath(file.path))
      .filter((path) => this.isEligiblePath(path, normalizedExclude, options.kind))
      .sort((a, b) => a.localeCompare(b))
      .map((path) => {
        const withoutExt = path.endsWith(".md") ? path.slice(0, -3) : path;
        return `  - "[[${withoutExt}]]"`;
      });
    return filtered;
  }

  /**
   * Determine if a path should be included in the prefill list.
   */
  private isEligiblePath(path: string, excludePath: string, kind: BookerTemplateKind): boolean {
    if (!path || path === excludePath) {
      return false;
    }
    if (!path.endsWith(".md")) {
      return false;
    }
    if (path.split("/").includes("output")) {
      return false;
    }

    const fileRef: FileRef = { path, kind: "file" };
    const frontmatter = this.context.parser.getFrontmatter(fileRef);
    const normalized = this.context.parser.normalizeType(frontmatter?.type);
    const isBooker = normalized.normalized === "booker-recipe" || normalized.normalized === "booker-bundle";

    return kind === "recipe" ? !isBooker : isBooker;
  }
}
