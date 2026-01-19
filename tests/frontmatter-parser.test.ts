import { describe, expect, it } from "vitest";
import { FrontmatterParser } from "../src/services/FrontmatterParser";
import { FakeAppContext } from "./fakes/FakeAppContext";

describe("FrontmatterParser.normalizeType", () => {
  const parser = new FrontmatterParser(new FakeAppContext().metadataCache);

  it("normalizes canonical recipe and bundle types", () => {
    expect(parser.normalizeType("booker-recipe")).toEqual({ normalized: "booker-recipe", deprecated: false });
    expect(parser.normalizeType("booker-bundle")).toEqual({ normalized: "booker-bundle", deprecated: false });
  });

  it("normalizes deprecated aliases and flags them", () => {
    expect(parser.normalizeType("booker")).toEqual({ normalized: "booker-recipe", deprecated: true });
    expect(parser.normalizeType("booker-build")).toEqual({ normalized: "booker-bundle", deprecated: true });
  });
});
