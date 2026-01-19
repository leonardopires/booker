import { App, TFile, Workspace } from "obsidian";
import { FilenameModal } from "../adapters/FilenameModal";
import { ObsidianAppContext } from "../adapters/ObsidianAppContext";
import { BookerFileCreator } from "../services/BookerFileCreator";
import { BookerPanelModelBuilder } from "../services/BookerPanelModelBuilder";
import { BuildRunner } from "../services/BuildRunner";
import { Compiler } from "../services/Compiler";
import { FrontmatterParser } from "../services/FrontmatterParser";
import { LinkResolver } from "../services/LinkResolver";
import { MarkdownTransform } from "../services/MarkdownTransform";
import { TableOfContentsBuilder } from "../services/TableOfContentsBuilder";
import { UserMessagePresenter } from "../services/UserMessagePresenter";
import { VaultIO } from "../services/VaultIO";
import { FileRef, IMetadataCache, IVault } from "../ports/IAppContext";
import { FilenamePromptResult } from "../ports/PromptTypes";

type PromptFunction = (message: string, defaultValue?: string) => Promise<FilenamePromptResult | null>;
type OpenFileFunction = (file: FileRef) => void;

/**
 * Booker application context that wires all services from the Obsidian App.
 */
export class BookerContext {
  readonly app: App;
  readonly vault: IVault;
  readonly metadataCache: IMetadataCache;
  readonly workspace: Workspace;
  readonly presenter: UserMessagePresenter;
  readonly linkResolver: LinkResolver;
  readonly parser: FrontmatterParser;
  readonly markdownTransform: MarkdownTransform;
  readonly tocBuilder: TableOfContentsBuilder;
  readonly vaultIO: VaultIO;
  readonly compiler: Compiler;
  readonly buildRunner: BuildRunner;
  readonly fileCreator: BookerFileCreator;
  readonly panelModelBuilder: BookerPanelModelBuilder;

  constructor(app: App) {
    const appContext = new ObsidianAppContext(app);
    this.app = app;
    this.vault = appContext.vault;
    this.metadataCache = appContext.metadataCache;
    this.workspace = app.workspace;

    this.presenter = new UserMessagePresenter(appContext.notice);
    this.linkResolver = new LinkResolver(this.metadataCache);
    this.parser = new FrontmatterParser(this.metadataCache);
    this.markdownTransform = new MarkdownTransform();
    this.tocBuilder = new TableOfContentsBuilder();
    this.vaultIO = new VaultIO(this.vault);
    this.compiler = new Compiler({
      linkResolver: this.linkResolver,
      vaultIO: this.vaultIO,
      markdownTransform: this.markdownTransform,
      tocBuilder: this.tocBuilder
    });
    this.buildRunner = new BuildRunner({
      compiler: this.compiler,
      parser: this.parser,
      linkResolver: this.linkResolver,
      presenter: this.presenter,
      vault: this.vault
    });

    const prompt: PromptFunction = (message, defaultValue) =>
      new FilenameModal(app, message, defaultValue).openAndGetValue();
    const openFile: OpenFileFunction = (file) => {
      const resolved = app.vault.getAbstractFileByPath(file.path);
      if (resolved instanceof TFile) {
        void app.workspace.getLeaf(false).openFile(resolved);
      }
    };

    this.fileCreator = new BookerFileCreator({
      vault: this.vault,
      presenter: this.presenter,
      parser: this.parser,
      prompt,
      openFile
    });
    this.panelModelBuilder = new BookerPanelModelBuilder({
      vault: this.vault,
      metadataCache: this.metadataCache,
      parser: this.parser,
      linkResolver: this.linkResolver
    });
  }

  /**
   * Open a generated output path in the workspace.
   *
   * @param path - Vault path to open.
   * @returns Whether the file was opened successfully.
   */
  openOutput(path: string): boolean {
    const resolved = this.app.vault.getAbstractFileByPath(path);
    if (resolved instanceof TFile) {
      void this.app.workspace.getLeaf(false).openFile(resolved);
      return true;
    }
    return false;
  }
}
