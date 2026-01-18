import { Plugin } from "obsidian";
import { ObsidianAppContext, createFileRef } from "./adapters/ObsidianAppContext";
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

    this.addCommand({
      id: "booker-build-current-file",
      name: "Booker: Build current file",
      callback: () => {
        void this.buildCurrentFile(buildRunner, presenter);
      }
    });
  }

  private async buildCurrentFile(
    buildRunner: BuildRunner,
    presenter: UserMessagePresenter
  ): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      presenter.showInfo("No active file to build.");
      return;
    }

    const fileRef = createFileRef(activeFile);
    await buildRunner.buildCurrentFile(fileRef);
  }
}
