import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { checkServerIdentity } from "node:tls";
import ipaddr from "ipaddr.js";
import { load } from "cheerio/slim";
import { safeUrl } from "../items/model";

const MAX_BYTES = 512 * 1024;
export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function metadataUrl(value: string): URL {
  if (!safeUrl(value))
    throw new Error("Only HTTP(S) URLs without credentials are allowed.");
  const url = new URL(value);
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Only standard web ports are allowed.");
  return url;
}
type Address = { address: string; family: number };
export async function resolvePublic(
  url: URL,
  resolver = (hostname: string) =>
    lookup(hostname, { all: true, verbatim: true }),
): Promise<Address> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolver(host);
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new Error("This URL is not on a public network.");
  return addresses[0];
}
type PageResponse = {
  status: number;
  location?: string;
  contentType: string;
  body: string;
};
// Connect to the checked IP directly, preserving the original HTTP Host and TLS identity.
// No second hostname lookup, cookie jar, proxy env, credential forwarding or remote JS execution.
function fetchPinned(
  url: URL,
  address: Address,
  signal: AbortSignal,
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        hostname: address.address,
        family: address.family,
        agent: false,
        signal,
        ...(url.protocol === "https:"
          ? {
              servername: isIP(host) ? undefined : host,
              checkServerIdentity: (_name, cert) =>
                checkServerIdentity(host, cert),
            }
          : {}),
        headers: {
          Host: url.host,
          "User-Agent": "PersonalLibraryPreview/1.0",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        void consumeHtmlResponse(response).then(resolve, reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}
export function consumeHtmlResponse(
  response: IncomingMessage,
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    response.on("error", reject);
    const status = response.statusCode ?? 0;
    const contentType = String(
      response.headers["content-type"] ?? "",
    ).toLowerCase();
    if (status >= 300 && status < 400) {
      response.destroy();
      resolve({
        status,
        location: response.headers.location,
        contentType,
        body: "",
      });
      return;
    }
    if (
      status !== 200 ||
      !/^(text\/html|application\/xhtml\+xml)(;|$)/.test(contentType)
    ) {
      response.destroy();
      reject(new Error("This page did not return HTML."));
      return;
    }
    if (
      (response.headers["content-encoding"] &&
        response.headers["content-encoding"] !== "identity") ||
      Number(response.headers["content-length"]) > MAX_BYTES
    ) {
      response.destroy();
      reject(new Error("Preview content is too large or compressed."));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        response.destroy();
        reject(new Error("Preview content exceeds the size limit."));
      } else chunks.push(chunk);
    });
    response.on("end", () =>
      resolve({
        status,
        contentType,
        body: Buffer.concat(chunks).toString("utf8"),
      }),
    );
  });
}
export function extractMetadata(html: string) {
  const $ = load(html);
  const clean = (value: string | undefined, max: number) =>
    value?.replace(/\s+/g, " ").trim().slice(0, max) || undefined;
  return {
    title: clean(
      $('meta[property="og:title"]').attr("content") ??
        $("title").first().text(),
      500,
    ),
    description: clean(
      $('meta[property="og:description"]').attr("content") ??
        $('meta[name="description"]').attr("content"),
      10000,
    ),
  };
}
export async function fetchMetadata(
  value: string,
  dependencies = { resolve: resolvePublic, fetch: fetchPinned },
  timeoutMs = 8000,
) {
  const signal = AbortSignal.timeout(timeoutMs);
  // This bounds DNS, every redirect and body together, not just socket inactivity.
  const timeout = new Promise<never>((_, reject) =>
    signal.addEventListener(
      "abort",
      () => reject(new Error("Preview request timed out.")),
      { once: true },
    ),
  );
  const work = async () => {
    let url = metadataUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      signal.throwIfAborted();
      const address = await dependencies.resolve(url);
      signal.throwIfAborted();
      const response = await dependencies.fetch(url, address, signal);
      if (response.status >= 300 && response.status < 400) {
        if (!response.location || redirects === 3)
          throw new Error("Too many or invalid redirects.");
        url = metadataUrl(new URL(response.location, url).href);
      } else return extractMetadata(response.body);
    }
    throw new Error("Could not fetch preview.");
  };
  return Promise.race([work(), timeout]);
}
