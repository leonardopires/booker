import { describe, expect, it } from "vitest";
import { BookerFileCreator } from "../src/services/BookerFileCreator";
import { FakeVault } from "./fakes/FakeVault";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeNotice } from "./fakes/FakeNotice";

const createSpy = () => {
  const calls: unknown[][] = [];
  const spy = (...args: unknown[]) => {
    calls.push(args);
  };
  return { spy, calls };
};

const createCreator = (promptValue: string | null) => {
  const openFileSpy = createSpy();
  const vault = new FakeVault({ "Notes/Existing.md": "" });
  const notice = new FakeNotice();
  const presenter = new UserMessagePresenter(notice);
  const prompt = async () => promptValue;
  const creator = new BookerFileCreator({
    vault,
    presenter,
    prompt,
    openFile: openFileSpy.spy
  });
  return { creator, vault, openFileSpy, notice };
};

describe("BookerFileCreator", () => {
  it("creates a recipe template in a folder", async () => {
    const { creator, vault, openFileSpy } = createCreator("NewRecipe");
    await creator.createRecipe({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/NewRecipe.md", kind: "file" });
    expect(content).toContain("type: booker-recipe");
    expect(content).toContain("# New Recipe");
    expect(openFileSpy.calls).toEqual([[{ path: "Notes/NewRecipe.md", kind: "file" }]]);
  });

  it("creates a bundle template alongside a file", async () => {
    const { creator, vault, openFileSpy } = createCreator("BundleFile");
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
    const { creator, notice } = createCreator("   ");
    const result = await creator.createRecipe({ path: "Notes", kind: "folder" });

    expect(result).toBeNull();
    expect(notice.messages).toContain("⚠️ Please enter a filename.");
  });

  it("rejects duplicate filenames", async () => {
    const { creator, notice } = createCreator("Existing");
    const result = await creator.createBundle({ path: "Notes", kind: "folder" });

    expect(result).toBeNull();
    expect(notice.messages).toContain("⚠️ That file already exists. Choose a new name.");
  });
});
