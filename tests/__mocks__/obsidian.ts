export class WorkspaceLeaf {
  view: unknown = null;
  containerEl: HTMLElement;

  constructor(containerEl?: HTMLElement) {
    this.containerEl = containerEl ?? document.createElement("div");
  }
}

export class ItemView {
  contentEl: HTMLElement;

  constructor(public leaf: WorkspaceLeaf) {
    this.contentEl = leaf.containerEl;
  }

  getViewType(): string {
    return "mock-view";
  }

  getDisplayText(): string {
    return "Mock View";
  }

  async onOpen(): Promise<void> {
    return;
  }

  async onClose(): Promise<void> {
    return;
  }
}

export class App {
  constructor(public workspace: unknown = {}) {}
}

export class Modal {
  contentEl: HTMLElement;

  constructor(public app: App) {
    this.contentEl = document.createElement("div");
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onOpen(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onClose(): void {}
}

export class Menu {}
export class Plugin {}
export class TFile {}
export class TFolder {}
