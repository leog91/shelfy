import { describe, expect, it, vi } from "vitest";
import { fetchClipsySummary } from "./clipsy";

const connection = {
  origin: "https://clipsy.example",
  accessToken: "x".repeat(43),
};
const summary = {
  videos: 5,
  toWatch: 3,
  watching: 2,
  collections: 1,
  subscriptions: 4,
};
describe("Clipsy summary transport", () => {
  it("uses a server credential, no cache, no redirects and a timeout", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(summary));
    expect(await fetchClipsySummary(connection, fetcher)).toEqual({
      summary,
      url: connection.origin,
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://clipsy.example/api/integrations/summary"),
      expect.objectContaining({
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          Accept: "application/json",
        },
      }),
    );
  });
  it.each([
    "http://clipsy.example",
    "https://user:pass@clipsy.example",
    "https://clipsy.example/other",
    "https://clipsy.example?token=x",
  ])("rejects unsafe origin %s before fetching", async (url) => {
    const fetcher = vi.fn();
    await expect(
      fetchClipsySummary({ ...connection, origin: url }, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    () => Response.json({ error: "Unauthorized" }, { status: 401 }),
    () => Response.json({ ...summary, videos: -1 }),
    () => Response.json({ ...summary, videos: 6 }),
    () => Response.json({ ...summary, email: "private@example.test" }),
    () =>
      new Response("x".repeat(4097), {
        headers: { "content-type": "application/json" },
      }),
    () => new Response("<html>error</html>"),
  ])(
    "rejects failed, malformed, inconsistent or oversized responses",
    async (response) => {
      await expect(
        fetchClipsySummary(connection, vi.fn().mockResolvedValue(response())),
      ).rejects.toThrow();
    },
  );
  it.each(["", "x".repeat(32), "x".repeat(64), "!".repeat(43)])(
    "rejects invalid access tokens before fetching",
    async (accessToken) => {
      const fetcher = vi.fn();
      await expect(
        fetchClipsySummary({ ...connection, accessToken }, fetcher),
      ).rejects.toThrow("Invalid Clipsy token");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
