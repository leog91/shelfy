// Explicit roots only: never infer a retailer from URL text or a guessed TLD.
// Add another shop/site here; matching also accepts its real subdomains.
export const linkSites = [
  {
    id: "amazon",
    label: "Amazon",
    icon: "shop",
    intent: "buy",
    domains: [
      "amazon.com",
      "amazon.co.uk",
      "amazon.de",
      "amazon.fr",
      "amazon.it",
      "amazon.es",
      "amazon.nl",
      "amazon.com.be",
      "amazon.pl",
      "amazon.se",
      "amazon.ie",
      "amazon.ca",
      "amazon.com.mx",
      "amazon.com.br",
      "amazon.co.jp",
      "amazon.in",
      "amazon.com.au",
      "amazon.sg",
      "amazon.ae",
      "amazon.sa",
      "amazon.com.tr",
      "amazon.co.za",
      "amazon.eg",
      "amzn.to",
      "amzn.eu",
    ],
  },
  {
    id: "zalando",
    label: "Zalando",
    icon: "shop",
    intent: "buy",
    domains: [
      "zalando.com",
      "zalando.de",
      "zalando.at",
      "zalando.ch",
      "zalando.nl",
      "zalando.be",
      "zalando.fr",
      "zalando.it",
      "zalando.es",
      "zalando.co.uk",
      "zalando.ie",
      "zalando.se",
      "zalando.no",
      "zalando.dk",
      "zalando.fi",
      "zalando.pl",
      "zalando.cz",
      "zalando.sk",
      "zalando.si",
      "zalando.hr",
      "zalando.ro",
      "zalando.hu",
      "zalando.lt",
      "zalando.lv",
      "zalando.ee",
      "zalando.lu",
      "zalando.pt",
      "zalando.gr",
      "zalando.bg",
    ],
  },
  {
    id: "etsy",
    label: "Etsy",
    icon: "shop",
    intent: "buy",
    domains: ["etsy.com"],
  },
  {
    id: "ebay",
    label: "eBay",
    icon: "shop",
    intent: "buy",
    domains: [
      "ebay.com",
      "ebay.co.uk",
      "ebay.de",
      "ebay.fr",
      "ebay.it",
      "ebay.es",
      "ebay.at",
      "ebay.ch",
      "ebay.ie",
      "ebay.com.au",
      "ebay.ca",
      "ebay.nl",
      "ebay.be",
      "ebay.pl",
    ],
  },
  {
    id: "ikea",
    label: "IKEA",
    icon: "shop",
    intent: "buy",
    domains: ["ikea.com"],
  },
  {
    id: "blue-tomato",
    label: "Blue Tomato",
    icon: "shop",
    intent: "buy",
    domains: ["blue-tomato.com"],
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: "youtube",
    intent: "watch",
    domains: ["youtube.com", "youtu.be"],
  },
  {
    id: "x",
    label: "X (Twitter)",
    icon: "x",
    intent: "read",
    domains: ["x.com", "twitter.com"],
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: "reddit",
    intent: "read",
    domains: ["reddit.com", "redd.it"],
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    icon: "wikipedia",
    intent: "read",
    domains: ["wikipedia.org"],
  },
  {
    id: "google-search",
    label: "Google Search",
    icon: "google",
    intent: "read",
    domains: [
      "google.com",
      "google.co.uk",
      "google.es",
      "google.de",
      "google.fr",
      "google.it",
      "google.pt",
      "google.nl",
      "google.ca",
      "google.com.au",
      "google.com.br",
      "google.co.jp",
    ],
    paths: ["/search"],
  },
] as const;

export type LinkSite = (typeof linkSites)[number];

export function detectLinkSite(
  value: string | undefined,
): LinkSite | undefined {
  if (!value || /\s/.test(value.trim())) return undefined;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return linkSites.find((site) => {
      if ("paths" in site)
        return (
          site.paths.some((path) => path === url.pathname) &&
          site.domains.some(
            (domain) => host === domain || host === `www.${domain}`,
          )
        );
      return site.domains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      );
    });
  } catch {
    return undefined;
  }
}
