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

    this.registerMarkdownPostProcessor((el, ctx) => {
      inspector.render(el, ctx.sourcePath);
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
    file: TAbstractFile,
    fileCreator: BookerFileCreator
  ): void {
    const target = this.toFileRef(file);
    const subMenu = new Menu();
    let usedSubmenu = false;

    menu.addItem((item) => {
      item.setTitle("Booker");
      const withSubmenu = item as unknown as { setSubmenu?: (menu: Menu) => void };
      if (withSubmenu.setSubmenu) {
        withSubmenu.setSubmenu(subMenu);
        usedSubmenu = true;
      }
    });

    const targetMenu = usedSubmenu ? subMenu : menu;
    targetMenu.addItem((item) => {
      item.setTitle("New recipe");
      item.onClick(() => {
        void fileCreator.createRecipe(target);
      });
    });
    targetMenu.addItem((item) => {
      item.setTitle("New bundle");
      item.onClick(() => {
        void fileCreator.createBundle(target);
      });
    });
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
