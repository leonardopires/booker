import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKER_OPTIONS } from "../src/domain/types";
import { Compiler } from "../src/services/Compiler";
import { LinkResolver } from "../src/services/LinkResolver";
import { MarkdownTransform } from "../src/services/MarkdownTransform";
import { TableOfContentsBuilder } from "../src/services/TableOfContentsBuilder";
import { VaultIO } from "../src/services/VaultIO";
import { BuildRunner } from "../src/services/BuildRunner";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeAppContext } from "./fakes/FakeAppContext";

const setupCompiler = () => {
  const appContext = new FakeAppContext({});
  const linkResolver = new LinkResolver(appContext.metadataCache);
  const markdownTransform = new MarkdownTransform();
  const tocBuilder = new TableOfContentsBuilder();
  const vaultIO = new VaultIO(appContext.vault);
  return new Compiler({ linkResolver, vaultIO, markdownTransform, tocBuilder });
};

const setupRunner = (appContext: FakeAppContext) => {
  const linkResolver = new LinkResolver(appContext.metadataCache);
  const parser = new FrontmatterParser(appContext.metadataCache);
  const markdownTransform = new MarkdownTransform();
  const tocBuilder = new TableOfContentsBuilder();
  const vaultIO = new VaultIO(appContext.vault);
  const compiler = new Compiler({ linkResolver, vaultIO, markdownTransform, tocBuilder });
  const presenter = new UserMessagePresenter(appContext.notice);
  return new BuildRunner({ compiler, parser, linkResolver, presenter, vault: appContext.vault });
};

describe("Table of contents rendering", () => {
  it("does not render a TOC by default", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n## Section 1.1\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        title: "Book Title",
        outputPath: "dist/book.md",
        order: [],
        options: { ...DEFAULT_BOOKER_OPTIONS, strip_title: true, heading_offset: 0 }
      }
    );

    expect(content).not.toContain("Table of Contents");
  });

  it("renders the default TOC title after the book title", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n## Section 1.1\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        title: "Book Title",
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain(
      "# Book Title\n\n# Table of Contents\n\n- [[#Book Title]]\n- [[#Chapter 1]]"
    );
  });

  it("uses a custom TOC title when provided", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        title: "Book Title",
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          toc_title: "Contents",
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain("# Contents");
  });

  it("suppresses the TOC heading when the title is empty", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        title: "Book Title",
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          toc_title: "",
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain("# Book Title\n\n- [[#Book Title]]\n- [[#Chapter 1]]");
    expect(content).not.toContain("## ");
  });

  it("builds nested list indentation based on heading levels", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n## Section 1.1\n## Section 1.2\n# Chapter 2\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          toc_title: "",
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain(
      "- [[#Chapter 1]]\n  - [[#Section 1.1]]\n  - [[#Section 1.2]]\n- [[#Chapter 2]]"
    );
  });

  it("limits TOC depth and respects toc_include_h1", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Chapter 1\n## Section 1.1\n### Deep 1\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          toc_title: "",
          toc_depth: 2,
          toc_include_h1: false,
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain("  - [[#Section 1.1]]");
    expect(content).not.toContain("- [[#Chapter 1]]");
    expect(content).not.toContain("- [[#Deep 1]]");
  });

  it("ignores fenced headings when building the TOC", () => {
    const compiler = setupCompiler();
    const { content } = compiler.compileFromChunks(
      [
        {
          content: "# Visible\n```md\n# Hidden\n```\n## After\n",
          basename: "Chapter",
          sourcePath: "chapters/one.md"
        }
      ],
      {
        outputPath: "dist/book.md",
        order: [],
        options: {
          ...DEFAULT_BOOKER_OPTIONS,
          toc: true,
          toc_title: "",
          strip_title: true,
          heading_offset: 0
        }
      }
    );

    expect(content).toContain("- [[#Visible]]");
    expect(content).toContain("  - [[#After]]");
    expect(content).not.toContain("[[#Hidden]]");
  });
});

describe("Table of contents aggregation scope", () => {
  it("aggregates child headings when toc_scope is tree", async () => {
    const appContext = new FakeAppContext({
      "Parent.md": "",
      "Child.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# Alpha\nBody."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/recipe.md",
      order: ["chapters/One"],
      recipe_heading_offset: 0,
      recipe_strip_title: true
    });

    appContext.metadataCache.setFrontmatter("Child.md", {
      type: "booker-bundle",
      targets: ["Recipe"],
      aggregate_output: "dist/child.md",
      aggregate_heading_offset: 0,
      aggregate_strip_title: true
    });

    appContext.metadataCache.setFrontmatter("Parent.md", {
      type: "booker-bundle",
      targets: ["Child"],
      aggregate_output: "dist/parent.md",
      aggregate_toc: true,
      aggregate_toc_scope: "tree",
      aggregate_toc_title: "",
      aggregate_strip_h1: true,
      aggregate_strip_title: true,
      aggregate_heading_offset: 0
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Parent.md", kind: "file" });

    const output = await appContext.vault.read({ path: "dist/parent.md", kind: "file" });
    expect(output).toContain("- [[#Alpha]]");
  });

  it("limits TOC headings to aggregate content when toc_scope is file", async () => {
    const appContext = new FakeAppContext({
      "Parent.md": "",
      "Child.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# Alpha\nBody."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/recipe.md",
      order: ["chapters/One"],
      recipe_heading_offset: 0
    });

    appContext.metadataCache.setFrontmatter("Child.md", {
      type: "booker-bundle",
      targets: ["Recipe"],
      aggregate_output: "dist/child.md",
      aggregate_heading_offset: 0
    });

    appContext.metadataCache.setFrontmatter("Parent.md", {
      type: "booker-bundle",
      targets: ["Child"],
      aggregate_output: "dist/parent.md",
      aggregate_toc: true,
      aggregate_toc_scope: "file",
      aggregate_toc_title: "Contents",
      aggregate_strip_title: true,
      aggregate_heading_offset: 2
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Parent.md", kind: "file" });

    const output = await appContext.vault.read({ path: "dist/parent.md", kind: "file" });
    expect(output).toContain("# Contents");
    expect(output).toContain("    - [[#Alpha]]");
    expect(output).not.toContain("\n- [[#Alpha]]");
  });
});

describe("Table of contents integration", () => {
  it("renders a TOC with links in recipe outputs", async () => {
    const appContext = new FakeAppContext({
      "Recipe.md": "",
      "chapters/One.md": "# Alpha\nBody."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/recipe.md",
      order: ["chapters/One"],
      recipe_toc: true,
      recipe_strip_title: true,
      recipe_heading_offset: 0
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Recipe.md", kind: "file" });

    const output = await appContext.vault.read({ path: "dist/recipe.md", kind: "file" });
    expect(output).toContain("# Table of Contents");
    expect(output).toContain("- [[#Alpha]]");
  });

  it("renders a TOC with links in bundle aggregates", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# Alpha\nBody."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/recipe.md",
      order: ["chapters/One"],
      recipe_strip_title: true,
      recipe_heading_offset: 0
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      targets: ["Recipe"],
      aggregate_output: "dist/bundle.md",
      aggregate_toc: true,
      aggregate_toc_title: "Contents",
      aggregate_strip_title: true,
      aggregate_heading_offset: 0
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    const output = await appContext.vault.read({ path: "dist/bundle.md", kind: "file" });
    expect(output).toContain("# Contents");
    expect(output).toContain("- [[#Alpha]]");
  });
});
