import { Menu, Plugin, TAbstractFile, TFile, TFolder, addIcon } from "obsidian";
import { BookerPanelView, VIEW_TYPE_BOOKER_PANEL } from "./adapters/BookerPanelView";
import { createFileRef } from "./adapters/ObsidianAppContext";
import { BookerContext } from "./app/BookerContext";
import { BookerFileCreator } from "./services/BookerFileCreator";
import { BuildRunner } from "./services/BuildRunner";
import { UserMessagePresenter } from "./services/UserMessagePresenter";

const BOOKER_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     stroke-width="2"
     stroke-linecap="round"
     stroke-linejoin="round">
  <path d="M12 2 2 7l10 5 10-5-10-5z"/>
  <path d="M2 17l10 5 10-5"/>
  <path d="M2 12l10 5 10-5"/>
</svg>
`;

const BOOKER_ICON_ID = "lp-booker";

/**
 * Obsidian plugin entry point for Booker.
 */
export default class BookerPlugin extends Plugin {
  /**
   * Initialize Booker services, views, and commands on plugin load.
   */
  onload(): void {
    const context = new BookerContext(this.app);
    const presenter = context.presenter;
    const buildRunner = context.buildRunner;
    const fileCreator = context.fileCreator;

    this.registerView(
      VIEW_TYPE_BOOKER_PANEL,
      (leaf) =>
        new BookerPanelView(
          leaf,
          context.panelModelBuilder,
          (file) => buildRunner.buildCurrentFile(file),
          (path) => context.openOutput(path),
          presenter
        )
    );

    this.addCommand({
      id: "booker-build-current-file",
      name: "Generate current note",
      callback: () => {
        void this.buildCurrentFile(buildRunner, presenter);
      }
    });
    this.addCommand({
      id: "booker-toggle-panel",
      name: "Toggle panel",
      callback: () => {
        void this.togglePanel();
      }
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.addBookerContextMenu(menu, file, fileCreator);
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshPanelViews();
      })
    );

    addIcon(BOOKER_ICON_ID, BOOKER_ICON_SVG);

    this.addRibbonIcon(
      BOOKER_ICON_ID, // lucide icon name
      "Toggle Booker panel",
      () => {
        void this.togglePanel();
      }
    );
  }

  private async buildCurrentFile(
    buildRunner: BuildRunner,
    presenter: UserMessagePresenter
  ): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      presenter.showInfo("No active file to generate.");
      return;
    }

    const fileRef = createFileRef(activeFile);
    await buildRunner.buildCurrentFile(fileRef);
  }

  private addBookerContextMenu(
    menu: Menu,
    file: TAbstractFile | null,
    fileCreator: BookerFileCreator
  ): void {
    const target = this.getTargetRef(file);
  
    menu.addItem((item) => {
      item.setTitle("Booker");

      const anyItem = item as { setSubmenu?: () => Menu; submenu?: Menu };
      const sub = typeof anyItem.setSubmenu === "function"
        ? anyItem.setSubmenu()
        : (anyItem.submenu ?? null);
  
      const m = sub ?? menu;
  
      m.addItem((i) => {
        i.setTitle("New recipe");
        i.onClick(() => void fileCreator.createRecipe(target));
      });
  
      m.addItem((i) => {
        i.setTitle("New bundle");
        i.onClick(() => void fileCreator.createBundle(target));
      });
    });
  }
  
  /**
   * Resolve the target folder reference for context menu actions.
   */
  private getTargetRef(file: TAbstractFile | null): { path: string; kind: "file" | "folder" } {
    if (!file) {
      const root = this.app.vault.getRoot();
      return { path: root.path, kind: "folder" };
    }
    if (file instanceof TFolder) {
      return { path: file.path, kind: "folder" };
    }
    if (file instanceof TFile) {
      const parent = file.parent ?? this.app.vault.getRoot();
      return { path: parent.path, kind: "folder" };
    }
    const root = this.app.vault.getRoot();
    return { path: root.path, kind: "folder" };
  }

  /**
   * Toggle the Booker panel in the right sidebar.
   */
  private async togglePanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_BOOKER_PANEL);
    const [openLeaf] = existing;
    if (openLeaf) {
      void this.app.workspace.revealLeaf(openLeaf);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_BOOKER_PANEL, active: true });
    void this.app.workspace.revealLeaf(leaf);
    this.refreshPanelViews();
  }

  /**
   * Refresh all open Booker panel views with the current active file.
   */
  private refreshPanelViews(): void {
    const activeFile = this.app.workspace.getActiveFile();
    const fileRef = activeFile ? createFileRef(activeFile) : null;
    this.app.workspace.getLeavesOfType(VIEW_TYPE_BOOKER_PANEL).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof BookerPanelView) {
        view.setActiveFile(fileRef);
      }
    });
  }
}
