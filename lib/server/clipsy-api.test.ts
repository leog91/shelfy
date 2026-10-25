import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { openDatabase } from "../db/connection";
import { clipsyConnection, clipsyPending, user } from "../db/schema";
import { createClipsyApi } from "./clipsy-api";
import {
  credentialHash,
  randomCredential,
  seal,
  unseal,
} from "./clipsy-crypto";

const origin = "https://shelfy.example";
const secret = "test-only-encryption-secret-not-for-production";
const summary = {
  videos: 5,
  toWatch: 3,
  watching: 2,
  collections: 1,
  subscriptions: 4,
};
let database: ReturnType<typeof openDatabase>;
let owner: string | null;
let sessionId: string;
let api: ReturnType<typeof createClipsyApi>;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const token = randomCredential();

function request(
  action: string,
  method = "GET",
  query = "",
  workspace = owner ?? "alice",
  requestOrigin = origin,
) {
  return api(
    new Request(`${origin}/api/clipsy/${action}${query}`, {
      method,
      headers: { origin: requestOrigin, "x-workspace-id": workspace },
    }),
    action,
  );
}
async function start() {
  const response = await request("start", "POST");
  expect(response.status).toBe(200);
  return new URL((await response.json()).url);
}
function callback(
  url: URL,
  extra: Record<string, string> = { code: randomCredential() },
) {
  return request(
    "callback",
    "GET",
    `?${new URLSearchParams({ state: url.searchParams.get("state")!, ...extra })}`,
  );
}
beforeEach(async () => {
  database = openDatabase("file::memory:");
  await migrate(database.db, { migrationsFolder: "./drizzle" });
  await database.db.insert(user).values(
    ["alice", "bob"].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
  owner = "alice";
  sessionId = "session-alice";
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/token"))
      return Response.json({ token, expiresAt: Date.now() + 90 * 86400_000 });
    if (path.endsWith("/revoke")) return Response.json({ revoked: true });
    return Response.json(summary);
  });
  api = createClipsyApi({
    db: database.db,
    origin,
    secret,
    clipsyUrl: "https://clipsy.example",
    fetcher,
    resolveSession: async () =>
      owner ? { user: { id: owner }, session: { id: sessionId } } : null,
  });
});
afterEach(() => database.client.close());

describe("per-user Clipsy connection", () => {
  it("requires a session, workspace match and Origin for mutations", async () => {
    owner = null;
    expect((await request("status")).status).toBe(401);
    owner = "alice";
    expect((await request("start", "POST", "", "bob")).status).toBe(401);
    expect(
      (await request("start", "POST", "", "alice", "https://attacker.example"))
        .status,
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("connects with session-bound state and PKCE, stores encrypted credentials, never returns them", async () => {
    const url = await start();
    expect(url.origin).toBe("https://clipsy.example");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/clipsy/callback`,
    );
    const response = await callback(url);
    expect(response.headers.get("location")).toBe(
      `${origin}/account?clipsy=connected`,
    );
    const [saved] = await database.db.select().from(clipsyConnection);
    expect(saved.encryptedToken).not.toContain(token);
    expect(
      unseal(
        saved.encryptedToken,
        "alice",
        "access:https://clipsy.example",
        secret,
      ),
    ).toBe(token);
    expect(() =>
      unseal(
        saved.encryptedToken,
        "bob",
        "access:https://clipsy.example",
        secret,
      ),
    ).toThrow();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(credentialHash(body.verifier)).toBe(
      url.searchParams.get("code_challenge"),
    );
    const status = await request("status");
    expect(await status.json()).toEqual({
      connected: true,
      expired: false,
      url: "https://clipsy.example",
    });
    const counts = await request("summary");
    expect(await counts.json()).toEqual({
      connected: true,
      summary,
      url: "https://clipsy.example",
    });
    expect(counts.headers.get("cache-control")).toBe("private, no-store");
    expect((await request("start", "POST")).status).toBe(409);
  });
  it("does not link by email or share an owner's summary with another account", async () => {
    await callback(await start());
    owner = "bob";
    sessionId = "session-bob";
    expect(await (await request("summary")).json()).toEqual({
      connected: false,
    });
    expect((await database.db.select().from(clipsyConnection))[0].userId).toBe(
      "alice",
    );
  });
  it("rejects wrong state, changed sessions, and expired callbacks without exchanging a code", async () => {
    const url = await start();
    const wrong = new URL(url);
    wrong.searchParams.set("state", randomCredential());
    expect((await callback(wrong)).headers.get("location")).toContain("failed");
    sessionId = "new-session";
    expect((await callback(url)).headers.get("location")).toContain("failed");
    sessionId = "session-alice";
    await database.db.update(clipsyPending).set({ expiresAt: Date.now() - 1 });
    expect((await callback(url)).headers.get("location")).toContain("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("prevents callback replay and invalidates an older start", async () => {
    const first = await start();
    const second = await start();
    expect((await callback(first)).headers.get("location")).toContain("failed");
    expect((await callback(second)).headers.get("location")).toContain(
      "connected",
    );
    expect((await callback(second)).headers.get("location")).toContain(
      "failed",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("cancels without exchanging a token or saving a connection", async () => {
    const response = await callback(await start(), { error: "access_denied" });
    expect(response.headers.get("location")).toContain("cancelled");
    expect(await database.db.select().from(clipsyConnection)).toEqual([]);
    expect(await database.db.select().from(clipsyPending)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("revokes before deleting credentials and keeps them on upstream failure for retry", async () => {
    await callback(await start());
    fetcher.mockRejectedValueOnce(new Error("private failure"));
    expect((await request("disconnect", "POST")).status).toBe(503);
    expect(await database.db.select().from(clipsyConnection)).toHaveLength(1);
    expect((await request("disconnect", "POST")).status).toBe(200);
    expect(await database.db.select().from(clipsyConnection)).toEqual([]);
    expect(fetcher.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      Authorization: `Bearer ${token}`,
    });
  });
  it("does not save an in-flight grant after disconnect, and revokes the orphaned token", async () => {
    const url = await start();
    let release!: (response: Response) => void;
    let exchanged!: () => void;
    const waiting = new Promise<void>((resolve) => {
      exchanged = resolve;
    });
    fetcher.mockImplementationOnce(() => {
      exchanged();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    const result = callback(url);
    await waiting;
    await request("disconnect", "POST");
    release(Response.json({ token, expiresAt: Date.now() + 86400_000 }));
    expect((await result).headers.get("location")).toContain("failed");
    expect(await database.db.select().from(clipsyConnection)).toEqual([]);
    expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain("/revoke");
  });
  it("does not expose expired tokens or upstream exceptions", async () => {
    await database.db.insert(clipsyConnection).values({
      userId: "alice",
      remoteOrigin: "https://clipsy.example",
      encryptedToken: seal(
        token,
        "alice",
        "access:https://clipsy.example",
        secret,
      ),
      expiresAt: Date.now() - 1,
    });
    const response = await request("summary");
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(token);
    expect(fetcher).not.toHaveBeenCalled();
    await database.db
      .delete(clipsyConnection)
      .where(eq(clipsyConnection.userId, "alice"));
  });
});
