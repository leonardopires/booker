import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { BookerContext } from "../src/app/BookerContext";

type ModalCall = { message: string; defaultValue?: string };

const modalState = vi.hoisted(() => ({
  calls: [] as ModalCall[]
}));

vi.mock("../src/adapters/FilenameModal", () => ({
  FilenameModal: class {
    constructor(_app: App, message: string, defaultValue?: string) {
      modalState.calls.push({ message, defaultValue });
    }

    openAndGetValue(): Promise<string | null> {
      return Promise.resolve("ContextRecipe");
    }
  }
}));

class TestVault {
  private readonly files = new Map<string, string>();

  async read(file: TFile): Promise<string> {
    const content = this.files.get(file.path);
    if (content === undefined) {
      throw new Error(`Missing file: ${file.path}`);
    }
    return content;
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async create(path: string, content: string): Promise<TFile> {
    this.files.set(path, content);
    return new TFile(path);
  }

  async createFolder(_path: string): Promise<void> {}

  getAbstractFileByPath(path: string): TFile | null {
    if (this.files.has(path)) {
      return new TFile(path);
    }
    return null;
  }
}

describe("BookerContext", () => {
  it("builds core services and uses the modal prompt for new files", async () => {
    modalState.calls.length = 0;
    const vault = new TestVault();
    const metadataCache = {
      getFileCache: () => null,
      getFirstLinkpathDest: () => null
    };
    const openFileSpy = vi.fn();
    const workspace = {
      getLeaf: () => ({
        openFile: openFileSpy
      })
    };

    const app = new App(workspace, vault, metadataCache) as App & {
      vault: TestVault;
      metadataCache: typeof metadataCache;
      workspace: typeof workspace;
    };

    const context = new BookerContext(app);
    expect(context.buildRunner).toBeDefined();
    expect(context.panelModelBuilder).toBeDefined();

    await context.fileCreator.createRecipe({ path: "Notes", kind: "folder" });

    expect(modalState.calls[0]).toEqual({
      message: "New recipe filename",
      defaultValue: "New recipe"
    });
    expect(openFileSpy).toHaveBeenCalled();
  });
});
