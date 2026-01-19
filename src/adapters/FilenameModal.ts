import { App, Modal } from "obsidian";
import { FilenamePromptResult } from "../ports/PromptTypes";

/**
 * Modal prompt that asks the user for a filename and optional prefill settings.
 */
export class FilenameModal extends Modal {
  private resolvePromise: ((value: FilenamePromptResult | null) => void) | null = null;
  private inputEl: HTMLInputElement | null = null;
  private prefillCheckbox: HTMLInputElement | null = null;
  private includeSubfoldersCheckbox: HTMLInputElement | null = null;
  private didSubmit = false;

  constructor(
    app: App,
    private readonly titleText: string,
    private readonly defaultValue?: string
  ) {
    super(app);
  }

  /**
   * Open the modal and resolve with the user input or null if canceled.
   *
   * @returns Promise that resolves to the provided filename data or null.
   */
  openAndGetValue(): Promise<FilenamePromptResult | null> {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  /**
   * Build modal content.
   */
  onOpen(): void {
    this.clearElement(this.contentEl);
    const title = this.createElement(this.contentEl, "h2");
    title.textContent = this.titleText;

    const input = this.createElement(this.contentEl, "input");
    input.type = "text";
    input.placeholder = "Filename";
    if (this.defaultValue) {
      input.value = this.defaultValue;
    }
    this.inputEl = input;

    const prefillRow = this.createElement(this.contentEl, "label", "booker-panel__modal-checkbox");
    const prefillCheckbox = this.createElement(prefillRow, "input");
    prefillCheckbox.type = "checkbox";
    prefillCheckbox.checked = true;
    this.prefillCheckbox = prefillCheckbox;
    const prefillLabel = this.createElement(prefillRow, "span");
    prefillLabel.textContent = "Pre-fill list from this folder";

    const includeRow = this.createElement(this.contentEl, "label", "booker-panel__modal-checkbox");
    const includeCheckbox = this.createElement(includeRow, "input");
    includeCheckbox.type = "checkbox";
    includeCheckbox.checked = false;
    this.includeSubfoldersCheckbox = includeCheckbox;
    const includeLabel = this.createElement(includeRow, "span");
    includeLabel.textContent = "Include subfolders";

    const buttonRow = this.createElement(this.contentEl, "div", "booker-panel__modal-actions");

    const cancelButton = this.createElement(buttonRow, "button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => this.complete(null));

    const submitButton = this.createElement(buttonRow, "button");
    submitButton.type = "button";
    submitButton.textContent = "Create";
    submitButton.addEventListener("click", () => this.complete(this.buildResult()));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.complete(this.buildResult());
      }
    });

    input.focus();
  }

  /**
   * Resolve with null when the modal is closed without submitting.
   */
  onClose(): void {
    if (!this.didSubmit) {
      this.complete(null);
      return;
    }
    this.clearElement(this.contentEl);
  }

  /**
   * Resolve the modal promise and close the modal.
   */
  private complete(value: FilenamePromptResult | null): void {
    if (this.resolvePromise) {
      this.didSubmit = true;
      const resolver = this.resolvePromise;
      this.resolvePromise = null;
      resolver(value);
      this.close();
    }
  }

  /**
   * Build the resolved modal result from current input values.
   */
  private buildResult(): FilenamePromptResult {
    return {
      filename: this.inputEl?.value ?? "",
      prefillFromFolder: this.prefillCheckbox?.checked ?? true,
      includeSubfolders: this.includeSubfoldersCheckbox?.checked ?? false
    };
  }

  /**
   * Clear all child nodes from an element.
   */
  private clearElement(element: HTMLElement): void {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Create and append a child element with optional class.
   */
  private createElement<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    className?: string
  ): HTMLElementTagNameMap[K] {
    const element = parent.ownerDocument.createElement(tag);
    if (className) {
      element.className = className;
    }
    parent.appendChild(element);
    return element;
  }
}
