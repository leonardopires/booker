import { BookerOptions, HeadingEntry } from "../domain/types";

const LIST_INDENT = "  ";

/**
 * Builds and injects nested Markdown tables of contents.
 */
export class TableOfContentsBuilder {
  /**
   * Render a nested Markdown table of contents with Obsidian heading links.
   */
  render(headings: HeadingEntry[], options: BookerOptions): string {
    if (!options.toc) {
      return "";
    }

    const filtered = headings.filter((heading) => {
      if (!options.toc_include_h1 && heading.level === 1) {
        return false;
      }
      return heading.level <= options.toc_depth;
    });

    const listLines = filtered.map((heading) => {
      const indent = LIST_INDENT.repeat(Math.max(heading.level - 1, 0));
      return `${indent}- [[#${heading.text}]]`;
    });

    const listBlock = listLines.join("\n");
    const title = options.toc_title ?? "Table of Contents";

    if (title === "") {
      return listBlock;
    }

    if (!listBlock) {
      return `# ${title}`;
    }

    return `# ${title}\n\n${listBlock}`;
  }

  /**
   * Insert a rendered table of contents into content, optionally after the document title.
   */
  apply(
    content: string,
    headings: HeadingEntry[],
    options: BookerOptions,
    insertAfterTitle: boolean
  ): string {
    const tocBlock = this.render(headings, options);
    if (!tocBlock) {
      return content;
    }

    const trimmedContent = content.trimEnd();
    const tocLines = tocBlock.split("\n");

    if (insertAfterTitle) {
      const lines = trimmedContent.split("\n");
      if (lines[0]?.startsWith("# ")) {
        const insertIndex = lines[1] === "" ? 2 : 1;
        lines.splice(insertIndex, 0, ...tocLines, "");
        return `${lines.join("\n")}\n`;
      }
    }

    return `${tocBlock}\n\n${trimmedContent}`.trimEnd() + "\n";
  }
}
