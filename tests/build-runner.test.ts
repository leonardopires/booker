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
  const parser = new FrontmatterParser(appContext.metadataCache, linkResolver);
  const markdownTransform = new MarkdownTransform();
  const vaultIO = new VaultIO(appContext.vault);
  const compiler = new Compiler(linkResolver, vaultIO, markdownTransform);
  const presenter = new UserMessagePresenter(appContext.notice);
  const runner = new BuildRunner(compiler, parser, linkResolver, presenter);
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
    expect(output).toBe("# Book Title\n\n# One\nIntro.\n\n---\n\n# Two\nSecond.\n");
  });

  it("builds a bundle with inline targets and aggregate output", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "chapters/One.md": "# One\nOne content.",
      "chapters/Two.md": "Two content."
    });

    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      targets: [
        { name: "First", output: "dist/one.md", order: ["chapters/One"] },
        { name: "Second", output: "dist/two.md", order: ["chapters/Two"], options: { strip_title: true } }
      ],
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

    expect(firstOutput).toBe("# One\nOne content.\n");
    expect(secondOutput).toBe("Two content.\n");
    expect(aggregateOutput).toBe(
      "# All\n\n# one\n\n# One\nOne content.\n\n---\n\n# two\n\nTwo content.\n"
    );
  });

  it("builds a bundle that sources another bundle", async () => {
    const appContext = new FakeAppContext({
      "Trilogia.md": "",
      "Livro.md": "",
      "chapters/One.md": "# One\nOne content."
    });

    appContext.metadataCache.setFrontmatter("Livro.md", {
      type: "booker-bundle",
      targets: [{ name: "Part", output: "dist/livro.md", order: ["chapters/One"] }],
      aggregate: {
        title: "Livro",
        output: "dist/livro-final.md"
      }
    });

    appContext.metadataCache.setFrontmatter("Trilogia.md", {
      type: "booker-bundle",
      targets: [{ name: "Livro", source: "Livro", mode: "bundle" }],
      aggregate: {
        title: "Trilogia",
        output: "dist/trilogia.md"
      }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Trilogia.md", kind: "file" });

    const aggregateOutput = await appContext.vault.read({ path: "dist/trilogia.md", kind: "file" });
    expect(aggregateOutput).toBe(
      "# Trilogia\n\n# livro-final\n\n# Livro\n\n# livro\n\n# One\nOne content.\n"
    );
  });

  it("detects bundle cycles", async () => {
    const appContext = new FakeAppContext({
      "BundleA.md": "",
      "BundleB.md": ""
    });

    appContext.metadataCache.setFrontmatter("BundleA.md", {
      type: "booker-bundle",
      targets: [{ name: "B", source: "BundleB", mode: "bundle" }],
      aggregate: { output: "dist/a.md" }
    });

    appContext.metadataCache.setFrontmatter("BundleB.md", {
      type: "booker-bundle",
      targets: [{ name: "A", source: "BundleA", mode: "bundle" }],
      aggregate: { output: "dist/b.md" }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "BundleA.md", kind: "file" });

    expect(appContext.notice.messages.join("\n")).toContain("❌ These bundles reference each other in a loop:");
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
      targets: [{ name: "Inline", output: "dist/inline.md", order: ["chapters/One"] }],
      aggregate: { output: "dist/all.md" }
    });

    const { runner } = setupServices(appContext);
    await runner.buildCurrentFile({ path: "Recipe.md", kind: "file" });
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    expect(appContext.notice.messages.some((message) => message.startsWith("⚠️"))).toBe(true);
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

    expect(appContext.notice.messages.join("\n")).toContain("❌ This recipe has no output file.");
  });
});
