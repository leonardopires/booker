import { describe, expect, it } from "vitest";
import { BookerFileCreator } from "../src/services/BookerFileCreator";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { FilenamePromptResult } from "../src/ports/PromptTypes";
import { FakeVault } from "./fakes/FakeVault";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeNotice } from "./fakes/FakeNotice";
import { FakeMetadataCache } from "./fakes/FakeMetadataCache";

const createSpy = () => {
  const calls: unknown[][] = [];
  const spy = (...args: unknown[]) => {
    calls.push(args);
  };
  return { spy, calls };
};

const createCreator = (
  promptValue: FilenamePromptResult | null,
  initialFiles: Record<string, string> = {}
) => {
  const openFileSpy = createSpy();
  const vault = new FakeVault({ "Notes/Existing.md": "", ...initialFiles });
  const metadataCache = new FakeMetadataCache(vault);
  const parser = new FrontmatterParser(metadataCache);
  const notice = new FakeNotice();
  const presenter = new UserMessagePresenter(notice);
  const prompt = async () => promptValue;
  const creator = new BookerFileCreator({
    vault,
    presenter,
    parser,
    prompt,
    openFile: openFileSpy.spy
  });
  return { creator, vault, openFileSpy, notice, metadataCache };
};

describe("BookerFileCreator", () => {
  it("creates a recipe template in a folder", async () => {
    const { creator, vault, openFileSpy } = createCreator({
      filename: "NewRecipe",
      prefillFromFolder: false,
      includeSubfolders: false
    });
    await creator.createRecipe({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/NewRecipe.md", kind: "file" });
    expect(content).toContain("type: booker-recipe");
    expect(content).toContain("# New Recipe");
    expect(openFileSpy.calls).toEqual([[{ path: "Notes/NewRecipe.md", kind: "file" }]]);
  });

  it("creates a bundle template alongside a file", async () => {
    const { creator, vault, openFileSpy } = createCreator({
      filename: "BundleFile",
      prefillFromFolder: false,
      includeSubfolders: false
    });
    await creator.createBundle({ path: "Notes/Existing.md", kind: "file" });

    const content = await vault.read({ path: "Notes/BundleFile.md", kind: "file" });
    expect(content).toContain("type: booker-bundle");
    expect(content).toContain("# New Bundle");
    expect(openFileSpy.calls).toEqual([[{ path: "Notes/BundleFile.md", kind: "file" }]]);
  });

  it("does nothing when the prompt is canceled", async () => {
    const { creator, vault, openFileSpy } = createCreator(null);
    const result = await creator.createRecipe({ path: "Notes", kind: "folder" });

    expect(result).toBeNull();
    expect(openFileSpy.calls).toEqual([]);
    await expect(vault.read({ path: "Notes/New recipe.md", kind: "file" })).rejects.toThrow();
  });

  it("rejects blank filenames", async () => {
    const { creator, notice } = createCreator({
      filename: "   ",
      prefillFromFolder: false,
      includeSubfolders: false
    });
    const result = await creator.createRecipe({ path: "Notes", kind: "folder" });

    expect(result).toBeNull();
    expect(notice.messages).toContain("⚠️ [Booker] Please enter a filename.");
  });

  it("rejects duplicate filenames", async () => {
    const { creator, notice } = createCreator({
      filename: "Existing",
      prefillFromFolder: false,
      includeSubfolders: false
    });
    const result = await creator.createBundle({ path: "Notes", kind: "folder" });

    expect(result).toBeNull();
    expect(notice.messages).toContain("⚠️ [Booker] That file already exists. Choose a new name.");
  });

  it("prefills recipe order with non-Booker notes", async () => {
    const { creator, vault, metadataCache } = createCreator(
      {
        filename: "RecipePrefill",
        prefillFromFolder: true,
        includeSubfolders: false
      },
      {
        "Notes/Alpha.md": "",
        "Notes/Bravo.md": "",
        "Notes/BookerRecipe.md": "",
        "Notes/BookerBundle.md": "",
        "Notes/DeprecatedRecipe.md": "",
        "Notes/DeprecatedBundle.md": "",
        "Notes/output/Generated.md": "",
        "Notes/Sketch.png": ""
      }
    );

    metadataCache.setFrontmatter("Notes/BookerRecipe.md", { type: "booker-recipe" });
    metadataCache.setFrontmatter("Notes/BookerBundle.md", { type: "booker-bundle" });
    metadataCache.setFrontmatter("Notes/DeprecatedRecipe.md", { type: "booker" });
    metadataCache.setFrontmatter("Notes/DeprecatedBundle.md", { type: "booker-build" });

    await creator.createRecipe({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/RecipePrefill.md", kind: "file" });
    expect(content).toContain('order:\n  - "[[Notes/Alpha]]"\n  - "[[Notes/Bravo]]"');
    expect(content).not.toContain("BookerRecipe");
    expect(content).not.toContain("BookerBundle");
    expect(content).not.toContain("DeprecatedRecipe");
    expect(content).not.toContain("DeprecatedBundle");
    expect(content).not.toContain("output/Generated");
  });

  it("prefills bundle targets with Booker notes", async () => {
    const { creator, vault, metadataCache } = createCreator(
      {
        filename: "BundlePrefill",
        prefillFromFolder: true,
        includeSubfolders: false
      },
      {
        "Notes/Alpha.md": "",
        "Notes/BookerRecipe.md": "",
        "Notes/BookerBundle.md": "",
        "Notes/DeprecatedRecipe.md": "",
        "Notes/DeprecatedBundle.md": "",
        "Notes/output/Generated.md": "",
        "Notes/Sketch.png": ""
      }
    );

    metadataCache.setFrontmatter("Notes/BookerRecipe.md", { type: "booker-recipe" });
    metadataCache.setFrontmatter("Notes/BookerBundle.md", { type: "booker-bundle" });
    metadataCache.setFrontmatter("Notes/DeprecatedRecipe.md", { type: "booker" });
    metadataCache.setFrontmatter("Notes/DeprecatedBundle.md", { type: "booker-build" });

    await creator.createBundle({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/BundlePrefill.md", kind: "file" });
    expect(content).toContain(
      'targets:\n  - "[[Notes/BookerBundle]]"\n  - "[[Notes/BookerRecipe]]"\n  - "[[Notes/DeprecatedBundle]]"\n  - "[[Notes/DeprecatedRecipe]]"'
    );
    expect(content).not.toContain("Alpha");
    expect(content).not.toContain("output/Generated");
  });

  it("prefills in deterministic path order when recursing", async () => {
    const { creator, vault } = createCreator(
      {
        filename: "OrderedRecipe",
        prefillFromFolder: true,
        includeSubfolders: true
      },
      {
        "Notes/Zeta.md": "",
        "Notes/Alpha.md": "",
        "Notes/Sub/Beta.md": ""
      }
    );

    await creator.createRecipe({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/OrderedRecipe.md", kind: "file" });
    expect(content).toContain(
      'order:\n  - "[[Notes/Alpha]]"\n  - "[[Notes/Existing]]"\n  - "[[Notes/Sub/Beta]]"\n  - "[[Notes/Zeta]]"'
    );
  });
});
