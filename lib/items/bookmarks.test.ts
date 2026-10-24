import { describe, expect, it } from "vitest";
import { parseBookmarks } from "./bookmarks";
import { envelopeSchema } from "./model";

describe("inert bookmark import", () => {
  it("preserves authored titles, original URL parameters and known save dates", () => {
    const result = parseBookmarks(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com?offer=1&amp;keep=2" ADD_DATE="1700000000">My &amp; title</A><DT><A HREF="https://youtu.be/abc">Video</A></DL>',
    );
    expect(result.items[0]).toMatchObject({
      title: "My & title",
      url: "https://example.com?offer=1&keep=2",
      source: "browser-bookmarks",
      createdAt: new Date(1700000000000).toISOString(),
    });
    expect(result.items[1]).toMatchObject({ type: "video", intent: "watch" });
    expect(
      envelopeSchema.safeParse({ version: 1, items: result.items }).success,
    ).toBe(true);
  });
  it("never imports unsafe schemes, executes scripts, or drops distinct same-URL contexts", () => {
    const result = parseBookmarks(
      '<script>throw new Error()</script><img src="http://localhost"><a href="javascript:alert(1)">bad</a><a href="file:///etc/passwd">bad</a><a href="https://example.com">One</a><a href="https://example.com">Two</a>',
    );
    expect(result.skipped).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).not.toBe(result.items[1].id);
    expect(parseBookmarks("no bookmarks").items).toEqual([]);
  });
});
