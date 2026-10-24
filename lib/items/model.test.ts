import { describe, expect, it } from "vitest";
import {
  createItem,
  envelopeSchema,
  inView,
  itemSchema,
  normalizeTags,
  pending,
  safeUrl,
  selectItems,
  updateItem,
} from "./model";

describe("capture", () => {
  it("preserves an original URL including meaningful query and uses a safe fallback", () => {
    const item = createItem(
      "https://www.example.com/article?offer=1&utm_campaign=keep#part",
    );
    expect(item).toMatchObject({
      type: "link",
      intent: "read",
      status: "inbox",
      title: "example.com",
      url: "https://www.example.com/article?offer=1&utm_campaign=keep#part",
    });
    expect(itemSchema.safeParse(item).success).toBe(true);
  });
  it.each([
    "https://youtu.be/abc",
    "https://www.youtube.com/watch?v=abc",
    "https://m.youtube.com/shorts/abc",
  ])("recognizes %s", (url) => {
    expect(createItem(url)).toMatchObject({ type: "video", intent: "watch" });
  });
  it("does not recognize deceptive YouTube hostnames", () => {
    expect(createItem("https://youtube.com.evil.example/a").type).toBe("link");
  });
  it("preserves full multiline note, permits independent intent and title fallback", () => {
    const content = "  Project idea\n\nKeep all these details.  \n";
    expect(createItem(content, "task")).toMatchObject({
      type: "note",
      intent: "task",
      title: "Project idea",
      content,
    });
  });
  it("does not guess product type from shopping intent", () => {
    expect(createItem("https://shop.example/lens", "buy")).toMatchObject({
      type: "link",
      intent: "buy",
    });
  });
  it("rejects empty capture", () => {
    expect(() => createItem(" \n ")).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,a",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:pass@example.com",
    "not a url",
  ])("rejects unsafe link %s", (value) => {
    expect(safeUrl(value)).toBe(false);
    expect(
      itemSchema.safeParse({ ...createItem("a"), type: "link", url: value })
        .success,
    ).toBe(false);
  });
  it("rejects URL-looking unsupported capture rather than treating it as a link", () => {
    expect(() => createItem("ftp://example.com")).toThrow();
  });
});

describe("lifecycle and validation", () => {
  it("transitions independently, preserving creation and completion until reopened", () => {
    const item = createItem("https://example.com");
    const later = updateItem(item, { status: "later", intent: "reference" });
    expect(later.type).toBe(item.type);
    expect(later.createdAt).toBe(item.createdAt);
    const done = updateItem(later, { status: "done" });
    expect(done.completedAt).toBeTruthy();
    expect(pending(done)).toBe(false);
    expect(updateItem(done, { title: "Docs" }).completedAt).toBe(
      done.completedAt,
    );
    expect(updateItem(done, { status: "later" }).completedAt).toBeUndefined();
    expect(
      updateItem(done, { status: "archived" }).completedAt,
    ).toBeUndefined();
  });
  it("normalizes tags and rejects missing required content or invalid dates", () => {
    expect(normalizeTags([" AI ", "AI", "", "Projects"])).toEqual([
      "AI",
      "Projects",
    ]);
    const note = createItem("hello");
    expect(itemSchema.parse({ ...note, tags: [" AI ", "AI"] }).tags).toEqual([
      "AI",
    ]);
    expect(() => updateItem(note, { title: "  " })).toThrow();
    expect(() => updateItem(note, { content: " " })).toThrow();
    expect(() => updateItem(note, { type: "product" })).toThrow();
    expect(
      itemSchema.safeParse({ ...note, createdAt: "yesterday" }).success,
    ).toBe(false);
    expect(itemSchema.safeParse({ ...note, status: "done" }).success).toBe(
      false,
    );
    expect(
      envelopeSchema.safeParse({ version: 1, items: [note, note] }).success,
    ).toBe(false);
  });
});

describe("selectors", () => {
  it("keeps archived and deleted views separate and excludes deleted items everywhere else", () => {
    const active = createItem("Active");
    const archived = updateItem(createItem("Archived"), { status: "archived" });
    const deleted = {
      ...active,
      id: crypto.randomUUID(),
      deletedAt: new Date().toISOString(),
    };
    const deletedArchive = {
      ...archived,
      id: crypto.randomUUID(),
      deletedAt: new Date().toISOString(),
    };
    const items = [active, archived, deleted, deletedArchive];
    expect(selectItems(items, "archived")).toEqual([archived]);
    expect(selectItems(items, "deleted")).toHaveLength(2);
    expect(selectItems(items, "deleted", { query: "Active" })).toEqual([
      deleted,
    ]);
    expect(selectItems(items, "all", { status: "any" })).toHaveLength(2);
    expect(selectItems(items, "inbox")).toEqual([active]);
    expect(inView(deleted, "dashboard")).toBe(false);
    expect(pending(deleted)).toBe(false);
  });
  it("reminders are optional dates, ordered independently and excluded when inactive", () => {
    const late = updateItem(createItem("Later date"), {
      reminderAt: "2030-06-10T12:30:00.000Z",
    });
    const early = updateItem(createItem("Earlier date"), {
      reminderAt: "2030-06-09T12:30:00.000Z",
    });
    const done = updateItem(late, { status: "done" });
    expect(
      selectItems([late, early, done], "reminders", { sort: "reminder" }),
    ).toEqual([early, late]);
    expect(done.reminderAt).toBe(late.reminderAt);
    expect(() => updateItem(early, { reminderAt: "tomorrow" })).toThrow();
  });
  const article = {
    ...updateItem(createItem("https://example.com/react"), {
      title: "React guide",
      tags: ["Development"],
      description: "hooks",
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const video = {
    ...createItem("https://youtu.be/abc"),
    createdAt: "2026-02-01T00:00:00.000Z",
  };
  const note = updateItem(createItem("Idea\nA camera project"), {
    intent: "buy",
    source: "manual",
  });
  const done = updateItem(article, { status: "done" });
  const archived = updateItem(video, { status: "archived" });
  it("uses intent for active queues, not type", () => {
    expect(inView(note, "shopping")).toBe(true);
    expect(inView(done, "read")).toBe(false);
    expect(inView(archived, "watch")).toBe(false);
    expect(inView(note, "notes")).toBe(true);
  });
  it("keeps done searchable but hides archives unless requested", () => {
    expect(selectItems([done, archived], "all")).toEqual([done]);
    expect(
      selectItems([done, archived], "all", { status: "archived" }),
    ).toEqual([archived]);
    expect(
      selectItems([done, archived], "all", { status: "any" }),
    ).toHaveLength(2);
  });
  it.each(["react", "EXAMPLE.COM", "hooks", "Development"])(
    "searches %s",
    (query) => {
      expect(selectItems([article, video, note], "all", { query })).toEqual([
        article,
      ]);
    },
  );
  it("searches full body and combines filters", () => {
    expect(
      selectItems([article, note], "all", {
        query: "camera",
        type: "note",
        intent: "buy",
        source: "manual",
      }),
    ).toEqual([note]);
    expect(
      selectItems([article, video], "all", {
        tag: "Development",
        status: "inbox",
      }),
    ).toEqual([article]);
    expect(selectItems([article, video], "all", { sort: "oldest" })[0]).toBe(
      article,
    );
    expect(selectItems([article, video], "all")[0]).toBe(video);
    expect(selectItems([article, video], "all", { sort: "title" })[0]).toBe(
      article,
    );
  });
});
