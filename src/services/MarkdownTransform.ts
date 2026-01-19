import { BookerOptions } from "../domain/types";

const MAX_HEADING_LEVEL = 6;

/**
 * Shift Markdown heading levels by the provided offset.
 *
 * @param markdown - Raw Markdown content.
 * @param offset - Heading level shift to apply.
 * @returns Updated Markdown content.
 */
export const shiftHeadings = (markdown: string, offset: number): string => {
  if (offset <= 0) {
    return markdown;
  }

  const lines = markdown.split("\n");
  let inFence = false;
  let fenceMarker: string | undefined;

  const shifted = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker && line.trimStart().startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = undefined;
      }
      return line;
    }

    if (inFence) {
      return line;
    }

    const headingMatch = line.match(/^(#{1,6})(\s+.*)$/);
    if (!headingMatch) {
      return line;
    }

    const level = headingMatch[1]?.length ?? 0;
    const adjusted = Math.min(level + offset, MAX_HEADING_LEVEL);
    const headingSuffix = headingMatch[2] ?? "";
    return `${"#".repeat(adjusted)}${headingSuffix}`;
  });

  return shifted.join("\n");
};

/**
 * Applies Booker-specific Markdown transformations.
 */
export class MarkdownTransform {
  /**
   * Strip a YAML frontmatter block from the start of content.
   *
   * @param content - Markdown content that may include frontmatter.
   * @returns Markdown content without the frontmatter block.
   */
  stripFrontmatter(content: string): string {
    if (!content.startsWith("---")) {
      return content;
    }
    const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
    if (!match) {
      return content;
    }
    return content.slice(match[0].length);
  }

  /**
   * Remove the first H1 heading in the content, if present.
   *
   * @param content - Markdown content to adjust.
   * @returns Updated Markdown content.
   */
  stripFirstH1(content: string): string {
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

  /**
   * Apply configured content transforms such as frontmatter or H1 stripping.
   *
   * @param content - Markdown content to transform.
   * @param options - Booker options controlling the transforms.
   * @returns Updated Markdown content.
   */
  apply(content: string, options: BookerOptions): string {
    let output = content;
    if (options.strip_frontmatter) {
      output = this.stripFrontmatter(output);
    }
    if (options.strip_h1) {
      output = this.stripFirstH1(output);
    }
    return output;
  }

  /**
   * Apply the configured heading offset to Markdown content.
   */
  applyHeadingOffset(content: string, options: BookerOptions): string {
    const offset = options.heading_offset ?? 1;
    return shiftHeadings(content, offset);
  }

  /**
   * Join content chunks with the provided separator.
   *
   * @param chunks - Array of Markdown content chunks.
   * @param separator - Separator string to insert between chunks.
   * @returns Joined content string.
   */
  joinChunks(chunks: string[], separator: string): string {
    return chunks.join(separator);
  }
}
