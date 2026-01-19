import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKER_OPTIONS } from "../src/domain/types";
import { MarkdownTransform } from "../src/services/MarkdownTransform";

const readFixture = (name: string): string =>
  readFileSync(join(__dirname, "fixtures", "markdown-transform", name), "utf8");

describe("MarkdownTransform.stripFrontmatter", () => {
  it("removes YAML frontmatter blocks when present", () => {
    const transform = new MarkdownTransform();
    const input = readFixture("frontmatter.md");

    expect(transform.stripFrontmatter(input)).toBe("# Title\nBody.\n");
  });
});

describe("MarkdownTransform.applyHeadingOffset", () => {
  it("shifts headings and clamps at H6 without touching code fences", () => {
    const transform = new MarkdownTransform();
    const input = readFixture("heading-offset.md");
    const options = { ...DEFAULT_BOOKER_OPTIONS, heading_offset: 2 };

    expect(transform.applyHeadingOffset(input, options)).toBe(
      "### Top\n```md\n# Inside\n```\n###### Max\n"
    );
  });
});
