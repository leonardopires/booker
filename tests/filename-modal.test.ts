/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { App } from "obsidian";
import { FilenameModal } from "../src/adapters/FilenameModal";

describe("FilenameModal", () => {
  it("resolves with the entered filename", async () => {
    const modal = new FilenameModal(new App(), "New recipe", "Default");
    const valuePromise = modal.openAndGetValue();

    const input = modal.contentEl.querySelector<HTMLInputElement>("input[type=\"text\"]");
    expect(input).not.toBeNull();
    if (input) {
      input.value = "MyFile";
    }
    const checkboxes = Array.from(
      modal.contentEl.querySelectorAll<HTMLInputElement>("input[type=\"checkbox\"]")
    );
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);
    const buttons = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>("button"));
    buttons[1]?.click();

    await expect(valuePromise).resolves.toEqual({
      filename: "MyFile",
      prefillFromFolder: true,
      includeSubfolders: false
    });
  });

  it("resolves with null when canceled", async () => {
    const modal = new FilenameModal(new App(), "New bundle");
    const valuePromise = modal.openAndGetValue();

    const buttons = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>("button"));
    buttons[0]?.click();

    await expect(valuePromise).resolves.toBeNull();
  });
});
