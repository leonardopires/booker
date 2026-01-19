/* @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";

import { WorkspaceLeaf } from "obsidian";
import { BookerPanelView } from "../src/adapters/BookerPanelView";
import { BookerPanelModelBuilder } from "../src/services/BookerPanelModelBuilder";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeAppContext } from "./fakes/FakeAppContext";
import { FakeNotice } from "./fakes/FakeNotice";

const setupView = (appContext: FakeAppContext) => {
  const parser = new FrontmatterParser(appContext.metadataCache);
  const resolver = new LinkResolver(appContext.metadataCache);
  const builder = new BookerPanelModelBuilder(appContext.vault, appContext.metadataCache, parser, resolver);
  const generate = vi.fn(async () => undefined);
  const openOutput = vi.fn(() => true);
  const notice = new FakeNotice();
  const presenter = new UserMessagePresenter(notice);
  const leaf = new WorkspaceLeaf(document.createElement("div"));
  const view = new BookerPanelView(leaf, builder, generate, openOutput, presenter);
  return { view, generate, openOutput, notice };
};

describe("BookerPanelView", () => {
  it("renders an empty state when no active file", async () => {
    const appContext = new FakeAppContext();
    const { view } = setupView(appContext);

    await view.onOpen();
    view.setActiveFile(null);

    expect(view.contentEl.textContent).toContain("No active note selected.");
  });

  it("updates when the active file changes", async () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": "",
      "Notes/Note.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: []
    });
    appContext.metadataCache.setFrontmatter("Notes/Note.md", { title: "Note" });

    const { view } = setupView(appContext);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    expect(view.contentEl.textContent).toContain("Recipe");

    view.setActiveFile({ path: "Notes/Note.md", kind: "file" });
    expect(view.contentEl.textContent).toContain("This note is not a Booker recipe or bundle.");
  });

  it("invokes generation for the active file", async () => {
    const appContext = new FakeAppContext({ "Recipes/Recipe.md": "" });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: []
    });

    const { view, generate } = setupView(appContext);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const button = view.contentEl.querySelector<HTMLButtonElement>(".booker-panel__action-button");
    button?.click();

    expect(generate).toHaveBeenCalledWith({ path: "Recipes/Recipe.md", kind: "file" });
  });

  it("opens the output file when it exists", async () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": "",
      "Recipes/output/book.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: []
    });

    const { view, openOutput } = setupView(appContext);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const link = view.contentEl.querySelector<HTMLAnchorElement>(".booker-panel__output-link");
    link?.click();

    expect(openOutput).toHaveBeenCalledWith("Recipes/output/book.md");
  });

  it("notifies when output is missing", async () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: []
    });

    const { view, notice, openOutput } = setupView(appContext);
    openOutput.mockReturnValue(false);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const link = view.contentEl.querySelector<HTMLAnchorElement>(".booker-panel__output-link");
    link?.click();

    expect(notice.messages).toContain("ℹ️ Output not generated yet. Generate first.");
  });
});
