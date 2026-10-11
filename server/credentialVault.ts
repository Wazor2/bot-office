import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const VAULT_SALT = Buffer.from("bot-office-provider-credential-vault:v1", "utf8");

function getEncryptionKey(): Buffer {
  const platformSecret = process.env.MANUS_JWT_SECRET;
  if (!platformSecret || platformSecret.length < 16) {
    throw new Error("The secure provider credential vault is not configured.");
  }

  // Derive a key dedicated to provider credentials; never reuse the session key directly.
  const projectScope = process.env.MANUS_PROJECT_ID || "self-hosted";
  const info = Buffer.from(`bot-office:provider-credentials:${projectScope}:v1`, "utf8");
  return Buffer.from(hkdfSync("sha256", Buffer.from(platformSecret, "utf8"), VAULT_SALT, info, 32));
}

/** Returns version.iv.tag.ciphertext (base64url); plaintext is never persisted. */
export function encryptProviderCredential(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Decryption is reserved for the server-side provider adapter; never expose its result to tRPC. */
export function decryptProviderCredential(payload: string): string {
  const [version, ivPart, tagPart, encryptedPart, extra] = payload.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !encryptedPart || extra !== undefined) {
    throw new Error("Stored provider credential has an unsupported format.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("Stored provider credential is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isCredentialVaultConfigured(): boolean {
  return Boolean(process.env.MANUS_JWT_SECRET && process.env.MANUS_JWT_SECRET.length >= 16);
}
