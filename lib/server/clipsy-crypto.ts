import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export const randomCredential = () => randomBytes(32).toString("base64url");
export const credentialHash = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

function key(secret: string) {
  if (secret.length < 32) throw new Error("Missing encryption key");
  return Buffer.from(
    hkdfSync("sha256", secret, "shelfy-clipsy-v1", "credential-encryption", 32),
  );
}
// Owner and purpose are authenticated too: ciphertext cannot be moved between accounts.
export function seal(
  value: string,
  owner: string,
  purpose: string,
  secret: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(`${owner}:${purpose}`));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal(
  value: string,
  owner: string,
  purpose: string,
  secret: string,
) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(`${owner}:${purpose}`));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
