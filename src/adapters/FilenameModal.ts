import { App, Modal } from "obsidian";

/**
 * Modal prompt that asks the user for a filename and resolves with the input value.
 */
export class FilenameModal extends Modal {
  private resolvePromise: ((value: string | null) => void) | null = null;
  private inputEl: HTMLInputElement | null = null;
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
   * @returns Promise that resolves to the provided filename or null.
   */
  openAndGetValue(): Promise<string | null> {
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

    const buttonRow = this.createElement(this.contentEl, "div", "booker-panel__modal-actions");

    const cancelButton = this.createElement(buttonRow, "button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => this.complete(null));

    const submitButton = this.createElement(buttonRow, "button");
    submitButton.type = "button";
    submitButton.textContent = "Create";
    submitButton.addEventListener("click", () => this.complete(this.inputEl?.value ?? ""));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.complete(this.inputEl?.value ?? "");
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
  private complete(value: string | null): void {
    if (this.resolvePromise) {
      this.didSubmit = true;
      const resolver = this.resolvePromise;
      this.resolvePromise = null;
      resolver(value);
      this.close();
    }
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
