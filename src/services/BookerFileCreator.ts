import { FileRef, IVault } from "../ports/IAppContext";
import { getDirname, normalizePath } from "../utils/PathUtils";
import { UserMessagePresenter } from "./UserMessagePresenter";

export type BookerTemplateKind = "recipe" | "bundle";

type PromptFunction = (message: string, defaultValue?: string) => string | null;
type OpenFileFunction = (file: FileRef) => void;

const RECIPE_TEMPLATE = `---
type: booker-recipe
title: "New Recipe"
output: "output/NEW_RECIPE.md"
order:
  - "[[]]"
options:
  strip_frontmatter: true
  strip_h1: false
  separator: "\n\n---\n\n"
---

# New Recipe

Describe what this recipe generates.

ℹ️ Edit the YAML above in Source mode.
`;

const BUNDLE_TEMPLATE = `---
type: booker-bundle
title: "New Bundle"
targets:
  - name: Step 1
    source: "[[]]"
aggregate:
  output: "output/NEW_BUNDLE.md"
---

# New Bundle

This bundle combines multiple recipes or bundles.

ℹ️ Edit the YAML above in Source mode.
`;

export class BookerFileCreator {
  constructor(
    private readonly vault: IVault,
    private readonly presenter: UserMessagePresenter,
    private readonly prompt: PromptFunction,
    private readonly openFile: OpenFileFunction
  ) {}

  async createRecipe(target: FileRef): Promise<FileRef | null> {
    return this.createFromTemplate(target, "recipe");
  }

  async createBundle(target: FileRef): Promise<FileRef | null> {
    return this.createFromTemplate(target, "bundle");
  }

  private async createFromTemplate(target: FileRef, kind: BookerTemplateKind): Promise<FileRef | null> {
    const folder = target.kind === "folder" ? target.path : getDirname(target.path);
    const name = this.prompt(`New ${kind === "recipe" ? "recipe" : "bundle"} filename`);
    if (!name) {
      return null;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      this.presenter.showWarning("Please enter a filename.");
      return null;
    }

    const filename = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    const path = normalizePath(folder ? `${folder}/${filename}` : filename);
    const existing = this.vault.getFileByPath(path);
    if (existing) {
      this.presenter.showWarning("That file already exists. Choose a new name.");
      return null;
    }

    const content = kind === "recipe" ? RECIPE_TEMPLATE : BUNDLE_TEMPLATE;
    const created = await this.vault.create(path, content);
    this.openFile(created);
    return created;
  }
}
