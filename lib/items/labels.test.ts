import { describe, expect, it } from "vitest";
import { createItem } from "./model";
import { changeLabels, itemLabels, labelHref } from "./labels";

describe("labels", () => {
  it("adds/removes labels case-insensitively without changing unrelated labels", () => {
    expect(
      changeLabels(["Work", "Personal"], ["work", "Ideas", "ideas"], "add"),
    ).toEqual(["Work", "Personal", "Ideas"]);
    expect(changeLabels(["Work", "Personal"], ["WORK"], "remove")).toEqual([
      "Personal",
    ]);
  });
  it("does not silently truncate an overflowing bulk addition", () => {
    expect(
      changeLabels(
        Array.from({ length: 50 }, (_, index) => `Label ${index}`),
        ["Extra"],
        "add",
      ),
    ).toHaveLength(51);
  });
  it("reuses tags, sorts and deduplicates, retaining archived but not deleted labels", () => {
    const note = createItem("Note");
    expect(
      itemLabels([
        { ...note, tags: ["Work", "Design"] },
        { ...note, status: "archived", tags: ["Work", "Saved"] },
        { ...note, deletedAt: note.createdAt, tags: ["Private trash"] },
      ]),
    ).toEqual(["Design", "Saved", "Work"]);
  });

  it("round trips punctuation, spaces and Unicode without changing the label", () => {
    const label = "Work / café & C++ #1?";
    const url = new URL(labelHref(label), "https://example.test");
    expect(url.pathname).toBe("/all");
    expect(url.searchParams.get("label")).toBe(label);
    expect(url.hash).toBe("");
  });
});
