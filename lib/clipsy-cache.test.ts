import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipsySummaryCache, CLIPSY_CACHE_TTL } from "./clipsy-cache";

const summary = {
  videos: 5,
  toWatch: 3,
  watching: 2,
  collections: 1,
  subscriptions: 4,
};
const response = () =>
  Response.json({ connected: true, summary, url: "https://clipsy.example" });
afterEach(() => vi.useRealTimers());

describe("document-scoped Clipsy summary cache", () => {
  it("reuses successful counts for six hours and refetches at expiry", async () => {
    vi.useFakeTimers();
    const cache = new ClipsySummaryCache();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const first = await cache.load("alice", { fetcher });
    vi.advanceTimersByTime(CLIPSY_CACHE_TTL - 1);
    expect(await cache.load("alice", { fetcher })).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    const next = await cache.load("alice", { fetcher });
    expect(next?.fetchedAt).toBe(first!.fetchedAt + CLIPSY_CACHE_TTL);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("forced refresh bypasses fresh data and updates its timestamp", async () => {
    vi.useFakeTimers();
    const cache = new ClipsySummaryCache();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const first = await cache.load("alice", { fetcher });
    vi.advanceTimersByTime(1000);
    const next = await cache.load("alice", { force: true, fetcher });
    expect(next?.fetchedAt).toBe(first!.fetchedAt + 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/clipsy",
      expect.objectContaining({
        cache: "no-store",
        headers: { "x-workspace-id": "alice" },
      }),
    );
  });
  it("never shares counts across accounts, providers, tabs or reloads", async () => {
    const cache = new ClipsySummaryCache();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    await cache.load("alice", { fetcher });
    expect(cache.getSnapshot("bob")).toBeNull();
    expect(new ClipsySummaryCache().getSnapshot("alice")).toBeNull();
    await cache.load("bob", { fetcher });
    expect(cache.getSnapshot("alice")).toBeNull();
    expect(cache.getSnapshot("bob")?.owner).toBe("bob");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    () => Response.json({ error: "Unavailable" }, { status: 503 }),
    () =>
      Response.json({
        connected: true,
        summary: { ...summary, videos: -1 },
        url: "https://clipsy.example",
      }),
  ])(
    "discards old counts on a failed forced refresh and never caches errors",
    async (failed) => {
      const cache = new ClipsySummaryCache();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response())
        .mockResolvedValueOnce(failed())
        .mockResolvedValueOnce(response());
      await cache.load("alice", { fetcher });
      await expect(
        cache.load("alice", { force: true, fetcher }),
      ).rejects.toThrow();
      expect(cache.getSnapshot("alice")).toBeNull();
      await cache.load("alice", { fetcher });
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );
  it("clears counts on disconnect and prevents an in-flight response from restoring them", async () => {
    const cache = new ClipsySummaryCache();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const pending = cache.load("alice", { fetcher });
    cache.clear();
    resolve(response());
    expect(await pending).toBeNull();
    expect(cache.getSnapshot("alice")).toBeNull();
  });
  it("does not cache a disconnected response", async () => {
    const cache = new ClipsySummaryCache();
    await cache.load("alice", {
      fetcher: vi.fn().mockResolvedValue(Response.json({ connected: false })),
    });
    expect(cache.getSnapshot("alice")).toBeNull();
  });
  it("deduplicates in-flight reads across route/effect remounts", async () => {
    const cache = new ClipsySummaryCache();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const first = cache.load("alice", { fetcher });
    const second = cache.load("alice", { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(response());
    expect(await first).toBe(await second);
  });
});
