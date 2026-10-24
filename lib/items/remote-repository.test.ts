import { afterEach, describe, expect, it, vi } from "vitest";
import { createItem } from "./model";
import { RemoteItemRepository } from "./remote-repository";

afterEach(() => vi.unstubAllGlobals());
describe("account repository lifecycle", () => {
  it("pins workspace identity, validates responses and retains state on failed writes", async () => {
    const item = createItem("Keep this note");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ version: 2, items: [item] }))
      .mockResolvedValueOnce(
        Response.json({ error: "Storage unavailable" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetch);
    const repository = new RemoteItemRepository("alice");
    await repository.load();
    expect(fetch.mock.calls[0][1].headers["X-Workspace-Id"]).toBe("alice");
    expect(repository.getSnapshot().items).toEqual([item]);
    await expect(repository.create("Unsaved draft")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(repository.getSnapshot().items).toEqual([item]);
  });
  it("clears private data on expiry/account change and never falls back to local writes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ version: 2, items: [createItem("Private")] }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Account changed" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetch);
    const repository = new RemoteItemRepository("alice");
    await repository.load();
    await repository.load();
    expect(repository.getSnapshot().items).toEqual([]);
    expect(repository.getSnapshot().error).toContain("account changed");
    await expect(
      repository.create("Do not save in wrong library"),
    ).rejects.toThrow(/Refresh/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not let a stale in-flight refresh erase a successful save", async () => {
    const first = createItem("First"),
      added = createItem("Added");
    let finishRefresh!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ version: 2, items: [first] }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishRefresh = resolve;
          }),
      )
      .mockResolvedValueOnce(Response.json({ item: added }));
    vi.stubGlobal("fetch", fetch);
    const repository = new RemoteItemRepository("alice");
    await repository.load();
    const refresh = repository.load();
    await repository.create("Added");
    finishRefresh(Response.json({ version: 2, items: [first] }));
    await refresh;
    expect(repository.getSnapshot().items.map((item) => item.title)).toEqual([
      "Added",
      "First",
    ]);
  });
});
