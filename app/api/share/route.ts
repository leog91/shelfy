import { json } from "@/lib/server/item-api";

// Unauthenticated OS/browser handoff only: never reads or writes any saved data.
// A bounded form becomes a review-page fragment, not a request URL containing private text.
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (
      !type.startsWith("application/x-www-form-urlencoded") &&
      !type.startsWith("multipart/form-data")
    )
      return json({ error: "Unsupported share format." }, 415);
    if (Number(request.headers.get("content-length")) > 32000 || !request.body)
      return json({ error: "Share is too large." }, 413);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32000) {
        await reader.cancel();
        return json({ error: "Share is too large." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Response(bytes, {
      headers: { "Content-Type": type },
    }).formData();
    const get = (key: string) =>
      typeof form.get(key) === "string"
        ? String(form.get(key)).slice(0, 6000)
        : "";
    const text = get("text"),
      url = get("url"),
      title = get("title");
    const content =
      text && url && text !== url
        ? `${title || "Shared page"}\n${text}\n\nSource: ${url}`
        : text || url || title;
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/capture#text=${encodeURIComponent(content)}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return json(
      {
        error:
          "Could not read shared content. Paste it directly into capture instead.",
      },
      400,
    );
  }
}
