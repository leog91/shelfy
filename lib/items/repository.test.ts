import { beforeEach, describe, expect, it } from "vitest";
import { createItem } from "./model";
import {
  ItemRepository,
  parseLibrary,
  serializeLibrary,
  STORAGE_KEY,
  StoragePort,
} from "./repository";

describe("versioned repository", () => {
  let values: Map<string, string>;
  let storage: StoragePort;
  let repository: ItemRepository;
  beforeEach(() => {
    values = new Map();
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    repository = new ItemRepository(() => storage);
    repository.load();
  });
  it("starts empty without automatically writing demo content", () => {
    expect(repository.list()).toEqual([]);
    expect(values.size).toBe(0);
  });
  it("reads legacy v1 without changing content and upgrades on the next successful write", () => {
    const item = createItem("Legacy note\nKeep full content");
    const raw = JSON.stringify({ version: 1, items: [item] });
    values.set(STORAGE_KEY, raw);
    repository.load();
    expect(repository.get(item.id)).toEqual(item);
    expect(values.get(STORAGE_KEY)).toBe(raw);
    repository.update(item.id, { reminderAt: "2030-06-10T12:30:00.000Z" });
    const saved = JSON.parse(values.get(STORAGE_KEY)!);
    expect(saved.version).toBe(3);
    expect(saved.items[0]).toMatchObject({
      id: item.id,
      content: item.content,
      reminderAt: "2030-06-10T12:30:00.000Z",
    });
  });
  it("applies bulk lifecycle changes atomically and rejects stale selection", () => {
    const first = repository.create("One");
    const second = repository.create("Two");
    expect(() =>
      repository.bulkUpdate(
        [
          { id: first.id, expectedUpdatedAt: first.updatedAt },
          { id: second.id, expectedUpdatedAt: "stale" },
        ],
        "done",
      ),
    ).toThrow();
    expect(repository.get(first.id)?.status).toBe("inbox");
    repository.bulkUpdate(
      [first, second].map((item) => ({
        id: item.id,
        expectedUpdatedAt: item.updatedAt,
      })),
      "done",
    );
    expect(
      repository
        .list()
        .every((item) => item.status === "done" && item.completedAt),
    ).toBe(true);
  });
  it("supports CRUD, notifications and refresh persistence", () => {
    let notifications = 0;
    const unsubscribe = repository.subscribe(() => {
      notifications++;
    });
    const item = repository.create("https://example.com");
    repository.update(item.id, {
      title: "My article",
      intent: "read",
      status: "later",
    });
    expect(repository.get(item.id)?.title).toBe("My article");
    const refreshed = new ItemRepository(() => storage);
    refreshed.load();
    expect(refreshed.get(item.id)).toEqual(repository.get(item.id));
    repository.delete(item.id);
    expect(repository.list()).toEqual([]);
    expect(notifications).toBe(3);
    unsubscribe();
  });
  it.each([
    "not JSON",
    '{"version":99,"items":[]}',
    '{"version":1,"items":[{}]}',
  ])("blocks mutation without replacing unreadable storage: %s", (raw) => {
    values.set(STORAGE_KEY, raw);
    repository.load();
    expect(repository.getSnapshot().error).toBeTruthy();
    expect(() => repository.create("do not save")).toThrow();
    expect(repository.recovery()).toBe(raw);
    expect(values.get(STORAGE_KEY)).toBe(raw);
  });
  it("handles blocked reads and recovers on retry", () => {
    const blocked = new ItemRepository(() => {
      throw new Error("blocked");
    });
    blocked.load();
    expect(blocked.getSnapshot().ready).toBe(true);
    expect(blocked.getSnapshot().error).toBeTruthy();
    values.set(STORAGE_KEY, "bad");
    repository.load();
    values.delete(STORAGE_KEY);
    repository.load();
    expect(repository.getSnapshot().error).toBeUndefined();
  });
  it("keeps persisted and visible state unchanged when a write fails", () => {
    const item = repository.create("Important note");
    const raw = repository.export();
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(() => repository.update(item.id, { title: "Unsaved" })).toThrow(
      /Could not save/,
    );
    expect(repository.get(item.id)?.title).toBe("Important note");
    expect(repository.export()).toBe(raw);
  });
  it("refreshes before writes so non-simultaneous other-tab changes survive", () => {
    repository.create("One");
    const other = new ItemRepository(() => storage);
    other.load();
    other.create("Two");
    repository.create("Three");
    expect(repository.list()).toHaveLength(3);
  });
  it("round-trips valid exports, skips identical IDs, preserves conflicting imports", () => {
    const item = repository.create("One");
    const raw = repository.export();
    expect(parseLibrary(raw)).toEqual([item]);
    expect(repository.import(raw)).toMatchObject({ added: 0, skipped: 1 });
    const result = repository.import(
      serializeLibrary([
        { ...item, title: "Conflicting content" },
        createItem("Two"),
      ]),
    );
    expect(result).toMatchObject({ added: 2, skipped: 0 });
    expect(repository.get(item.id)?.title).toBe("One");
    expect(new Set(repository.list().map((i) => i.id)).size).toBe(3);
    expect(
      repository.list().find((i) => i.title === "Conflicting content")?.id,
    ).not.toBe(item.id);
  });
  it("rejects an invalid import atomically, including duplicate IDs", () => {
    const item = repository.create("Keep me");
    const raw = repository.export();
    expect(() => repository.import('{"version":99,"items":[]}')).toThrow();
    expect(() =>
      repository.import(JSON.stringify({ version: 1, items: [item, item] })),
    ).toThrow();
    expect(repository.export()).toBe(raw);
  });
});
