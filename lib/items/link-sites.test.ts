import { describe, expect, it } from "vitest";
import { detectLinkSite, linkSites } from "./link-sites";
import { createItem, inView, updateItem } from "./model";

describe("known link sites", () => {
  it.each(linkSites)(
    "matches $label roots and actual subdomains, never lookalikes",
    (site) => {
      for (const domain of site.domains) {
        const path = "paths" in site ? site.paths[0] : "/item";
        expect(detectLinkSite(`https://${domain}${path}?keep=1#details`)).toBe(
          site,
        );
        expect(detectLinkSite(`https://www.${domain}${path}`)).toBe(site);
        expect(
          detectLinkSite(`https://${domain}.evil.example/`),
        ).toBeUndefined();
        expect(detectLinkSite(`https://not-${domain}/`)).toBeUndefined();
      }
    },
  );
  it.each(linkSites.filter((site) => site.intent === "buy"))(
    "sends new $label links to Shopping without guessing product type",
    (site) => {
      const url = `https://www.${site.domains[0]}/product?variant=blue#size`;
      const item = createItem(url);
      expect(item).toMatchObject({
        type: "link",
        intent: "buy",
        status: "inbox",
        url,
      });
      expect(inView(item, "shopping")).toBe(true);
      expect(createItem(url, "read").intent).toBe("read");
      expect(createItem(url, "none").intent).toBe("none");
    },
  );
  it.each([
    ["https://amazon.de/dp/item", "amazon"],
    ["https://AMAZON.CO.UK/item", "amazon"],
    ["https://amazon.com./item", "amazon"],
    ["https://amzn.to/short", "amazon"],
    ["https://www.zalando.at/shoes", "zalando"],
    ["https://www.blue-tomato.com/en-GB/product/example", "blue-tomato"],
    ["https://mobile.twitter.com/user/status/1", "x"],
    ["https://x.com/user/status/1", "x"],
    ["https://old.reddit.com/r/example/comments/1", "reddit"],
    ["https://redd.it/abc", "reddit"],
    ["https://en.wikipedia.org/wiki/RAG", "wikipedia"],
    ["https://es.m.wikipedia.org/wiki/Python", "wikipedia"],
    ["https://www.google.com/search?q=rag", "google-search"],
    ["https://www.google.es/search?q=python", "google-search"],
  ])("recognizes %s", (url, id) => expect(detectLinkSite(url)?.id).toBe(id));
  it.each([
    undefined,
    "not a URL",
    "https://example.com/amazon.de",
    "https://example.com/?url=https://zalando.de",
    "https://amazon.fake",
    "https://zalando.invalid",
    "https://blue-tomato.com.evil.example",
    "https://notreddit.com",
    "https://wikipedia.org.evil.example/wiki/RAG",
    "https://www.google.com/maps",
    "https://maps.google.com/search?q=rag",
    "https://www.google.com/",
    "https://www.google.com.evil.example/search?q=rag",
    "https://google.fake/search?q=rag",
    "https://amazon.de@evil.example/",
    "https://user:password@amazon.de/",
    "ftp://amazon.de/item",
    "javascript:alert(1)",
    "https://amazon.de/item note",
    "A note about https://amazon.de/item",
  ])("does not infer a site from unsafe or misleading input %s", (url) =>
    expect(detectLinkSite(url)).toBeUndefined(),
  );
  it("keeps social links for reading and notes unclassified", () => {
    for (const url of [
      "https://x.com/person/status/1",
      "https://www.reddit.com/r/example",
    ]) {
      expect(createItem(url)).toMatchObject({ type: "link", intent: "read" });
      expect(createItem(url, "reference").intent).toBe("reference");
    }
    expect(createItem("Look at https://amazon.de/item")).toMatchObject({
      type: "note",
      intent: "none",
    });
  });
  it("never reclassifies existing authored fields when detecting or editing a link", () => {
    const saved = createItem("https://amazon.de/item", "reference");
    detectLinkSite(saved.url);
    expect(saved.intent).toBe("reference");
    expect(updateItem(saved, { title: "Authored title" })).toMatchObject({
      title: "Authored title",
      intent: "reference",
      type: "link",
    });
  });
});
