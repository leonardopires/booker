/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { Modal, TFile } from "obsidian";
import type { App } from "obsidian";
import { BookerContext } from "../src/app/BookerContext";

class TestVault {
  private readonly files = new Map<string, string>();

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  async read(file: { path: string }): Promise<string> {
    const content = this.files.get(file.path);
    if (content === undefined) {
      throw new Error(`Missing file: ${file.path}`);
    }
    return content;
  }

  async modify(file: { path: string }, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async create(path: string, content: string): Promise<TFile> {
    this.files.set(path, content);
    const file = new TFile();
    file.path = path;
    return file;
  }

  async createFolder(_path: string): Promise<void> {}

  getAbstractFileByPath(path: string): TFile | null {
    if (this.files.has(path)) {
      const file = new TFile();
      file.path = path;
      return file;
    }
    return null;
  }
}

const createSpy = () => {
  const calls: unknown[][] = [];
  const spy = (...args: unknown[]) => {
    calls.push(args);
  };
  return { spy, calls };
};

describe("BookerContext", () => {
  it("builds core services and uses the modal prompt for new files", async () => {
    const modalType = Modal as typeof Modal & { lastInstance: Modal | null };
    modalType.lastInstance = null;
    const vault = new TestVault();
    const metadataCache = {
      getFileCache: () => null,
      getFirstLinkpathDest: () => null
    };
    const openFileSpy = createSpy();
    const workspace = {
      getLeaf: () => ({
        openFile: openFileSpy.spy
      })
    };

    const app = {
      vault,
      metadataCache,
      workspace
    } as unknown as App;

    const context = new BookerContext(app);
    expect(context.buildRunner).toBeDefined();
    expect(context.panelModelBuilder).toBeDefined();

    const createPromise = context.fileCreator.createRecipe({ path: "Notes", kind: "folder" });
    const modal = modalType.lastInstance;
    expect(modal).not.toBeNull();
    if (modal) {
      const input = modal.contentEl.querySelector<HTMLInputElement>("input");
      expect(input).not.toBeNull();
      if (input) {
        input.value = "ContextRecipe";
      }
      const buttons = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>("button"));
      const submit = buttons[1];
      submit?.click();
    }

    await createPromise;

    expect(vault.hasFile("Notes/ContextRecipe.md")).toBe(true);
    expect(openFileSpy.calls.length).toBe(1);
  });
});
