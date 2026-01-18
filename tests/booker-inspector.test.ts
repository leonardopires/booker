/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { BookerInspector } from "../src/services/BookerInspector";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { FakeAppContext } from "./fakes/FakeAppContext";

const createSpy = () => {
  const calls: unknown[][] = [];
  const spy = (...args: unknown[]) => {
    calls.push(args);
  };
  return { spy, calls };
};

const setupInspector = (appContext: FakeAppContext) => {
  const parser = new FrontmatterParser(appContext.metadataCache);
  const resolver = new LinkResolver(appContext.metadataCache);
  const generateSpy = createSpy();
  const openFileSpy = createSpy();
  const inspector = new BookerInspector(
    appContext.vault,
    appContext.metadataCache,
    parser,
    resolver,
    async (file) => {
      generateSpy.spy(file);
    },
    (path) => {
      openFileSpy.spy(path);
    }
  );
  return { inspector, generateSpy, openFileSpy };
};

describe("BookerInspector", () => {
  it("renders for recipe notes", () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": "",
      "Sources/One.md": "",
      "Sources/Two.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: ["Sources/One", "Sources/Two"]
    });

    const { inspector } = setupInspector(appContext);
    const container = document.createElement("div");
    inspector.render(container, "Recipes/Recipe.md");

    const inspectorEl = container.querySelector(".booker-inspector");
    expect(inspectorEl).not.toBeNull();
    expect(container.querySelector(".booker-inspector__badge")?.textContent).toBe("Recipe");
    expect(container.querySelector(".booker-inspector__summary")?.textContent).toBe(
      "Sources: 2 (missing: 0)"
    );
  });

  it("renders for bundle notes", () => {
    const appContext = new FakeAppContext({
      "Bundles/Bundle.md": "",
      "Recipes/One.md": "",
      "Recipes/Two.md": ""
    });
    appContext.metadataCache.setFrontmatter("Bundles/Bundle.md", {
      type: "booker-bundle",
      targets: [{ name: "First", source: "Recipes/One" }, { name: "Second", source: "Recipes/Two" }],
      aggregate: { output: "output/all.md" }
    });

    const { inspector } = setupInspector(appContext);
    const container = document.createElement("div");
    inspector.render(container, "Bundles/Bundle.md");

    const inspectorEl = container.querySelector(".booker-inspector");
    expect(inspectorEl).not.toBeNull();
    expect(container.querySelector(".booker-inspector__badge")?.textContent).toBe("Bundle");
    expect(container.querySelector(".booker-inspector__summary")?.textContent).toBe(
      "Steps: 2 (missing: 0)"
    );
  });

  it("does not render for non-Booker notes", () => {
    const appContext = new FakeAppContext({
      "Notes/Note.md": ""
    });
    appContext.metadataCache.setFrontmatter("Notes/Note.md", {
      title: "Just a note"
    });

    const { inspector } = setupInspector(appContext);
    const container = document.createElement("div");
    inspector.render(container, "Notes/Note.md");

    expect(container.querySelector(".booker-inspector")).toBeNull();
  });

  it("shows a warning hint for missing sources", () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": "",
      "Sources/One.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: ["Sources/One", "Sources/Missing"]
    });

    const { inspector } = setupInspector(appContext);
    const container = document.createElement("div");
    inspector.render(container, "Recipes/Recipe.md");

    expect(container.querySelector(".booker-inspector__hint")?.textContent).toBe(
      "⚠️ Some sources are missing. Switch to Source mode and fix the YAML above."
    );
  });
});
