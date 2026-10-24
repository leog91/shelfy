import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/connection";
import * as schema from "../db/schema";

export function createAuth(
  db: Database,
  config: { secret: string; baseUrl: string; allowSignUp: boolean },
) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins: [new URL(config.baseUrl).origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      disableSignUp: !config.allowSignUp,
    },
    session: { cookieCache: { enabled: false } },
    advanced: {
      cookiePrefix: "personal-library",
      database: { generateId: () => crypto.randomUUID() },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 20 },
        "/sign-up/email": { window: 60, max: 20 },
      },
    },
    telemetry: { enabled: false },
    logger: { disabled: true },
  });
}
