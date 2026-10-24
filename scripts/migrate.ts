import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/libsql/migrator";
import { openDatabase } from "../lib/db/connection";

loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url?.trim())
  throw new Error("Set DATABASE_URL before migrating. No changes made.");
if (!url.startsWith("file:") && process.env.CONFIRM_REMOTE_MIGRATION !== "true")
  throw new Error(
    "Remote migration requires explicit approval and CONFIRM_REMOTE_MIGRATION=true. No changes made.",
  );
const { db, client } = openDatabase(url, process.env.DATABASE_AUTH_TOKEN);
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  client.close();
}
