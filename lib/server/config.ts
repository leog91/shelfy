import "server-only";
import { z } from "zod";

export function serverConfig() {
  const config = z
    .object({
      databaseUrl: z.string().min(1),
      authToken: z.string().optional(),
      secret: z.string().min(32),
      baseUrl: z.url(),
    })
    .safeParse({
      databaseUrl: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
      secret: process.env.BETTER_AUTH_SECRET,
      baseUrl: process.env.BETTER_AUTH_URL,
    });
  if (!config.success)
    throw new Error(
      "Account server is not configured. Follow docs/DEVELOPMENT.md and run bun run setup, then db:migrate.",
    );
  if (
    process.env.NODE_ENV === "production" &&
    !config.data.baseUrl.startsWith("https://")
  )
    throw new Error("Account server requires an HTTPS base URL in production.");
  return { ...config.data, allowSignUp: process.env.ALLOW_SIGN_UP === "true" };
}
