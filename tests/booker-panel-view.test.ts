/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { WorkspaceLeaf } from "obsidian";
import { BookerPanelView } from "../src/adapters/BookerPanelView";
import { BookerPanelModelBuilder } from "../src/services/BookerPanelModelBuilder";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeAppContext } from "./fakes/FakeAppContext";
import { FakeNotice } from "./fakes/FakeNotice";

const createSpy = () => {
  const calls: unknown[][] = [];
  const spy = (...args: unknown[]) => {
    calls.push(args);
  };
  return { spy, calls };
};

const setupView = (appContext: FakeAppContext) => {
  const parser = new FrontmatterParser(appContext.metadataCache);
  const resolver = new LinkResolver(appContext.metadataCache);
  const builder = new BookerPanelModelBuilder({
    vault: appContext.vault,
    metadataCache: appContext.metadataCache,
    parser,
    linkResolver: resolver
  });
  const generateSpy = createSpy();
  const openOutputSpy = createSpy();
  let openOutputResult = true;
  const generate = async (...args: unknown[]) => {
    generateSpy.spy(...args);
    return undefined;
  };
  const openOutput = (...args: unknown[]) => {
    openOutputSpy.spy(...args);
    return openOutputResult;
  };
  const notice = new FakeNotice();
  const presenter = new UserMessagePresenter(notice);
  const leaf = {
    view: null,
    containerEl: document.createElement("div")
  } as unknown as WorkspaceLeaf;
  const view = new BookerPanelView(leaf, builder, generate, openOutput, presenter);
  return {
    view,
    generate,
    openOutput,
    notice,
    generateSpy,
    openOutputSpy,
    setOpenOutputResult: (value: boolean) => {
      openOutputResult = value;
    }
  };
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

    const { view, generateSpy } = setupView(appContext);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const button = view.contentEl.querySelector<HTMLButtonElement>(".booker-panel__action-button");
    button?.click();

    expect(generateSpy.calls).toEqual([[{ path: "Recipes/Recipe.md", kind: "file" }]]);
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

    const { view, openOutputSpy } = setupView(appContext);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const link = view.contentEl.querySelector<HTMLAnchorElement>(".booker-panel__output-link");
    link?.click();

    expect(openOutputSpy.calls).toEqual([["Recipes/output/book.md"]]);
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

    const { view, notice, setOpenOutputResult } = setupView(appContext);
    setOpenOutputResult(false);
    await view.onOpen();
    view.setActiveFile({ path: "Recipes/Recipe.md", kind: "file" });
    const link = view.contentEl.querySelector<HTMLAnchorElement>(".booker-panel__output-link");
    link?.click();

    expect(notice.messages).toContain("ℹ️ Output not generated yet. Generate first.");
  });
});
