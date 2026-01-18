import { describe, expect, it } from "vitest";
import { BuildOrchestrator } from "../src/services/BuildOrchestrator";
import { Compiler } from "../src/services/Compiler";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { MarkdownTransform } from "../src/services/MarkdownTransform";
import { VaultIO } from "../src/services/VaultIO";
import { FakeAppContext } from "./fakes/FakeAppContext";

const setupServices = (appContext: FakeAppContext) => {
  const linkResolver = new LinkResolver(appContext.metadataCache);
  const parser = new FrontmatterParser(appContext.metadataCache, linkResolver);
  const markdownTransform = new MarkdownTransform();
  const vaultIO = new VaultIO(appContext.vault);
  const compiler = new Compiler(linkResolver, vaultIO, markdownTransform);
  const orchestrator = new BuildOrchestrator(compiler, appContext.notice);
  return { parser, compiler, orchestrator };
};

describe("Booker pipelines", () => {
  it("compiles a booker project into an output file", async () => {
    const appContext = new FakeAppContext({
      "Project.md": "",
      "chapters/One.md": "---\nfoo: bar\n---\n# One\nIntro.",
      "chapters/Two.md": "# Two\nSecond."
    });

    appContext.metadataCache.setFrontmatter("Project.md", {
      type: "booker",
      title: "Book Title",
      output: "Output.md",
      order: ["chapters/One", "chapters/Two"]
    });

    const { parser, compiler } = setupServices(appContext);
    const projectConfig = parser.parseBookerProject({ path: "Project.md", kind: "file" });
    const result = await compiler.compile(projectConfig, "Project.md");

    await compiler.writeOutput(projectConfig.outputPath, result.content);

    const output = await appContext.vault.read({ path: "Output.md", kind: "file" });
    expect(output).toBe(
      "# Book Title\n\n# One\nIntro.\n\n---\n\n# Two\nSecond.\n"
    );
  });

  it("stops build on missing links when continue_on_missing is false", async () => {
    const appContext = new FakeAppContext({
      "Build.md": "",
      "chapter.md": "# Chapter\nContent."
    });

    appContext.metadataCache.setFrontmatter("Build.md", {
      type: "booker-build",
      targets: [
        { name: "Missing", output: "out/missing.md", order: ["MissingNote"] },
        { name: "Second", output: "out/second.md", order: ["chapter"] }
      ],
      build_options: {
        stop_on_error: true,
        continue_on_missing: false
      }
    });

    const { parser, orchestrator } = setupServices(appContext);
    const buildfileConfig = parser.parseBuildfile({ path: "Build.md", kind: "file" });
    const result = await orchestrator.runBuildfile(buildfileConfig, "Build.md");

    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]?.success).toBe(false);
    expect(appContext.vault.getFileByPath("out/second.md")).toBeNull();
  });

  it("builds mixed targets and aggregates outputs", async () => {
    const appContext = new FakeAppContext({
      "Buildfile.md": "",
      "projects/Book.md": "",
      "chapters/One.md": "# One\nOne content.",
      "chapters/Two.md": "Two content.",
      "chapters/Three.md": "# Three\nThird content."
    });

    appContext.metadataCache.setFrontmatter("projects/Book.md", {
      type: "booker",
      title: "Project Book",
      output: "dist/book.md",
      order: ["chapters/One", "chapters/Two"]
    });

    appContext.metadataCache.setFrontmatter("Buildfile.md", {
      type: "booker-build",
      targets: [
        { name: "Project", project: "projects/Book" },
        {
          name: "Inline",
          output: "dist/inline.md",
          order: ["chapters/Three"],
          options: { strip_h1: true, strip_title: true }
        }
      ],
      aggregate: {
        title: "All",
        output: "dist/all.md"
      }
    });

    const { parser, orchestrator } = setupServices(appContext);
    const buildfileConfig = parser.parseBuildfile({ path: "Buildfile.md", kind: "file" });
    await orchestrator.runBuildfile(buildfileConfig, "Buildfile.md");

    const projectOutput = await appContext.vault.read({ path: "projects/dist/book.md", kind: "file" });
    const inlineOutput = await appContext.vault.read({ path: "dist/inline.md", kind: "file" });
    const aggregateOutput = await appContext.vault.read({ path: "dist/all.md", kind: "file" });

    expect(projectOutput).toBe(
      "# Project Book\n\n# One\nOne content.\n\n---\n\n# Two\n\nTwo content.\n"
    );
    expect(inlineOutput).toBe("Third content.\n");
    expect(aggregateOutput).toBe(
      "# All\n\n# book\n\n# Project Book\n\n# One\nOne content.\n\n---\n\n# Two\n\nTwo content.\n\n---\n\n# inline\n\nThird content.\n"
    );
  });

  it("skips self-inclusion when output is in order", async () => {
    const appContext = new FakeAppContext({
      "Project.md": "",
      "Output.md": "# Existing Output",
      "chapters/One.md": "# One\nIntro."
    });

    appContext.metadataCache.setFrontmatter("Project.md", {
      type: "booker",
      output: "Output.md",
      order: ["Output", "chapters/One"]
    });

    const { parser, compiler } = setupServices(appContext);
    const projectConfig = parser.parseBookerProject({ path: "Project.md", kind: "file" });
    const result = await compiler.compile(projectConfig, "Project.md");

    expect(result.skippedSelfIncludes).toEqual(["Output.md"]);
    expect(result.resolvedCount).toBe(1);
  });
});
