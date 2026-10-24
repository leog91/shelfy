import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { openDatabase } from "../db/connection";
import { session } from "../db/schema";
import { createAuth } from "./auth-factory";
import { createItemApi } from "./item-api";

const origin = "http://localhost:3000";
const connection = openDatabase("file::memory:");
const auth = createAuth(connection.db, {
  baseUrl: origin,
  secret: "local-test-only-secret-not-for-production-123456789",
  allowSignUp: true,
});
const api = createItemApi({
  db: connection.db,
  origin,
  resolveUser: async (request) =>
    (await auth.api.getSession({ headers: request.headers }))?.user.id ?? null,
});
let alice: string, bob: string;
let item: { id: string; updatedAt: string };
function request(
  path = "",
  cookie = "",
  method = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return api(
    new Request(`${origin}/api/items${path}`, {
      method,
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function signup(email: string) {
  const response = await auth.handler(
    new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({
        name: email.split("@")[0],
        email,
        password: "test-only-password-123",
      }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
beforeAll(async () => {
  await migrate(connection.db, { migrationsFolder: "./drizzle" });
  alice = await signup("alice@example.test");
  bob = await signup("bob@example.test");
});
afterAll(() => connection.client.close());

describe("real Better Auth sessions and owner-scoped API", () => {
  it("rejects unauthenticated reads, writes, export and import", async () => {
    for (const [path, method, body] of [
      ["", "GET", undefined],
      ["", "POST", { text: "Secret" }],
      ["/export", "GET", undefined],
      ["/import", "POST", { version: 1, items: [] }],
    ] as const)
      expect((await request(path, "", method, body)).status).toBe(401);
  });
  it("creates with server identity, rejects forged ownership and unsafe content", async () => {
    expect(
      (
        await request("", alice, "POST", {
          text: "Do not accept",
          userId: "bob",
        })
      ).status,
    ).toBe(400);
    expect(
      (await request("", alice, "POST", { text: "ftp://example.com" })).status,
    ).toBe(400);
    const response = await request("", alice, "POST", {
      text: "https://example.com/react?keep=1",
    });
    expect(response.status).toBe(201);
    item = (await response.json()).item;
    expect(item).not.toHaveProperty("userId");
  });
  it("does not leak other users' lists, IDs, search data or exports", async () => {
    expect((await (await request("?query=react", bob)).json()).items).toEqual(
      [],
    );
    expect((await request(`/${item.id}`, bob)).status).toBe(404);
    expect(
      (
        await request(`/${item.id}`, bob, "PATCH", {
          patch: { title: "Stolen" },
          expectedUpdatedAt: item.updatedAt,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`/${item.id}`, bob, "DELETE", {
          expectedUpdatedAt: item.updatedAt,
        })
      ).status,
    ).toBe(404);
    expect((await (await request("/export", bob)).json()).items).toEqual([]);
    const exported = await request("/export", alice);
    expect(exported.headers.get("cache-control")).toContain("no-store");
    expect((await exported.json()).items).toHaveLength(1);
  });
  it("blocks cross-origin and missing-origin mutations", async () => {
    expect(
      (
        await request(
          "",
          alice,
          "POST",
          { text: "no" },
          { origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await api(
          new Request(`${origin}/api/items`, {
            method: "POST",
            headers: { cookie: alice, "content-type": "application/json" },
            body: '{"text":"no"}',
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("rejects an outdated workspace after a different user signs in in another tab", async () => {
    const aliceSession = await auth.api.getSession({
      headers: new Headers({ cookie: alice }),
    });
    expect(
      (
        await request("", bob, "GET", undefined, {
          "x-workspace-id": aliceSession!.user.id,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "",
          bob,
          "POST",
          { text: "Wrong workspace" },
          { "x-workspace-id": aliceSession!.user.id },
        )
      ).status,
    ).toBe(401);
  });
  it("validates full edits, supports clearing optional fields, detects stale edits/deletes", async () => {
    const invalid = await request(`/${item.id}`, alice, "PATCH", {
      patch: { url: "javascript:alert(1)" },
      expectedUpdatedAt: item.updatedAt,
    });
    expect(invalid.status).toBe(400);
    const updated = await request(`/${item.id}`, alice, "PATCH", {
      patch: { title: "React guide", description: "Context", status: "done" },
      expectedUpdatedAt: item.updatedAt,
    });
    expect(updated.status).toBe(200);
    const next = (await updated.json()).item;
    expect(next.completedAt).toBeTruthy();
    expect(next.updatedAt).not.toBe(item.updatedAt);
    expect(
      (
        await request(`/${item.id}`, alice, "PATCH", {
          patch: { title: "Lost update" },
          expectedUpdatedAt: item.updatedAt,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/${item.id}`, alice, "DELETE", {
          expectedUpdatedAt: item.updatedAt,
        })
      ).status,
    ).toBe(409);
    const cleared = await request(`/${item.id}`, alice, "PATCH", {
      patch: { description: null },
      expectedUpdatedAt: next.updatedAt,
    });
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).item).not.toHaveProperty("description");
  });
  it("imports atomically/additively per owner and preserves conflicting IDs", async () => {
    const library = await (await request("/export", alice)).json();
    expect(
      await (await request("/import", alice, "POST", library)).json(),
    ).toEqual({ added: 0, skipped: 1 });
    const divergent = {
      version: 1,
      items: [{ ...library.items[0], title: "Keep both" }],
    };
    expect(
      (await (await request("/import", alice, "POST", divergent)).json()).added,
    ).toBe(1);
    expect(
      (await (await request("/import", bob, "POST", library)).json()).added,
    ).toBe(1);
    expect((await (await request("", alice)).json()).items).toHaveLength(2);
    expect((await (await request("", bob)).json()).items).toHaveLength(1);
    expect(
      (
        await request("/import", alice, "POST", {
          version: 1,
          items: [library.items[0], { invalid: true }],
        })
      ).status,
    ).toBe(400);
    expect((await (await request("", alice)).json()).items).toHaveLength(2);
  });
  it("applies authorized bulk actions atomically and rejects mixed-owner selection", async () => {
    const aliceItems = (await (await request("", alice)).json()).items;
    const bobOnly = await (
      await request("", bob, "POST", { text: "Bob private note" })
    ).json();
    const selected = [
      { id: aliceItems[0].id, expectedUpdatedAt: aliceItems[0].updatedAt },
      { id: bobOnly.item.id, expectedUpdatedAt: bobOnly.item.updatedAt },
    ];
    expect(
      (await request("/bulk", alice, "POST", { selected, status: "archived" }))
        .status,
    ).toBe(404);
    expect(
      (await (await request(`/${aliceItems[0].id}`, alice)).json()).item.status,
    ).toBe(aliceItems[0].status);
    const valid = aliceItems.map((item: { id: string; updatedAt: string }) => ({
      id: item.id,
      expectedUpdatedAt: item.updatedAt,
    }));
    expect(
      (
        await request("/bulk", alice, "POST", {
          selected: valid,
          status: "archived",
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request("", alice)).json()).items.every(
        (item: { status: string }) => item.status === "archived",
      ),
    ).toBe(true);
    expect(
      (
        await request("/bulk", alice, "POST", {
          selected: valid,
          status: "later",
        })
      ).status,
    ).toBe(409);
  });
  it("bounds malformed/large input without exposing DB errors or private content", async () => {
    const response = await api(
      new Request(`${origin}/api/items`, {
        method: "POST",
        headers: { cookie: alice, origin, "content-type": "application/json" },
        body: "private invalid input",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private invalid input");
    expect(
      (
        await request(
          "",
          alice,
          "POST",
          { text: "x" },
          { "content-length": String(1024 * 1024 + 1) },
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await request(
          "",
          alice,
          "POST",
          { text: "x" },
          { "content-type": "text/plain" },
        )
      ).status,
    ).toBe(415);
  });
  it("moves to Deleted, preserves prior state, restores and requires a separate permanent delete", async () => {
    const created = (
      await (
        await request("", alice, "POST", { text: "Trash lifecycle" })
      ).json()
    ).item;
    const done = (
      await (
        await request(`/${created.id}`, alice, "PATCH", {
          expectedUpdatedAt: created.updatedAt,
          patch: { status: "done", reminderAt: "2030-01-01T00:00:00.000Z" },
        })
      ).json()
    ).item;
    expect(
      (
        await request(`/${done.id}/permanent`, alice, "DELETE", {
          expectedUpdatedAt: done.updatedAt,
        })
      ).status,
    ).toBe(409);
    const deletedResponse = await request(`/${done.id}`, alice, "DELETE", {
      expectedUpdatedAt: done.updatedAt,
    });
    expect(deletedResponse.status).toBe(200);
    const deleted = (await deletedResponse.json()).item;
    expect(deleted.deletedAt).toBeTruthy();
    expect(deleted.status).toBe("done");
    expect(deleted.completedAt).toBe(done.completedAt);
    expect(deleted.reminderAt).toBe(done.reminderAt);
    expect(deleted.updatedAt).not.toBe(done.updatedAt);
    for (const [suffix, method] of [
      ["/restore", "POST"],
      ["/permanent", "DELETE"],
    ]) {
      expect(
        (
          await request(`/${done.id}${suffix}`, bob, method, {
            expectedUpdatedAt: deleted.updatedAt,
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(`/${done.id}${suffix}`, "", method, {
            expectedUpdatedAt: deleted.updatedAt,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(`/${done.id}${suffix}`, alice, method, {
            expectedUpdatedAt: done.updatedAt,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(
            `/${done.id}${suffix}`,
            alice,
            method,
            { expectedUpdatedAt: deleted.updatedAt },
            { origin: "https://evil.example" },
          )
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(`/${done.id}`, alice, "PATCH", {
          expectedUpdatedAt: deleted.updatedAt,
          patch: { title: "Cannot edit trash" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request("/bulk", alice, "POST", {
          selected: [{ id: done.id, expectedUpdatedAt: deleted.updatedAt }],
          status: "later",
        })
      ).status,
    ).toBe(409);
    const exported = await (await request("/export", alice)).json();
    expect(exported.version).toBe(3);
    expect(
      exported.items.find((entry: { id: string }) => entry.id === done.id)
        .deletedAt,
    ).toBe(deleted.deletedAt);
    const restored = (
      await (
        await request(`/${done.id}/restore`, alice, "POST", {
          expectedUpdatedAt: deleted.updatedAt,
        })
      ).json()
    ).item;
    expect(restored).not.toHaveProperty("deletedAt");
    expect(restored.status).toBe("done");
    expect(restored.completedAt).toBe(done.completedAt);
    const again = (
      await (
        await request(`/${done.id}`, alice, "DELETE", {
          expectedUpdatedAt: restored.updatedAt,
        })
      ).json()
    ).item;
    expect(
      (
        await request(`/${done.id}/permanent`, alice, "DELETE", {
          expectedUpdatedAt: again.updatedAt,
        })
      ).status,
    ).toBe(200);
    expect((await request(`/${done.id}`, alice)).status).toBe(404);
  });
  it("supports actual sign in, sign out, forged cookies and expiration", async () => {
    expect(
      (await request("", "personal-library.session_token=forged")).status,
    ).toBe(401);
    const signIn = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.test",
          password: "test-only-password-123",
        }),
      }),
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    expect((await request("", cookie)).status).toBe(200);
    const signedOut = await auth.handler(
      new Request(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(signedOut.status).toBe(200);
    expect((await request("", cookie)).status).toBe(401);
    const bobSession = await auth.api.getSession({
      headers: new Headers({ cookie: bob }),
    });
    await connection.db
      .update(session)
      .set({ expiresAt: new Date(0) })
      .where(eq(session.id, bobSession!.session.id));
    expect((await request("", bob)).status).toBe(401);
  });
  it("can close registration without preventing existing sign in", async () => {
    const closed = createAuth(connection.db, {
      baseUrl: origin,
      secret: "local-test-only-secret-not-for-production-123456789",
      allowSignUp: false,
    });
    const response = await closed.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          name: "No",
          email: "no@example.test",
          password: "test-only-password-123",
        }),
      }),
    );
    expect(response.ok).toBe(false);
  });
});
