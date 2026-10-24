import { load } from "cheerio/slim";
import { createItem, Item, safeUrl } from "./model";

// Parses a user-selected Netscape/Chrome/Firefox bookmark export as inert data.
// No DOM insertion, scripts, remote images, fetch or provider-specific assumptions.
export function parseBookmarks(html: string): {
  items: Item[];
  skipped: number;
} {
  const $ = load(html);
  const items: Item[] = [];
  let skipped = 0;
  $("a").each((_, node) => {
    const link = $(node);
    const url = link.attr("href")?.trim();
    if (!url || !safeUrl(url)) {
      skipped++;
      return;
    }
    const item = createItem(url);
    item.title = link.text().trim().slice(0, 500) || item.title;
    item.source = "browser-bookmarks";
    const saved = Number(link.attr("add_date"));
    if (saved > 0 && saved * 1000 <= Date.now())
      item.createdAt = new Date(saved * 1000).toISOString();
    const description = link.next("dd").text().trim().slice(0, 10000);
    if (description) item.description = description;
    items.push(item);
  });
  return { items, skipped };
}
