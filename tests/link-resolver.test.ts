import { describe, expect, it } from "vitest";
import { LinkResolver } from "../src/services/LinkResolver";
import { FakeAppContext } from "./fakes/FakeAppContext";

describe("LinkResolver.normalizeLinkString", () => {
  const resolver = new LinkResolver(new FakeAppContext().metadataCache);

  it("normalizes wikilinks and aliases", () => {
    expect(resolver.normalizeLinkString("[[Note]]")).toBe("Note");
    expect(resolver.normalizeLinkString("[[Folder/Note|Alias]]")).toBe("Folder/Note");
  });

  it("returns trimmed plain paths", () => {
    expect(resolver.normalizeLinkString("  Folder/Note  ")).toBe("Folder/Note");
  });
});
