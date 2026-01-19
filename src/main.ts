import { Menu, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import { BookerPanelView, VIEW_TYPE_BOOKER_PANEL } from "./adapters/BookerPanelView";
import { FilenameModal } from "./adapters/FilenameModal";
import { ObsidianAppContext, createFileRef } from "./adapters/ObsidianAppContext";
import { BookerFileCreator } from "./services/BookerFileCreator";
import { BuildRunner } from "./services/BuildRunner";
import { BookerPanelModelBuilder } from "./services/BookerPanelModelBuilder";
import { Compiler } from "./services/Compiler";
import { FrontmatterParser } from "./services/FrontmatterParser";
import { LinkResolver } from "./services/LinkResolver";
import { MarkdownTransform } from "./services/MarkdownTransform";
import { UserMessagePresenter } from "./services/UserMessagePresenter";
import { VaultIO } from "./services/VaultIO";

export default class BookerPlugin extends Plugin {
  async onload(): Promise<void> {
    const appContext = new ObsidianAppContext(this.app);
    const linkResolver = new LinkResolver(appContext.metadataCache);
    const parser = new FrontmatterParser(appContext.metadataCache);
    const markdownTransform = new MarkdownTransform();
    const vaultIO = new VaultIO(appContext.vault);
    const compiler = new Compiler(linkResolver, vaultIO, markdownTransform);
    const presenter = new UserMessagePresenter(appContext.notice);
    const buildRunner = new BuildRunner(compiler, parser, linkResolver, presenter);
    const fileCreator = new BookerFileCreator(
      appContext.vault,
      presenter,
      (message, defaultValue) => new FilenameModal(this.app, message, defaultValue).openAndGetValue(),
      (file) => this.openFile(file.path)
    );
    const panelModelBuilder = new BookerPanelModelBuilder(
      appContext.vault,
      appContext.metadataCache,
      parser,
      linkResolver
    );
    const openOutput = (path: string): boolean => {
      const resolved = this.app.vault.getAbstractFileByPath(path);
      if (resolved instanceof TFile) {
        void this.app.workspace.getLeaf(false).openFile(resolved);
        return true;
      }
      return false;
    };

    this.registerView(
      VIEW_TYPE_BOOKER_PANEL,
      (leaf) =>
        new BookerPanelView(
          leaf,
          panelModelBuilder,
          (file) => buildRunner.buildCurrentFile(file),
          openOutput,
          presenter
        )
    );

    this.addCommand({
      id: "booker-build-current-file",
      name: "Booker: Generate current file",
      callback: () => {
        void this.buildCurrentFile(buildRunner, presenter);
      }
    });
    this.addCommand({
      id: "booker-toggle-panel",
      name: "Booker: Toggle panel",
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
  
      const anyItem = item as unknown as { setSubmenu?: () => Menu; submenu?: Menu };
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

  private openFile(path: string): void {
    const resolved = this.app.vault.getAbstractFileByPath(path);
    if (resolved instanceof TFile) {
      void this.app.workspace.getLeaf(false).openFile(resolved);
    }
  }

  /**
   * Toggle the Booker panel in the right sidebar.
   */
  private async togglePanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_BOOKER_PANEL);
    const [openLeaf] = existing;
    if (openLeaf) {
      this.app.workspace.revealLeaf(openLeaf);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_BOOKER_PANEL, active: true });
    this.app.workspace.revealLeaf(leaf);
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
