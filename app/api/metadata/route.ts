import { z } from "zod";
import { sql } from "drizzle-orm";
import { rateLimit } from "@/lib/db/schema";
import { apiError, json, readJson } from "@/lib/server/item-api";
import { HttpError } from "@/lib/server/items";
import { fetchMetadata } from "@/lib/server/metadata";
import { getRuntime } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    const { db, auth, origin } = getRuntime();
    if (request.headers.get("origin") !== origin)
      throw new HttpError(403, "Use the configured app origin.");
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      throw new HttpError(
        401,
        "Sign in to fetch link metadata. Saving does not require metadata.",
      );
    const expectedAccount = request.headers.get("x-workspace-id");
    if (expectedAccount && expectedAccount !== session.user.id)
      throw new HttpError(
        401,
        "Your account changed. Reload before fetching metadata.",
      );
    const { url } = z
      .object({ url: z.string().max(10000) })
      .strict()
      .parse(await readJson(request, 16000));
    const window = Math.floor(Date.now() / 60000) * 60000;
    const key = `metadata:${session.user.id}`;
    // Atomic database-backed fixed window; at most 10 requests/user/minute.
    const [counter] = await db
      .insert(rateLimit)
      .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: window })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          count: sql`CASE WHEN ${rateLimit.lastRequest} = ${window} THEN ${rateLimit.count} + 1 ELSE 1 END`,
          lastRequest: window,
        },
      })
      .returning();
    if (counter.count > 10)
      throw new HttpError(
        429,
        "Preview limit reached. Try again in a minute; capture still works.",
      );
    try {
      return json(await fetchMetadata(url));
    } catch {
      throw new HttpError(
        422,
        "Could not safely fetch this page. Your saved item is unchanged; edit the title manually.",
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
