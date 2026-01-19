import { describe, expect, it } from "vitest";
import { BookerPanelModelBuilder } from "../src/services/BookerPanelModelBuilder";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { LinkResolver } from "../src/services/LinkResolver";
import { FakeAppContext } from "./fakes/FakeAppContext";

describe("BookerPanelModelBuilder", () => {
  it("builds a recipe model with missing sources", () => {
    const appContext = new FakeAppContext({
      "Recipes/Recipe.md": "",
      "Recipes/output/book.md": "",
      "Sources/One.md": ""
    });
    appContext.metadataCache.setFrontmatter("Recipes/Recipe.md", {
      type: "booker-recipe",
      output: "output/book.md",
      order: ["Sources/One", "Sources/Missing"]
    });

    const parser = new FrontmatterParser(appContext.metadataCache);
    const resolver = new LinkResolver(appContext.metadataCache);
    const builder = new BookerPanelModelBuilder({
      vault: appContext.vault,
      metadataCache: appContext.metadataCache,
      parser,
      linkResolver: resolver
    });
    const model = builder.build({ path: "Recipes/Recipe.md", kind: "file" });

    expect(model.state).toBe("booker");
    if (model.state === "booker") {
      expect(model.kind).toBe("recipe");
      expect(model.summaryLabel).toBe("Sources");
      expect(model.totalCount).toBe(2);
      expect(model.missingCount).toBe(1);
      expect(model.outputPath).toBe("Recipes/output/book.md");
      expect(model.outputExists).toBe(true);
      const first = model.items[0];
      const second = model.items[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first && second) {
        expect(first.label).toBe("Sources/One");
        expect(second.resolved).toBe(false);
      }
    }
  });

  it("builds a bundle model with link targets", () => {
    const appContext = new FakeAppContext({
      "Bundles/Bundle.md": "",
      "Recipes/One.md": ""
    });
    appContext.metadataCache.setFrontmatter("Bundles/Bundle.md", {
      type: "booker-bundle",
      targets: ["Recipes/One", "Recipes/Missing"],
      aggregate: { output: "output/all.md" }
    });

    const parser = new FrontmatterParser(appContext.metadataCache);
    const resolver = new LinkResolver(appContext.metadataCache);
    const builder = new BookerPanelModelBuilder({
      vault: appContext.vault,
      metadataCache: appContext.metadataCache,
      parser,
      linkResolver: resolver
    });
    const model = builder.build({ path: "Bundles/Bundle.md", kind: "file" });

    expect(model.state).toBe("booker");
    if (model.state === "booker") {
      expect(model.kind).toBe("bundle");
      expect(model.summaryLabel).toBe("Steps");
      expect(model.totalCount).toBe(2);
      expect(model.missingCount).toBe(1);
      const second = model.items[1];
      expect(second).toBeDefined();
      if (second) {
        expect(second.label).toBe("Recipes/Missing");
        expect(second.resolved).toBe(false);
      }
    }
  });

  it("returns not-booker for non-booker files", () => {
    const appContext = new FakeAppContext({ "Notes/Note.md": "" });
    appContext.metadataCache.setFrontmatter("Notes/Note.md", { title: "Note" });

    const parser = new FrontmatterParser(appContext.metadataCache);
    const resolver = new LinkResolver(appContext.metadataCache);
    const builder = new BookerPanelModelBuilder({
      vault: appContext.vault,
      metadataCache: appContext.metadataCache,
      parser,
      linkResolver: resolver
    });
    const model = builder.build({ path: "Notes/Note.md", kind: "file" });

    expect(model.state).toBe("not-booker");
  });

  it("returns empty when no file is active", () => {
    const appContext = new FakeAppContext();
    const parser = new FrontmatterParser(appContext.metadataCache);
    const resolver = new LinkResolver(appContext.metadataCache);
    const builder = new BookerPanelModelBuilder({
      vault: appContext.vault,
      metadataCache: appContext.metadataCache,
      parser,
      linkResolver: resolver
    });
    const model = builder.build(null);

    expect(model.state).toBe("empty");
  });
});
