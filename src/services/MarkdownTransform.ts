import { BookerOptions } from "../domain/types";

export class MarkdownTransform {
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

  joinChunks(chunks: string[], separator: string): string {
    return chunks.join(separator);
  }
}
