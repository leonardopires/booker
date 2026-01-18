import { App, Notice, Plugin, TFile, normalizePath } from "obsidian";

type BookerOptions = {
  strip_frontmatter: boolean;
  strip_h1: boolean;
  separator: string;
};

type BookerFrontmatter = {
  type?: string;
  title?: string;
  output?: string;
  order?: string[];
  options?: Partial<BookerOptions>;
};

const DEFAULT_OPTIONS: BookerOptions = {
  strip_frontmatter: true,
  strip_h1: false,
  separator: "\n\n---\n\n"
};

function isBookerProject(frontmatter: BookerFrontmatter | null): frontmatter is BookerFrontmatter {
  return !!frontmatter && frontmatter.type === "booker";
}

function parseOrderItem(item: string): string {
  const trimmed = item.trim();
  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const inner = trimmed.slice(2, -2);
    const [target] = inner.split("|");
    return target.trim();
  }
  return trimmed;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
  if (!match) {
    return content;
  }
  return content.slice(match[0].length);
}

function stripFirstH1(content: string): string {
  const lines = content.split("\n");
  const h1Index = lines.findIndex((line) => line.startsWith("# "));
  if (h1Index === -1) {
    return content;
  }
  const nextIndex = h1Index + 1;
  if (lines[nextIndex] === "") {
    lines.splice(h1Index, 2);
  } else {
    lines.splice(h1Index, 1);
  }
  return lines.join("\n");
}

async function ensureFolderForPath(app: App, outputPath: string): Promise<void> {
  const lastSlash = outputPath.lastIndexOf("/");
  if (lastSlash === -1) {
    return;
  }
  const folderPath = outputPath.slice(0, lastSlash);
  if (!folderPath) {
    return;
  }
  const existing = app.vault.getAbstractFileByPath(folderPath);
  if (!existing) {
    await app.vault.createFolder(folderPath);
  }
}

export default class BookerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "booker-compile-from-yaml",
      name: "Booker: Compile from YAML",
      callback: () => {
        void this.compileFromYaml();
      }
    });
  }

  private async compileFromYaml(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Booker: No active file.");
      return;
    }

    const cache = this.app.metadataCache.getFileCache(activeFile);
    const frontmatter = (cache?.frontmatter ?? null) as BookerFrontmatter | null;

    if (!isBookerProject(frontmatter)) {
      new Notice("Booker: Active file is missing frontmatter type: booker.");
      return;
    }

    if (!frontmatter.output) {
      new Notice("Booker: Missing required frontmatter key: output.");
      return;
    }

    if (!frontmatter.order || !Array.isArray(frontmatter.order) || frontmatter.order.length === 0) {
      new Notice("Booker: Missing required frontmatter key: order.");
      return;
    }

    const options: BookerOptions = {
      ...DEFAULT_OPTIONS,
      ...(frontmatter.options ?? {})
    };

    const outputPath = normalizePath(frontmatter.output);
    const resolvedFiles: TFile[] = [];
    const missing: string[] = [];
    const skippedSelf: string[] = [];

    for (const item of frontmatter.order) {
      if (typeof item !== "string") {
        continue;
      }
      const linkpath = parseOrderItem(item);
      const resolved = this.app.metadataCache.getFirstLinkpathDest(linkpath, activeFile.path);
      if (!resolved) {
        missing.push(linkpath);
        continue;
      }
      const resolvedPath = normalizePath(resolved.path);
      if (resolvedPath === outputPath) {
        skippedSelf.push(resolvedPath);
        continue;
      }
      resolvedFiles.push(resolved);
    }

    if (resolvedFiles.length === 0) {
      new Notice("Booker: No valid files resolved from order list.");
      if (missing.length > 0) {
        console.warn("Booker: Missing files:", missing);
      }
      if (skippedSelf.length > 0) {
        console.warn("Booker: Skipped self-inclusion:", skippedSelf);
      }
      return;
    }

    const pieces: string[] = [];
    const outFile = this.app.vault.getAbstractFileByPath(outputPath);

    for (const file of resolvedFiles) {
      if (outFile instanceof TFile && file.path === outFile.path) {
        console.warn("Booker: Skipping output file to avoid recursion:", file.path);
        continue;
      }
      let content = await this.app.vault.read(file);
      if (options.strip_frontmatter) {
        content = stripFrontmatter(content);
      }
      if (options.strip_h1) {
        content = stripFirstH1(content);
      }
      pieces.push(content.trim());
    }

    const titlePrefix = frontmatter.title ? `# ${frontmatter.title}\n\n` : "";
    const compiled = `${titlePrefix}${pieces.join(options.separator)}`.trimEnd() + "\n";

    await ensureFolderForPath(this.app, outputPath);

    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, compiled);
    } else {
      await this.app.vault.create(outputPath, compiled);
    }

    if (missing.length > 0) {
      new Notice(`Booker: Compiled with ${missing.length} missing file(s). See console.`);
      console.warn("Booker: Missing files:", missing);
    } else if (skippedSelf.length > 0) {
      new Notice("Booker: Compiled (self-inclusion skipped).");
      console.warn("Booker: Skipped self-inclusion:", skippedSelf);
    } else {
      new Notice(`Booker: Compiled to ${outputPath}`);
    }
  }
}
