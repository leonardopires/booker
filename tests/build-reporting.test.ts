import { describe, expect, it } from "vitest";
import { BuildRunner } from "../src/services/BuildRunner";
import { Compiler } from "../src/services/Compiler";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { MarkdownTransform } from "../src/services/MarkdownTransform";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { VaultIO } from "../src/services/VaultIO";
import { resolveFileLabel } from "../src/utils/LabelUtils";
import { FakeAppContext } from "./fakes/FakeAppContext";
import { FakeNotice } from "./fakes/FakeNotice";

const setupRunner = (appContext: FakeAppContext) => {
  const linkResolver = new LinkResolver(appContext.metadataCache);
  const parser = new FrontmatterParser(appContext.metadataCache);
  const markdownTransform = new MarkdownTransform();
  const vaultIO = new VaultIO(appContext.vault);
  const compiler = new Compiler({ linkResolver, vaultIO, markdownTransform });
  const presenter = new UserMessagePresenter(appContext.notice);
  return new BuildRunner({ compiler, parser, linkResolver, presenter, vault: appContext.vault });
};

describe("Build reporting", () => {
  it("formats notices with emoji, file label, and message", () => {
    const notice = new FakeNotice();
    const presenter = new UserMessagePresenter(notice);

    presenter.showSuccessForFile("My File", "All set.");

    expect(notice.messages).toEqual(["✅ [My File] All set."]);
  });

  it("resolves file labels using title or basename", () => {
    expect(resolveFileLabel("Folder/Note.md", { title: "My Title" })).toBe("My Title");
    expect(resolveFileLabel("Folder/Note.md", null)).toBe("Note");
  });

  it("streams bundle notices and emits a final summary", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "RecipeOne.md": "",
      "RecipeTwo.md": "",
      "chapters/One.md": "# One\nOne content.",
      "chapters/Two.md": "# Two\nTwo content."
    });

    appContext.metadataCache.setFrontmatter("RecipeOne.md", {
      type: "booker-recipe",
      title: "Recipe One",
      output: "dist/one.md",
      order: ["chapters/One"]
    });
    appContext.metadataCache.setFrontmatter("RecipeTwo.md", {
      type: "booker-recipe",
      title: "Recipe Two",
      output: "dist/two.md",
      order: ["chapters/Two"]
    });
    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      title: "Bundle Title",
      targets: ["RecipeOne", "RecipeTwo"],
      aggregate: { output: "dist/all.md" }
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    expect(appContext.notice.messages[0]).toBe("ℹ️ [Bundle Title] Running 2 targets…");
    expect(appContext.notice.messages[1]).toBe("✅ [Recipe One] Generation completed successfully.");
    expect(appContext.notice.messages[2]).toBe("✅ [Recipe Two] Generation completed successfully.");
    expect(appContext.notice.messages[appContext.notice.messages.length - 1]).toBe(
      "✅ [Bundle Title] Completed (✅2 ⚠️0 ❌0)"
    );
  });

  it("aggregates warning status for bundle summaries", async () => {
    const appContext = new FakeAppContext({
      "Bundle.md": "",
      "Recipe.md": "",
      "chapters/One.md": "# One\nOne content."
    });

    appContext.metadataCache.setFrontmatter("Recipe.md", {
      type: "booker",
      output: "dist/one.md",
      order: ["chapters/One"]
    });
    appContext.metadataCache.setFrontmatter("Bundle.md", {
      type: "booker-bundle",
      title: "Bundle",
      targets: ["Recipe"],
      aggregate: { output: "dist/all.md" }
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Bundle.md", kind: "file" });

    expect(appContext.notice.messages).toContain(
      "⚠️ [Bundle] Completed with warnings (✅0 ⚠️1 ❌0)"
    );
  });

  it("shows YAML syntax errors with line/col and a hint", async () => {
    const appContext = new FakeAppContext({
      "Broken.md": "---\nINVALID_YAML\n---\n"
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "Broken.md", kind: "file" });

    expect(appContext.notice.messages[0]).toBe(
      "❌ [Broken] YAML syntax error (line 2, col 5): Missing ':' after key"
    );
    expect(appContext.notice.messages[1]).toBe(
      "ℹ️ [Broken] Hint: Check indentation, ensure each key has a ':' and list items start with '-'."
    );
  });

  it("shows YAML syntax errors without line/col when unavailable", async () => {
    const appContext = new FakeAppContext({
      "MissingEnd.md": "---\ntype: booker-recipe\n"
    });

    const runner = setupRunner(appContext);
    await runner.buildCurrentFile({ path: "MissingEnd.md", kind: "file" });

    expect(appContext.notice.messages[0]).toBe(
      "❌ [MissingEnd] YAML syntax error (line 2): Missing closing '---' for YAML frontmatter."
    );
    expect(appContext.notice.messages[1]).toBe(
      "ℹ️ [MissingEnd] Hint: Check indentation, ensure each key has a ':' and list items start with '-'."
    );
  });
});
