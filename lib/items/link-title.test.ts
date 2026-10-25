import { describe, expect, it } from "vitest";
import { displayTitle, linkTitle } from "./link-title";
import { createItem, selectItems } from "./model";

describe("local link titles", () => {
  it.each([
    ["https://en.wikipedia.org/wiki/Gone_Is_Gone?", "Gone Is Gone"],
    ["https://es.wikipedia.org/wiki/M%C3%BAsica#Historia", "Música"],
    [
      "https://amazon.ie/Useful-Product/dp/B012345678?tag=private",
      "Useful Product",
    ],
    [
      "https://www.amazon.com/gp/product/B012345678",
      "Amazon product B012345678",
    ],
    [
      "https://x.com/example_user/status/123456?foo=bar",
      "Post by @example_user",
    ],
    ["https://twitter.com/example/status/123456", "Post by @example"],
    ["https://x.com/i/status/123456", "x.com"],
    ["https://en.wikipedia.org/wiki/%E0%A4%A", "en.wikipedia.org"],
    [
      "https://en.wikipedia.org.evil.test/wiki/Fake_Title",
      "en.wikipedia.org.evil.test",
    ],
    [
      "https://amazon.ie.evil.test/Product/dp/B012345678",
      "amazon.ie.evil.test",
    ],
    ["https://example.com/path?token=secret", "example.com"],
    ["https://amzn.to/abc", "amzn.to"],
  ])("labels %s without a network request", (url, title) => {
    expect(linkTitle(url)).toBe(title);
    expect(createItem(url).title).toBe(title);
  });

  it("improves legacy display/search without changing saved or authored titles", () => {
    const item = {
      ...createItem("https://en.wikipedia.org/wiki/Gone_Is_Gone"),
      title: "en.wikipedia.org",
    };
    expect(displayTitle(item)).toBe("Gone Is Gone");
    expect(selectItems([item], "all", { query: "Gone Is Gone" })).toEqual([
      item,
    ]);
    expect(item.title).toBe("en.wikipedia.org");
    expect(displayTitle({ ...item, title: "My band" })).toBe("My band");
  });
});
