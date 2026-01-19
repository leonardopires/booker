import { ItemView, WorkspaceLeaf } from "obsidian";
import { FileRef } from "../ports/IAppContext";
import { BookerPanelModelBuilder, BookerPanelViewModel } from "../services/BookerPanelModelBuilder";
import { UserMessagePresenter } from "../services/UserMessagePresenter";

/**
 * Obsidian view type identifier for the Booker panel.
 */
export const VIEW_TYPE_BOOKER_PANEL = "booker-panel";

/**
 * Generates Booker output for the active file.
 */
type GenerateHandler = (file: FileRef) => Promise<unknown>;

/**
 * Attempts to open the generated output path.
 */
type OpenOutputHandler = (path: string) => boolean;

/**
 * Obsidian view that renders the Booker panel and delegates data building to the model builder.
 */
export class BookerPanelView extends ItemView {
  private activeFile: FileRef | null = null;
  private model: BookerPanelViewModel = { state: "empty" };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly builder: BookerPanelModelBuilder,
    private readonly generate: GenerateHandler,
    private readonly openOutput: OpenOutputHandler,
    private readonly presenter: UserMessagePresenter
  ) {
    super(leaf);
  }

  /**
   * @returns Obsidian view type identifier.
   */
  getViewType(): string {
    return VIEW_TYPE_BOOKER_PANEL;
  }

  /**
   * @returns Display name for the view tab.
   */
  getDisplayText(): string {
    return "Booker";
  }

  /**
   * Refresh the panel using the provided active file.
   *
   * @param file - Active file reference or null when no file is active.
   */
  setActiveFile(file: FileRef | null): void {
    this.activeFile = file;
    this.model = this.builder.build(file);
    this.render();
  }

  /**
   * Initialize the panel container when the view opens.
   */
  async onOpen(): Promise<void> {
    this.render();
  }

  /**
   * Render the current view model into the panel container.
   */
  private render(): void {
    const root = this.contentEl;
    this.clearElement(root);
    root.classList.add("booker-panel__root");

    const header = this.createElement(root, "div", "booker-panel__header");
    this.createElement(header, "span", "booker-panel__title", "Booker");

    if (this.model.state === "booker") {
      const badge = this.createElement(header, "span", "booker-panel__badge");
      badge.textContent = this.model.kind === "recipe" ? "Recipe" : "Bundle";
    }

    if (this.model.state === "empty") {
      this.createElement(root, "div", "booker-panel__empty", "No active note selected.");
      return;
    }

    if (this.model.state === "not-booker") {
      this.createElement(root, "div", "booker-panel__empty", "This note is not a Booker recipe or bundle.");
      return;
    }

    const model = this.model;
    const outputLine = this.createElement(root, "div", "booker-panel__output");
    outputLine.append("Output: ");
    if (model.outputPath) {
      const link = this.createElement(outputLine, "a", "booker-panel__output-link");
      link.href = "#";
      link.textContent = model.outputPath;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const opened = this.openOutput(model.outputPath ?? "");
        if (!opened) {
          this.presenter.showInfo("Output not generated yet. Generate first.");
        }
      });
    } else {
      this.createElement(outputLine, "span", "booker-panel__output-empty", "—");
    }

    const summary = this.createElement(root, "div", "booker-panel__summary");
    summary.textContent = `${model.summaryLabel}: ${model.totalCount} (missing: ${model.missingCount})`;

    const list = this.createElement(root, "ul", "booker-panel__list");
    model.items.forEach((item) => {
      const entry = this.createElement(list, "li", "booker-panel__list-item");
      const icon = item.resolved ? "✅" : "❌";
      entry.textContent = `${icon} ${item.label}`;
    });

    const actions = this.createElement(root, "div", "booker-panel__actions");
    const button = this.createElement(actions, "button", "booker-panel__action-button");
    button.type = "button";
    button.textContent = model.actionLabel;
    button.addEventListener("click", () => {
      if (this.activeFile) {
        void this.generate(this.activeFile);
      }
    });

    const hint = this.createElement(root, "div", "booker-panel__hint");
    hint.textContent = model.hint;
  }

  /**
   * Remove all children from an element.
   */
  private clearElement(element: HTMLElement): void {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Create and append an element with optional class and text.
   */
  private createElement<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    className?: string,
    text?: string
  ): HTMLElementTagNameMap[K] {
    const element = parent.ownerDocument.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    parent.appendChild(element);
    return element;
  }
}
