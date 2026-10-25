import { clipsySummarySchema } from "../clipsy";

export function clipsyOrigin(value = "https://clipsy-web-sepia.vercel.app") {
  const url = new URL(value);
  const local =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (!local && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid Clipsy origin");
  return url.origin;
}

export async function readClipsyJson(response: Response) {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("Clipsy unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response");
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new Error("Response too large");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    await reader.cancel();
  }
}

export async function clipsyPost(
  origin: string,
  path: "token" | "revoke",
  body: unknown,
  fetcher = fetch,
  token?: string,
) {
  const response = await fetcher(
    new URL(`/api/integrations/shelfy/${path}`, clipsyOrigin(origin)),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    },
  );
  return readClipsyJson(response);
}

export async function fetchClipsySummary(
  connection: {
    origin: string;
    accessToken: string;
  },
  fetcher = fetch,
) {
  const url = new URL(clipsyOrigin(connection.origin));
  // Per-user credential decrypted by the caller, bound to its saved provider origin.
  const token = connection.accessToken;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Invalid Clipsy token");
  const response = await fetcher(new URL("/api/integrations/summary", url), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  return {
    summary: clipsySummarySchema.parse(await readClipsyJson(response)),
    url: url.origin,
  };
}
