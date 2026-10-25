import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/connection";
import { clipsyConnection, clipsyPending } from "../db/schema";
import { json } from "./item-api";
import {
  credentialHash,
  randomCredential,
  seal,
  unseal,
} from "./clipsy-crypto";
import { clipsyOrigin, clipsyPost, fetchClipsySummary } from "./clipsy";

const credential = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const tokenResponse = z
  .object({ token: credential, expiresAt: z.number().int().positive() })
  .strict();
type Session = { user: { id: string }; session: { id: string } };

export function createClipsyApi(options: {
  db: Database;
  origin: string;
  secret: string;
  clipsyUrl?: string;
  resolveSession: (request: Request) => Promise<Session | null>;
  fetcher?: typeof fetch;
}) {
  const { db, origin, secret } = options;
  const fetcher = options.fetcher ?? fetch;
  const destination = (result: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `${origin}/account?clipsy=${result}`,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  return async function handle(request: Request, action: string) {
    let callback = false;
    try {
      callback = action === "callback" && request.method === "GET";
      if (request.method === "POST" && request.headers.get("origin") !== origin)
        return json({ error: "Use the configured app origin." }, 403);
      const session = await options.resolveSession(request);
      if (!session)
        return callback
          ? destination("failed")
          : json({ error: "Sign in again to connect Clipsy." }, 401);
      const owner = session.user.id;
      if (!callback && request.headers.get("x-workspace-id") !== owner)
        return json(
          { error: "Your account changed. Reload before connecting Clipsy." },
          401,
        );
      const remote = clipsyOrigin(options.clipsyUrl);
      const redirectUri = `${origin}/api/clipsy/callback`;
      const [connection] = await db
        .select()
        .from(clipsyConnection)
        .where(eq(clipsyConnection.userId, owner));

      if (action === "status" && request.method === "GET")
        return json({
          connected: Boolean(connection),
          expired: Boolean(connection && connection.expiresAt <= Date.now()),
          url: connection?.remoteOrigin ?? remote,
        });
      if (action === "summary" && request.method === "GET") {
        if (!connection) return json({ connected: false });
        if (connection.expiresAt <= Date.now())
          return json(
            {
              error:
                "Clipsy access expired. Disconnect and connect again in Account.",
            },
            409,
          );
        const token = unseal(
          connection.encryptedToken,
          owner,
          `access:${connection.remoteOrigin}`,
          secret,
        );
        return json({
          connected: true,
          ...(await fetchClipsySummary(
            {
              origin: connection.remoteOrigin,
              accessToken: token,
            },
            fetcher,
          )),
        });
      }
      if (action === "start" && request.method === "POST") {
        if (connection)
          return json(
            { error: "Disconnect the current Clipsy connection first." },
            409,
          );
        const state = randomCredential();
        const verifier = randomCredential();
        const pending = {
          userId: owner,
          remoteOrigin: remote,
          sessionId: session.session.id,
          stateHash: credentialHash(state),
          encryptedVerifier: seal(
            verifier,
            owner,
            `verifier:${remote}`,
            secret,
          ),
          expiresAt: Date.now() + 10 * 60_000,
          exchanging: false,
        };
        await db
          .insert(clipsyPending)
          .values(pending)
          .onConflictDoUpdate({ target: clipsyPending.userId, set: pending });
        const url = new URL("/integrations/shelfy", remote);
        url.search = new URLSearchParams({
          redirect_uri: redirectUri,
          state,
          code_challenge: credentialHash(verifier),
        }).toString();
        return json({ url: url.href });
      }
      if (callback) {
        const params = new URL(request.url).searchParams;
        const state = credential.parse(params.get("state"));
        const [pending] = await db
          .update(clipsyPending)
          .set({ exchanging: true })
          .where(
            and(
              eq(clipsyPending.userId, owner),
              eq(clipsyPending.sessionId, session.session.id),
              eq(clipsyPending.stateHash, credentialHash(state)),
              eq(clipsyPending.exchanging, false),
              gt(clipsyPending.expiresAt, Date.now()),
            ),
          )
          .returning();
        if (!pending) return destination("failed");
        if (params.get("error") === "access_denied") {
          await db
            .delete(clipsyPending)
            .where(eq(clipsyPending.stateHash, pending.stateHash));
          return destination("cancelled");
        }
        const code = credential.parse(params.get("code"));
        const verifier = unseal(
          pending.encryptedVerifier,
          owner,
          `verifier:${pending.remoteOrigin}`,
          secret,
        );
        const grant = tokenResponse.parse(
          await clipsyPost(
            pending.remoteOrigin,
            "token",
            { code, verifier, redirect_uri: redirectUri },
            fetcher,
          ),
        );
        try {
          if (
            grant.expiresAt <= Date.now() ||
            grant.expiresAt > Date.now() + 91 * 86400_000
          )
            throw new Error("Invalid grant expiration");
          await db.transaction(async (tx) => {
            // Disconnect/restart while exchange was in flight invalidates this save.
            const [claimed] = await tx
              .delete(clipsyPending)
              .where(
                and(
                  eq(clipsyPending.stateHash, pending.stateHash),
                  eq(clipsyPending.exchanging, true),
                  gt(clipsyPending.expiresAt, Date.now()),
                ),
              )
              .returning();
            if (!claimed) throw new Error("Connection cancelled");
            await tx.insert(clipsyConnection).values({
              userId: owner,
              remoteOrigin: pending.remoteOrigin,
              encryptedToken: seal(
                grant.token,
                owner,
                `access:${pending.remoteOrigin}`,
                secret,
              ),
              expiresAt: grant.expiresAt,
            });
          });
        } catch {
          await clipsyPost(
            pending.remoteOrigin,
            "revoke",
            {},
            fetcher,
            grant.token,
          ).catch(() => undefined);
          return destination("failed");
        }
        return destination("connected");
      }
      if (action === "disconnect" && request.method === "POST") {
        // Cancel pending callbacks and read the current credential under the same
        // write transaction; a callback cannot slip a new grant past disconnect.
        const current = await db.transaction(async (tx) => {
          await tx.delete(clipsyPending).where(eq(clipsyPending.userId, owner));
          const [saved] = await tx
            .select()
            .from(clipsyConnection)
            .where(eq(clipsyConnection.userId, owner));
          return saved;
        });
        // Keep the local credential if remote revocation fails, so it can be retried.
        if (current) {
          const token = unseal(
            current.encryptedToken,
            owner,
            `access:${current.remoteOrigin}`,
            secret,
          );
          await clipsyPost(current.remoteOrigin, "revoke", {}, fetcher, token);
          await db
            .delete(clipsyConnection)
            .where(
              and(
                eq(clipsyConnection.userId, owner),
                eq(clipsyConnection.encryptedToken, current.encryptedToken),
              ),
            );
        }
        return json({ connected: false });
      }
      return json({ error: "Not found" }, 404);
    } catch {
      return callback
        ? destination("failed")
        : json(
            {
              error:
                "Clipsy is unavailable. Try again or reconnect in Account.",
            },
            503,
          );
    }
  };
}
