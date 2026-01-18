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
  const presenter = new UserMessagePresenter(new FakeNotice());
  const prompt = () => promptValue;
  const creator = new BookerFileCreator(vault, presenter, prompt, openFileSpy.spy);
  return { creator, vault, openFileSpy };
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
});
