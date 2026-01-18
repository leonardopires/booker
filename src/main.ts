import { Notice, Plugin } from "obsidian";
import { buildFromBuildfile } from "./build";
import { compileProject, writeCompiledOutput } from "./compiler";
import { formatErrorForNotice } from "./errors";
import { parseBookerProject, parseBuildfile } from "./yaml";

export default class BookerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "booker-compile-from-yaml",
      name: "Booker: Compile from YAML",
      callback: () => {
        void this.compileFromYaml();
      }
    });

    this.addCommand({
      id: "booker-build-from-buildfile",
      name: "Booker: Build from buildfile",
      callback: () => {
        void this.buildFromBuildfile();
      }
    });
  }

  private async compileFromYaml(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Booker: No active file.");
      return;
    }

    try {
      const projectConfig = parseBookerProject(this.app, activeFile);
      const compileResult = await compileProject(this.app, projectConfig, activeFile.path);

      if (compileResult.resolvedCount === 0) {
        new Notice("Booker: No valid files resolved from order list.");
        if (compileResult.missingLinks.length > 0) {
          console.warn("Booker: Missing files:", compileResult.missingLinks);
        }
        if (compileResult.skippedSelfIncludes.length > 0) {
          console.warn("Booker: Skipped self-inclusion:", compileResult.skippedSelfIncludes);
        }
        return;
      }

      await writeCompiledOutput(this.app, projectConfig.outputPath, compileResult.content);

      if (compileResult.missingLinks.length > 0) {
        new Notice(`Booker: Compiled with ${compileResult.missingLinks.length} missing file(s). See console.`);
        console.warn("Booker: Missing files:", compileResult.missingLinks);
      } else if (compileResult.skippedSelfIncludes.length > 0) {
        new Notice("Booker: Compiled (self-inclusion skipped).");
        console.warn("Booker: Skipped self-inclusion:", compileResult.skippedSelfIncludes);
      } else {
        new Notice(`Booker: Compiled to ${projectConfig.outputPath}`);
      }
    } catch (error) {
      new Notice(formatErrorForNotice(error));
    }
  }

  private async buildFromBuildfile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Booker: No active file.");
      return;
    }

    try {
      const buildfileConfig = parseBuildfile(this.app, activeFile);
      await buildFromBuildfile(this.app, buildfileConfig, activeFile.path);
    } catch (error) {
      new Notice(formatErrorForNotice(error));
    }
  }
}
