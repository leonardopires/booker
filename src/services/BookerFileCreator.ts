import { FileRef, IVault } from "../ports/IAppContext";
import { getDirname, normalizePath } from "../utils/PathUtils";
import { UserMessagePresenter } from "./UserMessagePresenter";

/**
 * Supported template types for new Booker files.
 */
export type BookerTemplateKind = "recipe" | "bundle";

type PromptFunction = (message: string, defaultValue?: string) => Promise<string | null>;
type OpenFileFunction = (file: FileRef) => void;

const RECIPE_TEMPLATE = `---
type: booker-recipe
title: "$FILENAME$"
output: "output/$FILENAME$.md"
order:
  - "[[]]"
options:
  strip_frontmatter: true
  strip_h1: false
  heading_offset: 1
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
aggregate:
  output: "output/$FILENAME$.md"
---

# New Bundle

This bundle combines multiple recipes or bundles.

ℹ️ Edit the YAML above in Source mode.
`;

/**
 * Creates Booker recipe or bundle files after prompting for a filename.
 */
export class BookerFileCreator {
  constructor(
    private readonly context: {
      vault: IVault;
      presenter: UserMessagePresenter;
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
    const folder = target.kind === "folder" ? target.path : getDirname(target.path) ?? "";
    const defaultName = `New ${kind === "recipe" ? "recipe" : "bundle"}`;
    const name = await this.context.prompt(
      `New ${kind === "recipe" ? "recipe" : "bundle"} filename`,
      defaultName
    );
    if (name === null) {
      return null;
    }

    const trimmed = name.trim();
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
    const created = await this.context.vault.create(path, content);
    this.context.openFile(created);
    return created;
  }
}
