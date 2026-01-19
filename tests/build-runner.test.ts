import { describe, expect, it } from "vitest";
import { BuildRunner } from "../src/services/BuildRunner";
import { Compiler } from "../src/services/Compiler";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { MarkdownTransform } from "../src/services/MarkdownTransform";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { VaultIO } from "../src/services/VaultIO";
import { FakeAppContext } from "./fakes/FakeAppContext";

const setupServices = (appContext: FakeAppContext) => {
  const linkResolver = new LinkResolver(appContext.metadataCache);
  const parser = new FrontmatterParser(appContext.metadataCache);
  const markdownTransform = new MarkdownTransform();
  const vaultIO = new VaultIO(appContext.vault);
  const compiler = new Compiler({ linkResolver, vaultIO, markdownTransform });
  const presenter = new UserMessagePresenter(appContext.notice);
  const runner = new BuildRunner({ compiler, parser, linkResolver, presenter, vault: appContext.vault });
  return { runner };
};

describe("BuildRunner", () => {
  it("builds a recipe and writes the output file", async () => {
    const appContext = new FakeAppContext({
      "Recipe.md": "",
      "chapters/One.md": "---\nfoo: bar\n---\n# One\nIntro.",
      "chapters/Two.md": "# Two\nSecond."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      title: "Book Title",
      output: "Output.md",
      order: ["chapters/One", "chapters/Two"]
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Recipe.md", kind: "file" });

    const output = await appContext.vault.read({ path: "Output.md", kind: "file" });
    expect(output).toBe("# Book Title\n\n## One\nIntro.\n\n---\n\n## Two\nSecond.\n");
  });

  it("builds a bundle with targets and aggregate output", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "RecipeOne.md": "",
      "RecipeTwo.md": "",
      "chapters/One.md": "# One\nOne content.",
      "chapters/Two.md": "Two content."
    });

    appContext.metadataCache.setFrontmatter("RecipeOne.md", {
      type: "booker-recipe",
      output: "dist/one.md",
      order: ["chapters/One"]
    });

    appContext.metadataCache.setFrontmatter("RecipeTwo.md", {
      type: "booker-recipe",
      output: "dist/two.md",
      order: ["chapters/Two"],
      options: { strip_title: true }
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      targets: ["RecipeOne", "RecipeTwo"],
      aggregate: {
        title: "All",
        output: "dist/all.md"
      }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    const firstOutput = await appContext.vault.read({ path: "dist/one.md", kind: "file" });
    const secondOutput = await appContext.vault.read({ path: "dist/two.md", kind: "file" });
    const aggregateOutput = await appContext.vault.read({ path: "dist/all.md", kind: "file" });

    expect(firstOutput).toBe("## One\nOne content.\n");
    expect(secondOutput).toBe("Two content.\n");
    expect(aggregateOutput).toBe(
      "# All\n\n## one\n\n### One\nOne content.\n\n---\n\n## two\n\nTwo content.\n"
    );
  });

  it("builds a bundle that sources another bundle", async () => {
    const appContext = new FakeAppContext({
      "Trilogia.md": "",
      "Livro.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# One\nOne content."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/livro.md",
      order: ["chapters/One"]
    });

    appContext.metadataCache.setFrontmatter("Livro.md", {
      type: "booker-bundle",
      targets: ["Recipe"],
      aggregate: {
        title: "Livro",
        output: "dist/livro-final.md"
      }
    });

    appContext.metadataCache.setFrontmatter("Trilogia.md", {
      type: "booker-bundle",
      targets: ["Livro"],
      aggregate: {
        title: "Trilogia",
        output: "dist/trilogia.md"
      }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Trilogia.md", kind: "file" });

    const aggregateOutput = await appContext.vault.read({ path: "dist/trilogia.md", kind: "file" });
    expect(aggregateOutput).toBe(
      "# Trilogia\n\n## livro-final\n\n## Livro\n\n### livro\n\n#### One\nOne content.\n"
    );
  });

  it("applies heading offsets to bundle aggregates", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# One\nContent."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/one.md",
      order: ["chapters/One"],
      options: { heading_offset: 0 }
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      targets: ["Recipe"],
      aggregate: {
        title: "All",
        output: "dist/all.md",
        options: { heading_offset: 2 }
      }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    const aggregateOutput = await appContext.vault.read({ path: "dist/all.md", kind: "file" });
    expect(aggregateOutput).toBe("# All\n\n### one\n\n### One\nContent.\n");
  });

  it("detects bundle cycles", async () => {
    const appContext = new FakeAppContext({
      "BundleA.md": "",
      "BundleB.md": ""
    });

    appContext.metadataCache.setFrontmatter("BundleA.md", {
      type: "booker-bundle",
      targets: ["BundleB"],
      aggregate: { output: "dist/a.md" }
    });

    appContext.metadataCache.setFrontmatter("BundleB.md", {
      type: "booker-bundle",
      targets: ["BundleA"],
      aggregate: { output: "dist/b.md" }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "BundleA.md", kind: "file" });

    expect(appContext.notice.messages.join("\n")).toContain(
      "❌ [BundleA] These bundles reference each other in a loop:"
    );
    expect(appContext.notice.messages.join("\n")).toContain("BundleA → BundleB → BundleA");
  });

  it("warns on deprecated types", async () => {
    const appContext = new FakeAppContext({
      "Recipe.md": "",
      "Bundle.md": "",
      "chapters/One.md": "# One\nOne content."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker",
      output: "dist/recipe.md",
      order: ["chapters/One"]
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-build",
      targets: ["Recipe"],
      aggregate: { output: "dist/all.md" }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Recipe.md", kind: "file" });
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    expect(appContext.notice.messages.some((message) => message.startsWith("⚠️ [Recipe]"))).toBe(true);
    expect(appContext.notice.messages.join("\n")).toContain("deprecated Booker type");
  });

  it("shows friendly error messages with emojis", async () => {
    const appContext = new FakeAppContext({
      "Recipe.md": ""
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      order: ["Missing"]
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Recipe.md", kind: "file" });

    expect(appContext.notice.messages.join("\n")).toContain("❌ [Recipe] This recipe has no output file.");
  });

  it("warns and aborts when bundles use deprecated target schemas", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# One\nOne content."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker-recipe",
      output: "dist/recipe.md",
      order: ["chapters/One"]
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      targets: [{ name: "Inline", output: "dist/inline.md", order: ["chapters/One"] }],
      aggregate: { output: "dist/all.md" }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    expect(appContext.notice.messages.join("\n")).toContain(
      "⚠️ [Bundle] This bundle uses the deprecated target schema."
    );
    await expect(appContext.vault.read({ path: "dist/all.md", kind: "file" })).rejects.toThrow();
  });
});
