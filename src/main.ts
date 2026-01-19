import { Menu, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import { ObsidianAppContext, createFileRef } from "./adapters/ObsidianAppContext";
import { BookerFileCreator } from "./services/BookerFileCreator";
import { BookerInspector } from "./services/BookerInspector";
import { BuildRunner } from "./services/BuildRunner";
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
      (message) => window.prompt(message),
      (file) => this.openFile(file.path)
    );
    const inspector = new BookerInspector(
      appContext.vault,
      appContext.metadataCache,
      parser,
      linkResolver,
      (file) => buildRunner.buildCurrentFile(file),
      (path) => this.openFile(path)
    );

    this.addCommand({
      id: "booker-build-current-file",
      name: "Booker: Generate current file",
      callback: () => {
        void this.buildCurrentFile(buildRunner, presenter);
      }
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.addBookerContextMenu(menu, file, fileCreator);
      })
    );
    presenter.showInfo("Registering markdown processor 1");

    this.registerMarkdownPostProcessor((el, ctx) => {
      presenter.showInfo("Registering markdown processor 2");
      const sourcePath = ctx.sourcePath || this.app.workspace.getActiveFile()?.path;
      if (!sourcePath) {
        presenter.showWarning("Booker: unable to retrieve current source path.");
        return;
      }
      try {

        const viewRoot =
          el.closest(".markdown-source-view") ??
          el.closest(".markdown-reading-view") ??
          el.closest(".markdown-preview-view");
      
        // Reading view container (preview)
        const previewHost = viewRoot?.querySelector(".markdown-preview-sizer");
      
        // Live preview container (CM6)
        const liveHost = viewRoot?.querySelector(".cm-content");
      
        const host = (previewHost ?? liveHost) as HTMLElement | null;
        if (!host) {
          presenter.showError("Booker: Host not found");
          return;
        }
        inspector.render(host, sourcePath);
      } catch (e: any) {
        presenter.showError(e.toString());
      }
    });
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
    const folder = this.getTargetFolder(file);
  
    menu.addItem((item) => {
      item.setTitle("Booker");
  
      const anyItem = item as unknown as { setSubmenu?: () => Menu; submenu?: Menu };
      const sub = typeof anyItem.setSubmenu === "function"
        ? anyItem.setSubmenu()
        : (anyItem.submenu ?? null);
  
      const m = sub ?? menu;
  
      m.addItem((i) => {
        i.setTitle("New recipe");
        i.onClick(() => void fileCreator.createRecipe(folder));
      });
  
      m.addItem((i) => {
        i.setTitle("New bundle");
        i.onClick(() => void fileCreator.createBundle(folder));
      });
    });
  }
  
  private getTargetFolder(file: TAbstractFile | null): TFolder {
    if (!file) return this.app.vault.getRoot();
    if (file instanceof TFolder) return file;
    if (file instanceof TFile) return file.parent ?? this.app.vault.getRoot();
    return this.app.vault.getRoot();
  }

  private openFile(path: string): void {
    const resolved = this.app.vault.getAbstractFileByPath(path);
    if (resolved instanceof TFile) {
      void this.app.workspace.getLeaf(false).openFile(resolved);
    }
  }

  private toFileRef(file: TAbstractFile): { path: string; kind: "file" | "folder" } {
    if (file instanceof TFolder) {
      return { path: file.path, kind: "folder" };
    }
    return { path: file.path, kind: "file" };
  }
}
