import { describe, expect, it, vi } from "vitest";
import { BookerFileCreator } from "../src/services/BookerFileCreator";
import { FakeVault } from "./fakes/FakeVault";
import { UserMessagePresenter } from "../src/services/UserMessagePresenter";
import { FakeNotice } from "./fakes/FakeNotice";

const createCreator = (promptValue: string | null, openFile = vi.fn()) => {
  const vault = new FakeVault({ "Notes/Existing.md": "" });
  const presenter = new UserMessagePresenter(new FakeNotice());
  const prompt = vi.fn(() => promptValue);
  const creator = new BookerFileCreator(vault, presenter, prompt, openFile);
  return { creator, vault, prompt, openFile };
};

describe("BookerFileCreator", () => {
  it("creates a recipe template in a folder", async () => {
    const { creator, vault, openFile } = createCreator("NewRecipe");
    await creator.createRecipe({ path: "Notes", kind: "folder" });

    const content = await vault.read({ path: "Notes/NewRecipe.md", kind: "file" });
    expect(content).toContain("type: booker-recipe");
    expect(content).toContain("# New Recipe");
    expect(openFile).toHaveBeenCalledWith({ path: "Notes/NewRecipe.md", kind: "file" });
  });

  it("creates a bundle template alongside a file", async () => {
    const { creator, vault, openFile } = createCreator("BundleFile");
    await creator.createBundle({ path: "Notes/Existing.md", kind: "file" });

    const content = await vault.read({ path: "Notes/BundleFile.md", kind: "file" });
    expect(content).toContain("type: booker-bundle");
    expect(content).toContain("# New Bundle");
    expect(openFile).toHaveBeenCalledWith({ path: "Notes/BundleFile.md", kind: "file" });
  });
});
