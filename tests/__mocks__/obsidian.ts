export class WorkspaceLeaf {
  view: unknown = null;
  containerEl: HTMLElement;

  constructor(containerEl?: HTMLElement) {
    this.containerEl = containerEl ?? document.createElement("div");
  }
}

export class Workspace {
  getLeaf(): WorkspaceLeaf {
    return new WorkspaceLeaf();
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
  vault: unknown;
  metadataCache: unknown;
  workspace: unknown;

  constructor(workspace: unknown = {}, vault: unknown = {}, metadataCache: unknown = {}) {
    this.workspace = workspace;
    this.vault = vault;
    this.metadataCache = metadataCache;
  }
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
export class TFile {
  constructor(public path = "", public parent: TFolder | null = null) {}
}
export class TFolder {
  constructor(public path = "") {}
}

export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}
