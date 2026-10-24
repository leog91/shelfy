import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

export function openDatabase(url: string, authToken?: string) {
  if (url.startsWith("file:") && url !== "file::memory:")
    mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}
export type Database = ReturnType<typeof openDatabase>["db"];
