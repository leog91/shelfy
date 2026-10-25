import { detectLinkSite } from "./link-sites";

function words(value: string): string {
  try {
    return decodeURIComponent(value)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

// Local hints only: never fetch, inspect query tokens, or guess page content.
export function linkTitle(value: string): string {
  const url = new URL(value);
  const host = url.hostname.replace(/^www\./, "");
  let title = "";
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) {
    const article = /^\/wiki\/(.+)$/.exec(url.pathname);
    if (article) title = words(article[1]);
  }
  const site = detectLinkSite(value);
  if (site?.id === "amazon") {
    const product =
      /^\/(?:([^/]+)\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i.exec(
        url.pathname,
      );
    if (product)
      title =
        (product[1] && words(product[1])) || `Amazon product ${product[2]}`;
  }
  if (site?.id === "x") {
    const post = /^\/([A-Za-z0-9_]{1,15})\/status\/\d+(?:\/|$)/.exec(
      url.pathname,
    );
    if (post && post[1] !== "i") title = `Post by @${post[1]}`;
  }
  return (title || host).slice(0, 500);
}

export function displayTitle(item: { title: string; url?: string }): string {
  if (!item.url) return item.title;
  const host = new URL(item.url).hostname;
  return item.title === host || item.title === host.replace(/^www\./, "")
    ? linkTitle(item.url)
    : item.title;
}
