import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { openDatabase } from "../lib/db/connection";

// Override local settings before Next reads .env.local. Never use a developer's DB.
const filename = `./.data/e2e-${randomUUID()}.db`;
const env = {
  ...process.env,
  DATABASE_URL: `file:${filename}`,
  DATABASE_AUTH_TOKEN: "",
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  BETTER_AUTH_URL: "http://localhost:3100",
  ALLOW_SIGN_UP: "true",
};
const { db, client } = openDatabase(env.DATABASE_URL);
await migrate(db, { migrationsFolder: "./drizzle" });
client.close();
const child = spawn("bun", ["dev", "--port", "3100"], {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  for (const suffix of ["", "-wal", "-shm"])
    rmSync(filename + suffix, { force: true });
  process.exit(code ?? 0);
});
