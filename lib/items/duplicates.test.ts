import { describe, expect, it } from "vitest";
import { createItem } from "./model";
import { findDuplicate } from "./duplicates";

describe("duplicate capture warnings", () => {
  it("recognizes normalized URLs without discarding meaningful query/fragment", () => {
    const item = createItem("https://example.com/");
    expect(findDuplicate([item], " https://EXAMPLE.com ")).toBe(item);
    expect(
      findDuplicate([item], "https://example.com/?offer=1"),
    ).toBeUndefined();
    expect(
      findDuplicate([item], "https://example.com/#section"),
    ).toBeUndefined();
  });
  it("compares full note content, ignoring only surrounding whitespace", () => {
    const item = createItem("A saved thought");
    expect(findDuplicate([item], "  A saved thought\n")).toBe(item);
    expect(findDuplicate([item], "A saved")).toBeUndefined();
    expect(findDuplicate([item], "")).toBeUndefined();
  });
  it("includes archived/done items but excludes Deleted", () => {
    const item = createItem("A saved thought");
    expect(
      findDuplicate([{ ...item, status: "archived" }], item.content!),
    ).toBeDefined();
    expect(
      findDuplicate([{ ...item, status: "done" }], item.content!),
    ).toBeDefined();
    expect(
      findDuplicate([{ ...item, deletedAt: item.createdAt }], item.content!),
    ).toBeUndefined();
  });
});
