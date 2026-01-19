import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { shiftHeadings } from "../src/services/MarkdownTransform";
import { FakeAppContext } from "./fakes/FakeAppContext";

const readFixture = (name: string): string =>
  readFileSync(join(__dirname, "fixtures", "heading-offset", name), "utf8");

describe("heading_offset defaults", () => {
  it("defaults to 1 when missing in frontmatter options", () => {
    const appContext = new FakeAppContext({ "Recipe.md": "" });
    const parser = new FrontmatterParser(appContext.metadataCache);

    const config = parser.parseRecipeConfig(
      {
        type: "booker-recipe",
        output: "dist/out.md",
        order: ["Chapter"]
      },
      { path: "Recipe.md", kind: "file" }
    );

    expect(config.options.heading_offset).toBe(1);
  });
});

describe("shiftHeadings", () => {
  it("shifts headings by the default offset", () => {
    const input = readFixture("basic.md");

    expect(shiftHeadings(input, 1)).toBe(
      "## Title\n### Subtitle\n\nNormal text with `#` inline."
    );
  });

  it("does not change headings when offset is 0", () => {
    const input = readFixture("basic.md");

    expect(shiftHeadings(input, 0)).toBe(input);
  });

  it("shifts headings by 2 levels", () => {
    const input = readFixture("basic.md");

    expect(shiftHeadings(input, 2)).toBe(
      "### Title\n#### Subtitle\n\nNormal text with `#` inline."
    );
  });

  it("clamps headings at level 6", () => {
    const input = readFixture("clamp.md");

    expect(shiftHeadings(input, 2)).toBe("###### Max\n###### Five");
  });

  it("does not modify headings inside fenced code blocks", () => {
    const input = readFixture("fenced.md");

    expect(shiftHeadings(input, 1)).toBe("## Outside\n```md\n# Inside\n```\n## After");
  });
});
