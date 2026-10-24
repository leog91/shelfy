import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.local")) {
  console.log(
    ".env.local already exists; no changes made. See .env.example for account settings.",
  );
} else {
  writeFileSync(
    ".env.local",
    `DATABASE_URL=\nDATABASE_AUTH_TOKEN=\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nBETTER_AUTH_URL=http://localhost:3000\nALLOW_SIGN_UP=true\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created private configuration. Fill DATABASE_URL and DATABASE_AUTH_TOKEN for Turso before approved migrations. No secret was printed.",
  );
}
