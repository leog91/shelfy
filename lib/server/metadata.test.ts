import { describe, expect, it, vi } from "vitest";
import {
  consumeHtmlResponse,
  extractMetadata,
  fetchMetadata,
  metadataUrl,
  publicAddress,
  resolvePublic,
} from "./metadata";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

describe("safe optional metadata", () => {
  it("bounds response bytes and content types, refuses compression, and avoids reading redirect bodies", async () => {
    const response = () => {
      const value = new IncomingMessage(new Socket());
      value.statusCode = 200;
      value.headers = { "content-type": "text/html; charset=utf-8" };
      return value;
    };
    const valid = response();
    const read = consumeHtmlResponse(valid);
    valid.push(Buffer.from("<title>Valid</title>"));
    valid.push(null);
    expect((await read).body).toContain("Valid");
    const wrong = response();
    wrong.headers["content-type"] = "image/png";
    await expect(consumeHtmlResponse(wrong)).rejects.toThrow(/HTML/);
    const compressed = response();
    compressed.headers["content-encoding"] = "gzip";
    await expect(consumeHtmlResponse(compressed)).rejects.toThrow(/compressed/);
    const huge = response();
    huge.headers["content-length"] = String(512 * 1024 + 1);
    await expect(consumeHtmlResponse(huge)).rejects.toThrow(/large/);
    const chunked = response();
    const overflow = consumeHtmlResponse(chunked);
    chunked.push(Buffer.alloc(512 * 1024 + 1));
    await expect(overflow).rejects.toThrow(/size limit/);
    const redirect = response();
    redirect.statusCode = 302;
    redirect.headers.location = "/next";
    expect((await consumeHtmlResponse(redirect)).body).toBe("");
    expect(redirect.destroyed).toBe(true);
  });
  it("times out DNS rather than allowing an unbounded resolver", async () => {
    const resolve = () => new Promise<never>(() => {});
    const fetch = vi.fn();
    await expect(
      fetchMetadata("https://example.com", { resolve, fetch }, 10),
    ).rejects.toThrow(/timed out/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "172.16.2.3",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("rejects nonpublic address %s", (ip) => {
    expect(publicAddress(ip)).toBe(false);
  });
  it("permits public unicast and rejects unsafe schemes/credentials/ports", () => {
    expect(publicAddress("1.1.1.1")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com",
      "http://user:pass@example.com",
      "http://example.com:3000",
    ])
      expect(() => metadataUrl(url)).toThrow();
  });
  it("validates every DNS result and rejects normalized alternate IP forms", async () => {
    await expect(
      resolvePublic(new URL("http://example.com"), async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    ).rejects.toThrow();
    for (const url of [
      "http://2130706433",
      "http://0x7f000001",
      "http://[::ffff:127.0.0.1]",
      "http://[::1]",
    ])
      await expect(resolvePublic(new URL(url))).rejects.toThrow();
  });
  it("extracts text without executing HTML and supports safe fallback", () => {
    expect(
      extractMetadata(
        '<title>Fallback &amp; title</title><meta property="og:title" content="Chosen title"><meta name="description" content=" A  description "><script>throw new Error()</script>',
      ),
    ).toEqual({ title: "Chosen title", description: "A description" });
    expect(extractMetadata("<html></html>")).toEqual({
      title: undefined,
      description: undefined,
    });
  });
  it("rechecks redirects and prevents redirect-to-private or DNS rebinding", async () => {
    const fetch = vi.fn(async () => ({
      status: 302,
      location: "http://127.0.0.1/secret",
      contentType: "",
      body: "",
    }));
    const resolve = vi.fn(async (url: URL) => {
      if (url.hostname === "127.0.0.1") throw new Error("private");
      return { address: "1.1.1.1", family: 4 };
    });
    await expect(
      fetchMetadata("https://example.com", { resolve, fetch }),
    ).rejects.toThrow("private");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
  it("bounds redirect loops and keeps caller URL unchanged", async () => {
    const fetch = vi.fn(async () => ({
      status: 302,
      location: "/loop",
      contentType: "",
      body: "",
    }));
    const resolve = vi.fn(async () => ({ address: "1.1.1.1", family: 4 }));
    await expect(
      fetchMetadata("https://example.com/original?keep=1", { resolve, fetch }),
    ).rejects.toThrow(/redirect/);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
