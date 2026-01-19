import { describe, expect, it } from "vitest";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { FakeAppContext } from "./fakes/FakeAppContext";

describe("FrontmatterParser.normalizeType", () => {
  const parser = new FrontmatterParser(new FakeAppContext().metadataCache);

  it("normalizes canonical recipe and bundle types", () => {
    expect(parser.normalizeType("booker-recipe")).toEqual({ normalized: "booker-recipe", deprecated: false });
    expect(parser.normalizeType("booker-bundle")).toEqual({ normalized: "booker-bundle", deprecated: false });
  });

  it("normalizes deprecated aliases and flags them", () => {
    expect(parser.normalizeType("booker")).toEqual({ normalized: "booker-recipe", deprecated: true });
    expect(parser.normalizeType("booker-build")).toEqual({ normalized: "booker-bundle", deprecated: true });
  });
});

describe("FrontmatterParser schema precedence", () => {
  const parser = new FrontmatterParser(new FakeAppContext().metadataCache);

  it("prefers prefixed options over nested values", () => {
    const config = parser.parseRecipeConfig(
      {
        type: "booker-recipe",
        output: "dist/out.md",
        order: ["Chapter"],
        recipe_strip_h1: true,
        options: { strip_h1: false }
      },
      { path: "Recipe.md", kind: "file" }
    );

    expect(config.options.strip_h1).toBe(true);
  });

  it("parses nested options and reports deprecation metadata", () => {
    const frontmatter = {
      type: "booker-recipe",
      output: "dist/out.md",
      order: ["Chapter"],
      options: { strip_frontmatter: false, strip_h1: true }
    };
    const warnings = parser.getDeprecationWarnings(frontmatter, "booker-recipe", "options:\n  strip_h1: true\n");

    expect(parser.parseRecipeConfig(frontmatter, { path: "Recipe.md", kind: "file" }).options.strip_h1).toBe(true);
    expect(warnings[0]?.category).toBe("Deprecated recipe schema");
    expect(warnings[0]?.keys).toContain("options.strip_h1");
  });

  it("parses unprefixed options and reports deprecation metadata", () => {
    const frontmatter = {
      type: "booker-recipe",
      output: "dist/out.md",
      order: ["Chapter"],
      strip_title: true
    };
    const warnings = parser.getDeprecationWarnings(frontmatter, "booker-recipe", "strip_title: true\n");

    expect(parser.parseRecipeConfig(frontmatter, { path: "Recipe.md", kind: "file" }).options.strip_title).toBe(true);
    expect(warnings[0]?.category).toBe("Deprecated unprefixed keys");
    expect(warnings[0]?.keys).toContain("strip_title");
  });

  it("applies default TOC options when missing", () => {
    const config = parser.parseRecipeConfig(
      {
        type: "booker-recipe",
        output: "dist/out.md",
        order: ["Chapter"]
      },
      { path: "Recipe.md", kind: "file" }
    );

    expect(config.options.toc).toBe(false);
    expect(config.options.toc_title).toBe("Table of Contents");
    expect(config.options.toc_depth).toBe(4);
    expect(config.options.toc_include_h1).toBe(true);
  });
});
