import { Plugin } from "obsidian";
import { ObsidianAppContext, createFileRef } from "./adapters/ObsidianAppContext";
import { formatErrorForNotice } from "./domain/errors";
import { BuildOrchestrator } from "./services/BuildOrchestrator";
import { Compiler } from "./services/Compiler";
import { FrontmatterParser } from "./services/FrontmatterParser";
import { LinkResolver } from "./services/LinkResolver";
import { MarkdownTransform } from "./services/MarkdownTransform";
import { VaultIO } from "./services/VaultIO";

export default class BookerPlugin extends Plugin {
  async onload(): Promise<void> {
    const appContext = new ObsidianAppContext(this.app);
    const linkResolver = new LinkResolver(appContext.metadataCache);
    const parser = new FrontmatterParser(appContext.metadataCache, linkResolver);
    const markdownTransform = new MarkdownTransform();
    const vaultIO = new VaultIO(appContext.vault);
    const compiler = new Compiler(linkResolver, vaultIO, markdownTransform);
    const buildOrchestrator = new BuildOrchestrator(compiler, appContext.notice);

    this.addCommand({
      id: "booker-compile-from-yaml",
      name: "Booker: Compile from YAML",
      callback: () => {
        void this.compileFromYaml(parser, compiler, appContext);
      }
    });

    this.addCommand({
      id: "booker-build-from-buildfile",
      name: "Booker: Build from buildfile",
      callback: () => {
        void this.buildFromBuildfile(parser, buildOrchestrator, appContext);
      }
    });
  }

  private async compileFromYaml(
    parser: FrontmatterParser,
    compiler: Compiler,
    appContext: ObsidianAppContext
  ): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      appContext.notice.notify("Booker: No active file.");
      return;
    }

    try {
      const fileRef = createFileRef(activeFile);
      const projectConfig = parser.parseBookerProject(fileRef);
      const compileResult = await compiler.compile(projectConfig, activeFile.path);

      if (compileResult.resolvedCount === 0) {
        appContext.notice.notify("Booker: No valid files resolved from order list.");
        if (compileResult.missingLinks.length > 0) {
          console.warn("Booker: Missing files:", compileResult.missingLinks);
        }
        if (compileResult.skippedSelfIncludes.length > 0) {
          console.warn("Booker: Skipped self-inclusion:", compileResult.skippedSelfIncludes);
        }
        return;
      }

      await compiler.writeOutput(projectConfig.outputPath, compileResult.content);

      if (compileResult.missingLinks.length > 0) {
        appContext.notice.notify(
          `Booker: Compiled with ${compileResult.missingLinks.length} missing file(s). See console.`
        );
        console.warn("Booker: Missing files:", compileResult.missingLinks);
      } else if (compileResult.skippedSelfIncludes.length > 0) {
        appContext.notice.notify("Booker: Compiled (self-inclusion skipped).");
        console.warn("Booker: Skipped self-inclusion:", compileResult.skippedSelfIncludes);
      } else {
        appContext.notice.notify(`Booker: Compiled to ${projectConfig.outputPath}`);
      }
    } catch (error) {
      appContext.notice.notify(formatErrorForNotice(error));
    }
  }

  private async buildFromBuildfile(
    parser: FrontmatterParser,
    buildOrchestrator: BuildOrchestrator,
    appContext: ObsidianAppContext
  ): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      appContext.notice.notify("Booker: No active file.");
      return;
    }

    try {
      const fileRef = createFileRef(activeFile);
      const buildfileConfig = parser.parseBuildfile(fileRef);
      await buildOrchestrator.runBuildfile(buildfileConfig, activeFile.path);
    } catch (error) {
      appContext.notice.notify(formatErrorForNotice(error));
    }
  }
}
