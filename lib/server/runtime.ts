import "server-only";
import { openDatabase } from "../db/connection";
import { serverConfig } from "./config";
import { createAuth } from "./auth-factory";

function createRuntime() {
  const config = serverConfig();
  const { db } = openDatabase(config.databaseUrl, config.authToken);
  return {
    db,
    auth: createAuth(db, config),
    origin: new URL(config.baseUrl).origin,
  };
}
let runtime: ReturnType<typeof createRuntime> | undefined;
export function getRuntime() {
  return (runtime ??= createRuntime());
}
